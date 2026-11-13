# RFC-DATA-LIFECYCLE — Retention, Export, Delete, and Legal Hold Proposal

**Status: Proposal only — non-canonical; pending Product, Legal/Privacy, Security, and Engineering approval**  
**Date:** 2026-11-13  
**Decision owners:** Legal/Privacy + Product, with Security/Data/Engineering implementation review  
**Scope:** Lifecycle governance for raw evidence, projections, assertions, audit, telemetry, exports, backups, and legal holds

> This RFC deliberately proposes policy questions and controls rather than retention durations or destructive behavior. It does not edit canonical policy, implement retention/export/delete, or authorize real-data ingestion.

## 1. Decision requested

Approve a data inventory and lifecycle-control framework, then have Legal/Privacy and Product set the actual retention periods, legal basis, jurisdictions, export semantics, deletion exceptions, and hold authority. Until those decisions are recorded, the current safe position is synthetic/disposable data only and no improvised generic export/delete command.

## 2. Current implementation and evidence facts

- Canonical and research sources require raw preservation, append-audit, explicit UNKNOWN, privacy controls, export/delete planning, and retention before real-data ingest; they do not provide approved durations or a complete legal policy.
- `product/migrations/001_domain.up.sql` includes separate tables for customer, lead, handoff, commercial event, assertion envelope, outcome, audit, and raw commercial envelope. Raw payloads are JSONB with hash; synthetic status is explicit; audit rows are append-oriented, but current projections remain mutable.
- Migration 005 quarantines workspace contradictions as JSONB snapshots and intentionally retains live historical rows. Deleting a workspace currently cascades through selected schema relationships, while audit and polymorphic relationships require separate governance; this must not be treated as an approved deletion workflow.
- The existing RBAC helper exposes `canExport` and `canDelete` only for `admin`, but no public safe export/delete operation, retention scheduler, legal-hold store, deletion manifest, backup propagation check, or policy engine exists.
- `product/scripts/backup-verify.mjs` is a conservative disposable-local helper. It does not delete, create, or clean databases and explicitly says it is not a retention engine or legal-compliance control.
- `docs/reports/rebuild-baseline-2026-11-12/operations.md` records the required audit checklist and states that retention/export/delete policy is not implemented.

**Evidence:** `docs/research/pancake-revenue-platform-documentation/09_FINANCE_LEGAL_SECURITY/DATA_RETENTION.md`; `.../PRIVACY.md`; `docs/research/pancake-revenue-platform-documentation/05_ENGINEERING/SECURITY_ARCHITECTURE.md`; `docs/canonical/DOMAIN_INVARIANTS.md` (I-05, I-08, I-12); `docs/canonical/OPEN_DECISIONS.md`; `docs/implementation-plan/03-requirements.md` (R-18–R-19); `product/migrations/001_domain.up.sql`; `product/migrations/005_workspace_consistency.up.sql`; `product/src/infra/rbac/rbac.service.ts`; `product/scripts/backup-verify.mjs`; `docs/reports/rebuild-baseline-2026-11-12/operations.md`.

## 3. Proposed data inventory and lifecycle states

The inventory must classify every dataset by owner, tenant/workspace scope, subject scope, source, sensitivity, purpose, location, derivation, retention authority, deletion behavior, backup presence, and evidence quality. At minimum review:

1. **Raw inbound evidence:** `commercial_envelope.raw_payload`, raw pointers/hashes, source timestamps, mapping errors, connector snapshots.
2. **Canonical projections:** customer/lead/handoff/work-item/outcome and mutable current projections.
3. **Assertions and inferred events:** `assertion_envelope`, `commercial_event`, AI drafts, model/rule metadata, evidence references.
4. **Audit/provenance:** `audit_record`, outbox/product events, quarantine snapshots, migration history.
5. **Credentials and operational metadata:** connector references, tokens, key metadata, access/session logs, support grants.
6. **Analytics and learning:** telemetry, feedback, aggregates, evaluation fixtures, synthetic data, derived metrics.
7. **Copies:** logical backups, replicas, exports, temporary files, logs, caches, disaster-recovery copies, and subprocessors.

Proposed lifecycle states (not policy decisions): **active → restricted → export-approved → hold → deletion-approved → deletion-pending → deleted/tombstoned → verification-pending → verified**. A hold must suspend expiry/destruction for the approved scope and retain its authority, start/end/release, legal basis, and affected copies. “Deleted” must distinguish inaccessible primary data from cryptographic erasure, backup expiry, and retained immutable audit evidence.

## 4. Proposed control workflow

### Export

- Require authenticated actor, approved capability, purpose/legal basis, exact workspace/lead scope, field minimization, destination, recipient, expiry, and reviewer/approval.
- Produce a dry-run manifest and digest before materialization. Preserve raw and derived records as separate categories; mark unknown/conflicted scope and block rather than guess.
- Encrypt output using approved key custody; prohibit credentials/tokens in output and logs; record tool/version, selection, redaction, recipient, transfer channel, expiry, and immutable audit event.
- Verify recipient access and delivery, then expire/revoke access. Do not claim an export is a complete subject access response until Legal/Privacy defines completeness.

### Delete

