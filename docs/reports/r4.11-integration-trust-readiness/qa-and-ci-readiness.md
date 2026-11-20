# R4.11 independent QA and CI readiness

2026-11-20. Initial review of baseline `5181aba2b325fb12fdb4a54b04783f23b4133d69`; R4.11 integrated runtime verification pending. The coordinator's fresh baseline 20-lane result is baseline evidence only. No new implementation, hosted R4.11 PASS, human acceptance, provider authorization or live integration is established here.

Read AGENTS.md, canonical invariants/open decisions, ADR-005 through ADR-009, R4.10 independent QA/release gates and R4.7 independent QA. CE-1, ID-1 and ID-2 remain open. Review uses the code-review-excellence skill for prioritized, reproducible findings.

## Acceptance matrix

Every scenario uses invented local fixtures. Browser tests must use signed OIDC, actual HTTP and an isolated PostgreSQL database. Service-delivery setup is disclosed separately from human UI actions. Each test must inspect durable effects or their absence, rather than assert only a response code.

| ID | Scenario | Required evidence | Status |
|---|---|---|---|
| QA-01 | Forge caller provenance or verification status | Server-controlled source authority; no accepted caller assertion of `verified=true`; original provenance retained; no commercial mutation | Pending integrated boundary |
| QA-02 | Replay same event; change payload under same event identity | Stable receipt on replay, one intended projection; changed payload conflicts without overwrite; independent source/workspace identities stay distinct | Pending HTTP + PostgreSQL |
| QA-03 | Missing, revoked or wrong service identity; wrong origin or target | Refuse before accepted ingress; credentials bind owner, origin and target; revocation effective next request | Pending HTTP + PostgreSQL |
| QA-04 | Cross-workspace receipt, evidence or Lead | Scoped not-found/refusal, zero foreign reads or mutations; authorized workspace comes from verified principal | Pending signed session |
| QA-05 | Forbidden evidence/body digest or unapproved provider semantics | Bounded rejection; no raw fabrication; browser cannot supply body digest; provider status does not become canonical outcome/revenue | Pending boundary negatives |
| QA-06 | Explicit receipt association and unlink | Human authorization and ownership enforced; append-audited non-destructive links; no attach during intake; historical receipt preserved; UI displays verified=false honestly | Pending signed browser + database |
| QA-07 | Same conversation/customer or provider identity | No automatic merge, no Customer=Lead collapse, stable Lead ID and independently visible source/lineage/attribution UNKNOWN | Pending identity slice |
| QA-08 | More than 100 records, cursor traversal and stale UI response | Reach records beyond first page without duplication/omission; bounded page size; obsolete response cannot replace current selection/query | Pending paging contract |
| QA-09 | Viewer, unrelated Sales, manager, admin; revoked membership | Existing ADR-006 role matrix and Lead ownership; no new authority; next request denied following revocation | Pending signed browser |
| QA-10 | Actual PostgreSQL outage and recovery | Bounded request failure, explicit unavailable state, no false success or silent memory fallback, retry/recovery behavior disclosed | Coordinator-owned launcher fixture |
| QA-11 | Process restart after committed receipt/link | Durable replay and readback; no duplicate local projection or lost audit; no exactly-once external delivery claim | Pending integrated fixture |
| QA-12 | Diagnostics and artifacts | No bearer/cookie/CSRF/service-secret or customer body disclosure; only synthetic artifacts, finite retention, traces disabled for signed flows | Initial workflow audit below |

The QA agent owns new test files and a new R4.11 fixture/config only. Existing OIDC/source journeys and pilot scripts are untouched. The coordinator owns source/module/API/UI/workflow integration and registers the new suite. Final tests await a fresh QA worktree based on the coordinator's integrated revision. Only separately named disposable `qa_browser_r411*` databases on the assigned private loopback cluster are allowed; no Owner pilot resources are used.

## CI hygiene audit and selective proposal

Read-only GitHub checks on 2026-11-20:

- Exact baseline hosted run `44665518491`, head `5181aba2b325fb12fdb4a54b04783f23b4133d69`, conclusion success. Both job logs show runner `2.338.2`. This does not validate R4.11 changes.
- `GET /repos/phamdinhhai/North_Start_Commercial_Support_Platform/branches/main/protection` returned 404, message `Branch not protected`. `GET .../rulesets` returned an empty list. Enforcement is therefore absent in these inspected surfaces; no administrative setting was changed.
- Actions permissions report enabled=true, allowed_actions=all, sha_pinning_required=false. Workflow token is already limited to contents:read.
- Recent `playwright-report` and `browser-server-diagnostics` artifacts expire about 90 days after creation. Workflow has no explicit retention-days and diagnostics include `product/*.log`; artifacts were not downloaded or scanned in this initial audit, so absence of secrets is not established.

Official sources inspected: [checkout README](https://github.com/actions/checkout/blob/main/README.md), [checkout v5 action](https://github.com/actions/checkout/blob/v5/action.yml), [setup-node README](https://github.com/actions/setup-node/blob/main/README.md), [setup-node v5 action](https://github.com/actions/setup-node/blob/v5/action.yml), [upload-artifact v6 README](https://github.com/actions/upload-artifact/blob/v6/README.md), [upload-artifact v6 action](https://github.com/actions/upload-artifact/blob/v6/action.yml). These selected majors use action runtime Node24 and require Actions runner >=2.327.1. Observed hosted runner2.338.2 satisfies this prerequisite. Application `node-version: '22'` must remain unchanged: the action runtime and application runtime are separate.

Minimal selective upgrade proposal, with exact tag resolution verified using git ls-remote:

| Action | Compatible selected ref | SHA |
|---|---|---|
| actions/checkout | v5 | fbc6f3992d24b796d5a048ff273f7fcc4a7b6c09 |
| actions/setup-node | v5 / v5.0.0 | a0853c24544627f65ddf259abe73b1d18a591444 |
| actions/upload-artifact | v6 / v6.0.0 | b7c566a772e6b6bfb58ed0dc250532a479d7789f |

Pin all occurrences to these immutable SHAs with readable major comments, set checkout persist-credentials:false and artifact retention-days:7. Keep existing lockfile cache and Linux runner. Do not upgrade application dependencies or pursue unrelated latest majors. Preserve failure diagnostics, exclude secret-bearing fixture state, and keep signed-flow traces off. The coordinator applies workflow changes; successful local tests do not establish hosted action compatibility. A new hosted run at the final source/workflow revision remains required.

## Evidence limits and release posture

This document is an initial audit and executable acceptance plan, not an execution report. Passing synthetic tests cannot grant provider rights, remove per-capability gates, claim real Sales usability, resolve canonical decisions, or approve production. No push, merge, deployment, provider account access, Owner pilot access, or administrative configuration change was performed.
