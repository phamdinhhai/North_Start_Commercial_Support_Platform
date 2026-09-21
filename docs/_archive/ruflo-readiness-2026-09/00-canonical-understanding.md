# Phase 0 - Canonical Understanding

## 1. Product identity

**What the product is:** The North_Start_Commercial_Support_Platform is a **Revenue Continuity / Closed-loop Revenue Platform** (docs/canonical/PRODUCT_CONSTITUTION.md:15). Its core promise is preserving commercial meaning from acquisition through conversation, lead, Marketing->Sales handoff, Sales action, outcome, revenue, attribution and learning back to acquisition (docs/canonical/PRODUCT_CONSTITUTION.md:39). The current LVP promise under test is narrower: *When receiving a lead, Sales can quickly understand what the customer needs, inspect original evidence, and know the next action without relying on memory* (docs/canonical/PRODUCT_CONSTITUTION.md:24).

**What the product is explicitly not:** It is not a unified social inbox, a full enterprise CRM, ERP/POS, generic task manager, generic BI/report builder, generic chatbot, generic call-transcription, or generic enrichment platform (docs/canonical/PRODUCT_CONSTITUTION.md:51). It does not rebuild the giants (Pancake, Twenty, HubSpot, Salesforce, Ad platforms); it sits between them (docs/canonical/PRODUCT_CONSTITUTION.md:62).

## 2. Current phase vs North Star

**Current LVP / normative scope:** Single-tenant pilot with persistence; manual/synthetic input; lead handoff + Sales queue + evidence + next action + minimal outcome; audit/provenance + telemetry + structured feedback from day one; Pancake read-only feasibility spike in parallel (docs/canonical/PRODUCT_CONSTITUTION.md:49, docs/canonical/PRODUCT_CONSTITUTION.md:69). The architecture is a modular monolith with explicit seams; microservices are not an upfront decision (docs/canonical/ARCHITECTURE_CONSTITUTION.md:12). Attribution-record/revenue/opportunity complexity and automated identity merge are outside the LVP (docs/canonical/MEASUREMENT_MODEL.md:64, docs/canonical/IDENTITY_MODEL.md:37).

**Long-term five-engine / North Star direction:** The end-state vision is the closed-loop Revenue Continuity Platform: Acquisition Intelligence -> Conversation Intelligence -> Commercial Continuity -> Revenue Execution -> Revenue Intelligence, feeding back to acquisition (docs/canonical/PRODUCT_CONSTITUTION.md:39, docs/north-star/NORTH_STAR.md). This is strategic direction: the canonical layer keeps North Star separate from current implementation scope (docs/canonical/PRODUCT_CONSTITUTION.md:79, docs/canonical/README.md:23).

## 3. Frozen invariants

The twelve frozen architecture-domain invariants below are normative. Each is exact-cited with `docs/canonical/**` file:line and is a hard constraint that implementation must honor.

| Invariant | Frozen meaning | Exact canonical source (file:line) | Engineering implication |
|---|---|---|---|
| I-01 | Customer and Lead are separate concepts; one Customer may have many Leads. | `docs/canonical/DOMAIN_INVARIANTS.md:16` | Never collapse entities/tables; schema must preserve separate identity join (CustomerRef vs LeadRef). |
| I-02 | Conversation Source, Acquisition Lineage, and Revenue Attribution are three distinct concepts and must not collapse. | `docs/canonical/DOMAIN_INVARIANTS.md:22` | Model three explicit separate records; never one combined source field. |
| I-03 | AI interpretation must not directly and opaquely mutate canonical commercial state. | `docs/canonical/DOMAIN_INVARIANTS.md:31` | AI may draft; policy/governance must gate any actual state change. |
| I-04 | Inferred changes must first become a Commercial Event with evidence, confidence, timestamp, and audit. | `docs/canonical/DOMAIN_INVARIANTS.md:37` | Every inference must materialize as a CommercialEvent before any state mutation. |
| I-05 | Important automated actions are explainable and auditable; audit is append-only and reversible. | `docs/canonical/DOMAIN_INVARIANTS.md:43` | Append-audit important mutations with previous/new values + undo. |
| I-06 | Identity merges require evidence, confidence, and reversibility / undo; no silent merges. | `docs/canonical/DOMAIN_INVARIANTS.md:49` | Every merge/unmerge is audited and reversible; automated merge is deferred. |
| I-07 | Stable Lead identity survives channel transitions and downstream handoff. | `docs/canonical/DOMAIN_INVARIANTS.md:55` | Stable Lead ID is canonical join; never external/vendor conversation ID. |
| I-08 | UNKNOWN / uncertain linkage remains visible; honest unknown is a valid product/data state. | `docs/canonical/DOMAIN_INVARIANTS.md:61` | Surface deterministic/inferred/unknown separately; do not backfill assumptions. |
| I-09 | Sales access is scoped to assigned customer/lead context, not to the entire social inbox. | `docs/canonical/DOMAIN_INVARIANTS.md:67` | Lead-scoped access; never implicit whole-inbox scope. |
| I-10 | CRM adapters do not own canonical commercial semantics. | `docs/canonical/DOMAIN_INVARIANTS.md:73` | Platform stays authoritative for meanings/outcomes; adapters pass through, never canonicalize. |
| I-11 | External providers are integration boundaries, not the core domain. | `docs/canonical/DOMAIN_INVARIANTS.md:79` | Anti-corruption adapters; platform does not inherit external semantics. |
| I-12 | Raw evidence is preserved and stored immutable; UNKNOWN is a valid state. | `docs/canonical/DOMAIN_INVARIANTS.md:85` | Preserve raw envelopes unchanged; keep explicit UNKNOWN states. |


