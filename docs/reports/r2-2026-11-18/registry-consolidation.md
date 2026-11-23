# R2 registry consolidation (deliverables #4, #5, #6, #7, #13)

Date: 2026-11-18. Status: working, non-canonical research. Nothing here resolves an open decision, approves a dependency or approves production use. All provider entries are `production_approval: NOT_APPROVED`.

## Outputs

All files are in `docs/research/registry-2026-11-18/` and are checked by `product/scripts/registry-validation.mjs` (`validateConsolidatedRegistries`).

| File | Entries | Content |
|---|---|---|
| `provider-capability-registry.json` | 39 | One row per provider × surface × capability: transport, delivery model, auth model, permissions/approval, event coverage, identity fields, recovery/replay, evidence level + artifacts, unknowns, runtime readiness, production approval |
| `protocol-evidence-registry.json` | 36 | 8 private captures, 7 fingerprints, 12 public source revisions (with per-file digest re-check), 9 document snapshots, plus blob digests of the 12 committed sanitized artifacts |
| `github-research-matrix.json` | 53 repos | 33 inspection pins and 20 `git ls-remote` HEAD snapshots, plus `approved_dependencies` (19 packages, a mirror of `product/package.json`) |
| `reusable-assets-registry.json` | 27 | Adoption decision and rationale for the modular monolith on PostgreSQL |
| `decision-register.json` | 7 OPEN + 10 PROPOSED | CE-1, CE-2, MM-1, ID-1, ID-2, PM-1 and LG-1 stay OPEN. Proposals P-2026-11-18-01…10 are `PROPOSED` / `NOT_APPROVED` |

Evidence vocabulary (enforced): `README_CLAIM < SOURCE_INSPECTED < DOCUMENTED_API < SYNTHETIC_TESTED < CONTRACT_TESTED < LIVE_VERIFIED < RELEASE_APPROVED`.

## Summary tables

### Provider capabilities by evidence level

| Level | Count | Entries |
|---|---|---|
| SYNTHETIC_TESTED | 6 | Pancake socket message-lifecycle, settings/tag events, channel rejoin, bounded read reconciliation, browser companion, POS webhooks |
| DOCUMENTED_API | 20 | Pancake Public API read, POS API, POS Apps runtime; Meta Pages, Messenger, Instagram, Groups (documented as deprecated), Marketing Insights, Lead Ads, CAPI; TikTok Business Messaging, Marketing reporting, Events API; Google Ads GAQL, ChangeStatus (poll), legacy offline upload, Data Manager event ingestion; Sapo private app; Chatwoot; Twenty |
| SOURCE_INSPECTED | 9 | Pancake UI mutation, POS dashboard proxy; Meta personal private protocol; TikTok LIVE; Data Manager audience (skills repo); Google Ads MCP pattern; Zalo OA (community source only); Zalo personal; HubSpot |
| README_CLAIM | 4 | Pancake Conversations webhooks (page exists, no schema), TikTok Shop webhooks, ZNS/ZBS, Salesforce |
| CONTRACT_TESTED and above | 0 | none |

Access classes: 28 OFFICIAL_API, 1 OFFICIAL_EMBEDDED_APP_RUNTIME, 6 OBSERVED_INTERNAL_PROTOCOL, 3 COMMUNITY_REVERSE_ENGINEERED, 1 FIRST_PARTY_BROWSER_OBSERVATION. Runtime readiness: 6 synthetic, 33 none. None are at contract or sandbox.

### GitHub matrix and assets

| Verdict (matrix) | Count | | Asset decision | Count |
|---|---|---|---|---|
| REFERENCE | 36 | | REFERENCE | 15 |
| REJECT | 8 | | DEFER | 5 |
| ADAPT | 7 | | ADAPT | 3 |
| ADOPT | 2 (Playwright, jose) | | ADOPT | 3 (Playwright, pg, jose) |
| | | | REJECT | 1 (Temporal) |

