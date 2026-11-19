# R2 independent review — Architecture, Canonical & Product Domain (Subagent A)

Date 2026-11-18. Reviewed range `8673ca8..f2221d3` (11 commits; 93 files under `product/src` + migrations 010/011). Reviewer did not author any of this code. Delivery-tier review: it changes no canonical file, closes no Human Gate and resolves no OPEN decision. Everything under "Register" is a proposal only.

Evidence labels: **Confirmed** = read in source; **Probed** = additionally reproduced with a throw-away Node script against the compiled `dist/` (script kept outside the repo, not committed); **Inferred** = derived from control flow, not executed.

## 1. Verdict

**Compatible with the canonical set for merge as experimental, default-OFF code. Not approved for activation on real data.** No BLOCKER found. No canonical file changed in the range (`git diff 8673ca8 f2221d3 -- docs/canonical` is empty).

Six MAJOR findings:
- Governed actions (GA): four. Audit evidence loss (I-05/I-12), AI proposals that skip the Commercial Event pipeline (I-04/CE-2), out-of-scope capability catalog (LG-1/MM-1), and latent I-09 read/housekeeping gaps.
- OIDC with enrollment: one functional defect. Principal issuance always fails closed in `AUTH_MODE=oidc`.
- PM-1: one governance risk. OIDC membership makes the existing workspace-wide manager/admin RBAC reachable by real principals.

Pancake lifecycle, observability and browser companion are compatible. Each has only minor notes.

Validation run in this worktree (`product/`):
- `npm ci --prefer-offline`: OK.
- `npm run architecture:check:strict`: **PASS (0 findings)**.
- `npm run typecheck`: pass.
- `npx vitest run` over the governed-action, auth, connector-health and adapters scopes: 391 passed.
- `npm run build`: pass.

PostgreSQL integration suites were **not** run by this reviewer.

## 2. Findings

### MAJOR

**A-M1 — Governed-action audit log does not retain readback evidence, provider reference or preview content (I-05, I-12). Confirmed + Probed.**
- Where:
  - `domain/governed-action/action-lifecycle.ts:143-145`: the PREVIEWED event stores only `previewDigest` and the `beforeState` status.
  - `:236`: `beginExecution` sets `outcome: undefined` and replaces `execution`.
  - `:261-263`: OUTCOME_RECORDED data is `{outcome, executorStatus, readback, attempt}`.
  - `:276`: VERIFICATION_RECORDED data is `{observation, outcome}`.
  - `infra/governed-action/pg-action.store.ts:78`: overwrites `projection`.
- What is lost: `verification.evidence`, `verification.reason`, `providerReference` and the previewed `beforeState` value / `changes` exist only in the mutable projection. They are never in the append-only `governed_action_event`.
- Failure scenario (probed): attempt 1 is rejected and becomes FAILED_VERIFIED with readback evidence `{…}` and reason `SYNTHETIC_NO_OPERATION_FOUND`. The action is then re-previewed, re-authorized and attempt 2 succeeds. Afterwards, attempt 1's evidence object, readback reason and the preview the approver reviewed cannot be recovered from any store. The approval binds a `previewDigest` whose content is gone. This contradicts "every important state change must be traceable to source, evidence, actor/policy … previous/new values" (DOMAIN_INVARIANTS I-05) and "Every AI-derived value stores its evidence span/pointer" (TRUST_AND_EVIDENCE §4).
- Fix: put the full `preview` (beforeState, changes), `verification` (observation, evidence, reason, observedAt) and `providerReference` into the event `data` of PREVIEWED / OUTCOME_RECORDED / VERIFICATION_RECORDED. Keep the projection as a derived cache. Add a test asserting that the projection can be rebuilt from events after a FAILED→re-authorize→SUCCEEDED sequence.

