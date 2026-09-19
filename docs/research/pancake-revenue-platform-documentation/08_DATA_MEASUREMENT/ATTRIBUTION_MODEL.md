# Attribution Model

**Owner:** Data / Marketing  
**Maturity:** Framework  
**Evidence status:** Mixed: verified facts, user observations, inference, hypotheses  
**Last consolidated:** 2026-09-09

### Critical design principle
Pancake can be a major conversation source, but the product's **Acquisition Data Hub** must be independent.

Target model:
`Ad/Acquisition sources -> Acquisition Hub -> Source Resolution -> Pancake conversation -> Lead -> Revenue`

Potential sources over time:
- Meta Ads
- TikTok Ads
- Google Ads
- organic social
- referral
- marketplaces / other sources where identifiers are available

Do not assume every conversation source equals a paid acquisition source.

### Three separate attribution concepts
1. **Conversation attribution** - where did the conversation happen?
2. **Acquisition lineage** - what source/campaign/ad originally produced or influenced the lead?
3. **Revenue attribution** - under a defined model, what source receives credit for commercial outcome?

Do not collapse these into one field.

Principle:
> Honest unknown is better than false precision.

---
