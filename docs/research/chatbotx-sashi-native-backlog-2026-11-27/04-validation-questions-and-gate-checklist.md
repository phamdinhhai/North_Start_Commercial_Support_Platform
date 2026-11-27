# 04 — Remaining Validation Questions & Gate Checklist

**Status:** Open questions are preserved; this document does not resolve canonical decisions or authorize implementation.  
**Evidence baseline:** consolidated handoff `7c4cefe9b282770bc389abf3b4be441aefa4cb9f`; post-handoff security/capture commits `c77482ee`, `b9b6155e`, `6e98238d`.

## 1. Release and evidence reconciliation before R4.16.4

| Gate | Current evidence | Remaining question / required action | Owner / target |
|---|---|---|---|
| Exact candidate CI | `exec/r4163-acceptance@6e98238` contains source-association fix plus R3 A-02/A-03/A-04 code; prior `verification.json` still records hosted run `45582583027` for `85b45f3`, and `ownerAcceptance: PENDING`. | Has hosted CI passed at `6e98238de1f81b3ee87f2b37eb84cbcf15835171` (or consolidated head)? Update `docs/reports/r4.16.3-native-commercial-continuity/verification.json` with exact SHA/run. | Engineering / before branch cut |
| Owner acceptance | `owner-acceptance-addendum-2026-11-26.md` says `APPROVED_AND_VERIFIED_FOR_R4_16_3_ACCEPTANCE_CHECKPOINT`, but old machine-readable status remains pending. | Record one authoritative acceptance artifact and reconcile the machine-readable status; do not claim release from prose alone. | Product Owner / Stage 0 |
| R3 A-02 | `b9b6155` uses server-held workspace/purpose-keyed HMAC digests with key ID and rotation handling. | Does exact hosted CI cover historical key-missing `UNKNOWN`, workspace separation, purpose separation and content-free evidence paths? | Security + QA |
| R3 A-03 | `c77482e` adds durable assertion outbox, lease fencing, sink idempotency and crash/restart tests. | Does hosted CI execute the crash-after-commit/sink failure/restart integration cases on the consolidated schema? | Reliability + QA |
| R3 A-04 | `6e98238` adds AES-256-GCM/HKDF capture cipher, migration `024`, max 7-day expiry and audited purge. | Is the exact keyring configuration and purge failure recovery verified in hosted CI without secrets or plaintext artifacts? | Security + Ops |
| Independent QA | Phase 2 handoff was Root self-review; `ATT/DIST` fixtures and native PG protocols are unexecuted. | Which independent reviewer owns R4.16.4 contract review and signs acceptance evidence? | Engineering lead / before implementation |

## 2. R4.16.4 Attention policy questions (`ATT-POL-*`)

These are policy choices, not implementation details. Obtain written Owner decisions in a new ADR/RFC; do not use research recommendations as defaults.

| ID | Question | Alternatives / consequence |
|---|---|---|
| `ATT-POL-01` | Which clock determines deadline? | Elapsed; assignee working time; workspace working time. Changes fairness, breach and holiday behavior. |
| `ATT-POL-02` | What happens when policy changes during an open cycle? | Freeze snapshot; recompute revision; explicit conflict/manual review. Never silently duplicate. |
| `ATT-POL-03` | How are DST gaps/repeated local times handled? | Reject; earlier instant; later instant. Must be deterministic and tested on target PG 16. |
| `ATT-POL-04` | Does archive prove human closure? | Lifecycle close only (recommended research boundary); human-equivalent close. Archive must not fabricate a human response. |
| `ATT-POL-05` | When is next-response target created? | None; after every human reply; once per cycle. Changes watermark and obligation semantics. |

**Required acceptance:** `ATT-01..08`, `ATT-PG-01..04`; native `postgres:16-alpine`, two independent connections, SQLSTATE/locks/rows/audit captured; invalid policy retains obligation with `UNKNOWN` rather than discarding evidence.

## 3. R4.16.4 Distribution policy questions (`DIST-POL-*`)

| ID | Question | Alternatives / consequence |
|---|---|---|
| `DIST-POL-01` | How do overlapping policies resolve? | Explicit priority; deterministic policy order; `POLICY_CONFLICT` / no proposal. Never infer Sashi order. |
| `DIST-POL-02` | What is capacity scope? | Per policy; per recipient; workspace global. Changes lock/bucket identity. |
| `DIST-POL-03` | What fairness algorithm is intended? | Round-robin; lowest load; weighted; manager order. Must disclose reason/evidence. |
| `DIST-POL-04` | Does proposal assign responsibility automatically? | Proposal-only with explicit `RecipientAcceptance` (current guardrail); future governed enablement. |

**Required acceptance:** `DIST-01..09`, `DIST-PG-01..04`; shared-capacity two-Lead concurrency, same-key digest conflict, membership revocation, existing owner, policy revision, release-once, audit rollback.

## 4. Canonical decisions that remain unconditionally open

