# RFC-TENANT — Tenant Defense-in-Depth and PostgreSQL RLS Proposal

**Status: Proposal only — non-canonical; pending human and engineering approval**  
**Date:** 2026-11-13  
**Decision owners:** Security + Engineering, with Product/Data review  
**Scope:** Workspace/tenant isolation for the PostgreSQL-backed pilot

> This RFC does not claim that RLS is implemented, does not change canonical documents, and does not authorize production data. It proposes controls for review only.

## 1. Decision requested

Decide whether PostgreSQL row-level security (RLS), in addition to application authorization and workspace-keyed schema constraints, is required before real-data pilot use; if yes, approve the session-context, connection-pool, migration, bypass, and operational model. The proposal is defense-in-depth, not a replacement for PM-1 or application checks.

## 2. Current implementation facts

- The frozen boundary is workspace isolation plus lead-scoped Sales access (I-09/R-01/R-03). PM-1 still leaves the detailed capability matrix open.
- The schema has `workspace_id` on `workspace`, `customer`, `lead`, handoff, commercial events, assertions, outcomes, audit, envelopes, feedback, and pilot work items. `product/migrations/005_workspace_consistency.up.sql` adds composite parent/child constraints for several lead-owned tables and a trigger for lead audit rows.
- Migration 005 intentionally quarantines and retains historical contradictions, uses `NOT VALID` composite foreign keys, does not infer workspace, and leaves polymorphic non-lead audit relationships outside the trigger. This is a hardening step, not proof of complete tenant isolation.
- The application `RbacService` performs workspace equality and lead owner/recipient checks; privileged roles currently have interim workspace-wide view. The PostgreSQL store uses parameterized queries and transaction-scoped mutation/CAS behavior, but no database RLS policies are present.
- The Docker Compose file exposes PostgreSQL on a configurable host port and uses development default credentials unless overridden. That is a local development setup, not production deployment evidence.

**Evidence:** `docs/canonical/DOMAIN_INVARIANTS.md` (I-09/I-12); `docs/canonical/OPEN_DECISIONS.md` (PM-1); `docs/implementation-plan/03-requirements.md` (R-01–R-03, R-18–R-19, R-28); `product/migrations/001_domain.up.sql`; `product/migrations/005_workspace_consistency.up.sql`; `product/src/infra/rbac/rbac.service.ts`; `product/src/infra/postgres/pg-pilot.store.ts`; `product/docker-compose.yml`; `docs/reports/rebuild-baseline-2026-11-12/handoff.md`.

## 3. Proposed control layers

### Layer 1 — Application authorization (required regardless of RLS)

Authenticate the subject, derive workspace and capabilities server-side, enforce PM-1 route and lead/item scope, redact response fields, and append audit records for sensitive reads/writes. Application checks remain responsible for roles, ownership, recipient, purpose, legal hold, and action semantics.

### Layer 2 — Data model and query discipline (current direction, to complete)

Require every tenant-owned query and mutation to carry a server-derived workspace scope. Keep workspace columns, composite parent/child keys, append-only audit semantics, and immutable raw envelopes. Add static/query tests for every repository method and make ambiguous/missing workspace context a hard error. Do not rely on an external connector's token scope.

### Layer 3 — PostgreSQL RLS (proposed)

For each tenant-owned table, enable and force RLS for the application role. Policies should compare `workspace_id` to a transaction-local setting such as `app.workspace_id`, set only after the authenticated request has passed authorization. Use `SET LOCAL` inside the same transaction; never use a process-global setting in a pooled connection. Where a table is lead-scoped, RLS can join to a protected lead relationship only if the join policy is designed and benchmarked; role/capability predicates that need item ownership remain in the application layer.

Proposed invariants for the RLS design:

- No request transaction may access tenant rows before a validated workspace context is set.
- The application role must not own tenant tables, bypass RLS, or receive an unreviewed `BYPASSRLS` privilege.
- Migration/maintenance roles are separate, short-lived, audited, and unavailable to request handlers.
- `current_setting(..., true)` missing or malformed must deny, not default to a workspace.
- Every pool checkout must reset context; transaction-local context must not leak across requests.
- Cross-workspace reads, inserts, updates, deletes, `RETURNING`, joins, CTEs, and error paths must be tested.
- RLS does not establish permission to export/delete or read raw evidence; those remain PM-1 and policy checks.

