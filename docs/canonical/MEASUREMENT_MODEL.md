# Measurement Model

**Owner:** Product / Data (canonical)
**Status:** Canonical (normative)
**Last updated:** 2026-09-16
**Source lineage / evidence sources:** `08_DATA_MEASUREMENT/ATTRIBUTION_MODEL.md`; `08_DATA_MEASUREMENT/DATA_CONTRACT.md`; `08_DATA_MEASUREMENT/DATA_QUALITY_RULES.md`; `08_DATA_MEASUREMENT/OBSERVABILITY_AND_PROVENANCE_MODEL.md`; `03_PRODUCT/MODULES/ACQUISITION_INTELLIGENCE.md`; `03_PRODUCT/MODULES/DATA_HEALTH.md`; `AGENTS.md`; `00_EXECUTIVE/DECISION_LOG.md` - D-003/D-005

---

## 1. What measurement means

The platform measures how acquisition spend produces conversations, leads and commercial outcomes. It does not measure what Ad platforms would call "ad success" directly; funnel attribution is a product-owned model. The LVP truth contract is deliberately minimal: it can observe and learn from handoff/action/outcome without requiring full revenue/attribution completeness.

> Source: `03_PRODUCT/MODULES/ACQUISITION_INTELLIGENCE.md` - Critical design principle; `08_DATA_MEASUREMENT/DATA_CONTRACT.md` - Purpose / Future closed loop.

## 2. Acquisition Hub is independent of any single channel

Pancake is a **major conversation source** but not the universal acquisition source. The product owns an **Acquisition Data Hub** independent of Pancake that sources Ad/Acquisition systems (Meta, TikTok, Google, organic, referral, marketplaces, other) and drives source resolution to Pancake conversations.

Do not assume every Pancake conversation equals a paid acquisition source.

> Source: `08_DATA_MEASUREMENT/ATTRIBUTION_MODEL.md` - "Acquisition Data Hub must be independent"; `03_PRODUCT/MODULES/ACQUISITION_INTELLIGENCE.md`.

## 3. The three distinct concepts

These must never collapse into one field (frozen):

1. **Conversation Source** (`where`) - where the conversation happened (e.g. Pancake conversation, Messenger, Zalo, phone).
2. **Acquisition Lineage** (`origin/influence`) - which source/campaign/ad originally produced or influenced the lead (triangulated independently via the Acquisition Hub + source resolution).
3. **Revenue Attribution** (`credit`) - under a defined attribution model, which source receives credit for the commercial outcome. An outcome is a human claim unless corroborated.

Conversation source stays in `ConversationRef` / Interaction evidence; acquisition lineage is stored as a separate SourceTouch/acquisition record; revenue attribution is a separate attribution record with its model version.

> Source: `AGENTS.md` - "Conversation Source, Acquisition Lineage and Revenue Attribution are distinct"; `00_EXECUTIVE/DECISION_LOG.md` - D-003; `08_DATA_MEASUREMENT/ATTRIBUTION_MODEL.md` - Three separate attribution concepts; `05_ENGINEERING/DOMAIN_MODEL.md`.

## 4. UNKNOWN is a valid measurement state (Data Health)

Rule: **Honest unknown is better than false precision.** An unknown source, inferred linkage or missing handoff must remain visible to managers; do not manufacture deterministic coverage.

For each source/funnel the product must expose measurement quality: deterministic linkage rate, inferred rate, unknown rate, missing handoff linkages, duplicate risk, outcome coverage. Confidence labels are `Known / Inferred / Unknown`. Example formulation: `TikTok: 87% source matched, 9% unknown source, 4% linkage lost during handoff`.

> Source: `00_EXECUTIVE/DECISION_LOG.md` - D-005; `08_DATA_MEASUREMENT/DATA_QUALITY_RULES.md`; `03_PRODUCT/MODULES/DATA_HEALTH.md`; `AGENTS.md` - "UNKNOWN / uncertain linkage must remain visible".

## 5. Funnel is canonical; thresholds are open

Canonical funnel (see `08_DATA_MEASUREMENT/FUNNEL_DEFINITIONS.md`):

```
Spend -> Conversation -> Lead -> Qualified -> Handoff -> Sales Contacted -> Engaged -> Follow-up/Opportunity -> Won/Lost -> Revenue
```

Each implementation must define exact entry/exit criteria and timestamps for every stage. Tags alone are not authoritative stages unless mapped through explicit transition rules. The customer must define concrete semantics (see `07_IMPLEMENTATION_CS/MEASUREMENT_PLAYBOOK.md`) - Attribution model choice and its definition are an OPEN DECISION - see `OPEN_DECISIONS.md` (MM-1).

> Source: `08_DATA_MEASUREMENT/FUNNEL_DEFINITIONS.md`; `08_DATA_MEASUREMENT/METRIC_TREE.md`; `07_IMPLEMENTATION_CS/MEASUREMENT_PLAYBOOK.md`.

## 6. Provenance is required for every measurement claim

Every acquisition/traffic/commercial/outcome fact carries acquisition mode and assertion status and is versioned with provenance (see `TRUST_AND_EVIDENCE.md`). A product click is an automatic observation; a Sales-entered outcome is a claim; an imported value is a record; an AI-produced value is inference until accepted. Conflicting sources remain represented until a person/policy resolves them.

> Source: `08_DATA_MEASUREMENT/OBSERVABILITY_AND_PROVENANCE_MODEL.md` - Independent dimensions; `08_DATA_MEASUREMENT/DATA_CONTRACT.md` - Semantics; `08_DATA_MEASUREMENT/DATA_QUALITY_RULES.md`.

## 7. What is NOT claimed yet

Revenue attribution detail, revenue-lift claims and lost-revenue prediction remain outside the LVP. `Attribution Record`, `Revenue Record` and `Opportunity` complexity are explicitly future-not-LVP; their future possibility must not force fake values into the current schema.

> Source: `05_ENGINEERING/DATA_MODEL.md` - Future, not LVP requirements; `00_EXECUTIVE/LEAN_VALIDATION_PHASE.md` - Do not build yet; `03_PRODUCT/NON_GOALS.md`.

## 8. Related

- `TRUST_AND_EVIDENCE.md` - acquisition mode / assertion status / provenance / UNKNOWN states
- `IDENTITY_MODEL.md` - stable Lead ID that survives handoff
