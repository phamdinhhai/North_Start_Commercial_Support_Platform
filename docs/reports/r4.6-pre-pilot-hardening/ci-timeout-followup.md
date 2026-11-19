# R4.6 migration lifecycle timeout follow-up

2026-11-19. Inspected hosted run44500378572 at754ebdd and raw product log
retained by root. Product failed required integration suite9: lifecycle test
timed out at5004ms; afterAll then timed out at10000ms while awaiting pool.end.
Browser job succeeded. Prior run71 atce01a59 passed the same source, including
20 integration suites/95tests and coverage1177tests. Neither earlier success nor
this targeted fix is a claim that latest hosted HEAD is green.

PostgreSQL logged an unexpected EOF with an open transaction when the failed
runner exited. The later forced checkpoint09:54:30.351–35.685 took5.334s total,
with0.507s write and0.015s sync. No lifecycle deadlock, lock-timeout or SQL
cancellation diagnostic identifies the blocked statement. Scheduler/storage
delay is consistent with the evidence; its exact cause is **unproven**. Logs did
not record lifecycle phases, so attributing failure to a specific migration
would be unsupported.

The single lifecycle roundtrip now has a60s budget, with30s setup/cleanup hooks.
It applies17 migrations, rolls back2, reapplies2 and checks retained data. This
is a bounded DDL correctness check, not a five-second latency requirement. No
global timeout, retry, skip, migration SQL or assertion was changed.

Each connection independently enforces server statement10s, lock3s and idle
transaction15s limits, client query12s and connection5s limits. A real PostgreSQL
regression verifies those active settings, cancels pg_sleep with a transaction
local100ms statement limit (57014), cancels a table-lock waiter with a100ms lock
limit (55P03), rolls back and proves pool queries recover. These shorter local
limits exercise the same server mechanisms without adding long test delays.

Cleanup starts pool.end before concurrently dropping only its generated owned
database with FORCE, so checked-out clients cannot keep teardown waiting behind
an interrupted test. All cleanup outcomes are collected; errors produce an
AggregateError rather than being swallowed. Fixed categorical phase markers
include elapsed milliseconds for create, full apply, rollback, reapply and drop;
they never emit SQL bodies or connection credentials.

Local validation in Windows Node22.21.0/PostgreSQL17 private loopback55446:

- Locked npm install passed.
- Lifecycle targeted suite:2passed/no skips; final run1.34s.
- Typecheck and lint passed; git diff --check passed.
- Query of pg_database after runs found zero mig_lifecycle_* leftovers.

The hosted5s failure was not recreated locally. Actual statement cancellation,
lock cancellation and recovery were exercised; root will validate full gates
and the new hosted SHA. No push or deployment by this specialist.