| Decision | Validation question | Guardrail until resolved |
|---|---|---|
| `CE-1` | What is the canonical CommercialEvent ↔ CommercialState transition matrix, beyond interim LVP hypothesis? | Keep `// OPEN: CE-1 — see ADR-001`; attention/work status is not Commercial State; no AI transition. |
| `ID-1` | Are identity links/merges deterministic, inferred, thresholded, reversible, and who authorizes them? | Customer ≠ Lead; duplicate phone is observation only; no automatic merge. |
| `ID-2` | What external CRM/POS object/field mapping is authorized? | Adapters do not own semantics; no CRM/POS mapping or commerce authority. |

Owner-accepted `ADR-005` (`CE-2`), `ADR-006` (`PM-1`), `ADR-007` (`LG-1`), `ADR-008` (`MM-1`), and `ADR-009` constrain the `exec/r4163-acceptance` design lineage, but do not alter frozen `docs/canonical/**` in this worktree.

## 5. Provider and legal validation

1. **Pancake (`Q-03/Q-04`):** Can the official documented read API and webhook contract be verified with authorized fixtures? Confirm paging, event/version semantics, signatures, retries, redaction and cursor behavior. Until then `NCB-PROV-01` remains blocked and flag OFF.
2. **Pancake send (`P3`):** Can one controlled official send be proven with provider authorization, readback, rollback/compensation, consent, rate limit and kill switch? Current status `SEND_UNRESOLVED`; no private socket/browser route may be promoted.
3. **Provider identity / CRM (`ID-2`):** Which external objects may become imported/observed assertions, and which remain raw provider facts? Confirm mapping ownership and source/revenue/attribution separation.
4. **ChatbotX license:** Is any exact file candidate (even `LX-02`) worth a formal SPDX/CycloneDX closure, enterprise-import proof, notices and written legal approval? Default remains independent implementation and zero donor lines.
5. **Sashi:** Is there written authorization for any authenticated sandbox read-only session beyond the historical session? If not, keep public docs as product reference and do not probe private APIs or retain PII screenshots.
6. **Provider terms:** Are Meta/TikTok/Zalo/Pancake/Google scopes, data retention, consent, and export terms approved for the intended workspace? No adapter is production-ready from source inspection alone.

## 6. PostgreSQL and runtime validation

- Generic fixtures passed on Timescale `PG 18.7` (`pgvector 0.8.7`), but North Star CI/compose target `PostgreSQL 16`; rerun timezone, partial unique, transactional rollback, capacity, vector and migration tests on exact product migrations and target version.
- `ATT/DIST/RAG/WF-PG` protocols are `TEST_PROTOCOL_READY`, not executed native acceptance. Capture migration revision, server version, isolation level, two-connection locks, SQLSTATE, committed rows and append-audit rows.
- Do not promote ChatbotX focused suites (`1,622` business, `1,348` FlowConfig, `291` AI, `233` MCP, `80/16` Zalo) to North Star runtime or legal evidence; they are donor-source test evidence only.

## 7. Human validation and learning loops

| Loop | Question | Required evidence | Current status |
|---|---|---|---|
| `L0` Ready | Is Owner, bet, scope, data policy and tester path explicit? | Pilot charter + synthetic fixtures + access review. | Product loop exists; external evidence not claimed. |
| `L1` Comprehension | Can an outsider complete handoff/attention/distribution task without coaching? | Uncoached task trace, errors, feedback and release SHA. | Not verified. |
| `L2` Vertical slice | Is manual loop inspectable end to end with durable audit? | R4.16.3 evidence plus native R4.16.4 acceptance. | Engineering R4.16.3 accepted locally; learning closure not automatic. |
| `L3` Usable over time | Can a tester handle multiple Leads across days without AI/integration? | Multi-day synthetic/pilot telemetry, corrections, UNKNOWN rates and feedback. | `P5=NOT_VERIFIED`; no external multi-day sessions. |
| `L4` Optional leverage | Does AI/sync improve the loop without lowering trust? | Flagged comparison, evidence citations, correction rate, denied-action rate, A-02/A-03 gates. | Not started. |
| `L5` Direction | Continue, Narrow, Pivot or Stop? | Owner decision based on external evidence, not donor feature count. | Not started. |

## 8. Final gate checklist

- [ ] Exact hosted CI and machine-readable evidence reconciled at consolidated R4.16.3 SHA.
- [ ] Owner acceptance and independent QA recorded.
- [ ] `ATT-POL-01..05` and `DIST-POL-01..04` written decisions recorded.
- [ ] `ATT-PG-01..04` and `DIST-PG-01..04` pass on exact North Star PG 16 migrations.
- [ ] Product agents receive only clean-room specifications; no donor clone/bundle access.
- [ ] `CE-1`, `ID-1`, `ID-2` remain open unless Owner RFC explicitly closes them.
- [ ] Pancake `Q-03/Q-04` and provider rights pass before any PH4 activation; outbound remains deny-all.
- [ ] L1/L3 external human evidence exists before L4 AI/RAG or workflow leverage.
- [ ] L5 direction gate is based on user evidence; no revenue/PMF claim from source inspection.
