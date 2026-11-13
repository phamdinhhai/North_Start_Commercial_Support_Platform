# Decision and deep-research demand execution summary

**Date:** 2026-11-13  
**Branch:** `feat/decision-demand-execution`  
**Starting baseline:** `5d6c206`  
**Current verification head:** pending commit for queue keyset/operator client/provider registry correction (hosted PR #1)  
**Status:** technical development baseline improved; commercial and production release **NOT APPROVED**

## A–J delivery disposition

| Area | Delivered | Disposition and evidence boundary |
|---|---|---|
| A. Engineering baseline | Current-head acceptance/handoff updates and executable gate record | Local code gates pass; PostgreSQL-backed gates are blocked on this host because Docker is unavailable and no disposable `TEST_DATABASE_URL` was supplied. |
| B. Architecture and decisions | Ten proposal RFCs plus security/lifecycle proposals; seven-decision registry | Proposal-only. CE-1, CE-2, PM-1, MM-1, ID-1, ID-2 and LG-1 remain `OPEN`; no canonical file changed. |
| C. Third-party integration research | Provider readiness and Pancake reports; capability registry | Pancake remains `PARTIAL` and `FLAG_OFF`; Anthropic/Data Manager, Zalo OA, Sapo, HubSpot, Salesforce and Zoho remain incomplete or unknown where evidence is absent. |
| D. GitHub/reusable assets | Reusable engineering assets registry and research-demand status | Candidates are reference material only. No community repository is treated as adopted or production-approved without license, security, contract and live evidence. |
| E. Integration capability evidence | Evidence/capability registry with lifecycle vocabulary | Documentation and inventory coverage remain distinct from contract-tested, live-verified and release-approved states. |
| F. Implemented product boundaries | Authenticated feedback/telemetry routes, durable-mode guard, redaction-preserving ports, concurrent CAS/scoped-mutation tests | Routes derive workspace and actor from auth context and refuse non-durable mode. Existing pilot routes and UNKNOWN/evidence semantics are preserved. |
| G. Reliability and security | CAS winner/conflict tests, cross-workspace history/evidence tests, CI high/critical audit and changed-line credential-pattern guard | Local unit coverage is verified. PostgreSQL concurrency, migration and rollback evidence is not refreshed in this environment. CI security guard is intentionally not a replacement for hosted secret scanning/SAST. |
| H. Operator workflow | Existing per-lead pilot mutation surface retained | The requested workspace queue/context UI was not implemented in this execution. No generic task engine or queue semantics were invented; this remains a bounded LVP gap. |
| I. Release/operations | Security/lifecycle/tenant/RLS/backup-DR proposal RFCs and updated operational status | No production IAM, RLS, retention/delete/export, encrypted off-site backup, restore rehearsal, deploy/rollback or hosted CI proof is claimed. |
| J. Product validation | Demand and gate registers preserve open questions and unknowns | No real-user, credential-bound provider, customer-data, revenue-uplift or commercial-readiness evidence exists. |

## Current executable results

Executed from `product/` against the integrated tree:

- `npm ci` — **PASS**; clean install completed. The full development audit reports seven low/moderate transitive tooling advisories.
- `npm run typecheck` — **PASS**.
- `npm run lint` — **PASS**.
- `npm run test:architecture` — **PASS**, 8/8 fixtures.
- `npm run architecture:check:strict` — **PASS**, 0 findings.
- `npm test -- --no-file-parallelism` — **PASS**, 286 passed; 19 PostgreSQL tests skipped without a database.
- `npm run test:e2e` — **PASS**, 5/5.
- `npm run test:backup` — **PASS**, 6/6.
- `npm run test:cov -- --no-file-parallelism` — **PASS**, 84.24% lines, 70.84% branches, 83.47% functions.
- `npm run build` — **PASS**.
- `npm run security:audit` — **PASS** at the configured high/critical threshold; low/moderate transitive advisories remain documented.
- `npm audit --omit=dev` — **PASS**, 0 production vulnerabilities.
- `CI=true npm run test:integration:ci` — **BLOCKED** because Docker is unavailable and no disposable local PostgreSQL database was supplied.
- Hosted GitHub Actions — **NOT EXECUTED**; source workflow is not hosted execution evidence.

## Integrated commits

- `7310ff0` — security/lifecycle proposal RFCs.
- `008e8e2` — authenticated feedback and telemetry API boundaries.
- `0b0f46b` — CE-1/CE-2/Q1–Q4/MM-1/ID-1/ID-2/LG-1 proposal RFCs.
- `7c4ba1b` — current-head acceptance and handoff reconciliation.
- `84dcc17` — concurrent/scoped mutation reliability tests.
- `290daa2` — provider and Pancake readiness reports.
- `bd35d47` — demand traceability, decision, evidence/capability and reusable-asset registries.
- `7caf535` — CI dependency/diff security gates.

## Release disposition and next gate

This branch is suitable as an evidence-backed technical development baseline, not as a production or commercial release. Before release or real-data pilot, the following remain mandatory: human approval of the seven canonical decisions; PM-1 IAM and credential lifecycle; tested tenant defense-in-depth/RLS; legal retention/export/delete/hold policy; disposable restore rehearsal and approved DR ownership; hosted CI/security/artifact evidence; provider credential and contract verification; operator queue/context workflow and usability evidence; and L3/L4/L5 product validation.

The user-provided `docs/decision_and_deepresearch_demand.md` remains preserved as an untracked input and is intentionally not committed as part of this execution package. No credentials, customer data, private Pancake cookies/endpoints or canonical documents were added or modified.
