# Pancake deep research — R4.10 PAN-01..05

Observed 2026-11-20 against baseline `9ffae60`. Anonymous documentation GETs only. No credentials, accounts, customer traffic, writes or live connector tests. ADR-005..009 and I-01..12 apply; this does not close provider or pilot gates.

## Pinned public documentation

Downloads stay outside the repository in OS temporary directory `r410-pancake-9csvjclx`. SHA-256 below hashes public documentation, never customer content.

| Source | HTTP | Bytes | SHA-256 |
|---|---|---|---|
| [REST YAML](https://developer.pancake.biz/openapi/openapi.yaml) | 200 | 180475 | 1340453bf7ff92979e875d99577fc1948d10b2ede1d0da58c9df009258aef39f |
| [Webhook YAML](https://developer.pancake.biz/openapi/webhook.yaml) | 200 | 38933 | ab327fea1a398553351edde68a992f96c66dbc6fc4a93045d1d23e03f8d0e09d |
| [Webhook rendering shell](https://developer.pancake.biz/webhook) | 200 | 1396 | 8c1420348afd304db00d913a25bb83d0ddaf91a49f905029602b6d08c89e247f |
| [MCP guide](https://docs.pancake.biz/pancake/st-f12/st-p3?lang=en) | 200 | 2708834 | e638e7ca9829658dc49ef1abbfac047d39ce10f07ad2d0af93a8e34f0096286c |
| [POS overview](https://pos.pancake.vn/developers/api/en) | 200 | 1109259 | ee0bc62085e59526e4bc336b46d7c3e87c29a615c6e727b99aaa313cc3fb0f00 |
| [POS webhooks](https://pos.pancake.vn/developers/api/en/webhooks) | 200 | 1102553 | fe11825125712fb7a1627d0c836d975d881fe4350ad63b8af3f250154e88e4ac |
| [Requested root llms URL](https://pos.pancake.vn/llms-full.txt) | 404 | — | — |
| [Corrected POS full docs](https://pos.pancake.vn/developers/api/llms-full.txt) | 200 | 497259 | 8455b9f530f3282aa281515a0be445509a61b428f62076e7358e501e1476a2fb |

Both YAML documents declare OpenAPI3.0.0 and info.version1.0.0. HTML/POS text do not establish a stable API version; hashes pin observed bytes only.

## Actual parse and validation

PyYAML parsed both originals. REST:28 paths,21 local reference occurrences; webhook:five top-level webhooks,11 reference occurrences. All local references resolved. `openapi-spec-validator` rejected both originals: REST PUT `/pages/{page_id}/page_customers/{page_customer_id}` has invalid `schema.type: UUID`; webhook declares3.0.0 but omits required `paths` and uses top-level `webhooks`. These source defects were not patched away. Parsing/reference resolution does not mean valid OpenAPI or proven runtime conformance. No authenticated endpoint was called.

## Authentication, rate and isolation

REST authentication section specifies URL query `access_token` for account `/api/v1` (up to90days or logout), `page_access_token` for one page's `/api/public_api/v1` and `/v2` (until deletion/regeneration). No Authorization header. Regeneration invalidates prior page token. Page tokens grant mutations as well as reads; read-only application behavior does not establish read-only provider credentials. Public API limit is5calls/page/second,429/backoff.

Future live implementation needs admin-managed server vault references isolated by workspace/connection/page, endpoint-origin allowlist, no browser tokens, and no redirects carrying secrets. Prefer telemetry route templates/status only; redact query keys `access_token`, `page_access_token`, `api_key`, including case/encoding variations, before access/error/retry/trace logging. Synthetic mapping accepts no request URL or credentials. No credential storage or HTTP transport is added.

POS uses separate shop/account `api_key`; credentials are not interchangeable with messaging. Twenty wrong keys/minute/IP causes5minute lock (429/code109/Retry-After). GET quota under30requests/sec per endpoint/scope, writes under100, inventory histories3/sec. Respect Retry-After/backoff.

## History and native identity

REST v2 conversations:up to60records, `last_conversation_id` pagination, type/tag/post/time filters and partial `fields`. REST v1 message history: `current_count`,30messages prior to index. Chat Plugin has separate offset pagination. Cursor exhaustion alone does not prove complete history or a snapshot watermark. Some errors return HTTP200 with `success:false` (invalid fields:error100).

Message fields include `id`, `page_id`, `conversation_id`, `type`, `inserted_at`, `is_removed`, `removed_by`, `edit_history`, sender and attachments. IDs are Pancake-native: they do not prove original Meta identities. Scope by provider/account/conversation/message; do not join routes by content/time. Inbox conversation can be PSID; comment conversation can combine post/comment IDs. None is a Lead ID or canonical Customer ID. Original Meta linkage requires explicit separately supported fixture evidence.

REST date section states offsetless datetime strings are UTC+0 except feedback's page-local time; webhook message timestamp is described UTC. Preserve raw provider time; missing occurrence time remains UNKNOWN, never replaced with ingest time.

## Edits, deletes and media

REST `edit_history` is array/null; webhook `edit_history` is object/null. REST `private_reply_conversation` is string/null; webhook object/null. Route is a schema discriminator. Presence of history is not a new immutable revision or proof of latest edit. `is_removed` is provider removal metadata, not permission to erase prior evidence. `can_remove` is a permission flag, not a deletion. No dedicated message edit/delete REST method or ordered immutable message revision feed was established.

REST attachments document photo/video/sticker/template/system_message, ID/URL/MIME/video metadata; webhook attachment objects are unspecified. URLs are references, not downloaded artifacts; expiry and rights remain UNKNOWN. Rendered `message` can contain HTML; downstream display must escape/sanitize. Upload/send APIs are documented but remain gated outbound capabilities (ADR-007).

## Webhooks, assignment and readback

Events:`messaging`, `conversation`, `subscription`, `post`, `connect_status`. Messaging envelope:`{page_id,event_type:'messaging',data:{conversation,message,post}}`. Retain native IDs; do not invent event IDs from message IDs. ConversationEvent.version is documented monotonic; message-level version guarantees are UNKNOWN.

Admin setup consumes one additional connection slot/page. ACK200 quickly (preferably under5seconds), process asynchronously/idempotently. Within30minutes,error rate>80% plus>=300failures suspends delivery; manual re-enable resumes **new events**. Retry schedule, historical replay, maximum redelivery window and cryptographic signature remain UNKNOWN in this spec; no webhook security scheme/header found. POS header behavior must not be imported into messaging.

Assignment POST, GET users and conversation assignee histories exist. Provider assignment never grants platform roles/Lead access/handoff ownership (ADR-006/I-09). Read/seen is a provider marker, not customer acceptance or Sales action. Scoped history GET is a readback candidate; no send/readback verifier was exercised.

## POS boundary

Full docs describe order/customer/product/inventory/einvoice/auto_call webhooks, configured secret headers, ACK2xx within30seconds. First failure emails configured address, retries after10minutes then30minutes later then stops; persistent failure pauses, invalid URL disables. Backfill through update-time-filtered Open API. Paging is endpoint-specific `page_size` with `page_number` or `page`. Order filters include `updateStatus=updated_at` and Unix time bounds.

Money uses integer storage units: VND/TWD/LAK/PHP/MMK/JPY/INR/COP/IDR/CLP/PYG whole units; others hundredths. Order amounts use `order_currency`, costs/shop prices use shop currency; e-invoice item amounts can be display units. Preserve amount/currency/scale/timezone/payment-proof provenance. Order-created/received/COD/paid_at/transfer proof never automatically means platform paid/Won/outcome/revenue attribution (ADR-005/008).

## Channel coverage and remaining unknowns

UI navigation names Facebook/TikTok/WhatsApp/Google; specs include TikTok-prefixed examples and Facebook/Zalo Page references. This is documentation evidence, not verified per-channel API coverage or personal-inbox authorization. INBOX/COMMENT are provider interaction types, not channel identity. Missing channel/acquisition lineage/revenue attribution remain independent UNKNOWNs. MCP guide rendered a setup-guide title; tool rights/read-only guarantees were not established and no MCP connection occurred.

Before live use: provider rights, corrected route-specific schemas, authentic webhook verification, replay/retention limits, token redaction tests and per-capability approval remain required. Reproduce by anonymous GET, SHA-256 byte hashes, PyYAML parsing, local-ref walking and full validation on the unmodified documents. Public docs may drift under unchanged1.0.0.

## Implemented synthetic subset

`product/src/adapters/pancake-synthetic/pancake-synthetic.ts` exports pure `decodePancakeSynthetic(unknown): SourceObservation` and a wholly fabricated demo fixture. Input requires `synthetic:true`, receipt/display/observed metadata and a `payload` messaging envelope. Optional `originalMeta` is explicitly fabricated cross-route test linkage, never inferred from Pancake IDs. Default/native-only fixtures retain `system:pancake`; the demo preset deliberately supplies original Meta test identity. Core owns authorization, receipt persistence and commercial policy.

This is a narrow allowlisted subset, not a general provider webhook receiver: optional UTC timestamps must carry Z, edit_history is accepted only null/empty object, media/post/extra fields are rejected. It therefore does not claim support for every public-spec payload, offsetless provider timestamps, opaque edit history, media-only empty text or POS. Unknown fields (including credentials/URLs/hash/workspace/connection fields) are rejected at each supported object boundary with a category-only error. No transport, token lifecycle, unkeyed customer-content digest or commercial mutation exists. Original accepted fabricated payload is copied into the envelope input; metadata projections are the core's responsibility.

Local contract suite covers native identity, missing conversation/time, explicit Meta test linkage, removal/time evidence, copy isolation, invalid boundaries, identity mismatch and secret/URL/hash rejection. Public spec checks are separate from these fabricated contract tests. A passing synthetic suite is not live webhook schema validation or provider authenticity proof.
