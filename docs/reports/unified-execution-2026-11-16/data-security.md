# D: Experimental integration intake and data security

Implementation commits: `55abd7828e4a18b0a48ed39cad847759c1141d96`, `608685d4569303b81ba6b71c05e904570c3c424b` on `work/unified-d`. No push or main merge.

## Delivered

- Server-fixed workspace/connection/account/page scope, Pancake conversations surface, signed capability `observation:append`, fifteen-minute expiry, issuer-only enrollment/revocation. Distinct issuer/signing secrets require at least 32 UTF-8 bytes. No tokens or raw payloads logged.
- Disabled unless `AIL_RESEARCH_ENABLED=true`, explicit `DEPLOYMENT_MODE=local|test`, and `NODE_ENV` is not `production`. Required settings: `AIL_ISSUER_SECRET`, `AIL_SIGNING_SECRET`, `AIL_WORKSPACE_ID`, `AIL_CONNECTION_ID`, `AIL_ACCOUNT_ID`, `AIL_PAGE_ID`; database configured separately using existing PostgreSQL settings.
- Exact metadata field allowlist, no payload/cookie/body fields, positive safe integer sequence and server scope/page binding. Each integration route caps request body at 8192 bytes.
- PostgreSQL migration 008 isolates enrollment/immutable receipt/audit records from canonical commercial tables. Receipt and checkpoint share a transaction; enrollment row locking serializes duplicates, sequence progression, revocation and post-lock expiration checks. Full canonicalized metadata fingerprint defines identical retries. ACK resolves after transaction commit. Continuity is always `UNKNOWN`.
- POST `/v1/integration/enroll` uses `x-integration-issuer` plus `{}`; observations use signed Bearer and `{captureId,sequence,pageId,observation}`; revocation uses issuer and `{enrollmentId}`. Companion E received the exact interface.

## Files

`product/migrations/008_integration_receipts.{up,down}.sql`; `product/src/ports/integration.ts`; `product/src/application/integration/intake{,.spec}.ts`; `product/src/infra/integration/{pg-integration.store.ts,receipts.integration.spec.ts}`; `product/src/api/integration.controller{,.spec}.ts`; `product/src/app.module.ts`; `product/scripts/ci-integration.mjs`; migration lifecycle expectations derive latest migration versions.

## Validation

On 2026-11-17: `npm run typecheck`, targeted Vitest across intake/controller/receipts (17 passed, zero skipped), and `npm run build` passed. PostgreSQL 17 was a disposable native local instance at 127.0.0.1:55439, dedicated synthetic database `disposable_d_intake`, supplied by root. Tests cover cross-scope/page, production/flag/config refusal, expiry, malformed/tampered token, strict fields, duplicate concurrency, pool restart/retry, changed content conflict, checkpoint regression, revocation race, expired enrollment, and injected pre-commit failure rolling back receipt/checkpoint. Service test rejects ACK when store rejects commit. Actual PostgreSQL COMMIT transport-loss fault injection is not covered.

Root read-only crossreview found transaction scoping sound and requested formatting/body caps; both applied. Root owns final integrated gate execution.

## Limits and gates

This is a research capability, not production IAM or a decision on PM-1. No canonical mutation, CRM mapping, commercial state transition or gate closure. A hash is not raw evidence, and stored metadata does not establish provider authenticity, complete source continuity, replay of full raw payload, or production readiness. There is no per-issuer/IP rate limiter; research-only operation and lack of rate limiting remain blockers to public/production deployment. IDs are validated metadata, not a promise to detect arbitrary sensitive text disguised as an ID. Revocation audit is append-only; enrollment revocation/checkpoint are controlled mutable indexes. Migration down destroys experimental records and needs evidence export for any retained dataset.
