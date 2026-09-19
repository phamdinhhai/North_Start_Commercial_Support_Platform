# Observability and Provenance Model

**Owner:** Data / Product / Engineering  
**Maturity:** Active LVP contract  
**Evidence status:** Design decision; validate operational usability  
**Last updated:** 2026-09-10

## Purpose

Represent what is known, how it became known and what remains unknown. Do not collapse technical capture, human confirmation and inference into one “truth” field.

## Independent dimensions

### Acquisition mode

`automatic_observation` · `user_confirmed` · `imported_record` · `inferred` · `unknown`

### Assertion status

`recorded` · `claimed` · `inferred` · `conflicted` · `unknown`

### Confidence

Confidence applies only to inference and must include producer/model/rule version and rationale/calibration context. A direct record uses provenance, not decorative confidence.

## Minimum provenance envelope

- `assertion_id`, `workspace_id`, `subject_type`, `subject_id`.
- `field_or_event_type`, `value`, `assertion_status`, `acquisition_mode`.
- `source_system`, `source_record_id`, `source_actor_id` where allowed.
- `occurred_at`, `captured_at`, timezone and precision.
- `raw_evidence_pointer` or explicit reason none exists.
- `schema_version`, importer/rule/model/prompt version when relevant.
- `created_by`, `supersedes_assertion_id`, privacy class.

## Correction model

Corrections append assertions/audit entries. Canonical projection selects the active assertion but history remains inspectable. Conflicting sources remain represented until a person/policy resolves them.

## Product events

Each event includes workspace/user/session, event name, object reference, timestamp, product release, feature flags, experiment/exposure and synthetic/test marker. Never place message bodies, tokens or raw PII in analytics payloads.

Product events prove product behavior only. An entered Won state is a user claim unless corroborated; it is not automatically revenue or attribution evidence.

## Identity and source boundaries

- `CustomerRef` is not `Lead`.
- Conversation channel is not acquisition lineage.
- Acquisition lineage is not revenue attribution.
- Similar identifiers are not merged automatically without evidence and reversible history.

## Unknown and missing

`unknown`, `not_applicable`, `not_observed`, `not_requested` and `redacted` are different states where product decisions depend on the distinction.
