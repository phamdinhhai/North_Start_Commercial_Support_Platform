# R4.12 QA traceability and release task matrix

| Task | Owner | Priority | Dependency | Owned surface | Acceptance | Status |
|---|---|---|---|---|---|---|
| QA-BASE | r412_qa | P0 | R4.11 exact SHA/CI | QA reports and independent review | Baseline/chronology verified; no stale R4.11 result reused as R4.12 proof | PASS (baseline only) |
| QA-SYNC | r412_qa + sync owner | P0 | migration022 final | Offline polling, crash/replay, lease/checkpoint and PG failures | All A/B/D/F/I scenarios with zero skipped tests | PENDING |
| QA-SEC | r412_qa + security owner | P0 | credential/principal contracts | Forgery, revocation, secret redaction and cross-workspace negatives | Test-only backend fail-closed; no live route | PENDING final integration |
| QA-PROVIDER | r412_qa + provider owner | P1 | provider reports | Pancake/Meta contract fixtures, unsupported events and signature boundaries | Exact hashes/versions and explicit provider authorization blocker | PARTIAL offline |
| QA-OPS | r412_qa + operator owner | P1 | sync health model | Status/lag/gaps/replay/revocation UI/API | UNKNOWN where not observed; manager/admin access only | PENDING |
| QA-REGRESS | r412_qa | P0 | final source SHA | R4.7–R4.11 full regression, migration/restore, MV3/browser/OIDC | Exact source SHA, command, count, coverage and logs | PENDING |
| QA-HOSTED | r412_qa | P1 | Owner push approval | GitHub hosted product/browser jobs | Hosted PASS on exact R4.12 SHA | NOT RUN |

## Runtime limitation

The runtime exposed three child slots. Initial attempts by provider/security/sync to spawn additional QA/identity/operator children returned an agent-thread limit error; no child participation is fabricated. A later slot was used for this dedicated independent QA agent. The six named workstreams remain explicit, with identity/operator work awaiting their own agent outputs.