**A-M2 — AI-proposed actions bypass the Commercial Event pipeline (I-04; pre-empts CE-2). Confirmed.**
- Where:
  - `action-lifecycle.ts:81-119`: `propose` accepts `proposer.kind='ai'` with only free-text `rationale`.
  - `governed-action.types.ts:138-167`: no evidence pointer, source interaction or CE reference. `leadId` is optional.
  - `:16-17`: "a governed action is NOT a Commercial Event".
- The canonical pipeline is `Interaction -> AI interpretation -> Commercial Event -> Evidence -> Policy -> Action` (COMMERCIAL_EVENT_MODEL §1, §6). Here an AI-originated suggested action reaches Policy (human authorize) and Action (execute) with no CE and no evidence. Declaring actions "not CEs" settles part of CE-2, the scope of the event primitive, by implementation choice.
- Failure scenario: an AI drafts `ads.campaign.status.update PAUSED` with rationale text only. A human approves it from the digest/preview. The executed external change has no traceable interaction evidence or inferred-meaning record.
- Fix options for Gate #A (do not choose here):
  - (a) refuse `kind='ai'` proposals until CE-2 is decided;
  - (b) require AI proposals to carry a draft-CE id plus an evidence pointer;
  - (c) record an explicit `evidence: UNKNOWN` with a reason and surface it to the approver.
- This is a question for humans, not a confirmed defect.

**A-M3 — Capability catalog encodes deferred and out-of-LVP capabilities (LG-1; ARCHITECTURE_CONSTITUTION §5 and §8; PRODUCT_CONSTITUTION §4; MM-1). Confirmed.**
- Where: `domain/governed-action/capability-catalog.ts:135-173` ships these in domain code:
  - `pancake.message.send`: canonically *deferred*; "no … outbound messaging in the LVP".
  - `ads.campaign.budget.update` and `ads.campaign.status.update`: ad execution is owned by the ad platforms (PRODUCT_CONSTITUTION §5).
  - `ads.offline_conversion.upload`: implies a conversion/credit semantic; MM-1 is open.
  - `pos.order.create`: ERP/POS is a non-goal.
- Migration 011 creates the tables in every deployment.
- Mitigations already present: `enabledByDefault: false`, a deny-all policy, `ActionExecutor.mode` typed to `disabled|synthetic`, and no HTTP route.
- Failure scenario: no live writes are possible today. The risk is scope drift. The catalog becomes the de-facto backlog for outbound automation without the LG-1 phase gate.
- Fix: move the entries to test fixtures (or label them `RESEARCH_EXAMPLE` and keep them out of `findCapability` outside tests) until the LG-1 / product gate. Remove "provider metric" conversion upload until MM-1 is decided.

**A-M4 — Governed-action reads and housekeeping have no authority or lead-scope check (I-09; latent, not HTTP-wired). Confirmed + Probed.**
- Where:
  - `application/governed-action/governed-action.service.ts:198-205` (`history`, `get`), `:134-137` (`expire`) and `:193-196` (`recoverStaleExecution`) only check workspace equality in `load` (`:215-221`).
  - `leadId` is never validated to exist or to belong to the workspace.
- Probed: an unassigned human in the same workspace reads a proposal linked to `lead-X` and its history. Any actor, including `kind='ai'`, can force EXPIRED or convert EXECUTING to UNKNOWN once the lease has passed.
- Fix before any HTTP surface: route `get` / `history` through `LeadAccessPolicy` when `leadId` is set (deny by default otherwise). Add a policy decision for `expire` / `recover`. Validate `leadId` against the lead store.

**A-M5 — In `AUTH_MODE=oidc`, principal enrollment issuance and revocation always return 401 (functional, fail-closed). Confirmed + Probed.**
- Where:
  - `api/integration.controller.ts:60` passes `{ headers: { ...headers } }`, which is a copy.
  - `infra/auth/verified-context-registry.ts` keys contexts by headers-object identity in a `WeakMap`. Probed: lookup on the original object returns true; lookup on the spread copy returns false.
  - Other controllers pass the original object (`pilot-loop.controller.ts:58-60`, `connector-health.controller.ts:29`).
