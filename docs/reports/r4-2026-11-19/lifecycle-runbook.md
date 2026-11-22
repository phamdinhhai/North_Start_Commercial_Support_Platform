# Pilot data lifecycle runbook

## Available sandbox function

An authenticated non-demo workspace admin may request GET /v1/pilot/lifecycle/leads/:leadId/export after the PostgreSQL provider/controller is composed. The response is a JSON attachment with no-store caching. Workspace and actor come from existing authentication; no workspace/body override exists. Foreign/missing leads return404. Other roles return403. The transaction takes a repeatable-read snapshot and appends LEAD_DATA_EXPORTED audit before returning; audit failure fails the request. The artifact is not saved on the server. Transport must use the pilot's configured HTTPS boundary.

The version1 artifact explicitly describes its scope and exclusions. It contains a single lead's pilot records, accepted ingest evidence, assertions, handoffs/work/outcomes, related audit and optional013context/command history. Synthetic classification is explicit; unknown provenance remains unknown. Customer identity, membership/credentials, unlinked research frames, workspace telemetry and disabled governed-action foundation records are excluded. This is a scoped pilot export, not a claim of exhaustive legal subject-access export across every subsystem. Each collection is capped1000rows and total JSON5MB; exceeding limits returns413 rather than a partial artifact. A future reviewed bulk export is needed for larger cases.

## Retention and erasure status

NOT IMPLEMENTED: physical deletion, anonymization, automatic retention expiry, legal-hold management and universal access suppression. No endpoint or job pretends to delete data. Migration015 is intentionally absent. Append-only raw evidence/audit can retain personal content; a suppression overlay alone would not erase it. Do not admit real pilot data under an assumed retention promise. Product/privacy owners must approve a concrete retention schedule, hold authority, cryptographic erasure/physical purge design, downstream/backups handling and an audit-preserving redaction strategy before claiming this gap closed. Raw frame capture stays OFF; no new research sink is introduced and A04 remains open.

No production/shared/customer deletion or policy execution was performed. Validation used a private local PostgreSQL17 cluster on55439. To clean the owned cluster, stop it with pg_ctl -D <this worktree>/product/.pg-rel stop; do not point cleanup at a shared database. The directory is untracked and must not be committed.

## Reliability operations

See reliability.md. Only opt-in local/test internal delivery may run. Inspect failures workspace-scoped; replay only FAILED records after diagnosing sink recovery. Replay is not a provider action and never changes Commercial State. Keep the immutable outbox/inbox evidence. Migration014 down drops delivery records; backup/drain/review is required outside disposable tests. Do not downgrade schema under running workers.

Validation: locked npm ci; typecheck; lint; architecture strict; export2policy+2HTTP-boundary+3PostgreSQL tests. PG covers scoped audit export, audit-failure refusal and oversize refusal. These are sandbox tests, not browser end-to-end or production deployment evidence.
