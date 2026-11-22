# Pancake capability matrix — R4.10

2026-11-20. Evidence pins and executed spec validation: [deep research](pancake-deep-research.md). `Documented` means public source states it; it does not mean authorized, exercised or production-ready.

| PAN / capability | Documented evidence | Limit / unknown | Synthetic implementation |
|---|---|---|---|
| PAN-01 authentication / rate | REST query user/page token;5calls/page/sec | Read token also permits mutation; no live rights proof | No transport/credential handling |
| PAN-02 conversations/history | v2 cursor,last_conversation_id,max60;v1 messages current_count,30 | Replay completeness/retention and cross-channel coverage UNKNOWN | Individual fabricated message snapshot only |
| PAN-03 messaging webhook | page_id,event_type,data.message/data.conversation;five event families | No signature/retry-window/event-ID guarantee found;3.0 declaration invalid | Fabricated messaging envelope mapping |
| PAN-03 edit/delete | is_removed;edit_history | REST array vs webhook object;no immutable message revision | Retain removal label;no revision guessing |
| PAN-04 readback / assignment | Message-history GET;assignment/users/histories | No performed action verification;provider assignee not platform principal | No assignment mutation/access grant |
| PAN-04 media | Attachment IDs,URLs,MIME | Download availability/rights/expiry UNKNOWN | No network/media retrieval |
| PAN-05 POS | Separate api_key,order/customer/inventory/einvoice webhooks;custom secret header;updated-time backfill | Status/payment evidence not canonical paid/Won | Research only;no POS canonical mapping |
| Provider original identity | Pancake native page/conversation/message IDs | Native IDs do not establish Meta original identity | Pancake identity retained;no cross-route text/time join |
| Time and origin | Provider timestamps;REST offsetless UTC except feedback | Missing occurrence time remains UNKNOWN | Synthetic route and observedAt separate from occurredAt |
| Commercial meaning | Tags/order/read/assignment provider metadata | No inferred CommercialEvent/state/outcome/attribution | No commercial mutation or payment inference |
| UI channel / MCP | UI navigation and setup guide | Not API coverage/personal-inbox permission/tool authorization | Not connected |

Gate status remains synthetic-only. Actual executed checks are YAML parse,local-reference resolution,full OpenAPI validation failures and local contract tests reported with implementation. No public/API credential,webhook endpoint,live HTTP transport or account was provisioned.
