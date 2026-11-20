# Checkpoint and recovery tests

Revision under test: local `feat/r412-provider-sync-foundation` worktree, based on R4.11 `4503e80`; exact commit is recorded after integration. Environment: Node22, PostgreSQL17 loopback database `r412_sync_final`, fabricated source observations only.

| Scenario | Evidence |
|---|---|
| Two bounded pages / cursor | `sync-checkpoint.integration.spec.ts`: stream version and opaque cursor advance after committed page |
| Same page replay | Page content/key replay returns recorded counts and no additional `source_receipt` rows |
| Processing failure | Changed meaning under one page key raises `RECEIPT_COLLISION`; transaction rolls back source receipt and checkpoint |
| Lease fencing | A second worker cannot claim an active lease; commit requires current token and unexpired lease |
| Revocation | Source connection/stream revocation blocks subsequent page commit and clears lease |
| Cross-workspace | Stream lookup and source connection FK are workspace scoped; integration store admission checks current connection |
| Recovery semantics | Fetch is outside transaction; commit is one transaction. A failure before commit leaves cursor unchanged; a new PostgreSQL pool/store after two pages resumes the durable cursor. This is not an OS process-kill test |

Executed command:

```text
TEST_DATABASE_URL=postgres://postgres@127.0.0.1:54050/r412_sync_final npx vitest run src/infra/sync/sync-checkpoint.integration.spec.ts src/infra/postgres/migrator.spec.ts --no-file-parallelism
```

Result: 13 tests passed, zero skipped (7 durable sync PostgreSQL tests plus 6 migration unit tests). Typecheck, lint and strict architecture check passed. This does not prove provider availability, live delivery, production throughput or crash timing outside the transaction boundaries exercised.


Additional bounded harness test commits two fabricated pages, confirms all PostgreSQL pool clients are idle during request callbacks, resumes with a new worker, commits page3 and checks three unassigned Lead seeds. This is a worker/store restart simulation; OS process crash is independently parent-owned.



## Final integrated evidence checkpoint

Root source `41948f37a72d75e024ea115818e2834914232e92` requires mandatory authorizeFetch before every request and current binding inside commit. Direct credential-binding tests now exercise exact workspace/connection/provider/account/scope, rotation, forged principal and revoked state. A new actual PostgreSQL test verifies persisted RATE_LIMITED retry eligibility refuses early claims, explicit GAP_DETECTED blocks subsequent claims, and malformed terminal cursor input never advances checkpoint. Source code is unchanged from0e6f971; only tests were added before the final full rerun. Full exact-source results and log hashes are in verification.json.


Final root execution at frozen41948f3:26/26lanes PASS,1,413tests in155files,157PostgreSQL included/zero skipped,92.77%line coverage. Signed R4.12 UI,16table restore and page/delivery replay, abrupt child exit73/resume page3, owned launcher PG outage and bounded benchmark all PASS. This is independent of the earlier workstream checkpoint above. Hosted R4.12, provider authorization and human validation remain NOT RUN/PENDING as separately scoped.
