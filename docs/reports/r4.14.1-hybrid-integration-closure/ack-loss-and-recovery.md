# ACK loss and crash recovery

The proxy awaits the upstream receipt response after the PostgreSQL transaction commits, records its stored disposition, and destroys the downstream socket before sending an ACK. Chromium can internally replay a POST after a dropped reused connection. The proxy therefore continues dropping ACKs for that capture until the explicit recovery step; every upstream duplicate is required to report duplicate. This exercises genuine connection loss, rather than invalid JSON presented as an ACK.

The test verifies one durable receipt, persisted pending operation identity, actual service-worker termination/restart, structurally identical JSON replay, duplicate ACK and unchanged receipt count. The assertion compares parsed request content, not raw bytes. Browser restart after a separately truncated ACK is retained as a distinct test. Concurrent identical replay also must return duplicate without a second logical receipt; changed payload under the capture is rejected.

Pre-commit failure is injected separately. A disposable PostgreSQL BEFORE INSERT trigger pauses the real receipt transaction. The harness waits for that transaction, kills the Nest process and terminates its disposable database session, then verifies rollback and zero new receipt. It removes the fixture trigger, restarts the backend and replays the retained pending operation to obtain one receipt. That assertion checks pending capture identity and receipt count; it does not compare the complete replay body bytes. The trigger exists only in the disposable child database.

Foreign workspace/native targets, membership revocation, expired login and account switching are explicit negatives. A separate PostgreSQL regression revokes membership during an API read and proves the subsequent receipt transaction refuses persistence. No implementation claims exactly-once external delivery.

This recovery applies to technical observation uploads. It does not authorize replay of provider mutations. The historical Pancake send remains `SEND_UNRESOLVED`, with automatic retry disabled and no new provider call.

Command: `node scripts/hybrid-browser/durable-e2e.mjs` from `product/`, with explicit disposable loopback `TEST_DATABASE_URL`. Exact results and failure history are retained in `verification.json`.
