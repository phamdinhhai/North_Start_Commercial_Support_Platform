# Product Model

**Owner:** Product / Architecture  
**Maturity:** Draft v0.1  
**Evidence status:** Mixed: verified facts, user observations, inference, hypotheses  
**Last consolidated:** 2026-09-09


## Core model
The platform is composed of five engines: Acquisition Intelligence, Conversation Intelligence, Commercial Continuity, Revenue Execution, and Revenue Intelligence.

## Core primitive
Commercial Event converts evidence from interactions into structured, auditable commercial meaning and suggested action.

## Product modes
- **CRM-less mode**: CRM-lite state, handoff, follow-up, reporting.
- **CRM-connected mode**: CRM remains system of record; platform provides context, evidence, intelligence, hygiene, and attribution.

## Commercial Event detail
Do not let an LLM write directly and opaquely into CRM-like fields.

Preferred architecture:
`Interaction -> AI interpretation -> Commercial Event -> Evidence -> Policy -> Action`

A Commercial Event should contain:
- customer / lead identity
- event type
- timestamp
- source interaction
- evidence
- inferred commercial meaning
- confidence
- suggested mutation/action
- previous value / new value when applicable
- audit trail / undo

Examples:
- PURCHASE_INTENT_INCREASED
- OBJECTION_PRICE
- BUYER_COMMITMENT
- SELLER_COMMITMENT
- FOLLOW_UP_DUE
- LEAD_QUALIFIED
- HANDOFF_CREATED
- SALES_CONTACTED
- OPPORTUNITY_AT_RISK
- WON / LOST

Trust and auditability are product capabilities, not implementation details.

---
