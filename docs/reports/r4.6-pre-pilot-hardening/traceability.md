# R4.6 requirement delta

Normative sources, frozen invariants and accepted ADRs retain authority. This delta supplements docs/reports/r4-2026-11-19/traceability.md; it does not overwrite R4 evidence. test-verification.json is the final exact-revision result. Implemented code, isolated tests, integrated UI verification and external acceptance remain separate.

| Requirement | R4.6 implementation delta | Verification / remaining limit |
|---|---|---|
| R-01/02/03 | Bounded identity responses, successful login retires previous session, absolute stale JWKS age, production ephemeral-key denial; new resource APIs retain existing scopes | Security behavior matrix + signed tests and integrated negatives; actual enterprise IdP not accepted |
| R-04/07/08/09/11 | Existing manual intake/context/handoff reused | Full UI-only journey rerun; no duplicate workflow architecture or new state-machine scope |
| R-05/06/27 | Existing keyed evidence/idempotency preserved | Crypto/PG/adapter regression gates; no live Pancake transport claim |
| R-10/17 | Distinct source/lineage/attribution with reasons; unknown lineage cannot masquerade as recorded fact | UI assertion and claim API/unit checks; no full Data Health coverage view |
| R-12 | Dedicated human contact claim/time/channel/result/evidence/follow-up implication, append-only history and export | Owner scope, PG CAS/idempotency/audit rollback, UI creation/history/restart; no automatic corroboration or contact supersession command |
| R-13/14/15/19 | Existing action/correction/audit reused; contact recording cannot complete work or advance state | UI/PG regressions; CE-1 remains open, dedicated contact corrections deferred |
| R-16 | Poison/tenant schema validation before delivery, timeout/conflict quarantine, consumer collision detection, admin OIDC replay/stop audit | Failure tests, lease/CAS/concurrency/rollback/dedup, actual private PG restart in worker evidence; runner local/test only |
| R-18 | Policy revisions + count-only retention previews; immutable015/016 statement guards and nonempty downgrade refusal; schema readiness001-017 | Disposable PG/migration/restore and signed lifecycle HTTP; actual canonical erasure/anonymization/retention/holds NOT IMPLEMENTED |
| R-20/26 | AI/provider execution and production Pancake paths remain disabled | Architecture/registry/MV3 regression; no provider contacted |
| R-21 | Added categorical handoff-start/contact/error/recovery vocabulary (recovery emission remains incomplete); synthetic/unknown still excluded | Allowlist negative/privacy tests and persisted browser event checks; client reports are not business evidence |
| R-22 | Absolute runtime/release evidence retained | Release/flag snapshots tested; full per-session experiment exposure remains UNVERIFIED, no experiment activated |
| R-23 | Feedback now submitted via UI and inspected separately in PostgreSQL | UI assertion, backend scope/privacy regressions |
| R-24/25 | Manager exceptions/Data Health dedicated views remain DEFERRED P1 | Existing scoped list usable; no dashboard acceptance claim |
| R-28 | Immutable classification and explicit synthetic/all/unknown paths retained | UI filtering and business-learning exclusion; synthetic automation timings recorded separately |

Synthetic usability scenarios and anonymous measurement worksheet are authored but NOT RUN by Sales participants. No observed adoption/value or real-customer approval follows from browser automation.

Final exact implementation revision ce01a59: all17 local lanes PASS and hosted71 product/browserSUCCESS. Gate A passed in tested scope; Gate B actual pilot environment/operator acceptance still conditional, Gate C NOT READY FOR REAL CUSTOMER DATA. Human Sales worksheet remains NOT RUN.
