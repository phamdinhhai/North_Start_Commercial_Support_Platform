# Streams A/D deep-research spike

Date: 2026-11-14
Scope: public GitHub pages and repository metadata only; no credentials, private endpoints, live MCP calls, or customer data. This spike does not change canonical domain documents.

## Method and legitimacy rubric

Facts below are page-observed public evidence. Exact commit hashes were not exposed by the permitted web fetches; GitHub API requests returned HTTP 403. Therefore each head is recorded as a branch plus a commit-history URL, never as an invented SHA. **Official** means vendor/organization-owned; **partner** means a named integration ecosystem; **unofficial** means community/independent; **unverified** means the requested identity or source could not be safely confirmed.

North Star mapping is deliberately anti-corruption: retain raw payload and external identity in a Commercial Envelope; project conversation/contact/assignment/handoff/webhook/retry/audit only when source evidence supports it; otherwise retain UNKNOWN. No repository evidence resolves CE-1, CE-2, MM-1, ID-1, ID-2, PM-1, or LG-1.

## International repositories (Stream A)

### Chatwoot
- URL: https://github.com/chatwoot/chatwoot
- Head: `develop`; history/commit evidence must be pinned before implementation.
- License: MIT, `LICENSE.md`: https://github.com/chatwoot/chatwoot/blob/develop/LICENSE.md
- Source paths: `app/`, `config/`, `db/`, `lib/`, `spec/`, `tests/playwright/`, `docs/`, `docker/`, `deployment/`.
- Legitimacy: public vendor project; README describes open-source/self-hosted customer support, omnichannel inbox, collaboration, automation and reporting. Treat as official product repository, while deployment/API authority remains separately verified.
- North Star: conversation/contact/inbox assignment and webhook adapter candidates. Do not import Chatwoot status semantics into canonical Lead/Customer; preserve external IDs and raw events.

### ChatbotXIO/ChatbotX
- URL: https://github.com/ChatbotXIO/ChatbotX
- Head: `main`; history must be pinned.
- License: MIT for community/original content; `apps/builder/src/enterprise` has a separate Commercial License and third-party components retain their licenses. `LICENSE`: https://github.com/ChatbotXIO/ChatbotX/blob/main/LICENSE
- Source paths: `apps/builder`, `apps/worker`, `apps/realtime`, `apps/cli`, `apps/mcp-server`, `integrations/`, `packages/`, `docker-compose.yml`.
- Legitimacy: organization-owned public project; README claims omnichannel WhatsApp/Facebook/Instagram/Threads/TikTok/Telegram/Zalo/email/API/webchat, inbox/CRM, AI agents, permissions, webhooks/HTTP actions and MCP/API surfaces. Treat as product-origin evidence, not proof of any external API entitlement.
- North Star: conversation/contact/assignment/handoff candidates; AI output remains draft-only (I-03), and tool/action calls remain policy-gated.

### OneBook-ERP/OneChat
- URL: https://github.com/OneBook-ERP/OneChat
- Page-observed branch: `version-1`; displayed history was 44 commits; pin a SHA before implementation.
- License: AGPL-3.0.
- Source paths: `onechat/`, `frontend/`, `realtime/`, `docs/`, `.github/`, `package.json`, `pyproject.toml`, `setup.py`.
- Legitimacy: public OneBook-ERP organization project. README describes Frappe shared inbox for WhatsApp/Instagram with ERPNext/Frappe CRM, assignment/collaboration, order/invoice context, campaigns, chatbots and workflows.
- North Star: conversation/contact and assignment surfaces can become adapter fixtures; handoff/retry/audit are not assumed from product claims. AGPL obligations must be reviewed before distribution.

### erxes
- URL: https://github.com/erxes/erxes
- Head: `main` (README license link uses `master` path); pin exact source revision.
- License: AGPLv3, `LICENSE.md`: https://github.com/erxes/erxes/blob/master/LICENSE.md
- Source paths: `apps/`, `backend/`, `frontend/`, `cloudflare/mail-worker/`, `docs/`, `scripts/`, `products.json`, `migrations.json`, `package.json`, `nx.json`.
- Legitimacy: public product organization with active docs/issues/PRs and self-hosted Experience Operating System positioning.
- North Star: omnichannel frontline/contact/assignment patterns are comparative evidence only; canonical Commercial Events remain North Star-owned.

