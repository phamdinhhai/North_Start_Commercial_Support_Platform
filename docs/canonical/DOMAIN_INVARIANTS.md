# Domain Invariants

**Owner:** Product / Architecture (canonical)
**Status:** Canonical (normative - frozen unless human-approved RFC)
**Last updated:** 2026-09-16
**Source lineage / evidence sources:** `AGENTS.md` - Frozen architectural invariants; `00_EXECUTIVE/DECISION_LOG.md` - active guardrails D-002..D-005; `05_ENGINEERING/DOMAIN_MODEL.md`; `08_DATA_MEASUREMENT/DATA_QUALITY_RULES.md`; `05_ENGINEERING/AI_ARCHITECTURE.md`

---

## How to use this file

Every invariant below is a hard constraint. A passing test suite does not override a violated invariant (see `AGENTS.md` - Quality gates). Architectural conflicts become RFCs for human review; do not silently reinterpret a higher-authority source.

Each invariant cites its governing source.

## I-01: Customer != Lead / Acquisition Episode

One Customer may have many Leads. A Lead is one commercial/acquisition episode. Do not use them as synonyms, aliases, or collapsing fields.

> Source: `AGENTS.md` - "Customer and Lead / Acquisition Episode are separate concepts"; `05_ENGINEERING/DOMAIN_MODEL.md` - "Customer != Lead"; `00_EXECUTIVE/DECISION_LOG.md` - D-002.

## I-02: Conversation Source, Acquisition Lineage, Revenue Attribution are three distinct concepts

- Conversation Source = where the conversation happened.
- Acquisition Lineage = which acquisition source/campaign/ad influenced or produced the lead (triangulated independently).
- Revenue Attribution = under a defined model, which source gets credit for the commercial outcome.
- An unknown or missing field stays unknown. Never collapse into a single field or manufacture deterministic precision.

> Source: `AGENTS.md` - "Conversation Source, Acquisition Lineage and Revenue Attribution are distinct"; `00_EXECUTIVE/DECISION_LOG.md` - D-003; `08_DATA_MEASUREMENT/ATTRIBUTION_MODEL.md`.

## I-03: AI interpretation must not directly mutate canonical commercial state

AI may interpret evidence and produce drafts; it never writes silently into commercial truth. Important AI/data mutations need evidence, audit and correction.

> Source: `AGENTS.md` - "AI interpretation MUST NOT directly mutate canonical commercial state"; `00_EXECUTIVE/DECISION_LOG.md` - D-004; `05_ENGINEERING/AI_ARCHITECTURE.md`.

## I-04: Inferred changes must become a Commercial Event with evidence, confidence, timestamp and audit

Preferred pipeline: `Interaction -> AI interpretation -> Commercial Event -> Evidence -> Policy -> Action`. A Commercial Event carries customer/lead identity, event type, timestamp, source interaction, evidence, inferred commercial meaning, confidence, suggested mutation/action, previous/new value where applicable, audit trail and undo. See `COMMERCIAL_EVENT_MODEL.md`.

> Source: `AGENTS.md` - "Inferred changes must first become a Commercial Event ..."; `05_ENGINEERING/COMMERCIAL_EVENT_SCHEMA.md`.

## I-05: Important automated actions are explainable and auditable

Every important state change must be traceable to source, evidence, actor/policy, timestamp and previous/new values. Audit history is append-only and inspectable. Unknown/missing evidence is visible, not hidden.

> Source: `AGENTS.md` - "Important automated actions must be explainable and auditable"; `08_DATA_MEASUREMENT/DATA_QUALITY_RULES.md`; `05_ENGINEERING/EVOLUTION_ARCHITECTURE.md`.

## I-06: Identity merges require evidence, confidence and reversibility / undo

Similar identifiers are not merged automatically. Every merge/unmerge is audited with evidence and confidence; a manual correction path and reversible undo must exist. Automated identity merge is excluded from LVP by explicit non-goal (deferred).

> Source: `AGENTS.md` - "Identity merges require evidence, confidence and reversibility / undo"; `08_DATA_MEASUREMENT/DATA_QUALITY_RULES.md` - "Every merge/unmerge is audited and reversible"; `08_DATA_MEASUREMENT/OBSERVABILITY_AND_PROVENANCE_MODEL.md`; `03_PRODUCT/NON_GOALS.md`.

