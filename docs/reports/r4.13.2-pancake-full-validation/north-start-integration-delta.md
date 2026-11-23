# North Start integration delta — R4.13.2

Official conversation-scoped observations are message readback, native tags, assignment and provider status. They remain immutable raw envelopes keyed by workspace, connection and external id; they never become Customer, Lead, lineage or revenue. Assignment is observation only and cannot create ownership or bypass lead-scoped RBAC. Send is a separate human-approved capability; this lane performs no live send.

A minimal future adapter injects vault-held credentials, calls only official conversation history/tags/status endpoints, validates account/Page/conversation scope, and emits receipts. It fails closed on 401/403, malformed pages, scope mismatch, cursor gaps and changed payloads. No webhook, worker, outbound mutation, merge, outcome, revenue or attribution projection is admitted. Synthetic fixtures remain the executable authority.
