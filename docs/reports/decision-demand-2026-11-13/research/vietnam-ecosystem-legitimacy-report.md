# W2d — Vietnam ecosystem and legitimacy research report

**Decision date:** 2026-11-13
**Status:** non-canonical research; source-level desk review only. No live verification, OA login, partner approval, credential test, or private endpoint was performed.

## Decision frame

Vietnam channel access is a legitimacy and provenance problem as much as an API problem. Official Zalo OA and documented partner routes must remain distinct from unofficial bridges or scraping. Sapo and Pancake are possible commercial-system adapters, not authorities for the canonical Lead/Event model.

## Candidate review

| Candidate | Exact public source URLs | Source type / version or date | License / terms | Maintenance / security / tests | Tenant and credential suitability | Useful capabilities | Limitations | Verdict |
|---|---|---|---|---|---|---|---|---|
| Zalo Official Account OpenAPI & n8n OA node | https://developers.zalo.me/docs/official-account / https://github.com/congdinh2008/n8n-nodes-mochi-zalo-oa (`7bc2b1ad848b688f0496d42cc9b81acf91d5a0b1`) | Official Zalo developer docs + community MIT n8n node (`ZaloOA.node.ts`) | Platform terms + MIT (`package.json`) | Official OA route; community node has `test/ZaloOAHelpers.test.ts` + `ci.yml`, but couples to n8n runtime | Server-side OAuth2/PKCE and workspace-to-OA binding must live inside North Star | OA messaging/events, follower/context data and webhook integration where permitted | Do not embed n8n runtime; verify OA webhook authenticity and rate limits before use | **ADAPT official OA API directly** (**REFERENCE** for node schema only) |
| Unofficial Zalo bridges & CRMs (`zca-bridge`, `ZaloCRM`, `aiecos-social-crm`) | https://github.com/diendh/zca-bridge (`1d7fd594`) ; https://github.com/locphamnguyen/ZaloCRM (`86645670`) ; https://github.com/aiecosvietnam/aiecos-social-crm (`dba1bdb0`) | `SOURCE_VERIFIED` exact SHAs/tags (`v1.0.4`, `v3.4.0`, `v1.0.0`) | `zca-bridge`: Apache-2.0 (`src/zalo-oa/` official OA, `src/zalo/` `zca-js` unofficial); `ZaloCRM`: **AGPL-3.0 vs ISC conflict**; `aiecos-social-crm`: MIT (uses Chrome extension) | Inspected via GitHub API `2026-11-14T06:00:00Z`; `aiecos-social-crm` has 0 tests | **UNSAFE for production credentials**: personal QR/cookie (`zca-js`), device sessions or browser scraping of `app.pancake.vn` risk bans and leakage | Routing/outbox (`zca-bridge` `src/zalo-oa/` & `JobQueueRepo`) | Violates official channel terms; brittle reverse engineering; license/test gaps | **REJECT personal bridges/scraping** (`REFERENCE` `src/zalo-oa/` official OA module only) |
| Sapo (`Sapo-MCP`) | https://www.sapo.vn/ / https://support.sapo.vn/ / https://github.com/nguyennguyenit/Sapo-MCP (`v0.7.1`, `65a7af8c`) | Official service + `SOURCE_VERIFIED` MIT TypeScript MCP (`src/server.ts`, `src/guards.ts`) | Proprietary service terms; `Sapo-MCP` is MIT | Vitest unit/guard tests + `test.yml`/`release.yml`/`canary.yml` verified via API; not executed | Single-shop Private App credentials are not multi-tenant SaaS OAuth | Commerce/order/customer/inventory context & guard/mode patterns | Commerce records are not canonical leads, evidence or revenue attribution | **ADAPT** as bounded commerce projection only after SaaS auth review |
| Pancake & Pancake MCPs (`pancake-pos-mcp`, `pancake-mcp-server`) | https://pancake.vn/ / https://docs.pancake.vn/ / https://github.com/nguyennguyenit/pancake-pos-mcp (`c9a67faf`, MIT) / https://github.com/lynguyenvu/pancake-mcp-server (`1e6678ba`, license UNKNOWN) | Official service + `SOURCE_VERIFIED` MCP wrappers (`2026-11-14T05:55:00Z`) | `pancake-pos-mcp`: MIT; `pancake-mcp-server`: **UNKNOWN (no LICENSE)** | Neither repo has GitHub Actions CI; both wrap env API keys | Page/inbox/shop credentials must be server-held, workspace-scoped and rotated | Conversation/POS order/inventory schemas; `pancake-pos-mcp` Vitest replay fixtures | PH4 remains **FLAG_OFF**; `lynguyenvu` license UNKNOWN (do not copy code); Conversations != POS | **ADAPT after Gate before PH4** (`lynguyenvu` **REJECT** code reuse) |
| Source-verified shortlist matrix | See `docs/reports/decision-demand-2026-11-13/research/wp4-p1-02-shortlist-source-matrix.md` | Verified `2026-11-14T05:55:00Z` | Per-repo verified | Complete SHA, license, file, symbol & test inventory | — | Exact provenance & tenant risk ledger | Topic indexes are rejected as evidence | **SOURCE_VERIFIED** |

## Legitimacy and routing rules

1. **Official-first:** use Zalo OA official routes or a contracted, documented partner route. A community bridge is not equivalent evidence.
2. **Credential boundary:** credentials remain in a server-side secret manager; never in fixtures, logs, reports, browser storage or agent prompts. Bind token ownership to workspace and provider account, and support rotation/revocation.
3. **Raw preservation:** retain provider payload identity/hash and source timestamps; preserve UNKNOWN when event payloads omit sender, consent, message context or outcome.
4. **Provider IDs are not Lead IDs:** map Zalo user/OA, Sapo customer/order and Pancake page/thread IDs as external identities only. Merge remains deferred/manual and evidence-backed.
5. **No outbound autonomy:** a provider adapter may ingest and propose; sending messages, changing assignment or closing work must pass the existing policy/action boundary.

## Synthesis for W2d

- **ADAPT:** official Zalo OA is the preferred channel path, subject to permission, consent, webhook authenticity and tenant binding review.
- **ADAPT later:** Pancake is relevant to PH4 but remains gated; Sapo is a commerce projection candidate when a customer need justifies it.
- **REJECT:** unofficial Zalo bridges and community Sapo/Pancake bridges for production credentials or canonical evidence.
- **No legitimacy claim:** this report does not certify a partner, approval, API availability, commercial contract, or compliance posture.

## Evidence and honesty boundary

URLs are public source pointers only. Current terms, versions, endpoint behavior, permissions, security controls and tests were not live-verified. No OA credentials, private endpoint, customer data or live message was accessed.
