# R4.13.1 security admission review

**Baseline:** `d990437` (offline Pancake request policy and sync executor boundaries). **Disposition: BLOCKED for any send or live provider mutation.** This review uses source inspection and offline tests only; no credentials, network calls, or customer data were used.

## Admission boundary findings

`PancakeRequestPolicy` is a useful offline exact-route and pacing gate, but it is not an authentication or identity proof. Its `VerifiedPancakeTarget.verificationEvidenceId` is only a non-empty caller-supplied reference. The policy does not verify that the provider response, request body, or authenticated principal binds account, Page, conversation, and contact to that target. A trusted executor must therefore supply server-owned target state and perform response/body binding before accepting any provider observation.

The policy has a per-request in-flight guard (`awaitingResponse`) and terminal stops for 3xx, 401, 403, 429, invalid status, redirects, and scope mismatch. It still permits a second identical outgoing-message intent after a successful `observe({status: 200})`; this is a duplicate-send risk unless the executor adds an idempotency key / durable send receipt and refuses an already accepted operation. No such executor or durable receipt is present in this baseline.

Mutation routes require recovery references and recipient-permission evidence, but these are references, not proof. A mutation must remain denied until all of the following are server-derived and verified: authenticated provider principal; exact account/Page/conversation/contact binding; request body target binding; recipient permission; precondition/readback/cleanup plan; and a unique idempotency/send key. Client-selected target fields or evidence IDs must never authorize a send.

The URL gate rejects credentials, query/fragment, user-info, non-HTTPS, non-approved hosts, and unsafe ports. Redirect responses are terminal even when a client reports no `redirected` flag. Errors are categorical (`PANCAKE_REQUEST_DENIED`) and do not include submitted URLs, IDs, headers, or body. This protects logs at this helper boundary, but transport clients, credentials, traces, and future executor logs need independent redaction and redirect-failure tests.

## Required stop conditions

- Keep provider sending and live mutation disabled; a provider success/read response is not North Start admission.
- Reject any request whose target is client-selectable or whose actual body/returned scope is not bound to server-owned identity.
- Reject duplicate outgoing intents after an accepted send unless a durable, workspace-scoped idempotency record proves the same operation.
- Treat auth failure (401/403), rate limit (429), any redirect (300–399), invalid status, or scope mismatch as terminal; do not retry or follow redirects.
- Do not emit credentials, query tokens, message bodies, PII, raw provider responses, or target identifiers in logs/telemetry.

## Evidence and limitations

Existing offline specs cover exact route matching, target mismatch, mutation recovery/recipient references, pacing/ceiling, redirect/auth/rate terminal stops, and configuration-copying. They do not prove provider authentication, account/Page/contact ownership, body-target binding, durable duplicate-send protection, credential custody, or production authorization. No live calls were made. Gate C remains closed.

R4.13.1 adds a pure categorical history-response gate that rejects redirects, authentication/rate failures, non-200/non-JSON responses, and malformed or out-of-scope message bodies. Its accepted result is metadata-only and remains insufficient for authentication or mutation admission.
