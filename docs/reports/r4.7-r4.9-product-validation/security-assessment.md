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
