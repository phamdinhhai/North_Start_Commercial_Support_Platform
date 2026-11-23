# R4.13 API capability matrix

Agent 2 offline contract inventory at baseline `197d6ec`. Source hashes and inspection limits: [API/DevTools reconciliation](api-devtools-reconciliation.md). DOCUMENTED means present in the pinned local YAML; it does not mean executed, authenticated, supported for every channel, or production approved. All live outcomes must come from the root execution journal.

| Capability | Documented method/path (REST-relative) | Inputs / pagination | Agent 2 status |
|---|---|---|---|
| Conversation listing | GET /pages/{page_id}/conversations | last_conversation_id, since/until, order_by, fields, filters | DOCUMENTED; broad listing not executed |
| Message history | GET /pages/{page_id}/conversations/{conversation_id}/messages | current_count | DOCUMENTED; ordering/completeness UNKNOWN |
| Send / reply | POST same messages route | oneOf InboxMessage, ReplyComment, PrivateReply, WhatsappTemplateMessage | DOCUMENTED; recipient consent/readback required |
| Tag membership | POST /pages/{page_id}/conversations/{conversation_id}/tags | action, tag_id | DOCUMENTED; reversible only with baseline membership |
| Assignment | POST /pages/{page_id}/conversations/{conversation_id}/assign | assignee_ids | DOCUMENTED; preserve prior assignment |
| Read / unread | POST /pages/{page_id}/conversations/{conversation_id}/read or /unread | target path | DOCUMENTED; not generic conversation status proof |
| Page tags | GET /pages/{page_id}/tags | Page scope | DOCUMENTED; not tag creation permission |
| Contact list | GET /pages/{page_id}/page_customers | since/until, page_number, page_size, order_by, fields | DOCUMENTED; broad export not authorized |
| Contact change | PUT /pages/{page_id}/page_customers/{page_customer_id} | changes | DOCUMENTED; identity must first be verified |
| Internal contact note | POST /pages/{page_id}/page_customers/{page_customer_id}/notes | message | DOCUMENTED; create identifiable fabricated note only |
| Edit / delete note | PUT / DELETE same notes route | note_id; PUT also message | DOCUMENTED; only agent-created content |
| Avatar | GET /pages/{page_id}/avatar/{psid} | native path | DOCUMENTED; capture 301 only |
| Message edit/delete | No distinct route established by this inspection | Unknown | UNKNOWN; do not infer from notes |
| Webhook authenticity | Not established by route/schema inventory | Provider-specific proof needed | UNKNOWN; no live receiver admission |
| Retry/idempotency guarantee | Not established by schema inventory | No verified idempotency key | UNKNOWN; never blind retry mutation |
| Rate-limit contract | Not established by this bounded inspection | Observe documented/current response evidence | UNKNOWN |

Documented business routes above generally require `page_access_token` in the query; avatar does not declare that parameter. Query credential values must never reach URL logs/traces/reports. Most listed operations document only response 200, so permission/error semantics require separate observed evidence; a schema containing only 200 does not guarantee success.

`InboxMessage` requires action/message and exposes content_ids, filename, sender_id, reply_message_id. ReplyComment requires action/message_id/message; PrivateReply requires action/post_id/message_id/from_id; WhatsApp template requires action/template_id. These are distinct operations, not interchangeable send contracts. Attachment and channel capability need specific admission before execution.

## Engineering implications

Treat current_count and last_conversation_id according to provider semantics; neither automatically proves immutable snapshots, reliable backfill or complete history. Durable checkpoint advancement must follow accepted persistence, and replay must use verified native identity without minting Customer/Lead authority. Native Pancake contact/message identity does not independently prove original Meta identity. Keep Meta direct transport independent.

Offline parsing is not OFFLINE CONTRACT TESTED execution of a transport. AUTHORIZED PROVIDER TESTED and INTEGRATION E2E TESTED remain unclaimed by Agent 2. Missing authorized target capture is NOT VERIFIED, not a security defect. Before outbound messaging, root must establish recipient control/consent, exact Page/conversation/contact and readback/cleanup policy. Gate C remains NOT READY.
