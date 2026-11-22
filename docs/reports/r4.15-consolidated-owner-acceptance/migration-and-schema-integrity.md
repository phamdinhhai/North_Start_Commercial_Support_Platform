# Migration and schema integrity

Audit base: `7cb21ce9a2b361cb417fd520705d6b7cdd68e5cf`. There are 23 ordered migration pairs, 46 SQL files, with no duplicate version or missing down file. R4.15 introduces no migration or canonical edit in this workstream.

| Boundary | Git tree / result |
|---|---|
| R4.14 `product/migrations` | 5acd8d84bf1c69b6fbd181c5fe65da5a939c1272 |
| R4.14.1 / selected RC base migrations | Same tree: 5acd8d84bf1c69b6fbd181c5fe65da5a939c1272 |
| Main migrations | 91df24c4ac984654fd74a9a2c43caacf1303bafc; versions 001–007 |
| Main to selected RC impact | Adds versions 008–023; existing 001–007 unchanged |
| R4.14 canonical / selected RC canonical | Same tree: 85d3dd78257b4e565af8a0e1369c60cfb97c66a6 |
| Main canonical | ac7ba86c8119f75ef7aadc2451823f3b28f79119; three preexisting ADR-superseded files differ |

Aggregate SHA-256 of sorted filename + NUL + file bytes + NUL for all 46 SQL files in the Windows checkout: `fb2b61a003e9ec8bd0801bb14601790d61fd3e7c0a5f24239669acc5c1136828`. This checkout-byte digest may differ with Git line-ending conversion; the immutable Git tree above is the cross-checkout comparison.

| Versions | Schema role |
|---|---|
| 001–003 | Domain, feedback/telemetry and durable pilot loop |
| 004–007 | Envelope workspace scope, consistency guards, ingest command and acquisition evidence |
| 008–010 | Integration receipts, work completion provenance and workspace membership |
| 011–014 | Governed actions, keyed content digest, pilot closure and assertion delivery |
| 015–017 | Data lifecycle, contact attempts and assertion operations |
| 018–021 | Synthetic source integration, lookup indexes, source episode links and receipt guards |
| 022–023 | Durable synchronization streams and fabricated delivery |

`loadMigrations()` sorts `.up.sql` filenames and refuses a missing paired down file. `Migrator.up()` uses a per-version advisory transaction lock, rechecks applied versions inside the lock, applies the migration and records `schema_migrations` in the same transaction. There is no checksum column in `schema_migrations`; release integrity therefore also requires immutable source-tree comparison, not merely counting database rows. No migration downgrade or destructive restore is run against the active Owner acceptance database.

The supported pilot runs `new Migrator(db, loadMigrations()).up()` before Nest starts. Startup separately rejects any non-synthetic envelope or Lead lacking a same-workspace synthetic source envelope. It uses its owned cluster and restricted database role. R4.15 must record the actual `schema_migrations` rows from its disposable verification environment and active synthetic pilot; historical tests are not a substitute for that check.

Audit finding: at this base `PostgresReadinessProbe.REQUIRED_MIGRATIONS` lists only versions 001–017. A readiness 200 alone therefore does not establish integration schema 018–023. The launcher applies all discovered migrations, but release acceptance must separately verify all 23 rows or include a reviewed readiness-probe correction and its regression. This finding was sent to the root integrator; final disposition belongs in the release notes and verification manifest.

Canonical delta from main is preexisting commit `bd4ee87` (`docs(canonical): supersede CE-2, PM-1, LG-1, MM-1 with owner-approved ADRs`), touching COMMERCIAL_EVENT_MODEL.md, IDENTITY_MODEL.md and OPEN_DECISIONS.md. The replacing decisions are ADR-005 through ADR-008; open CE-1/ID-1/ID-2 remain open. No new interpretation or resolution is introduced by this candidate audit. Any final RC diff under frozen canonical paths must be compared to the R4.14 tree and investigated before push.

Fresh migration, PostgreSQL, backup/restore, crash/restart and source/sync regression results for the exact final R4.15 source remain pending at this audit snapshot. Parent release verification must fill those results from its disposable test environment, keeping the Owner's running database separate.
