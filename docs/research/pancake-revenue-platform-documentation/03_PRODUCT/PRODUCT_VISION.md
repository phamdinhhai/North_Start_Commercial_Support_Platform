# Product Vision

**Owner:** Product Lead  
**Maturity:** Draft v0.1  
**Evidence status:** Mixed: verified facts, user observations, inference, hypotheses  
**Last consolidated:** 2026-09-09

The platform should eventually connect:

`Acquisition -> Conversation -> Lead -> Handoff -> Sales Action -> Outcome -> Revenue -> Attribution -> Learning -> Acquisition`

Do not replace the giants:
- Ad platforms own ad execution.
- Pancake owns conversation operations.
- CRM (when needed) owns enterprise commercial records.
- Our platform owns continuity, meaning, execution intelligence, and cross-system measurement.

### Five engines
1. **Acquisition Intelligence Engine**
   - ad/source connectors beyond Pancake
   - spend/campaign/ad/creative identity
   - acquisition-source resolution
   - lead quality by source
   - revenue feedback to acquisition

2. **Conversation Intelligence Engine**
   - conversation summaries
   - needs, intent, objections, commitments
   - commercial signals
   - voice-of-customer intelligence

3. **Commercial Continuity Engine**
   - identity graph
   - lead creation
   - Marketing -> Sales handoff
   - context continuity
   - lead-scoped permissions
   - original-channel continuity

4. **Revenue Execution Engine**
   - owner
   - CRM-lite commercial state
   - next action
   - follow-up
   - buyer/seller commitments
   - SLA
   - exception-driven work queue

5. **Revenue Intelligence Engine**
   - funnel
   - revenue attribution
   - leakage detection
   - source x Sales performance
   - marketing feedback loop
   - CRM truth / hygiene when CRM exists
   - next-best-action / risk signals

---

## End-state architecture
```text
Acquisition Platforms
Meta / TikTok / Google / Organic / Other
              |
              v
      Acquisition Data Hub
  Spend / Campaign / Ad / Creative
              |
              v
      Source Resolution Layer
              |
              v
Pancake / Interaction Backbone
Conversation / Customer / Agent / Evidence
              |
              v
    Commercial Event Compiler
              |
      +-------+--------+
      |                |
      v                v
Continuity          Execution
Identity            Owner
Handoff             Next action
Channel             Commitment
Context             SLA
      |                |
      +-------+--------+
              v
       Commercial State
        CRM-lite / CRM
              |
              v
        Outcome / Revenue
              |
              v
 Revenue Intelligence Layer
Attribution / Leakage / Data Health
              |
              v
Marketing + Sales + Management Learning
              |
              +------------------> Acquisition
```

---
