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

## Review fixes (2026-11-18, branch `work/r2-fix-auth`, base `93c39d9`)

Source: `architecture-canonical-review.md` findings A-M5, A-m4, A-m5 and A-M6. QA independently reproduced A-M5 as R2-I-02.

| Finding | Fix | Where | Regression tests |
|---|---|---|---|
| **A-M5**: in `AUTH_MODE=oidc`, `/integration/enrollments(/revoke)` always returned 401. The controller resolved from `{ ...headers }`, but the registry was keyed by the identity of the headers object. | **(1)** The controller now passes the request's own headers object, like every other controller. Audited: `pilot-loop`, `feedback-telemetry` and `connector-health` already did.<br>**(2)** `VerifiedContextRegistry` no longer depends on object identity:<br>• It defines an opaque, frozen per-request brand on the request headers, under a module-private **enumerable symbol**.<br>• The brand is non-writable and non-configurable; attaching a second time throws.<br>• The context lives only in a `WeakMap` keyed by that brand.<br>• Server-side shallow copies keep the brand (spread, and Fastify's `Object.assign` header merge).<br>• A client cannot forge it: symbols never cross HTTP, and JSON, string keys or identical values do not match.<br>• Headers stay identical by string keys (`Object.keys` and JSON are unchanged). | `product/src/api/integration.controller.ts:59-65`<br>`product/src/infra/auth/verified-context-registry.ts` | **`src/infra/auth/oidc-enrollment-http.spec.ts`** (real `AppModule`, `AUTH_MODE=oidc`, runtime keys, in-memory JWKS):<br>• "manager membership issues and revokes an enrollment, attributed to the namespaced OIDC principal"<br>• "sales membership → 403; no membership / no token → 401; foreign workspace header → 403"<br>**`src/api/integration.controller.spec.ts`**: "A-M5: hands the resolver the request headers object itself, not a copy"<br>**`src/infra/auth/auth.service.oidc.spec.ts`**: "returns only the context attached to this request (brand), never one rebuilt from header values"<br>**QA's `src/api/integration.oidc.r2-review.spec.ts`** (adopted): `it.fails` flipped to `it`. The "evidence of current behaviour: 401" case keeps its name and is now `it.fails`.<br>**PostgreSQL e2e** (`product/e2e/integration-upload.e2e-spec.ts`): "AUTH_MODE=oidc principal enrollment through real HTTP and PostgreSQL membership" |
| **A-m5**: `userId = sub`, with no issuer namespace. | `AuthContext.userId` for OIDC principals is now `oidc:<first 24 hex of sha256(iss)>:<sub>` (`oidcUserId`).<br>• Stable: built from the exact verified `iss` plus `sub`; no lookup table.<br>• Meets the resolver contract: 1–256 chars, no control characters. Subjects longer than 226 chars are refused as `missing_claim`.<br>• A different issuer, or a legacy actor id (`bootstrap-admin`, unsigned-dev ids, emails), can never equal it, so lead ownership (`assignedTo === userId`) cannot transfer silently.<br>• Membership rows still store the raw `(issuer, subject)`. | `product/src/infra/auth/oidc-authenticator.ts:22-41,72,93` | **`oidc-authenticator.spec.ts`**: "A-m5: userId is namespaced by issuer — stable, contract-bounded and never equal to the raw sub"<br>Expectations updated in `oidc-authenticator.spec.ts` and `pg-membership.store.integration.spec.ts`.<br>QA's `oidc-adversarial.r2-review.spec.ts` (b5e17f4) passes unchanged (4/4); it does not assert the raw sub. |
| **A-m4**: DELETE was allowed, so revoke could be bypassed by delete plus re-insert, erasing history. Grant and revoke had no audit. | Migration 010 is unreleased and edited in place; up and down stay symmetric.<br>**Delete guard:** a `BEFORE DELETE` row trigger and a `BEFORE TRUNCATE` statement trigger on `memberships` raise `restrict_violation` (23001).<br>**Audit:** a new append-only `membership_audit` table with columns `membership_id → memberships`, `operation` (grant / revoke), `workspace_id`, `issuer`, `subject`, `base_role`, `actor`, `effective_at`, `recorded_at`.<br>• An `AFTER INSERT OR UPDATE` trigger writes it, so every path is recorded (store, operator SQL, seed).<br>• `UPDATE`, `DELETE` and `TRUNCATE` on it are refused.<br>• `actor` = transaction-local `north.membership_actor` if an operator sets it, else `db:<session_user>`.<br>**Why not `audit_record`:** its workspace-consistency trigger is lead-oriented, and append-only is not enforced in the DB.<br>No HTTP grant API was added (PM-1). | `product/migrations/010_workspace_membership.up.sql:47-113`<br>`.down.sql` | **`pg-membership.store.integration.spec.ts`**:<br>• "A-m4: DELETE and TRUNCATE are refused, so revoke cannot be bypassed by delete + re-insert"<br>• "A-m4: grant and revoke are recorded in append-only membership_audit with an actor"<br>• The down/up round-trip now also checks that `membership_audit` and all four trigger functions are gone, and that DELETE is refused after re-up.<br>**e2e**: checks the `grant`, `revoke` history. |
| **A-M6**: manager/admin breadth is reachable through OIDC membership. | **No code change** (PM-1 human gate); see the next section. | — | — |

