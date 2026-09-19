# Data Quality Rules

**Owner:** Data / Ops  
**Maturity:** Draft  
**Evidence status:** Mixed: verified facts, user observations, inference, hypotheses  
**Last consolidated:** 2026-09-09

A closed-loop dashboard must expose measurement quality.

For each source/funnel:
- deterministic linkage rate
- inferred linkage rate
- unknown rate
- missing handoff linkages
- duplicate risk
- outcome coverage

Display confidence such as:
- Known
- Inferred
- Unknown

Example:
`TikTok: 87% source matched, 9% unknown source, 4% linkage lost during handoff.`

Manager should see both performance and measurement coverage.

---

## Core rules
- Preserve immutable external IDs.
- Never overwrite source lineage without history.
- Every handoff has a stable Lead ID.
- Unknown is a valid state.
- Every AI-derived value stores evidence/confidence/model version.
- Every merge/unmerge is audited and reversible.
