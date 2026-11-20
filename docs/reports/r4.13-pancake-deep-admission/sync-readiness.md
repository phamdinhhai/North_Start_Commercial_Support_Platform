# Pancake synchronization readiness

Scope: offline source audit and fabricated contract tests based on R4.12 commit `197d6ec4c766d4528d1cbc9e024d6e2454d22bd3`. No credentials, HAR, provider requests or customer payloads were used by this workstream. Root owns any separate authorized provider test journal.

## Confirmed boundaries

| Classification / severity | Implementation or source evidence | Consequence |
|---|---|---|
| DESIGN LIMITATION / live-admission blocker | `product/src/ports/durable-sync.ts:SyncStream`: `capability=synthetic-messages`, `mode=offline-synthetic`; `application/durable-sync/admission.ts:admitSyncObservation` | Durable infrastructure is reusable; its existing source admission is not permission to persist actual provider data. Never label live payloads `synthetic_fixture` to pass the gate. |
| VERIFIED CONTRACT DISTINCTION / integrity risk if bypassed | Local official REST YAML SHA256 `798bd7be798c01832af3c50cbca66d07fa6020e3c9bade04b3a5d34c35699d73`, GET `/pages/{page_id}/conversations/{conversation_id}/messages`, lines1018–1030 | `current_count` is documented as an index position returning30 prior messages. No stable snapshot, opaque cursor, mutation coverage or restart guarantee is documented there. A positional offset cannot become a durable checkpoint by renaming it. |
| EXISTING PROTECTION / no defect found | `infra/sync/pg-sync-checkpoint.store.ts:commitPage` | Source receipts, page ledger, checkpoint and audit share one transaction. Revocation/lease/binding checks precede intake. Replay checks page identity/content and never regresses stream position. |
| EXISTING PROTECTION / no defect found | `application/durable-sync/offline-sync.ts:runDurableOfflineSync` | Network callback runs outside PostgreSQL; fetch authorization, request deadline, page/item/time bounds and categorical failures are enforced. |
| DESIGN LIMITATION / documented | `ports/source-observation.ts:SourceObservation`; `application/source-trust/source-trust.ts:assertSyntheticSourceAdmission` | `accountId` is transport Page binding, not human provider account/contact identity. Origin and native IDs remain separate; this model is synthetic-only. |

## Selected implementation

`adapters/pancake/pancake-history-readback.ts` adds a pure, unregistered positional readback planner. It copies the target, requires positive local page/item limits (at most100/1,000), bounds count advancement, and rejects mismatched response targets before advancing. These ceilings are local safety policy, not provider quota claims.

The planner exposes `completeness=UNKNOWN`, `lifecycleCoverage=UNKNOWN` and `durableResumeSafe=false` for every state. A short page does not prove completion; an empty page means only `empty-pass`. Starting another pass resets the positional count to zero. It creates neither `SyncPage`, provider-authenticated observation, durable checkpoint nor commercial effect. It performs no network request and is not registered in runtime composition.

Its count-based continuation is a candidate interpretation of the documented positional contract, not an independently live-verified pagination algorithm. Root must compare actual page ordering/overlap and UI/API readback before connecting it to an authorized transport. Concurrent insertion/deletion can shift indexes: receipt dedupe alone cannot establish that skipped history was recovered. All returned revisions/deletion labels must reach a separate validated admission boundary; timestamp/message-ID filtering must not silently drop them.

## Verification and limits

Executed in the isolated worktree with Node22/npm10, no `TEST_DATABASE_URL` and no provider network:

```text
npm run typecheck
npx vitest run src/adapters/pancake/pancake-history-readback.spec.ts src/application/durable-sync/offline-sync.spec.ts src/application/durable-sync/independent-failure.qa.spec.ts src/adapters/pancake-synthetic/pancake-synthetic.spec.ts
npx eslint src/adapters/pancake/pancake-history-readback.ts src/adapters/pancake/pancake-history-readback.spec.ts
```

PASS:4 files /34 tests /zero skipped, including6 planner tests; typecheck and targeted lint PASS. Targeted V8 coverage command `npx vitest run src/adapters/pancake/pancake-history-readback.spec.ts --coverage --coverage.include=src/adapters/pancake/pancake-history-readback.ts --coverage.reporter=text --coverage.reportsDirectory=coverage-r413-sync` passed6 tests/zero skipped with100% lines/statements/functions/branches for the planner only; this is not whole-product coverage. Tests cover positional continuation, unknown completeness after empty/short responses, restart fromzero, bounds, target mismatch, repeated/late observation counts, timeout/revocation/poison handling and fabricated native mapping/deletion labels. Count-only planner tests do not prove actual lifecycle decoding or persistence.

Existing PostgreSQL evidence is implementation/test inspection only for this workstream: `infra/sync/sync-checkpoint.integration.spec.ts` covers atomic rollback, page replay, restart, lease fencing and source revocation. It was not rerun here; R4.12 results are baseline evidence, not R4.13 acceptance. Parent exact-revision regression must run it alongside source continuity tests. No schema/index change is justified by the inspected contract; migrations001–023 remain untouched.

Readiness: **OFFLINE CONTRACT TESTED** for the planner and existing synthetic harness; **UNKNOWN** for actual Pancake pagination/lifecycle guarantees; real provider ingestion remains gated. GateC remains closed; no real customer data was ingested.