### abhinavxd/libredesk
- URL: https://github.com/abhinavxd/libredesk
- Head: `main`; pin exact revision.
- License: AGPL-3.0.
- Source paths: `cmd/`, `internal/`, `frontend/`, `static/`, `i18n/`, `scripts/`, `schema.sql`, `docker-compose.yml`, `config.sample.toml`.
- Legitimacy: independent public project; README describes a self-hosted single-binary support desk with email/live chat/WhatsApp, unified inbox, automation, webhooks and API.
- North Star: useful inbox/conversation comparison; webhook/retry/audit claims require exact source/test evidence. Review AGPL obligations.

### frappe/whatsapp
- URL: https://github.com/frappe/whatsapp
- Head: `develop`; pin exact revision.
- License: MIT.
- Source paths: `whatsapp/`, `ui/`, `README.md`, `pyproject.toml`, `package.json`, `.github/workflows/`.
- Legitimacy: official Frappe ecosystem app; README identifies Meta WhatsApp Business Cloud API integration with inbound/outbound webhooks, contacts, media/templates, delivery status, template sync, APIs/realtime and automation hooks.
- North Star: strong candidate for envelope fixtures around WhatsApp message/contact/status events. Delivery/retry/audit semantics are source-specific and cannot be inferred from Meta integration branding.

### ArnasDon/wacrm
- URL: https://github.com/ArnasDon/wacrm
- Head: `main`; pin exact revision.
- License: MIT.
- Source paths: `src/`, `messages/`, `public/`, `supabase/`, `mcp-server/`, `docs/`; public API docs: https://github.com/ArnasDon/wacrm/blob/main/docs/public-api.md
- Legitimacy: independent public self-hostable WhatsApp CRM template with deployment/security/contribution materials; README claims shared inbox, contacts, pipelines, broadcasts, automation, AI/RAG, roles and REST/MCP.
- North Star: conversation/contact/assignment candidates; preserve Lead/Customer distinction (I-01) and three-part identity chain (I-02); do not treat CRM tables as canonical semantics.

### ygncode/wateaminbox
- URL: https://github.com/ygncode/wateaminbox
- Head: `main`; history page initially returned a transient 404 then succeeded; pin exact revision.
- License: MIT, `LICENSE`.
- Source paths: `apps/`, `dev-utils/`, `docs/`, `infrastructure/`, `packages/`, `scripts/`, `services/`, `vendor`, `package.json`, `bun.lock`, `docker-compose.yml`, `compose.production.yml`, `.env.example`, `SECURITY.md`, `CONTRIBUTING.md`.
- Legitimacy: community public self-hosted WhatsApp/Telegram team inbox; limited adoption observed.
- North Star: inbox/team assignment candidate only; assignment/handoff/retry/audit remain UNKNOWN until source paths and tests are pinned.

### bke-edu/open-channel-hub
- URL: https://github.com/bke-edu/open-channel-hub
- Head: `main`; displayed history 42 commits; pin exact revision.
- License: AGPL-3.0-or-later.
- Source paths: `apps/`, `packages/`, `docs/`, `scripts/`, `docker/postgres/init`, `docs/operations`, `docs/adr`, `docs/security`, `docs/maintainers`, `compose.yaml`, `Dockerfile`, `.env.example`, `service.manifest.yaml`.
- Legitimacy: organization-specific open-source hub with CI/CodeQL and governance docs, but limited adoption. README explicitly describes Telegram/Zalo OA/Facebook Page/WhatsApp inbound, PostgreSQL idempotent inbound ledger, unified inbox APIs and durable reply intents.
- Important limitation: README explicitly says outbound delivery/workers/retries/live confirmation/full RBAC/attachments/search/backups/production TLS are not implemented. This is direct negative evidence, not a gap to fill with inference.
- North Star: strong raw-envelope/idempotency comparison; preserve UNKNOWN for outbound/retry/audit and do not overstate production readiness.

## Vietnam repositories (Stream D)

