# INTEGRATION_PRINCIPLES.md (Canonical)

**Owner:** Engineering / Product (canonical)
**Maturity:** Canonical (normative)
**Evidence status:** Consolidated from research with cited sources; each rule is normative only where a source exists
**Last consolidated:** 2026-09-16
**Source lineage / evidence sources:** `05_ENGINEERING/INTEGRATION_ARCHITECTURE.md`; `05_ENGINEERING/PANCAKE_INTEGRATION.md`; `AGENTS.md` (AGENTS.md - frozen integration invariants + AGENTS.md - adapter guides)

---

## 1. External platforms are integration boundaries, never the core domain

- Pancake, Twenty, HubSpot, Salesforce, Meta/TikTok/Google Ads and other providers are **integration boundaries** behind anti-corruption adapters.
- The platform's own domain semantics (Customer/Lead, identity, Commercial Events, continuity, evidence, attribution, measurement) live in the core, never inherited from an external system's semantics.
- CRM adapters do not own canonical commercial semantics; external providers (Pancake, Twenty) are adapters, not the domain model (CRM-lite is not a CRM built on Twenty).

> **Sources:** `AGENTS.md` - "CRM adapters do not own canonical commercial semantics", "External providers ... are integration boundaries"; `AGENTS.md` - "Twenty CRM access is an integration capability only"; `05_ENGINEERING/INTEGRATION_ARCHITECTURE.md`; `AGENTS.md` - "Twenty" as one adapter; `docs/canonical/README.md`.

## 2. Three responsibilities the platform keeps for itself (non-negotiable)

1. **Preserve external evidence and identity seals** — external immutable IDs/timestamps; never join on display names.
2. **Own commercial semantics at the boundary** — the adapter converts external objects to the canonical envelope (evidence pointer + provenance), never treats external objects as truth.
3. **Enforce trust/auditability at the edge** — encrypted credentials server-side, least-privilege tokens, redaction, idempotent ingestion, immutable raw envelopes, append-audit.

> **Sources:** `05_ENGINEERING/INTEGRATION_ARCHITECTURE.md` - "Preserve external immutable IDs and timestamps; never rely on display names for joins"; `05_ENGINEERING/PANCAKE_INTEGRATION.md` - Adapter contract / guardrails; `05_ENGINEERING/SECURITY_ARCHITECTURE.md` - LVP baseline; `08_DATA_MEASUREMENT/OBSERVABILITY_AND_PROVENANCE_MODEL.md`.

## 3. Pancake integration boundary

Pancake is the **primary conversation/customer evidence source** for the LVP. Never use Pancake objects directly as the canonical Lead/outcome model. The produced platform is independent of Pancake; manual/synthetic adapter is the P0 fallback; real read is a P1 verified feasibility track (see `PANCAKE_FEASIBILITY.md`).

Adapters:
- Manual/synthetic inbound adapter - P0, first-class fallback.
- Pancake real-time read feasibility - P1 spike; Pancake webhook experimental (event/payload/security semantics unverified).
- Pancake message sending - deferred until verified need + permission + terms.
- Pancake's ad boundary does not define acquisition semantics. Conversation Source, Acquisition Lineage and Revenue Attribution remain separate concepts.

> **Source:** `05_ENGINEERING/PANCAKE_LVP_FEASIBILITY.md`; `05_ENGINEERING/PANCAKE_INTEGRATION.md` - LVP policy; `AGENTS.md` - "Read real Pancake data under test/dev credentials"; `00_EXECUTIVE/LEAN_VALIDATION_PHASE.md`; `AGENTS.md` - F/feasibility blocker questions.

## 4. CRM adapter boundary (Twenty, HubSpot, Salesforce, ...)

CRM (when present) is a **downstream / upstream option**, not a core requirement. The product boundary is "CRM-lite", not a full CRM, not built on Twenty.

- Twenty is one optional adapter (integration capability). Do not model the product as a CRM built on Twenty; the core can operate before/without a CRM and semantic boundaries stay with the platform.
- CRM relationships map via a versioned, evidence-preserving contract: connection → envelope → projection; external IDs preserved; mutations only through Commercial Events + policy (never opaque AI writes).
- When a mature CRM exists, that CRM may own Account/Contact/Opportunity/Pipeline/Forecast records. The Revenue Continuity Platform remains authoritative for its own Commercial Event semantics, evidence/provenance, continuity, Acquisition Lineage, Revenue Attribution semantics and Data Health. It remains a layer, not an enterprise CRM replacement.

> **Source:** `00_EXECUTIVE/DECISION_LOG.md` - D-001 "do not rebuild CRM"; `NORTH_STAR.md` - "A layer between interaction systems and commercial system of record" / "not a CRM clone"; `05_ENGINEERING/INTEGRATION_ARCHITECTURE.md` - CRM role; `AGENTS.md`.

## 5. Idempotency, immutability and failure semantics

- Ingestion is idempotent (connection + external record/event ID or documented fallback).
- Raw external envelope / envelope hash is stored immutable separately from canonical projection.
- External IDs immutable; mapping failure preserves raw evidence, no fabricated canonical fields.
- Provenance: assertion envelope with source system/record/actor, acquisition mode/assertion status, occurred/captured timestamps, raw evidence pointer, schema/version IDs.
- Contract tests use captured anonymized fixtures; live verification before production; synthetic/manual data never counts as real customer evidence (but can validate functionality).

> **Source:** `05_ENGINEERING/PANCAKE_INTEGRATION.md` - Envelope/idempotency; `08_DATA_MEASUREMENT/OBSERVABILITY_AND_PROVENANCE_MODEL.md` - Minimum provenance envelope; `08_DATA_MEASUREMENT/DATA_CONTRACT.md` - Adapter envelope; `05_ENGINEERING/DATA_MODEL.md` - Immutable external IDs; `AGENTS.md` - "Pancake sync uses the configured profile"; `DATA_CONTRACT.md` - RawEnvelope idempotency/immutability.

## 6. Permission model at the boundary

- Workspace isolation; internal authorization not inherited from upstream token scope.
- Sales access scoped to assigned lead/customer (not the whole page/inbox); role/lead context boundaries respected.
- External credential/secret: server-side, encrypted, least privilege, redacted from logs/query/URLs/PII; per-connection adapters; rotation/remediation before live use.
- CRM connectors map customs only as attribute/behavior, not semantics.

> **Source:** `05_ENGINEERING/SECURITY_ARCHITECTURE.md`; `03_PRODUCT/MODULES/CRM_LITE.md` - lead-scoped permissions; `AGENTS.md` - "Sales access is scoped... not implicitly to an entire social inbox"; `08_DATA_MEASUREMENT/DATA_CONTRACT.md` - External connection.

## 7. Related canonical docs
- `COMMERCIAL_EVENT_MODEL.md` — evidence → policy → action (no opaque AI mutation)
- `IDENTITY_MODEL.md` — stable Lead ID, identity graph across channels
- `MEASUREMENT_MODEL.md` — attribution lineage vs conversation source
- `TRUST_AND_EVIDENCE.md` — audit/provenance
- `DOMAIN_INVARIANTS.md`