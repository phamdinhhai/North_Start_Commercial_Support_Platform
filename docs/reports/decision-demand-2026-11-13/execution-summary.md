# Decision and deep-research demand execution summary

**Date:** 2026-11-14
**Branch:** `feat/decision-demand-execution`
**Starting baseline:** `5d6c206`
**Current candidate head:** `baa841f` (hosted CI pending)
**Hosted workflows for prior head:** https://github.com/phamdinhhai/North_Start_Commercial_Support_Platform/actions/runs/43467587059 and https://github.com/phamdinhhai/North_Start_Commercial_Support_Platform/actions/runs/43467574115
**PR:** https://github.com/phamdinhhai/North_Start_Commercial_Support_Platform/pull/1
**Hosted workflow for current candidate:** pending push
**Status:** technical development baseline improved; commercial and production release **NOT APPROVED**

## A–J delivery disposition

| Area | Delivered | Disposition and evidence boundary |
|---|---|---|
| A. Engineering baseline | Current-head acceptance/handoff updates, pushed feature branch and PR #1 | Prior head was hosted-green; current candidate includes reviewed research/spikes and browser harness and requires a new hosted run. |
| B. Architecture and decisions | Ten proposal RFCs plus security/lifecycle proposals; seven-decision registry | Proposal-only. CE-1, CE-2, PM-1, MM-1, ID-1, ID-2 and LG-1 remain `OPEN`; no canonical file changed. |
| C. Third-party integration research | Provider readiness/Pancake reports, W2 omnichannel/ads/CRM/Vietnam reports, connector/Agent Skills evaluation, source-level repository matrix and executable synthetic mapping/metrics spikes | Pancake remains `PARTIAL`/`FLAG_OFF`; Anthropic Data Manager v1.9/call-conversion/Agent Skills evidence is documented-only from supplied sources and independently unverified; all repository/OSS claims remain source-level, not live verified. |
| D. GitHub/reusable assets | Expanded omnichannel/ads/CRM/Vietnam/connector research reports, reusable-assets registry and research-demand status | Candidate verdicts remain REFERENCE/UNKNOWN unless license, security, compatibility and bounded tests support ADAPT/ADOPT. Unofficial Zalo/WhatsApp/private automation is rejected for production. |
| E. Integration capability evidence | Evidence/capability registry with lifecycle vocabulary | Documentation and inventory coverage remain distinct from contract-tested, live-verified and release-approved states. |
| F. Implemented product boundaries | Authenticated feedback/telemetry routes, durable-mode guard, disabled-by-default Pancake contract adapter, redaction-preserving ports, concurrent CAS/scoped-mutation tests | Routes derive workspace and actor from auth context; Pancake Conversations/POS remain distinct; contract-first adapter is mock-transport only and not live verified. |
| G. Reliability and security | CAS winner/conflict tests, cross-workspace history/evidence tests, opaque HTTP 500 mapping, migration lifecycle tests, CI high/critical audit and changed-line credential-pattern guard | Hosted PostgreSQL integration passed 4 suites/20 tests without skips. Hosted security gate passed; seven low/moderate transitive tooling advisories remain. |
| H. Operator workflow | Workspace-scoped queue API, keyset cursor, filters, redacted projections, `/v1/operator` accessible thin client, and a controlled Playwright lane | HTTP E2E remains green and the browser harness is committed, but browser execution is blocked locally: port 3100 was occupied; an alternate-port run reached Playwright but failed page setup after 30 seconds and then worker exit `3221225794`. No browser pass is claimed. Raw evidence remains intentionally redacted. |
| I. Release/operations | Security/lifecycle/tenant/RLS/backup-DR proposal RFCs, pushed PR and hosted validation | Hosted CI and PostgreSQL proof now exist for the PR head; production IAM, RLS, retention/delete/export, encrypted off-site backup, restore rehearsal, deploy/rollback and hosted release-signing remain unimplemented or human-gated. |
| J. Product validation | Demand and gate registers preserve open questions and unknowns | No real-user, credential-bound provider, customer-data, revenue-uplift or commercial-readiness evidence exists. |

## Current executable results

Executed from `product/` against the integrated tree:

