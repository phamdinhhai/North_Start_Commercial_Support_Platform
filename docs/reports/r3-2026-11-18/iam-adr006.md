# R3-D — ADR-006 implementation: internal principals, membership lifecycle, admin API, enrollment and issuer-secret gating

Date: 2026-11-18 · Branch `work/r3-iam` (base `7b47e9d`) · Code commit `c6212be`
Spec: `docs/implementation-plan/decisions/ADR-006-pm1-capability-matrix.md` (accepted 2026-11-18). I-09 is unchanged. No canonical file was edited. No role was added.

## Summary per item

| # | ADR-006 item | Implementation | Tests (failing-first) |
|---|---|---|---|
| 1 | Internal principals (R2-P-07) | Migration 010 adds `platform_user(id UUID, created_at, status active/disabled)` and `external_identity(issuer, subject, user_id → platform_user, created_at, UNIQUE(issuer, subject))`. Memberships reference `user_id`; `issuer`/`subject` live only in `external_identity`.<br>`OidcAuthenticator` resolves verified `(iss, sub)` → internal UUID through `MembershipReader.resolveUserId` (`src/infra/auth/oidc-authenticator.ts:59-60`).<br>Unknown identity or disabled user → `unknown_identity` → 401. Logins never provision.<br>`AuthContext.userId` = internal UUID. The interim `oidc:<hash>:<sub>` form (`oidcUserId`) is removed. | `oidc-authenticator.spec.ts`:<br>• "valid token + active membership → … userId = internal platform user id"<br>• "ADR-006: unknown (issuer, subject) → unauthenticated even with a workspace header; no auto-provisioning"<br>• "ADR-006: a disabled platform user is unauthenticated…"<br>• "ADR-006: the same sub at two issuers maps to two internal users; the interim oidc:<hash>:<sub> form is gone"<br>• "defensive: a reader returning a non-UUID user id yields no context" |
| 1b | Safe provisioning path | The only way to create a user + identity link is an **admin grant** (`MembershipAdministration.grant`; PG `provision()` at `src/infra/membership/pg-membership.store.ts:169`). An existing link is reused, so adding a workspace never creates a second user. Identity links are immutable. Grants are restricted to the configured OIDC issuer (`ISSUER_NOT_ACCEPTED`).<br>First admin: operator seed (see "Operator procedure" below). | `membership.controller.spec.ts` "admin grant pre-provisions an identity that can then log in…" (401 before the grant, 200 after) |
| 2 | Membership lifecycle (R2-P-06) | Partial unique index `memberships_active_unique (workspace_id, user_id) WHERE status='active'` (`migrations/010…up.sql:49`).<br>Revoke is terminal (`active → revoked` only; identity/role/created_at immutable).<br>Re-grant inserts a new row.<br>Role change = revoke + insert in one transaction (`PgMembershipStore.changeRole`, `pg-membership.store.ts:131`).<br>DELETE/TRUNCATE are refused on `memberships`, `platform_user` and `external_identity`; UPDATE of `external_identity` is refused.<br>`membership_audit` columns: `actor`, `actor_user_id → platform_user` and `transaction_id` (pairs the revoke + grant of a role change).<br>Actor = the acting admin's UUID, set through `set_config('north.membership_actor', $1, true)` inside the mutation transaction (`pg-membership.store.ts:194-196`). A non-UUID or unknown actor fails the whole change (22P02 / 23503).<br>Operator/seed path without the setting → `db:<session_user>`. | `pg-membership.store.integration.spec.ts` (8 tests):<br>• "enforces partial-unique active membership, identity uniqueness…"<br>• "revoke is terminal and immutable; re-grant creates a NEW row for the same user"<br>• "DELETE/TRUNCATE are refused on memberships, platform_user and external_identity; identity links are immutable"<br>• "ADR-006 audit: actor = acting admin internal id via transaction-local setting; seed path = db role; append-only"<br>• "role change = revoke + grant in ONE transaction (shared transaction id); a failure rolls both back"<br>• down/up round-trip |
| 3 | Admin membership API | `src/api/membership.controller.ts` with service `src/application/membership/membership-admin.ts`. Routes:<br>• `POST /v1/workspace/memberships` {issuer, subject, baseRole} → 201<br>• `POST /v1/workspace/memberships/:id/revoke` (empty body) → 200<br>• `POST /v1/workspace/memberships/:id/role` {baseRole} → 200 `{revoked, granted}`<br>• `GET /v1/workspace/memberships[?status=active\|revoked]` → rows with `identities`, newest first, max 500<br>Rules:<br>• Admin of the server-resolved workspace only (`admin()` at `membership-admin.ts:115`).<br>• Manager/sales/viewer/demo → 403. No context → 401. A non-UUID admin (legacy `bootstrap-admin`) → 403 `INTERNAL_PRINCIPAL_REQUIRED`.<br>• Body `workspaceId` → 400 `WORKSPACE_FROM_CONTEXT`. Foreign/unknown id → 404. Already revoked → 409 `MEMBERSHIP_NOT_ACTIVE`. Active duplicate → 409 `MEMBERSHIP_EXISTS`. Same role → 409 `ROLE_UNCHANGED`. Own membership → 409 `SELF_MEMBERSHIP_CHANGE`.<br>• 8 KiB body limit, the same as the integration routes.<br>• Legacy `AUTH_MODE` → 404 `MEMBERSHIP_API_DISABLED`: there is no internal principal to audit. | `membership-admin.spec.ts` (6)<br>`membership.controller.spec.ts` (5, real `AppModule`)<br>PostgreSQL e2e: "admin membership API grants, changes role and revokes; membership_audit actor = acting admin internal id" |
| 4 | Enrollment admin-only | `IntegrationIntake.principal()` requires `role === 'admin'` (`src/application/integration/intake.ts:36-39`). Manager → 403 for issue and revoke. Connector-health read is still manager + admin; verified in `application/observability/connector-health.ts:15,71` and existing `connector-health.controller.spec.ts:160-169`, not changed. | `intake.principal.spec.ts` "ADR-006: denies unauthenticated, manager, sales, viewer and demo principals before persistence"<br>`oidc-enrollment-http.spec.ts` (both cases)<br>e2e: manager 403 in both suites |
| 5 | Issuer-secret path (R2-P-08) | New `issuerSecretPathAllowed(env)` (`src/application/integration/config.ts:91`). It returns true only when all three hold: `DEPLOYMENT_MODE` ∈ {local, test}, `NODE_ENV` ≠ production, and `AIL_ISSUER_SECRET_ENABLED === 'true'`.<br>It is checked in `loadConfig` independently of the research gate (`config.ts:108`): opting in outside local/test → 503 `RESEARCH_ONLY`. Not opted in → 404 `ISSUER_PATH_DISABLED`, as before. | `intake.principal.spec.ts` describe "ADR-006 R2-P-08 — issuer-secret enrollment only in local/test…" (3 tests). The pilot/production case already passed before the change, because the research gate rejects those modes; the gate test failed first. |
| 6 | Markers | All `// OPEN: PM-1` markers in owned files now read `// ADR-006`, with the decided row: auth, OIDC config/verifier/module/authenticator, membership stores, `ports/auth.ts`, integration config/intake/controller, RBAC. | — |
| 7 | CI registration | No new `*.integration.spec.ts` file was added; `pg-membership.store.integration.spec.ts` was rewritten in place and is already in `requiredSuites`. | gate: 12 suites |

