# R4.6 release gates

Date2026-11-19. These gates describe evidence and authorization separately. Final local counts are in test-verification.json; source revision is explicitly recorded there. No production deployment, main merge, real customer-data operation or R4.6 push is authorized by this report.

| Gate | Verdict at this checkpoint | Evidence / missing condition |
|---|---|---|
| A Technical LVP | PASS at6e6cd79 |17local lanes and hosted73 product+browserSUCCESS at exact revision.119files/1178tests,20PGsuites96tests,22HTTP; local lines91.95%, hosted91.93%. Reviewed P0 findings fixed; finite security scope. |
| B Synthetic Sales Pilot | CONDITIONAL: technical preparation ready; environment acceptance pending | Synthetic scenarios/segregation, observer worksheet, UI-only journey, recovery runbooks and feedback tests exist. Actual isolated pilot deployment/HTTPS/identity configuration and accountable operating/observation owners are unverified. No human Sales pilot run. |
| C Real-customer Pilot | NOT READY FOR REAL CUSTOMER DATA | Actual retention/deletion/anonymization, hold applicability/policy, durable raw storage/expiry, deployed IdP/session acceptance, full security-critical coverage and real-data/operator approval remain open. |

Hosted evidence: [run73](https://github.com/phamdinhhai/North_Start_Commercial_Support_Platform/actions/runs/44501840147), hosted-ci-verification.json. Run69/70/72 failures remain historical evidence. The timeout cause in72 remains unproven; the correction provides bounded waits/recovery diagnostics, not a false storage-root-cause claim. Later report-only commits are distinct from the implementation revision.

## Before a synthetic rehearsal

1. Exact implementation-revision hosted product/browser success is recorded at 6e6cd79/run73. Keep release SHA and result linked; any source/test/CI change needs a new run. The user authorized R4.6 push/monitoring; production deployment and main merge remain prohibited.
2. Use a dedicated environment/database and fabricated synthetic records only. Use approved internal memberships, HTTPS and configured server HMAC keys for a deployed pilot; ephemeral fixture IdP/keys are automated test infrastructure, not deployed identity acceptance.
3. Review ci-assessment.md staging/rollback procedure and assertion-delivery-runbook.md. Leave AI execution, provider writes, Pancake research capture and assertion delivery runner off. Delivery ops are research-only and unavailable in pilot/production by design.
4. Perform scenarios in pilot-scenarios.md with representative Sales; record unaided/assisted task completion, time, errors, interventions and unknown evidence. Keep the worksheet separate from business telemetry; synthetic behavior must not become real commercial learning.
5. Record environment/release/migration versions, operator and observation owners, failure escalation/restore procedure. Stop admission on an authorization/privacy defect; preserve evidence and use reviewed recovery rather than destructive schema rollback.

## Data decision gates

No default legal retention duration was invented. Admin policy references are planning metadata only; preview always executionAvailable=false. Business/legal owners must select class-specific schedules, hold applicability/scope and backup/downstream treatment. An approved invariant-compatible erasure design and tests are required before implementing real-data erasure. A later claim/revision preserves history; it is not anonymization or deletion.
