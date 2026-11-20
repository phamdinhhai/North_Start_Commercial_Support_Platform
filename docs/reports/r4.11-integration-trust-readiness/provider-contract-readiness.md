# Provider contract readiness — R4.11

2026-11-20; base `5181aba`; offline synthetic only. Status: **BLOCKED_PROVIDER_AUTH** for sandbox/live admission. No account, inbox, credentials, subscriptions, SDK writes, real data, public receiver or pilot resource was used. ADR-005..009 apply; CE-1/ID-1/ID-2 remain open.

## Fresh Pancake evidence

Anonymous GETs of the original public documents, parsed with PyYAML and fully enumerated with `OpenAPIV30SpecValidator.iter_errors()` in an isolated temporary Python environment. [Machine evidence](pancake-spec-validation.json) contains every diagnostic, including repeated/nested diagnostics. No source patch or compatibility overlay was applied.

| Original | HTTP/bytes | SHA-256 | Version | Validation |
|---|---|---|---|---|
| https://developer.pancake.biz/openapi/openapi.yaml | 200 / 180475 | `1340453bf7ff92979e875d99577fc1948d10b2ede1d0da58c9df009258aef39f` | OAS 3.0.0 / info 1.0.0 | FAIL: 21 diagnostics |
| https://developer.pancake.biz/openapi/webhook.yaml | 200 / 38933 | `ab327fea1a398553351edde68a992f96c66dbc6fc4a93045d1d23e03f8d0e09d` | OAS 3.0.0 / info 1.0.0 | FAIL: 2 diagnostics |

Delta against R4.10: **HASH_UNCHANGED / VERSION_UNCHANGED / VALIDATION_STILL_FAILED**. REST has 28 paths/21 local references; webhook five webhook definitions/11 references; all local references resolve. Full validation additionally exposes six `WhatsappTemplate*` schemas with invalid `properties.type: object`, and unresolved `page_id` for token-generation POST, beyond the previously reported invalid `UUID` type. Webhook still lacks `paths` and uses unsupported top-level `webhooks` under 3.0.0. A future overlay must be separately versioned, source-hash-bound and justified; never describe the original as valid. No complete SDK generation is justified by this narrow rehearsal.

R4.10 route-specific semantics remain: REST history and messaging webhook shapes differ (edit history array versus object); cursor is opaque; native Pancake IDs do not prove original Meta IDs; webhook authentication/replay guarantees remain UNKNOWN. POS documentation/header semantics cannot authenticate messaging. Public read-only behavior does not make a page token read-only. No provider-specific network implementation was added.

## Meta documentation and offline code scope

Official sources rechecked through current indexed official documentation on 2026-11-20:

- [Graph webhook validation](https://developers.facebook.com/docs/graph-api/webhooks/getting-started/): SHA256 signature with `sha256=` prefix in `X-Hub-Signature-256`; app secret and untouched raw payload. Generic webhook delivery statements explicitly defer Messenger-specific behavior; do not borrow its retry window or WhatsApp mTLS contract.
- [Page webhook fields](https://developers.facebook.com/docs/graph-api/webhooks/reference/page/): page privilege and `pages_manage_metadata`; current reference names `message_edits`. This does not establish a universal deletion payload or ordered revision stream.
- [Messenger quick start](https://developers.facebook.com/docs/messenger-platform/getting-started/quick-start): entries are iterated, message and postback dispatched separately, attachment handling is separate, and app roles/review restrict access. The sample's `messaging[0]` is an example, not permission to discard additional events.
- [Message readback](https://developers.facebook.com/docs/graph-api/reference/message/): individual message and conversation endpoints differ; an error described as deleted for messages beyond recent history is not independent proof of deletion.

`inventoryMetaOffline` visits all entries/events (100 entries, 1000 events maximum), requires separately supplied server page bindings, labels text/echo/attachment/unsupported and clones event values. Echo is provider outbound observation, never inbound customer intent. Attachment URLs remain references and are never fetched. Edits and deletions remain unsupported inventory records, never overwrite accepted evidence or become commercial state changes. No new normalization mapping or original R4.10 decoder was changed. This is a fabricated contract inspection helper, not live intake or a full Meta validator.

`verifyMetaSignature` checks max body bytes before parsing, a single exact-format header, HMAC-SHA256 over raw bytes and constant-time equal-length comparison. Tests generate secrets at runtime; whitespace/Unicode reserialization, changed bytes, wrong secret, malformed headers and oversize input fail. App-secret authenticity alone does not prove replay freshness, account authorization, Lead access, workspace membership or usage rights. No invented timestamp/signature replay standard is added.

## Bounded offline transport

The framework-independent function has injected request/clock/sleep/auth/validation/persistence/ack ports, with no URL, token, HTTP route, scheduler or production module registration. Bounds validate finite integers: attempts <=10, items <=1000, elapsed <=60 seconds, request deadline <=60 seconds. Request Promise.race enforces wall-clock timeout, clears timers and aborts; its rejection handler consumes late rejections. A noncooperative injected implementation can retain its own pending work, so cancellation is a port obligation. Elapsed budget is checked between operations, not a cancellation guarantee for arbitrary authorization/validator/persistence/ack callbacks; those trusted local callbacks must terminate. No SLO is claimed.

429 numeric/date Retry-After and timeout exponential backoff are bounded by remaining budget. Cursors are opaque strings, not ordering, event IDs, sequence or completeness proof. Explicit gap/schema poison/revoke stops before persistence/ack. `processAndCheckpoint` requires atomic durable deduplicated receipts plus checkpoint; failure leaves the function checkpoint unchanged and no ack occurs. Ack loss can replay a committed page; idempotence is a persistence responsibility. Tests model durable transaction success/failure and receipt replay, not an actual PostgreSQL implementation. This unit is intentionally not wired to shared intake/store and grants no provider identity from client JSON. Exactly-once delivery is not claimed.

## Future authorization design and priorities

Operator admin fixture authorization (ADR-006) is distinct from transport service authentication, connection/page/workspace binding, normalization, intake policy and Lead-scoped access. A future live service principal requires a server-resolved authorized connection, active ownership/scopes/provider approval and revocation checks, never provider/tenant claims from client JSON. OAuth client state/PKCE and fixed redirect origin, server-only vault reference by workspace/connection, secret versions/rotation, token expiry/revoke and redacted route-template telemetry require separate implementation and capability admission. Pancake query tokens must never enter URL/error logs or redirects. No credential is provisioned here.

Priority remains LVP continuity quality and reconciliation, then authorized Pancake Public API readback, then authorized Meta Page input. Broader platforms need separate first-party entitlement evidence: TikTok Business Messaging versus regional Portability export; Zalo OA rather than personal accounts; WhatsApp Business, LINE Official Account and Telegram Bot rather than personal history. Ads spend/IDs are separate provider facts; CAPI/export/outbound mutations stay gated. No SDK breadth replaces those rights or solves attribution UNKNOWN.

Validation: `npm ci`, typecheck and build passed. Full suite: 112 files passed/23 skipped, 1187 tests passed/122 skipped before the final additional transport failure-path test; targeted suite then passed 13 tests. Signature helper separately achieves 100% statements/branches/functions/lines coverage. Initial combined targeted line coverage was 97.05% (additional failure paths subsequently added). Existing npm audit reports five moderate findings. Database/live provider tests are outside this offline slice.
