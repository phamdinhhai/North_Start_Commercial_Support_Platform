# Protocol intelligence ? 2026-11-17

Research-only; non-canonical. All capabilities remain `production_approved: false`.
Exact revisions, file byte digests and primary source links are in
[protocol-evidence.json](protocol-evidence.json). Public repository source was
inspected without installing dependencies, executing upstream projects, acquiring
cookies, opening a user browser, reading private captures or calling provider APIs.

## Findings and source boundaries

| Source | Exact revision | Observed license | Evidence boundary |
|---|---|---|---|
| morluto/rea | `54e3918d1c09991970aadf8f0eb1ab6bcf6f83fb` | MIT; separate third-party licenses | Instrument source and workflow definitions inspected; no REA target run |
| mautrix/meta current snapshot | `f806b8053b2dbf212ae6622e730441c499f767bd` | AGPLv3 plus named exceptions | Private client protocol implementation, no account execution |
| mautrix/meta v0.5.3 | `d32c6dcf9cec27edb2bdbb525a7b04abfc264737` | Historical protocol reference | MQTT implementation at an explicit older revision |
| isaackogan/TikTokLive | `4158e6a0a55ee1dabb9a8495ae86ec9e4116c42e` | AGPLv3 | Webcast source, not business inbox evidence |
| zerodytrash/TikTok-Live-Connector | `58c8d5a5806dc4fc6633458cf820be324fc527c6` | AGPLv3 | Webcast source, not business inbox evidence |
| facebook/facebook-nodejs-business-sdk | `246c937eb5c1272ed743db41a944900bee449be9` | Custom Meta license, Facebook services/API condition | Official Graph SDK transport contrast |
| tiktok/tiktok-business-api-sdk | `f809c396520df2d7b201a9ccc5378d822b728ed3` | MIT | Official Business API transport contrast |

License identification is from license files, not a reuse approval or a grant of
provider access. Named mautrix exceptions for Beeper/Element do not grant this
platform an exception. No upstream source is copied into product code here.

## REA: source and CI, beyond README claims

At the pinned source, `package.json` declares `rea-agents` 6.9.0, an MIT license,
CLI binaries `rea`/`rea-agents`, and Node engine ranges
`^22.23.4 || ^24.22.1 || >=26.12.1`. These are source declarations, not proof
of the installed connected server version or a published npm artifact match.

`src/composition/webNetworkCaptures.ts:createWebNetworkCaptureService` composes
HAR, SAZ, qlog and mitmproxy adapters. `src/domain/webNetworkCapture.ts` declares
bounded historical capture inputs/results and limits; its default limit includes
32 MiB input and a 30 second timeout. Those source defaults do not retroactively
invalidate older evidence or prove the settings used by an earlier REA version.
`src/composition/browserScenario.ts:createBrowserScenarioProvider` constructs a
Playwright provider through `PlaywrightScenarioSession.open`. The JavaScript input
and result schemas and `parseOwnedJavaScriptApplicationAnalysisSteps` are in
`src/domain/javascript/javascriptApplicationAnalysis.ts`. These are concrete
implementation paths, rather than an assertion that every advertised capability
works on this machine.

`.github/workflows/ci.yml` defines pull-request/main/scheduled/manual qualification,
read-only default contents permission, pinned checkout/setup-node actions and
lanes invoking `npm ci`, `check:ci:fast` and `format:check`. Additional workflow
files include `real-web-network-captures.yml`, `real-browser.yml`,
`real-agentenv.yml` and `real-ghidra-windows.yml`. Workflow presence is not a
successful hosted run. No Actions status, CI run logs, upstream tests or provider
readiness were verified in this increment.

The reverse-engineer-anything skill was read. It directs ordinary complete-source
analysis to repository tools and reserves REA for shipped artifacts, decompilation
or requested runtime evidence. This task supplied public source and inherited
reports, so no readiness diagnostics or new REA capture was warranted. REA remains
an investigation instrument; it establishes neither a 24/7 subscription contract,
authorization entitlement, tenant isolation nor production connector reliability.

## Meta: historical MQTT and current DGW must be distinct

At **v0.5.3**, `pkg/messagix/topics.go` declares `/ls_req` and `/ls_resp`.
`pkg/messagix/events.go:Socket.handleReadyEvent` publishes app settings, subscribes
to response/foreground topics, schedules thread fetch tasks and calls
`EnsureSyncedSocket` after a reconnect. `pkg/messagix/client.go:Client.Connect`
contains a reconnect loop with a two-second starting delay and a five-minute cap.
This is source evidence of a client strategy, not proof of server retention,
exactly-once delivery, complete message history or successful authentication.

