# Identity Model

**Owner:** Product / Data (canonical)
**Status:** Canonical (normative)
**Last updated:** 2026-09-16
**Source lineage / evidence sources:** `05_ENGINEERING/DOMAIN_MODEL.md`; `05_ENGINEERING/DATA_MODEL.md` - Commercial context / ExternalIdentity; `08_DATA_MEASUREMENT/DATA_CONTRACT.md`; `08_DATA_MEASUREMENT/DATA_QUALITY_RULES.md`; `08_DATA_MEASUREMENT/OBSERVABILITY_AND_PROVENANCE_MODEL.md` - Identity and source boundaries; `AGENTS.md` - Frozen invariants; `00_EXECUTIVE/DECISION_LOG.md` - D-002

---

## 1. Identity is split: Customer vs Lead

- **Customer** is a person/entity the business has a relationship with. A Customer may have many Leads.
- **Lead (Acquisition Episode)** is one commercial/acquisition episode; it has its own stable identity distinct from Customer and from any conversation thread.

> Source: `05_ENGINEERING/DOMAIN_MODEL.md` - Canonical entities + Critical distinctions; `AGENTS.md` - "Customer and Lead / Acquisition Episode are separate concepts"; `00_EXECUTIVE/DECISION_LOG.md` - D-002.

## 2. Canonical identity primitives

From `05_ENGINEERING/DATA_MODEL.md` - Commercial context:

- `CustomerRef` - internal reference to a person/entity; does not imply resolved identity.
- `ExternalIdentity` - platform-scoped identifier with a source and merge/correction history.
- `Lead` - one commercial/acquisition episode; distinct from CustomerRef.
- `ConversationRef` - reference to an interaction thread/channel, never an acquisition or attribution claim.

Interactions are not identity. An InteractionEvidence is a pointer-based raw excerpt/record with provenance and privacy controls.

## 3. Stable Lead ID

- A stable `Lead ID` represents one commercial/acquisition episode and survives channel transitions and downstream handoff.
- Every handoff has a stable Lead ID.
- Do not use Pancake/vendor object IDs as the canonical Lead ID.
- The model intentionally separates `Lead ID` (episode) from `CustomerRef` (entity) and from `ConversationRef` (thread).

> Source: `08_DATA_MEASUREMENT/DATA_CONTRACT.md` - Stable records / Minimum handoff input; `08_DATA_MEASUREMENT/DATA_QUALITY_RULES.md` - "Every handoff has a stable Lead ID"; `AGENTS.md` - "Stable Lead identity must survive channel transitions and downstream handoff".

## 4. Identity graph is deferred, manual linkage is canonical-visible

- Automated identity merge / graph is explicitly outside the current LVP (`03_PRODUCT/NON_GOALS.md`; `03_PRODUCT/LVP_PRODUCT_SPEC.md` - Deferred).
- Similar identifiers are **not** merged automatically without evidence and reversible history.
- Any link between external identities must carry evidence, confidence and provenance, and remain inspectable (merge/unmerge audited and reversible).

> Source: `08_DATA_MEASUREMENT/OBSERVABILITY_AND_PROVENANCE_MODEL.md` - Identity and source boundaries; `08_DATA_MEASUREMENT/DATA_QUALITY_RULES.md` - merge/unmerge rule; `AGENTS.md` - "Identity merges require evidence, confidence and reversibility / undo".

## 5. Channel continuity

- A Lead retains its original channel context across Marketing -> Sales handoff (original channel, conversation summary, full evidence).
- Sales is not forced to a "phone-number-centric" downgrade; original-channel follow-up is a goal subject to platform/API/commercial terms.
- Channel intelligence (e.g. "phone no answer, Messenger active, suggest Messenger") is a suggestion, never a deterministic truth.

> Source: `03_PRODUCT/MODULES/MARKETING_SALES_HANDOFF.md` - Handoff tax / channel downgrade; `03_PRODUCT/MODULES/COMMERCIAL_CONTINUITY.md`; `00_EXECUTIVE/OPEN_QUESTIONS.md` - Q-D2.

## 6. Access/posture

- Sales access is scoped to assigned customer/lead context, not to the full page/inbox.
- Membership/role (operator/Marketing, Sales, Manager/Admin) are initial hypotheses; detailed permission enumeration is an OPEN DECISION - see `OPEN_DECISIONS.md` (PM-1).

> Source: `05_ENGINEERING/DATA_MODEL.md` - Access boundary; `03_PRODUCT/MODULES/COMMERCIAL_CONTINUITY.md`; `AGENTS.md` - "Sales access is scoped to assigned customer / lead context".

## 7. Related

- `DOMAIN_MODEL.md` - entity relationships
- `DOMAIN_INVARIANTS.md` - I-01/I-06/I-07
- `MEASUREMENT_MODEL.md` - UNKNOWN linkage exposure
