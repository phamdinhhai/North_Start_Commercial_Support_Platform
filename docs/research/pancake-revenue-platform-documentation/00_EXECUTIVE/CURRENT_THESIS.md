# Current Thesis

**Owner:** Founder / Product Lead  
**Maturity:** Baseline v0.2  
**Evidence status:** Vision and hypotheses; no primary customer evidence yet  
**Last updated:** 2026-09-10  
**Supersedes:** v0.1 consolidated 2026-09-09

## Epistemic baseline

```text
Product vision candidate     Có
Problem hypotheses H0–H8     Có
Scenario giả định            Có
Case khách hàng thực tế      Chưa có
Primary customer evidence    Chưa đủ
```

Earlier repository documents express one brainstorming lineage and cannot be counted as independent evidence. Public/API documentation can establish platform facts but cannot establish customer pain or demand.

## Product vision candidate

A potential opportunity exists between conversation operations and structured commercial operations:

```text
Meaning → Continuity → Action → Intelligence
```

Possible north-star:

> Preserve relationship and commercial meaning from customer interaction through handoff, Sales action, outcome and learning without forcing users to manually translate every conversation into structured data.

This is a vision candidate, not a validated category or scope commitment.

## Platform facts and inference boundary

Pancake exposes conversation/customer/assignment/tag/note/statistics primitives in its documented API surface. Specific endpoint versions, permissions and live behavior require fresh verification. It is an **inference** that a product can create value by adding commercial meaning/process across those primitives.

Traditional CRM commonly structures leads, contacts, opportunities, stages and activities. It is not yet proven that the target customer needs an intermediate product rather than Pancake conventions, Sheets, an existing CRM or process change.

## Problem hypotheses

H0–H8 are canonical in `10_LEARNING/HYPOTHESIS_REGISTER.md`. Central H0 proposes a possible relationship-continuity discontinuity across Pancake/Marketing/Sales/outcome. Each child—context, channel, follow-up, management visibility, Marketing feedback, workaround insufficiency, adoption and repeatability—must be tested independently.

## Current solution bet

For the Lean phase, test only:

```text
Conversation input → Evidence-backed context handoff → Sales action
→ Next action/follow-up → Minimal outcome assertion
```

The proposed value is: Sales can understand the customer, inspect evidence and know what to do next. This is a reversible test, not “the first paid wedge” yet.

## Larger solution candidates

The following remain optional hypotheses and may be narrowed, reordered or removed:

- Commercial Event compiler.
- Lead-scoped original-channel access.
- Commitment extraction.
- CRM-lite state.
- Manager funnel/exceptions.
- Acquisition/source intelligence and attribution.
- CRM bridge and advanced revenue intelligence.

## Conditions that could falsify/narrow the thesis

- Handoff context is already adequate or rarely painful.
- Sales ignores a separate queue or will not record minimal outcomes.
- Follow-up leakage is uncommon or solved better by current tools.
- Pancake/CRM/process alternatives solve the job with lower switching cost.
- Required API/data access is unavailable or commercially unsuitable.
- Useful workflow differs too much by company to productize.
- Value exists only in a much narrower role/vertical/problem.

## End-state provenance

The previous acquisition-to-revenue architecture remains archived as a possible end-state. It must not determine current scope before evidence supports each layer.