At **the current pinned snapshot**, `pkg/messagix/client.go:NewClient` creates a
`dgw.NewSocket` with cookie retrieval, origin and a `dgw_lightspeed` URL.
`pkg/messagix/endpoints/facebook.go:makeFacebookEndpoints` maps that URL to
`https://gateway.<host>/ws/lightspeed` and GraphQL to `/api/graphql/`.
`pkg/messagix/socket.go:Client.onSocketConnect` ensures minimal sync groups
`1,2,95,104`, then emits connected/reconnected events. Do not label this current
implementation simply MQTT because older code used that transport.

`pkg/messagix/socket.go:SocketLSRequestPayload` contains `app_id`, a JSON-string
`payload`, `request_id` and `type`; `PublishResponseData` has `request_id`,
`payload`, `sp` and `target`. `PublishResponseData.Parse` unmarshals Lightspeed
steps and dependencies into `table.LSTable`. A request/packet ID correlates a
request; it is not a North Star business-event identity.

`pkg/messagix/httpclient/graphql.go:HTTPClient.MakeGraphQLRequest` looks up
`GraphQLDocs`, encodes variables and doc/client-doc identifiers, sets friendly-name
headers and uses the configured endpoint. The doc mapping lives in
`pkg/messagix/graphql/docs.go`; IDs and parameter shape are snapshot-specific.
Cookies update from responses. This session-bound private surface is separate
from the official SDK's `src/api.js:FacebookAdsApi`, whose Graph base is
`https://graph.facebook.com`. Similar host/vendor identity does not equate access
rights, messaging semantics or stable contracts.

