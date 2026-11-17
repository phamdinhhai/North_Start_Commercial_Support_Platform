# Architecture baseline and readiness assessment

Reviewed 2026-11-17. Delivery-tier assessment; no canonical decisions are changed.

## Evidence boundary

Read order: `origin/main` **5d6c20673218f02c0972263126e8654eadee18c9** first (including its historical handover), decision-demand checkpoint **12aabd1d645e30d6b7fa0acc03758c66b4de3453**, then adaptive checkpoint **c9c2de814d0bc7bec9e74a918a51d6a7a16067b2**. Baseline source references below are at c9c2de8 unless stated otherwise. Reviewed integration fix **70c28ec0a168a565d57551d371bab4ff5e2a4885** separately through `git show`. These branches are not merged into origin/main. The historical handover describes 6a98fdf and must not be used as a measurement of these checkpoints.

Evidence labels: **Confirmed** = directly inspected source/diff; **Inferred** = consequence derived from inspected control flow, not reproduced; **Unknown** = no suitable execution/customer evidence in this review. No percentage completion or production certification follows from source presence.

Canonical review covers README, PRODUCT_CONSTITUTION, DOMAIN_MODEL, DOMAIN_INVARIANTS, ARCHITECTURE_CONSTITUTION, COMMERCIAL_EVENT_MODEL, IDENTITY_MODEL, MEASUREMENT_MODEL, TRUST_AND_EVIDENCE, INTEGRATION_PRINCIPLES, GLOSSARY, OPEN_DECISIONS. Requirements and phase map are delivery interpretation; canonical wins on conflict. Key authorities: `docs/canonical/README.md:22`, `DOMAIN_INVARIANTS.md:12`, `ARCHITECTURE_CONSTITUTION.md:13`, `OPEN_DECISIONS.md:21`.

## Verdict

**Suitable modular-monolith baseline for controlled synthetic/manual iteration; not production-ready for real commercial data.** A single Nest/Fastify composition root, framework-independent domain functions, explicit application/ports/adapter/infra boundaries, immutable inbound evidence, stable Lead IDs and transactionally audited persistence support incremental development without a microservice rewrite. Architecture suitability is distinct from acceptance of permissions, operational controls, external contracts or product value.

Origin/main remains the older baseline. Decision-demand adds operator workflow/read projections, normalizers and source/asset registries (81 files changed against main); adaptive adds research artifacts and observer/companion experiments (45 files against decision-demand). Neither research breadth nor registry entries prove live authorized production integration.

## Repository map and workflow trace

| Layer | Owned responsibility and inspected entry |
|---|---|
| `product/src/domain/` | Customer/Lead separation, envelope hashing, handoff, outcome, UNKNOWN, draft CE; `domain/lead/lead.ts:28`, `domain/commercial-event/commercial-event.ts:4` |
| `product/src/application/pilot/` | Manual intake and human commands; `ingest-scenario.command.ts:11`, `pilot-loop.service.ts:91`, `work-mutation-policy.ts:90` |
| `product/src/ports/` | Store, auth, RBAC, telemetry, research receipt contracts; `pilot-loop.store.ts`, `research-receipt.port.ts` |
| `product/src/api/` | Validated JSON boundaries and operator HTML; `pilot-loop.controller.ts:139`, `feedback-telemetry.controller.ts:22`, `operator-client.ts` |
| `product/src/infra/` | PostgreSQL/migrations, memory store, authentication and authorization implementations; `postgres/pg-pilot.store.ts:38`, `auth/auth.service.ts:36` |
| `product/src/adapters/` | Manual and Pancake transports plus isolated decision-demand/adaptive/companion experiments; `pancake/pancake-adapter.ts:61` |
| `product/src/scripts/` | Nest composition roots and migration runner; `pilot-loop.module.ts:15` |
| `product/e2e/`, `scripts/`, `.github/` | Acceptance and architecture/registry checks; `scripts/check-architecture.mjs:19` enforces dependency direction |

1. Manual scenario -> application intake -> versioned immutable envelope + separate stable Lead -> store. PostgreSQL idempotency uses envelope lookup (`pg-pilot.store.ts:132`); version compare-and-swap (`:231-258`) and state/audit transaction protect concurrent writes. This closes the old handover's missing optimistic-locking item at the inspected checkpoint.
2. Owner creates handoff/evidence + proposed work (`pilot-loop.service.ts:99-173`); assigned recipient accepts (`:187-222`), which transfers ownership. Mutable work requires both current ownership and item assignment (`work-mutation-policy.ts:90`). Visibility does not itself grant mutation.
3. Completion requires observed system evidence or confirmed human declaration (`pilot-loop.service.ts:266-305`). Inferred/absent/conflicted cannot close. Unknown occurred time remains UNKNOWN (`:315`). Declared is a work construct, not a replacement canonical assertion vocabulary.
4. Human stage advance uses CE-1 hypothesis (`domain/lead/lead-state.ts:3-16`); outcome is user_confirmed/claimed, correction appends (`pilot-loop.service.ts:410-469`). Won does not prove revenue or attribution.
5. Research observers/receipts remain external observations. Receipt/checkpoint progress must never create Lead transitions or CE assertions implicitly. New signed local/test enrollment is reviewed separately when its exact commit is available.