- No test covers OIDC together with `/integration/enrollments`. The enrollment e2e uses a stand-in resolver (enrollment-issuance.md, "Residual risks").
- Consequence: in OIDC mode the deprecated shared-secret path is the only working issuance. Its actor attribution is `issuer-secret`, which weakens I-05 attribution. This defeats the stated plan to retire that path.
- Fix: pass the original headers object, or key the registry on the request. Add an HTTP test that boots `AppModule` with `AUTH_MODE=oidc` and a manager membership, and issues and revokes an enrollment.

**A-M6 — OIDC membership makes existing manager/admin breadth reachable by real principals (PM-1; I-09 for non-Sales roles). Confirmed.**
- Before R2, manager/admin was reachable only through the bootstrap hook in workspace `bootstrap`.
- Migration 010:15 allows `manager` / `admin` memberships, and `oidc-authenticator.ts:103-113` turns such a row into an AuthContext. That activates:
  - workspace-wide lead access (`infra/rbac/rbac.service.ts:32`, "QA-58 … hiện allow");
  - enrollment issuance and revocation (`application/integration/intake.ts:36-42`);
  - the connector-health read (`application/observability/connector-health.ts:15,69-73`).
- PM-1 explicitly lists "manager scope" as open. `decisions.md` requires "no manager or adapter privilege expansion".
- The code adds no role and Sales scoping is unchanged. However, granting a manager membership on real data would apply an undecided capability matrix in production.
- Fix / gate: make it a human-gate condition that no `manager` / `admin` membership row is created for real data before the PM-1 RFC. Optionally add a config guard refusing privileged memberships when `DEPLOYMENT_MODE` is pilot or production until PM-1. Record the new capability rows (`enrollment.issue`, `enrollment.revoke`, `connector-health.read` → manager/admin) as interim, proposal-only entries in the PM-1 register.

### MINOR

| ID | Where | Invariant / decision | Issue and scenario | Recommendation |
|---|---|---|---|---|
| A-m1 | `governed-action.service.ts:246-252` | I-05 / availability | Every in-workspace refusal is a versioned transition (Probed: an AI authorize refusal takes the version to 2). Any workspace actor can spam refused commands so that legitimate authorize/execute calls hit `CONCURRENT_MODIFICATION`. | Store refusals in a separate append-only table, or append without a CAS bump. Rate-limit at the HTTP layer. |
| A-m2 | `action-lifecycle.ts:215-222,267-269`; `ports/governed-action.ts` | I-03 | Actor `kind` is supplied by the caller. `AuthContext` has no kind, and the mapping is undefined. An AI agent authenticated as `service` could trigger execution or verify, though not authorize. | Derive `kind` server-side from the credential type. Treat agent credentials as `ai` at the HTTP seam. |
| A-m3 | `action-lifecycle.ts:207,280-286` | I-05 | `expire` and stale-recovery events record actor `system` even when a human or AI caller triggered them. The caller identity is lost. | Record `triggeredBy` in event data. |
| A-m4 | `migrations/010_workspace_membership.up.sql:14,30-45` | I-05, PM-1 | The guard is `BEFORE UPDATE` only. DELETE is allowed, so the "one-way" revoke can be bypassed by delete and re-insert, which also erases history. Grant and revoke have no audit record (ARCHITECTURE_CONSTITUTION §7). The unique constraint plus the one-way trigger already decide the lifecycle: no re-grant, no role change without DELETE. | Guard DELETE. Append audit rows on grant/revoke. List the re-grant and role-change policy under PM-1 instead of encoding it. |
| A-m5 | `infra/auth/oidc-authenticator.ts:117-121`; `rbac.service.ts:34` | PM-1 principal model (ID-1 adjacent) | `userId = sub` with no issuer namespace. If the issuer changes, or a legacy actor id collides with a `sub`, lead ownership (`assignedTo === userId`) transfers silently. | Gate the principal-model decision (`iss`+`sub` vs a mapped internal user id) before real data. |
| A-m6 | `application/integration/config.ts:202-203`; `intake.ts:89-93` | I-05, PM-1 | The deprecated issuer-secret path is on whenever `AIL_ISSUER_SECRET` is set. Its actor is unattributed (`issuer-secret`), and its revoke is cross-workspace (`workspaceId: null`). Acceptable only because AIL is local/test and flag-gated. | Flip to explicit opt-in (`AIL_ISSUER_SECRET_ENABLED=true`). Once A-M5 is fixed, disable it by default. |
| A-m7 | `adapters/adaptive-connectivity/message-lifecycle.ts:130,162-169` | I-12 vs privacy | Quarantined schema-drift frames keep only key names and a hash, not the raw frame. That conflicts with "mapping errors preserve the raw envelope" (ARCHITECTURE_CONSTITUTION §3). The unkeyed `contentHash` of message objects is linkable offline (acknowledged in the report). | Human decision: raw retention for quarantined frames under the privacy controls, or a keyed hash. Nothing persists today. |
| A-m8 | `adapters/adaptive-connectivity/continuity.ts` (`reconcileGapBySnapshot`) | I-08 | The gap status changes in place to `reconciled-by-snapshot`, and the provenance of the `ReadbackAnalysis` inputs is not recorded. `continuity` stays UNKNOWN, which is correct. | When a producer exists, record who or what produced the analyses. Never surface `reconciled-by-snapshot` as completeness. |

