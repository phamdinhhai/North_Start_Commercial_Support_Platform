# Completion evidence persistence — A3 follow-up

Date: 2026-11-17. Baseline: `architecture-baseline.md` A3; implementation base `96ac4a9`.

## Finding and change

Confirmed A3: `PilotLoopService.completeWork` already writes the exact human declaration and explicit confirmation into its returned work state and append-only completion audit. PostgreSQL omitted both fields in the work projection INSERT/UPDATE, SELECT and `toWork`, so a subsequent load discarded claim details even though the audit retained them. This was a projection continuity defect, not absence of historical audit evidence.

Migration `009_work_completion_provenance` adds nullable `declaration TEXT` and `confirmed BOOLEAN` columns. The existing parameterized work projection upsert now persists both; load selects and maps both without trimming declaration text or coercing missing confirmation to false. SQL NULL maps to absent optional fields. There is no backfill from reason, completion status, audit, timestamps or other indirect evidence.

The existing mutable current-work projection contract and immutable work identity fields remain intact. Audit entries remain append-only and state/audit writes share the existing transaction. Raw envelopes and their hashes are unchanged. The queue contract deliberately excludes evidence contents and pointers, so declaration/confirmation are not added to that redacted projection; its authorization predicate is outside this work item.

Read governing I-05, I-08, I-12 and canonical open decisions. This change persists existing application semantics; it adds no permissions, transition, canonical entity, attribution model, merge rule or resolution of CE-1/CE-2/PM-1.

## Evidence

Ran `npm ci`, `npm run typecheck`, and `npm run build` successfully in the isolated worktree. Dependency install reports five moderate advisories; no dependency changes made.

Real PostgreSQL execution used only the assigned `disposable_evidence` database on the local test server. The dedicated migration suite uses a randomly named schema and drops only that schema after testing, so migration down/up does not affect public schema or concurrent suites.

Command: `npx vitest run src/infra/postgres/completion-provenance.integration.spec.ts src/infra/postgres/migrator.spec.ts src/infra/postgres/pilot-loop.integration.spec.ts src/application/pilot/pilot-loop.service.spec.ts` from `product/`, with TEST_DATABASE_URL pointing at the assigned database. Result: **4 files passed, 48 tests passed, zero skips**.

The dedicated regression proves:

- Pre-009 completed legacy work upgrades with declaration/confirmation NULL; load preserves their absence and UNKNOWN occurredAt rather than fabricating human confirmation from a legacy reason.
- Real create -> handoff -> accept -> complete flows preserve the complete WorkItem exactly across pool teardown and a fresh PostgreSQL service/store, including whitespace/newline declaration text, confirmed=true, completion basis and UNKNOWN occurredAt.
- Observed completion uses a separate system automatic-observation envelope linked by the handoff. Reload retains the evidence pointer and introduces no human declaration/confirmation. The completion audit retains the evidence hash and pointer.
- Human completion audit retains the original declaration and confirmation.
- Migration down/up retains the existing audit history exactly and preserves the remaining work fields.

System evidence is a test fixture entering through the adapter/store boundary. Manual intake intentionally forces imported_record/manual and is not misrepresented as automatic observation.

## Migration and rollback limits

Apply migration 009 before deploying the updated store: its SELECT/INSERT requires the new columns. Nullable additions leave legacy rows unknown and require no reconstruction of human claims.

The down migration **drops both new projection columns and loses their values**. A subsequent up creates NULL columns; it cannot restore those values. The tested audit remains available, but the application does not automatically reconstruct projections from it. Back up before downgrade or keep the forward schema when rolling back application code. This is schema reversibility, not a promise of lossless projection-data reversal. No audit rows or raw envelopes are edited by either migration.