## I-07: Stable Lead identity survives channel transitions and downstream handoff

A Lead records one acquisition episode; its identity outlives channel transitions. Every handoff has a stable Lead ID. Do not collapse Lead with Customer or with conversation-thread identity.

> Source: `AGENTS.md` - "Stable Lead identity must survive channel transitions and downstream handoff"; `08_DATA_MEASUREMENT/DATA_CONTRACT.md` - "A stable Lead ID represents one commercial/acquisition episode"; `08_DATA_MEASUREMENT/DATA_QUALITY_RULES.md` - "Every handoff has a stable Lead ID".

## I-08: UNKNOWN / uncertain linkage remains visible

Never manufacture deterministic precision. An uncertain or missing linkage (unknown source, inferred linkage, missing handoff linkage) must remain exposed to operators and managers. Dashboard, API and audit must surface deterministic/inferred/unknown separately.

> Source: `AGENTS.md` - "UNKNOWN / uncertain linkage must remain visible"; `00_EXECUTIVE/DECISION_LOG.md` - D-005 ("Unknown remains unknown; Data Health/provenance stays visible"); `08_DATA_MEASUREMENT/DATA_QUALITY_RULES.md` ("Unknown is a valid state"); `03_PRODUCT/MODULES/DATA_HEALTH.md`.

## I-09: Sales access is scoped to assigned customer / lead context, not to an entire social inbox

Access should be scoped to the commercial lead/customer relationship the user is assigned to, not to the full page/inbox upstream model. Internal authorization is enforced inside this platform - never inferred from upstream token scope or role alone.

> Source: `AGENTS.md` - "Sales access is scoped to assigned customer / lead context, not implicitly to an entire social inbox"; `03_PRODUCT/MODULES/COMMERCIAL_CONTINUITY.md` - "Access should be scoped to the commercial lead/customer relationship".

## I-10: CRM adapters do not own canonical commercial semantics

Adapters map external CRM objects to platform semantics; they do not decide what Lead/Owner/State/Outcome/Attribution mean. The platform owns commercial continuity, evidence and attribution semantics even when a CRM is used downstream or in sync mode. CRM is a possible downstream/upstream system of record after maturity increases, never the domain core.

> Source: `AGENTS.md` - "CRM adapters do not own canonical commercial semantics"; `05_ENGINEERING/INTEGRATION_ARCHITECTURE.md`; `03_PRODUCT/PRODUCT_VISION.md` - "Do not replace the giants".

## I-11: External providers are integration boundaries, not the core domain

Pancake, Twenty, HubSpot, Salesforce, Ad platforms and similar systems are integration boundaries behind anti-corruption adapters. Platform semantics (identity, Commercial Events, evidence, continuity, measurement) live at the core. Product must continue to work via manual/synthetic adapters without a live Pancake integration or with a different CRM substituted.

> Source: `AGENTS.md` - "External providers (Pancake, Twenty, HubSpot, Salesforce, Ads APIs, etc.) are integration boundaries, not the core domain model"; `05_ENGINEERING/PANCAKE_INTEGRATION.md`.

## I-12: Raw evidence is preserved; UNKNOWN is a valid product/data state

Evidence, provenance and explicit unknown are themselves a product capability - not decoration, not a migration afterthought. Pancake raw envelopes are stored immutably before canonical projection. Unknown states (`unknown`, `not_applicable`, `not_observed`, `not_requested`, `redacted`) are distinct truth states.

> Source: `00_EXECUTIVE/DECISION_LOG.md` - D-004/D-005; `08_DATA_MEASUREMENT/OBSERVABILITY_AND_PROVENANCE_MODEL.md`; `08_DATA_MEASUREMENT/DATA_CONTRACT.md`; `03_PRODUCT/NON_GOALS.md` / `00_EXECUTIVE/LEAN_VALIDATION_PHASE.md` - Operating principle "Unknown is a valid product/data state".

## Related

- `ARCHITECTURE_CONSTITUTION.md` - where these invariants force seams
- `TRUST_AND_EVIDENCE.md` - how they are implemented as audit/provenance
- `INTEGRATION_PRINCIPLES.md` - how adapters respect them across Pancake/Twenty/etc.