### NOTE
- **Domain independence.** `domain/governed-action/*` imports only `node:crypto` and local modules, consistent with the existing domain (`envelope.ts`, `lead.ts`). No Nest or pg import.
- **Ports/adapters direction and composition.**
  - The architecture check passes.
  - `AUTH_CONTEXT_RESOLVER` is provided once (`scripts/pilot-loop.module.ts:108`) and exported (`:128`). `OidcAuthModule` adds `VERIFIED_CONTEXT_LOOKUP` / `MEMBERSHIP_STORE`, not a second resolver.
  - `GovernedActionService` is not composed into `AppModule`. No R2 file is ≥ 500 lines; files ≥ 400 lines are pre-existing.
  - `// OPEN:` markers appear at the PM-1 / CE-1 / CE-2 seams in auth, membership, integration, observability, governed-action and migrations 010/011 (29 occurrences in R2 scope).
- **Same `idempotencyKey` across re-authorized attempts** (`action-lifecycle.ts:108,237`). A provider that caches the first (failed) response could return it again. This needs a per-capability contract decision before any live executor.
- **Companion discard.** Reset can discard unsent local records after an exact-count confirmation (`browser-companion/lifecycle.mjs:59-61`). This is recorded only in local `resetHistory`, and the server cannot see the discard. Continuity stays UNKNOWN, which is acceptable under Model A.
- **Connector health.** `transport.state=active` means enrollment authority, not connectivity. The runbook says so; consider renaming the field in a later revision.

## 3. Scope items — summary answers

1. **Pancake lifecycle.**
   - No observation becomes a CommercialEvent, Lead state or outcome. The `adaptive-connectivity` modules import nothing from `domain/` or `application/`. Read-state is explicitly not mapped to a Lead or SLA (`message-lifecycle.ts:158`).
   - Identity separation holds: `captureId`, `externalEventId` (null), `providerMessageId`, conversation id, `payloadHash` and `contentHash` are distinct fields.
   - UNKNOWN is preserved: `completeness`, `eventsLost`, `semantics`, `transitionsInWindow`. Compatible; see A-m7 and A-m8.
