# Architecture Constitution

**Owner:** Engineering / Architecture (canonical)
**Status:** Canonical (normative)
**Last updated:** 2026-09-16
**Source lineage / evidence sources:** `05_ENGINEERING/EVOLUTION_ARCHITECTURE.md`; `05_ENGINEERING/INTEGRATION_ARCHITECTURE.md`; `05_ENGINEERING/PANCAKE_INTEGRATION.md`; `05_ENGINEERING/SECURITY_ARCHITECTURE.md`; `00_EXECUTIVE/LEAN_VALIDATION_PHASE.md`; `03_PRODUCT/LVP_PRODUCT_SPEC.md`; `AGENTS.md` - Frozen invariants

---

## 1. Shape: modular monolith with explicit seams

Start as a **modular monolith** with one deployable application and clear internal modules. Microservices require demonstrated independent scaling, ownership or reliability needs - not an upfront decision.

Modules (from `05_ENGINEERING/EVOLUTION_ARCHITECTURE.md` - Default shape):

- Identity / access and workspace.
- Lead / handoff and evidence.
- Sales action / next action / outcome.
- Audit / provenance.
- Product telemetry / experiment exposure.
- Integration adapters and background jobs.
- Optional AI inference (feature-flagged).

> Source: `05_ENGINEERING/EVOLUTION_ARCHITECTURE.md` - Goal / Default shape; `00_EXECUTIVE/LEAN_VALIDATION_PHASE.md` - One usable pilot workspace.

## 2. Change seams an implementation must preserve

From `05_ENGINEERING/EVOLUTION_ARCHITECTURE.md` - Change seams (1-10):

1. Neutral internal domain; Pancake/vendor objects live behind anti-corruption adapters.
2. Manual, synthetic and Pancake adapters implement the same inbound contract.
3. Store raw external envelopes separately from versioned canonical projections.
4. External identifiers are immutable and ingestion is idempotent.
5. Database changes use forward migrations and tested rollback / data-migration plans.
6. Internal / public APIs and schemas carry explicit versions.
7. AI, sync modes and experiment variants use server-controlled feature flags.
8. Important mutations are append-audited and reversible.
9. Connector work uses a queue / job abstraction with per-connection limits, bounded retry and dead-letter inspection.
10. Logs, metrics and traces expose failure while redacting credentials / PII.

Avoid premature abstraction: do not build a generic connector framework, workflow DSL, event platform or multi-tenant control plane before a second concrete need.

> Source: `05_ENGINEERING/EVOLUTION_ARCHITECTURE.md`.

## 3. Adapter contract (inbound)

Inbound adapters (Pancake, manual / synthetic, future ad-platform and CRM adapters) produce a **versioned envelope** containing: connection, external IDs, record type, source timestamps, captured timestamp, raw payload pointer and payload hash. Mapping errors preserve the raw envelope and do not fabricate canonical fields. A fake / manual adapter is first-class for development, demos and fallback; it is not treated as customer evidence unless a real participant uses it in a registered experiment.

> Source: `05_ENGINEERING/EVOLUTION_ARCHITECTURE.md` - Adapter contract; `05_ENGINEERING/PANCAKE_INTEGRATION.md` - LVP policy / Integration guardrails.

## 4. Integration roles

- **Pancake:** primary conversation / customer / agent evidence source. Never use Pancake objects directly as the Lead / outcome model.
- **Ad platforms:** acquisition spend / campaign / ad / creative sources; do not inherit Pancake ad-measurement boundary.
- **Phone / Zalo / other Sales channels:** activity / outcome sources where integrations are available; otherwise minimal Sales confirmation.
- **CRM (Twenty, HubSpot, Salesforce, ...):** optional downstream / upstream system of record after maturity increases - integration boundary only.

Design rule: preserve external immutable IDs and timestamps; never rely on display names for joins.

> Source: `05_ENGINEERING/INTEGRATION_ARCHITECTURE.md`; `05_ENGINEERING/PANCAKE_INTEGRATION.md` - Role and boundary.

## 5. Pancake integration policy (current phase)

- Manual / synthetic inbound adapter is **P0** and remains the fallback.
- Pancake read (conversations / messages / customers) is a **P1 feasibility track** - requires live verification before use.
- Webhook / incremental real-time sync is **experimental** until live event / payload / security / delivery semantics are captured; do not gate LVP learning on it.
- Pancake message sending is **deferred** pending validated product need, exact permission and commercial terms.
- Statistics / ad endpoints do not justify cross-platform source or attribution claims.
- When Pancake integration is live, enforce encrypted server-side credentials, per-workspace connection, internal lead-level authorization (not upstream token scope), idempotency from connection + external record / event ID, cursor / checkpoint separate from canonical state, and full token / PII redaction.

> Source: `05_ENGINEERING/PANCAKE_INTEGRATION.md`; `05_ENGINEERING/PANCAKE_LVP_FEASIBILITY.md` - LVP capability matrix; `AGENTS.md` - Twenty / Pancake boundary.

## 6. Stack and data-model posture

- Implementation stack / schema is not canonicalized here; `05_ENGINEERING/DATA_MODEL.md` is the approved conceptual model (see `DOMAIN_MODEL.md`).
- Release ID and migration version are recorded with experiment exposure. Old feature variants remain available only for rollback / active comparison, then are removed deliberately. Every deferred capability has a revisit trigger.

> Source: `05_ENGINEERING/EVOLUTION_ARCHITECTURE.md` - Release / evolution controls; `05_ENGINEERING/DATA_MODEL.md`.

## 7. Security baseline the architecture must not regress

- Authenticate every non-demo user; authorize by workspace, role and lead scope (lead-scoped access).
- Isolate pilot and synthetic / demo data even in single-tenant deployment.
- Keep Pancake / vendor / model credentials server-side in a secret store; never in domain events / logs / traces.
- Redact query tokens, headers, message content and PII from logs / telemetry (Pancake snapshot places tokens in query params - verify current auth and test redaction).
- Encrypt traffic and persisted sensitive data using platform-supported controls.
- Append-audit important reads / writes, exports, deletions and AI mutations.
- Provide pilot data export and deletion with defined retention before ingesting real data.
- Use least-privilege connector access and credential rotation / revocation procedures.

> Source: `05_ENGINEERING/SECURITY_ARCHITECTURE.md` - LVP baseline / Special connector risk.

## 8. AI posture

AI remains optional and feature-flagged. No autonomous state changes, routing, revenue prediction, attribution or outbound messaging in the LVP. See `TRUST_AND_EVIDENCE.md` and `COMMERCIAL_EVENT_MODEL.md`.

> Source: `05_ENGINEERING/AI_ARCHITECTURE.md`; `00_EXECUTIVE/LEAN_VALIDATION_PHASE.md` - Do not build yet / Operating principles.

## 9. Related

- `DOMAIN_INVARIANTS.md` - the invariants this architecture enforces
- `TRUST_AND_EVIDENCE.md` - audit / provenance implementation
- `INTEGRATION_PRINCIPLES.md` - adapter rules across Pancake / Twenty / HubSpot / Salesforce
