# Trust and Evidence

**Owner:** Product / Data / Engineering (canonical)
**Status:** Canonical (normative)
**Last updated:** 2026-09-16
**Source lineage / evidence sources:** `08_DATA_MEASUREMENT/OBSERVABILITY_AND_PROVENANCE_MODEL.md`; `08_DATA_MEASUREMENT/DATA_CONTRACT.md`; `08_DATA_MEASUREMENT/DATA_QUALITY_RULES.md`; `05_ENGINEERING/DATA_MODEL.md`; `05_ENGINEERING/AI_ARCHITECTURE.md`; `05_ENGINEERING/COMMERCIAL_EVENT_SCHEMA.md`; `AGENTS.md`; `00_EXECUTIVE/DECISION_LOG.md` - D-004/D-005

---

## 1. Principle

Every commercial truth is an assertion with provenance, evidence and audit - not an opaque write. Explainability, reversibility and correction are product capabilities, not implementation details.

> Source: `05_ENGINEERING/COMMERCIAL_EVENT_SCHEMA.md` - "Trust and auditability are product capabilities"; `AGENTS.md`; `00_EXECUTIVE/DECISION_LOG.md` - D-004.

## 2. Perception vs truth - acquisition modes

A value is distinguished by how it was acquired and what status it claims:

| Dimension | Values |
|---|---|
| **Acquisition mode** | `automatic_observation` / `user_confirmed` / `imported_record` / `inferred` / `unknown` |
| **Assertion status** | `recorded` / `claimed` / `inferred` / `conflicted` / `unknown` |
| **Confidence** | only for `inferred` and must include producer/model/rule version + calibration/rationale |

- A product click is an `automatic_observation`.
- A Sales-entered outcome is a `claimed` unless corroborated.
- An imported value is an `imported_record`, not automatically canonical truth.
- An AI-produced value is `inferred` until accepted/confirmed per policy.
- **Confidence decorates inference only.** A direct record uses provenance instead. See `COMMERCIAL_EVENT_MODEL.md`.

> Source: `08_DATA_MEASUREMENT/OBSERVABILITY_AND_PROVENANCE_MODEL.md` - Independent dimensions / Confidence; `08_DATA_MEASUREMENT/DATA_CONTRACT.md` - Semantics; `05_ENGINEERING/AI_ARCHITECTURE.md` - Required controls.

## 3. Provenance envelope - minimum required fields

Every commercial assertion carries:

- `assertion_id`, `workspace_id`, `subject_type`, `subject_id`
- `field_or_event_type`, `value`, `assertion_status`, `acquisition_mode`
- `source_system`, `source_record_id`, `source_actor_id` where allowed
- `occurred_at`, `captured_at`, timezone and precision
- `raw_evidence_pointer` or explicit reason none exists
- `schema_version`, importer/rule/model/prompt version when relevant
- `created_by`, `supersedes_assertion_id`, privacy class

> Source: `08_DATA_MEASUREMENT/OBSERVABILITY_AND_PROVENANCE_MODEL.md` - Minimum provenance envelope; `05_ENGINEERING/DATA_MODEL.md` - Truth and change (Assertion/Provenance/AuditEntry).

## 4. Evidence rules

- Raw evidence (envelope, payload pointer, hash) is **immutable** and stored separately from canonical projections.
- Mapping errors preserve the raw envelope; do not fabricate canonical fields.
- Every AI-derived value stores its evidence span/pointer, model/prompt/rule version and inference metadata.
- Every handoff has a stable Lead ID and retains its original conversation/evidence references.
- An entered `Won` state is a user claim unless corroborated; it is not automatically revenue or attribution evidence (see `MEASUREMENT_MODEL.md`).

> Source: `08_DATA_MEASUREMENT/DATA_CONTRACT.md` - Stable records / Minimum handoff input / Semantics; `05_ENGINEERING/AI_ARCHITECTURE.md` - pipeline controls; `08_DATA_MEASUREMENT/OBSERVABILITY_AND_PROVENANCE_MODEL.md`.

## 5. Audit and reversibility

- Important mutations are **append-audited and reversible** (append-only; previous/new values + responsible actor/process).
- Canonical projection selects the active assertion but history remains inspectable.
- Conflicting sources remain represented until a person/policy resolves them.
- Every merge/unmerge is audited and reversible; corrections append assertions/audit entries.

> Source: `08_DATA_MEASUREMENT/OBSERVABILITY_AND_PROVENANCE_MODEL.md` - Correction model; `05_ENGINEERING/EVOLUTION_ARCHITECTURE.md` - change seam 8; `08_DATA_MEASUREMENT/DATA_QUALITY_RULES.md`.

## 6. UNKNOWN handling

- `unknown`, `not_applicable`, `not_observed`, `not_requested` and `redacted` are **different states** where product decisions depend on the distinction.
- Unknown/missing fields stay unknown; missing source/revenue must remain unknown - do not backfill with assumptions.

> Source: `08_DATA_MEASUREMENT/OBSERVABILITY_AND_PROVENANCE_MODEL.md` - Unknown and missing; `08_DATA_MEASUREMENT/DATA_CONTRACT.md`; `00_EXECUTIVE/DECISION_LOG.md` - D-005.

## 7. AI governs drafts, humans govern truth

AI may draft context/needs/objections/commitments/next actions. The manual loop must work when AI is disabled, unavailable or wrong. Required AI controls: server-controlled feature flag + recorded experiment exposure; schema validation (invalid output fails closed to manual input); draft-by-default for high-impact/ambiguous truth; accept/edit/reject+reason capture; timeout/error fallback without blocking handoff/Sales action; no token/raw PII in telemetry/logs.

> Source: `05_ENGINEERING/AI_ARCHITECTURE.md` - Required controls / Evaluation / Deferred.

## 8. Telemetry scope

- Product events (`ProductEvent`) observe behavior inside the product only, tagged by release/feature flags.
- Feedback is separated from behavior.
- Only consented/allowed, access-controlled, PII-minimized data may form an AI evaluation set; correction data is a learning signal, not automatic training consent.

> Source: `08_DATA_MEASUREMENT/OBSERVABILITY_AND_PROVENANCE_MODEL.md` - Product events; `05_ENGINEERING/DATA_MODEL.md` - Learning; `05_ENGINEERING/AI_ARCHITECTURE.md` - Evaluation.

## 9. Related

- `COMMERCIAL_EVENT_MODEL.md` - Pipeline `Interaction -> ... -> Policy -> Action`
- `IDENTITY_MODEL.md` - merges and reversibility
- `INTEGRATION_PRINCIPLES.md` - envelope preservation across adapters