2. **OIDC and membership.**
   - `x-workspace-id` only selects among active memberships. Bootstrap and unsigned tokens are disabled in OIDC mode, which is deny-only. These do not decide PM-1 or ID-1.
   - I-09 Sales scoping is preserved.
   - Risks: A-M6 (manager breadth becomes reachable), A-m4 (lifecycle encoded), A-m5 (principal model).
3. **Enrollment issuance.**
   - Reusing manager/admin adds capability rows. This is narrower than the shared secret, but it is still a PM-1 matrix entry, so it needs human acknowledgement (A-M6).
   - The default-on deprecated path is acceptable only as local/test; recommend opt-in (A-m6). It is currently the only working path in OIDC mode (A-M5).
4. **Observability.** Compatible.
   - Telemetry is labelled `OPERATIONAL_TELEMETRY_NOT_COMMERCIAL_EVIDENCE`.
   - There is no aggregate "healthy" field. `completeness` is typed as the literal `'UNKNOWN'`.
   - Logs are allowlist-redacted, and the health read is workspace-bound.
5. **Governed actions.**
   - I-03 is held in the domain: AI cannot authorize, execute or verify. It depends on actor kind being derived server-side (A-m2).
   - I-05 holds for event rows (DB triggers), but evidence is lost (A-M1).
   - I-08 holds: UNKNOWN is never retried.
   - I-09: workspace only; lead scope and housekeeping are latent gaps (A-M4).
   - The lifecycle is a separate external-action state machine. It does not encode CE-1 Commercial State, but it touches CE-2 (A-M2) and LG-1/MM-1 (A-M3).
   - The domain is framework-independent. Given the provenance note in governed-actions.md, this review counts as the first independent architecture review of commit `60c7ccb`.
6. **Browser companion.**
   - Model A only: debugger on one user tab, no cookie access, no response bodies, and an `optional_host_permissions` grant for one backend origin.
   - Export is redacted: no token or pending request.
   - The user-selected scope is a client claim; the server allowlist and signed scope remain the authorization. Compatible.
7. **Module boundaries.** Compatible; see NOTE.

## 4. Canonical Compatibility Matrix

Key: **C** compatible · **R** risk (requires fix or human decision) · **V(l)** latent violation in unwired code · **–** not touched.

| Change | I-01 | I-02 | I-03 | I-04 | I-05 | I-06 | I-07 | I-08 | I-09 | I-10 | I-11 | I-12 | CE-1 | CE-2 | MM-1 | ID-1 | ID-2 | PM-1 | LG-1 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Pancake lifecycle (adaptive-connectivity) | – | C | C | C | – | C | C | C | – | C | C | R (A-m7) | C | C | C | C | – | – | C |
| Enrollment issuance + keyring | – | – | C | C | R (A-m6) | – | – | C | C | C | C | C | – | C | – | – | – | R (A-M6) | C |
| OIDC + membership (mig. 010) | – | – | C | – | R (A-m4) | – | – | – | C Sales / R mgr (A-M6) | – | C | – | – | – | – | C (A-m5 adjacent) | – | R (A-M6, A-m4, A-m5) | C |
| Observability + connector health | – | – | C | C | C | – | – | C | C | C | C | C | – | C | – | – | – | R (A-M6) | C |
| Governed actions (mig. 011) | – | – | C (A-m2) | R (A-M2) | V(l) (A-M1) | – | – | C | V(l) (A-M4) | C | C | V(l) (A-M1) | C | R (A-M2) | R (A-M3) | – | – | C (deny-all default) | R (A-M3) |
| Browser companion | – | – | C | C | C | – | – | C | C | C | C | C (local discard NOTE) | – | C | – | C | – | – | C |
| Composition / boundaries | – | – | – | – | – | – | – | – | C (A-M5 fail-closed) | – | C | – | – | – | – | – | – | C | – |

## 5. Open Decisions Register — proposed entries (PROPOSED only; none ACCEPTED)

