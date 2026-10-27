# Decision Log

**Owner:** Founder / Product Lead  
**Maturity:** Living, append-only  
**Evidence status:** Decisions are not evidence  
**Last updated:** 2026-10-27 (cập nhật cross-reference namespace `VH1–VH8` từ `HYPOTHESIS_REGISTER.md` và tiến độ PH3/pilot-loop; toàn bộ mã `H0–H8` trong tài liệu này là **dãy v1 ngày 2026-09-10**, KHÔNG được nhầm với dãy V2 `VH1–VH8` ngày 2026-10-06)

## Status model

- `active-guardrail`: retained constraint.
- `active-bet`: reversible choice for the current experiment/phase.
- `solution-hypothesis`: plausible, not committed.
- `superseded`: replaced; history retained.

## Current decisions

| ID | Date | Status | Decision | Basis | Revisit trigger |
|---|---|---|---|---|---|
| D-001 | 2026-09-09 | active-guardrail | Do not rebuild Pancake, full CRM, ERP/POS, generic BI/workflow | Focus and existing systems | Evidence shows core job requires owning one boundary |
| D-002 | 2026-09-09 | active-guardrail | Customer and Lead/acquisition episode remain distinct | Domain integrity | Only with explicit model migration rationale |
| D-003 | 2026-09-09 | active-guardrail | Conversation source, acquisition lineage and attribution remain distinct | Prevent false measurement | Only with contradictory verified semantics |
| D-004 | 2026-09-09 | active-guardrail | Important AI/data mutations need evidence, audit and correction | Trust/integrity | Never remove; implementation may evolve |
| D-005 | 2026-09-09 | active-guardrail | Unknown remains unknown; Data Health/provenance stays visible | Honest measurement | Never remove |
| D-006 | 2026-09-10 | active-bet | Use Build–Measure–Learn; recruit/research in parallel rather than gate build | Founder preference for Lean Startup | After L5 or if cost/risk makes build-first irrational |
| D-007 | 2026-09-10 | active-bet | First LVP tests context handoff → Sales action → follow-up → outcome | Smallest loop spanning H1/H3/H7 | External evidence narrows/pivots job or user |
| D-008 | 2026-09-10 | active-bet | Manual/synthetic adapter is required fallback; Pancake sync is optional until verified | Prevent API blocker and false feasibility | Verified sync demonstrates clear learning/usage leverage |
| D-009 | 2026-09-10 | active-bet | Single-tenant controlled pilot before public SaaS | Reduce irreversible scope/security burden | Repeatable external use and commercial readiness decision |

## Reclassified brainstorming outputs

The following were previously phrased as decisions but are now `solution-hypothesis`:

- Commercial Event as the best core primitive.
- Lead-scoped original-channel workspace.
- Follow-up/commitments as the paid wedge.
- Software plus operating methodology as the winning package.
- “Delay CRM” as an entry wedge.
- Shared revenue truth as near-term value.

They remain valuable design candidates but need behavioral, feasibility and viability evidence.

## Superseded decisions

| ID | Date superseded | Prior decision | Replacement |
|---|---|---|---|
| D-S01 | 2026-09-10 | Research/customer discovery gates all product build | D-006: build and discovery run in parallel |
| D-S02 | 2026-09-10 | Proposed “first paid wedge” treated as MVP scope | D-007: reversible LVP working bet |
| D-S03 | 2026-09-10 | Feature-phase roadmap determines sequence | Outcome/learning gates determine expansion |

## Entry requirements

New entries include owner, date, status, alternatives considered, evidence basis, consequences and revisit trigger. A decision may be made under uncertainty but must not be described as validated.
