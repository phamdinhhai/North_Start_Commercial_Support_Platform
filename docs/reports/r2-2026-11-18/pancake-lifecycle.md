# Pancake message lifecycle and recovery: synthetic contract layer (R2, Checkpoint 2)

Working report, not canonical. Dated 2026-11-18. Branch `work/r2-pancake-lifecycle`, based on `8673ca8`.
Scope: `product/src/adapters/adaptive-connectivity/**` only. No provider sessions, credentials, live captures,
sends, deletes, migrations, routes or dependency changes.

Evidence levels used: **SOURCE_INSPECTED** means a label or query key appears in inherited static/HAR evidence.
**SYNTHETIC_TESTED** means the behaviour is exercised only by synthetic Vitest fixtures in this repository.
CONTRACT_TESTED and LIVE_VERIFIED are **not reached** by anything in this report. An observed internal
protocol is not a licensed API.

## What was added (inherit, not rewrite)

`phoenix-observer.ts` and `observation.ts` are unchanged. The browser-companion decoder alignment tests still pass.
`continuity.ts` is extended. Existing semantics are kept: `continuity` is always `UNKNOWN`, `gapSince` is never
erased and auth expiry is latched. The pre-existing 48 adaptive-connectivity tests pass unmodified.

| File | Purpose |
|---|---|
| `message-lifecycle.ts` | Wraps `observePhoenixFrame`. Classifies frames as message metadata, read state, conversation metadata, quarantined schema drift or transport signals. |
| `message-ledger.ts` | Records message sightings per observer, keyed by (pageId, conversationId, providerMessageId). The reducer gives the same result for any arrival order. |
| `history-readback.ts` | Analyses bounded offset (`current_count`-style) pagination and reports coverage. Includes a sequential reader over a read-only `ReadbackPort`; no implementation of that port exists. |
| `readback-correlation.ts` | Correlates live sightings with readback results. Also decides whether a gap window may be marked reconciled-by-snapshot. |
| `continuity.ts` | Adds `GapWindow[]` and `connectedAt` to continuity state, plus `reconcileGapBySnapshot`. Legacy checkpoints are upgraded on restore. |
| `lifecycle-synthetic-fixtures.json` | Fixture corpus marked `"synthetic": true` at both file and case level, with per-case provenance. |

## Capability matrix

| # | Case | Status | Evidence level | Test file |
|---|---|---|---|---|
| 1a | Message upsert (`pages:update_messages`) → metadata only. Records message ID, text presence, attachment count/types/total size and a content hash. No body, URL, file name or text length is kept. | Modelled | Label SOURCE_INSPECTED; payload SYNTHETIC_TESTED | `message-lifecycle.spec.ts` |
| 1b | "Created" vs "updated" | Modelled as observer-relative only: `first-observed`, `re-observed-same` or `re-observed-changed`. These are not provider create/edit semantics. | SYNTHETIC_TESTED | `message-ledger.spec.ts` |
| 1c | Deletion label (`messages:mark_as_deleted`, nested `message.id`) → `deletion-labelled` metadata. A deletion without a message ID is quarantined, not guessed. | Modelled | Label/nesting SOURCE_INSPECTED; SYNTHETIC_TESTED | `message-lifecycle.spec.ts`, `message-ledger.spec.ts` |
| 1d | Unknown event name, or a known event with an unknown shape → `schema-drift` record with `quarantined: true` and `semantics: 'UNKNOWN'`. Keeps reason, event, topic, filtered and bounded key names (max 32, values never kept), key count, payload hash and capture ID. | Modelled | SYNTHETIC_TESTED | `message-lifecycle.spec.ts` |
| 2 | Read/unread (`pages:seen_conversation`) → separate `read-state` kind. A missing `seen` flag stays `UNKNOWN`. No Lead or obligation mapping exists. | Modelled | Label SOURCE_INSPECTED (static evidence only); payload shape is a synthetic assumption | `message-lifecycle.spec.ts` |
| 3 | Bounded readback: offset cursors, overlapping pages, duplicate IDs across pages, two concurrent readers, cursor regression, partial and failed pages, page budget, proven vs UNKNOWN ranges | Modelled. `coverage` is never `complete` and `completeness` is always `UNKNOWN`. A short page is not treated as terminal; only an explicit empty page is. | Shape mirrors the inherited 25+16+0 sample; behaviour SYNTHETIC_TESTED with a mocked port | `history-readback.spec.ts` |
| 4 | Live vs readback correlation → `{confirmed, missingFromLive, missingFromReadback, unknown}` plus a deletion-labelled subset. `eventsLost` is always `UNKNOWN`, even when the sets are equal. | Modelled | SYNTHETIC_TESTED | `readback-correlation.spec.ts` |
| 5a | Socket close/rejoin → gap window `{start, end}`. `start` is the latest of last observation and last join. A rejoin sets `end` but leaves the status `UNKNOWN`. | Modelled | SYNTHETIC_TESTED | `continuity-gaps.spec.ts` |
| 5b | Auth-expired frame → window opens. Rejoin is blocked, so `end` stays null and the window cannot be reconciled. | Modelled. **The real expiry frame shape is unverified.** The `phx_reply` error reasons used here are assumptions. | SYNTHETIC_TESTED | `continuity-gaps.spec.ts`, `message-lifecycle.spec.ts` |
| 5c | `reconciled-by-snapshot` requires all of: a bounded window, `connected` status, a contiguous-to-terminal conversation-list readback per page, contiguous message history for every listed or required conversation, and every readback starting at or after the window end. The result records `transitionsInWindow: 'UNKNOWN'`; there is no "replayed" status. A tampered checkpoint is rejected on restore. | Modelled | SYNTHETIC_TESTED | `continuity-gaps.spec.ts`, `readback-correlation.spec.ts` |
| 6 | Out-of-order and duplicate frames: capture-level duplicates and the out-of-order flag (inherited), plus message-level stale and duplicate-capture handling. The final ledger is identical across all 120 arrival orders, and equal-time ties are broken by capture ID. | Modelled | SYNTHETIC_TESTED | `message-ledger.spec.ts` |