| Proposal ID | Parent | Question | Options (no recommendation adopted) | Raised by |
|---|---|---|---|---|
| R2-P-01 | CE-2 / I-04 | Must an AI-proposed governed action originate from a draft Commercial Event with an evidence pointer? | refuse AI proposals until CE-2 · require a CE draft and evidence reference · allow with explicit `evidence: UNKNOWN` shown to the approver | A-M2 |
| R2-P-02 | CE-1 | May a verified action outcome ever move Commercial State or Outcome, e.g. a POS order leading to Won? | never (separate ledgers) · only through a CE plus policy · deferred | A-M2, A-M3 |
| R2-P-03 | LG-1 | Are outbound action capabilities (Pancake send, ad budget/status, POS order) in current-phase scope, even as a disabled catalog? | test fixtures only · disabled catalog in domain · removed | A-M3 |
| R2-P-04 | MM-1 | What is the meaning of `ads.offline_conversion.upload` (which outcome counts as a conversion, and the credit semantics)? | defer with MM-1 · define within the MM-1 RFC | A-M3 |
| R2-P-05 | PM-1 | Manager/admin scope once reachable via OIDC (workspace-wide lead read; enrollment issue/revoke; connector-health read; governed-action approve/execute per risk class). | narrow to assigned teams · workspace-wide · per-capability matrix | A-M6, A-M4 |
| R2-P-06 | PM-1 | Membership lifecycle: who grants and revokes, audit linkage, re-grant after revoke, role change, revocation SLA. | revoke-and-new-row with history · versioned row · external IdP groups mapped server-side | A-m4 |
| R2-P-07 | PM-1 (ID-1 adjacent) | Principal identity: `sub`, `iss`+`sub`, or an internal user id mapped from external identities. | as listed | A-m5 |
| R2-P-08 | PM-1 | Retire the shared issuer-secret enrollment path; default state until retirement. | opt-in now · off after the OIDC path is verified · remove | A-m6, A-M5 |
| R2-P-09 | I-12 vs privacy (TRUST_AND_EVIDENCE §4 / ARCHITECTURE_CONSTITUTION §7) | Retention of raw quarantined provider frames, and keyed vs unkeyed content hashes. | keep raw encrypted with retention · hash-only · keyed HMAC | A-m7 |

## 6. Items requiring human gate approval

1. **Gate #A (CE-1 / CE-2):** R2-P-01, R2-P-02. Required before any AI agent may call `propose`, and before any action outcome is linked to Lead state or outcome.
2. **LG-1 phase gate (Founder/Product):** R2-P-03. The governed-action capability catalog, and any HTTP surface or operator UI for actions.
3. **PM-1 permissions RFC (Security/Product):**
   - R2-P-05 through R2-P-08.
   - Explicitly, before any `manager` / `admin` membership is created for real data in `AUTH_MODE=oidc`.
   - Before the governed-action policy is anything other than `DenyAllActionPolicy` / test `StaticActionPolicy`.
4. **MM-1 RFC:** R2-P-04, before any conversion-upload capability is enabled.
5. **Engineering persistence/migration gate:** migrations 010 and 011 (destructive down scripts; unguarded DELETE on `memberships`; event-log completeness A-M1).
6. **Human Gate for any live executor:** a reviewed type change of `ActionExecutor.mode`, plus per-capability readback contracts (as declared in governed-actions.md).
7. **Pancake spike verdict (pre-PH4):** live frame shapes, auth-expiry frame and readback contract. Nothing in R2 reaches CONTRACT_TESTED or LIVE_VERIFIED.
8. **Security/privacy review before real data:** IdP selection, token lifetime, R2-P-09.

## 7. Limitations

- Source and diff review, plus targeted probes against `dist/`. No PostgreSQL integration run, no browser run and no live provider.
- E2E and integration claims in the R2 reports are not re-verified here.
- Findings about future HTTP wiring of governed actions are latent: the service is not composed into `AppModule`.