### A-M6: PM-1 gate item (documentation only; RBAC unchanged)

Migration 010 accepts `manager` and `admin` membership rows. In `AUTH_MODE=oidc`, such a row gives a real principal the existing breadth, which is still **undecided**:
- workspace-wide lead read (`infra/rbac/rbac.service.ts`, QA-58);
- enrollment issue and revoke (`application/integration/intake.ts` `principal()`);
- connector-health read;
- any future governed-action approval mapped to these roles.

**Gate condition** (proposed register entry R2-P-05):
- No `manager` or `admin` membership row may be created for real data until the PM-1 permissions RFC is accepted.
- Until then, privileged rows are acceptable only in disposable test or local databases.
- The capability rows `enrollment.issue`, `enrollment.revoke` and `connector-health.read` → manager/admin are **interim, proposal-only** entries for the PM-1 register.

**Membership lifecycle** (re-grant after revoke, role change, who grants, revocation SLA) remains R2-P-06. Today, the unique key plus the one-way and no-delete guards refuse re-grant and role change. That is a refusal, not a decided policy.

An optional `DEPLOYMENT_MODE` guard against privileged rows was **not** added, because it would itself encode PM-1 policy.

### ID-1 non-impact (A-m5)

ID-1 (merge thresholds) concerns Customer and Lead identity resolution. The namespaced id identifies only an **operator principal**:
- It does not link, merge or match any Customer or Lead.
- It does not derive identity from client input.
- It does not map external identities to an internal user.

R2-P-07 (`sub` vs `iss`+`sub` vs a mapped internal user id) stays open under PM-1. The prefixed form is a safe interim; a mapped id can replace it later.

**Migration note:** if lead ownership was ever assigned to a raw `sub` in `AUTH_MODE=oidc` before this fix, that ownership no longer matches. OIDC is experimental and off by default, and no real data exists.

### Verification (this branch, local PG17 `disposable_r2_fix_auth`)

| Command | Result |
|---|---|
| `npm run typecheck` / `npm run lint` | pass / pass |
| `npm run architecture:check:strict` | PASS (0 findings) |
| `npm test -- --exclude '**/*.integration.spec.ts'` | 61 files: **710 passed, 1 expected fail**, 0 failed, 0 skipped. The expected fail is QA's defect-evidence case, now `it.fails`. |
| `TEST_DATABASE_URL=… npm run test:e2e` | 2 files: **18 passed, 0 skipped** |
| `TEST_DATABASE_URL=… npx vitest run src/infra/membership src/infra/integration --no-file-parallelism` | 2 files: **13 passed, 0 skipped** |
| Same DB: governed-action, connector-health, completion-provenance, lead-access, pilot-loop and postgres integration suites | 6 files: 29 passed, 0 skipped |

**Not run:** `migration-004/005/lifecycle.integration.spec.ts`. They `CREATE DATABASE`, which the single-DB rule does not allow. By inspection, the 010 down script still drops every object it creates, in dependency order.

**Limitations**
- The brand lives on the Node `IncomingMessage` headers object. Code that rebuilds headers from scratch (rather than shallow-copying them) still fails closed with 401.
- `membership_audit.actor` defaults to the DB role unless the operator sets `north.membership_actor`. Linking it to an approved operator identity is PM-1.
- The `VerifiedContextLookup` doc comment in `ports/auth.ts` ("keys are server-owned request objects") is still accurate. It was not edited because the file is outside this ownership.
