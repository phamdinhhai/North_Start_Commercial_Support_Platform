# R4.12 architecture and admission decisions

Scope: offline fabricated inputs only, within ADR-005–009 and unchanged I-01–I-12. CE-1, ID-1 and ID-2 remain open. No production connector, OAuth broker, new service, external worker daemon or real-data policy is introduced.

| Boundary | Implemented decision | Enforcement evidence | Remaining limit |
|---|---|---|---|
| Provider admission | Cumulative research/contract/offline/custody/rights/sandbox/live/production evidence, never connected=true | ProviderCapabilityAdmission + buildProviderAdmission tests | Server-owned evidence projection is not an authentication credential; networkActivation always NOT_ENABLED |
| Credential custody | Admin-only TEST_ONLY memory backend; production vault unavailable | test-only-credential-store guards/negative tests | Fabricated secret only, process-local bounded audit, not durable custody or approved KMS |
| Worker identity | Opaque frozen server-issued principal bound to workspace/connection/provider/account/version | credential WeakSet/version tests; bindSyncCredential | Not a human OIDC role; restart requires a new local principal |
| Fetch admission | Mandatory authorizeFetch before each request; current stream binding before request | offline-sync unit tests + independent QA | Trusted local auth callback must terminate; future network transport remains absent |
| Commit admission | Connection row then stream row lock; current credential callback before replay/intake | PgSyncCheckpointStore + PG tests | Memory credential rotation can race after authorization; acceptance linearizes at the observed in-transaction check, subsequent request denied |
| Atomic checkpoint | Source receipts/envelopes/seeds/audit and page commit/checkpoint share one SQL executor/transaction | rollback/collision tests, process restart and restore rehearsal | At-least-once delivery, no exactly-once external guarantee |
| Network transaction | Fetch is outside PostgreSQL transaction; bounded page loop and request deadline | idle-pool assertion during polling fixture | Trusted callbacks/commit duration are not an end-to-end SLO |
| Lease | Server UUID fencing token, current wall-clock expiry, version/cursor checks | competing/expired worker PG tests | One connection still serializes accepted source intake; no multi-instance capacity claim |
| Cursor | Opaque cursor + explicit completed flag; page key/content HMAC; loops rejected; old page replay returns current checkpoint | PG replay/loop tests | Does not prove provider completeness or arbitrary backward traversal; no operator raw-cursor edit |
| Signed delivery | Unregistered north-start-fabricated-delivery/v1 protocol, raw-byte HMAC before JSON; current messages.read credential required | fabricated webhook PG negatives | Not Pancake webhook authenticity or approved Meta app identity; no public live receiver |
| Durable acknowledgment | Result resolves only after receipt/ledger/attempt transaction commits | attempt-insertion fault rollback + retry | No actual HTTP provider acknowledgment route is enabled |
| Continuity | Worker creates only unassigned synthetic seeds; link/unlink/reject remains explicit and immutable | identity regression and browser tests | No automatic Customer/Lead merge, no intake attach, no outcome/payment/attribution inference |
| Operator health | Manager/admin read, admin control, bounded100 streams; no cursor/lease token/secret; local counts distinct from completeness | health PG/HTTP/browser tests | UNKNOWN external lag/completeness; failed-page/event historical counts are NOT_PERSISTED |
| Recovery | Abrupt child exit73 after two committed pages; independent restart resumes page3; restore retains ledgers and replay | sync-recovery-rehearsal / restore-rehearsal | Local rehearsal, no production RTO/RPO or backup erasure assurance |

Migration022 adds sync_stream/sync_page_commit;023 adds fabricated_delivery/fabricated_delivery_attempt. Both are additive and refuse destructive downgrade when their history is nonempty. Historical migrations001–021 remain byte-for-byte unchanged.021's earlier guard test is scoped to its historical migration set so later additions do not invalidate its intended assertion. Fresh upgrade, empty-schema rollback/reapply and nonempty history refusal are exercised separately.

Revocation semantics: a source-connection revoke is database-lock ordered with intake; stream pause/revoke fences future commits and clears lease. TEST_ONLY credential revocation/rotation is observed before fetch and in the acceptance transaction, with next-request refusal. A credential revoked after the final in-memory check cannot retroactively cancel an already accepted in-flight transaction. A real vault/transport implementation must explicitly approve its cancellation and serialization contract before live admission.

Provider read permission scopes in fabricated fixtures are local policy labels. They do not assert that Pancake or Meta uses that exact scope name or grants access. Pancake authentication is not inferred from Meta HMAC. Provider rights, endpoint authentication, app review, token custody and synthetic asset ownership remain separate admission evidence.
