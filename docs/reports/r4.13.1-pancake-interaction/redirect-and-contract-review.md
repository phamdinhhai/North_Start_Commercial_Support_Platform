# R4.13.1 Pancake interaction: redirect and contract review

Date: 2026-11-21  |  Evidence class: historical local capture + checked-in Pancake YAML/static JS metadata

## Scope and handling

This review used only the operator-supplied local `D:/Download/Pancake_Document/download.devtools` HAR and checked-in YAML/static evidence. No provider call was made. Credential, cookie, token, account, contact, and customer values were not read or reproduced. The HAR was treated as untrusted historical evidence; it does not establish current availability or authorization.

The target UI alias is `NetDecor.PhongcachsongnguoiViet`. The permitted target is the supplied conversation id `1172702029255664_27910194421914511`. Its pieces are candidate page/contact references only; the leading piece must not be promoted to a verified Page identity without a target-scoped provider/UI binding. This is a target-scoped assertion, not evidence that page enumeration is allowed.

## Target-only bootstrap and alias routing

The capture records ordinary UI requests scoped directly to `/api/v1/pages/{page_id}/...`, including settings, conversations, posts, statistics, avatar, permissions, and role reads. It also records `/main/auto?page_id=...` and a page-scoped WebSocket query. No captured request is evidence for a safe `GET /pages` enumeration flow. Therefore an implementation must resolve the alias through an operator-supplied target binding (alias + allowlisted page id), then perform a page-scoped read after that binding has been verified; it must fail closed on alias mismatch, missing binding, or an id outside the allowlist.

Static page-selection code uses display fields (`name`, `username`, `id`) for local filtering and labels. The request builder receives an already selected page id and access-token context; it does not prove that a username/alias is a canonical provider identifier. URL path pieces are consequently routing hints only, never identity proof. The UI's `/main/auto` and page routes should be treated as ordinary navigation; a redirect status is not authorization.

## Redirect and header observations

The capture contains avatar responses with 301/302 statuses and a `Location` response header. This is an image delivery behavior, not a contract for page, conversation, or message APIs. Redirect targets were intentionally not read. A page avatar endpoint also returned 302. No redirect should be followed for a write or identity lookup unless the provider contract explicitly says so and the final host/path remains within the configured provider origin.

Axios/static code exposes generic `Authorization` support, while the selected HAR request-header projection only retained non-secret header names. This review therefore records header *classes* (authorization context, content type, cookies/session supplied by the browser) but no values. Any adapter must inject credentials from its secret store, never from alias/path/query data, and must redact them from logs.

## Conversations pagination and send/readback contract

The UI fetches `GET /api/v1/pages/{page_id}/conversations` with query controls including `unread_first`, `mode`, `tags`, `except_tags`, `cursor_mode`, and `from_platform`. Static JS switches to `POST` for search/continuation and supplies a cursor (`next_cursor`) plus `current_count`; one refresh helper applies at most the first 60 returned conversations. This establishes cursor-shaped pagination and a bounded UI page, not complete-history or replay semantics. Persist the provider cursor as opaque data, detect repeated cursors, and surface truncation/unknown when exhausted state is not proven.

Checked-in YAML documents `POST /pages/{page_id}/conversations/{conversation_id}/messages` for inbox/private-reply/comment-reply/WhatsApp-template variants. The documented body families include `message` versus `content_ids` as mutually exclusive alternatives; sender/action fields are variant-specific. A send adapter must validate exactly one content family, preserve the raw provider response, and require a subsequent page/conversation/messages readback before reporting `EXECUTED`; otherwise outcome is `UNKNOWN`. No send was performed in this review.

The same YAML documents `GET /pages/{page_id}/conversations/{conversation_id}/messages` and customer/page-customer reads. These are provider records, not permission to merge Customer and Lead or infer identity. Keep page, conversation, customer, and sender references separate and retain raw immutable evidence.

## Security and QA cross-review

Security: target-scoped lookup avoids page enumeration; alias is untrusted input; path parameters must be encoded and allowlisted; redirect hosts must be pinned; authorization/cookie/token values stay outside telemetry; deny writes by default. The adapter remains an anti-corruption boundary and does not grant provider semantics to the domain.

QA: fixtures should cover alias mismatch, disallowed page id, 301/302 on read, redirect to a different host, repeated/absent cursor, POST search continuation, mutually exclusive send fields, and send-without-readback. Assertions should inspect route, method, query/body field names, status class, and redaction markers only—never real account/contact/customer values.

## Status and open decisions

This is static/historical evidence only. It does not resolve CE-1, CE-2, MM-1, ID-1, ID-2, PM-1, or LG-1. It does not authorize provider activation or outbound messaging. Keep `// OPEN: CE-1 — see ADR-001` at state/transition seams.

