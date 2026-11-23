# Governed actions: ADR-005 and ADR-006 implementation (R3, Subagent G/D)

Date: 2026-11-18. Branch: `work/r3-actions` (base `7b47e9d`). Implementation commit: `92dc501`.

Scope: this round implements the accepted ADR-005 (CE-2, R2-P-01/R2-P-02) and ADR-006 (PM-1) in the governed-action runtime. It adds no HTTP routes and does not touch `api/**`, `app.module.ts`, `infra/auth/**`, `infra/membership/**` or `infra/rbac/**`. **CE-1 is still OPEN.** No state transition is decided, and a verified outcome never moves Commercial State. LG-1 and MM-1 are now cited as ADR-007 and ADR-008. The production capability catalog stays empty.

## Failing-first evidence

- The new specs `governed-action.adr005.spec.ts` and `capability-matrix.policy.spec.ts` were run first and failed on missing modules.
- The finished `governed-action.adr005.spec.ts` was then run against the base `governed-action.service.ts` (stashed). 18 of 19 tests failed. The one that passed only checks that malformed input is refused.
- Five existing tests failed after the ADR-005 domain rule landed: three AI-draft tests in the authorization and domain specs, plus two in the new specs. These failures are expected, because AI proposals now need a CommercialEvent (CE). The three existing tests were updated to cite a draft CE. No assertion was weakened.

## Per item

