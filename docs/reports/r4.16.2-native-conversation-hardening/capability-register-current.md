# Current capability register — R4.16.2 closure

This register reflects the implementation at `d1bd8a286c82617b3c32efdec503ae6682fa0fb2` and local evidence through `f2b188e`. Historical `docs/implementation-plan/state/features.json` is preserved unchanged.

| Capability | UI | Backend/PostgreSQL | Synthetic E2E | CI | Owner |
|---|---|---|---|---|---|
| Native conversation intake/projection | READY_FOR_OWNER_REVIEW | INTEGRATION_VERIFIED | READY_FOR_OWNER_REVIEW (React 1/1) | PENDING exact SHA | PENDING |
| Lead-scoped conversation authorization | READY_FOR_OWNER_REVIEW | INTEGRATION_VERIFIED | Negative SQL/HTTP covered | PENDING exact SHA | PENDING |
| Conversation pagination/identity | READY_FOR_OWNER_REVIEW | INTEGRATION_VERIFIED | Local fixed-dataset tests | PENDING exact SHA | PENDING |
| Bounded message history | READY_FOR_OWNER_REVIEW | INTEGRATION_VERIFIED | Single conversation React | PENDING exact SHA | PENDING |
| CRM search | READY_FOR_OWNER_REVIEW | INTEGRATION_VERIFIED (8/8 PG) | React browser route not separately exercised | PENDING exact SHA | PENDING |
| Existing Sales/LVP workflow | Existing | Existing regression coverage | Dedicated continuity journey not rerun in this closure | PENDING exact SHA | PENDING |
| Live providers/outbound messaging | NOT_IMPLEMENTED | NOT_AUTHORIZED | NOT_RUN | PENDING | NOT_AUTHORIZED |

Current release maturity: `IMPLEMENTED_WITH_ACCEPTANCE_BLOCKERS` / `READY_FOR_OWNER_REVIEW`.

Remaining blockers are Hosted CI for the final SHA, full Conversation ? Lead ? handoff ? outcome React journey, stronger page-membership semantics if Owner requires them, and explicit Owner acceptance.