**Repository name observation:** Current repository name: `North_Start_Commercial_Support_Platform`. Whether "Start" is intentional or a historical typo of "Star": NEEDS_EVIDENCE. No rename was performed.

> Canonical authority note: docs/canonical/README.md:3 (canonical files are normative), docs/canonical/README.md:22 (do not resolve conflicts or OPEN_DECISIONS yourself).

## 4. Integration boundaries

- **Pancake:** Primary conversation/customer evidence source for the LVP. The platform owns interaction evidence, handoff context, continuity, and intelligence; Pancake retains conversation operations and inbox (docs/canonical/PRODUCT_CONSTITUTION.md:62, docs/canonical/INTEGRATION_PRINCIPLES.md:27, docs/canonical/ARCHITECTURE_CONSTITUTION.md:53). Pancake objects are never used directly as the canonical Lead/outcome model (docs/canonical/ARCHITECTURE_CONSTITUTION.md:53).
- **Ad platforms (Meta/TikTok/Google/...):** The platform owns the Acquisition Hub (acquisition lineage, source resolution). Spend/campaign/ad/creative remains external truth (docs/canonical/PRODUCT_CONSTITUTION.md:62, docs/canonical/GLOSSARY.md:47, docs/canonical/ARCHITECTURE_CONSTITUTION.md:54).
- **Phone/Zalo/other sales channels:** The platform owns activity/outcome claims and handoff context; the channel owner owns delivery (docs/canonical/PRODUCT_CONSTITUTION.md:62, docs/canonical/GLOSSARY.md:48, docs/canonical/ARCHITECTURE_CONSTITUTION.md:58).
- **CRM systems (Twenty, HubSpot, Salesforce,...):** CRM is an integration boundary only; the platform remains authoritative for commercial continuity, evidence/provenance, and attribution (docs/canonical/PRODUCT_CONSTITUTION.md:62, docs/canonical/ARCHITECTURE_CONSTITUTION.md:53). When a mature CRM exists, it may own Account/Contact/Opportunity records; the platform is a layer, never a CRM clone (docs/canonical/ARCHITECTURE_CONSTITUTION.md:62).
- **Manual/synthetic adapters:** First-class P0 adapters for dev/demo/fallback; not treated as real customer evidence unless used in a registered experiment (docs/canonical/ARCHITECTURE_CONSTITUTION.md:47, docs/canonical/INTEGRATION_PRINCIPLES.md:29).

## 5. AI / truth boundary

The canonical pipeline is:

Interaction -> AI interpretation -> Commercial Event -> Evidence -> Policy -> Action

This prevents opaque AI mutation because: the LLM must never write directly and opaquely into CRM-like fields (docs/canonical/COMMERCIAL_EVENT_MODEL.md:20). A Commercial Event is the only sanctioned primitive for inferred meaning to affect canonical state; it carries identity, event type, source interaction reference, evidence, confidence, suggested mutation, previous/new values, and audit/undo (docs/canonical/COMMERCIAL_EVENT_MODEL.md:34, docs/canonical/DOMAIN_INVARIANTS.md:37). Execution is governed by policy (human confirmation, draft-by-default for high-impact/ambiguous truth, auto-accept only when confidence is high and policy permits), and the manual product loop must work when AI is disabled, unavailable, or wrong (docs/canonical/COMMERCIAL_EVENT_MODEL.md:69). AI drafts context/needs/objections/commitments/next actions; humans govern truth (docs/canonical/TRUST_AND_EVIDENCE.md:74).

