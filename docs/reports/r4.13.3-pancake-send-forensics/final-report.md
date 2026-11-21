# R4.13.3 Pancake send forensics

R4.13.3 completed offline transport, parsing, encoding, WAL, and recovery
engineering after the single ambiguous `reply_inbox` attempt from R4.13.2.
There were **zero Pancake requests** during this release. The Owner's manual
review of the exact conversation was `NOT_OBSERVED`; it does not prove that the
earlier POST was never processed.

The baseline is R4.13.2 commit `2b990357b8dddd4ef8f6905cd413ba707c01d4e7`.
The tested implementation source is `5489ff9546d9e41790368e549d30a82f33b14023`;
subsequent commits change documentation only. The final documentation HEAD is
provided in the delivery response. The branch remains local and unpushed.

## Incident result

The strongest supported classification is `SEND_UNRESOLVED`. The evidence is:
one POST attempt, no readable HTTP/business response, one bounded recovery GET
that did not find the marker, and Owner UI non-observation. `post_attempts=1`,
`confirmed_provider_writes=0`, `automatic_retry_allowed=false`,
`new_mutations_allowed=false`, `delivery_status=UNKNOWN`, and
`read_status=UNKNOWN`. No retry or additional mutation occurred.

The likely contributing defects are the historical Node connect timeout, a
Python/Node boundary that could inherit `cp1258`, and a loader that discarded
execution metadata. The corrected offline bridge writes and reads explicit
UTF-8 bytes, validates exact JSON/business acknowledgement, and preserves
transport/parser distinctions. These are bounded engineering findings; they do
not reconstruct whether Pancake received the historical body.

## Implemented controls

The technical send ledger now requires `PLANNED → RESERVED → DISPATCH_STARTED`
before dispatch and records a terminal response, rejection, or ambiguity. WAL
rows are append-only, HMAC-linked, fsynced before dispatch, and protected by an
exclusive lock in the fabricated fixture. Restart after dispatch becomes
`MANUAL_REVIEW_REQUIRED`; there is no automatic resend. The loopback-only HTTP
emulator covers UTF-8 bytes, query redaction, business failures, non-JSON and
truncated responses, HTTP errors, reset/timeout classes, response limits,
concurrent duplicate prevention, and process interruption.

The official contract review confirms that `reply_inbox` is conversation-scoped
and uses `{action:"reply_inbox", message}` with a Page access token. It has no
required recipient field. This is documentation evidence only in R4.13.3; no
new provider capability is claimed.

## Verification

Focused Vitest passed 31 tests across five files. The Node boundary suite passed
26 tests. Typecheck, lint, strict architecture, registry validation, dependency
audit, and build passed. The full local Vitest invocation passed 1,394 tests;
its normal environment filter skipped integration files. The dedicated
isolated PostgreSQL gate then ran all 30 integration suites (157 tests) with
zero skips. The R4.13.3 final local manifest ran 18 lanes on source SHA
`5489ff9546d9e41790368e549d30a82f33b14023`; all passed, including coverage
(92.98% lines), HTTP E2E, browser, OIDC, backup/restore, companion and audit
checks. Supplemental source UI, R4.11/R4.12 browser, packaging, benchmark,
sync-recovery, sync-benchmark, and forensic lanes also passed. The pilot launcher
initially failed because the C drive ran out of space, causing PostgreSQL to
enter recovery mode. Its final isolated rerun on D passed backup/restore,
crash/restart, preserved history and non-synthetic refusal. Those earlier
environment and harness-configuration failures remain in verification history.
The coverage manifest recorded 1,551 tests passed at 92.98% lines. No hosted CI
run exists for this unpushed branch.

The consolidated acceptance manifest records **28 distinct lanes passed**, with
repeated runs excluded from unique test counts. The final secret scan checked
30 changed/untracked files, generated artifacts, 46 validation logs, staged and
new-commit content, and all reachable history against the existing credential
values in memory. It reported zero findings; a preexisting fabricated JWT
negative-test literal was manually identified. No raw credential values were
printed or committed. Original incident artifacts remain unchanged.

Independent QA reproduced the 31-test offline set and found no functional
security boundary defect. It also recorded limits: the fixture journal does not
fsync its directory entry, its key custody is fixture-supplied, and reopening a
journal is read-only. The Unicode fixture was corrected to use explicit
Vietnamese and emoji code points, and rerun successfully after that edit.

## Gates and next step

- Gate A: **PASS (local)**; hosted CI is separate and has not run for this branch.
- P1: bounded read target **PASS** from prior R4.13.2 evidence.
- P2: bounded pagination **PASS** for observed offsets; full completeness remains
  **UNKNOWN**.
- P3: **SEND_UNRESOLVED / MANUAL_REVIEW**.
- P4: **NOT TESTED**.
- P5: **NOT VERIFIED**.
- Gate B: **CONDITIONAL**.
- Gate C: **NOT READY**.

Any future live-send proposal requires a fresh Owner-reviewed plan after this
incident is closed. It must include a pre-send readback, exact native target
binding, corrected UTF-8 transport, explicit response parsing, readback, and a
no-retry rule for any ambiguous result. This branch is local only: no push,
merge, deployment, or real-data ingestion was performed.
