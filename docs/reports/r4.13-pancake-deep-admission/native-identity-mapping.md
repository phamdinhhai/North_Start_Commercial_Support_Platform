# Native identity and commercial continuity — R4.13

Agent 4 source review, baseline `197d6ec4c766d4528d1cbc9e024d6e2454d22bd3`. This document records mapping policy, not provider identity verification. No credentials, capture, customer records or provider requests were used by this agent. Live observations and target verification belong to the root executor's sanitized journal.

## Identity authority

| Concept | Current implementation / authority | Required provider admission rule |
|---|---|---|
| Human provider account | Not represented by `SourceObservation.accountId` | Verify authenticated account separately; do not confuse account principal with Page |
| Connection | Workspace-scoped `SourceConnection.id`, provider/route/Page binding | Resolve from server-owned authorization; never select workspace from provider body |
| Transport Page | `SourceObservation.accountId` compared with connection `pageId` | Verify Page alias/native ID from provider response; URL pieces are not proof |
| Original source Page | `native.system` + `native.pageId` | Preserve namespace and attestation separately; Pancake access does not prove original Meta identity |
| Native conversation | `native.conversationId`, optional | Provider-scoped thread metadata; neither Customer nor commercial episode identity |
| Native message | Workspace + native system + Page + message ID | Exact source-object key only; never derive Customer identity from message ID |
| Native event / revision | Optional `native.eventId` / `native.revision` | Immutable observation identity only when supplied by a verified contract; do not invent revision from text/time |
| Provider contact | No dedicated field in `SourceObservation` | Verify contact linkage locally against exact conversation; do not silently put contact ID into message/Customer fields |
| Customer | Separate domain entity, `lead.customer_id` | No automatic creation/merge/link from contact, name, phone or inferred match |
| Commercial episode / Lead | Stable Lead ID; synthetic message seed is a bounded simulation | Existing explicit human evidence-context association only; no automatic thread-wide attachment |
| Work / ownership / outcome | Existing commercial services, not provider observations | Provider delivery must not assign owner, complete work, infer Won/Lost, payment or revenue |

Evidence: `product/src/ports/source-observation.ts` (`SourceObservation`, `SourceConnection`); `product/src/infra/source-integration/pg-source-integration.store.ts` (`intake`); canonical I-01, I-06, I-07, I-09, I-11, I-12. The last reviewed source remains strictly `synthetic: true`, `sourceAuthority: synthetic_fixture`, `verification: UNVERIFIED`.

## Repeated and incremental observations

| Scenario | Protected behavior | Implementation / executable evidence |
|---|---|---|
| Same receipt and content | `receipt_duplicate`, no new effects | Store `intake` receipt digest; `source-intake.integration.spec.ts`, duplicate receipt retries case |
| Same receipt, changed meaning | Reject `RECEIPT_COLLISION`, transaction rollback | Same file; `sync-checkpoint.integration.spec.ts`, rollback page/checkpoint case |
| Same native message through two routes | Object alignment can reuse synthetic seed while preserving route-specific raw envelopes | `source-intake.integration.spec.ts`, dualpath case and explicit-event reconciliation case |
| Same message, conflicting conversation | Reject `NATIVE_OBJECT_COLLISION` when both observed conversations are known | Store `intake` conversation-conflict query; source-intake collision case |
| Same explicit event/revision, changed content or different message | Reject `NATIVE_EVENT_COLLISION` | Store normalized content/lifecycle/time comparison and event advisory lock; source-intake lifecycle/collision cases |
| Edit/delete/out-of-order event | Append immutable observation; no declaration of provider's current truth | Source-intake unordered edits/delete case; `source-continuity.integration.spec.ts`, incremental worker case |
| New message / reopened thread | Separate synthetic seed, even same conversation; no inferred segmentation | Source-continuity same-conversation and incremental worker cases |
| Missing message/Page/system | UNKNOWN quarantine; no raw envelope/Lead seed retained | Store `known` guard; source-intake missing-native-identity case |
| Missing conversation only | Known message identity can remain usable, conversation UNKNOWN | Source-intake namespace separation case |
| Same IDs in another workspace | Distinct tenant namespace | Workspace predicate in every lookup; source-intake workspace separation case |

`object_aligned` proves an exact declared native object key matched within a workspace. It does **not** prove same customer, same commercial episode, authentic provider origin, identical event, complete history or verified revenue. Fabricated Pancake `originalMeta` remains `USER_ASSERTED_CANDIDATE`; `projectSourceTrust` exposes `providerAttestation: NOT_AVAILABLE`. A future live decoder must not reuse that override as authenticated linkage.

## Explicit association and Sales interpretation

`SourceContinuityService.command` permits admin-only, validated `link` / `unlink` / `reject` with expected version, reason and idempotency key. `PgSourceEpisodeLinkStore.command` locks receipt and affected Leads, reauthorizes current source/target/previous episode owners, and appends history and audit in one transaction. It does not rewrite native mappings, source receipts or Lead IDs. A `human_confirmed` context link remains `UNVERIFIED` evidence and is not an identity merge.

`LinkedSourceEvidenceQuery.evidence` resolves only authorized origin pointers and emits `identityMerge: false`, `verification: UNVERIFIED`, completeness UNKNOWN. `SourceIntegrationService.sourceEvidenceView` allowlists source text/speaker and metadata, excluding original wrappers and keyed digests. Lead-scoped access remains mandatory even if upstream account has broad Page permission.

## Gate C boundary

Provider contract validation is distinct from North Start intake. Existing `admitSyncObservation` accepts only synthetic source admission; `SyncStream` is `offline-synthetic` / `synthetic-messages`. Do not disguise actual customer payloads as synthetic to pass these boundaries. Only fabricated, minimized, approved test data may enter isolated tests. Real Page/contact/message identifiers and raw customer history are not fixtures or public report material. An authorized outgoing test and readback do not upgrade Gate C or authorize Page-wide synchronization.

## Validation performed by Agent 4

At baseline source above, Node local dependency installation used `npm ci --ignore-scripts --no-audit --no-fund`. Command from `product/`:

```text
npx vitest run src/application/source-continuity/source-continuity.service.spec.ts src/infra/source-continuity/linked-source-reader.qa.spec.ts src/adapters/pancake-synthetic/pancake-synthetic.spec.ts src/application/source-integration/source-integration.service.spec.ts
```

Result: **4 files, 35 tests passed, zero skipped**, 2026-11-20 local execution. No coverage measurement in this bounded run. Existing PostgreSQL cases above were inspected, not rerun by Agent 4; integrated QA must rerun them at final source SHA. No redundant tests or domain code changes were added for this documentation-only policy review.