Identity separation holds. Capture ID, `externalEventId` (always null), `providerMessageId`, the conversation
object ID, `payloadHash` and the per-message `contentHash` are separate fields. None of them is used as provider
event identity. No module emits a CommercialEvent, Lead state or verified outcome (I-04, I-10, I-11, I-12;
`// OPEN: CE-2` noted at the seam).

## Verification (run in the worktree, `product/`)

| Command | Result |
|---|---|
| `npm run typecheck` | pass |
| `npm run lint` | pass |
| `npm run architecture:check:strict` | PASS (0 findings) |
| `npm test -- --exclude '**/*.integration.spec.ts'` | 43 files / 524 tests passed, 0 failed, 0 skipped (98 new tests in 5 new files; pre-existing 38 files / 426 tests derived by subtraction) |

PostgreSQL was not needed. Nothing in this layer persists.

## BLOCKED on an authorized Pancake test account

- Real payload shapes for message create, edit, delete and restore frames, including how attachments and edits are represented and whether any provider event ID or sequence exists.
- Real `pages:seen_conversation` payload shape and whether it is ever delivered to this observer.
- The actual auth-expiry and revocation frame or close code, and whether the server sends one at all.
- Live pagination stability under concurrent inserts and deletes, cursor retention, rate limits, and tombstone visibility in message readback.
- Whether `current_count` offsets shift on deletion (which affects `movedIds` and position conflicts).
- Measured replay behaviour after rejoin for message events. Inherited trials covered tags only.
- Any CONTRACT_TESTED step needs a provider-sanctioned contract, and none exists for Conversations.

## Limitations

- Created vs updated is observer-relative. A first sighting can be an old message. A changed content hash can come from any provider-side field change, not only a user edit.
- `contentHash` is an unkeyed sha256 of the provider message object. For short or low-entropy bodies it can be guessed or linked offline. This is the same class of risk as the inherited `payloadHash`.
- Schema-drift records keep key names that match `^[a-z][a-z0-9_]{0,63}$`. A provider could in principle put identifying data into a key name of that shape.
- Unknown-shape drift on a known event still carries the base transport `Observation`, so a caller may count it for continuity. Callers must not treat that observation as message lifecycle evidence.
- Gap reconciliation covers the current message-ID set only. Conversations deleted during the window, tag/read-state transitions and intermediate edits remain UNKNOWN, as do A→B→A sequences, as in the inherited tests.
- `reconcileGapBySnapshot` trusts the `ReadbackAnalysis` objects it is given. Their provenance must be enforced by whatever future code produces them; no producer exists here.
- The browser-companion decoder (`protocol.mjs`, not owned here) does not know `pages:seen_conversation`. If read state is to be captured in the browser, the owner of that file must add it with matching shape checks.
