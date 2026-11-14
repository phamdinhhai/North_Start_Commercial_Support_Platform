# W2a — Omnichannel OSS research report

**Decision date:** 2026-11-13
**Status:** non-canonical research; source-level desk review only. No live verification, deployment, credential test, security audit, or private-endpoint access was performed.

## Decision frame

The product is a revenue-continuity layer, not a generic inbox. Candidates must preserve raw immutable interaction evidence, explicit workspace/tenant scope, lead-scoped access, append-only audit, and an anti-corruption boundary. A candidate that owns canonical commercial semantics is not suitable for direct adoption.

## Candidate review

| Candidate | Exact public source URLs | Source type / version or date | License | Maintenance / security / tests | Tenant and credential suitability | Useful capabilities | Limitations | Verdict |
|---|---|---|---|---|---|---|---|---|
| Chatwoot | https://github.com/chatwoot/chatwoot / https://www.chatwoot.com/docs/self-hosted/deployment/security | `develop`, tag `v4.19.1`, `1ef1d2b45ae0a17a35c5f1bd055e4ddf04dadabf` | MIT outside `enterprise/` (`LICENSE` sha `d0425a70`) | Active upstream (`spec/models/conversation_spec.rb`, `.github/workflows`); not executed locally | Multi-inbox and account concepts are relevant (`app/models/conversation.rb`), but deployment secrets, webhook signing and isolation need review | Conversations, channels, assignments, webhooks, APIs and inboxes | Its inbox/conversation model is broader than the canonical Lead/Event model; provider semantics and retention need mapping | **ADAPT (conditional)** — optional operator/adapter surface, never canonical store |
| ChatbotX | https://github.com/ChatbotXIO/ChatbotX / https://github.com/ChatbotXIO/chatbotx-agent | `main`, tag `v1.21.0`, `d3472675976de53efedd61c54248f00afc730690` | MIT outside `apps/builder/src/enterprise` (`LICENSE` sha `bacb898f`) | Monorepo (`turbo run test`, `ci.yml`); not executed locally | `packages/connections` and `packages/encryption` require credential/tenant isolation review | Monorepo chatbot builder, channel registry, MCP server & worker | Broad workflow/enterprise surface; cannot replace canonical Commercial Event pipeline | **REFERENCE** — inspect channel-registry/encryption patterns only |
| OneChat | https://github.com/OneBook-ERP/OneChat | `version-1`, tag `v1.0.3`, `7c68fdf1e2115c434377897f1015c4b1117f8e14` | **AGPL-3.0** (`license.txt` & `onechat/hooks.py`) | `onechat/tests/` + `.github/workflows/ci.yml` verified via API; not executed | Frappe site/workspace visibility checks (`onechat/api/v1.py`, `check_visible`) | Frappe-based WhatsApp/Instagram inbox & automation flows | **AGPL-3.0 copyleft** and Frappe DocType coupling are unsuitable for modular-monolith embedding | **REJECT code reuse** (**REFERENCE** patterns only) |
| ERPNext / Frappe | https://github.com/frappe/frappe / https://github.com/frappe/crm | `frappe/crm` `develop` `v16.0.3` (`73ec05a1712909ea2ad0e631e088baa5fa3ea4a5`) | Frappe framework MIT; **`frappe/crm` is AGPL-3.0** (verified `LICENSE`) | Mature upstream with server/Playwright tests; not executed here | Sites/tenancy and `frappe.has_permission` checks | Workflows, CRM deals/contacts and extensibility | **AGPL-3.0** on `frappe/crm` + heavy ERP domain semantics | **REJECT `frappe/crm` embedding** (**REFERENCE** only) |
| erxes | https://github.com/erxes/erxes / https://erxes.io/ | `main`, tag `3.4.22`, `65713f856df421ddd40cde68300d5407b396d853` | **AGPLv3** outside `ee/` + anti-competitive SaaS clause (`LICENSE.md` sha `0b66dfcf`; `ee/LICENSE` = 404; `package.json` conflicts with `MIT`) | Active `core-api` & 36 CI workflows verified via API | Multi-channel tRPC/GraphQL plugin architecture | Customer engagement, inbox, automation and CRM-adjacent surfaces | **AGPLv3 + SaaS clause** and broad product model prevent embedding | **REJECT** |
| Libredesk | https://github.com/abhinavxd/libredesk | Verified in Streams A/D report | **AGPL-3.0** | Go/Vue support desk signals | Tenant isolation, secrets and operational hardening require review | Lightweight support desk, HMAC webhook delivery, retry/SSRF patterns | **AGPL-3.0** and no North Star commercial provenance | **REJECT code copy** (**REFERENCE** delivery/SSRF patterns only) |
| Canonical shortlist matrix | See `docs/reports/decision-demand-2026-11-13/research/wp4-p1-02-shortlist-source-matrix.md` | Verified `2026-11-14T05:55:00Z` | Per-repo verified | GitHub API verified file/test inventory | — | Exact SHAs, paths, symbols & risks | Topic lists are excluded from decision evidence | **SOURCE_VERIFIED** |

## Synthesis for W2a

1. **No candidate is ADOPT as the canonical commercial-event or lead store.** This follows the anti-corruption boundary and avoids importing a vendor's identity, state, or retention semantics.
2. Chatwoot is the strongest **ADAPT** candidate for a controlled operator/inbox integration, subject to release pinning, webhook authenticity, tenant isolation, credential rotation, retention, and evidence mapping.
3. Frappe is a possible **ADAPT** reference where ERP/CRM workflows are needed, but its breadth makes it unsuitable for the pilot's minimal loop.
4. erxes, Libredesk, ChatbotX and OneChat remain **REFERENCE** or **REJECT** until license, maintenance, security and tenant evidence is gathered for a pinned release.
5. Required next probe: reproduce one synthetic inbound interaction and one handoff in a disposable tenant, record only hashes/shape, and verify that source envelope, actor, recipient, audit and deletion/retention semantics can be represented without overwriting raw data. This is future work, not performed here.

## Evidence and honesty boundary

The URLs above are public source pointers, not proof that pages were reachable on 2026-11-13. Versions, dates, licenses and maintenance statements must be rechecked against pinned commit/release metadata before an implementation decision. No credentials, customer data, private endpoints or live claims are included.
