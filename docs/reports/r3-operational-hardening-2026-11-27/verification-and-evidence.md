# Verification commands and evidence requirements

**Candidate under audit:** `6e98238de1f81b3ee87f2b37eb84cbcf15835171`. Run commands from a clean checkout of `6e98238` (working directory `product/` unless noted). Never point `TEST_DATABASE_URL` or backup helpers at a shared or production database; `DATABASE_URL` must be unset during test/rehearsal gates.

## 1. Implementation & integration gate commands (existing in `6e98238`)

```bash
# Baseline static, architecture, registry and dependency gates (Gate I)
cd product
npm ci
npm run typecheck
npm run lint
npm run architecture:check:strict
npm run test:architecture
npm run registry:validate
npm run test:security-audit && npm run security:audit

# Focused unit suites: A-02, A-03, A-04, auth/OIDC, observability/redaction, backup helper (Gate I)
npx vitest run \
  src/application/governed-action/governed-action.adr009.spec.ts \
  src/infra/crypto/configured-content-digester.spec.ts \
  src/infra/crypto/r47-privacy-adversarial.spec.ts \
  src/infra/governed-action/assertion-delivery.failure.spec.ts \
  src/infra/governed-action/assertion-delivery.ops.spec.ts \
  src/infra/governed-action/assertion-delivery.runner.spec.ts \
  src/infra/research-capture/research-receipt.store.spec.ts \
  src/infra/auth \
  src/infra/observability \
  src/api/assertion-delivery.controller.spec.ts
npm run test:ail:research
npm run test:backup

# Disposable PostgreSQL integration suites for A-02, A-03, A-04 & IAM (Gate X — isolated loopback DB only)
CI=true TEST_DATABASE_URL="postgresql://north_ci:north_ci_only@127.0.0.1:55432/north_start_ci" \
  npm run test:integration:ci

# Build & synthetic logical backup/restore rehearsal (Gate X — creates/drops disposable_restore_* DBs)
npm run build
TEST_DATABASE_URL="postgresql://north_ci:north_ci_only@127.0.0.1:55432/north_start_ci" \
  node scripts/restore-rehearsal.mjs

# Explicit disposable backup/verify/restore CLI check (Gate X)
BACKUP_VERIFY_ACK=I_CREATED_THIS_DISPOSABLE_DATABASE \
  node scripts/backup-verify.mjs backup \
  --target "postgresql://north_ci:north_ci_only@127.0.0.1:55432/disposable_src" \
  --output /tmp/disposable.dump --execute --json
node scripts/backup-verify.mjs verify --backup /tmp/disposable.dump --execute --json
BACKUP_VERIFY_ACK=I_CREATED_THIS_DISPOSABLE_DATABASE \
  node scripts/backup-verify.mjs restore-verify \
  --backup /tmp/disposable.dump \
  --restore-target "postgresql://north_ci:north_ci_only@127.0.0.1:55432/disposable_dst" \
  --execute --json
```

## 2. Evidence matrix across gate tiers

| Area | Gate I / X evidence (automated in `6e98238`) | Gate O evidence (operational drill in isolated staging) | Gate P evidence (production sign-off artifact) |
|---|---|---|---|
| **A-02 + KMS/HSM & key lifecycle** | JSON Vitest report for `governed-action.adr009.spec.ts`, `configured-content-digester.spec.ts`, `content-digest.integration.spec.ts` (0 skips). | KMS audit log + app log showing live `kid` rotation, old-`kid` verification pass, retired-`kid` removal returning `UNKNOWN` (`UNKNOWN_KEY_OBSERVED`), zero digest rewrites, separate digest vs encryption key ARNs/IDs. | Signed OAR-01..OAR-04 record; IAM policy diff proving key-admin ≠ decrypt/sign ≠ DB admin; break-glass custody receipt. |
| **A-03 durable assertion delivery** | `assertion-delivery.{failure,ops,runner,integration}.spec.ts` + private PG restart check (`REL_PRIVATE_PG_DATA` on isolated cluster only). | Captured `GET /v1/internal/assertion-delivery` before/after simulated sink outage, single `POST .../replay` recovery, `assertion_delivery_audit` row, and `ENVELOPE_CONFLICT` poison refusal + alert screenshot. | Named on-call (OAR-07), paging rule test, confirmed `PRODUCTION_CAPABILITY_CATALOG` empty or per-capability ADR-007 sign-off. |
| **A-04 research encryption & purge** | `research-receipt.{store,integration}.spec.ts` proving AES-256-GCM + AAD, 1–7d cap, duplicate non-extension, `PURGED` trigger, `SKIP LOCKED` concurrency. | Fault-injected audit/DB failure recording `research_capture_failure`, `EXPIRED_READ_DENIED` verification during outage, subsequent runner drain (`remainingExpiredCount: 0`, `resolved_at` set), alert firing + clear timestamps. | Research capture stays `RESEARCH_CAPTURE_STORAGE_ENABLED=false` in prod unless OAR-05 + ADR-009/007 authorization exists with 7-day hard cap. |
| **Backup, restore & replica limits** | `restore-rehearsal.mjs` PASS JSON (`archiveSha256`, 16-table HMAC match, idempotent post-restore replay) + `test:backup`. | Quarantined restore drill including `024_research_capture_receipts`: prove restored expired ciphertexts are purged (`PURGED` audit written) before read access opens; document replica lag + backup/WAL retention window vs KMS key destruction. | Approved RPO/RTO, PITR & encrypted backup policy (OAR-06), scheduled quarterly restore calendar and KMS crypto-erasure mapping. |
| **Auth rollout & rate limiting** | `src/infra/auth/**` suites (`jwks-staleness.spec.ts`, `browser-session.*.spec.ts`, `oidc-*.spec.ts`), `playwright.oidc.config.ts`. | Staging OIDC login/callback/CSRF/logout trace, revoked-membership next-request `403`, forced stale-JWKS fail-closed test, multi-instance session check, and load-generator run showing `429` + `Retry-After` without cross-tenant starvation. | Live IdP config review, multi-replica session store sign-off (OAR-09), WAF/distributed limiter config + abuse test report (OAR-10). |
| **Monitoring, redaction & IR** | `json-logger.r2-review.spec.ts`, `http-observability.spec.ts` proving allowlist redaction and stack-frame PII stripping. | End-to-end synthetic alert firing into paging channel (readiness `503`, unresolved purge/outbox failure, `CIPHERTEXT_AUTH_FAILED`, `401/403/429` spike) with zero raw payload/token/PII in log sink. | Completed tabletop/live drill records (OAR-07, OAR-08, OAR-11) with MTTR timestamps, preserved audit bundle and rollback verification. |

## 3. Non-negotiable evidence rules

1. Every artifact bundle must record exact Git SHA, UTC timestamp, environment tier (`test` / `staging` / `prod`), runner identity, command exit codes and `0` skipped tests on gated suites.
2. Never include raw secrets, KMS key material, bearer/cookie tokens, or real customer payloads in evidence artifacts.
3. Passing Gate I/X commands on `6e98238` proves synthetic implementation/integration readiness only; Gate O and Gate P remain **UNVERIFIED / BLOCKED** until external infrastructure and Owner sign-offs exist.
