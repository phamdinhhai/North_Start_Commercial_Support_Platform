# Domain Model

**Owner:** Product / Data (canonical)
**Maturity:** Canonical v0.1
**Evidence status:** Consolidated from research docs; mixed evidence preserved as Unknown/Inferred
**Last consolidated:** 2026-09-16
**Source lineage / evidence sources:** `docs/research/pancake-revenue-platform-documentation/05_ENGINEERING/DOMAIN_MODEL.md`; `.../05_ENGINEERING/DATA_MODEL.md`; `.../08_DATA_MEASUREMENT/ATTRIBUTION_MODEL.md`; `.../03_PRODUCT/MODULES/CRM_LITE.md`; `docs/north-star/NORTH_STAR.md`

---

## 1. Purpose

The domain model defines the concepts and relationships an implementation agent must honor. It is the normalized layer over the North Star and research evidence. It does not add new commercial concepts beyond what the research lineage already asserts.

## 2. Canonical entities

The platform recognizes these commercial primitives (same set as `DOMAIN_MODEL.md` research):

- **Customer** — a person/entity the business has a relationship with; not an acquisition event, not a lead.
- **Identity** — how customer/lead identity is tracked across systems; see `IDENTITY_MODEL.md`.
- **AcquisitionEpisode / Lead** — one commercial/acquisition episode (one lead). Separate from Customer.
- **Interaction** — evidence of a conversation/interaction (message, call event, thought).
- **Conversation** — a thread/lineage of interactions; a reference, not an attribution claim.
- **SourceTouch / Acquisition lineage** — where/when/what source/ad/campaign the conversation came from; separate from conversation channel and from revenue attribution.
- **Handoff** — the Marketing→Sales context handoff package (identity, evidence, owner, next action).
- **CommercialEvent** — an evidence-backed inference about commercial meaning with confidence/timestamp/audit (see `COMMERCIAL_EVENT_MODEL.md`).
- **Activity / NextAction / Commitment** — product-recorded or user-claimed work/action items.
- **CommercialState** — one active asserted commercial state per Lead. Exact state enumeration and transition semantics are not canonicalized; see `OPEN_DECISIONS.md` (CE-1). State names appearing in research are illustrative only.
- **Owner** — governance of a workspace/user; also a lead owner (Marketing/Sales).
- **Outcome / Revenue** — the commercial outcome facts (Won/Lost/Unknown, revenue) asserted with provenance.
- **AttributionRecord / RevenueAttribution** — measurement of which source receives credit under a defined model; never collapsed with conversation source or acquisition lineage.
- **DataHealthRecord / Provenance** — trust/evidence/health state.

> **Source lineage / evidence sources:** `05_ENGINEERING/DOMAIN_MODEL.md` — Canonical entities; `05_ENGINEERING/DATA_MODEL.md` — Commercial context.

## 3. Critical distinctions (must never collapse)

These are frozen separates established in the research lineage:

1. **Customer ≠ Lead / AcquisitionEpisode.** One Customer may have many Leads. A Lead is one acquisition/commercial episode.
2. **Conversation source ≠ acquisition lineage ≠ revenue attribution.** Do not collapse into a single field. Attribution is an explicit modeled concept, not a default assumption.
3. **Interaction evidence ≠ CommercialEvent.** An interaction is raw evidence; a Commercial Event is an inferred commercial meaning with confidence, evidence and audit. Evidence is not truth by itself.
4. **Conversation assignment ≠ Sales ownership.** Who manages the Pancake conversation is not who owns the commercial relationship.

> **Source lineage / evidence sources:** `05_ENGINEERING/DOMAIN_MODEL.md` — "Critical distinctions"; `AI_WORKING_INSTRUCTIONS.md` rules 3-8; `AGENTS.md` — "Frozen architectural invariants".

## 4. Core relationships

```text
Customer
  └── has many ──> Lead / AcquisitionEpisode
        └── originated from ──> Acquisition lineage (source/campaign/ad/creative)
        └── evidenced by ──> Interaction(s) ──> Conversation reference
        └── interpreted as ──> CommercialEvent(s) ──> Commercial State / Next Action
        └── owned by ──> Owner (Marketing → Sales handoff)
        └── concludes in ──> Outcome (Won/Lost/Unknown) → Revenue (if asserted)
```

The canonical funnel (acquisition meaning preserved end to end):

```text
Ads/Acquisition sources -> Acquisition Hub -> Source Resolution -> Pancake conversation
-> Lead -> Handoff -> Sales -> Outcome -> Revenue -> Attribution -> Learning
```

> **Source lineage / evidence sources:** `NORTH_STAR.md` — End-state architecture diagram; `08_DATA_MEASUREMENT/ATTRIBUTION_MODEL.md` — "Critical design principle: Acquisition Hub must be independent"; `03_PRODUCT/PRODUCT_MODEL.md` — five-engine pipeline.

## 5. Identity at the core

- Customer and Lead/acquisition episode remain separate entities.
- Stable Lead identity survives channel transition and downstream handoff (channel continuity).
- Identity merges require evidence, confidence, manual correction and reversible undo. Automated identity merge is NOT a canonical primitive (deferred).
- External identity (e.g. Pancake, Meta, Zalo) is adapter-scoped; never use external display identity as the canonical join key.

> **Source lineage / evidence sources:** `05_ENGINEERING/DOMAIN_MODEL.md`; `05_ENGINEERING/DATA_MODEL.md` — "ExternalIdentity, merge/correction history"; `AGENTS.md` — frozen invariants (identity merge, stable Lead identity, channel continuity).

## 6. Attribution is three distinct concepts

Never collapse them into one field (see `MEASUREMENT_MODEL.md`):

1. **Conversation Source** — where did the conversation happen?
2. **Acquisition lineage** — what source/campaign/ad originally produced/influenced the lead?
3. **Revenue/attribution** — under a defined model, what gets credit for the commercial outcome?

Rule: **Honest unknown is better than false precision.** An unknown source/lineage/attribution stays visible; never manufacture deterministic precision.

> **Source lineage / evidence sources:** `08_DATA_MEASUREMENT/ATTRIBUTION_MODEL.md` — "Three separate attribution concepts" and "Critical design principle"; `03_PRODUCT/MODULES/ACQUISITION_INTELLIGENCE.md`.

## 7. Non-goals encoded in the model

The domain intentionally does not include: unified social inbox, full enterprise CRM, ERP/POS, generic task manager/BI/chatbot/automation/call transcription/enrichment, automated identity merge, autonomous opaque AI mutations unit.

> **Source lineage / evidence sources:** `03_PRODUCT/PRODUCT_BOUNDARIES.md`; `03_PRODUCT/NON_GOALS.md`; `AGENTS.md` — "Do not rebuild".

## 8. Related canonical docs

- `PRODUCT_CONSTITUTION.md` — promise, scope, boundaries
- `DOMAIN_INVARIANTS.md` — always-true rules
- `COMMERCIAL_EVENT_MODEL.md` — event semantics
- `IDENTITY_MODEL.md` — identity graph, merge, Lead ID
- `MEASUREMENT_MODEL.md` — attribution + measurement semantics
- `INTEGRATION_PRINCIPLES.md` — CRM/integration boundary
- `GLOSSARY.md` — term definitions
- `OPEN_DECISIONS.md` — unresolved items
