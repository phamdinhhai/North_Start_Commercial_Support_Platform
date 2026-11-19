# R4.7 SEC-01 independent checkpoint

Baseline `08bdefa`, security worktree `ns-r47-security`. New tests change no production behavior. Governing sources: canonical I-03/I-05/I-09/I-12, ADR-006/009 and R4.6 security/lifecycle assessments. No real data, grants, migrations, deployment or outbound capabilities exercised.

## Executed evidence

`npm ci --ignore-scripts` completed (five moderate dependency advisories remain). `npm test -- src/infra/crypto/r47-privacy-adversarial.spec.ts`: 3 passed, zero skipped. New negatives exercise tenant and purpose HMAC separation even with reused key bytes/kid, unknown retired key and malformed digest, export denial before existence lookup, SQL-shaped ID refusal, trusted workspace/actor forwarding, and secret-bearing log/telemetry keys and nested values. `npm run typecheck` passed.

Independent baseline rerun: OIDC authenticator, configured content digester, logger R2 negatives, telemetry and export service suites: 5 files / 42 passed, zero skipped. No PostgreSQL tests executed in this checkpoint; these mocks/pure tests do not prove row isolation or database roles. No coverage percentage asserted.

## Wave-one cross-review

UX `f427c822`: recovery retains detached form nodes in tab memory only, verifies fresh internal user/workspace identity, reloads lead permission before restoring, creates a fresh command key/version, and requires explicit submission. 403 clears draft/context; identity/workspace switch discards held draft. No new local/session storage or URL persistence observed. Browser acceptance and identity-switch/revocation race execution remain QA responsibilities. Closing a tab is not a memory-zeroization guarantee.

COM `3b3857e`: new manager/admin service is read-only, denies sales/viewer/demo before storage and overwrites workspace with authenticated context. SQL uses parameterized classification/cursor/limit with 1..100 service bound and workspace conditions across envelope, handoff, work, context, membership and outcome relations. Observations do not claim corroboration, commercial transitions, revenue or SLA. Statement-level consistent read is appropriate for page observations; it is not a global aggregate. PostgreSQL role/scope execution remains unverified by this specialist.

ENV draft reviewed 2026-11-19: app, control and test issuer bind loopback; runtime scrubs inherited deployment/secret environment; generated manifest secret directory uses private Windows ACL; no secret URLs printed by launcher. Test issuer deliberately allows choosing the synthetic admin account, hence no real identity assurance or real-data admission. Root notified of fail-closed blockers: role regex alone does not bind role to manifest ID; port is not tied to private PostgreSQL configuration/data_directory before admin database operations. Validate live `SHOW data_directory` before admin create/reset/restore and add tampered-manifest negatives. Root additionally identified same-browser cookie-context isolation gaps in verifier and startup need to reject existing non-synthetic evidence. Pending fixes are not claimed complete here.

Root's synthetic-only guard must reject false/missing classification on every enabled intake route and fail startup against existing false/unknown accepted evidence. UI checkbox restrictions are insufficient. A loopback fixture is authorized only for invented data and the confirmed operator; organization pilot approval, real participants and actual provider identity remain gated.

Governance proposal: `data-governance-design.md` covers immutable metadata versus encrypted payload, legacy compatibility, key custody, retention/erasure/holds/backup/downstream and explicit owner gates. It introduces no legal duration or production erasure promise.

## Integrated root review (`29d61e0`)

Independently executed in root integration worktree: `npm test -- src/infra/pilot/synthetic-pilot-mode.spec.ts src/api/manager-exceptions.http.spec.ts src/application/pilot/manager-exceptions.service.spec.ts`: 3 files / 12 passed, zero skipped. No PostgreSQL or browser tests are included in that count.

Synthetic admission is fixed at composition, enabled only with exact `true`, local/test deployment and OIDC, with explicit production NODE_ENV denial. Scenario HTTP boundary validates types and translates omitted classification to false, which the command rejects before lookup/adapter/storage in this mode. Internal omitted classification defaults synthetic. The mode flag returned by session view is nonsecret metadata and does not grant authority. This is a classification guard, not content inspection: invented-data operator discipline remains necessary.

Manager wiring uses durable reader only in PostgreSQL mode and otherwise fails with explicit503. Controller uses verified request context and no-store; service independently denies non-manager/admin and demo before scan. Mount cleanup invalidates asynchronous results on context clear,401,403 and logout; rendering uses textContent. Fresh recovery identity/workspace comparison and lead reload precede restoring a held draft. No draft storage or role authority moved to browser in root integration.

Limit: the synthetic mode does not globally disable other privileged APIs or research observation intake. The local launcher must keep research disabled through its explicit environment allowlist and verify stored evidence classification before admitting the application. API authorization continues to depend on ADR-006 membership on each request, not this flag. Startup inspection and cluster-binding fixes remain separate ENV review evidence. No organizational real-data pilot approval is implied.

## Final follow-up review

Security independently reviewed worker8eb483d (integrated a5ebe65) and27aab7c (integrated cdcf15e) and reran launcher safety tests: five passed, zero skips. No blocking finding in the authorized local synthetic scope. Live cluster identity, exact role/config/path binding, unsafe-history startup refusal, bounded lock-loss shutdown and user/workspace/role draft recovery are present. Root independently repeated actual PG outage/manual recovery and unsafe-history rejection on the integrated build; see verification.json. Tests do not prove the truth of operator-entered synthetic content, deployed identity assurance or production least privilege. OS owner remains trusted. Earlier pending ENV findings above are historical checkpoints, now closed by this follow-up within local scope only.
