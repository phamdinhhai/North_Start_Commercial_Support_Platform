# Commercial continuity implementation plan (deferred)

This is a plan and evidence map, not a new implementation or an Owner decision.

| Step | Current status | Required next work | Owner policy |
|---|---|---|---|
| Conversation ? authorized Lead | Existing source receipt `lead_id`; Native Inbox does not expose navigation | Add an authorized Lead link action using existing Lead Access Policy and source continuity read APIs | No automatic merge |
| Lead ? Evidence | Existing `/v1/source-integrations/leads/:id/evidence` and Evidence mode | Reuse current API in Native Inbox context panel | Existing policy |
| Evidence ? Context | Existing Lead Detail context command | Add navigation and preserve expected-version/idempotency | Existing command contract |
| Context ? Handoff | Existing canonical handoff command/UI | Link from Lead detail reached from conversation | CE-1 remains open |
| Recipient ? Work | Existing accept/contact/next-action commands | Exercise in React E2E with role fixtures | ADR-006 scope |
| Work ? Outcome ? Audit | Existing outcome/correction/timeline APIs | Add dedicated continuity browser scenario | Won remains a claim, not revenue |

Formal completion of this journey remains an Owner acceptance requirement. No R4.16.3 implementation was started.