Additional ADR-006 consequence implemented: **access token TTL ≤ 15 min**.
- `OidcTokenVerifier` rejects a token with reason `lifetime` when either holds:
  - `exp − iat > 900`;
  - `exp − now > 900 + skew`, which catches tokens without `iat` or with a future `iat`.
- Code: `src/infra/auth/oidc-token-verifier.ts:16,64-66`.
- Test: "ADR-006: access token lifetime ≤ 15 minutes…".

RBAC (`src/infra/rbac/rbac.service.ts`): only the comment changed, and it now states the ADR-006 rows. There is no behaviour change. The new spec cases assert the manager workspace scope (LVP), the sales/viewer I-09 scope, and export/delete as admin-only.

## Migration 010 changes (unreleased, edited in place)

- **New tables:**
  - `platform_user`;
  - `external_identity`, with `idx_external_identity_user`.
- **`memberships`:**
  - `issuer`/`subject` replaced by `user_id`;
  - `UNIQUE(issuer, subject, workspace_id)` replaced by the partial unique `memberships_active_unique`;
  - added indexes `idx_memberships_active_user` and `idx_memberships_workspace`.
- **New triggers and functions:**
  - `platform_user_guard_update` (id/created_at immutable);
  - `principal_guard_immutable`: refuses DELETE/TRUNCATE on `platform_user`, and UPDATE/DELETE/TRUNCATE on `external_identity`.
- **`membership_audit`:**
  - `issuer`/`subject` replaced by `user_id`;
  - new columns `actor_user_id` (FK) and `transaction_id`;
  - CHECK `actor = actor_user_id::text` when an actor user is set;
  - new index `idx_membership_audit_workspace`.
- **Down:** drops every object in reverse dependency order. Verified by the round-trip test and by the CI `migration-lifecycle` suite.
- **Checksum:** any database that applied the old 010 must be recreated. Only disposable databases exist.

## Operator procedure: first admin (bootstrap)

The HTTP API needs an existing admin. Seed the first admin once, with operator SQL, in a transaction:

```sql
BEGIN;
INSERT INTO platform_user DEFAULT VALUES RETURNING id;                       -- → :uid
INSERT INTO external_identity (issuer, subject, user_id) VALUES (:iss, :sub, :uid);
INSERT INTO memberships (workspace_id, user_id, base_role) VALUES (:ws, :uid, 'admin');
COMMIT;
```

The resulting audit row has actor `db:<role>`. Every later change goes through the API and is attributed to an admin UUID. Disabling a user is an operator action:

