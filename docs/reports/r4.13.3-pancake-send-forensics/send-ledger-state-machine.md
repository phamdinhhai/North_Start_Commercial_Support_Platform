# Send ledger state machine

The fabricated offline coordinator uses an append-only write-ahead ledger. A
request is `PLANNED`, then `RESERVED`, then `DISPATCH_STARTED`, with each
dispatch precondition fsynced before loopback I/O. A validated fixture response
appends `RESPONSE_CONFIRMED` or `PROVIDER_REJECTED`; missing or invalid response
evidence appends `AMBIGUOUS` and then `MANUAL_REVIEW_REQUIRED`.

A process restart after `RESERVED` or `DISPATCH_STARTED` is not permission to
send again. The pure recovery view transitions to `MANUAL_REVIEW_REQUIRED`.
Existing fixture files are inspected read-only and stale locks are not deleted
automatically. There is no automatic retry transition. Under the current Owner
instruction, even another provider GET is prohibited; future reconciliation
requires a separate reviewed plan.

The request key deduplicates ledger appends and concurrent duplicate callers. It does not claim provider idempotency: provider idempotency is an independently verified adapter capability. A confirmed provider response may include its provider message ID as evidence; a rejection remains distinct from an ambiguous network failure.

The pure reducer lives in `product/src/domain/send-ledger/send-ledger.ts`. Persistence implementations must durably append each event and enforce one writer/unique request identity at the storage boundary.

The new offline persistence implementation covers binding and payload HMAC,
chained row MACs, exclusive file locks, append/fsync, torn-row refusal and
process-crash fixtures. It is not registered in the application runtime.
Directory-entry power-loss durability, production key custody, an append path
for manual closure after reopen, and provider-side idempotency remain outside
the implementation. `requestFinished=true` is local write completion only.
