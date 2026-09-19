# Commercial Event Schema

**Owner:** Engineering / AI / Product  
**Maturity:** Conceptual  
**Evidence status:** Mixed: verified facts, user observations, inference, hypotheses  
**Last consolidated:** 2026-09-09

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