- `npm ci` — **PASS**; clean install completed. The full development audit reports seven low/moderate transitive tooling advisories.
- `npm run typecheck` — **PASS**.
- `npm run lint` — **PASS**.
- `npm run test:architecture` — **PASS**, 8/8 fixtures.
- `npm run architecture:check:strict` — **PASS**, 0 findings.
- `npm test -- --no-file-parallelism` — **PASS**, 315 passed; 21 PostgreSQL tests skipped locally without a database.
- `npm run test:e2e` — **PASS**, 7/7.
- `npm run test:backup` — **PASS**, 6/6.
- `npm run test:cov -- --no-file-parallelism` — **PASS locally**, 83.84% lines, 80.42% statements, 71.84% branches and 83.68% functions; hosted PostgreSQL-inclusive coverage for the prior head was 89.88% lines, 79.22% branches and 90.84% functions.
- `npm run build` — **PASS**.
- `npm run security:audit` — **PASS** at the configured high/critical threshold; seven low/moderate transitive advisories remain documented.
- `npm audit --omit=dev` — **PASS**, 0 production vulnerabilities.
- Prior hosted GitHub Actions runs `43467587059` and `43467574115` — **PASS** for head `0a54ed9`; PostgreSQL integration ran 4 suites/20 tests without skips, coverage ran 32 files/323 tests, HTTP E2E ran 7/7, strict architecture passed 0 findings, and build passed.
- `npm run registry:validate` — **PASS locally** on the current candidate, 7 decisions, 6 capabilities, 12 assets; unique IDs, source/date/license checks and secret-like text guard.
- Browser-level E2E — **BLOCKED locally**: default port 3100 was occupied; `BROWSER_PORT=3117 npm run test:browser` reached Playwright but failed page setup after 30 seconds and then worker exit `3221225794`. No browser pass is claimed.
- New hosted CI for the current candidate — pending push.

## Integrated commits

- `7310ff0` — security/lifecycle proposal RFCs.
- `008e8e2` — authenticated feedback and telemetry API boundaries.
- `0b0f46b` — CE-1/CE-2/Q1–Q4/MM-1/ID-1/ID-2/LG-1 proposal RFCs.
- `7c4ba1b` — current-head acceptance and handoff reconciliation.
- `84dcc17` — concurrent/scoped mutation reliability tests.
- `290daa2` — provider and Pancake readiness reports.
- `bd35d47` — demand traceability, decision, evidence/capability and reusable-asset registries.
- `7caf535` — CI dependency/diff security gates.
- `bf201bc` — disabled-by-default Pancake contract-first read adapter.
- `cb1c33b` — workspace-scoped operator queue API and redacted projection.
- `aa8e895` — opaque unexpected HTTP errors, PostgreSQL CAS/migration lifecycle tests.
- `4834fea` — keyset cursor correction, served accessible operator client, registry correction.
- `6cd0154` — neutralized Pancake contracts into ports; strict architecture fix.
- `3314cee` — normalized CI documentation whitespace; hosted workflow green.
- `c7a1bd9` — ads/CRM source-level research and synthetic normalizers.
- `3a636ee` — omnichannel/Vietnam repository matrix and channel-capability normalizer.
- `d9ee4de` — corrected Anthropic Data Manager taxonomy and registry identity.
- `82d65f8`, `e298f9c`, `39bd829` — controlled Playwright browser lane and synthetic operator scenarios.
- `baa841f` — moved synthetic spikes into the owned adapter layer and reconciled evidence paths.

## Release disposition and next gate

This branch is suitable as an evidence-backed technical development baseline and reviewable implementation PR, not as a production or commercial release. Before release or real-data pilot, the following remain mandatory: human approval of the seven canonical decisions; PM-1 IAM and credential lifecycle; tested tenant defense-in-depth/RLS; legal retention/export/delete/hold policy; disposable restore rehearsal and approved DR ownership; hosted artifact/signing/deploy evidence; provider credential and live verification; full operator usability validation beyond the thin served client; and L3/L4/L5 product validation.

The user-provided `docs/decision_and_deepresearch_demand.md` remains preserved as an untracked input and is intentionally not committed as part of this execution package. No credentials, customer data, private Pancake cookies/endpoints or canonical documents were added or modified.
