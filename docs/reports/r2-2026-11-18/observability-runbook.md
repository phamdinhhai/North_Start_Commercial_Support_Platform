# Observability and operational readiness runbook (R2)

Experimental, non-canonical; 2026-11-18. Covers the experimental AIL intake (`/v1/integration/*`, migration 008) and HTTP observability added in R2. Thresholds below are **proposals for discussion, not SLAs/SLOs**. Nothing here closes a Human Gate or resolves an OPEN decision (PM-1, CE-1, CE-2).

## 1. What exists

| Capability | Location | Notes |
|---|---|---|
| Correlation ID | `product/src/infra/observability/request-context.ts`, `http-observability.ts` | Inbound `x-request-id` accepted only if it is a single canonical UUID; otherwise a UUID is generated. Echoed on every response (including 404/413). Propagated with `AsyncLocalStorage` (Fastify `onRequest` + Nest interceptor re-entry after body parsing). |
| Structured JSON logs | `product/src/infra/observability/json-logger.ts`, `redaction.ts` | One JSON line per event: `level`, `ts`, `requestId`, `context`, plus allowlisted fields. Access line `event=http.request` with `method`, `route` (template, e.g. `/v1/pilot/leads/:leadId`, never raw URL/query), `status`, `durationMs`, and `workspaceId` only when the handler annotated a server-resolved workspace. `LOG_LEVEL` = `fatal|error|warn|log|debug|verbose|silent` (default `log`). |
| Counters | `product/src/infra/observability/http-metrics.ts` | Requests by method/route-template/status, auth failures (401/403), intake rejections (409/413/503 on enroll/revoke/observations). ≤256 series; overflow counted in `droppedSeries`. Emitted as `event=metrics.snapshot` every `OBS_METRICS_LOG_INTERVAL_MS` (default 60000; `0` disables). Cumulative since process start; reset on restart. |
| Connector health | `GET /v1/integration/health` (`product/src/api/connector-health.controller.ts`) | Manager/admin of the caller's own workspace only; sales/viewer/demo 403; unauthenticated 401; flag off 404 `AIL_DISABLED`; storage failure 503 `HEALTH_UNAVAILABLE`. `Cache-Control: no-store`. |

### Redaction policy (allowlist)

Only keys listed in `ALLOWED_FIELDS` (`redaction.ts`) with validated values reach a log line. Headers, cookies, tokens, request/response bodies, query strings, e-mail, phone and any other key are dropped without inspection. Free-text messages survive only from reviewed contexts (`TRUSTED_MESSAGE_CONTEXTS`: Nest bootstrap/routing, `Bootstrap`, `AuthService`, `PostgresService`); all other text is replaced by `[REDACTED]` + `msgBytes`. `Error` objects log only `errorName` and stack frames (the message line is dropped). Adding a trusted context or allowlisted field requires a privacy review.

### Telemetry is not evidence

Logs, counters and the health read model are operational telemetry. They are never written to commercial tables, never used as Evidence/CommercialEvent input (I-04, I-12), and the health response is labelled `classification: OPERATIONAL_TELEMETRY_NOT_COMMERCIAL_EVIDENCE`.

## 2. Reading `GET /v1/integration/health`

Per enrollment, three independent dimensions — there is deliberately **no single "healthy" field**:

| Field | Meaning | Does not mean |
|---|---|---|
| `transport.state` = `active` / `revoked` / `expired` | Server enrollment authority (database clock) | That a companion is connected or capturing |
| `delivery.*` | Receipt count, last receipt time, checkpoint, `checkpointAdvancedAt`, `checkpointAgeSeconds` (since last advance, or since enrollment if never advanced), last audit operation | That every provider event was delivered |
| `delivery.rejectedConflicts` | Always `{count: null, reason: NOT_PERSISTED}` — 409s roll back and are not stored per enrollment | Zero conflicts |
| `completeness` | Always `UNKNOWN` (`NO_RECONCILIATION`) | Anything else; only a future reconciliation mechanism may change it |

