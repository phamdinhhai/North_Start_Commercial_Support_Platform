# Pancake contract assessment

**Classification:** `RESEARCHED` + bounded `CONTRACT_PREPARED`; offline synthetic path remains `OFFLINE_VERIFIED`; admission is `BLOCKED — PROVIDER AUTHORIZATION`.

## Retrieval and validation

Anonymous retrieval on 2026-11-20 returned the same bytes as R4.11:

- REST: `https://developer.pancake.biz/openapi/openapi.yaml`, HTTP 200, 180475 bytes, SHA-256 `1340453bf7ff92979e875d99577fc1948d10b2ede1d0da58c9df009258aef39f`, OAS 3.0.0/info 1.0.0, 28 paths.
- Webhook: `https://developer.pancake.biz/openapi/webhook.yaml`, HTTP 200, 38933 bytes, SHA-256 `ab327fea1a398553351edde68a992f96c66dbc6fc4a93045d1d23e03f8d0e09d`, OAS 3.0.0/info 1.0.0, five top-level webhook definitions.

UTF-8 YAML parsing succeeds. Full OpenAPI validation still fails: REST has 21 diagnostics, including invalid `schema.type: UUID`, six `WhatsappTemplate*` `properties.type` object defects and unresolved `page_id` in token generation; webhook has two diagnostics because an OAS 3.0 document omits `paths` and uses top-level `webhooks`. Original files are preserved; no compatibility overlay or generated client is claimed.

## Contract facts and limits

| Concern | Documented subset | Admission implication |
|---|---|---|
| Auth | REST documents `access_token`/`page_access_token` query parameters, page token regeneration and expiry/deletion behavior | Query tokens must never appear in browser URLs, redirects, logs or traces; server vault reference and redaction are prerequisites. A page token permits writes as well as reads. |
| Scope | Page/account identity and endpoint-specific permissions are separate | Bind every request to a server-side workspace/connection/page; payload fields cannot choose a connection. |
| Pagination | Conversation history uses provider cursors such as `last_conversation_id`; message/history limits are endpoint-specific | Treat cursors opaque; persist checkpoint only after durable receipt transaction; exhaustion does not prove complete history. |
| Identity | Native Pancake IDs include page/conversation/message fields | IDs do not prove original Meta identity, Customer identity, Lead identity or commercial episode. |
| Events | Messaging/conversation/subscription/post/connect_status envelopes differ | Route is a schema discriminator; do not normalize all event shapes into one trusted message. |
| Edits/removals | REST `edit_history` is array/null; webhook shape differs; `is_removed` is provider metadata | Preserve append-only observations; do not overwrite evidence or infer deletion authority. |
| Media | Attachment objects and URLs are documented with endpoint-specific fields | Store bounded references only; no URL fetch or HTML rendering without separate policy. |
| Limits | Public API rate and 429/backoff behavior are documented; exact webhook retry/authentication is not established | Bounded backoff and explicit health state; no exactly-once or retry-window claim. |
| Writes | Assignment/message APIs exist | Outbound actions remain disabled; read-only intent does not change provider token capability. |

The messaging webhook specification does not establish a cryptographic signature or replay contract. POS secret headers are not transferable to Conversations. A future receiver must remain disabled until Pancake documents and owner approves authenticity, connection binding, replay handling and cleanup.

## Offline evidence

R4.10/R4.11 synthetic Pancake decoding and shared intake verify fabricated native IDs, tenant scope, idempotency, collision handling, evidence provenance and `UNVERIFIED` status. R4.11 offline transport tests cover opaque cursors, rate limits, timeout, poison page, gaps, revoke and checkpoint-before-ack as a port contract. These tests do not call Pancake and do not prove token rights or live schema compatibility.

## Pancake admission checklist

Before any network request, owner must provide a named account/page, written workspace authorization, exact read scopes, provider-approved synthetic-only assets, endpoint/origin policy, credential custody, redaction tests, webhook authenticity evidence, retention/cleanup owner and stop procedure. Missing any item means remain `BLOCKED — PROVIDER AUTHORIZATION`.

## Unsupported/deferred

No production adapter, OAuth broker, public receiver, POS connector, message send, conversion writeback, unofficial client or personal-account bridge is introduced. POS and Conversations credentials are separate. Personal-account history is not inferred from Pancake UI channel labels.
