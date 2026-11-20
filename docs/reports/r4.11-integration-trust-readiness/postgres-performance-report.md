# R4.11 bounded PostgreSQL experiment

Dedicated agent-owned local PostgreSQL; fabricated data only; eight workers,
1,200 seed receipts and 1,459 accepted receipts per run. Existing exclusive
connection row lock was retained. These are individual local observations,
not production capacity, service objectives, or statistical performance claims.

| Workload (64 requests) | Baseline p50/p95/p99 ms | Indexed, bounded lookup p50/p95/p99 ms |
|---|---|---|
| Same connection, distinct messages | 45.13 / 54.46 / 57.59 | 22.10 / 30.70 / 85.10 |
| Same connection, same message | 36.00 / 48.01 / 49.13 | 22.14 / 30.26 / 32.27 |
| Different connections, same native message | 32.37 / 52.36 / 53.65 | 14.99 / 16.76 / 17.27 |
| Concurrent receipt replay | 11.58 / 14.37 / 15.16 | 5.49 / 6.29 / 7.15 |
| Different workspaces | 18.37 / 21.33 / 22.83 | 10.26 / 13.20 / 13.99 |

Full runs took 3,863 ms and 2,908 ms. The distinct-message tail regressed;
64 samples make p99 effectively the maximum. The second run retained the
first run's receipts (2,918 cumulative), used a fresh workspace, and benefited
from warmed caches. No isolated causality or broad throughput claim follows.

Identical EXPLAIN (ANALYZE, BUFFERS) lookup statements before/after:

| Query | Shared buffer hits | Execution ms |
|---|---|---|
| Native message history | 29 → 3 | 0.164 → 0.029 |
| Explicit event/revision | 156 → 3 | 0.414 → 0.024 |
| Receipt identity | 2 → 2 | 0.022 → 0.023 |

Migration 019 adds the two measured lookup indexes, preserving 018 indexes
and all evidence. Its downgrade drops only these indexes. Intake now fetches
at most one conflicting conversation/event row and one matching event row,
instead of loading an entire message history. A missing conflict can still
require scanning all matching history; this change bounds returned data, not
worst-case database work. Connection health aggregates only the first bounded
connection page; exact per-connection counts still grow with receipt history.

Ten millisecond sampling saw 759 versus 401 sessions waiting on locks across
samples; this is neither exact wait duration nor a unique waiting-request count.
The observed maximum pool queue was zero with eight workers and eight pool
slots. Database deadlocks were zero. Sixteen conflicting event requests rejected
and eight post-revoke requests rejected in each run. A deterministic integration
test additionally observes revoke blocked behind a held intake connection lock,
then confirms rejection of subsequent intake. Exclusive locking intentionally
serializes intake on one connection. Replay remains protected by that lock plus
the receipt unique constraint and native/event advisory transaction locks.

Evidence pagination preserves PostgreSQL microseconds in a scoped opaque
cursor and fetches limit+1. It is a fresh keyset scan, not a frozen snapshot:
later appends can appear in subsequent pages, and transaction timestamps can
precede commit order. Authorization must be checked on each page by the caller.
Direct scoped connection lookup avoids the old first-hundred lookup failure.

Reproduce after building with `node scripts/source-integration-benchmark.mjs`:
set TEST_DATABASE_URL to the dedicated local engineering database and
BENCH_OUTPUT to an external artifact path. The script allows only loopback
engineering database names, caps runtime at 120 seconds, caps workers at eight,
and writes raw plans outside the repository. Run baseline from the original
commit before applying 019. Repeated runs append fabricated history; use a new
dedicated database for independent dataset sizes. The benchmark does not clean
up accepted append-only history or stop the shared engineering cluster.

Raw artifacts retained outside Git in the agent's temporary directory:

- `r411-perf-baseline.json`, SHA256 `a97c8dc9d13039382234824932eb83a5ad8821042fd5c97e8d2634d98bcdfafa`
- `r411-perf-optimized.json`, SHA256 `dd14c2ce7f98e06781ff5359aa029f6447187c5bb4ac50070087eb1ebfdf640f`

Verification: TypeScript check, build, two cursor unit tests and four actual
PostgreSQL integration tests: connection lookup beyond 100; same-timestamp
keyset traversal and foreign-scope rejection; observed revoke locking; and
index-only downgrade with nonempty evidence plus concurrent reapplication.

## Exact final-source execution

Frozen source `4fe69e396f1db665e41c3ec4b8ad324e9dd2f92b` completed all23 verification lanes. A fresh dedicated benchmark database contained1,459 accepted fabricated receipts after the bounded run;8workers,1,200seeded receipts,3,028ms overall. No unexpected errors, deadlocks or observed pool queue. Sixteen event collisions and eight post-revoke attempts were intentionally rejected. Lock-wait sampling recorded416session samples at10ms intervals; this is not exact wait duration.

| Workload,64 samples | p50 ms | p95 ms | p99 ms |
|---|---|---|---|
| Same connection, distinct messages |23.21|29.75|32.90|
| Same connection, same message |19.00|21.55|22.07|
| Different connections, same native message |17.40|20.47|20.77|
| Concurrent replay |6.70|21.55|21.79|
| Different workspaces |11.33|17.13|21.97|

Final EXPLAIN ANALYZE BUFFERS: receipt index scan0.019ms/2shared hits; native lookup0.024ms/3hits; event lookup0.022ms/3hits; Lead evidence query0.080ms/6hits using existing018Lead-history index. Current bounded-connection lateral health query took1.886ms/1,218hits, versus0.930ms/154hits for the old aggregate shape on this small dataset. Thus health bounding does not establish lower cost on small workloads; it bounds which connections are aggregated while per-connection exact counts still grow. No extra speculative index or lock weakening was justified.

Artifact `%TEMP%/north-r47-r411-final-uvhSOO/benchmark.json`, SHA256 `fdba0ffa495797c2dabeea7d4e0725aa2ed2ea97cbdb1b979544647e11daff43`. Exact commands, environment and log hashes are in verification.json. These measurements remain local synthetic observations, not production capacity/SLO evidence. Earlier before/after tail regression and dataset/cache confounds remain disclosed above.
