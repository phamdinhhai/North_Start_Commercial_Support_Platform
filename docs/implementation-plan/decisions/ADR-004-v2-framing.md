# ADR-004 — V2 problem framing & validation boundaries

**Date:** 2026-10-06
**Status:** Accepted — Product/Architecture/Data review approved 2026-10-07
**Sources:** `docs/Dinh_nghia_bai_toan_V2.md` (2026-10-06) §§1–22; `docs/implementation-plan/discovery/v2-validation-and-traceability.md`; `docs/north-star/NORTH_STAR.md`; `docs/north-star/SERVICE_MODEL.md`; `docs/canonical/OPEN_DECISIONS.md`; `docs/canonical/DOMAIN_INVARIANTS.md`
**Related:** ADR-001 (CE-1/CE-2 interim), ADR-002 (persistence), ADR-003 (adapter), `RFC-005-v2-domain-questions.md` (domain seams for review); `HYPOTHESIS_REGISTER.md`, `EXPERIMENT_REGISTER.md`, `EVIDENCE_REGISTER.md`

## Context

V2 consolidates the business-problem definition into six layers (pain → causes → measurement → organizational constraints → product behavior → external constraints), proposes three behavioral principles (incomplete observation; distinguish fact origin/reliability; user value before data-entry burden), narrows the first validation package to role A (lightweight operational layer, Pancake as candidate first conversation source, handoff context + follow-up tracking), and defines a disposable validation plan over 50–100 demand-episode files with hypotheses H1–H8 and proposed screening thresholds.

The existing canonical and implementation-plan sources already defer attribution/merge/CRM mapping and keep LVP as an instrumented usable loop, but several north-star, research, and delivery descriptions read as stronger-than-evidenced product promises (full observability, deterministic attribution, Journey as entity, service/control-plane commitments). V2 explicitly says its MVP scope and thresholds are proposed screens, not proof of market demand, pricing, willingness to pay, or technical feasibility, and that legal/API/model details remain unverified.

## Decision (approved; framing and validation scope only)

1. Adopt V2 as the current **problem-framing and validation-hypothesis source**. It does not by itself change frozen canonical semantics, architecture, or phase scope.
2. Keep its first validation package (role A) as the **candidate** validation scope; do not expand PH3–PH6 or promote R-29…R-41 / SERVICE_MODEL §1–3 commitments without separate human/phase-gate decisions.
3. Keep `Journey`, Contact/Organization per-demand roles, universal `Outcome`, and full-channel deterministic attribution as **hypotheses** (H6–H8), not entities/columns/behaviors, until conseqential evidence + alternatives have been reviewed.
4. Apply V2 provenance distinctions (observed / declared / inferred; occurred vs recorded time; evidence quality separate) and **defined-denominator coverage** only as measurement/evaluation rules; do not treat the wording as a canonical vocabulary change until a mapping RFC is approved.
5. Require that every V2-derived evaluation pre-register hypothesis, threshold, sample/denominator, rule/model/prompt version, and evaluation-set partition before scoring, and report `proceed / fail / insufficient data` with numerator/denominator/missingness.

## Consequences

- Implementation-plan artifacts may reference V2 hypotheses, metrics, and the disposable Validation Schema, but production code, persistence, and telemetry must not depend on hypothesis/sample IDs or the validation-only schema.
- North Star remains the long-term aspiration (LG-1); LVP is the bounded validation loop gated by learning and the existing Gate #A / persistence / Pancake-spike gates.
- Any canonical/domain change implied by V2 (obligation model, identity/Contact/Organization, outcome boundaries, provenance/timestamp mapping) requires a separate RFC/ADR that closes or adds an `OPEN_DECISIONS.md` row.

## Alternatives considered

- Merge V2 directly into canonical domain/measurement texts. Rejected: would resolve open decisions without evidence or human review.
- Treat V2 as purely informational with no traceability. Rejected: leaves delivery artifacts prone to over-promising beyond evidence.