| # | Item | Where | Tests |
|---|---|---|---|
| 1 | **R2-P-01 evidence-bound proposals.** `propose` accepts `commercialEventRef` and `evidenceRefs`.<br>**AI:** the CE must be `inferred`, `draft`, not policy-`rejected`, in the same workspace (and the same lead when `leadId` is set), with at least one evidence pointer. Cited refs must be a subset of the CE's pointers; when none are given, the CE's pointers are used. Otherwise the proposal is refused with `EVIDENCE_REQUIRED` and a detail code. The refusal goes to a new append-only log and no proposal is stored. A lookup failure fails closed.<br>**Human:** a rationale is required; evidence is optional. A cited CE must exist in the same workspace and lead.<br>**Both:** refs are frozen on the proposal and in the `PROPOSED` event. They are exposed in `preview.evidence` and the `PREVIEWED` event, and bound into the preview digest when present. Replaying a request key with different evidence raises `REQUEST_KEY_CONFLICT`. | `domain/governed-action/action-evidence.ts:59` (`resolveProposalEvidence`)<br>`action-lifecycle.ts` (`propose`, `previewDigestOf`, `recordProposalRefusal`)<br>`action-history.ts` (replay re-derives the evidence-bound digest)<br>`application/governed-action/governed-action.service.ts:100-160`<br>`ports/governed-action.ts` (`CommercialEventLookup`)<br>`infra/governed-action/pg-commercial-event.lookup.ts:22`<br>`commercial-evidence.ts` (static lookup) | `governed-action.adr005.spec.ts` › "an AI proposal without a commercialEventRef is refused…", "a CE that is %s ⇒ EVIDENCE_REQUIRED…" (9 cases), "a lookup failure fails closed…", "a draft inferred CE with evidence is accepted…", "human proposals need only a rationale…", "a human citing a foreign CE is refused…"<br>PG: `governed-action.adr005.integration.spec.ts` (5 tests) |
| 2 | **R2-P-02 observed outcome.** After `SUCCEEDED_VERIFIED` or `FAILED_VERIFIED`, from `execute` or `verify`, an `observed` `AssertionEnvelope` is built:<br>• `eventType`: `ACTION_OUTCOME_OBSERVED`<br>• `value`: the readback observation<br>• `sourceSystem`: `target.provider`<br>• `sourceRecordId`: `providerReference`<br>• `capturedAt`: readback `observedAt`<br>• `rawEvidencePointer`: `governed_action_event:<id>#<seq>`<br>• `rawPayloadHash`: sha256 of the readback evidence<br>• `evidenceSummary`: the readback summary<br>• `assertionStatus`: `claimed`<br>• subject: the lead, or the `external_resource` target when there is no lead<br>The envelope is emitted through `AssertionSink`. Nothing is emitted for UNKNOWN or for a kill switch that fires before dispatch. The id is deterministic, so re-emission is idempotent. Emission is best effort, after the outcome is durable. `// OPEN: CE-1` stays at the seam. | `domain/governed-action/action-outcome-assertion.ts:38`<br>`service.ts:240,255,395`<br>`AssertionSink` in `ports/governed-action.ts`<br>`InMemoryAssertionSink` | `governed-action.adr005.spec.ts` › "SUCCEEDED_VERIFIED emits one observed envelope…", "FAILED_VERIFIED emits…", "UNKNOWN emits nothing; verify… kill switch… emits nothing", "a sink failure never undoes…", "no Commercial State port is reachable…" (proxies every dependency and asserts that only governed-action ports are called; source guard against lead-state, outcome and pilot-store imports) |
| 3 | **ADR-006 production policy.** `CapabilityMatrixActionPolicy`, deny-by-default. The pure matrix is in `domain/governed-action/capability-matrix.ts:41`.<br>**Propose:** admin and manager; sales only on lead-linked proposals that pass the lead hook; viewer never.<br>**Authorize, execute, verify, and reject/cancel-by-authority:** LOW risk for manager or admin; any other class is the high tier and admin only.<br>**Read:** admin and manager; sales and viewer only on lead-linked proposals in scope.<br>**Housekeeping:** manager or admin.<br>**Kill switch:** admin only (`mayOperateKillSwitch`, `service.operateKillSwitch` at `service.ts:260`, `WorkspaceKillSwitch`).<br>**AI:** may draft and handle only its own drafts.<br>**Service principals:** nothing; no `serviceGrant` is ever issued.<br>Separation of duties and approval expiry are unchanged in the lifecycle.<br>**Risk class:** `CapabilityDefinition.impact` was added. `createCapabilityCatalog` rejects money, budget, order, payment, outbound customer messaging and conversion upload unless the class is HIGH or CRITICAL (`capability-catalog.ts:57-75`). The fixture `ads.offline_conversion.upload` moved from MEDIUM to HIGH. | `infra/governed-action/capability-matrix.policy.ts:31`<br>`workspace-kill-switch.ts:20`<br>`defaults.ts` (deny-all and static policies gain `mayOperateKillSwitch`) | `capability-matrix.policy.spec.ts` › 16-row role × command table, "never issues a service grant…", "AI may only draft…", "money/budget/… must be HIGH or CRITICAL…", end-to-end "sales drafts on its own lead; manager authorizes low risk only; admin… SoD holds", "the kill switch is admin only…" |
| 4 | **ActorResolver.** `AuthContextActorResolver`: a membership base role (via `WorkspaceRoleLookup`) resolves to `human`. A server-side registry holds `ai` and `service` principals. A principal that is both registered and a member is ambiguous and refused. Unknown principals and lookup errors are refused. The caller's claimed kind is ignored (A-m2). `principalFromAuthContext` drops the role and refuses demo contexts. | `infra/governed-action/actor-resolution.ts:28,62` | "members resolve as human…; claims are ignored", "rejects a malformed registry and never turns a demo context into a principal" |
| 5 | **Lead-scope hook.** `LeadAccessPort` and `RbacLeadAccessAdapter(loadLead, policy)` wrap an injected lead loader and any `{ canAccessLead }`; the composition root passes `RbacService`. The adapter checks UUID format, existence and same workspace, and denies on errors. The policy re-checks lead scope for sales and viewer even if a caller skipped the service hook. The domain does not import `RbacService`. | `infra/governed-action/lead-access.ts:15` | "wraps an injected lead loader + lead policy…" (uses the real `RbacService`) |
| 6 | **Markers.** `// OPEN: PM-1`, `CE-2`, `LG-1` and `MM-1` in owned files are replaced with ADR-006, ADR-005, ADR-007 and ADR-008. `// OPEN: CE-1` is kept in `governed-action.types.ts`, `action-outcome-assertion.ts`, `service.ts:389`, migration 011 and `commercial-event.ts`. | — | The source assertion in the R2-P-02 spec checks `OPEN: CE-1` |
| 7 | **CI.** The new PostgreSQL suite is added to `requiredSuites`. `unregisteredSuites()` returns `[]`. | `product/scripts/ci-integration.mjs` | — |