- Require an approved policy version and dry-run manifest; resolve workspace/subject scope and dependencies before mutation.
- Check legal holds, active investigations, audit obligations, contractual retention, backup/replica behavior, and derived/evaluation copies. Any unknown or contradiction fails closed.
- Use append-only deletion request/approval/result records; never overwrite history to hide deletion. Preserve only the minimum legally required tombstone/receipt, with no raw payload or token.
- Apply deterministic, idempotent deletion to approved primary/derived stores and record unavailable/offline copies for separately governed expiry. Verify post-action query isolation and applicable backup/catalog state.

### Legal hold

- Legal/Privacy is the authority to create, scope, amend, and release holds; Engineering cannot infer a hold from a free-text request.
- Scope by tenant/workspace, subject, record classes, time range, and copies; require reason, authority, approval ID, created/released timestamps, and immutable audit.
- Hold checks must run before retention purge, delete, export redaction, backup expiry, and destructive migration. Conflicting or missing scope blocks action.

### Retention and purge

- Retention jobs must use versioned policy, deterministic due dates, timezone rules, and a dry-run/approval mode for sensitive classes.
- Never use a single global duration for raw messages, AI-derived events, audit, tokens, aggregates, deleted subjects, and evaluation samples. Legal approval is required for every duration and exception.
- Monitor failures, skipped/held rows, partial copies, and policy changes. Purge must be resumable and idempotent, with no silent retries that bypass holds.

## 5. Alternatives

- **A — No automated lifecycle yet (current safe baseline):** avoids accidental destruction but leaves manual obligations and storage risk; suitable only for synthetic/local pilot.
- **B — Fixed global retention:** simple but conflicts with data class, jurisdiction, hold, and contract differences; not recommended.
- **C — Policy-as-data lifecycle engine (proposed):** versioned class/tenant/jurisdiction policies, approvals, holds, manifests, and workers; strongest auditability but requires legal policy and substantial engineering.
- **D — Customer-managed lifecycle:** customer supplies policy and deletion authority; supports enterprise needs but creates onboarding, validation, and support complexity.
- **E — External governance/DLP/archive service:** may improve compliance operations but introduces subprocessors, cost, residency, and synchronization risks; needs separate review.

## 6. Migration and security impact

- Inventory current tables/copies and classify synthetic vs real before activating any worker. Existing rows have no approved retention metadata; do not backfill legal meanings.
- Add append-only policy, request, approval, hold, manifest, and result records with stable IDs, actor, scope, policy version, evidence digest, and status. Preserve existing audit/quarantine evidence.
- Add explicit data-class and provenance metadata at ingest for future real data, while retaining UNKNOWN where unavailable. This is not permission to alter canonical semantics.
- Build a policy evaluator and dry-run tools before destructive operations. Isolate worker credentials and ensure jobs cannot bypass tenant/RLS/PM-1 checks.
- Add tests for minimization, scope, hold precedence, idempotency, retries, partial failures, backups, replicas, cross-workspace denial, redaction, and audit immutability. Run only against disposable synthetic fixtures until approvals are complete.
- Security impact includes increased risk from exports, deletion bugs, hold bypass, residual copies, and audit/PII leakage; compensate with dual control, encryption, least privilege, and independent verification.

No production implementation is included.

## 7. Unresolved questions

- What jurisdictions, controller/processor roles, legal bases, contracts, and data-subject rights apply?
- What retention durations and start events apply to each data class and each copy?
- Which audit/provenance records must remain after subject deletion, and how is minimization achieved?
- What is the exact export scope: raw payload, projections, audit, derived/AI records, logs, backups, and subprocessor copies?
- What constitutes deletion in immutable audit, logical backups, PITR/WAL, replicas, caches, provider systems, and evaluation datasets?
- Who can request, approve, execute, verify, release, and override a hold? Is dual control mandatory?
- How are conflicts between customer deletion request, legal hold, security incident, statutory retention, and contractual obligations resolved?
- What notification, portability, redaction, encryption, recipient, and transfer controls are required for export?
- How are failed/partial/offline copies surfaced to the requester and auditor?
- Is configurable customer retention part of LVP or deferred productization? What is the support/SLA impact?

## 8. Required approvals and evidence

- Legal/Privacy approval of controller/processor analysis, purposes/legal bases, durations, deletion exceptions, hold authority, export rights, jurisdictions, and subprocessors.
- Product/Data approval of user-visible lifecycle semantics and what “complete export” and “deleted” mean.
- Security approval of threat model, encryption/key custody, redaction, access/dual control, audit, and incident response.
- Engineering/DBA approval of schema, worker, transaction, backup/replica, recovery, and migration design.
- Independent review of dry-run manifests and executed disposable tests; production readiness requires real deployment evidence, not local unit tests.

## 9. No-go conditions

Do not ingest real customer data or run destructive lifecycle automation if retention/legal basis is unknown; a hold cannot be represented and checked; export/delete scope is ambiguous; backup/replica/subprocessor propagation is unknown; caller input can widen scope; audit can be overwritten; raw payloads/tokens enter logs; deletion is irreversible without an approved recovery decision; a policy worker can bypass authorization; or Legal/Privacy and Security approvals are missing.

## 10. Evidence gaps

The repository has no approved retention durations, jurisdiction matrix, controller/processor decision, complete data inventory, export/delete implementation, legal-hold store, retention scheduler, backup deletion propagation, PITR/WAL policy, subprocessor deletion proof, or independent semantic verification. Existing operational checklists are guardrails and gaps, not compliance evidence.
