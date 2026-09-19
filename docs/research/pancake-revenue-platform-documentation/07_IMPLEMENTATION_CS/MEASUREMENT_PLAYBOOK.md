# Measurement Playbook

**Owner:** CS / Data / Product  
**Maturity:** Strategic core  
**Evidence status:** Mixed: verified facts, user observations, inference, hypotheses  
**Last consolidated:** 2026-09-09

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

## Data health
A closed-loop dashboard must expose measurement quality.

For each source/funnel:
- deterministic linkage rate
- inferred linkage rate
- unknown rate
- missing handoff linkages
- duplicate risk
- outcome coverage

Display confidence such as:
- Known
- Inferred
- Unknown

Example:
`TikTok: 87% source matched, 9% unknown source, 4% linkage lost during handoff.`

Manager should see both performance and measurement coverage.

---