### Commercial-event changes (additive only)

- `ACTION_OUTCOME_OBSERVED` added to the hypothesis event types.
- `AssertionSubjectType` gains `external_resource`.
- Optional `AssertionEnvelope.evidenceSummary`.
- Optional `createAssertion` inputs: `assertionId`, `capturedAt`, `ingestedAt`, `rawPayloadHash`, `evidenceSummary`.
- Header comments now cite ADR-005.
- All existing commercial-event and invariant tests pass unchanged.

## Migration 011 (unreleased, edited in place; up and down symmetric)

- **`governed_action_proposal` gains three things:**
  - `commercial_event_ref UUID`, with no FK, because it is an evidence pointer.
  - `evidence_refs JSONB`: an array of at most 20 entries.
  - The `governed_action_ai_requires_evidence` CHECK: an `ai` proposer needs a CE ref and at least one evidence ref.
- **The frozen-field guard** now also covers both columns.
- **New `governed_action_propose_refusal`:**
  - Workspace FK and append-only: UPDATE, DELETE and TRUNCATE are refused by the shared trigger function.
  - Holds refused PROPOSE commands, which have no proposal row.
- **The down migration** drops the new table first.
- **Seeds:** still none. The PG test checks that the table and its functions are removed and then restored.

## Verification (local PostgreSQL 17, `disposable_r3_actions`)

| Gate | Result |
|---|---|
| `npm run typecheck` | pass |
| `npm run lint` | pass |
| `npm run architecture:check:strict` | PASS (0 findings) |
| `npm test -- --exclude '**/*.integration.spec.ts'` | 71 files, **827 passed**: baseline 783 + 44 new (19 ADR-005, 25 ADR-006) |
| `TEST_DATABASE_URL=… npx vitest run src/infra/governed-action src/infra/postgres --no-file-parallelism` | 14 files, **82 passed, 0 skipped** (includes 5 new ADR-005 PostgreSQL tests) |

## Limitations: still to wire at the HTTP / composition layer

1. **No HTTP routes and no composition.** The composition root must provide:
   - `CapabilityMatrixActionPolicy({ roles, leads, constraints })`
   - `AuthContextActorResolver({ roles, servicePrincipals })`, where `roles` is backed by membership after the R3-D `platform_user` change and the registry comes from server config.
   - `RbacLeadAccessAdapter(loadLeadFromPilotStore, rbacService)`
   - `PgCommercialEventLookup`
   - an `AssertionSink`
   - `WorkspaceKillSwitch` (or a durable shared one)
   - `principalFromAuthContext` at the controller seam
2. **No durable `AssertionSink`.** `assertion_envelope` (migration 001) has no columns for `source_system`, `source_record_id`, evidence pointer, hash or summary. A durable sink needs a migration outside this workstream. Until then emission is best effort: the deterministic id lets an outbox or reconciler re-emit from `governed_action_event` history. A transactional outbox is recommended before any live executor.
3. **Human `evidenceRefs` are format-checked, not resolved.** A cited CE is verified, but other refs are not. An evidence-resolution port, like pilot P1-4, should back them before approvers rely on them.
4. **`assertionStatus` is `claimed` for observed outcomes.** Corroboration, which ADR-008 requires for revenue credit, is a separate policy step and is not implemented here.
5. **The kill switch is in-process.** `WorkspaceKillSwitch` keeps an in-memory operations log. A multi-instance deployment needs a shared, audited store behind the same two ports. The existing `StaticKillSwitch` global switch is unchanged.
6. **Manager scope is the whole workspace in LVP** (ADR-006 ¹). Narrowing by team needs the Team entity and a `ManagerScope` resolver; `RbacService` already grants managers workspace-wide lead access.
7. **The propose-refusal log can grow under abuse.** Rate limiting belongs to the HTTP layer. Refusals from unresolvable principals are not logged, because there is no actor to attribute.
8. **`service.ts` is 486 lines**, close to the 500-line limit. The next change should extract helpers such as the readback and kill-switch ones.
