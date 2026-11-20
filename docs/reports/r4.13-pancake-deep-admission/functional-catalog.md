# Pancake documentation functional catalog ? R4.13

Evidence checkpoint: base `197d6ec4c766d4528d1cbc9e024d6e2454d22bd3`; local documentation inspection only, 2026-11-20. Source root: `D:/Download/Pancake_Document`. No credential, cookie, raw DevTools or provider account was accessed by Agent 1.

## Inventory and evidence limits

The package contains **153 individual Markdown documents**, **13 grouped Markdown documents**, and **2 YAML specifications**. The 166 Markdown files are documentation artifacts, not 166 independently verified provider capabilities. The grouped documents overlap the individual collection. Thirty-five Markdown files are shorter than 400 bytes; the inventory labels these navigation-stub *candidates*, not confirmed empty capabilities. No recursive subdirectories were found in either documentation folder.

[docs-inventory.json](docs-inventory.json) records every relative source path, byte length and SHA-256, plus all 32 documented REST operations across 28 paths. Categories are filename-based discovery aids; they are not a semantic completeness assessment. For example, the interaction-titled document contains interaction analytics headings, so its title must not establish message-send support. Selected heading inspection also confirmed general and conversation information sections in the conversation-information document; the API and webhook Markdown pages expose a top-level heading rather than independently proving transport behavior.

| Collection | Count | Interpretation |
|---|---:|---|
| Individual function documentation | 153 | UI/product research inputs |
| Grouped documentation | 13 | Navigation and consolidated guidance; overlap expected |
| REST YAML | 1 | 28 paths, 32 operations; YAML parse verified |
| Webhook YAML | 1 | Five definitions; YAML parse verified |

## Functional-to-contract map

All rows below are **DOCUMENTED**, not AUTHORIZED PROVIDER TESTED or INTEGRATION E2E TESTED. Method/path evidence is the local REST YAML, pinned in the inventory. Account scopes, runtime response shape and Page-specific behavior require the separate bounded provider test journal.

| Functional area | Local documentation evidence | Public REST subset in supplied YAML | Admission limit |
|---|---|---|---|
| Account/Page admission | Login, sessions, permissions, account and Page documents | `GET /pages`; `POST /pages/{page_id}/generate_page_access_token` | Listing or token-generation documentation does not authorize enumeration or token rotation; scope must be independently bound |
| Conversation discovery | Filters, search, conversation information | `GET /pages/{page_id}/conversations` | No separate conversation-detail path in this snapshot; query behavior must be confirmed without broad inbox discovery |
| Message history and send | Conversation and reply-support documents | `GET`, `POST /pages/{page_id}/conversations/{conversation_id}/messages` | Send variants documented in summary include private reply, inbox, comment reply and WhatsApp template; actual channel permissions remain unverified |
| Tags | Conversation-tag configuration and management | `GET /pages/{page_id}/tags`; `POST /pages/{page_id}/conversations/{conversation_id}/tags` | Read current state, change only approved test tags, read back and restore |
| Responsibility | Employees, permissions, round-robin configuration | `POST /pages/{page_id}/conversations/{conversation_id}/assign`; `GET /pages/{page_id}/users` | Assignment is provider responsibility metadata, not North Start Lead ownership authority |
| Read state | Conversation management | `POST /pages/{page_id}/conversations/{conversation_id}/read`; `POST /pages/{page_id}/conversations/{conversation_id}/unread` | Read/unread is not proof of commercial outcome; other UI status transitions are not established by these paths |
| Contact context | Conversation information and CRM documents | `GET /pages/{page_id}/page_customers`; `PUT /pages/{page_id}/page_customers/{page_customer_id}`; `GET /pages/{page_id}/avatar/{psid}` | Customer collection exists but broad export is not authorized; verify exact contact binding before any approved change |
| Contact notes | CRM/context documentation | `POST`, `PUT`, `DELETE /pages/{page_id}/page_customers/{page_customer_id}/notes` | Only agent-created test notes may be edited/deleted; documented contact notes do not prove a distinct conversation-internal-note API |
| Media | Reply and channel documentation | `POST /pages/{page_id}/upload_contents` | Upload documentation does not establish safe media types, edit/delete or cleanup support |
| Delivery notifications | `Webhooks.md` and webhook YAML | Definitions: `messaging`, `subscription`, `post`, `conversation`, `connect_status` | No live receiver authenticity or subscription admission proved by parsing |
| Analytics/acquisition | Statistics, advertising and interaction analytics documents | `/statistics/*`, `/ads`, `/export_data` | Out of this conversation test scope; reported conversion never becomes verified revenue |
| Other product functions | Posts, calls, POS, billing, AI, backups, ecosystem settings | Posts, SIP logs, round-robin and chat-plugin operations appear in YAML | Research only; no permission for global settings, finance, bulk actions or new connectors |

## Channel coverage and identity

The documentation collection contains onboarding material for Facebook, Instagram, TikTok, Zalo, WhatsApp, LINE, Telegram, email and marketplace channels. These UI documentation titles do not prove that every channel object is available through the supplied REST subset, nor that personal-account clients are approved. Each account/channel capability needs its own authorization and supported-API evidence.

Keep Page/account identity, native conversation identity, message identity and contact identity separate. UI identifiers require provider-response confirmation. A shared contact name, phone or conversation display label cannot establish a North Start Customer merge. Provider assignment, read status, tags or message content cannot create Won/Lost, payment or revenue assertions. Native evidence remains provenance-bearing information under I-01, I-06, I-09, I-10, I-11 and I-12.

## Snapshot discrepancy and validation

The local REST YAML is 186,487 bytes, SHA-256 `798bd7be798c01832af3c50cbca66d07fa6020e3c9bade04b3a5d34c35699d73`. It differs from the prior R4.12 public snapshot (180,475 bytes; SHA-256 `1340453bf7ff92979e875d99577fc1948d10b2ede1d0da58c9df009258aef39f`). Classification: **CONFIRMED SNAPSHOT DIFFERENCE**, informational; provenance/timing cause and schema-level impact remain **NOT VERIFIED**. Neither source is silently substituted for the other.

The local webhook YAML is 38,933 bytes, SHA-256 `ab327fea1a398553351edde68a992f96c66dbc6fc4a93045d1d23e03f8d0e09d`, matching the prior recorded hash. Both local files declare OpenAPI 3.0.0 / info version 1.0.0 and parse with PyYAML. The webhook file has no `paths` and five top-level webhook definitions. **YAML parse success is not full OpenAPI validation.** Earlier full-validator failures remain historical evidence; this task did not rerun that validator, alter upstream definitions or manufacture an overlay.

## Open capability checks and handoff

The local path inventory does not establish public message edit/delete operations, standalone conversation-detail retrieval, general conversation status transitions, reliable webhook authentication, guaranteed cursor completeness or idempotency guarantees. Absence from this snapshot is a contract gap, not proof that the provider cannot support the function. Agent 2 must reconcile official contracts, authorized runtime behavior and sanitized DevTools observations; private UI endpoints must retain that classification.

Agent 3 reviews authentication/scope and mutation safety; Agent 4 owns native-to-commercial semantics; Agent 5 evaluates durable-sync compatibility; Agent 6 independently reviews test records and sanitization. Only the designated live executor may perform mutations. This catalog has no live PASS claims, production approval or Gate C change.