`approved_dependency: true` is used only for `@playwright/test` and `pg`, which are present in this branch's `product/package.json`. **jose@6.2.17** is approved on the integration branch (D1 OIDC work). It is listed under `approved_dependencies.integration_branch_additions_pending_merge` and as `approved_on_integration_branch` on `gh.jose` and `asset.jose`. Its `approved_dependency` flag stays `false` because the validator compares against this branch's `package.json`. Flip it after merge. Keycloak, ZITADEL, Ory, OpenFGA, Cerbos and Casbin remain proposal-only. No Kafka, Redis or Temporal (P-2026-11-18-05 recommends a PostgreSQL job/outbox).

## Re-verification performed 2026-11-18

* **Pinned SHAs.** All 33 inherited inspection pins exist (GitHub API `repos/{o}/{r}/commits/{sha}`). The 20 new repositories are pinned to the `git ls-remote` HEAD and marked `LS_REMOTE_HEAD_SNAPSHOT`. That means nothing was inspected. None of the 53 is archived. Redirects observed: `facebook/facebook-{nodejs,python}-business-sdk` → `meta/…`, and `casbin/node-casbin` → `apache/casbin-node-casbin`.
* **Licenses.** `tiktok/tiktok-business-api-sdk` LICENSE.md is MIT (re-read). The Meta Node SDK LICENSE is the custom Meta Platform license (re-read). `anthropics/skills` has no root LICENSE.
* **Source file digests.** 42 inherited per-file SHA-256 values were re-hashed from raw blobs. 30 match exactly. The other 12, all from the 2026-11-14 source ledger, match only after converting LF to CRLF. They were hashed from a Windows `core.autocrlf=true` working tree. The content is unchanged, and raw blob digests are now recorded.
* **Google Ads REST.** The official REST examples page (API v26) shows `customers/{id}/campaigns:mutate` over REST.
* **Meta Node SDK.** At pin `246c937e` the SDK contains `src/objects/serverside/` (the CAPI classes).
* **google/skills.** `skills/ads/data-manager-api-{setup,event-ingestion,audience-ingestion}` exist at `67c4dbc8`.

## Conflicts and inconsistencies found in older registries (fixed in the new files)

