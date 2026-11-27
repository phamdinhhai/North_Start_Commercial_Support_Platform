# Chatwoot deep absorption disposition

## Source and legal boundary

- Repository: `https://github.com/chatwoot/chatwoot`
- Immutable source: `5d1afdf3b2f32b88e21899d62fcde12f2c0c33d7`
- Root community code is MIT Expat; `enterprise/` has a separate license and is excluded. Third-party dependencies retain their own licenses.
- The checkout is an isolated sparse research clone. Northstar does not run Rails, Redis, Chatwoot PostgreSQL, Chatwoot authentication or Chatwoot APIs.

## Subsystems inventoried

| Subsystem | Evidence inspected | Disposition | Native Northstar decision |
|---|---|---|---|
| Conversation aggregate | `app/models/conversation.rb`, status/priority enums, assignment, unread timestamps, labels, participants, SLA fields, callback behavior | `PORT_AND_ABSORB` (future) | Add only after canonical conversation/read-model decision. Provider conversation remains distinct from Lead and Customer. Preserve append-only evidence and workspace/connection scope. |
| Message aggregate | `app/models/message.rb`, message type/status/content type enums, source IDs, JSON attributes, flood/content validation, search indexing | `PORT_AND_ABSORB` (future) | Port bounded normalization/validation concepts into source observation contracts. Do not copy message table or permit outbound send; Pancake P3 remains blocked. |
| Conversation finder/search | `app/finders/conversation_finder.rb`, permission filter, inbox/assignee/team/status/label/query filters | `REUSE_TESTS_AND_ALGORITHMS` | Port query semantics only after a native receipt-backed read model exists. Current Northstar evidence endpoints are bounded Lead-scoped reads, not a generic inbox search. |
| Assignment | `app/services/conversations/assignment_service.rb`, auto-assignment services and specs | `ADAPT_EXISTING_NORTHSTAR` | Northstar handoff/ownership services already enforce Lead authority and audit. Reuse lock/idempotency test ideas; do not introduce Chatwoot assignee authority. |
| Labels | `app/models/label.rb`, label concerns/jobs/controllers | `DEFER_WITH_EVIDENCE` | No approved canonical commercial tag model. Do not create a parallel tag store. |
| Lifecycle/status | open/resolved/pending/snoozed, resolution jobs and message-window service | `REJECT_INCOMPATIBLE` for direct import | Northstar CE-1 and commercial workflow decisions are open/frozen. A provider conversation status cannot become a Lead or revenue state. Port only provider-fact status later. |
| APIs | account conversation controller, messages controller, search/filter/assignment/labels endpoints | `ADAPT_EXISTING_NORTHSTAR` | Native Nest controllers must expose sanitized, receipt-backed observations with Northstar OIDC/RBAC/CSRF. Do not expose Chatwoot API surface. |
| Background jobs | resolution scheduler, assignment jobs, unread count stores/listeners, label jobs, message status jobs | `REUSE_TESTS_AND_ALGORITHMS` | Durable sync/checkpoint machinery is Northstar authority. Port bounded scheduling concepts only with PostgreSQL-backed Northstar jobs and audit. |
| Vue inbox | `components-next/Conversation/ConversationCard`, message bubbles, stores/API modules | `ADAPT_EXISTING_NORTHSTAR` | Existing React Inbox adapts list/timeline/context. Chatwoot helper reuse is already pinned in `frontend/src/modules/inbox`; no Vue runtime is required. |
| Tests | conversation/message model specs, assignment/filter/unread-count service specs, API specs | `REUSE_TESTS_AND_ALGORITHMS` | Translate negative cases: workspace scope, permission filter, duplicate source IDs, ordering, status/read completeness and assignment concurrency. |

## Schema comparison and canonicalization

Chatwoot's `conversations` table is account/inbox/contact/assignee centered, with integer IDs, display IDs, UUIDs, status/priority, JSON attributes, labels, participants, SLA and unread timestamps. Its `messages` table has account/inbox/conversation foreign keys, sender polymorphism, message type/status/content type, source IDs, JSON attributes, attachments and search indexes. This is a mature omnichannel schema, but it is not Northstar's canonical model.

Northstar already has immutable source envelopes, provider identity/connection scope, durable integration receipts, evidence, Lead/Customer separation, audit history and workspace RBAC. Importing Chatwoot migrations would create a competing conversation/contact/assignment authority and would violate the anti-corruption boundary. A future native read model should derive from receipts and preserve provider-native IDs, connection ID, observed authority, completeness and provenance. Any migration must be a new Northstar migration with explicit constraints, indexes, backup/rollback and no provider mutation fields by default.

## Runtime and functional evidence

The full Rails application was not started in the Windows Northstar sandbox and is not part of the deployed product. The pinned pure helper and interaction patterns are used by the existing React synthetic Inbox; fabricated threads remain clearly marked and outbound is disabled. No Chatwoot provider request, database, login, job worker or API was used. This is not yet deep functional absorption of the conversation backend.

## R4.16 native implementation plan

1. Define a canonical receipt-backed conversation read model using existing integration receipt/source evidence stores; record an explicit decision against duplicating Lead/Customer.
2. Port Chatwoot's permission-filter and finder test cases into Nest/PostgreSQL contract tests, scoped by workspace, connection, provider native object and bounded cursor.
3. Port message normalization concepts (incoming/outgoing/activity, source ID, timestamp, content completeness) as immutable observation facts. Keep outbound capability disabled.
4. Add assignment/read-state projections only after RBAC and append-only audit contracts are approved.
5. Expose a Northstar `/v1/source-integrations/conversations` read endpoint only when the model and migration are accepted; update React Inbox evidence mode to consume it without replacing existing Lead-scoped evidence.
6. Re-run backup/restore, replay, duplicate, changed-payload, foreign-workspace and incomplete-history tests.

## Explicit non-absorption

Chatwoot Rails, Vue runtime, ActiveRecord migrations, Redis/ActionCable, enterprise code, Chatwoot authentication, account/contact database, generic message send API and provider channel credentials are rejected or deferred. Their omission is intentional and evidence-backed; Northstar remains one codebase, one identity model, one PostgreSQL authority.
