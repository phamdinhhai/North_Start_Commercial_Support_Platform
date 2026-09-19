# Commercial Event Model

**Owner:** Engineering / AI / Product (canonical)
**Status:** Canonical (normative)
**Last updated:** 2026-09-16
**Source lineage / evidence sources:** `05_ENGINEERING/COMMERCIAL_EVENT_SCHEMA.md`; `05_ENGINEERING/AI_ARCHITECTURE.md`; `05_ENGINEERING/DATA_MODEL.md`; `AGENTS.md` - Inferred changes must become Commercial Events; `03_PRODUCT/PRODUCT_MODEL.md`

---

## 1. Definition

A **Commercial Event** is the platform's core primitive that turns evidence from interactions into structured, auditable commercial meaning plus a suggested action. It is the only sanctioned way for inferred / AI-derived commercial meaning to affect canonical state.

Preferred pipeline (mandatory):

```
Interaction -> AI interpretation -> Commercial Event -> Evidence -> Policy -> Action
```

An LLM must **never** write directly and opaquely into CRM-like fields.

> Source: `05_ENGINEERING/COMMERCIAL_EVENT_SCHEMA.md`; `03_PRODUCT/PRODUCT_MODEL.md`; `AGENTS.md` - I-03/I-04.

### 2. Scope boundary

The canonical sources do not yet unambiguously establish whether `CommercialEvent`
is restricted to inferred/AI-derived commercial meaning or is the generalized
event/assertion primitive for observed, claimed, imported and inferred commercial
facts.

This is OPEN decision CE-2. Implementations MUST NOT silently choose either model.
See `OPEN_DECISIONS.md`.

## 3. Required fields

A Commercial Event must contain:

- `customer / lead identity`
- `event type`
- `timestamp` (occurred vs captured semantics per provenance rules)
- `source interaction` reference (evidence pointer)
- `evidence` (raw pointer or explicit reason none exists)
- `inferred commercial meaning`
- `confidence` (only where meaningful / calibrated; provenance preferred over decoration)
- `suggested mutation / action`
- `previous value / new value` when applicable
- `audit trail / undo`

> Source: `05_ENGINEERING/COMMERCIAL_EVENT_SCHEMA.md` - "A Commercial Event should contain"; `08_DATA_MEASUREMENT/OBSERVABILITY_AND_PROVENANCE_MODEL.md` - Minimum provenance envelope.

## 4. Event classes (examples, not an exhaustive enum)

From research: `PURCHASE_INTENT_INCREASED`, `OBJECTION_PRICE`, `BUYER_COMMITMENT`, `SELLER_COMMITMENT`, `FOLLOW_UP_DUE`, `LEAD_QUALIFIED`, `HANDOFF_CREATED`, `SALES_CONTACTED`, `OPPORTUNITY_AT_RISK`, `WON / LOST`.

Commitments form two canonical classes: **Buyer commitment** ("call me Friday after I speak with my boss") and **Seller commitment** ("I will send the quotation this afternoon"), with lifecycle `Detected -> Assigned -> Due -> Completed / Overdue`.

Enumeration of the full transition table is an OPEN DECISION - see `OPEN_DECISIONS.md` (CE-1).

> Source: `05_ENGINEERING/COMMERCIAL_EVENT_SCHEMA.md` - Examples; `03_PRODUCT/MODULES/FOLLOW_UP_COMMITMENT.md`; `03_PRODUCT/MODULES/SALES_EXECUTION.md`.

## 5. Evidence, confidence and audit semantics

- **Evidence** is a pointer to raw immutable material (or an explicit "no evidence" reason). Interaction evidence is not the same as a Commercial Event.
- **Confidence** applies only to inference and must include producer / model / rule version and rationale / calibration context. A direct record uses provenance, not decorative confidence. See `TRUST_AND_EVIDENCE.md`.
- **Audit / undo**: important mutations are append-audited and reversible; corrections append history rather than overwrite. Trust and auditability are product capabilities, not implementation details.

> Source: `08_DATA_MEASUREMENT/OBSERVABILITY_AND_PROVENANCE_MODEL.md`; `05_ENGINEERING/DATA_MODEL.md` - Truth and change; `05_ENGINEERING/COMMERCIAL_EVENT_SCHEMA.md`.

## 6. Policy before Action

A Commercial Event proposes a mutation or action; it does not execute it. Execution is governed by policy (human confirmation, draft-by-default for high-impact / ambiguous truth, auto-accept only when confidence is high and policy permits). The manual product loop must work when AI is disabled, unavailable or wrong.

> Source: `05_ENGINEERING/AI_ARCHITECTURE.md` - Pipeline / Required controls; `00_EXECUTIVE/LEAN_VALIDATION_PHASE.md` - Operating principles.

## 7. Event store semantics

- Events are versioned assertions with acquisition mode / assertion status / provenance envelope.
- Canonical projection selects the active assertion; history remains inspectable; conflicting sources remain represented until a person / policy resolves them.
- External identifiers are immutable; ingestion is idempotent; raw envelopes are stored separately from projections.

> Source: `08_DATA_MEASUREMENT/OBSERVABILITY_AND_PROVENANCE_MODEL.md` - Correction model; `05_ENGINEERING/EVOLUTION_ARCHITECTURE.md` - Change seams 3/4.

## 8. Related

- `DOMAIN_INVARIANTS.md` - I-03/I-04/I-05
- `TRUST_AND_EVIDENCE.md` - evidence / provenance / audit implementation
- `MEASUREMENT_MODEL.md` - event-to-funnel mapping
