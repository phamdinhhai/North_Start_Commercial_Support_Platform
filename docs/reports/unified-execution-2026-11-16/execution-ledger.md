# Unified execution ledger — 2026-11-16

Base: c9c2de814d0bc7bec9e74a918a51d6a7a16067b2, fetched origin before branching. Default main remains 5d6c206; decision-demand branch 12aabd1; draft PR #1 is unmerged. Integration branch feat/unified-adaptive-foundation. Existing user untracked directive is preserved. Canonical untouched, no main merge/release.

Runtime capacity: root plus three workers. Initial /root/a_architecture, /root/b_protocol_research, /root/d_security_data were spawned and returned guidance but disappeared from runtime on continuation; no commits/diffs existed in their worktrees. This interruption is not independent completed review.

| Agent ID | Role/task | Ownership/worktree | Inputs/dependencies | Deliverable/acceptance | Status/evidence |
|---|---|---|---|---|---|
| /root/a_architecture_resume | A canonical/architecture | north-star-unified-a / work/unified-a; architecture report only | All canonical, ADRs, AIL and review findings | Compatibility matrix, proposals, later independent D/E review; gates remain open | Active; contract guidance returned |
| /root/d_security_data_resume | D enrollment/PG intake | north-star-unified-d / work/unified-d; new integration layers, migration, composition/tests | Existing observation contract, A guidance | Signed server scope, atomic receipt/checkpoint, revocation, negative tests; experimental off default | Active; HTTP contract returned |
| /root/e_companion | E browser upload | north-star-unified-e / work/unified-e; extension and dedicated tests | D contract/A security guidance | Explicit opt-in; persistent outbox, validated ACK, expiry/conflict/restart tests | Active |
| /root | Integration and operator regression | current branch; operator-client/browser spec and ledger | Prior F2 reproduction | Actual outcome response + persisted assertion tested; no CE-1 change | Implementing |

Queued roles: B/C protocol/Pancake, F CRM/UX, G Ads, H Vietnam, I independent QA. These are NOT claimed assigned/completed until actual worker dispatch and results. One writer per worktree. Subsequent commits/test evidence will be appended.

## Shared experimental contract

POST /v1/integration/enroll: issuer secret, empty body, scope configured server-side (workspace/connection/account/page, pancake-conversations). Signed token with expiry. POST observations: token plus captureId, enrollment-local sequence, pageId and metadata-only Observation. Immutable receipt conflict detection; checkpoint is local delivery position, not provider cursor. Transaction checks revocation/expiry before persistence and ACK. ACK binds enrollmentId/captureId/sequence. No cookies, raw messages or canonical CommercialEvent promotion. No provider completeness/replay claims. Production IAM, membership and PM-1 remain separate approval dependencies.
