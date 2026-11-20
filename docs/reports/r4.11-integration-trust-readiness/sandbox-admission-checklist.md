# Sandbox admission checklist — BLOCKED_PROVIDER_AUTH

2026-11-20. This is a required evidence checklist for a later decision, not permission to create a resource. No item is satisfied by the offline emulator or an operator's local synthetic admin fixture. ADR-006/007 per-capability gate and PH4 verdict still apply.

| Required evidence | Current status |
|---|---|
| Named account/Page/shop ownership and written workspace authorization, exact account IDs and bounded purpose | NOT PROVIDED |
| First-party provider approval/app review/partner eligibility and current endpoint/version, no private protocol substitution | NOT PROVIDED |
| Exact read/input scopes and role requirements; separate consequential/outbound capabilities denied | NOT PROVIDED |
| All participants/assets/messages fabricated in an isolated test account; no production inbox or real customer data | NOT PROVISIONED |
| Approved TLS endpoint/origin, raw-byte size limits, provider-specific signature/authentication and independent connection binding | NOT IMPLEMENTED; no public route |
| Server OAuth client/redirect validation; vault-only token/app-secret references; tenant isolation and redaction | DESIGN ONLY |
| Versioned encryption/content keys, least privilege, expiry/rotation and compromise/revocation drill | NOT IMPLEMENTED |
| Transactional receipt/checkpoint persistence, idempotence, quarantine/reconciliation and visible gaps; bounded retry policy | OFFLINE CONTRACT ONLY |
| Replay controls based on actual provider contract; no assumption signature equals freshness or inbox permission | NOT ESTABLISHED |
| Revoke connector and provider token, stop jobs/subscriptions; no further intake after authorization loss | OFFLINE REVOKE TEST ONLY |
| Retention/deletion policy, cleanup owner/date, remove subscriptions/tokens/assets and prove cleanup | NOT PROVIDED |
| Human per-capability decision, accountable owner, rollback/kill switch and PH4 evidence verdict | NOT PROVIDED |

Future test plan must begin with synthetic-only intake and authenticated readback, never outbound Sales messages, budgets, orders, conversions or commercial transitions. Browser/Phoenix remains research/gap detection. A provider signature cannot grant Lead access or resolve CE-1, ID-1 or ID-2. Current deliverable creates no live resources and requires no credential exchange.
