# LVP Acceptance and Learning Criteria

**Owner:** Product / Engineering / Research  
**Maturity:** Active test contract  
**Evidence status:** Decision rules; not market benchmarks  
**Last updated:** 2026-09-10

## Functional acceptance

A permitted user can:

1. Create/import a lead with raw evidence or an explicit no-evidence state.
2. Assign and accept/reassign ownership.
3. Read/edit context without destroying original evidence.
4. Record a contact attempt/outcome.
5. Create, complete, reopen and reschedule a next action.
6. Record Won/Lost/Unknown and correct it with history.
7. Filter New/Today/Overdue/Closed queues.
8. Export/delete pilot data according to policy.

## Integrity and usability guardrails

- Customer and Lead remain distinct.
- Conversation source, acquisition lineage and attribution remain distinct.
- Inference is visually and structurally distinguishable from a record/claim.
- Every mutation records actor, previous/new value and time.
- AI failure and connector failure do not block the manual loop.
- Sales cannot access leads outside permitted scope.
- Secrets/PII are absent from telemetry and logs.
- Synthetic/demo events cannot enter customer evidence analysis.

## Learning signals

| Question | Product signal | Qualitative signal | Does not prove |
|---|---|---|---|
| Is handoff consumed? | lead/context/evidence opens before action | Can explain customer need | Pain frequency or ROI |
| Is context trusted? | field accepts/edits/rejects; evidence views | Reasons for correction | Objective model accuracy alone |
| Does queue support action? | action create/revisit/complete, return use | Comparison to current reminder | Revenue lift |
| Is minimal truth sustainable? | outcome/unknown capture and correction | Perceived burden/meaning | Company-wide adoption |
| Is manager value emerging? | exception view returns/actions | Decision made from view | Willingness to pay |

## Threshold policy

Numeric thresholds are registered per experiment only after tester count, exposure duration and baseline are known. They are decision aids, not universal success claims.

## Gate review

For each gate record product version, participants/context, observed events, missing telemetry, usability blockers, supporting/contradicting evidence, limitations and Continue/Narrow/Pivot/Stop decision.
