# Minimum LVP Truth Contract

**Owner:** Data / Product / RevOps  
**Maturity:** Active for Lean Validation Product  
**Evidence status:** Product/operating decision over unvalidated workflow hypotheses  
**Last updated:** 2026-09-10  
**Supersedes:** 2026-09-09 closed-loop revenue contract for the current phase only

## Purpose

The LVP needs enough structured truth to run and observe the handoff/action loop. It does **not** require revenue or attribution completeness.

## Stable records

- A stable `Lead ID` represents one commercial/acquisition episode.
- `CustomerRef` and external identities remain separate and may relate to multiple leads.
- Original conversation/evidence references remain immutable where source policy allows.
- Owner/state/outcome corrections append audit history.

## Minimum handoff input

- Lead ID and workspace.
- Customer reference or explicit unidentified customer.
- Raw evidence/pointer or explicit no-evidence reason.
- Handoff creator and captured time.
- Sales owner or unassigned state.
- Conversation channel and acquisition source represented independently; either may be unknown.

## Minimum Sales input

Capture only what the current test requires:

- Handoff accepted/rejected/reassigned.
- Contact attempt and contact outcome.
- Next action, owner, due time and completion status.
- Minimal commercial state.
- Outcome assertion: Won, Lost or Unknown; lost reason/revenue remain optional in this phase.

## Semantics

- A product click is an automatic observation inside the product.
- A Sales-entered contact/outcome is a human claim unless corroborated.
- An imported value is an imported record, not automatically canonical truth.
- An AI-produced value is inference until accepted/confirmed according to policy.
- Missing source/revenue must remain unknown; do not backfill with assumptions.

## Optional future closed loop

Source/campaign/ad, downstream revenue and attribution records can be added when the relevant hypotheses, data access and operating behavior are supported. Their absence does not make the LVP unusable.