## Requirement evidence matrix

Requirement source line is in `docs/implementation-plan/03-requirements.md`; implementation paths are relative to `product/src/`. Status describes inspected support, not full acceptance.

| Requirement / source line | Evidence | Assessment |
|---|---|---|
| R-01 :13 | `infra/auth/auth.service.ts:48`; `api/pilot-loop.controller.ts` workspace checks | Confirmed isolation mechanisms; real-data deployment Unknown |
| R-02 :22 | `infra/auth/auth.service.ts:68-80` | Confirmed bounded bootstrap/dev stub; production identity model absent |
| R-03 :31 | `application/pilot/work-mutation-policy.ts:90`; `infra/rbac/rbac.service.ts` | Confirmed item/owner guards; feedback and queue gaps below |
| R-04 :44 | `application/pilot/ingest-scenario.command.ts:11` | Confirmed manual scenario intake; full CSV lifecycle Unknown |
| R-05 :53; R-06 :62 | `domain/envelope/envelope.ts`; `infra/postgres/pg-pilot.store.ts:132` | Confirmed envelopes/idempotency implementation; no new runtime proof |
| R-07 :75 | `domain/lead/lead.ts:28-38` | Confirmed stable separate IDs/types; identity resolution remains deferred |
| R-08 :84 | `application/pilot/pilot-loop.service.ts:187-222` | Confirmed acceptance/ownership; reassignment stranding Inferred |
| R-09 :93; R-11 :112 | `application/pilot/pilot-loop.service.ts:129-155` | Confirmed context and evidence package; summary edit UX Unknown |
| R-10 :103 | `domain/lead/lead.ts:33-38` | Confirmed distinct source/lineage/UNKNOWN attribution |
| R-12 :121 | `application/pilot/pilot-loop.service.ts:250` | Partial work completion; dedicated contact-attempt acceptance Unknown |
| R-13 :130 | `application/pilot/pilot-loop.service.ts:346`; `api/pilot-loop.controller.ts:139` | Confirmed reschedule/queue primitives; stale work gap |
| R-14 :140 | `domain/lead/lead-state.ts:3-16` | Confirmed hypothesis only; CE-1 gate open |
| R-15 :155 | `application/pilot/pilot-loop.service.ts:410-469` | Confirmed claim/correction; open-action closure guard absent |
| R-16 :165 | `domain/commercial-event/commercial-event.ts:47` | Confirmed provenance types; vocabulary reconciliation required |
| R-17 :174 | `domain/unknown-states/unknown-states.ts`; `pilot-loop.service.ts:315` | Confirmed explicit unknown handling |
| R-18 :183 | `infra/postgres/pg-pilot.store.ts:231-258,288-314` | Confirmed durable transaction/CAS code; completion fields incomplete |
| R-19 :199 | `infra/postgres/pg-pilot.store.ts:167,342` | Confirmed lead-scoped history/audit transaction |
| R-20 :208 | `domain/commercial-event/commercial-event.ts:4,159` | Confirmed draft seam; no autonomous AI path identified; CE-2 open |
| R-21 :223; R-22 :232 | `api/feedback-telemetry.controller.ts:46-73` | Confirmed explicit event/exposure API; command coverage incomplete |
| R-23 :241 | `api/feedback-telemetry.controller.ts:22-43` | Confirmed feedback wiring; lead-scoped read policy gap |
| R-24 :250 | `api/pilot-loop.controller.ts:139` | Queue available; full manager exception acceptance Unknown |
| R-25 :259 | `domain/lead/lead.ts:38` | Unknown preserved; per-source deterministic/inferred/unknown health view Unknown |
| R-26 :272; R-27 :283 | `adapters/pancake/pancake-adapter.ts:61,131` | Confirmed adapter/retry boundary; production transport/permission proof Unknown |
| R-28 :293 | envelope `isSynthetic`, auth demo prefix `infra/auth/auth.service.ts:14,48` | Confirmed labels/sandbox; full real-vs-synthetic analytical exclusion Unknown |

R-29..R-41 are deferred proposals (`03-requirements.md:331`), not current scope or permission to build control plane/licensing.

## Findings and verification required

