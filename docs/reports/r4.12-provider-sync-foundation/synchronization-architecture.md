# R4.12 synchronization architecture

This slice adds migration `022_sync_stream` and a provider-agnostic, offline-synthetic checkpoint store. It does not make provider network calls, hold a PostgreSQL transaction over a request, or create a live worker.

`sync_stream` is workspace and connection bound. A stream has an opaque cursor, monotonic local cursor version, completed flag, retry/failure state, gap state and a server-generated fencing lease token. A worker claims a short lease, fetches outside PostgreSQL, then commits one bounded page inside a transaction. The transaction locks the source connection before the stream, rechecks revocation and lease expiry, checks current credential/connection authorization through a non-pool callback, persists source receipts through the existing store on the same transaction executor, appends an immutable page commit, advances the checkpoint and audit in one commit.

A page is at most 100 observations and a stream run is bounded to 100 pages/1,000 observations by the offline harness. Page identity is the explicit page key plus content/next cursor, excluding the cursor position so a crash retry can replay the same page after a version change. Duplicate page replay returns the recorded counts and audit event without source effects. A changed payload with the same page key fails closed. Cursor loops and revisited cursors fail before commit. `completed=true` is valid only with a null next cursor; initial null and terminal null are distinguished by the completed flag.

The source callback remains synthetic and uses a `sync-worker:<stream>` service identity with viewer role and `claimResponsibility=false`. A provider message cannot assign a human owner or assert a commercial outcome. Existing source trust validation preserves `synthetic_fixture`, `UNVERIFIED`, UNKNOWN completeness and candidate native mappings. The callback is deliberately injected at the application boundary; infrastructure does not import application validators.

Failure paths record bounded retry state and categorical failure codes. Authentication revocation blocks the stream; schema/gap/retry exhaustion blocks it; timeout/rate-limit/database failures degrade it. Checkpoint advancement never occurs when source processing or audit fails. External delivery is at-least-once; exact-once provider semantics are not claimed.

Migration down refuses nonempty stream/page history. Restore must preserve these tables before a stream is resumed. Stream control is auditable and clears leases on pause/revoke. Human operator authorization is separate from provider service authorization.

Offline verified only: a test PostgreSQL database proves two pages' durable receipt/checkpoint transaction, same-page replay, collision rollback with no checkpoint advance, lease fencing, revocation and no owner claim. Live OAuth, vault/KMS, provider webhook routes, real cursor semantics and production scheduler remain outside this slice.

## Root integration and signed fabricated delivery

Root adds migration023 for an unregistered `north-start-fabricated-delivery/v1` test protocol. A bounded raw byte body is authenticated with an injected HMAC verifier before JSON decoding, then schema/account/native/trust validation runs. Current opaque credential and messages.read fixture scope are rechecked under the connection lock. Source effects, an immutable delivery ledger and attempt row commit together; a response is returned only afterward. Repeats append attempts without duplicate source effects; changed content under one delivery ID conflicts. This is not Pancake webhook authentication or approved Meta app identity.

Operator source gate composes only health/control. It deliberately provides a deny-worker commit authorization callback in the HTTP application composition. Credentials, polling workers and fabricated webhook admission have no automatically registered route or daemon. Programmatic offline harnesses use `bindSyncCredential` for current account/version/scope and mandatory `authorizeFetch` before each request. Live transport remains unavailable.

Root retains the same request-time/in-transaction authorization snapshot limit: memory credential changes after the check cannot retroactively cancel a committed in-flight transaction. Database source revoke is lock ordered. Page/attempt ledgers are append-only, cursor updates are transactional, source context authority remains UNVERIFIED, and no business outcome or human ownership is created.
