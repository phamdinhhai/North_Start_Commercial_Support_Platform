# GLOSSARY.md (Canonical)

**Owner:** Product / Data (canonical)
**Maturity:** Canonical (normative)
**Evidence status:** Consolidated from research with cited sources; definitions are normative only where a source exists
**Last consolidated:** 2026-09-16
**Source lineage / evidence sources:** `05_ENGINEERING/GLOSSARY.md` / `GLOSSARY_HEADER` (see Research refs below)

---

## 1. Core commercial concepts

| ID | Term | Definition | Source |
|---|---|---|---|
| G-01 | Customer | A person/entity the business has a relationship with. Separate from Lead / Acquisition Episode. One Customer may have many Leads. The integrity of customer and Lead/acquisition episode as separate concepts is frozen as a non-negotiable invariant. | `05_ENGINEERING/DOMAIN_MODEL.md` - "Customer, Identity, AcquisitionEpisode/Lead, ..."; `05_ENGINEERING/DOMAIN_MODEL.md` - "Customer != Lead"; `00_EXECUTIVE/DECISION_LOG.md` - D-002; `AGENTS.md` |
| G-02 | Lead (Acquisition Episode) | One commercial/acquisition episode; one Lead; identity-stable under its own Lead ID, surviving channel transition and downstream handoff. Not a conversation thread; not a page/inbox message. | `05_ENGINEERING/DOMAIN_MODEL.md`; `08_DATA_MEASUREMENT/DATA_CONTRACT.md` - "stable Lead ID"; `AGENTS.md` - "Stable Lead identity must survive channel transitions and downstream handoff" |
| G-03 | Stable Lead ID | Canonical identifier of a Lead; immutable under channel change; key for handoff, outcome, and attribution linkage. Temporary inbound identifiers (e.g. conversation ID, Pancake object ID) are not canonical joins. | `08_DATA_MEASUREMENT/DATA_CONTRACT.md` - "A stable `Lead ID` represents one commercial/acquisition episode"; `AGENTS.md`; `08_DATA_MEASUREMENT/DATA_QUALITY_RULES.md` |
| G-04 | Handoff | Context package Marketing → Sales (identity, channel context, conversation summary, evidence, proposed next action). API/UX must observe the product before AI inference. Every handoff has a stable Lead ID. | `05_ENGINEERING/DOMAIN_MODEL.md`; `03_PRODUCT/MODULES/COMMERCIAL_CONTINUITY.md`; `AGENTS.md` |
| G-05 | ConversationRef / Interaction evidence | Reference pointer (envelope/pointer) to conversation/interaction raw evidence; not the commercial truth itself. Kept immutable with provenance; separate envelope from canonical projection. | `08_DATA_MEASUREMENT/OBSERVABILITY_AND_PROVENANCE_MODEL.md`; `05_ENGINEERING/DATA_MODEL.md`; `05_ENGINEERING/INTEGRATION_ARCHITECTURE.md` |
| G-06 | Commercial Event | Core primitive that turns evidence from interactions into auditable commercial meaning + suggested action. Required fields: identity, event type, timestamp, evidence, confidence, audit/undo, previous/new value. | `05_ENGINEERING/COMMERCIAL_EVENT_SCHEMA.md`; `03_PRODUCT/PRODUCT_MODEL.md` |
| G-07 | Acquisition Hub | Platform-owned acquisition lineage layer; independent of Pancake; source resolution across Ad platforms (Meta/TikTok/Google/organic/referral) to produce a lead / campaign lineage. | `05_ENGINEERING/INTEGRATION_ARCHITECTURE.md`; `08_DATA_MEASUREMENT/ATTRIBUTION_MODEL.md` |
| G-08 | Revenue Continuity Platform | The platform under development: a layer of continuity/commercial meaning/evidence/experience between acquisition → conversation → Lead → Sales → outcome → revenue → attribution → learning. Not a Pancake/Salesforce/Zapier/BI clone. | `docs/north-star/NORTH_STAR.md` / `NORTH_STAR.md`; `03_PRODUCT/PRODUCT_VISION.md`; `AGENTS.md` |
| G-09 | Channel Continuity | Property: a Lead's channel context (original channel, fallback phone/Zalo, Messenger active, channel suggestion) survives the handoff and remains visible for Sales. | `03_PRODUCT/MODULES/COMMERCIAL_CONTINUITY.md`; `03_PRODUCT/MODULES/MARKETING_SALES_HANDOFF.md` |
| G-10 | CRM-lite | Minimal commercial surface to avoid tags/notes as a fake database: Customer/Lead, owners, source, state, product/interest/value, intent, next action, due date, lost reason, limited custom fields. Pipeline as a view (not manual Kanban). | `03_PRODUCT/MODULES/CRM_LITE.md`; `03_PRODUCT/NON_GOALS.md`; `00_EXECUTIVE/DECISION_LOG.md` - D-001 |
| G-11 | AttributionRecord / RevenueAttribution | An explicit tracked record of revenue attribution (model + lineage linkage), never collapsed into conversation source or acquisition lineage alone. | `05_ENGINEERING/DOMAIN_MODEL.md` / `08_DATA_MEASUREMENT/ATTRIBUTION_MODEL.md` |
| G-12 | DataHealthRecord / Provenance | Trust/evidence/health state record (linkage deterministic/inferred/unknown, provenance, audit, Data Health coverage). | `05_ENGINEERING/DOMAIN_MODEL.md`; `08_DATA_MEASUREMENT/DATA_QUALITY_RULES.md`; `08_DATA_MEASUREMENT/ATTRIBUTION_MODEL.md` |

## 2. Identity and measurement terms

