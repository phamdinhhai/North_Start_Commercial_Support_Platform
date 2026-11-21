# Provider sync readiness (SYNC-01)

This workstream adds an offline, pure positional overlap planner for Pancake history re-reads. The provider contract documents `current_count` as an index position; concurrent inserts or deletions can shift that position. A caller may therefore request a bounded overlap before the last observed offset. The planner computes `startCount = currentCount - overlap` and performs no request, dedupe, checkpoint mutation, admission, or commercial action.

Every plan remains `completeness=UNKNOWN` and `durableResumeSafe=false`. Overlap is a safety re-read hint, not proof of continuity. Returned duplicates, edits, and deletion observations must remain immutable and be handled by the existing receipt/admission boundary. No current-count checkpoint is introduced.

Validation is local only: target identifiers, non-negative safe counts, overlap no greater than the observed count, and existing page/item ceilings (100/1,000). No credentials, HAR files, provider calls, customer payloads, production wiring, or migration changes were used.

Verification: `npx vitest run src/adapters/pancake/pancake-history-overlap.spec.ts` and `npm run typecheck`.