## 6. Trust / provenance model

- **Acquisition mode:** how the claim was acquired: automatic_observation / user_confirmed / imported_record / inferred / unknown (docs/canonical/TRUST_AND_EVIDENCE.md:22).
- **Assertion status:** the claim strength: recorded / claimed / inferred / conflicted / unknown (docs/canonical/TRUST_AND_EVIDENCE.md:23).
- **Evidence:** every commercial assertion carries a pointer to raw immutable evidence (or explicit reason none exists) (docs/canonical/COMMERCIAL_EVENT_MODEL.md:63, docs/canonical/TRUST_AND_EVIDENCE.md:34).
- **Confidence:** applies only to inference, must include producer/model/rule version plus calibration/rationale (docs/canonical/TRUST_AND_EVIDENCE.md:24, docs/canonical/TRUST_AND_EVIDENCE.md:30).
- **Append audit:** important mutations are append-audited and reversible; corrections append assertions rather than overwrite (docs/canonical/TRUST_AND_EVIDENCE.md:58, docs/canonical/TRUST_AND_EVIDENCE.md:63).
- **Reversibility:** every merge/unmerge is auditable and reversible; undo exists (docs/canonical/TRUST_AND_EVIDENCE.md:63, docs/canonical/DOMAIN_INVARIANTS.md:49).
- **UNKNOWN:** unknown / missing / not_applicable are distinct truth states and must stay visible; never backfill with assumptions (docs/canonical/TRUST_AND_EVIDENCE.md:69, docs/canonical/MEASUREMENT_MODEL.md:38).

## 7. Open decisions

| ID | Decision | What implementation must do |
|---|---|---|
| CE-1 | Commercial Event <-> Commercial State transition table. | Do not invent a transition table; raise an RFC. |
| CE-2 | Commercial Event scope (inferred-only vs generalized). | Do not assume either model until RFC. |
| MM-1 | Attribution model (first/last/multi-touch/...). | Keep Revenue Attribution UNKNOWN + explicit unknown_reason. |
| ID-1 | Identity merge thresholds / undo mechanics. | No automated merge before RFC. |
| ID-2 | Field mapping for Twenty / external CRM. | No production mapping before verified feasibility spike + RFC. |
| PM-1 | Detailed permissions beyond frozen boundary. | Enforce only frozen boundary; abort on privilege expansion. |
| LG-1 | North Star aspiration vs LVP scope conflict. | Preserve both: North Star as reference, canonical + phase docs as current scope. |

> **Human reviewer note:** These are OPEN_DECISIONS. Do NOT resolve them. When one is required, STOP and file an RFC (canonical authority hierarchy: docs/canonical/README.md:22). No OPEN_DECISION was resolved in this report.

## 8. Authority hierarchy

