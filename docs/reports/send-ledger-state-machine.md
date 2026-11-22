# Send ledger state machine

Outbound mutation uses an append-only write-ahead ledger. A request is `PLANNED`, then `RESERVED` before any provider I/O, then `DISPATCH_STARTED`. Every provider response appends exactly one outcome: `RESPONSE_CONFIRMED`, `PROVIDER_REJECTED`, or `AMBIGUOUS`.

A process restart after `DISPATCH_STARTED` is not permission to send again. Recovery appends `MANUAL_REVIEW_REQUIRED`; an operator may perform a GET-only provider readback and later close with evidence. There is no automatic retry transition.

The request key deduplicates ledger appends and concurrent duplicate callers. It does not claim provider idempotency: provider idempotency is an independently verified adapter capability. A confirmed provider response may include its provider message ID as evidence; a rejection remains distinct from an ambiguous network failure.

The pure reducer lives in `product/src/domain/send-ledger/send-ledger.ts`. Persistence implementations must durably append each event and enforce one writer/unique request identity at the storage boundary.
