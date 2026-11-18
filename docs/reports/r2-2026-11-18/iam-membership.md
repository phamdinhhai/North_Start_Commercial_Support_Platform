# R2 D1 — OIDC-ready authentication + server-side workspace membership (experimental)

Status: **experimental, default OFF** (`AUTH_MODE` unset = existing stub behaviour). PM-1 remains **OPEN**: no permission matrix decided, no role added, no new mutation authority. Canonical files untouched.

Branch `work/r2-iam-membership` (base `8673ca8`).

## What was built

| Piece | File | Notes |
|---|---|---|
| Port types (additive) | `product/src/ports/auth.ts` | `AccessTokenVerifier`, `VerifiedPrincipal`, `MembershipReader`/`MembershipAdministration`, `VerifiedContextLookup`, tokens `MEMBERSHIP_STORE`, `VERIFIED_CONTEXT_LOOKUP`. Existing types unchanged. |
| Config + flag | `product/src/infra/auth/oidc-config.ts` | `AUTH_MODE=legacy` (default) / `oidc`; anything else throws. Validates issuer/audience/JWKS URI (https; plain-http loopback only in local/test), asymmetric alg allowlist (`none`/HS* refused), clock skew 0–120 s (default 30), JWKS cache 60 s–24 h (default 600 s), refetch cooldown 5 s–1 h (default 30 s). Production/pilot also refuse `DEMO_WORKSPACES=true` and `AUTH_DEV_UNSIGNED_TOKENS=true`. |
| JWKS cache | `product/src/infra/auth/jwks-key-store.ts` | Injectable fetcher; default fetcher: no redirects, 5 s timeout, 64 KiB cap. Unknown `kid` → one refetch (rate limited by cooldown, inflight de-duplicated). Stale cache + failed refresh keeps the previous key set; empty cache + outage fails closed. Sanitizer drops `oct`/`use:enc`/kid-less keys and rejects the whole set if any private/symmetric material (`d`,`p`,`q`,`dp`,`dq`,`qi`,`k`) is published. |
| Token verifier | `product/src/infra/auth/oidc-token-verifier.ts` | `jose.jwtVerify` with `issuer`, `audience`, `algorithms`, `clockTolerance`, `requiredClaims: [exp, sub]`. Alg, `typ` and `kid` checked from the header before any key lookup (so `none`/HS*/enrollment tokens cannot trigger a JWKS fetch). `typ` must be absent or `JWT`/`at+jwt`; anything else (notably `AIL-ENROLLMENT`) → `token_type`. `sub` ≤ 255 chars, no control characters. Outputs only `(iss, sub)`; all other claims (role, workspace, groups, email) are ignored. Token ≤ 8 KiB. |
| Membership decision | `product/src/infra/auth/oidc-authenticator.ts` | Workspace + base role come only from active membership rows. `x-workspace-id` may *select* among the caller's active memberships; otherwise 403. Membership read on every request (no cache). |
| HTTP wiring | `product/src/infra/auth/oidc-auth.module.ts`, `verified-context-registry.ts`, `auth.service.ts`, `app.module.ts` (+1 import, +1 entry) | `@Global` module. In OIDC mode only, a Fastify `onRequest` hook verifies token + membership and attaches the context in a `WeakMap` keyed by the server-owned headers object; `AuthService.resolve` (sync port) reads it. No controller changes. In OIDC mode unsigned dev tokens and the bootstrap admin hook are **disabled** (deny-only change); the opt-in demo sandbox path is unchanged (and refused at boot in production/pilot). |
| Membership stores | `product/src/infra/membership/{in-memory,pg}-membership.store.ts` | Postgres store uses parameterized SQL. In-memory store starts empty and mirrors DB constraints. `grant`/`revoke` are operator/test seams only — **no HTTP surface** (`// OPEN: PM-1`). |
| Migration 010 | `product/migrations/010_workspace_membership.{up,down}.sql` | `memberships(id, workspace_id → workspace(id), issuer, subject, base_role, status, created_at, revoked_at)`, `UNIQUE (issuer, subject, workspace_id)`, `CHECK base_role IN (admin, manager, sales, viewer)` (existing roles only), status/revoked_at consistency, length checks, `workspace_id NOT LIKE 'demo:%'`, partial index on active principal. Trigger: only `active → revoked` updates; identity/role/created_at immutable. Down drops the table (all rows lost; OIDC callers then fail closed). |

Request outcomes in `AUTH_MODE=oidc`:

| Situation | Result |
|---|---|
| Valid token, exactly one active membership | context `{workspaceId, userId = sub, role = base_role}` |
| Valid token, `x-workspace-id` = an active membership | that membership |
| Valid token, `x-workspace-id` without active membership (cross-workspace / spoof) | **403** `WORKSPACE_MEMBERSHIP_REQUIRED` from the hook |
| Verified token + malformed/repeated `x-workspace-id` | 400 `INPUT_INVALID` |
| Valid token, no membership / revoked / several memberships and no selection | no context → protected routes 401 |
| Invalid token (any reason), JWKS outage, store error | no context → 401 (reason logged at debug, never the token) |
| No bearer | unchanged (401 on protected routes; health/operator unaffected) |

