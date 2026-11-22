# R4.11 independent architecture review

Baseline `5181aba2b325fb12fdb4a54b04783f23b4133d69`; review 2026-11-20. Read AGENTS, canonical invariants/open decisions, ADR-005 through ADR-009, R4.10 implementation/release evidence and R4.7 pilot environment evidence. This review changes reports only. Tests mentioned below were read, not locally executed by this reviewer; exact hosted CI is separately documented in branch-and-pr-strategy.md. Root owns fresh baseline verification.

## Boundary inventory

| Surface | Source evidence | Classification and implication |
|---|---|---|
| Synthetic enablement | `infra/source-integration/synthetic-source-mode.ts`, `scripts/pilot-loop.module.ts` | VERIFIED guard: default off; explicit true requires local/test, non-production, OIDC and PostgreSQL. Never a live enablement gate. |
| API and tenancy | `api/source-integration.controller.ts`, `application/source-integration/source-integration.service.ts`, `fixture-intake.ts` | VERIFIED: current authenticated admin/workspace selects connection and decoder before intake; read evidence delegates to existing lead authorization. Controller exposes bounded categorical errors and no-store headers. |
| Durable intake | `infra/source-integration/pg-source-integration.store.ts` | VERIFIED source structure: transaction includes connection scope check/row lock, receipt collision check, native event/message advisory locks, envelope, optional lead seed, mapping, receipt and audit. SQL is parameterized. |
| Native alignment | same store; `ports/source-observation.ts` | DESIGN LIMIT: supplied native system/page/message keys align fabricated objects across routes. Transport connection and native identity are separate. Caller-supplied fixture identifiers do not prove cross-provider authority. `object_aligned` is not a verified duplicate event, customer identity, or commercial continuity decision. |
| Episode construction | same store | DESIGN LIMIT: first distinct native message seeds an unassigned Lead; messages sharing a conversation remain separate seeds. Conversation != Lead; this fixture policy is not a production episode segmentation policy. |
| UNKNOWN and raw evidence | same store/service | VERIFIED: missing native identity is quarantined without raw envelope or lead; accepted route receipts retain separate immutable envelopes; evidence returns UNVERIFIED/UNKNOWN. LVP attribution stays unknown. No payload text identity merge is present in inspected path. |
| Responsibility | service/store `claimResponsibility` | DESIGN LIMIT: explicit synthetic admin claim sets owner only at seed creation. It must not be reused as authority for live provider ingestion or automatic assignment. |
| Identity and membership | `infra/auth/auth.service.ts`, `application/membership/membership-admin.ts` | VERIFIED inspected seams: OIDC uses verified lookup; demo is sandboxed; membership API requires admin/internal UUID, workspace-scoped targets and blocks self changes. Full OIDC verifier/runtime revocation audit was outside this focused pass. |
| Logging | `infra/observability/json-logger.ts`, `redaction.ts`, `http-observability.ts`; telemetry service | Source/test inventory shows allowlist redaction and bounded telemetry sanitization. NOT VERIFIED: comprehensive log leakage absence across every adapter/runtime path; do not advertise a full security certification. |
| Pilot root | `scripts/pilot-loop.module.ts`; R4.7 pilot readiness report | Existing synthetic-only pilot and source flag are separate policies. Prior report describes owned local loopback resources, fixture IdP, forced synthetic admission, stopped handover. NOT VERIFIED in this pass: current process state, owner manifest or database contents; no pilot resources were accessed. |

## Findings by decision class

**VERIFIED DEFECT:** none independently reproduced in this documentation-only pass. This is not a claim of defect absence. Collision/rollback/restart coverage in `source-intake.integration.spec.ts` is read-test evidence only here; root's baseline run and CI provide execution evidence.

**SECURITY BEFORE LIVE:** a future live route must establish authoritative provider/account/object binding at a trusted server boundary, connector service identity limited to append, revocation and cross-tenant denial, and immutable provenance of authority. A normalized provider id supplied by an operator/browser or inherited from a transport adapter is insufficient. Keep fixture intake isolated rather than relabeling it live. Admin synthetic admission is explicitly a test convenience under ADR-007, not an exception to ADR-006's connector ingestion model.

**DESIGN LIMIT:** message-level alignment preserves object evidence, not trusted customer/lead identity. Native event collision checks protect supplied identifiers within synthetic fixtures; they do not establish upstream authenticity, completeness, or causal attribution. Retain UNVERIFIED and UNKNOWN until actual evidence justifies promotion.

**PERFORMANCE HYPOTHESES:** connection row locking serializes intake for a connection; native object history scans/materialization and aggregate connection health queries may grow with history. These are source-derived hypotheses, not measured regressions or justification for weakening transactional integrity. Obtain workload, query plan, lock-wait and latency evidence before tuning.

**PRODUCT DECISIONS:** production conversation-to-episode mapping, reconciliation/linkage confidence and merge mechanics remain owner/domain work (I-01/I-06/I-07, ID-1). CE-1 state transitions and ID-2 CRM mapping remain unresolved. ADR-005 resolves CE-2; ADR-006 resolves PM-1; ADR-007 resolves LG-1; ADR-008 resolves MM-1. The supplied session instructions list seven open decisions while frozen repository canonical supersession records three remaining: preserve the normative supersession and disclose the discrepancy; do not edit canonical files.

**NOT VERIFIED:** real provider rights/tokens, webhook signatures, tenant provisioning in an external IdP, live data handling, production retention/backup, adoption/value, human pilot gates and external performance SLO. No conclusion about these follows from green synthetic CI.

## Independent review acceptance conditions

R4.11 changes must preserve immutable accepted raw evidence, technical receipt/assertion separation (ADR-005), draft-only AI, explicit uncertainty, lead-scoped authorization and unknown LVP attribution. Prefer additive authority/provenance validation at ingress; never infer identity from text, timestamps, conversation labels or fixture account selection. Do not add canonical state transitions, automatic merges, outbound catalog entries, migrations or enable live capabilities through this report. Review actual final diff and new negative-test evidence before accepting critical implementation changes.