1. **Tier 1 - Normative:** docs/canonical/** is the authoritative product truth and outranks all generated prompts, memory, agent config, runtime defaults, and tooling conventions (docs/canonical/README.md:3).
2. **Tier 2 - Strategic:** docs/north-star/** provides long-term direction only; North Star is not automatically current implementation scope (docs/canonical/README.md:23, docs/canonical/PRODUCT_CONSTITUTION.md:79).
3. **Tier 3 - Delivery:** docs/delivery/** stories/contracts derived from canonical truth.
4. **Tier 4 - Research/historical:** docs/research/**, docs/project/**, archived plans, Bernstein material - evidence/context only unless explicitly elevated.
5. **Tier 5 - Engineering assets:** templates/** reusable assets, not active runtime policy.
6. **Tier 6 - Generated config:** AGENTS.md, .agents/**, .claude-flow/**, .codex/**, Ruflo/Bernstein/9Router configs, MCP registrations - must conform to higher layers.

## 9. Ambiguities / NEEDS_EVIDENCE

- **Phase 0 does not authorize runtime claims.** Ruflo runtime truth (health, model-routing, truncation, Bernstein status) requires runtime evidence in Phase 1A/1B.
- **Bernstein status:** treat as LEGACY unless runtime/repository evidence shows active.
- **AGENTS.md truncation behavior:** measure current byte size and verify with runtime evidence in Phase 1; do not assume a remembered size limit.
- **Model-routing ownership:** which component owns main/subagent model selection requires runtime evidence; Phase 0 does not authorize verification.

---

# Mandatory comprehension challenge (traps)

| Trap | Decision | Reason | Exact canonical source | Implementation may proceed |
|---|---|---|---|---|
| A | Reject merging Customer + Lead into one entity. | Customer != Lead is a frozen invariant (I-01). | docs/canonical/DOMAIN_INVARIANTS.md:16 | No. Model separately. |
| B | Reject using Pancake conversation ID as canonical Lead ID. | External/vendor IDs are adapter-scoped, not canonical. | docs/canonical/ARCHITECTURE_CONSTITUTION.md:53, docs/canonical/GLOSSARY.md:17 | No. Stable platform Lead ID required. |
| C | Reject direct LLM write to CRM-like state fields. | AI must not directly mutate canonical state; must become a Commercial Event first. | docs/canonical/DOMAIN_INVARIANTS.md:31, docs/canonical/DOMAIN_INVARIANTS.md:37 | No. Route through Commercial Event + policy. |
| D | Reject assigning last observed conversation channel as acquisition source. | Acquisition lineage and conversation source are distinct; UNKNOWN must stay visible. | docs/canonical/DOMAIN_INVARIANTS.md:22, docs/canonical/MEASUREMENT_MODEL.md:38 | No. Keep UNKNOWN + resolve independently. |
| E | Reject choosing first-touch vs last-touch revenue attribution now. | Attribution model is an OPEN_DECISION (MM-1), deferred beyond LVP. | docs/canonical/OPEN_DECISIONS.md:23, docs/canonical/MEASUREMENT_MODEL.md:64 | No. Keep Revenue Attribution UNKNOWN. |
| F | North Star presence alone does NOT authorize implementation. | North Star is strategic direction, not current scope. | docs/canonical/README.md:23, docs/canonical/PRODUCT_CONSTITUTION.md:79 | No. Implementation requires canonical scope + Human Gate. |

---

# Self-check table

| Question | Answer | Evidence | Confidence | Human reviewer status |
|---|---|---|---|---|
| All canonical files inspected? | Yes | docs/canonical/**: 12 files listed in Section 3 | High | PENDING |
| Current scope vs North Star separated? | Yes | Section 2 | High | PENDING |
| Critical invariants have exact file:line evidence? | Yes | Section 3 (I-01..I-12) | High | PENDING |
| All trap scenarios answered? | Yes | Section "Comprehension challenge" | High | PENDING |
| No OPEN_DECISION was resolved? | Yes | Section 7 states none resolved | High | PENDING |
| Canonical files not modified? | Yes | Mutation check below | High | PENDING |
| No unexpected mutation occurred? | Yes | Mutation check below | High | PENDING |
| Before/after mutation check recorded? | Yes | Evidence directory + below | High | PENDING |

Human reviewer status: **PENDING**.

---

# Mutation check

**Before (baseline):** docs/project/ruflo-readiness/00-canonical-understanding.md length measured; docs/canonical/** hashes recorded in evidence/baseline.md. Only docs/project/ruflo-readiness/evidence/** existed under the ruflo-readiness tree.

**After:** Only untracked files under docs/project/ruflo-readiness/**; no canonical file modified; no product source touched; no unexpected filesystem/config mutation.

---

# Unresolved questions

- Phase 1A/1B runtime evidence is pending; this report is purely canonical understanding.
- Bernstein runtime status is unknown and deferred to Phase 1A/1B.
- Effective AGENTS.md truncation behavior is unknown until runtime verification.
- Model-routing ownership requires runtime evidence.

---

# Exit criteria

| Criterion | Met? |
|---|---|
| All canonical files inspected | Yes |
| Current scope vs North Star separated | Yes |
| Each frozen invariant has exact file:line | Yes |
| All trap scenarios answered | Yes |
| No OPEN_DECISION resolved | Yes |
| Canonical files not modified | Yes |
| No unexpected mutation | Yes |
| Before/after mutation check recorded | Yes |

**Human Gate:** Phase 0 complete. STOP. Do NOT begin Phase 1 until Human authorization.

Token verification added after Human Gate feedback: docs/canonical/TRUST_AND_EVIDENCE.md:69 enumerates unknown states including unknown, not_applicable, not_observed, not_requested, and redacted. These are all distinct truth states and must stay visible.
