# Synthetic pilot scenarios (proposal; human NOT RUN)

Read human-validation-protocol.md before use. Proposed 3–5 people; no recruitment or accounts created. All tasks use invented content, synthetic classification and actual separately authenticated roles. Observer task cards describe goals, not button sequences. Do not convert synthetic observations into business telemetry.

| Task | Participant goal | Observable completion and comprehension rubric |
|---|---|---|
| S01 Intake/context | Preserve an invented conversation as a new commercial episode and explain its identity | Stable Lead ID visible; original evidence preserved; append context; customer differs from lead; synthetic marker recognized |
| S02 Handoff | Ask the assigned Sales recipient to follow up with the supplied context | Recipient can locate same Lead ID and original evidence, then explicitly accept; handoff does not itself prove contact |
| S03 Contact/action | Record an unanswered phone attempt and plan a later action | Contact is a human claim with UNKNOWN occurred time/evidence when absent; no action auto-created; explicitly create/reschedule/complete with declaration/reopen successor |
| S04 Outcome/truth | Record a Won claim, discover payment is unverified, then correct it | Prior Won remains in history; correction appends Unknown; source, lineage and attribution read separately; no claim of verified revenue |
| S05 Recovery | Preserve an unsaved context edit during expired authentication and a competing edit | Sign in in another tab; recheck same user/workspace and lead access; review refreshed context then explicitly submit; 409 does not silently retry; 403 clears inaccessible draft |
| S06 Manager review | Find a synthetic pending handoff and past-due current action | Manager reads classification and bounded page scope, opens permitted lead, distinguishes waiting age from SLA breach and claimed outcome from revenue; sales cannot read workspace exceptions |
| S07 Feedback | Submit a rating for the synthetic task | Feedback separated from categorical telemetry; no invented statement about adoption or value |

For S05 the accountable operator creates the failure condition in the isolated fixture, records technical intervention separately and does not expose session credentials. Switching identity must discard the draft; it is not successful same-user recovery. If the environment cannot safely produce a failure, mark the corresponding task NOT RUN rather than simulate human success.

Record each attempt through the categorical schema. Review incomplete, incorrect, assisted and abandoned results alongside unaided completion. No participant task has been executed in this report.
