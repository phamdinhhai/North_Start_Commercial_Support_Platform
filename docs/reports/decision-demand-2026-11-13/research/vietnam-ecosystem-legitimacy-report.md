# W2d — Vietnam ecosystem and legitimacy research report

**Decision date:** 2026-11-13
**Status:** non-canonical research; source-level desk review only. No live verification, OA login, partner approval, credential test, or private endpoint was performed.

## Decision frame

Vietnam channel access is a legitimacy and provenance problem as much as an API problem. Official Zalo OA and documented partner routes must remain distinct from unofficial bridges or scraping. Sapo and Pancake are possible commercial-system adapters, not authorities for the canonical Lead/Event model.

## Candidate review

| Candidate | Exact public source URLs | Source type / version or date | License / terms | Maintenance / security / tests | Tenant and credential suitability | Useful capabilities | Limitations | Verdict |
|---|---|---|---|---|---|---|---|---|
| Zalo Official Account OpenAPI | https://developers.zalo.me/docs/official-account | Official Zalo developer documentation; API/version/date must be pinned | Platform terms and OA policies; SDK license varies and must be checked | Official source route; current endpoint behavior, permission review and security advisories not live-verified | OA/app ownership and server-side OAuth/token storage are required; workspace-to-OA binding and revocation must be explicit | OA messaging/events, follower/context data and webhook-style integration where permitted | Approval/scopes, rate limits, event coverage, consent and provider retention; does not supply canonical revenue meaning | **ADAPT** — preferred legitimate channel adapter |
| Unofficial Zalo bridges / scraping libraries | https://github.com/topics/zalo-api  /  https://github.com/topics/zalo | Public topic pointers and community repositories; no exact repository/release selected | **UNKNOWN** or repository-specific; platform terms may prohibit the route | Maintenance, security, tests, provenance and legal status are **UNKNOWN** | Do not use production credentials; tenant isolation and token safety are unproven | May expose experimental endpoints or automation patterns | Account bans, brittle reverse engineering, credential leakage and unverifiable provenance | **REJECT** for production; **REFERENCE** only for gap discovery |
| Sapo | https://www.sapo.vn/  /  https://support.sapo.vn/ | Official product/support pointers; plan/API version/date not live-verified | Proprietary service terms; integration terms must be confirmed | Commercial product with public support material; current API/security/test claims not live-verified | Shop/account tenancy and credential model require contract and least-privilege review | Commerce/order/customer/inventory context and possible webhooks/integration surfaces | Commerce records are not canonical leads, evidence or revenue attribution; field/retention mapping required | **ADAPT** for a bounded commerce projection |
| Pancake | https://pancake.vn/  /  https://docs.pancake.vn/  /  https://github.com/pancake-technology | Official product/docs and public organization pointers; exact API version/date must be pinned | Proprietary service terms; SDK/repository terms vary | Existing project source contains a documented Pancake research area; live provider/API behavior remains outside this report | Page/inbox/workspace credentials must be server-held, scoped, rotated and auditable | Conversation/inbox, page/channel and order/customer context relevant to the revenue-continuity pilot | Provider identity and display IDs cannot become Lead ID; send/mutation routes, permissions and event completeness require a PH4 spike | **ADAPT** after Gate before PH4; not currently ADOPT |
| Sapo/Pancake community bridges | https://github.com/topics/pancake-api  /  https://github.com/topics/sapo-api | Public discovery/topic pointers; no exact implementation selected | **UNKNOWN** | No evidence of maintenance/security/tests or provider authorization | **UNSAFE/UNKNOWN** for credentials and tenant boundaries | May help identify missing fields or operational patterns | Inherits all unofficial-bridge risks; can bypass terms and provenance controls | **REJECT** for production |

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
