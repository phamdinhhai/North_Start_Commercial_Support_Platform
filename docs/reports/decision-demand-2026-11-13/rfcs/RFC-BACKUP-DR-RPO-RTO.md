# RFC-BACKUP-DR — Backup, Restore, and Disaster Recovery Proposal

**Status: Proposal only — non-canonical; pending Engineering, Security, Product, and Legal/Operations approval**  
**Date:** 2026-11-13  
**Decision owners:** Engineering + Security/SRE, with Product and Legal/Privacy review  
**Scope:** PostgreSQL pilot durability, backup, restore, disaster recovery, and operational evidence

> This RFC does not claim production backup/DR capability, select a provider, set RPO/RTO commitments, or modify production code. It is a proposal for human review.

## 1. Decision requested

Approve a backup/DR target and operating model for the platform: recovery objectives, backup classes, encryption/key custody, retention/hold interaction, restore verification, tenant-boundary preservation, ownership, incident runbooks, and evidence cadence. Until approval, limit execution to caller-created disposable local databases and synthetic fixtures.

## 2. Current implementation facts

- PostgreSQL is the durable pilot store; current schema migrations are `001`–`007`. The application persists raw envelopes, projections, outcome/assertion records, audit records, and workspace-linked children. Audit/provenance semantics require append-only history and no fabrication.
- `product/scripts/backup-verify.mjs` supports dry-run/explicit execution of local `pg_dump` custom-format backups, `pg_restore --list`, and restore verification into an explicitly caller-created disposable database. It rejects remote/system databases, implicit targets, unsafe names, existing output without `--force`, and missing acknowledgement. It never creates, drops, cleans, or overwrites a database.
- `docs/reports/rebuild-baseline-2026-11-12/operations.md` explicitly identifies the helper as neither a production scheduler nor encryption/key-management, PITR, retention, or legal-compliance control. It also requires independent post-restore checks; a successful `pg_restore` exit is not semantic equivalence.
- `product/docker-compose.yml` is a local PostgreSQL 16 development setup with a named volume and development default environment values unless overridden; it is not a production backup or DR design.
- Existing local/disposable tests and static reports do not establish hosted backup, off-site copies, PITR, cross-region recovery, restore-time RPO/RTO, or production credential/storage controls.

**Evidence:** `product/scripts/backup-verify.mjs`; `product/scripts/backup-verify.test.mjs`; `docs/reports/rebuild-baseline-2026-11-12/operations.md`; `docs/reports/rebuild-baseline-2026-11-12/acceptance-status.md`; `product/migrations/001_domain.up.sql` through `007_evidence_acquisition.up.sql`; `product/docker-compose.yml`; `docs/research/pancake-revenue-platform-documentation/05_ENGINEERING/SECURITY_ARCHITECTURE.md`; `docs/research/pancake-revenue-platform-documentation/09_FINANCE_LEGAL_SECURITY/DATA_RETENTION.md`.

## 3. Proposed backup and recovery model

### Backup classes

1. **Primary logical backup:** versioned, encrypted, integrity-digested PostgreSQL logical backup for portability and migration rehearsal.
2. **Physical/base backup + WAL/PITR:** provider-native or PostgreSQL-supported point-in-time recovery for bounded data loss and faster recovery; requires explicit storage and key controls.
3. **Off-site/independent copy:** separate failure domain and access control; residency and subprocessor approval required.
4. **Configuration/release backup:** migration version, application image/source digest, policy/config/feature-flag versions, secret/key references (never raw secrets), and dependency/tool versions.
5. **Evidence/audit preservation:** backup manifests and restore verification records retained under approved lifecycle/hold policy; backups are copies, not a new commercial source of truth.

### Proposed control properties

- Every backup has artifact digest, source identity, scope, timestamp, schema/migration version, tool/provider version, encryption/key reference, retention class, legal-hold status, and owner.
- Backup credentials are separate, least privilege, short-lived where supported, rotated, and never logged. Storage is private, encrypted in transit/at rest, access audited, and deletion requires lifecycle policy.
- Backup jobs are idempotent and alert on failure, staleness, size anomaly, incomplete WAL, key/access errors, and retention/hold conflict. No silent overwrite.
- Restore is performed into an isolated environment first, with migration compatibility, row/relationship counts, representative raw hash/audit/provenance checks, authorization/tenant negative tests, health checks, and application behavior checks. Restore success alone is insufficient.
- Recovery order is documented: infrastructure, database/backup, migration compatibility, application release, secret references, policy/RLS/authorization, then traffic. If policy state is missing or ambiguous, keep the restored system inaccessible.
- Backups and restores must preserve or deliberately reconstruct workspace boundaries, immutable raw bytes/hashes, append-only audit history, UNKNOWN values, and evidence links. No backfill or merge is allowed during recovery.

