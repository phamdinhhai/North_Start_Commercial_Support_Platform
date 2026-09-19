# AI Architecture

**Owner:** AI / Engineering  
**Maturity:** LVP guardrails; optional feature  
**Evidence status:** Solution hypothesis S5, not validated  
**Last updated:** 2026-09-10

## LVP role

AI may draft context, needs, objections, commitments or next actions. The manual product loop must work when AI is disabled, unavailable or wrong.

## Pipeline

```text
Versioned evidence → prompt/model/rule version → validated structured draft
→ evidence spans + inference metadata → user/policy decision → append-only audit
```

## Required controls

- Server-controlled feature flag and recorded experiment exposure.
- Schema validation; invalid output fails closed to manual input.
- Evidence span/pointer for each derived commercial field.
- Inference status and confidence only where meaningful/calibrated.
- Draft-by-default for high-impact or ambiguous truth.
- Capture accept/edit/reject and reason where low friction.
- Record previous/new value, model/prompt version and actor.
- Timeout/error fallback without blocking handoff or Sales action.
- No token/raw PII in telemetry, logs or evaluation artifacts.

## Evaluation

- Build an evaluation set only from consented/allowed, access-controlled and PII-minimized data.
- Separate extraction correctness, evidence grounding, usefulness and workflow impact.
- User acceptance is not objective correctness; correction data is a learning signal, not automatic training consent.
- AI becomes default only after Gate L4 shows net workflow value without trust/integrity regression.

## Deferred

Autonomous state changes, routing, revenue prediction, attribution and outbound messaging are outside the LVP.
