# Product acceptance matrix

2026-11-19. This matrix distinguishes implementation, synthetic automation and human acceptance. Canonical invariants and ADR-005–009 govern; CE-1/ID-1/ID-2 remain open. Approval of a technical local rehearsal is not organizational pilot approval.

| Area | Required observable behavior | Evidence / acceptance status |
|---|---|---|
| Manual commercial loop | UI intake → context → handoff → accept → contact claim → action/reschedule/complete/reopen → outcome/correction → feedback/audit/restart; stable identity and original evidence | Existing R4.6 full actual OIDC journey retained; R4.7 integrated rerun pending independent-qa.md |
| Recovery | Actual expired session, new-tab OIDC, same identity/workspace and renewed lead access before draft restoration; no automatic write; 409 refresh retains draft; 403 clears context/draft | New r47-acceptance browser suite; exact execution in independent-qa.md |
| Manager observations | Existing manager/admin workspace read only; explicit classification/page scope, pending age without SLA inference, current overdue work, claim/proof distinctions | Source reviewed; integrated UI acceptance recorded separately |
| Authorization | Sales/viewer do not gain manager read; foreign workspace concealed; current owner/recipient mutation boundaries persist | Existing signed negatives plus new manager check; no privilege expansion |
| Commercial meaning | Customer differs from lead; separate source/lineage/attribution; UNKNOWN visible; Won/contact/declaration remain claims | Automated display and persistence checks; human comprehension NOT RUN |
| Privacy and learning | Synthetic/unknown excluded from business learning; categorical observation files reject extra fields and free-text | New local validator negative tests; not encrypted research storage or approved retention |
| Human task completion/time | Representative Sales attempt unaided first; assisted/outage time and interventions separately | Protocol/scenarios prepared; NOT RUN; no completion rate/time result or threshold |
| Human trust/comprehension | Classify rubric answers and reliance, without interpreting successful clicks as understanding | NOT RUN; business acceptance NOT VALIDATED |
| Operating environment | Private local synthetic only; reproducible startup/readiness/restart/backup/reset/restore; no provider or real data | ENV report and independent review; actual enterprise IdP/HTTPS acceptance remains separate |
| Pilot organization | Approval, accountable observation owner, consent and approved observation retention/access | PENDING; self-operator confirmed, no participants recruited/accounts provisioned |
| Real-data admission | Approved erasure/retention/backup/holds and deployed identity/security acceptance | NOT READY; no change from R4.6 Gate C |

No fabricated acceptance threshold, business benefit, participant result, revenue uplift or pilot completion is asserted. Use the research protocol to gather baseline observations before owners decide a confirmatory threshold.
