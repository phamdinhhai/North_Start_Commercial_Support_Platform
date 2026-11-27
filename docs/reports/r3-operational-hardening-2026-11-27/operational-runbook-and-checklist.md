# R3 operational runbook and checklist

**Status:** pre-production operational planning for candidate `6e98238`. **Mandatory posture:** keep `ASSERTION_DELIVERY_ENABLED`, `RESEARCH_CAPTURE_STORAGE_ENABLED`, `AIL_RESEARCH_ENABLED`, `SOURCE_INTEGRATION_SYNTHETIC_ENABLED`, `DEMO_WORKSPACES` and `AUTH_DEV_UNSIGNED_TOKENS` disabled unless an explicit local/test synthetic exercise requires one. Never run synthetic helpers against non-disposable databases.

## 1. Key custody, rotation and retirement

- **Custody boundary:** separate digest keys (`CONTENT_DIGEST_KEYS_JSON` replacement) and research encryption keys (`RESEARCH_CAPTURE_ENCRYPTION_KEYS_JSON` replacement) in external KMS/HSM. Never reuse secret bytes or `kid` across purposes or workspaces.
- **Rotation drill (synthetic/staging first):**
  1. Confirm new key version/alias exists in KMS and app roles have verify/decrypt on retiring `kid` plus sign/encrypt on active `kid`.
  2. Roll configuration with `{activeKid: <new>, keys: [<retired>, <new>]}`; verify startup fails closed if malformed.
  3. Write one synthetic digest/receipt; confirm new record carries `<new>` `kid` and pre-rotation record still verifies/decrypts under `<retired>`.
  4. Confirm no backfill rewrites historical digests or ciphertexts.
- **Historical-key availability & retirement:** keep retired digest keys for the full audit/verification horizon; keep retired research-encryption keys at least until `max(expires_at)` + backup retention + incident hold window has passed and zero unpurged rows reference that `kid`.
- **Missing-key drill:** remove a retired synthetic `kid` in an isolated test; confirm reads/verifications return `UNKNOWN` (`UNKNOWN_KEY_OBSERVED`), never `false` or fabricated match, and alert fires.

## 2. Research receipt purge and failure recovery (A-04)

- **Normal operation:** `ResearchReceiptPurgeRunner` drains expired rows in bounded `FOR UPDATE SKIP LOCKED` batches; DB trigger requires a same-transaction `PURGED` row in `research_capture_audit` and refuses unexpired delete, update or truncate.
- **Triage `RESEARCH_CAPTURE_PURGE_FAILED`:**
  1. Check `/health/readiness` and DB connectivity/permissions on `research_capture_receipt`, `research_capture_audit`, `audit_record` and `research_capture_failure`.
  2. Inspect unresolved rows via `inspectFailures(workspaceId)` or `SELECT workspace_id, failure_key, stage, error_code, attempts, first_failed_at, last_failed_at FROM research_capture_failure WHERE resolved_at IS NULL;`.
  3. Confirm expired rows remain unreadable (`EXPIRED_READ_DENIED`); do not bypass triggers or run manual `DELETE` without audit.
  4. Fix underlying DB/audit outage, run bounded `purgeExpired` batches until `remainingExpiredCount = 0`, and verify `resolved_at IS NOT NULL`.

## 3. Durable assertion delivery operations (A-03)

- **Normal operation:** `PgActionStore.transition` writes `assertion_outbox` atomically with the verified action event; `PgAssertionDelivery` leases rows and writes idempotently to `PgAssertionInbox` without `ActionExecutor`.
- **Triage `ASSERTION_DELIVERY_UNAVAILABLE` or stuck `FAILED`:**
  1. Authenticated OIDC admin calls `GET /v1/internal/assertion-delivery` (metadata only; never paste envelopes into tickets).
  2. If `lastError` is `SINK_FAILED`, `SINK_TIMEOUT` or `LEASE_EXPIRED`: restore DB/sink health, confirm inbox idempotency, call `POST /v1/internal/assertion-delivery/:id/replay` once, and re-inspect.
  3. If `lastError` is `INVALID_ENVELOPE` or `ENVELOPE_CONFLICT`: treat as poison; do **not** edit outbox/inbox rows—open engineering incident.
  4. Emergency pause: set `ASSERTION_DELIVERY_ENABLED=false` and roll instances; active leases expire safely.

