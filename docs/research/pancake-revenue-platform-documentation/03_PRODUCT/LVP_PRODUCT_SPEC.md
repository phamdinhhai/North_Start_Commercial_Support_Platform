# Lean Validation Product Specification v0.1

**Owner:** Product Lead  
**Maturity:** Approved build bet; scope can change through evidence  
**Evidence status:** Solution hypotheses, not customer validation  
**Last updated:** 2026-09-10

## Product promise under test

> When receiving a lead, Sales can quickly understand what the customer needs, inspect original evidence and know the next action without relying on memory.

## Target exposure

A usable single-tenant pilot product for controlled internal/external testing. Not a public SaaS and not a production commercial promise.

Initial role hypotheses:

- **Operator/Marketing:** creates/imports and hands off a lead.
- **Sales:** accepts context, records action and manages next action.
- **Manager/Admin:** manages access and may inspect exceptions.

## Core loop

1. Operator creates a lead through paste/import; synthetic demo data is labeled.
2. Product keeps raw evidence and provides an editable context draft.
3. Lead is assigned; channel/source is shown only with provenance.
4. Sales reviews customer need, evidence and proposed next action.
5. Sales records contact outcome and creates/completes follow-up.
6. Sales records a minimal outcome or explicit unknown.
7. Product captures audit history, telemetry and structured feedback.

## P0 capabilities

- Authentication and minimal role-based access.
- One isolated pilot workspace and demo workspace.
- Manual conversation input/import.
- Lead create, assignment, acceptance and reassignment audit.
- Evidence-backed editable context summary.
- Sales queues: New, Today, Overdue, Completed/Closed.
- Lead detail with timeline and provenance.
- Contact attempt/outcome; next action with due/complete/reopen.
- States: New, Accepted, Contacting, Follow-up, Won, Lost, Unknown.
- Append-only audit for state and user/AI edits.
- Product telemetry, release version and experiment exposure.
- Structured feedback; pilot data export/delete.

## P1 only after first exposure

- Pancake read sync for conversations/messages/customers.
- AI extraction behind a feature flag.
- Manager exception view using observed actions.
- Basic usage/data-coverage view.

P1 must not delay Gate L3 and must earn default inclusion at Gate L4.

## Deferred

- Message sending through Pancake.
- Meta/TikTok acquisition connectors.
- Revenue attribution, lost-revenue calculation and advanced funnels.
- Automated identity merge/graph.
- Full CRM, workflow builder and forecasting.
- Public signup, billing and enterprise multi-tenancy.

## Core states

```text
New → Accepted → Contacting → Follow-up → Won / Lost
                              ↘ Unknown
```

Transitions are not objective truth unless backed by a source. Store actor, occurred/captured time, acquisition mode, previous/new value and reason. Reopen and corrections append history.

## UX rules

- Optimize for a daily exception/action queue, not another database to maintain.
- Show raw evidence beside derived context.
- Never hide unknown behind fabricated source/confidence.
- Manual fallback remains available if AI or integration fails.
- Capture only the minimum state needed to test the loop.

## Data and telemetry boundary

Product events prove only behavior inside the product. Outcome entered by a person is a claim unless corroborated. Synthetic/demo events are segregated from external evidence.

## Release rule

A capability is release-ready only when functional acceptance, authorization, audit/provenance, telemetry, failure fallback and hypothesis/experiment links are complete.
