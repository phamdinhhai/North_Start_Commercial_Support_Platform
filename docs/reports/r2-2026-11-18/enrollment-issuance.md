# R2 — Authenticated enrollment issuance and signing-key rotation (D2)

Date: 2026-11-18 · Branch `work/r2-enrollment-issuance` (base `8673ca8`) · Scope: experimental research intake only (`AIL_RESEARCH_ENABLED` stays default OFF; local/test deployment only).

This is not production IAM and does not resolve PM-1. It reuses the existing `manager`/`admin` workspace authority from `ports/auth.ts`; no role, permission matrix or commercial mutation authority was added (`// OPEN: PM-1` at the seams). No canonical file and no migration was changed.

## What changed

| Area | Change |
|---|---|
| `application/integration/config.ts` (new) | Per-request env parsing: research flag, keyring, scope allowlist, deprecated issuer path. Every malformed/ambiguous setting → 503 `AIL_CONFIGURATION`. |
| `application/integration/token.ts` (new) | v2 token `b64url(header).b64url(claims).b64url(HMAC-SHA256)`; header `{alg:HS256,typ:AIL-ENROLLMENT,kid}`; MAC covers header + claims. Uniform 401 on any failure. |
| `application/integration/upload-validation.ts` (new) | `validateUpload` moved out unchanged (re-exported from `intake.ts`). |
| `application/integration/intake.ts` | `enrollAsPrincipal`, `revokeAsPrincipal`; legacy `enroll`/`revoke` disableable; `append` verifies via keyring. |
| `ports/integration.ts` | `EnrollmentActor`, `IssuanceAudit`, `RevocationRequest`; store `enroll(value, audit)`, `revoke(id, request)`. |
| `infra/integration/pg-integration.store.ts` | Actor audit rows in existing `audit_record` (same transaction); workspace-bound revocation. |
| `api/integration.controller.ts` | New routes `POST /v1/integration/enrollments` and `/enrollments/revoke`; principal resolved by `AUTH_CONTEXT_RESOLVER` from headers only; 8 KiB body limit on all routes. |
| `scripts/pilot-loop.module.ts` | One line: `exports: [AUTH_CONTEXT_RESOLVER]` so the integration controller uses the same resolver binding (composition only). |

## Issuance paths

**Principal (preferred).** `Authorization` credential → `AuthContextResolver.resolve({headers})`. Requirements: non-null context (else 401), not demo, role `manager` or `admin` (else 403). Workspace = `AuthContext.workspaceId`; the body may only contain optional selectors `connectionId`, `accountId`, `pageId`, which narrow the server allowlist entries for that workspace. Body `workspaceId` → 400 `WORKSPACE_FROM_CONTEXT`; any other key → 400; no match → 403 `SCOPE_NOT_ALLOWED`; >1 match → 400 `SCOPE_AMBIGUOUS`. Revocation via `/enrollments/revoke {enrollmentId}` is bound to the principal's workspace; another workspace's enrollment returns 404 (same as unknown).

**Shared issuer secret (DEPRECATED).** `x-integration-issuer` on `/enroll` and `/revoke` keeps working only while `AIL_ISSUER_SECRET` is set and `AIL_ISSUER_SECRET_ENABLED` is not `false`; otherwise both routes return 404 `ISSUER_PATH_DISABLED`. It issues only when exactly one scope is allowlisted. Its issuances are audited with actor `issuer-secret` and reason `deprecated issuer-secret path`. Plan: disable in every environment once principal issuance with a signed credential resolver (D1/OIDC) is available, then remove.

## Signing keyring

`AIL_SIGNING_KEYS` = JSON array of `{kid, secret, state}`; `state` ∈ `active` (exactly one; signs + verifies), `verify` (verifies until retired), `retired` (no secret; tokens with this kid → 401). Rules: kid `^[A-Za-z0-9._-]{1,64}$`, unique kids, ≤16 entries, secrets 32–4096 UTF-8 bytes, distinct from each other and from `AIL_ISSUER_SECRET`. Fallback: `AIL_SIGNING_SECRET` alone = kid `default` (setting both → 503). Keys are read from env per request; nothing is in Git and tests generate keys with `randomBytes`.

Rotation procedure: (1) add new key as `active`, demote old to `verify` — outstanding tokens (≤15 min) keep working; (2) after max TTL, set old to `retired` (or remove it → unknown kid, also 401). Retiring a kid is an immediate mass revocation of every token signed with it.

## Audit (no token material)