[Meta's current Messenger overview](https://developers.facebook.com/documentation/business-messaging/messenger-platform/overview)
documents Page tokens, required permissions, scoped person identifiers and access
levels/App Review. It describes webhook-driven business messaging. It does not
authorize this platform's private MQTT/DGW/browser GraphQL operation. Our app,
tenant, scope grants and provider rights remain UNKNOWN. Neither a Page-scoped
ID nor a thread ID becomes a stable Lead ID or cross-channel customer identity.

## TikTok: Webcast is separate from authorized Business Messaging

`TikTokLive/client/client.py:TikTokLiveClient.start` obtains room data and calls
`fetch_signed_websocket`; `_parse_webcast_response_message` maps method strings to
event classes. `TikTokLive/client/ws/ws_client.py:WebcastWSClient.connect` handles
protobuf response frames; `send_ack` sends an ack using frame identifiers and
internal extension data. The source's ping-timeout comment states that ordinary
pong expectations are unsuitable for its observed TikTok transport. Treat that
as the maintainer's implementation rationale, not a newly measured service fact.
`TikTokLive/client/web/routes/fetch_signed_websocket.py:__call__` calls a signing
service and includes a warning for passing session IDs. No signer was called and
no credentials were supplied in this research.

Connector `src/lib/client/index.ts:TikTokLiveConnection.connect/_connect` resolves
a room, checks connection state, obtains a signed WebSocket response and can
process initial data. Authenticated options require a cookie or OAuth bundle;
these library inputs do not prove provider authorization. The signing route is
`src/lib/web/routes/euler/fetch-signed-websocket-euler.ts`.
`src/lib/ws/lib/ws-client.ts:onMessage` decodes binary frames, acknowledges
`needAck`, emits decoded results and emits decoding failures.
`onDisconnect` clears ping state and resets sequence state. A reconnect or cursor
field is not proof of a durable server replay contract. No reliable recovery,
retention, deletion coverage, inbox completeness or token-expiry behavior was
measured for either library.

The official TikTok SDK `js_sdk/src/ApiClient.js` uses
`https://business-api.tiktok.com` as its base. A bounded source search for
`business/message`, `business_message`, `BusinessMessage` returned no matching
lines in this pinned SDK. This does **not** mean TikTok lacks a Business Messaging
API or that the SDK enumerates all currently available APIs.

[TikTok's official get-started guide](https://business-api.tiktok.com/portal/docs/business-messaging-api-get-started/v1.3)
requires an app, obtained Business Messaging access, authorization,
authentication and webhook subscription.
[Its send endpoint documentation](https://business-api.tiktok.com/portal/docs/send-a-message-to-a-conversation/v1.3)
requires the necessary security/privacy reviews and access, and documents
`POST /open_api/v1.3/business/message/send/`. Eligibility, account/region scope,
app approval and this platform's grant are UNKNOWN. Public LIVE chat/gifts and
business direct-message conversations are separate surfaces. No adoption or
production reliability claim follows from source availability or an MIT SDK.

## Inherited registry reconciliation and failures

The accompanying JSON retains all twelve rows from the 2026-11-15 capability
registry with their original dispositions and `production_approved: false`.
Source-inspected Meta/TikTok references remain research-only. Prior bounded live
settings, conversation tags, read-reconciliation and channel-rejoin observations
remain inherited live evidence for their exact experiments; they are not a live
Meta/TikTok protocol test performed here. The broad Phoenix row remains
mock-tested despite containing narrower inherited live observations.

The inherited source ledger pins public Pancake repositories and a historical HAR
digest. Only their published summaries and provenance were read here. No raw HAR
or private payload was opened or reacquired. The existing untracked
`docs/research/rea-protocol-intelligence-2026-11-17/README.md` was read as context;
it is not authored by this increment and does not replace this exact-source ledger.

Preserve the 11-15 report's failures: initial settings capture dropped 160/161
events; a later zero-drop result remained incomplete. Two contract-read attempts
reported execution_failure/cleanup_incomplete with wrong-target selection;
subsequent success does not erase those attempts. Message-tail repeat-page timeout
occurred despite an observed HTTP 200; later settling does not establish the root
cause. Snapshot equality and reconnect ACK prove their bounded observations,
not replay, tombstones or complete message history. Message send/receive/delete,
auth expiry and independent backend operation remain unverified.

This run also records corrected path/glob read errors and the unreadable TikTok
portal root in the JSON. No failed read is treated as positive evidence.

## Sanitized harness guidance (proposed; not executed here)

1. Pin repository SHA and hash exact fixture bytes. Store source pointers and
   provenance separately from semantic projections. Public source pin changes
   require a new fingerprint version, never an overwrite of old observations.
2. Use fabricated room/thread/person identifiers and tiny hand-authored envelopes.
   Exercise Lightspeed request/response correlation, Webcast unknown method,
   malformed/truncated protobuf, oversized frame, ack-required/optional,
   duplicate/reordered frame and disconnect between receive and persistence.
   Synthetic payloads must be labelled synthetic, never raw provider captures.
3. Use an offline decoder or loopback fake socket/signing service. Deny outbound
   network by default; inject the local transport. Never pass session cookies,
   OAuth bundles, account tokens or real message content to a public signer.
4. Version fingerprints by source revision, transport/framing, operation label,
   required field names/types, compression/protobuf schema identity and parser
   version. Preserve unknown fields and raw hash/pointer under appropriate access;
   do not hash secrets into public fingerprints or infer event identity from a
   transport request ID.
5. Assert explicit gap-open on close/decode failure; reconnect ACK alone cannot
   close a gap. Require separately authorized reconciliation evidence with a
   defined coverage window; absent replay/retention contract stays UNKNOWN.
6. Record expected/actual results, fixture digests, test command, timeout/drop
   counters and failures. A source-inspected row becomes synthetic-tested only
   after an actual saved test result; live-authorized requires a separately scoped
   authorized run. Provider rights and production approval are independent fields.

Any future live investigation needs a selected authorized test target, explicit
scope and retained redacted evidence; do not discover private browser tabs or
reuse a prior account permission by inference. No cookie acquisition, auth bypass,
account write, private recapture or new human-gate decision was performed here.

## Product implication and verification

Keep all these surfaces behind anti-corruption adapters. Preserve immutable raw
provenance (I-12), visible UNKNOWN/gaps (I-08), lead-scoped authorization (I-09),
stable Lead identity (I-07), and separate conversation source, acquisition lineage
and revenue attribution (I-02). AI drafts cannot mutate canonical state (I-03/04).
CE-1/CE-2, ID-1/ID-2, MM-1, PM-1 and LG-1 remain unresolved.

No production connector is recommended by this investigation: provider rights,
independent session lifecycle, durable ingestion, drift handling, recovery coverage,
rate limits and operational ownership have not been established for private
protocols. Official API evaluation can proceed as a separate gated contract task.
This increment changes reports only. JSON parsing, source SHA/file-hash checks,
inherited row/state checks and `git diff --check` are the relevant validation;
no product tests, upstream tests or live provider tests were run.
