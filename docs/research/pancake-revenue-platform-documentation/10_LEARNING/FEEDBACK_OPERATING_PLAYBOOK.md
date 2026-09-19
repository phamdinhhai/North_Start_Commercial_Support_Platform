# Feedback Operating Playbook

**Owner:** Product / Research / Implementation  
**Maturity:** Active for Lean phase  
**Evidence status:** Operating method  
**Last updated:** 2026-09-10

## Recruitment runs with build

Target a pipeline of 5–10 candidates to reach 1–3 external testers. A candidate need not agree with the product thesis. Recruit people who understand or perform a real Marketing-to-Sales workflow.

If no external tester exists by Gate L3, stop feature expansion. Continue only usability, integrity, security and recruitment work.

## Before a session

- Obtain permission for observation/recording and data use.
- Prefer a recent real task; use synthetic data only for safety or onboarding.
- Record participant role, current tools, workflow context and product version.
- Pre-register the primary question in the Experiment Register.
- Confirm telemetry and delete/export controls.

## Session structure

1. Ask for the last comparable task before showing the product.
2. Give a goal, not click-by-click instructions.
3. Observe actions, hesitation, workarounds and ignored elements.
4. Ask what the participant expected after the task.
5. Ask for comparison with the existing workflow.
6. Debrief only after behavior has been observed.

Avoid “Do you like it?” and future speculation. Prefer “What did you do the last time?”, “What happened next?” and “Show me.”

## Classify incoming information

| Input | Meaning | Action |
|---|---|---|
| Product event | Behavior inside observed product boundary | Register F0 with version/context |
| Quote/self-report | Participant claim | Keep as claimed, not observed fact |
| Feature request | Proposed solution | Find job/pain and frequency before backlog |
| Error/friction | Usability or implementation issue | Fix if it blocks the test |
| Workaround | Current alternative | Compare cost and effectiveness |
| Outcome claim | Possible consequence | Seek supporting records where allowed |

## Weekly synthesis

- Review supporting and contradictory evidence.
- Separate UX failure from hypothesis failure.
- Update registers and limitations.
- Select exactly one highest-risk learning goal.
- Decide Continue / Narrow / Pivot / Stop / Inconclusive.
- Do not aggregate multiple people in one company as independent company cases.
