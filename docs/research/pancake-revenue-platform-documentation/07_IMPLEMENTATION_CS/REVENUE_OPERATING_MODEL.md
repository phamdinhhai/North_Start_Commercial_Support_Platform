# Revenue Operating Model

**Owner:** Product / CS / Ops  
**Maturity:** Strategic core  
**Evidence status:** Mixed: verified facts, user observations, inference, hypotheses  
**Last consolidated:** 2026-09-09

Closed-loop revenue measurement requires:
**Software + Data Model + Operating Methodology**.

If Marketing hands Sales only a phone number and Sales works independently, source lineage dies at handoff.

### Required immutable entity
Create a stable `Lead ID` (or acquisition episode ID) linking:
- customer identity
- source/campaign/ad identifiers
- original conversation
- Marketing owner
- timestamps
- Sales owner
- downstream activities
- commercial outcome
- revenue

### Minimum Sales truth that must be captured/confirmed
Keep required fields minimal:
- contact outcome
- qualified/unqualified
- current state
- won/lost
- revenue and/or lost reason

AI should automate extraction where confidence is high, but organizational truth sometimes requires explicit confirmation.

---

## Measurement operating model
The company must define shared semantics before dashboards are trusted.

### Marketing definitions
- What is a Lead?
- What is Qualified?
- When does Marketing hand off?
- How are returning customers handled?
- How are campaign/ad identifiers preserved?

### Sales definitions
- SLA to accept/contact a lead
- What does "Cannot contact" mean?
- What is Qualified from Sales' perspective?
- When is Won recognized?
- Required Lost reasons

### Management definitions
- Revenue recognition point: deposit, contract, payment, etc.
- Attribution model
- Duplicate/re-open policy
- SLA ownership

Potential product capability: **Measurement Readiness Setup** that configures these definitions and enforces them.

Example:
- Qualified = phone exists + target geography + product need
- Cannot contact = 3 attempts within 48h
- Won = deposit received

---