1. **"live-verified" overclaim.** The 2026-11-15 `protocol-capability-registry.json` marked four Pancake rows `live-verified`: settings tag, page-channel reconnect, conversation tags and read reconciliation. Those rest on bounded private browser-session observations of an internal protocol. They are now capped at SYNTHETIC_TESTED/SOURCE_INSPECTED, and the observation is kept in `live_observation` (`NOT_INDEPENDENTLY_AUDITED`). The `pancake.pos.dashboard-read` row is now SOURCE_INSPECTED.
2. **Mixed evidence in `pancake.chat.read`.** In `registries/evidence-capability-register.json` it was `DOCUMENTED` with `live_state PARTIAL`, but it mixed Public API documentation with internal dashboard reads. It is split into `pancake.conversations.public-api.page-read` (DOCUMENTED_API) and `pancake.conversations.http.bounded-read-reconciliation` (internal protocol).
3. **Two different POS webhook doc URLs.** The register cites `pos.pancake.biz/developers/api/en/webhooks`, but the ledger hashed `pos.pancake.vn/developers/api/vi/webhooks.md`. The hashed `.vn` snapshot is now authoritative.
4. **Chatwoot pin drift.** It was `1ef1d2b4` (2026-11-14 metadata only) vs `0d62a53d` (2026-11-17 source inspection). Now `0d62a53d`, with the older pin kept in `prior_pins`.
5. **Nango pin drift.** It was `b6a9ee10` vs `961a8c79`. Now `961a8c79`, with the older pin in `prior_pins`.
6. **OpenTelemetry JS pin drift.** It was `5a78e6ae` vs `9e6be84d`. Now `9e6be84d`, with the older pin in `prior_pins`.
7. **mautrix/meta revisions.** The 2026-11-15 discovery-only pin `c032c9fb` and the 2026-11-17 inspected `f806b805` are both recorded. `d32c6dcf` (v0.5.3 MQTT) is separated as historical, so the current DGW is not labelled MQTT.
8. **Owner name casing.** `Zerodytrash/TikTok-Live-Connector` is now canonical lowercase `zerodytrash`.
9. **Meta Node SDK URL.** It was `facebook/…` in `url` vs `meta/…` in `source_url`. It now has a canonical URL plus a redirect note.
10. **Meta Node SDK license.** `ads-platforms-2026-11-17/meta.md` (untracked) said "MIT-style, ADOPT". The license is custom Meta, and the verdict is REFERENCE (not in `package.json`).
11. **Meta Node SDK and CAPI.** The same untracked file said the Node SDK has "No CAPI". `src/objects/serverside` exists (corrected in `meta.conversions-api.server-events`).
12. **TikTok SDK license.** `ads-platforms-2026-11-17/tiktok.md` said "custom TikTok license, NOT MIT". LICENSE.md is MIT and GitHub SPDX says MIT. Corrected.
13. **Google Ads mutations.** `ads-platforms-2026-11-17/google.md`/README said "Mutations are gRPC-only". REST mutate is documented. Corrected; mutation stays out of scope.
14. **google/skills verdict.** `ads-platforms-2026-11-17/google.md` had "AVOID, license UNCERTAIN, not an Ads repo". It is Apache-2.0 and contains official Data Manager skills, so the verdict is REFERENCE.
15. **TikTok Shop webhook evidence.** `tiktok.md` labelled the Shop webhook contract `DOCUMENTED_API`, but its only source is the community `jwen0605` simulation. Downgraded to README_CLAIM.
16. **Pancake socket event names.** The untracked `pancake-phoenix-observations.md` lists event types `messages/updates/deletions` (relay handler names). The bundle wire labels are `pages:update_messages`, `pages:update_conversation` and `messages:mark_as_deleted`. Both are recorded in `fp.pancake.message-lifecycle-labels`. `pages:seen_conversation` is added as name-only, SOURCE_INSPECTED, payload ASSUMED, and treated as schema drift by the companion (per the coordinator notice).
17. **Missing runbook.** The untracked `rea-protocol-intelligence-2026-11-17/README.md` lists `rea-investigation-runbook.md`, which does not exist in that directory.
18. **Wrong digest basis.** `protocol-evidence.json` recorded `afc96093…` for `protocol-capability-registry.json`. That is the Windows working-tree digest; the blob digest is `ac2c0339…`. Blob digests for all 12 sanitized artifacts are now recorded.
19. **ChangeStatus backlog row.** `google.change-feed-backlog` (proposed, UNKNOWN) is superseded by `google.ads-api.change-status`. That row is DOCUMENTED_API with `delivery_model: poll`, which the validator enforces.
20. **Data Manager taxonomy.** `product/src/adapters/decision-demand/ads-metrics-normalizer.spec.ts` models Google Data Manager `Event.call_info` as a native *reporting metric*. Data Manager is an ingestion (upload) API. This was **not fixed** (it is code owned by another agent). It is flagged in the registry `reconciliation_note` for the code owner.

## Validator extension

`validateConsolidatedRegistries(root, { repoRoot, packageJson })` checks the following:

* Header fields, the secret-like-string walk and the stale Data Manager taxonomy check.
* Required fields per registry, and the evidence-level enum.
* Every non-README_CLAIM entry has artifact refs. Repository refs must exist on disk. URLs must be https.
* `production_approval` other than `NOT_APPROVED` requires an artifact. `RELEASE_APPROVED` requires `release_approval_artifact`. `LIVE_VERIFIED` requires independently audited `live_evidence`.
* `runtime_readiness` must not exceed the evidence level. Observed/reverse-engineered protocols cannot be `licensed_api`. ChangeStatus must be `poll`. Data Manager must be attributed to Google.
* Private captures, and fingerprints derived from them, must be `NOT_INDEPENDENTLY_AUDITED`. `git_sha` is 40-hex; sha256 is 64-hex.
* Matrix SHAs must be 40-hex or `UNVERIFIED`, with a recorded verification method. `SOURCE_INSPECTED` requires inspected paths.
* `approved_dependencies` must exactly mirror `product/package.json`. `approved_dependency: true` requires the package to be listed there.
* The decision register lists exactly the seven canonical IDs, all `OPEN`. No `ACCEPTED/APPROVED/RESOLVED/CLOSED` value under any status/state key. Each proposal has at least two alternatives.