## 4. Backup, restore, replica and retention limits

- **Current boundary:** logical dump/restore scripts prove synthetic schema/replay fidelity on loopback `disposable_*` / `backup_verify_*` databases only.
- **Replica & backup limitation:** PostgreSQL WAL, physical snapshots, read replicas and logical dumps retain expired `research_capture_receipt` ciphertexts until BOTH (a) primary purge commits AND (b) every backup/WAL/snapshot older than that purge expires, OR the workspace encryption key is cryptographically destroyed in KMS/HSM.
- **Restore quarantine procedure:**
  1. Restore into an isolated network-quarantined database with outbound/worker flags off.
  2. Verify migration version (`001`–`024`) and run `purgeExpired` until `remainingExpiredCount = 0` **before** opening read traffic.
  3. Reconcile `assertion_outbox` (`PENDING`/`LEASED`) and `sync_stream` leases before enabling workers.

## 5. Authentication rollout and rate limiting

- **Auth rollout:** pre-seed `platform_user`, `external_identity` and `memberships` (`admin` first); deploy with `AUTH_MODE=oidc`, `DEMO_WORKSPACES=false`, `AUTH_DEV_UNSIGNED_TOKENS=false`, HTTPS `OIDC_ISSUER`/`OIDC_JWKS_URI`, `OIDC_JWKS_MAX_STALE_SECONDS` set to approved outage bound, and shared session backing before >1 replica.
- **Auth rollback / emergency deny:** revoke compromised membership (effective next request); for IdP key compromise, rotate JWKS + restart/flush key store or lower stale window; never re-enable unsigned/bootstrap tokens in pilot/production.
- **Rate limiting:** enforce ingress IP/TLS rate limits plus app-level per-principal and per-workspace budgets (`429` + `Retry-After`) on `/v1/auth/*`, `/v1/integration/*`, `/v1/hybrid/*`, `/v1/pilot/*` and `/v1/internal/*`; keep `8192` byte body caps on intake routes.

## 6. Monitoring, alerting and incident response

- **Core alerts (page / warn):** readiness `503` (>1 min page); `research_capture_failure` unresolved >0 or expired unpurged age >15 min (page); `CIPHERTEXT_AUTH_FAILED` / `ENVELOPE_CONFLICT` >0 (immediate security page); `assertion_outbox` `FAILED` >0 or `PENDING` age >5 min (warn/page); `UNKNOWN_KEY_OBSERVED` spike (warn/page); `authFailures` / `429` / `droppedSeries > 0` anomalies.
- **Incident loop:**
  1. **Contain:** engage workspace/capability kill switch, disable optional runners, or revoke compromised membership/enrollment; preserve correlation `requestId` (never log tokens/PII).
  2. **Preserve:** snapshot audit/failure metadata (`audit_record`, `research_capture_audit`, `research_capture_failure`, `assertion_delivery_audit`) under access control.
  3. **Recover:** restore KMS/DB/IdP health, drain purge/outbox queues, verify zero unresolved failures and run post-incident review before re-enablement.

## Pre-enablement checklist

- [ ] KMS/HSM keys provisioned separately for digest and encryption; env JSON secrets absent.
- [ ] Rotation, missing-retired-key (`UNKNOWN`), purge-failure recovery and quarantined-restore drills passed with archived evidence.
- [ ] OIDC live issuer, membership bootstrap, multi-instance session plan and rate limits verified under load.
- [ ] Dashboards, paging alerts and named on-call/incident owners active; default-disabled flags confirmed.
