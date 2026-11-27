# Receipt tuple guard â€” independent review correction

2026-11-20. Additive migration021 corrects a defense-in-depth gap identified in independent read-only review: migration020's global envelope foreign key and independent origin foreign key did not establish that the immutable association used its receipt's exact envelope and origin Lead. Application code already checked those relationships; direct SQL or a future adapter error could bypass that check.

021 locks source-link writers during preflight and trigger installation. It rejects existing rows whose `(workspace, connection, receipt)` lookup is absent or whose envelope/origin differ, without rewriting or deleting history. A BEFORE INSERT trigger then enforces the same receipt tuple. Existing append-only UPDATE/DELETE/TRUNCATE guards remain. 018/019/020 are unchanged.

Down removes only the new trigger/function and preserves all history, returning to the weaker020 insertion contract. Engineering approval and paused writers are required operationally before using that downgrade; this is not a data-repair path. Re-up validates all retained rows and refuses any inconsistent downgraded inserts. No privilege, commercial state, identity merge, original evidence or provider authorization is introduced.

Verification ran against a dedicated fabricated local databases `north_r411_guard` and fresh final run `north_r411_guard_final` on the root-owned temporary PostgreSQL cluster at port50936, never a pilot database. The new registered PG suite proves valid preexisting020 history survives up byte-for-byte, wrong same-workspace envelope, foreign-workspace envelope and wrong origin inserts fail, valid new rows succeed, down/up preserve accepted history, and deliberately inconsistent020 fixture history causes transactional upgrade refusal without mutation. The invalid fixture is rolled back; the guard remains installed.

`npm ci` completed (five existing moderate audit findings). New PG integration suite plus migration inventory: 2 files, 8 tests passed without skips. Typecheck and build passed. No live provider calls, account resources, credentials or customer data were used.
