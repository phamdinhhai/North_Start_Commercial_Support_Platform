# Pancake Integration

**Owner:** Engineering  
**Maturity:** LVP feasibility track; not production commitment  
**Evidence status:** Audited documentation snapshot dated 2026-09-10; current/live verification required  
**Last updated:** 2026-09-10

## Role and boundary

Pancake can provide conversation-side primitives. Internally map them through an adapter to neutral concepts such as `ExternalConnection`, `ConversationRef`, `InteractionEvidence`, `ExternalIdentity` and `Assignment`.

Never use Pancake objects directly as the core Lead/outcome model. Pancake as interaction source is not universal acquisition lineage or revenue attribution.

## Source of truth for implementation

Follow the audited knowledge-base `AI_README.md`, `GAP_AUDIT_v1_to_v2.md`, `SCOPE_AND_COMPLETENESS.md` and `machine_readable/endpoint_catalog_verified.json`.

Current official reference/changelog takes precedence over the snapshot. `endpoint_verified` is dated evidence that a method/path was seen; it does not prove current version, access, fields or production eligibility. `family_verified` cannot be used as a contract.

## LVP policy

- Manual/synthetic inbound adapter is P0 and remains fallback.
- Read conversations/messages/customers is a P1 feasibility track.
- Webhook is experimental until live event/payload/security/delivery semantics are captured.
- Sending messages is deferred pending validated product need, exact permission and commercial terms.
- Statistics/ad endpoints do not justify cross-platform source or attribution claims.

See `PANCAKE_LVP_FEASIBILITY.md` for the capability matrix and live-test Definition of Done.

## Snapshot notes to reverify

- Documented model: `Page/Connection → Conversation → Message → Customer`, with tags, assignment, notes and users.
- Conversation listing snapshot mentioned 60/request and `last_conversation_id` pagination.
- Snapshot rate limit: 5 calls/page/second with HTTP 429; connector design needs a per-page limiter, bounded retry and failure inspection.
- Snapshot authentication places tokens in query parameters; redact URLs/query values across app, proxy, logs, traces and error reporting.

## Integration guardrails

- Encrypted server-side credentials and least privilege.
- Per-workspace connection; internal authorization enforces lead-level access.
- Store immutable raw envelope/pointer and map via versioned projection.
- Idempotency from connection + external record/event ID or a documented fallback key.
- Cursor/checkpoint and backfill are separate from canonical state.
- Unknown/missing fields stay unknown; mapping failure preserves raw evidence.
- Contract tests use captured anonymized fixtures only after permitted live verification.