### ChatbotXIO/chatbotx-agent
- URL: https://github.com/ChatbotXIO/chatbotx-agent
- Head: `main`; history: https://github.com/ChatbotXIO/chatbotx-agent/commits/main/; 8 commits shown; exact hash inaccessible.
- License file exists at `LICENSE`, type not visible in permitted capture.
- Source paths: `skills/chatbotx`, `skills/chatbotx-mcp`, `plugin.json`, `mcp.json`, `.github/workflows`, `scripts/upstream`, `README.md`.
- Legitimacy: organization-owned public ecosystem repository related to ChatbotX; thin agent/plugin layer around CLI/MCP, not CRM implementation.
- North Star: agent boundary only; no evidence for canonical conversation/contact state. AI remains draft-only and MCP actions remain policy-gated.

### diendh/zca-bridge
- URL: https://github.com/diendh/zca-bridge
- Head: `main`; history: https://github.com/diendh/zca-bridge/commits/main/; 45 commits; exact hash inaccessible.
- License: Apache-2.0, `LICENSE`.
- Source paths: `src/zalo`, `src/zalo-oa`, `src/chatwoot`, `src/handlers`, `src/worker`, `src/store`, `src/admin`, `src/alerting`, `src/media`.
- Legitimacy: community bridge, not official Zalo affiliation. README discloses unofficial personal-Zalo `zca-js` use and account-lock risk; OA and personal channels are distinct.
- North Star: separate channel identity and terms-risk metadata; raw payloads remain immutable. Do not claim official API authorization or infer retry/audit from workers alone.

### locphamnguyen/ZaloCRM
- URL: https://github.com/locphamnguyen/ZaloCRM
- Head: `main`; history: https://github.com/locphamnguyen/ZaloCRM/commits/main/; 1,212 commits; exact hash inaccessible.
- License: AGPL-3.0, `LICENSE`.
- Source paths: `backend`, `frontend`, `assets`, `scripts`, `docker`, `docs`, `.env.example`, `README.md`, `SECURITY.md`, `CONTRIBUTING.md`, `THIRD-PARTY-LICENSES.md`.
- Legitimacy: independent/unofficial Zalo/VNG project; README warns automation may cause account restrictions and includes trademark/network-source obligations.
- North Star: CRM/contact and chat candidates; never merge Customer and Lead, never collapse identity concepts, and record external account legitimacy as a limitation.

### congdinh2008/n8n-nodes-mochi-zalo-oa
- URL: https://github.com/congdinh2008/n8n-nodes-mochi-zalo-oa
- Head: `main`; history 9 commits; exact hash inaccessible.
- License: MIT, `LICENSE`.
- Source paths: `src`, `test`, `docs`, `.github/workflows`, `package.json`; webhook docs: https://github.com/congdinh2008/n8n-nodes-mochi-zalo-oa/blob/main/docs/nodes/zalo-oa-webhook.md; npm: https://www.npmjs.com/package/n8n-nodes-mochi-zalo-oa
- Legitimacy: low-adoption community n8n nodes over official Zalo OA API v3.0; not Zalo-owned.
- North Star: useful inbound/webhook/follower/media/commerce adapter fixture candidate. Credentials/API authorization were not accessed; retry/audit require explicit implementation evidence.

### aiecosvietnam/aiecos-social-crm
- URL: https://github.com/aiecosvietnam/aiecos-social-crm
- Head: `main`; 13 commits shown; exact hash inaccessible.
- License: MIT.
- Source paths: `SETUP.md`, `docs`, `admin-ui`, `chrome-extension`, `sync-receiver`, `mcp-server`, `examples`, `docker-compose.yml`, `README.md`.
- Legitimacy: organization/product-associated public reference/template, not proof of Pancake sponsorship or production support. README describes Pancake (Zalo OA/Facebook Messenger/Instagram) sync into Supabase, admin UI, MCP server, B2B classification and realtime sync.
- North Star: external ingestion → sync receiver → persistence → UI/MCP is a useful boundary pattern; preserve raw source identity and policy-gate all actions.