Enrollments expire after 15 minutes, so `expired` is the normal steady state for finished sessions. At most 100 enrollments are returned (`truncated: true` when more exist).

Example: `curl -s -H "x-request-id: $(uuidgen)" -H "x-bootstrap-token: $BOOTSTRAP_TOKEN" http://localhost:3000/v1/integration/health` (bootstrap admin sees only enrollments whose scope workspace is `bootstrap`; see limitations).

## 3. Proposed alert thresholds (proposals, not SLAs)

| Signal | Source | Proposed warn | Proposed page | Rationale |
|---|---|---|---|---|
| Intake 503 | `metrics.snapshot.intakeRejections["POST /v1/integration/observations 503"]` delta | ≥3 in 5 min | ≥10 in 5 min or any for 15 min | 503 = DB/config unavailable; companion retains and retries |
| Intake 409 | `... 409` delta | ≥1 in 15 min | ≥5 in 15 min | Gap/conflict/regression blocks the companion until manual action |
| Intake 413 | `... 413` delta | ≥1 in 1 h | — | Client bug or abuse; 8 KiB parser limit |
| Auth failures | `authFailures` delta | ≥10 in 5 min per route | ≥50 in 5 min | Token expiry storms, misconfiguration or probing |
| Checkpoint age (active enrollment) | `delivery.checkpointAgeSeconds` where `transport.state=active` | > 300 s | > 600 s | Within a 15-minute grant, no progress for 5–10 min suggests a stalled outbox. Not proof of loss. |
| Series overflow | `droppedSeries` > 0 | any | — | Unexpected route cardinality |

Counters are cumulative per process: alert on deltas between consecutive snapshots and treat a decrease as a restart.

## 4. Incident procedures

All steps: capture the `requestId` from the response header and search logs by it. Never paste tokens, issuer secrets or observation contents into tickets.

### 4.1 Intake 503 spike
1. Check `GET /health/readiness` (database, migrations). Check `code` in the 503 body: `INTAKE_UNAVAILABLE` (storage), `RESEARCH_ONLY` (wrong `DEPLOYMENT_MODE`/`NODE_ENV`), `AIL_CONFIGURATION` (secrets/scope).
2. Storage: look for `PostgresService` error lines (`errorName` only). Restore DB connectivity; do not restart in a loop.
3. Companions retain the same pending request and retry; do **not** synthesize ACKs or edit checkpoints by SQL.
4. After recovery, confirm `checkpointAdvancedAt` moves for active enrollments. Completeness remains UNKNOWN.

### 4.2 Gap / 409
1. Identify route and timing from `http.request` lines (`status=409`). The response `code` (`SEQUENCE_GAP`, `CHECKPOINT_REGRESSION`, `RECEIPT_CONFLICT`) is visible to the client, not in server counters per enrollment.
2. Read `/v1/integration/health`: the checkpoint did not advance. Do not edit `integration_enrollment.checkpoint`.
3. Follow `docs/reports/unified-execution-2026-11-16/adaptive-integration.md` § "Meaning and recovery": retain evidence, investigate order/identity, resolve manually (re-enroll after export decision). Record any unrecoverable gap as UNKNOWN.

### 4.3 Revoked or expired enrollment
1. `transport.state` shows `revoked` (with `revokedAt`) or `expired`. Intake returns 401 `ENROLLMENT_INACTIVE`/`UNAUTHORIZED`; spikes appear in `authFailures`.
2. If revocation was intentional: confirm the companion stopped (401 removes local authority). If not intentional: treat as a security event, check `integration_audit` (`operation=revoke`) timing and replace the issuer/signing secrets out of band (no automated rotation exists; see `data-security.md` for the variables).
3. Re-enroll only through the issuer procedure; never reuse another tenant's grant.

### 4.4 Checkpoint age alert
1. Confirm `transport.state=active`. If expired/revoked, follow 4.3.
2. Correlate with 409/503 counters. No errors and no receipts usually means no capture (browser closed/unsupported) — operational, not data loss proof.

## 5. Backup / restore

