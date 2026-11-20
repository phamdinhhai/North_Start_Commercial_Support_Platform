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

Result: 12 tests passed, zero skipped (6 durable sync PostgreSQL tests plus 6 migration unit tests). Typecheck, lint and strict architecture check passed. This does not prove provider availability, live delivery, production throughput or crash timing outside the transaction boundaries exercised.