### Pancake POS MCP (interpreted public target)
- URL: https://github.com/nguyennguyenit/pancake-pos-mcp
- Head: `main`; 54 commits shown; exact hash inaccessible.
- License: MIT.
- Source paths: `src`, `src/api-client`, `src/tools`, `src/resources`, `src/server.ts`, `src/worker.ts`, `src/index.ts`, `tests`; API reference: https://github.com/nguyennguyenit/pancake-pos-mcp/blob/main/docs/api-quick-reference.md
- Legitimacy: independent public MCP wrapper, not Pancake-owned evidence. README/repository description conflict on tool count (23 vs 24), so count is unresolved.
- North Star: external tool/resource boundary only. Tool schemas and responses must be recorded as raw evidence; no MCP tool may bypass policy or mutate canonical state autonomously.

### Sapo-MCP
- URL: https://github.com/nguyennguyenit/Sapo-MCP
- Head: `main`; exact hash inaccessible.
- License: MIT.
- Source paths: `src`, `docs`, `examples`, `tests`, `package.json`, `README.md`, `.github/workflows`; npm: https://www.npmjs.com/package/sapo-mcp
- Legitimacy: independent public MCP server; README claims 105 tools, four modes, stdio/Streamable HTTP and single-tenant private app. It documents security controls and known broken tools, which is useful transparency but a quality caveat.
- North Star: broad e-commerce adapter candidate; treat tool counts and behavior as unverified until pinned revision and fixtures. Preserve UNKNOWN for known broken/unsupported tools.

### pancake-mcp-server
- URL: https://github.com/lynguyenvu/pancake-mcp-server
- Head: `master`; history: https://github.com/lynguyenvu/pancake-mcp-server/commits/master/; 37 commits; exact hash inaccessible.
- License: MIT.
- Source paths: `src/pancake_mcp`, `tests`, `docs`, `README.md`, `.env.example`, `pyproject.toml`, `Dockerfile`, `docker-compose.yml`.
- Legitimacy: independent public Python remote MCP server, not Pancake-owned evidence. Tool-count claims conflict (20 repository description, 32 in one README section, 31 in another); unresolved until pinned.
- North Star: external MCP boundary; credentials/API-key setup was not used, and no tool count or runtime mutation claim is accepted as canonical behavior.

## Cross-repository patterns

1. Common conceptual surfaces are conversation, contact, inbox/team assignment, webhook/trigger, CRM projection, and sometimes handoff. Product README language is not a field-level contract.
2. Safe common denominator is a typed inbound envelope with `workspaceId + connection + externalRecordId` idempotency scope, immutable raw payload/hash, external event type, source capture time, pending mapping, and explicit mapping errors.
3. Capability values must be `true`, `false`, or explicit UNKNOWN state; missing evidence must never become `false`.
4. Unofficial personal-Zalo automation carries account-lock/terms risk; OA API integrations are a distinct legitimacy class. AGPL repositories have material network/source obligations.
5. Pancake implementations split into a reference CRM template (AIECOS), TypeScript/Bun server (`pancake-pos-mcp`), and Python remote server (`pancake-mcp-server`); conflicting tool counts are direct evidence of documentation drift. Sapo-MCP’s own known-broken-tools disclosure should be retained as a limitation.

## Synthetic typed capability normalizer

Added source and positive/negative fixtures:

- `product/src/adapters/channel-capability.normalizer.ts`
- `product/src/adapters/channel-capability.normalizer.spec.ts`

The adapter-neutral normalizer preserves explicit UNKNOWN states, converts absent/malformed capability values to `unknown` with limitations, and never creates Leads/Customers, mutates Commercial Events, resolves permissions, or collapses channel identity.

## Blockers and next probes

- Exact commit SHA evidence was unavailable because permitted GitHub API calls returned HTTP 403; use each commit-history URL to pin a SHA before implementation.
- Before adapter coding, capture license digest, package manifest, webhook/controller/handler paths, retry implementation, assignment/handoff implementation, and tests for every selected repository.
- For MCP candidates, record tool schemas separately from runtime observations and test destructive-operation policy independently.
- No credentials, private endpoint, API token, live MCP tool, or customer data was used.

## Non-resolution statement

This spike is research input only. It does not alter canonical semantics or resolve any open decision. External repositories cannot authorize autonomous AI actions, overwrite raw evidence, merge identities, or bypass lead-scoped RBAC.
