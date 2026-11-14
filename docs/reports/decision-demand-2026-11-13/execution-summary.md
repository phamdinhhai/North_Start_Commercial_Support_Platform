# Decision and deep-research demand execution summary

**Date:** 2026-11-14
**Branch:** `feat/decision-demand-execution`
**Starting baseline:** `5d6c206`
**Prior hosted-verified head:** `b9fd1b6301eb4ed019b1099aced794a7ff407bfc` (superseded by corrective checkpoint below)
**PR:** https://github.com/phamdinhhai/North_Start_Commercial_Support_Platform/pull/1 (Draft; unmerged)
**Status:** corrective checkpoint P0-01..P0-03 & P1-01..P1-03 ready for final hosted CI; commercial and production release **NOT APPROVED**

## A–J delivery disposition

| Area | Delivered | Disposition and evidence boundary |
|---|---|---|
| A. Engineering baseline | Corrected taxonomy, hardened operator/browser semantics, Ubuntu browser CI job, hardened adapters, source-verified research matrix | Pending push of final corrective SHA; prior SHA `f947b5d` already passed Ubuntu `Browser operator workflow` (`2 passed (6.6s)`) while `product` failed only on a literal `sk-` secret fixture string in `registry-validation.test.mjs` (now fixed). |
| B. Architecture and decisions | Ten proposal RFCs plus security/lifecycle proposals; seven-decision registry | Proposal-only. CE-1, CE-2, PM-1, MM-1, ID-1, ID-2 and LG-1 remain `OPEN`; no canonical file changed. |
| C. Third-party integration research | Google Data Manager API v1.9 & `google/skills` direct `HTTP 200` verification (`2026-11-14T05:49:51Z`), source-verified matrix across 20+ repos (`gh api`), hardened synthetic spikes | Google Data Manager v1.9 (2026-11-04), `Event.callInfo`/`CallInfo.startTimestamp`, `AdIdentifiers.leadId`, `recordIndices` and `google/skills` (`67c4dbc8`) are `DOCUMENTED` (`HTTP 200`); `CONTRACT_TESTED` and `LIVE_VERIFIED` remain `UNKNOWN`. Pancake remains `PARTIAL`/`FLAG_OFF`. |
| D. GitHub/reusable assets | Source-verified matrix (`wp4-p1-02-shortlist-source-matrix.md`) with exact canonical URLs, 40-char SHAs, tags, license blob SHAs, symbols, tests, contradictions & risks; `reusable-engineering-assets.json` updated to 13 assets | Copyleft/restricted or scraping/unofficial-Zalo projects (`OneChat`, `erxes`, `frappe/crm`, `ZaloCRM`, `aiecos-social-crm`, `zca-bridge` personal mode, `lynguyenvu/pancake-mcp-server`) are `REJECT` for code embedding/production. |
| E. Integration capability evidence | `evidence-capability-register.json` separates `documented_state`, `contract_tested`, `live_state` and `release_state` with `registry-validation.mjs` anti-drift checks | Documentation and source verification never elevate `CONTRACT_TESTED`, `LIVE_VERIFIED` or `RELEASE_APPROVED`. |
| F. Implemented product boundaries | Confirmed human-declaration enforcement (`declaration` + `confirmed: true`), Observed/Declared/Inferred UI separation, 3 hardened synthetic read-only adapters (`ads-metrics-normalizer`, `crm-external-id-mapper`, `channel-capability.normalizer`) | Synthetic adapters use injective JSON-tuple identity keys, `dateGranularity`/`sourceVersion` provenance, CRM merge/reparenting diagnostics with `canonicalMergeApplied: false`, `contactLeadEquivalent: false`, and I-03 `agentBoundary <= humanBoundary` enforcement. |
| G. Reliability and security | Anti-drift registry validator + 9 fixture tests, CAS/supersession & cross-workspace isolation tests, CI secret/diff check | Prior hosted PostgreSQL integration passed 4 suites/20 tests without skips; production IAM, RLS and secret custody remain unimplemented/human-gated. |
| H. Operator workflow | `/v1/operator` explicit completion form (mode selector `declared`/`observed`/`inferred`, human declaration textarea + checkbox, system evidence ref input, no client-fabricated completion reason), `WORK_SUPERSEDED` / `STALE_VERSION` / `403` error surfacing, and Ubuntu Playwright browser CI job | Local Playwright passed **3/3** scenarios on `BROWSER_PORT=3128` covering UI human-declaration/confirmation, UI refusals (`declared` blank/unconfirmed, `inferred`, `observed` missing/customer-intake), reschedule in UI, 2-tab genuine `WORK_SUPERSEDED` conflict + replacement completion, `401`/`403` and cross-workspace `404`. Earlier Windows `0xC0000142` (`3221225794`) failure occurred during forced 30s page-setup timeout kill on a broken baseURL/port setup and was eliminated once fixed. |
| I. Release/operations | Dedicated `browser` Ubuntu job in `.github/workflows/ci.yml` with Chromium `--with-deps`, ephemeral port allocation, 120s startup timeout and always-uploaded artifacts | Production deploy/rollback, RLS, backup restore rehearsal and signing remain human-gated. |
| J. Product validation | Demand and gate registers preserve open questions and unknowns | No real-user, credential-bound provider, customer-data, revenue-uplift or commercial-readiness evidence exists. |

## Current executable results (pre-commit verification)

Executed from `product/` against the integrated tree:

- `npm run registry:validate` — **PASS** (7 decisions, 6 capabilities, 13 assets; includes monitored markdown anti-drift checks).
- `npm run test:registry` — **PASS**, 9/9 tests.
- `npm run typecheck` — **PASS**.
- `npm run lint -- --no-warn-ignored` — **PASS**.
- `npm run test:architecture` — **PASS**, 8/8 fixtures.
- `npm run architecture:check:strict` — **PASS**, 0 findings.
- `npm test -- --no-file-parallelism` — **PASS**, 338 passed (21 PostgreSQL integration tests skipped locally without Docker/Postgres; verified unskipped in hosted CI).
- `npm run test:e2e` — **PASS**, 7/7 HTTP E2E tests.
- `npm run test:backup` — **PASS**, 6/6.
- `npm run test:cov -- --no-file-parallelism` — **PASS locally**, 84.59% lines, 81.14% statements, 73.09% branches, 83.85% functions.
- `BROWSER_PORT=3128 npm run test:browser` — **PASS locally**, 3/3 Playwright tests (Chromium).
- `npm run build` — **PASS**.
- `npm run security:audit` — **PASS** (0 high/critical; 7 low/moderate transitive dev tooling advisories documented).
- `npm audit --omit=dev` — **PASS**, 0 production vulnerabilities.

## Release disposition and next gate

This branch remains a reviewable Draft PR (`#1`) and is **not** approved for merge or production release. Mandatory gates before real-data pilot or release remain unchanged: human approval of CE-1, CE-2, MM-1, ID-1, ID-2, PM-1 and LG-1; production IAM/OIDC/MFA and tenant RLS; legal retention/export/delete/hold policy; tested backup/restore DR rehearsal; credential-bound provider contract + live verification; and L3–L5 product validation.

The user-provided `docs/decision_and_deepresearch_demand.md` and `docs/login_info/` remain untracked and untouched. No credentials, cookies, private endpoints, customer data or canonical modifications were committed.