| ID / severity | Evidence and impact | Fix scope / acceptance evidence |
|---|---|---|
| A1 High, Confirmed | Feedback GET returns all workspace feedback (`api/feedback-telemetry.controller.ts:39-43`), with no lead scope or actor filtering. Lead-linked text can cross Sales assignments. POST also passes arbitrary leadId after shape validation. | Apply existing frozen lead scope to linked feedback, validate linkage; do not invent PM-1 manager rights. Verify unrelated Sales cannot submit/read another lead, cross-workspace denied, permitted owner retains access. |
| A2 High, Confirmed divergence | PG queue allows historical `w.actor` (`infra/postgres/pg-pilot.store.ts:96-98`); memory requires actionable assignment at lead level (`infra/pilot/in-memory-pilot.store.ts:146`). Former recipient can retain PG rows after losing lead access; active recipients see different sets between stores. | One shared explicit existing visibility rule; contract suite across memory/PG for proposed, accepted, closed, superseded and reassigned cases. |
| A3 High, Confirmed | Completion writes declaration/confirmed (`application/pilot/pilot-loop.service.ts:317-318`) but PG SELECT/INSERT omits them (`infra/postgres/pg-pilot.store.ts:61-62,288-314`; mapper `repositories/pilot-persistence.types.ts:141`). Restart loses claim details in projection, although audit retains them. | Forward migration/mapper persistence; PG complete -> reload/restart asserts declaration, confirmation, evidence basis and UNKNOWN occurredAt; rollback evidence. |
| A4 High, Inferred | Acceptance changes lead owner, leaves older accepted item actor unchanged (`pilot-loop.service.ts:220-222`); owner+item guard (`work-mutation-policy.ts:90`) then lets neither old nor new owner complete it. | Explicit human-reviewed handling of stale work consistent with existing permissions; reproduce A->B accept then B->C accept and prove no silent ownership expansion or abandoned task. |
| A5 High before real data, Confirmed | Unsigned token is local/test only, rejected production (`infra/auth/auth.service.ts:74-80`); bootstrap remains seed hook. This is a useful restriction, not real user authentication. | PM-1 credential decision, signed/verified identity, revocation/expiry and operational secret controls before real data. Enrollment signing for research does not solve app authentication. |
| A6 Medium, Confirmed | Telemetry API wired (`feedback-telemetry.controller.ts:46`), but command controller has no telemetry calls; complete learning funnel/exposure coverage is unproven. | Record allowlisted behavior at intended actions, correct release/exposure, no raw PII/token; demonstrate missing/error cases and measured learning loop. |
| A7 High before commercial use, Confirmed | `recordOutcome` transitions directly without checking active work (`pilot-loop.service.ts:410-436`). | Address planned open-action gate with CE-1 seam retained; tests Won/Lost refusal while active work remains and permitted Unknown behavior. |
| A8 Medium, Confirmed | CE acquisition/status enums (`domain/commercial-event/commercial-event.ts:38-41`) differ from canonical trust dimensions (`docs/canonical/TRUST_AND_EVIDENCE.md:22-25`). | Reconcile explicitly through delivery schema/ADR review; do not generalize CE-2 or relabel observations as truth. |

## Independent operator fix review

70c28ec is sound in scope: adds buttons for **existing** Contacting/Follow-up endpoint, mutation in-flight guard and resets queue cursor. Test waits for actual advance/outcome responses and checks persisted Won with claimed status. It neither expands transition graph nor grants permissions. The earlier stale success-message assertion was insufficient; this patch addresses that weakness. This is source/diff review, not independent browser execution. UX still shows actions whose applicability is rejected by server; not a security expansion.

## Milestones

**Before expansion:** resolve A1-A4 and A8 with store-parity/PG restart tests; run typecheck, tests, build, architecture and registry checks on integrated SHA; preserve canonical diff and seven seams. Keep connector receipt/checkpoint experiment local/test, signed and tenant/page bounded, atomic receipt/checkpoint, explicit UNKNOWN, disabled by default. No canonical mutation from connectivity evidence.

**Before commercial/real-data use:** credential and permissions human review; close persistence/migration and Pancake spike gates; address A5/A7, export/deletion/retention, encryption/secret custody, restore drill, deployment rollback and operational visibility. Obtain actual user learning evidence for L1-L5 rather than substituting test counts.

**Before scale:** demonstrate load/backlog and failure bottlenecks; bound retries/rate limits/DLQ per connection; capacity and recovery objectives; choose independent scaling only from measured ownership/reliability needs. Preserve modular monolith until evidence justifies extraction. Productization requirements remain separately gated.

## Validation and limitations

Executed `npm test -- --reporter=dot` in isolated A worktree at c9c2de8: exit 1 because dependencies absent (`vitest` not recognized); no assertions ran. No dependency installation, PostgreSQL, browser, coverage or live provider test was performed by this reviewer. Read-only integration comparison was at 70c28ec. Root integration validation and D/E exact commits must supplement this report; their eventual implementation cannot be certified prospectively here. Canonical/forbidden paths unchanged by this report-only work.
