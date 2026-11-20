# Source trust boundary assessment

Assessed 2026-11-20 against R4.10 base `5181aba`. This is local synthetic hardening, not approval for live providers, accounts, customer data or Gate C. [Provenance and future transport design](provenance-security-review.md) records the remaining controls.

## Finding and classification

Every existing `SourceObservation` is client-fed `synthetic_fixture`, explicitly fabricated and `UNVERIFIED`. Operator-entered original Meta IDs can align the Pancake and Meta synthetic demonstrations. They do not establish Meta origin, provider authentication, independent verification, person identity, revenue attribution or account permission. Deliberately declaring the same synthetic native identity is not evidence of a live privilege escalation. A real provider ingest path does not exist.

The risk is confusing declared mapping with authenticated origin, especially when rendering `object_aligned` or preserving imported native IDs. This change adds an explicit trust read projection; it does not reinterpret immutable history or resolve CE-1, ID-1 or ID-2. ADR-005 keeps receipts technical, ADR-006 retains existing admin simulation and lead authorization, ADR-007 retains synthetic/flag-off scope, ADR-008 retains attribution UNKNOWN, and ADR-009 keeps digests server-owned.

## Admission and response contract

`assertSyntheticSourceAdmission(observation, {workspaceId, connection})` requires a **server-loaded, workspace-scoped** connection. It rejects a foreign workspace, revoked connection, provider/route/account mismatch, forged provider assurance and impossible native identity combinations. Connection lookup is authorization context, not provider attestation. The store must repeat current connection checks inside its transaction to prevent revocation races. This pure helper does not authenticate users, acquire credentials or authorize lead access.

`assertSyntheticNativeIdentity(observation)` rejects Meta-route Pancake identity, Meta native page differing from its transport account, a null native system carrying IDs, and revision without event. A Pancake route may declare another Meta page namespace for the existing explicit synthetic mapping demonstration. That declaration stays a candidate. Incomplete native identities remain UNKNOWN.

`projectSourceTrust(observation, optionalAdmission)` returns only these categorical fields:

| Field | Current values / meaning |
|---|---|
| sourceAuthority | `synthetic_fixture` (existing classification) |
| verification | Always `UNVERIFIED` |
| authority | `LOCAL_SYNTHETIC_FIXTURE` with accepted server context; otherwise `LEGACY_UNVERIFIED` |
| admission | `SERVER_BOUND_SYNTHETIC` or `LEGACY_UNVERIFIED` |
| transportIdentity | `LOCAL_ADMIN_SIMULATION` or `UNKNOWN`; never provider identity |
| origin | `LOCAL_FIXTURE` |
| nativeMapping | `USER_ASSERTED_CANDIDATE` for complete declared native identity; otherwise `UNKNOWN` |
| providerAttestation | Always `NOT_AVAILABLE` |
| independentVerification | Always `NOT_AVAILABLE` |

No raw body, original payload, token, source IDs, digest or personally identifying fields enter this projection. Passing forged legacy labels cannot promote the output. The caller must never construct admission from a request body. Historical reads without separately admitted server context remain `LEGACY_UNVERIFIED`; neither history nor receipts are overwritten. An active connection today cannot retroactively authenticate an old provider event. A revoked connection must not prevent authorized reading of immutable historical evidence: use the legacy projection on reads rather than re-admitting it as a new observation.

## Verification

On the isolated security worktree: `npm ci --ignore-scripts --no-audit --no-fund`; `npm run typecheck` PASS; `npx vitest run src/application/source-trust src/application/source-integration src/infra/observability/json-logger.r2-review.spec.ts` PASS (3 files, 23 tests, including 6 new adversarial trust tests). Tests exercise forged assurance, transport substitution, native page spoofing, foreign workspace, revoked replay, legacy downgrade, incomplete identity, explicit synthetic dual-path candidate mapping, raw-data exclusion and error/log redaction.

These are helper/application checks, not proof of transaction isolation, OAuth correctness, live webhook verification or backup erasure. Root integration owns HTTP wiring and dedicated PostgreSQL verification; existing PG tests cover receipt/native event collisions, tenant isolation, revocation, immutable original retention and rollback on final audit failure. Final integrated evidence must report actual executed checks separately from this worktree result.
