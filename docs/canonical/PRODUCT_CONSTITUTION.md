# PRODUCT_CONSTITUTION.md

## Canonical Product Constitution - Revenue Continuity Platform

**Owner:** Product Lead (human-controlled)
**Status:** Canonical (normative)
**Last updated:** 2026-09-16
**Supersedes:** No prior canonical; consolidates 2026-09-09/10 research lineage.
**Evidence status:** Consolidation of research hypotheses/decisions; not new customer validation.

---

## 1. Product category

**Revenue Continuity / Closed-loop Revenue Platform** - a Revenue Operating System layer that preserves commercial meaning from acquisition through conversation, lead, handoff, Sales action, outcome, revenue, attribution and learning.

> **Source lineage / evidence sources:** `docs/north-star/NORTH_STAR.md` - Product Vision / category "Commercial Continuity / Closed-loop Revenue Platform"; `00_EXECUTIVE/LEAN_VALIDATION_PHASE.md` - Phase decision (continuity layer, not full CRM); `03_PRODUCT/PRODUCT_VISION.md` - Five-engine model and end-state architecture; `01_BUSINESS_STRATEGY/PRODUCT_STRATEGY.md`.

## 2. Product promise

- **Long-term promise (North Star):** *Turn every customer conversation into a measurable commercial journey - from acquisition to revenue.*
  - Plain form: Marketing knows which ad spend produced which customers; Sales never loses context or next action; Management sees where customers fall off and where revenue actually came from.
  > Source: `NORTH_STAR.md` - Section 38 "Ban chat cuoi cung" / product promise quote.
- **LVP promise under test (current phase only):** *When receiving a lead, Sales can quickly understand what the customer needs, inspect original evidence, and know the next action without relying on memory.*
  > Source: `03_PRODUCT/LVP_PRODUCT_SPEC.md` - Product promise under test; `00_EXECUTIVE/LEAN_VALIDATION_PHASE.md` - First working product bet; `00_EXECUTIVE/CURRENT_THESIS.md` - Current solution bet.

These promises are distinct in scope. The LVP promise does not imply the long-term promise has been validated.

## 3. Scope - what the platform does

The platform owns **Meaning -> Continuity -> Action -> Intelligence** between the giants (Ad platforms, Pancake, CRM).

Aspirational end-state flow:

```
Acquisition -> Conversation -> Lead -> Handoff -> Sales Action -> Outcome -> Revenue -> Attribution -> Learning -> Acquisition
```

> Source: `NORTH_STAR.md` - Architecture diagram; `03_PRODUCT/PRODUCT_VISION.md` - End-state flow; `03_PRODUCT/PRODUCT_MODEL.md` - Five engines.

Five engines (from `03_PRODUCT/PRODUCT_VISION.md` / `03_PRODUCT/PRODUCT_MODEL.md`):

1. **Acquisition Intelligence** - ad/source connectors beyond Pancake, spend/campaign/ad/creative identity, acquisition-source resolution.
2. **Conversation Intelligence** - summaries, needs/intent/objections/commitments, commercial signals.
3. **Commercial Continuity** - identity graph, lead creation, Marketing->Sales handoff, context/channel continuity, lead-scoped permissions.
4. **Revenue Execution** - owner, CRM-lite state, next action, commitments, SLA, exception-driven queue.
5. **Revenue Intelligence** - funnel, attribution, leakage detection, source x Sales performance, CRM hygiene when CRM exists.

**LVP scope (active):** Single-tenant pilot with persistence; manual/synthetic input; lead handoff + Sales queue + evidence + next action + minimal outcome; audit/provenance + telemetry + structured feedback from day one; Pancake read-only feasibility spike in parallel. See `00_EXECUTIVE/LEAN_VALIDATION_PHASE.md` - "Build now" and `03_PRODUCT/LVP_PRODUCT_SPEC.md` - P0 capabilities.

## 4. Non-goals - what the platform will NOT become

Do **not** rebuild: unified social inbox, full enterprise CRM, ERP/POS, generic task manager, generic BI/report builder, generic chatbot, generic call-transcription, generic enrichment platform.

> Source: `NORTH_STAR.md` - Section 36 "Nhung gi tuyet doi khong nen build"; `03_PRODUCT/PRODUCT_BOUNDARIES.md`; `03_PRODUCT/NON_GOALS.md`; `AGENTS.md` - Product identity.

Every feature must pass:

> *Does this help understand what an interaction means commercially, keep the relationship unbroken, ensure the right person does the next action, or show how the result affected revenue?*
> Source: `NORTH_STAR.md` - Section 36 filter question.

## 5. Architectural boundaries

| Boundary | Platform owns | External system owns |
|---|---|---|
| **Ad platforms** (Meta/TikTok/Google/...) | Acquisition Data Hub, source resolution, lead-quality feedback | Ad execution, spend truth |
| **Pancake** | Interaction evidence, handoff context, continuity, intelligence | Conversation operations, inbox |
| **Phone/Zalo/other Sales channels** | Activity/outcome claims, commitment tracking | Channel delivery |
| **CRM (Twenty, HubSpot, Salesforce, ...)** | Context/evidence/intelligence/hygiene/attribution layer | Enterprise commercial system of record (when it exists) |

Rules:

- CRM adapters **do not own** canonical commercial semantics.
- External providers are **integration boundaries**, not the core domain model.
- Pancake objects are mapped through anti-corruption adapters to neutral concepts; never used directly as the Lead/outcome model.

> Source: `AGENTS.md` - Frozen invariants (CRM adapters / external providers); `03_PRODUCT/PRODUCT_VISION.md` - "Do not replace the giants"; `05_ENGINEERING/INTEGRATION_ARCHITECTURE.md`; `05_ENGINEERING/PANCAKE_INTEGRATION.md` - Role and boundary; `03_PRODUCT/PRODUCT_MODEL.md` - Product modes (CRM-less vs CRM-connected).

## 6. How to read this document

- `NORTH_STAR.md` is the end-state vision; this constitution is the enforceable subset for coding agents.
- Research docs under `docs/research/` are evidence sources, not canonical by repetition.
- Contradictions are recorded in `OPEN_DECISIONS.md`; coding agents must not invent a resolution.

## 7. Change control

Edits require human approval (RFC/ADR). BMad/implementation workflows must not silently override this file. See `docs/canonical/README.md` - Rules.