Existing validations are unchanged and still pass. Generator scripts were not committed; the JSON files are the reviewed artifacts.

```
$ npm run registry:validate
Registry validation: PASS (7 decisions, 6 capabilities, 13 assets)
Consolidated registry validation: PASS (39 provider capabilities, 36 protocol evidence, 53 GitHub repositories, 27 reusable assets, 7 open decisions, 10 proposals)
$ npm run test:registry
# tests 21  # pass 21  # fail 0
```

## Unverified items

* The private HAR, the REA bundles and the shipped Pancake bundle: 8 captures and 4 derived fingerprints, all `NOT_INDEPENDENTLY_AUDITED`.
* Pancake POS document digests (2026-11-14) were not re-fetched.
* Data Manager reference has no content digest.
* Zalo OA/ZNS official docs are unreadable (shell pages only).
* Sapo developer portal requires partner login.
* For the 20 `LS_REMOTE_HEAD_SNAPSHOT` repos, licenses come from GitHub SPDX only (n8n, Activepieces, pact-js, MCP repos, capi-param-builder: NOASSERTION, files not read).
* Meta permission names for Instagram messaging drift between documents.
* TikTok v1.3 vs v2.0 reporting versions; restatement window and attribution defaults are unverified.
* Google Ads API REST mutate evidence comes from a summarising reader, with no digest.

## Next-step research priorities

1. **Pancake (PH4 gate).** Obtain one pilot-page Public API `page_access_token` and a dedicated POS test shop. Record a sanitized Public API read fixture and a real POS webhook delivery/retry, which raises the level to CONTRACT_TESTED. Read the Pancake Chat webhook page in an authorized browser and record event names and signature.
2. **Pick the first ads provider by pilot channel mix (P-03).** Then run a read-only spike with a named account, recording granted fields, versions, timezone/currency and restatements.
3. **Zalo OA.** Retrieve official OA authentication, webhook and signature docs, for example from an authorized OA admin session. Verify token lifetime and the messaging window. Do not use the personal route.
4. **TikTok.** Read the official Shop webhook signature docs and Business Messaging eligibility for Vietnam. Confirm the v2.0 reporting migration.
5. **Re-hash the POS docs and add Data Manager / Meta / TikTok document digests,** so document snapshots become re-checkable.
6. **Re-read license files (not just GitHub SPDX)** for n8n, Activepieces, pact-js and the MCP repos before any of them moves beyond REFERENCE.
7. **Independent audit of the private Pancake captures** by a second reviewer with access, or a fresh authorized capture with redacted publication. This is the only route to lift `NOT_INDEPENDENTLY_AUDITED`.

## Inputs reused from untracked primary-worktree directories (read-only)

* `ads-platforms-2026-11-17/{README,meta,tiktok,google}.md`: Meta permission lists, Groups deprecation, Shop/LIVE surface split, click identifiers and the community repo list. Conflicting claims were corrected (items 10–15).
* `rea-protocol-intelligence-2026-11-17/{README,pancake-phoenix-observations}.md`: Phoenix topic families and the REA "instrument, not connector" boundary. Items 16–17 were found there.

## Review requests

* **Agent A (decision register).** Confirm the canonical guardrail wording and proposal ownership and approval paths, especially P-02 (PH4 path ordering), P-05 (PostgreSQL job/outbox), P-06 (jose plus in-process policy) and P-10 (private-protocol policy). Confirm that no proposal implicitly resolves CE-2 or MM-1.
* **Agent C (Pancake entries).** Review the 12 `pancake.*` provider rows. In particular, check the downgrade of 2026-11-15 "live-verified" rows to SYNTHETIC_TESTED plus `live_observation`, the split of `pancake.chat.read`, the `pages:seen_conversation` entry, and the `.vn` vs `.biz` POS webhook doc authority.
