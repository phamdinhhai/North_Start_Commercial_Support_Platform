# R4.12 multi-agent task and review matrix

Six actual specialists executed in isolated worktrees across waves; runtime allowed three concurrent child slots. Initial nested spawn attempts failed with a thread limit. Provider/security/sync turns then suffered transient502/503 errors and were resumed from their preserved uncommitted work. Later independent reviewers hit a model usage limit after delivering their review findings; no participation or completion is fabricated. Root integrated all six specialist commits and owns final exact-source execution.

| Task ID | Owner | Priority / dependency | Owned files/modules | Acceptance / required tests | Evidence / implementation | Review partner / status |
|---|---|---|---|---|---|---|
| P-01..03 | r412_provider | P0/P1, baseline docs | provider-admission port/application/specs and four provider reports | Fresh source hashes/versions, unsupported contract, cumulative stages/no network activation | a0aceac→5c1128d;5 targeted tests/typecheck/lint/build | Root/security/QA; reviewed, implemented |
| SEC-01..04 | r412_security | P0, principal/custody boundary | provider-credentials port/test-only store/specs/security design | Admin-only, mode guards, workspace/account/version, rotation/revocation, no secret JSON/audit | 69473d8/0b9edd0/685ddae→dc01ba9/3e036f8/2d19824;7 targeted tests | Root/provider/QA; preliminary issues corrected, implemented |
| SYNC-01..05 | r412_sync | P0, approved transaction/principal contract | migration022, durable-sync ports/admission/runner, PG store/tests and sync reports | Same-tx receipts/checkpoint/audit, no fetch transaction, fencing, replay/loops/revoke, bounded retry | 90ec56e/a92fe5a→067de94/7038af2;7 actualPG tests+6migration tests | Root/security/provider/QA; implemented, root adds mandatory fetch admission |
| ID-01..04 | r412_identity | P0, R4.11 continuity invariants | source-continuity PG regression and identity review | Edit/delete/replay/new message preserve immutable links/raw/owners/Customer/outcome; no auto merge | 13b44bb→d9c0468;18 targeted actualPG tests | Root/QA; implemented |
| OPS-01..04 | r412_ops | P1, durable stream model | operator-sync-health port/query/reader/controller/UI helper/tests/runbook | Bounded scoped manager/admin reads, admin controls, secret-free UNKNOWN health, failure categories | a50f84c/4e279f5→309f838/6c9f25d;15 targeted tests | Root/security/QA; implemented, root composes and adds current source revoke/local counts |
| QA-01..05 | r412_qa | P0, integrated source `eef86fb` | NEW e2e/r412, playwright config, independent failure/custody/healthPG tests and QA reports | Timeout/429/schema/gap/auth/DB failure, source health/privacy/tenant/CSRF/control/restart/ownership | f264307→f71d665; b7b1b1d→edaf81d plus97b89bf browser delta;2b04cf2→160f53a;14direct+3PG+1browser PASS | Root/provider/security; independent tests and review complete, final rerun root |
| INT-01 | root | P0, all reviewed contracts | Shared composition, fabricated webhook/ledger023, source gates, CI registration/workflow, restore/process/benchmark scripts | Scope-bound signed fixture, atomic ACK,16-table restore/replay, abrupt child exit/resume, final26lanes | 49b0ff8/3354dd8/0a1d5cb/`0e6f971`; exact final source in verification.json | Security/provider read-only + QA signed browser; final verification root |

Dependency graph: exactR4.11Git/CI → shared contract review → credential/stream/admission foundations → identity and operator surfaces → root same-transaction composition/023 → independent negatives/browser → review corrections → fixed-revision full regression → documentation-only commit. Historical migrations001–021 and Owner pilot resources remain unchanged.

Review findings and corrections:

- Incomplete credential draft allowed manager mutation and connection-only storage keys. Final source enforces ADR-006 admin-only and workspace+connection keys, terminal revoke/version fencing.
- Returned metadata scopes could alias stored state. Root returns defensive copies; independent custody test proves mutation cannot widen scopes.
- Polling lacked mandatory credential check before fetch. Root requires authorizeFetch, tests zero request calls when revoked, retains current binding check at commit.
- Signed fixture admission lacked messages.read scope. Provider reviewer identified it; root checks both admission and sink and adds profile-only negative.
- New modules initially violated layer imports; dependencies were injected through ports/callbacks, strict architecture passes.
- Test-only admission defaulted missing deployment to test; now explicit local/test mode is required and verifier exceptions are categorical.
- Historical021 guard suite assumed latest migration; its isolated upgrade test now scopes to020→021 without weakening023 checks.

Acceptance is OFFLINE VERIFIED only after completed final lanes. No self-attested hosted/provider/human PASS is accepted. See verification.json for exact commands, revisions, failures/retries, counts, coverage and artifact hashes.
