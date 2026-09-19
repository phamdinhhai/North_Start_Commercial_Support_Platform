# Open Questions

**Owner:** Founder / Product / Research / Engineering  
**Maturity:** Active validation and blocker backlog  
**Evidence status:** Unknowns and hypotheses  
**Last updated:** 2026-09-10

Do not present these as facts. Priority reflects risk to the current LVP, not market importance.

## Desirability and adoption

| ID | Question | Hypothesis | Risk | Test | Blocker |
|---|---|---|---|---|---|
| Q-D1 | Does evidence-backed context materially improve the first Sales action? | H1/S1 | Critical | EXP-01 | No |
| Q-D2 | Is original-channel continuity important versus phone/Zalo/current behavior? | H2 | High | Recent-case observation | No; channel feature deferred |
| Q-D3 | Is follow-up leakage frequent/painful enough for repeat use? | H3/S2 | Critical | EXP-02 | No |
| Q-D4 | Will Sales sustain minimal action/outcome updates? | H7/S3 | Critical | EXP-02/03 | No |
| Q-D5 | Are current tags/notes/Sheets/CRM already good enough? | H6 | Critical | Workflow comparison | No |
| Q-D6 | Is there repeatability across companies/verticals? | H8 | Critical | Compare real cases | Yes for category claim, no for LVP build |

## Viability and buyer value

| ID | Question | Hypothesis | Risk | Test | Blocker |
|---|---|---|---|---|---|
| Q-V1 | Who owns urgency, budget and process-change authority? | H4/H7 | Critical | External buyer exposure | Yes for pricing/GTM claim |
| Q-V2 | Does manager visibility produce action, not just interest? | S4 | High | Manager exception experiment | No; feature deferred |
| Q-V3 | Is any observed utility worth paying for or only nice-to-have? | viability | Critical | Commitment/payment test after usage | Yes for commercial claim |

## Feasibility and integration

| ID | Question | Risk | Test | Blocker |
|---|---|---|---|---|
| Q-F1 | Are current Pancake read endpoints accessible with needed fields/permissions? | High | Live feasibility spike | No; manual fallback |
| Q-F2 | What are webhook events, payload, security, retry/order semantics by channel? | High | Live raw capture | Yes for realtime sync only |
| Q-F3 | Are message sending and commercial terms suitable? | High | Official + account verification | Yes for outbound; deferred |
| Q-F4 | Can AI extract Vietnamese commercial context usefully and safely? | High | Consented eval + EXP-04 | No; manual fallback |

## Data, trust, privacy and execution

| ID | Question | Owner | Blocker |
|---|---|---|---|
| Q-X1 | Who are the first external testers and recruitment owner? | Founder/Product | Yes for L5; scope freezes at L3 without them |
| Q-X2 | May real conversation data be used, for what purpose/retention/provider? | Founder/Security | Yes for real-data ingest |
| Q-X3 | Who owns credentials and account consent? | Founder/Engineering | Yes for API spike |
| Q-X4 | What is actual build capacity and selected stack? | Founder/Engineering | Yes before implementation plan |
| Q-X5 | Vietnamese-only UI or bilingual from first release? | Founder/Product | No; default hypothesis is Vietnamese-first |
| Q-X6 | Is manual import enough for first external test or is read sync required by tester workflow? | Product/Tester | No; decide from recruitment context |

Resolve questions through dated evidence or decisions; do not remove unresolved rows silently.