Use `product/scripts/restore-rehearsal.mjs` (explicit local `/north_start_ci` target; creates and drops its own disposable databases; compares table digests incl. `integration_*`) and `product/scripts/backup-verify.mjs`. These prove bounded logical restoration of synthetic data only — not PITR, production DR or an agreed RPO/RTO. Disable AIL (`AIL_RESEARCH_ENABLED` unset) before any rollback of migration 008.

## 6. Known limitations

- Only the bootstrap admin can reach manager/admin today (unsigned dev tokens cannot carry privileged roles; OPEN PM-1). Enrollment scope workspace is `AIL_WORKSPACE_ID`; a bootstrap admin sees enrollments only if that equals `bootstrap`.
- No metrics HTTP endpoint and no exporter. Counters are per process, in memory, lost on restart.
- OpenTelemetry JS (Apache-2.0; `@opentelemetry/api` 1.x stable, SDK/auto-instrumentation many packages) was evaluated and **not adopted**: no collector/backend or data-residency decision exists (OPEN in `reusable-assets.md` §5), auto-instrumentation would record raw URLs/headers unless separately constrained, and the in-process allowlisted logger covers the current need with zero new dependencies. Revisit when a backend is chosen; reuse `redaction.ts` as the attribute allowlist before any exporter.
- 409 counts are process-wide only; not attributable per enrollment/tenant without a schema change (out of scope: no migrations).
- `scope->>'workspaceId'` is not indexed; acceptable at experimental volume.
- Access logs for routes that do not annotate a workspace omit `workspaceId` by design.

## 7. Review fixes

### R2-I-05 (MINOR, defence in depth): multi-line error messages smuggled into `stack`

Finding: the frame filter accepted any later line shaped like `    at <...>` (character class admitted `@ . -`), so `new Error('x\n    at alice@example.com')` leaked an e-mail via `stack`, both for `Error` objects and for the Nest `ExceptionsHandler` shape `(message, stack, context)`.

Fix (`product/src/infra/observability/redaction.ts`, `json-logger.ts`):
- `stackFrames(stack, message)` locates the message in the stack **by position and length** and parses frames only from the text after it. If the message cannot be located, no frames are emitted (fail closed). An empty message skips only the header line.
- `STACK_FRAME` now requires the strict V8 shape `at [async] [new] fn [as alias] (path:line[:col] | native | <anonymous> | index N)` or `at [async] path:line[:col]`. `@` is allowed in a path only directly after a separator (npm scopes such as `node_modules/@nestjs`).
- Additional per-frame deny filter: address-like `x@y.z`, JWT headers (`eyJ...`), opaque runs of 32+ token characters, 7+ digit (phone-like) runs, and `bearer`.
- `json-logger.ts` passes the message (Error `.message`, or the first argument in the Nest string shape) into `stackFrames`.
- Tests: `json-logger.r2-review.spec.ts` QA reproductions flipped from `it.fails` to `it`, plus negative cases (phone, spaced phone, e-mail in path, Bearer token, JWT in path, header text), fail-closed when the message is not in the stack, and positive cases preserving real V8 frames (npm scopes, `node:internal`, `async`, `index N`, Windows and `file://` paths).

Trade-off: genuine frames whose paths contain spaces, very long hashed segments or long digit runs are dropped. Losing diagnostic detail is preferred to leaking PII.

### Startup configuration errors (trade-off reconfirmed)

Startup configuration errors that Nest logs under `ExceptionHandler`, such as a missing `PILOT_STORE_MODE`, still show `msg: "[REDACTED]"` with `errorName` and the stack frames. The first frame, such as `at resolvePilotStoreMode (...postgres.service.js:62:11)`, identifies the failing check. This was re-verified with `node dist/main` on the fix branch. We keep the trade-off because Nest's exception handler also logs arbitrary runtime exception messages, which may contain PII. Operators should diagnose from the frame and the documented environment variables. Do not add `ExceptionHandler`/`ExceptionsHandler` to `TRUSTED_MESSAGE_CONTEXTS`.