### Recovery objectives (proposal questions, not commitments)

Set target **RPO** (maximum acceptable data loss) and **RTO** (maximum acceptable restoration time) per deployment/data class after a workload and commercial impact review. Define whether objectives cover primary outage, region loss, corruption/ransomware, operator error, key loss, and provider outage. Record measurement method, clock, dependency assumptions, degraded-mode behavior, and customer communication. Do not publish an SLA until repeatable tests demonstrate the target.

## 4. Alternatives

- **A — Local logical dumps only (current helper):** portable and simple, but slow/manual and cannot meet most availability objectives or region-loss needs.
- **B — Managed PostgreSQL automated backups/PITR:** practical operational baseline with provider controls; depends on provider, region, key, residency, and contract review.
- **C — Self-managed base backup + WAL + off-site object storage:** maximum control and portability, but high operational burden and failure-mode risk.
- **D — Multi-region/active standby:** lower recovery time and potentially lower data loss, but substantial cost, consistency, failover, residency, and authorization complexity.
- **E — Customer-managed backup/export:** supports customer-hosted/portability models, but shifts operational responsibility and complicates support and proof. Productization R-35 remains deferred and needs a human/legal gate.

## 5. Migration and security impact

1. Establish a backup inventory and classify all existing local/disposable artifacts; never upload customer data from this baseline.
2. Select provider/storage/key custody and create separate backup identities. Remove development defaults from any production deployment plan.
3. Capture release/migration/policy digests with each backup. Version the manifest and verification contract without changing canonical semantics.
4. Automate encrypted backup scheduling, retention, alerting, and immutable/audited access only after approved policy. Integrate legal holds and deletion lifecycle before destructive expiry.
5. Build restore rehearsal in isolated disposable environments. Add schema, raw-hash, audit, workspace/RLS/PM-1, cross-tenant, and representative end-to-end checks. Measure RPO/RTO with failure injection and record limitations.
6. Document failover, failback, degraded/manual mode, incident communications, key compromise, corrupted backup, and provider outage. Rollback must preserve evidence and fail closed on uncertain authorization.

No production implementation is included.

## 6. Unresolved questions

- What RPO/RTO targets and availability commitments are appropriate for the current pilot versus future commercial deployments?
- Is logical backup, physical/PITR, or both required? Which data classes and copies are in scope?
- Which provider, region, residency, subprocessor, contractual, and customer-managed options are acceptable?
- Who owns encryption keys, backup credentials, rotation, recovery approval, and emergency access? Is customer-controlled key custody required?
- How do backup retention, legal holds, deletion requests, and immutable audit obligations interact?
- What is the authoritative restore manifest: application image, migrations, policies/RLS, permissions, feature flags, connector configuration, and secret references?
- How are backups verified for semantic completeness, workspace isolation, raw hash preservation, audit continuity, and unknown/conflicted values?
- What happens if backups are incomplete, encrypted with an unavailable key, outside residency, or restored under a changed policy?
- Are replicas and WAL archives treated as backups for export/delete/hold purposes? How are they expired?
- What incident severity, customer notice, and recovery communications are required?

## 7. Required approvals and evidence

- Engineering/SRE approval of architecture, objectives, failure model, runbooks, monitoring, staffing, and restore test plan.
- Security approval of storage/network isolation, encryption, key custody/rotation, backup IAM, immutable access logs, ransomware/operator threat model, and incident response.
- Product approval of pilot/deployment commitments, degraded-mode behavior, and customer-facing recovery expectations.
- Legal/Privacy approval of provider/subprocessor, residency, retention, legal holds, deletion/export propagation, and contractual commitments.
- Independent recovery rehearsal evidence using disposable data and a separate failure domain, including measured RPO/RTO and semantic/tenant verification. Hosted execution is still required.

## 8. No-go conditions

Do not claim DR readiness or promise RPO/RTO if backups are unencrypted/untracked; only development credentials or shared admin roles exist; no off-site/failure-domain strategy is approved; restore has not been independently rehearsed; policies/RLS/PM-1 are absent or ambiguous after restore; legal holds/deletion propagation are unknown; raw/audit hashes cannot be verified; backup access is unaudited; key loss has no recovery plan; or recovery testing would touch production/customer data without approval.

## 9. Evidence gaps

No production scheduler, managed backup configuration, off-site encrypted artifact, key-rotation evidence, PITR/WAL evidence, cross-region plan, restore RPO/RTO measurement, failure-injection result, semantic restore verifier, tenant/RLS restore proof, legal-hold integration, or hosted operational runbook is present in the repository. The local backup helper and tests prove safety constraints for disposable verification only, not production DR capability.
