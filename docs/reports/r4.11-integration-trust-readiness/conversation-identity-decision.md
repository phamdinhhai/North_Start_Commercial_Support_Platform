# Conversation identity and commercial continuity — bounded proposal

Status: bounded receipt-context association approved by root for R4.11; canonical ID-1 remains OPEN. Migration 020 reviewed by root before private PostgreSQL execution.

Account/channel identity locates a transport namespace. A native message identifies one observed source object. A conversation groups messages in a provider namespace. None identifies a Customer or a commercial episode. A Lead identifies one commercial/acquisition episode; work and outcome assertions remain separate Lead-scoped records. Conversation Source, Acquisition Lineage and Revenue Attribution remain separate (I-02); attribution stays UNKNOWN (ADR-008).

The baseline preserves native message mapping and accepted receipts immutably. Separate messages currently seed separate Leads even inside the same conversation. Matching names, phone numbers, text, timestamps or conversation identifiers must never automatically coalesce Leads or Customers (I-01/I-06/I-07). An explicit human choice may associate additional source evidence with an existing Lead without claiming same-customer identity. This proposal is an evidence-context association, not identity resolution, merge/unmerge, state transition or provider verification.

## Proposed contract

Attach-to-existing-Lead during intake is DEFERRED: it requires a cross-store atomic integration review. Historical seeds continue to exist per message, visibly and immutably. The implemented workflow adds selected receipt context to an existing episode after intake; it does not reduce historical seed count. Before association writes, a required authorization callback checks the current Lead owner under the existing work mutation rule. Role admin/manager and active-recipient read access do not independently permit mutation (ADR-006). No existing native mapping can be reassigned by intake; a conflicting selected Lead must be rejected. Receipts, original Lead IDs and raw evidence remain immutable.

A separate append-only receipt-context history can record human-confirmed link, unlink or rejection. Each command includes workspace from authenticated membership, target Lead, connection, receipt, expected stream version, evidence envelope and human rationale. The stream is keyed by workspace/connection/receipt. The original Lead and currently effective Lead must both pass the existing mutation callback before a correction crosses Lead boundaries. Rejection/unlink does not delete the source or alter the original seed mapping. A subsequent correction appends a new version. Optimistic version checks and transaction locks ensure two operators cannot silently overwrite a choice.

Observed source facts, unconfirmed candidates, human-confirmed episode associations, rejected proposals and provider-verified identity are distinct. Synthetic source facts always remain synthetic_fixture/UNVERIFIED, including after human confirmation. This slice has no provider verification writer and no automatic candidate creation. Missing conversation identity stays UNKNOWN. Same channel identifiers under different native systems stay different namespaces; route/transport account is retained separately from native source namespace.

## Executable acceptance proposal

- Two different messages in one conversation remain distinct until explicit attach; the second receipt can be explicitly associated with an existing Lead while preserving its historical seed.
- Different conversations may be deliberately associated as episode evidence without merging customer identity.
- Same page/channel/message values under different native systems cannot align automatically; missing conversation remains UNKNOWN.
- Equal name/phone/text/time never triggers linking; synthetic links never become provider_verified.
- Link, unlink, reject and correction append history while old receipts/native mappings remain byte-for-byte unchanged.
- Two operators using one expected version yield one success and one stale-version conflict.
- Cross-workspace or mismatched receipt/envelope inputs fail without writes or disclosure.
- Viewer, unassigned admin/manager and non-owner recipient cannot bypass existing mutation rules.
- Failure of final audit rolls back the association atomically.

Migration 020 is additive only and requires engineering review before database execution. No canonical edits, identity thresholds, customer merges, owner changes, work mutations, outcomes or attribution changes belong to this slice. ADR-005 governs assertion scope; this history records technical evidence associations only. ADR-007 keeps this foundation synthetic and gated. ADR-009 content-digest/raw policy is unchanged.

## Implementation and verification

The implemented command is admin-only and non-demo behind the existing synthetic feature gate, plus existing owner authority on target, original source Lead and prior effective Lead. Read methods accept existing roles only after Lead access authorization; every returned history item or receipt pointer also requires origin access. Human association grants no new visibility into the source Lead. Inaccessible origins produce no IDs or hidden-count disclosure; list completeness remains UNKNOWN.

The per-receipt stream uses version zero initially, an immutable unique version sequence, and caller idempotency keys bound to actor and workspace-keyed HMAC command content (ADR-009). Replay is reauthorized under current access. Link/unlink/reject append technical context history, not commercial assertions or Customer/Lead identity decisions. No candidate matching or provider verification writer exists.

Private PostgreSQL tests cover multi-message same conversation, different conversations, missing conversation, native-system separation, link/unlink/reject, immutable historical receipts/native mappings, stale concurrent commands, replay collision, changed ownership, cross-workspace rejection, evidence mismatch, append guards, rollback refusal and audit-failure transaction rollback.

The store locks affected Lead ownership rows in sorted order before invoking the existing authorization callback inside the source-receipt transaction. Concurrent ownership updates cannot commit between that authorization and the append. No new authority rules are introduced.

Verified commands: `npm ci` completed (npm reported 5 moderate dependency advisories); `npx vitest run src/application/source-integration/source-integration.service.spec.ts src/application/pilot/work-mutation-policy.spec.ts` passed 8 baseline tests. Final `npx vitest run src/application/source-continuity src/infra/source-continuity` passed 11 tests using a fresh isolated `north_r411_identity_final` database on the root-owned private loopback PostgreSQL cluster after migration review. `npm run typecheck` and `npm run build` passed. An initial migration execution rejected a UTF-8 BOM; final SQL has no BOM and the fresh database test applied it successfully.

Pool-starvation correction: the store now passes workspace and owner from the actual locked Lead rows to the authorization callback. Runtime composition applies the existing Lead policy and owner check to that server-derived authority without acquiring another pool connection inside the transaction. The preflight check still loads current Lead state before the transaction. Private PostgreSQL verification uses `max: 1` and a one-second connection acquisition timeout; ten concurrent independent commands complete successfully using the production module factory, with one client and no queued waiters after completion. Changing the source origin owner then denies both a new command and replay on the next request. The production callback therefore no longer has the previously identified nested-pool starvation defect. Read pointers remain authorized at read time, so payload readers must preserve origin authorization before exposing source contents.

Follow-up verification: `npm ci` completed in the isolated pool-review worktree; `TEST_DATABASE_URL` pointed only at the newly created private `north_r411_pool_review` database on root-owned loopback PostgreSQL. `npx vitest run src/infra/source-continuity/source-continuity.integration.spec.ts` passed all 7 actual PostgreSQL tests, including the production-factory single-client concurrent regression. No provider calls or canonical changes were made.
