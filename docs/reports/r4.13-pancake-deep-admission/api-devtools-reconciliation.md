# R4.13 API / DevTools reconciliation

Agent 2, offline-only inspection; baseline `197d6ec4c766d4528d1cbc9e024d6e2454d22bd3`. No credential files read, requests replayed, provider calls or mutations performed. This report does not certify live access.

## Source evidence

| Local source | Bytes | SHA-256 |
|---|---:|---|
| download.devtools | 22694635 | 8ca251a3805ca63a51e2d2286d8f69667c97b3a09db4e1b764f838d3d654ec1c |
| pancake_api_document.yaml | 186487 | 798bd7be798c01832af3c50cbca66d07fa6020e3c9bade04b3a5d34c35699d73 |
| pancake_webhook_document.yaml | 38933 | ab327fea1a398553351edde68a992f96c66dbc6fc4a93045d1d23e03f8d0e09d |

JSON parsing identified HAR `log.entries`: 395 entries. YAML parsing succeeded; that is syntax parsing, not full OpenAPI validation. REST declares OpenAPI 3.0.0 / info 1.0.0 and 28 paths. Webhook declares 3.0.0 with top-level `webhooks` and no `paths`; do not claim compliant full validation. Local REST hash differs from earlier upstream snapshot, so prior validation diagnostics cannot be silently assigned to this revision.

## Target restriction and negative evidence

Decoded request URLs and request-body text contain no exact authorized composite UI conversation identifier. Its contact-like suffix occurs only in two avatar requests, both `GET /api/v1/pages/{page_id}/avatar/{psid}`, status 301 and zero response body. An avatar redirect does not establish conversation/contact identity. Ninety-five requests contain the authorized Page numeric component; their presence does not prove its binding to the authorized Page alias. Broad conversation-list/customer-list payloads were not inspected. No unrelated inbox content is retained here.

The capture therefore cannot validate conversation messages, mutations, cleanup, pagination or contact identity for the authorized target. This is an evidence limitation, not a provider defect.

## Scoped private UI observations

| Method/path template | Capture result | Safe interpretation |
|---|---|---|
| GET /api/v1/me | 200; root fields data, success, me | Historical account bootstrap candidate; no current account authority established |
| GET /api/v1/pages/{page_id}/get_user_role_permissions | 200; success, users, page_permissions, roles_last_synced_at | Historical Page permission response; not proof of current authorization |
| GET /api/v1/pages/{page_id}/settings | 200; settings and ancillary configuration fields | No exact target alias/native-ID match in inspected metadata |
| GET /api/v1/pages/{page_id}/avatar/{psid} | 301 twice | Redirect only; no contact/conversation linkage proof |

Capture header names include browser pseudoheaders, accept, referer, user-agent and browser metadata; recorded request headers do not include Cookie or Authorization. Their absence in an exported capture does not imply unauthenticated access. Header values were neither output nor retained. These `/api/v1` UI routes remain observed private implementation details, not public stable APIs.

## Reconciliation decisions

Use official documented routes as contract baseline. Root alone may execute current authorized tests after account/Page identity verification. Never replay captured token-generation or global configuration operations. A capture of those operations is not authorization to perform them. Do not derive native conversation identity by splitting the UI identifier. Use actual target-scoped provider response and preserve UNKNOWN when unavailable. No raw capture, customer body, cookie, token or response fixture is copied into Git.