| ID | Term | Definition | Source |
|---|---|---|---|
| G-13 | Identity graph | Evidence-backed linkage between multiple platform identities (Facebook/Instagram/Phone/Zalo/CRM) for the same Customer/Lead, with confidence + manual correction + reversibility. NOT built by automated merge before it is validated. | `05_ENGINEERING/DOMAIN_MODEL.md`; `05_ENGINEERING/DATA_MODEL.md`; `00_EXECUTIVE/CURRENT_THESIS.md` |
| G-14 | External identity | Raw identity claim from external system (platform-scoped), kept immutable with provenance before any linkage logic. | `05_ENGINEERING/DOMAIN_MODEL.md`; `05_ENGINEERING/DATA_MODEL.md` |
| G-15 | Identity merge | Linkage between two external identities into one Customer/Lead - requires evidence, confidence, and is audited/reversible/undo. Never fabricated deterministic precision. | `AGENTS.md` - "Identity merges require evidence, confidence and reversibility / undo"; `08_DATA_MEASUREMENT/DATA_QUALITY_RULES.md`; `05_ENGINEERING/DOMAIN_MODEL.md` |
| G-16 | Unknown | Valid, visible linkage state (unknown source, unknown attribution, missing handoff linkage) that must stay exposed. Never hide or manufacture deterministic precision. | `08_DATA_MEASUREMENT/DATA_QUALITY_RULES.md` - "Unknown is a valid state"; `AGENTS.md`; `03_PRODUCT/NON_GOALS.md` |
| G-17 | Inferred linkage | Source-derived linkage carrying confidence/provenance (e.g. source resolution inference). Never collapsed into deterministic linkage in measurement. | `08_DATA_MEASUREMENT/ATTRIBUTION_MODEL.md`; `08_DATA_MEASUREMENT/DATA_QUALITY_RULES.md` |
| G-18 | Identity graph / lineage | See G-13; linkage graph and its provenance. Automated merge is deferred as an open decision. | `OPEN_DECISIONS.md` - ID-1 |
| G-19 | Commercial Event evidence | Evidence of commercial meaning carried in a Commercial Event (why the mutation was proposed, how confidence was graded). | `05_ENGINEERING/COMMERCIAL_EVENT_SCHEMA.md` |
| G-20 | Conversation source | Where the conversation happened (channel/Pancake object) — different from acquisition lineage and revenue attribution. | `05_ENGINEERING/INTEGRATION_ARCHITECTURE.md`; `08_DATA_MEASUREMENT/ATTRIBUTION_MODEL.md` |

## 3. Integration vocabulary (Pancake, Twenty, Ad platforms, Sales channels)

| ID | Term | Definition | Source |
|---|---|---|---|
| G-21 | Pancake | Primary conversation/customer evidence source for the LVP; integration boundary (adapter). | `05_ENGINEERING/PANCAKE_INTEGRATION.md` |
| G-22 | Twenty | One possible CRM option (integration capability only). Must remain a thin CRM adapter; platform is NOT a CRM built on Twenty; semantic boundaries stay with the platform. | `AGENTS.md` - "Twenty CRM access is an integration capability only" |
| G-23 | Ad platforms (Meta/TikTok/Google, ...) | Acquisition sources feeding the Acquisition Hub; spend/campaign/ad/creative remain external truth. Pancake ad-measurement boundary must not be inherited. | `05_ENGINEERING/INTEGRATION_ARCHITECTURE.md` - Ad platforms role; `05_ENGINEERING/PANCAKE_INTEGRATION.md` |
| G-24 | Phone/Zalo/CRM | Other activity/outcome sources; minimal Sales confirmation or structured pipeline when integration exists. | `05_ENGINEERING/INTEGRATION_ARCHITECTURE.md` |
| G-25 | Anti-corruption adapter | Internal neutral concept mapping that keeps external semantics from leaking into the core commercial model. | `05_ENGINEERING/INTEGRATION_ARCHITECTURE.md`; `AGENTS.md` |

## 4. Trust vocabulary

| ID | Term | Definition | Source |
|---|---|---|---|
| G-26 | UNKNOWN | Explicit value: linkage or meaning is not known / not observed / not requested. Must be visible. | `08_DATA_MEASUREMENT/OBSERVABILITY_AND_PROVENANCE_MODEL.md`; `AGENTS.md` |
| G-27 | Inferred / inferred linkage | Value derived from evidence + model (source resolution, intent, objection, commitment extraction), carrying evidence/provenance. | `08_DATA_MEASUREMENT/ATTRIBUTION_MODEL.md`; `05_ENGINEERING/COMMERCIAL_EVENT_SCHEMA.md` |
| G-28 | Audit | Append-only record of state changes (who/what/when/source/evidence/confidence/previous/new value/undo) that preserves history. | `05_ENGINEERING/COMMERCIAL_EVENT_SCHEMA.md`; `08_DATA_MEASUREMENT/OBSERVABILITY_AND_PROVENANCE_MODEL.md` |
| G-29 | Data Health | Measurement coverage shown alongside performance (deterministic/inferred/unknown linkage, duplicate risk, outcome coverage). | `08_DATA_MEASUREMENT/DATA_QUALITY_RULES.md`; `AGENTS.md` |
| G-30 | Evidence | Raw material or pointer that justifies an assertion (message text, response, event, envelope hash). No evidence -> not trusted. | `05_ENGINEERING/COMMERCIAL_EVENT_SCHEMA.md` |

## 5. Related
- `DOMAIN_MODEL.md` - entity / distinction definitions
- `DOMAIN_INVARIANTS.md` - invariants I-01..I-05
- `ARCHITECTURE_CONSTITUTION.md` - adapter terminology

> Change control: Human approval required (RFC/ADR). Additions need a cited source document/section.