`integration_audit` keeps its existing `enroll`/`revoke`/`receipt` rows. Actor attribution is added to the existing append-only `audit_record` table (migration 001), `entity_type='integration-enrollment'`, `entity_id=<enrollment id>`, `workspace_id`, `actor` = principal user id (or `issuer-secret`), `event_type` `integration.enrollment.issued|revoked`, `new_value` = `{issuance, role, scope, kid, capability, expiresAt}` on issue and `{issuance, role}` on revoke. No token, signature, or secret is written; e2e asserts no token segment or key appears in audit rows. Lead history projection only reads ids of lead/handoff/outcome/work items, so these rows do not surface in lead timelines. **No migration was needed**, so `012` is unused.

## Replay-hardening review

- `claims.id` (enrollment UUID) is the jti. `append` re-checks under a row lock that the enrollment row exists, is not revoked, unexpired by DB clock, and that stored `scope` and `expires_at` equal the signed claims.
- `claims.kid` must equal header `kid` (both MAC-covered); swapping header kid to another known key fails MAC; unknown/retired kid fails before MAC.
- Claimed scope must still be on the current allowlist; removing a scope stops intake for it immediately.
- Replaying an identical upload yields a `duplicate` ACK bound to the same receipt; changed content → 409; sequence gaps/regressions → 409. Replay cannot create new data without the bearer token.
- Revocation remains immediate (row lock; next append → 401).

Residual risks: bearer token (no proof-of-possession/DPoP) — theft allows appends within one scope for ≤15 min until revoked; HMAC keys are symmetric and shared by all verifiers; kid is not persisted on the enrollment row (retirement relies on env); no per-principal/IP rate limiter (body limits only) — still a blocker for public deployment; env-based secrets (no vault/KMS); config is re-parsed per request (cheap but unchecked at boot); the e2e uses a stand-in signed-credential resolver because the current `AuthService` cannot yield manager/admin except via bootstrap.

## Environment variables introduced

`AIL_SIGNING_KEYS`, `AIL_SCOPE_ALLOWLIST`, `AIL_ISSUER_SECRET_ENABLED`. (`AIL_SIGNING_SECRET`, `AIL_ISSUER_SECRET` and `AIL_WORKSPACE_ID/CONNECTION_ID/ACCOUNT_ID/PAGE_ID` remain as fallbacks; `AIL_ISSUER_SECRET` is now optional. Combining `AIL_SCOPE_ALLOWLIST` with the single-scope variables → 503.)

## Verification (local, PostgreSQL 17 disposable DB `disposable_r2_enroll`)

| Command | Result |
|---|---|
| `npm run typecheck` | pass |
| `npm run lint` | pass |
| `npm run architecture:check:strict` | PASS (0 findings) |
| `npm test -- --exclude '**/*.integration.spec.ts'` | 39 files, 438 passed, 0 failed, 0 skipped |
| `TEST_DATABASE_URL=… npm run test:e2e` | 2 files, 16 passed (9 integration-upload incl. original 6 + 3 new; 7 health), 0 skipped |
| `TEST_DATABASE_URL=… npx vitest run src/infra/integration/receipts.integration.spec.ts` | 6 passed (5 existing + audit/scoped revoke), 0 skipped |

E2E coverage of the new path: unauthenticated 401; sales/viewer (real `AuthService` dev tokens) 403; manager of other workspace 403; unlisted page 403; body workspace 400; oversized body 413; same-workspace manager 201 → upload 201; audit row content; cross-workspace revoke 404; sales revoke 403; same-workspace admin revoke 201 → upload 401; kid rotation happy path; tampered kid; unknown kid; retired kid; removed kid; issuer path disabled (flag and unset secret) 404.

## Review requests

- **D1 (OIDC):** this code consumes only `AuthContextResolver.resolve({headers})` via `AUTH_CONTEXT_RESOLVER`, exported from `PilotLoopModule`. Please keep that token bound there (or export your resolver under it). Expectations: `workspaceId` server-derived and matching `^[a-zA-Z0-9:_./-]{1,256}$`; `userId` 1–256 chars without control characters (emails/subjects OK); `role` from existing `AuthRole`; `isDemo=false` for real principals. The `Authorization` header on `/integration/enrollments` is the app credential, while on `/integration/observations` it is the enrollment token — confirm your resolver never accepts an enrollment token (it is a 3-part `AIL-ENROLLMENT` HMAC token).
- **I (QA):** please re-run the e2e with your own DB and try: kid header manipulation (`alg` variations, duplicate JSON keys), cross-workspace selectors, allowlist edits mid-session, and verify no token material in logs/audit. Confirm the deprecation default (legacy path on while `AIL_ISSUER_SECRET` set) is acceptable or should flip to off.
