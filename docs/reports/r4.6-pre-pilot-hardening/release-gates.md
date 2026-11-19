# R4.6 release gates

Date2026-11-19. These gates describe evidence and authorization separately. Final local counts are in test-verification.json; source revision is explicitly recorded there. No production deployment, main merge, real customer-data operation or R4.6 push is authorized by this report.

| Gate | Verdict at this checkpoint | Evidence / missing condition |
|---|---|---|
| A Technical LVP | BLOCKED pending exact-revision hosted CI | R4 hosted run69 at cd842c4 FAILED browser restart; product passed. Fixture cause fixed locally with deterministic preconnect regression. R4.6 integrated local17-lane validation PASS at659ca46; even a local pass cannot satisfy the hosted requirement. No blanket absence-of-security-defects claim. |
| B Synthetic Sales Pilot | PREPARATION IMPLEMENTED; acceptance BLOCKED by A | Fabricated UI-only journey, separate source truth/contact claims, classification/exclusion, signed fixture IdP, pilot observation worksheet, role scopes, rollback/recovery runbooks. Isolated deployment and actual operator configuration/review remain necessary. No Sales participant has run the pilot. |
| C Real-customer Pilot | NOT READY FOR REAL CUSTOMER DATA | Retention enforcement, accepted-evidence deletion/anonymization, applicable legal-hold decision, durable research encryption/expiry, real IdP acceptance, full security-critical verification, approved data basis and accountable operations owner are not established. Never auto-approved. |

## Before a synthetic rehearsal

1. Obtain exact-revision hosted product/browser success; retain run URL/SHA and actual job conclusions. Push needs explicit user authorization for this R4.6 work.
2. Use a dedicated environment/database and fabricated synthetic records only. Use approved internal memberships, HTTPS and configured server HMAC keys for a deployed pilot; ephemeral fixture IdP/keys are automated test infrastructure, not deployed identity acceptance.
3. Review ci-assessment.md staging/rollback procedure and assertion-delivery-runbook.md. Leave AI execution, provider writes, Pancake research capture and assertion delivery runner off. Delivery ops are research-only and unavailable in pilot/production by design.
4. Perform scenarios in pilot-scenarios.md with representative Sales; record unaided/assisted task completion, time, errors, interventions and unknown evidence. Keep the worksheet separate from business telemetry; synthetic behavior must not become real commercial learning.
5. Record environment/release/migration versions, operator and observation owners, failure escalation/restore procedure. Stop admission on an authorization/privacy defect; preserve evidence and use reviewed recovery rather than destructive schema rollback.

## Data decision gates

No default legal retention duration was invented. Admin policy references are planning metadata only; preview always executionAvailable=false. Business/legal owners must select class-specific schedules, hold applicability/scope and backup/downstream treatment. An approved invariant-compatible erasure design and tests are required before implementing real-data erasure. A later claim/revision preserves history; it is not anonymization or deletion.
