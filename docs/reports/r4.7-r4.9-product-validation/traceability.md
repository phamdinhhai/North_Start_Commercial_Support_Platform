# R-01 through R-28 integration traceability

This updates, without overwriting, R4 traceability.md and R4.6 assessments. Implementation, automated checks and human/business acceptance remain different. Final commands/revision/results: verification.json. Existing interim ADRs remain authoritative; no open decision is resolved here. R-29 through R-41 remain separate proposed productization backlog.

| Requirement | Implementation / verification evidence | Limit |
|---|---|---|
| R-01 Workspace isolation | Per-request membership, scoped PG; new manager relation scoping, independent browser contexts; lead-access and OIDC suites | Exercised negatives, not universal proof |
| R-02 Authentication | Existing signed OIDC/cookie; actual session expiry/new-tab recovery in r47-acceptance | Fixture IdP only; deployed IdP/TLS not accepted |
| R-03 RBAC | Existing role/owner/recipient policy; manager HTTP/PG, role downgrade recovery tests | No new grant/permission boundary |
| R-04 Manual/synthetic input | UI-only intake; server synthetic guard plus signed400 and DB count invariance | Invented-only user discipline still required |
| R-05 Envelope | Existing immutable metadata/HMAC versions; full content-digest regressions | No legacy rewrite or production custody claim |
| R-06 Idempotency | Existing intake uniqueness/receipts; retry regression suites | Live providers deferred |
| R-07 Stable Lead ID | UI full journey/app and process restart, retained PG history | Customer/lead not merged |
| R-08 Assignment/acceptance | Existing UI handoff/accept; manager flags unowned/pending/ineligible | No invented reassignment state machine |
| R-09 Editable context | Append revisions; signed409 review/retry and held401 draft tests | Comprehension human NOT RUN |
| R-10 Source/lineage/attribution | R4.6 source UI retained, new truth guide, evidence/claims/UNKNOWN distinct | Attribution remains UNKNOWN; no full acquisition engine |
| R-11 Handoff | Full signed owner/recipient journey and audit; manager pending view | Waiting age is not SLA violation |
| R-12 Contact history | Existing R4.6 manual contact claims with actor/channel/time/evidence; signed journey | Claims not independent contact proof |
| R-13 Action lifecycle | Signed create/reschedule/complete/reopen; stale legacy browser test updated to explicit discard | Internal overdue only; external expectations distinct |
| R-14 State machine | Existing interim transitions and full regression | BLOCKED-BY CE-1 for final canonical table |
| R-15 Outcome | Signed claimed outcome/correction/audit | No revenue confirmation |
| R-16 Assertion provenance | Existing transactional outbox/inbox tests retained | At-least-once; runner guard retained |
| R-17 UNKNOWN | Missing evidence response, source/context sentinels and manager observations tested | Missing truth never synthesized |
| R-18 Durability/lifecycle | PG22 suites; bounded pool/transaction/migration failure; actual local dump/restore and outage recovery | Full retention/erasure/holds/backup expiry NOT IMPLEMENTED |
| R-19 Append audit | Existing timeline/export/access/rollback tests; restart readback | No historical mutation or erasure |
| R-20 AI draft-only | Existing governed-action/domain regression; manual journey | Autonomous execution disabled |
| R-21 Telemetry | Existing LearningController authorization/categorical negatives; synthetic/unknown excluded; private observation validator | No actual Sales measurements; no synthetic production learning |
| R-22 Version/exposure | Existing event releaseVersion0.1.0 and flag snapshot; research schemaVersion1 | Session assignment/exposure and separate persisted product event schema version remain incomplete |
| R-23 Feedback | Existing scoped UI/service feedback; signed full journey | Business value NOT VALIDATED |
| R-24 Manager exceptions | New application/PG/API/operator manager asset; manager role and page/classification tests | Bounded page observations only, not global totals/dashboard |
| R-25 Data Health | Honest unavailable-source/context observations | Comprehensive linkage/coverage view DEFERRED |
| R-26 Pancake read sync | Existing flagged-OFF contracts and MV3 smoke | Production sync DEFERRED |
| R-27 Adapter integrity | Existing digest/idempotency/redaction/architecture checks retained | No live contract/production permission acceptance |
| R-28 Segregation | Forced local mode, startup history refusal, API guard/UI marker, telemetry exclusion | Cannot classify truth of free text entered by operator |

## Security-critical behavior evidence

| Behavior | Concrete automated evidence |
|---|---|
| Cross-workspace/IDOR/read-only viewer | OIDC browser negatives; lead-access PG and signed auth HTTP suites |
| Manager/admin supervisory read; sales denied | manager-exceptions.http.spec.ts, pg-manager-exceptions.integration.spec.ts, r47-acceptance browser |
| Expired session/CSRF/role downgrade | Signed401/new-tab OIDC/403; operator-recovery component user/workspace/role mismatch |
| Synthetic anti-bypass and no write effects | synthetic-pilot-mode.spec.ts; actual signed400 plus unchanged DB counts; runtime false-history refusal |
| Secret/digest/raw output privacy | r47-privacy-adversarial.spec.ts; existing HMAC/content-digest/telemetry tests; missing-evidence field filtering |
| Pool/backend failure and rollback | pilot-resilience.integration.spec.ts plus actual private cluster fast-stop/manual recovery |
| Retry/replay/duplicate effects | Existing assertion-delivery and governed-action PostgreSQL suites; outbox production guard retained |

These checks cover named cases, not 100% of every security-critical path. Enterprise IdP, real-data lifecycle and deployment acceptance remain NOT VERIFIED. Human study and commercial benefit remain NOT RUN / NOT VALIDATED.