```sql
UPDATE platform_user SET status='disabled'
```

## Environment and behaviour changes

| Change | Detail |
|---|---|
| Enrollment principal issue/revoke | Manager is now **403**; admin only. |
| Issuer-secret path | `AIL_ISSUER_SECRET_ENABLED=true` outside `DEPLOYMENT_MODE` local/test, or with `NODE_ENV=production` → **503** `RESEARCH_ONLY`. This was already unreachable because of the research gate; the check is now explicit. |
| OIDC `AuthContext.userId` | Internal UUID instead of `oidc:<hash>:<sub>`. Lead ownership (`assignedTo`) and audit actors must use it. `GET /v1/workspace/memberships` exposes the `userId` values. |
| OIDC unknown identity | Now 401 even when an `x-workspace-id` header is sent. Previously this case returned 403 `WORKSPACE_MEMBERSHIP_REQUIRED`. |
| OIDC tokens | Tokens valid for more than 15 minutes are refused (`lifetime`). The IdP access token TTL must be ≤ 15 min. |
| New routes | Four `/v1/workspace/memberships` routes. They are active only with `AUTH_MODE=oidc`; otherwise 404. |
| New provider | `MEMBERSHIP_ADMIN_CONFIG`, exported by `OidcAuthModule`. |
| New environment variables | None. |

## Test expectation changes (incl. QA specs)

- **`src/api/integration.oidc.r2-review.spec.ts` (QA R2-I):**
  - The resolution probe now uses an admin membership; it still expects 400 `WORKSPACE_FROM_CONTEXT`.
  - Added: "verified manager is resolved and refused by the ADR-006 matrix (expected 403)".
- **`src/infra/auth/oidc-adversarial.r2-review.spec.ts` (QA):** unchanged; 4/4 pass.
- **`oidc-authenticator.spec.ts`:**
  - The A-m5 namespacing test is replaced by the internal-id tests.
  - "no membership" became `unknown_identity` for identities that were never granted.
  - Re-grant after revoke is now allowed and creates a new row.
- **`intake.principal.spec.ts`:** contexts that were manager are now admin; manager is in the denied list.
- **`oidc-enrollment-http.spec.ts`:** the actor is the internal UUID.
- **`pg-membership.store.integration.spec.ts`:** rewritten for the new schema; re-grant is now expected to succeed instead of failing with 23505.
- **`e2e/integration-upload.e2e-spec.ts`:** the stand-in principals for enrollment are admin, with manager → 403 asserted. The OIDC suite uses an admin and an internal-UUID actor, and one membership API e2e was added. All edits are additive or limited to role and actor values; the `observation()` / `payloadHash` lines are untouched.
- **`src/app.module.ts`, outside the listed ownership:** a one-line addition registers `MembershipController`. It is needed because `infra` may not import `api` (architecture rule).

## Verification (exact)

| Command | Result |
|---|---|
| `npm run typecheck` | pass |
| `npm run lint` | pass |
| `npm run architecture:check:strict` | PASS (0 findings) |
| `npm test -- --exclude '**/*.integration.spec.ts'` | 71 files, **803 passed**, 0 failed, 0 skipped (baseline 783) |
| `TEST_DATABASE_URL=…/disposable_r3_iam npm run test:e2e` | 2 files, **19 passed**, 0 skipped |
| `TEST_DATABASE_URL=…/disposable_r3_iam npx vitest run src/infra/membership --no-file-parallelism` | 8 passed, run twice (rerun-safe) |
| `CI=true DEPLOYMENT_MODE=test TEST_DATABASE_URL=…/north_start_ci npm run test:integration:ci` (fresh empty DB) | **12 suites, 54 tests passed without skips** |
| `npm run build` | pass |

## Limitations / follow-ups

- **Out-of-scope markers** (orchestrator or other owners):
  - `ports/integration.ts:1,35` still carries `OPEN: PM-1`, and its `EnrollmentActor.role` type still allows `'manager'`;
  - `application/observability/connector-health.ts:56`, the `governed-action` files and `workspace-store.ts` also still carry PM-1 markers.
- **Disabling or re-enabling users:** operator SQL only; there is no API or audit row for status changes.
- **Identity links:** they cannot be removed, by design. A compromised identity is handled by disabling its user.
- **Admin protection:** there is no "last admin" protection. Self-change is refused, but two admins can revoke each other.
- **Grant responses:** they reveal whether an identity exists and is disabled (409 `USER_DISABLED`); only to admins.
- **Listing:** it shows all identity links of a member, including links created through other workspaces' grants.
- **Concurrent first grants:** two concurrent first grants of the same new identity → one gets 409 `CONFLICT` (retryable).
- **Rate limiting:** none on the membership routes, the same as the existing routes.
- **Bare executor:** `PgMembershipStore` constructed with a bare executor assumes the caller already holds a transaction, because the actor setting is transaction-local.
- **Issuer secret:** the path is still present for local/test. It is to be removed after the OIDC path is verified on pilot (ADR-006 §3).
