# Operator data health

The R4.12 operator projection is operational telemetry, never commercial evidence. It accepts server-derived stream facts and deliberately omits opaque cursor contents, lease tokens, credentials and raw provider payloads. The query defaults disabled until root explicitly composes it behind the existing synthetic source gate.

Admin and manager may read a workspace-bounded list of at most 100 streams. Only admin may request pause, resume or revoke; controls return an asynchronous acceptance and are not a claim that provider work stopped instantly. Every response reports `UNKNOWN` lag and completeness because no authorized external reconciliation exists. An active offline stream is `SYNTHETIC_ONLY`; a paused/revoked/blocked/degraded stream exposes that operational condition while retaining mode `offline-synthetic`. No fixture is shown as connected or authorized.

The projection distinguishes `SYNTHETIC_ONLY`, `AUTHORIZATION_PENDING`, `SYNCING`, `DEGRADED`, `BLOCKED`, `REVOKED` and `DISABLED`. Authentication, schema, gap, retry and database failures remain categorical. Reader/control failures return a bounded unavailable error and never include secret/provider text. Future provider-read-only states are placeholders for server-admitted facts, not a route to activate a live connection.

## Runbook

1. Inspect the stream and categorical failure code; the projection shows last attempt, last successful commit, checkpoint version, retry count/schedule and gap state. It deliberately never prints the raw cursor.
2. Pause before investigating a poison page. Preserve checkpoint/page-commit rows and immutable source receipt/evidence history. Do not manually advance a cursor past a failed page.
3. Correct provider authorization or schema in the approved adapter. Resume only after checkpoint and lease consistency has been checked. Revoke the provider token separately when an actual provider backend exists.
4. Request replay only through a future server-controlled authorized synthetic action. This slice exposes no arbitrary cursor/reset or raw payload replay endpoint.
5. Emergency stop: pause/revoke the stream, stop owned worker invocation, and verify the next request is refused. In-flight cancellation is not promised; durable commits remain auditable.
6. Restore: compare stream checkpoint version/completed flag and page commits against source receipts before replay. Never restore tokens into a lower-trust environment. R4.7–R4.9 Owner launcher and resources remain unchanged.
7. Credential rotation: provision a new approved backend reference, revoke the old version, then verify only new server-resolved principals are usable. Production vault custody remains unavailable; no token is entered into the health UI.
8. Synthetic cleanup: stop only the generated test cluster/workers, retain immutable artifacts under the approved retention policy, and do not delete Owner pilot data.

## Operator acceptance checklist

- Manager/admin can inspect only their own workspace; Sales/viewer/demo/anonymous are denied.
- Pause/resume/revoke are admin-only and server workspace is never taken from request JSON.
- Errors are categorical; output excludes credentials, raw payload, cursor text and lease tokens.
- `UNKNOWN` completeness/lag remain visible, including after offline page success.
- Empty and unavailable states support refresh; late responses do not render after unmount.
- Root must bind the new controller/query/reader and optional UI mount, then run integrated HTTP/browser/PG checks. This workstream does not self-claim that runtime composition is complete.

Gate C remains NOT READY FOR REAL CUSTOMER DATA. Provider status, external lag, full history and credential validity remain unverified until provider authorization and lifecycle/security acceptance exist.
