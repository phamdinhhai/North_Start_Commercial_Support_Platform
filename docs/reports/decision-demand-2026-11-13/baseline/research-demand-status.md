# Research demand status

**As of:** 2026-11-13  
**Status:** working, non-canonical  
**Purpose:** normalize existing documented demand without converting plans, hypotheses or candidate repositories into verified facts.

## Demand lanes

| Lane | Existing source | Status | Safe interpretation |
|---|---|---|---|
| Desirability and adoption | `docs/research/pancake-revenue-platform-documentation/00_EXECUTIVE/OPEN_QUESTIONS.md` Q-D1…Q-D6 | UNKNOWN / untested | No primary customer validation is claimed. |
| Viability and buyer value | Q-V1…Q-V3 | UNKNOWN / untested | Pricing, willingness to pay and buyer authority remain open. |
| Pancake feasibility | Q-F1…Q-F3 and `spike/pancake-verdict.md` | PARTIAL | Bounded internal/dashboard reads do not establish the Public API or webhook contract. |
| AI safety and usefulness | Q-F4, EXP-04, VH3 | BLOCKED / untested | Manual path remains valid; no autonomous mutation is implied. |
| Data authority and consent | Q-X1…Q-X6 | UNKNOWN / unresolved | Real-data work requires authority, purpose, minimization, retention and access decisions. |
| Phase 0 decisions | CE-1, CE-2 | OPEN | Gate #A and Product/Data or Product/Architecture approval are required. |
| Phase 4 sync | PH4 / Q-03 / Q-04 | FLAG_OFF | Do not turn research notes into production connector behavior. |
| Reusable assets | demand directive sections XVIII–XIX | REFERENCE | Repository names and links are candidates for review, not approvals. |

## Preserved epistemic states

- `OPEN` decisions remain open.
- `UNKNOWN` evidence is not filled with an inferred value.
- `PARTIAL` observations retain their scope and limitations.
- `FLAG_OFF` integration paths remain disabled by default.
- `untested`, `proposed`, `blocked`, and `feasibility` experiment states remain unchanged in meaning.
- `family_verified` and `endpoint_verified` are inventory coverage levels, not runtime or release approvals.

## Research intake checklist

For each future provider or asset, record the exact source/version/date, owner, authority, permissions, tenant binding, credential custody, schema, pagination, retry/idempotency, ordering/replay, PII/legal constraints, tests, live status and limitations. A live claim requires an appropriate credential/fixture and retained evidence. A community repository requires license, security, maintenance and compatibility review before any ADAPT/ADOPT recommendation.
