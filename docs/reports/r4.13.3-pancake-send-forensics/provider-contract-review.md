# Provider contract review — R4.13.3

**Scope:** offline reconciliation of the pinned official Pancake YAML, prior sanitized catalog, historical DevTools notes, and the recorded execution journal. No provider call, credential use, cookie use, raw capture, or customer content was used for this review.

## Contract baseline (DOCUMENTED, not a new provider result)

The official REST YAML documents the conversation-scoped operation:

`POST https://pages.fm/api/public_api/v1/pages/{page_id}/conversations/{conversation_id}/messages?page_access_token=<page token>`

The `InboxMessage` body requires `action` and `message`. `action` is `reply_inbox`; `message` is text. `content_ids` is an alternate media/template form and is mutually exclusive with `message`; `filename`, `sender_id`, and `reply_message_id` are optional. The route is scoped by Page and conversation and has no required recipient field. The YAML states that a successful HTTP response still requires checking `success`; an unsuccessful response may include `message_code`. The YAML text also documents a 500 possibility when both `message` and `content_ids` are sent. These are documentation possibilities, not observed responses in this checkpoint.

For reads, the same official YAML documents `GET /pages/{page_id}/conversations/{conversation_id}/messages` and a Page-scoped `page_access_token` query parameter. The account listing contract documents `GET /api/v1/pages?access_token=<user token>`; `settings{page_access_token}` is described as admin-only and may be empty for non-admin callers. Token values and identifiers are intentionally omitted.

## DevTools reconciliation

The historical capture is evidence of private UI route shapes only. It showed `/api/v1/me`, `/api/v1/pages/{page_id}/get_user_role_permissions`, `/api/v1/pages/{page_id}/settings`, and avatar redirects. It did not establish a public send contract, a provider page-alias/native-ID correlation, or a current authorization grant. `reply_inbox` was not observed in that capture. Captured header values, cookies, tokens, raw messages, and identifiers remain excluded. Private UI routes must not be promoted to stable APIs.

The sanitized catalog records 28 official paths, 32 parsed REST operations, 5 webhook definitions and 233 observed route templates from 395 HAR entries. Catalog presence is DOCUMENTED only; it does not prove execution, entitlement, schema stability, or production approval.

## Response/error classification

No readable HTTP/business response is available for the ambiguous POST incident. Therefore HTTP status, response body, `success`, `message_code`, acceptance, delivery, read state, and duplicate state are **UNKNOWN**. The documented 200/`success` check and possible error codes remain untested. Do not infer a 4xx, 5xx, timeout, or provider rejection from the missing result.

## Incident disposition

The execution journal records one POST attempt with `SEND_UNRESOLVED` / `SEND_AMBIGUOUS`; recovery used history-only reads and found no unique marker. No second POST or retry occurred, and no provider write is confirmed. A separate inline-loader incident records a possible 0–2 GET attempts with discarded tool metadata; it produced no provider result. These incidents are distinct and must not be collapsed into a successful or failed provider response.

**Owner:** NOT_OBSERVED

Manual review is required before any replay, cleanup, or further mutation. Preserve the ambiguous state and do not manufacture a provider result from transport absence.

## Evidence limits

This document does not claim current provider access, successful authentication, endpoint availability, permission approval, rate-limit behavior, webhook behavior, lifecycle guarantees, identity linkage, or customer-data correctness. It does not authorize PH4 or a production connector.

Sources: `docs/external-apis/pancake/pancake-api-knowledge-base.yaml`; `docs/reports/r4.13.2-pancake-full-validation/official-send-message-contract.md`; `official-authentication-contract.md`; `devtools-vs-api-results.md`; `provider-live-test-journal.md`; `controlled-send-results.md`; `docs/reports/r4.13-pancake-deep-admission/api-devtools-reconciliation.md`.
