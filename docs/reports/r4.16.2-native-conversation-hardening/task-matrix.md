# R4.16.2 task graph

| Task | Owner | Depends | Acceptance | Status |
|---|---|---|---|---|
| N01 identity/pagination SQL | Agent 1 | contract freeze | composite scoped identity and deterministic cursors | RUNNING |
| N02 authorization/provenance | Agent 2 | identity contract | workspace/connection/page/revocation negatives | RUNNING |
| N03 React Inbox/search | Agent 3 | API contract | cursor load-more, session clear, UTF-8 search | RUNNING |
| N04 disposable PG/browser E2E | Root (Agent 4 role; no slot) | N01-N03 | intake→receipt→native Inbox, restart/replay | PLANNED |
| N05 independent adversarial QA | Root (Agent 5 role; no slot) | all code | N01-N08 negative matrix | PLANNED |
| N06 architecture/license/release | Root (Agent 6 role; no slot) | all evidence | exact SHA/docs/license/gates | PLANNED |

Environment limit: four concurrent agent slots including orchestrator, so only three new specialist processes were available. Agent 4–6 responsibilities are retained as explicit root-owned review tasks and are not represented as simulated subagents.