Selecting a workspace among existing memberships does not decide PM-1: it grants nothing that a membership row does not already grant, and what each base role can do is still the existing `RbacService` behaviour.

## Resolver contract (coordinator integration note)

- Binding point stays `AUTH_CONTEXT_RESOLVER` → `AuthService` (provided/exported by `PilotLoopModule`; `pilot-loop.module.ts` is **not** edited here, so D2's `exports: [AUTH_CONTEXT_RESOLVER]` merges cleanly). `AuthService` delegates to the verified-context lookup when `AUTH_MODE=oidc`. `app.module.ts` only imports `OidcAuthModule` (hook + membership store); it adds no second resolver provider.
- Context shape: `workspaceId` from membership row, matching `^[a-zA-Z0-9:_./-]{1,256}$` (DB CHECK is stricter: ≤ 128, never `demo:`); `userId` = `sub`, 1–255 chars, no control characters; role ∈ existing base roles; `isDemo=false`.
- AIL enrollment tokens (`typ: 'AIL-ENROLLMENT'`) are never a login: rejected by `typ` even if signed by a JWKS-published key (unit + HTTP negative tests). The request hook only answers itself (400/403) **after** a token verifies as an OIDC access token, so bearers that are not OIDC tokens — e.g. enrollment tokens on `/v1/integration/observations` — pass through untouched to the owning controller.

## Dependency

| Package | Version | License | Reason |
|---|---|---|---|
| `jose` | 6.2.17 (exact pin, runtime dep) | MIT | Zero-dependency, WebCrypto-based JOSE/JWT library by Filip Skokan (OpenID certified-implementation author), actively maintained (published 2026-11-09), widely used, typed. Provides JWS verification, alg allowlist, claim validation and local JWKS selection, avoiding hand-rolled crypto. ESM-only package: loads from the CommonJS build via Node's `require(esm)` (verified: `node -e "require('./dist/infra/auth/oidc-token-verifier.js')"`). That needs Node ≥ 22.12; `engines` currently says `>=22.0.0` — recommend tightening (not changed here, not my file scope). |

Audit (per coordinator's revised criterion): `npm audit --omit=dev --audit-level=high` → **found 0 vulnerabilities**. `npm audit --json` high/critical advisories: only `GHSA-fc5q-39xc-vjpf` (picomatch, dev-only, pre-existing on base, no patch); jose adds none.

## Tests (exact)

Run in `product/`:

| Command | Result |
|---|---|
| `npm run typecheck` | pass |
| `npm run lint` | pass |
| `npm run architecture:check:strict` | PASS (0 findings) |
| `npm test -- --exclude '**/*.integration.spec.ts'` | 43 files, **489 passed, 0 failed, 0 skipped** (63 new: verifier 18, authenticator/store 11, config 19, HTTP 10, AuthService OIDC 5) |
| `TEST_DATABASE_URL=postgresql://north_test@127.0.0.1:55439/disposable_r2_iam npx vitest run src/infra/membership --no-file-parallelism` | **5 passed, 0 skipped** (run twice; rerun-safe) |
| Same URL, DB-local suites: completion-provenance, lead-access, pilot-loop, postgres, receipts, membership | 6 files, **28 passed, 0 skipped** |
| `npm run build` | pass |

Required negative cases covered: valid token+membership; expired (and within-skew accept); nbf future; wrong issuer; wrong audience; missing exp; alg `none` (no JWKS fetch); HS256 confusion using the public JWK as HMAC secret; tampered payload; forged key reusing a published kid; unknown kid → exactly one refetch then fail, further random kids rate limited; key rotation after cooldown; JWKS outage fail-closed; stale-cache tolerance; JWKS poisoning (private/symmetric material, enc keys); no membership; revoked membership (next request denied, no reactivation); cross-workspace request 403; client header spoof 403; token role/workspace claims ignored; same `sub` from another issuer; flag off = legacy unsigned/demo/bootstrap behaviour unchanged and JWTs not accepted; misconfig (missing issuer, unknown AUTH_MODE) → Nest bootstrap rejects; 14 config misconfigurations fail closed. HTTP spec boots the real `AppModule` and hits the real `GET /pilot/queue`.

Migration test: 010 down/up SQL executed inside a transaction that is rolled back (table + trigger function gone after down, constraints re-enforced after up), plus DB-level checks for unique/role/FK/status/demo-prefix/immutability (`23505`/`23514`/`23503`). The suite runs **only inside `TEST_DATABASE_URL`** (no extra databases created); fixtures are per-run suffixed. Added to `requiredSuites` in `product/scripts/ci-integration.mjs`.

Not run (they `CREATE DATABASE` on the server, which conflicts with "use only this DB"): `migration-004/005/lifecycle.integration.spec.ts`. By inspection they derive rollback versions from the migration list, so 010 should not break them; CI will confirm.

Touched outside primary ownership (necessary, minimal): `src/infra/postgres/migrator.spec.ts` (+1 version in the expected list) and `src/infra/postgres/completion-provenance.integration.spec.ts` (pins its migrator to ≤ 009 so `down()` still reverts 009 once any later migration exists — this also future-proofs it for other agents' migrations).

## Threat model

| Threat | Mitigation here | Residual / open |
|---|---|---|
| Token theft (bearer replay by holder) | Short-lived tokens assumed (exp required, skew ≤ 120 s); audience-bound; TLS-only endpoints in prod config; tokens never logged | No sender-constraint (DPoP/mTLS); lifetime is IdP-controlled; no `maxTokenAge`/`typ: at+jwt` enforcement yet (not all IdPs emit it) |
| Replay across services | `aud` must match configured API audience; `iss` exact match | No `jti` replay cache (not standard for access tokens); ID tokens accepted if IdP sets same `aud` — configure a distinct API audience |
| Algorithm confusion | Asymmetric allowlist enforced at config and per token; header checked before key lookup; jose additionally binds alg to key type; `none`/HS* tested | — |
| JWKS poisoning / SSRF | JWKS URI is operator config (https, no credentials, no redirects, 5 s timeout, 64 KiB cap); private/symmetric keys reject the whole set; enc/kid-less keys dropped; ≤ 50 keys | DNS/TLS trust in the IdP host; no pinning |
| Unknown-kid DoS / IdP amplification | One refetch per cooldown (default 30 s), inflight de-duplication, empty-cache outages rate limited | Signature verification cost per request is unbounded by rate (no request rate limiter in app) |
| Membership spoof (client header/body/claims) | Workspace/role only from DB rows matched on verified `(iss, sub)`; `x-workspace-id` only selects; claims ignored; legacy unsigned and bootstrap paths disabled in OIDC mode; demo refused in prod/pilot | — |
| Context forgery inside process | WeakMap keyed by request object identity, no client-addressable handle; copy → miss → 401 | Depends on Fastify `request.headers === raw.headers` (true unless something sets `request.headers`; failure mode is fail-closed) |
| Revocation latency | Membership read on every request, no cache → next request denied; revoke is one-way in DB | IdP-side session/user revocation still bounded by token `exp` (no introspection); revocation SLA is PM-1 |
| Privilege escalation via role column | DB CHECK + app filter restrict to existing base roles; role/identity immutable after insert | Who may insert rows is undecided (PM-1); no audit linkage of grant/revoke yet |

## What remains for PM-1 (not decided here)

- Capability matrix per base role (manager/admin breadth, QA-30/32/58) — unchanged `RbacService` behaviour.
- Membership lifecycle: who grants/revokes, approval/invite flow, audit-record linkage (I-05), re-grant after revocation (currently impossible by design: unique + one-way trigger), role change (requires revoke + new row; blocked by uniqueness today).
- Revocation SLA, session/refresh design, token lifetime, introspection vs JWT.
- Principal model: `userId = sub` for a single configured issuer; multi-issuer linking/migration of existing actor ids (touches ID-1) not done.
- Production IdP selection and bootstrap/seed procedure for the first admin (bootstrap hook is disabled in OIDC mode).
- Async `AuthContextResolver` port (would remove the hook/registry indirection; requires controller edits owned elsewhere).

## IdP / authorization options (proposal only — no adoption decision)

| Option | Kind | License | Fit notes |
|---|---|---|---|
| Keycloak | Self-hosted IdP (OIDC/SAML) | Apache-2.0 | Mature, realm-per-tenant possible, emits RS256 JWT access tokens with `kid`, supports audience mappers — compatible with this verifier as-is. Cost: JVM ops, DB, upgrades, key custody. |
| ZITADEL | IdP (cloud or self-host) | AGPL-3.0 (v3+ core) — legal review needed | Multi-tenant org model, OIDC with JWT or opaque tokens (opaque would need introspection adapter). |
| Ory (Kratos/Hydra) | Identity + OAuth2/OIDC server | Apache-2.0 | Modular, headless; Hydra issues JWT or opaque tokens; more assembly work. |
| OpenFGA | Relationship-based authz (Zanzibar) | Apache-2.0 | Candidate for lead-scoped relations later; canonical membership must stay in our DB; replication/consistency risk. Only after PM-1 model exists. |
| Cerbos | Policy decision point (YAML policies) | Apache-2.0 | Stateless PDP, good explainability/test tooling; needs PM-1 policy content first. |
| Casbin (node-casbin) | Embedded policy library | Apache-2.0 | In-process, low ops; model expressiveness vs. auditability to evaluate; same PM-1 dependency. |

All are compatible with the seam built here (`AccessTokenVerifier` + server membership + existing `LeadAccessPolicy`). Recommendation remains: keep authorization in-process until PM-1 is approved; run a synthetic conformance spike against a chosen IdP's real JWKS.

## Limitations

- Experimental and off by default; not production-approved. No HTTP API for membership management.
- `x-workspace-id` is only honored with a bearer token; multi-membership callers must send it.
- Only one issuer per deployment. No opaque-token/introspection support.
- Membership store selection follows `resolvePilotStoreMode()` (Postgres required in production/pilot; in-memory empty store otherwise → all OIDC callers 401 locally unless seeded in tests).
- Node ≥ 22.12 required at runtime for `jose` via `require(esm)`.