### Layer 4 — Operational boundary

Separate application, migration, backup, and administrator roles; restrict network access; remove development defaults; encrypt connections and storage through the selected platform; monitor policy changes and denied access; document incident response and restore behavior. Backup/restore must preserve or deliberately re-establish policies and tenant boundaries before data is exposed.

## 4. Alternatives

- **A — Application-only:** minimal migration and current architecture, but a missed predicate or unsafe query can cross tenants. Not recommended for real-data use without a documented compensating control review.
- **B — Application + schema constraints (current direction):** catches explicit relationship inconsistencies and improves future writes, but does not protect against all query omissions or privileged DB paths.
- **C — Application + schema + RLS (proposed):** layered defense against query omissions and pool-context mistakes when carefully designed; adds policy complexity, migration risk, testing and performance work.
- **D — Database per tenant/workspace:** stronger isolation boundary, but expensive provisioning, migrations, backup/restore, reporting, and operational ownership; outside current LVP evidence.
- **E — Separate service/database security proxy:** centralizes policy, but adds a new high-availability and trust boundary not justified by current pilot evidence.

## 5. Proposed migration and rollout

1. Inventory all tenant-owned and polymorphic tables, repository queries, background jobs, migrations, admin/backup paths, and connection roles. Classify tables where `workspace_id` is direct, derived, nullable, or unknown.
2. Resolve PM-1 and define whether RLS represents workspace membership only or also lead/item capability. Do not encode unresolved semantics in SQL.
3. Create separate non-owner application role and a no-bypass policy test role. Add policies in a migration with explicit rollback that does not weaken existing constraints without approval.
4. Implement a transaction wrapper that sets and resets the context after authentication. Add pool leak tests, aborted-transaction tests, nested transaction tests, and concurrency tests.
5. Run shadow observability against synthetic fixtures; compare application-deny and database-deny decisions. Resolve every mismatch without inferring access.
6. Enforce only after independent Security/DBA review, fresh disposable-DB integration evidence, backup/restore policy checks, and an incident rollback plan. Rollback must fail closed or disable access; it must not silently disable isolation.

No production migration or RLS policy is included in this RFC.

## 6. Unresolved questions

- Is the isolation unit workspace, customer instance, tenant, or another future control-plane boundary? Do not collapse these concepts.
- Which request and background-job identities may set `app.workspace_id`, and how are they authenticated?
- Does RLS enforce only workspace membership, or also lead assignment/recipient capabilities? What are the performance and correctness boundaries?
- How are system-wide health, migration, quarantine, audit, export, delete, legal hold, and backup operations scoped?
- Should synthetic/demo data use separate workspaces, schemas, databases, roles, or all of them?
- How are legacy contradictory rows and polymorphic audit rows handled before policy validation? Are they inaccessible, remediated, or retained under a quarantined access path?
- How do logical backups, point-in-time recovery, replicas, reporting jobs, and support tools retain policy context?
- What monitoring, alerting, and emergency break-glass process exists if RLS denies a legitimate request or a policy is bypassed?

## 7. Required approvals and evidence

- Security threat-model and independent policy review, including owner/BYPASSRLS privilege review.
- Engineering/DBA approval of role, pool, transaction-context, migration, performance, rollback, and restore design.
- Product/Data approval that policy scope reflects PM-1 and does not invent lead semantics.
- Privacy/legal review of tenant boundary, support/admin access, replicas, exports, backups, residency, and deletion/hold obligations.
- Executed disposable PostgreSQL evidence for every tenant-owned table and query class, including negative tests and connection-pool context isolation; hosted deployment evidence remains separate.

## 8. No-go conditions

Do not enable RLS or claim tenant isolation if workspace context can be caller-selected; the request role owns tables or bypasses RLS; missing context defaults to a tenant; pooled context can leak; any tenant-owned table/query is unclassified; polymorphic audit semantics are guessed; migration 005 contradictions are silently rewritten/deleted; backup/restore bypasses controls; cross-workspace negative tests are absent; or application and database decisions disagree without an approved policy.

## 9. Evidence gaps

No RLS policy, non-owner production role, transaction-context wrapper, pool leak test, full query inventory, production network boundary, encrypted off-site backup, replica policy, or restore-with-RLS evidence exists in the current tree. Existing application/unit/PG evidence demonstrates selected behavior only and cannot prove defense-in-depth tenant isolation.
