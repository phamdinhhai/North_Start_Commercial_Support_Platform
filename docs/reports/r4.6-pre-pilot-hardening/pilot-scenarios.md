# R4.6 pilot observation worksheet

Status: **NOT RUN with human Sales participants**. All automated fixtures are fabricated. Browser durations measure automation only and do not measure Sales task time, adoption or commercial benefit. Synthetic and unknown records remain excluded from business learning. A fabricated record carrying the non-synthetic classification is a disposable telemetry contract probe, never evidence of real customer activity.

## Scenarios for an authorized synthetic rehearsal

Use two separately signed-in people (owner and assigned Sales recipient), a viewer and an unrelated tenant account. Keep the synthetic marker enabled. Do not contact external customers, connect providers or grant additional privileges for the rehearsal.

| Scenario | Completion checklist | Expected evidence / error recovery |
|---|---|---|
| Intake and handoff | Create manual lead; read classification and stable ID; append context; choose assigned recipient; handoff | Original interaction remains unchanged; same Lead ID; recipient sees assigned context |
| Contact claim | Inspect original evidence; accept handoff; record no-answer phone claim with unknown time and missing evidence | UNKNOWN reason visible; actor and recorded time visible; claim creates no action or commercial transition |
| Follow-up | Create next action; reschedule; complete with explicit human declaration; reopen successor | Claim and execution remain distinct; prior action and successor inspectable |
| Truth and outcome | Read separate conversation source, acquisition lineage and revenue attribution; declare Won then correct Unknown | Attribution stays UNKNOWN; correction preserves prior claim and reason; Won is not verified revenue |
| Recovery | Reload; sign out/in; authorized operator restarts application in disposable environment | Stable identity, contact history, actions and corrections survive; process-local login must renew |
| Permission | Viewer attempts mutation; unrelated actor attempts access | Denied; no data or successful mutation implied; assigned actor resumes normally |
| Feedback | Submit rating and optional fabricated description | Feedback recorded separately from content-free product telemetry; no synthetic business aggregate |

## One row per participant and scenario

| Anonymous participant code | Scenario | Started UTC | Finished UTC | Completed unaided? | Observed task seconds | User-visible errors (code only) | Technical interventions count/type | Missing evidence category | Follow-up owner |
|---|---|---|---|---|---|---|---|---|---|
| NOT RUN | NOT RUN | — | — | — | — | — | — | — | — |

Record missing evidence as unknown/redacted/unavailable/not-observed, never invent the evidence. Store no names, contact content, raw lead IDs, session cookies, CSRF values or tokens in this worksheet. Capture success, abandonment and recovery separately. A facilitator intervention ends the unaided attempt; retain its elapsed time and then measure assisted completion separately. Obtain observations before choosing time or error thresholds; this document does not invent acceptance percentages.

## Experiment exposure

Current event metadata records release and flag configuration; that does not prove one exposure per authenticated session. For a future experiment, define exposure trigger, experiment/version/variant and a short-lived random observation code, with at-most-once session behavior, reload persistence and logout reset verified independently. Do not persist authentication session identifiers or turn synthetic observations into real learning. Until approved and implemented, use the manual worksheet above and a separate synthetic automation report; exposure acceptance is **UNVERIFIED**.
