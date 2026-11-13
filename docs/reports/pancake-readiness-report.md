# Pancake readiness report for PH4

**Status:** `PARTIAL`
**PH4 feature flag:** `OFF`
**Prepared:** 2026-11-13
**Artifact class:** Non-canonical repository research; not a release approval or live verification record.

## Executive decision

Pancake remains a useful candidate integration, but the repository evidence does not satisfy the pre-PH4 gate. Keep the Pancake connector disabled, preserve the manual/synthetic path, and do not treat a successful private dashboard observation or a documentation snapshot as a Public API production contract.

The repository contains two distinct evidence layers:

1. The **2026-09-10 KB snapshot**: a documented map with relatively deep Pancake Public API endpoint coverage and a webhook page reference, but known gaps around event-level webhook behavior and live account eligibility.
2. The **2026-11-11 spike verdict**: a recorded historical observation of an authenticated dashboard/internal-read exploration, explicitly marked `PARTIAL`; it did not verify the Public API credential model or webhook contract and must not be generalized into a production adapter contract.

No new endpoint, credential, private endpoint, or live behavior was inspected for this report.

## Readiness matrix

| Gate area | Repository evidence | Verdict | Required before PH4 ON |
|---|---|---|---|
| Dashboard/internal read | `pancake-verdict.md` records authenticated dashboard access and sampled internal GET reads. | **Recorded historical observation; bounded** | Not sufficient for Public API enablement. Keep private dashboard endpoints out of the adapter contract. |
| Public API auth | KB documents User/Page token patterns; the later spike says the supplied credential was a cookie export and Public API token was not established. | **UNKNOWN** | Approved Public API credential for one pilot page, server-side secret handling, and a read-only permission check. |
| Conversations/messages/customer read | KB lists candidate read surfaces; historical spike records sampled internal conversation/message/customer reads. | **PARTIAL** | Exact supported Public API method/path/version and anonymized read fixtures; prove required fields for the envelope. |
| Pagination and termination | KB lists cursor/limit concepts; historical spike observed client cursor branches and sampled pages but no complete termination/stability proof. | **PARTIAL / UNKNOWN** | Exhaustive bounded paging with clear termination, ordering, checkpoint behavior and failure handling. |
| Record/event identity | Historical spike saw IDs/timestamps, but explicitly did not prove immutable event/version or replay/conflict semantics. | **UNKNOWN** | Demonstrate external record/event identity, version behavior, duplicates, updates and conflict quarantine. |
| Webhooks | KB webhook page exists; audit and Q-04 retain missing event catalog, payload, signing, retries and ordering. | **UNKNOWN** | Separate Q-04 live evidence for subscription, event payloads, signature/secret, delivery ID, retry, duplicate, out-of-order and replay behavior. |
| Rate limit and expired auth | KB records a snapshot rate limit; no full current stress/expiry verification is recorded. | **UNKNOWN** | Test bounded rate behavior, backoff, retry cap and expired/revoked credential handling without exposing secrets. |
| Redaction and raw preservation | Domain/manual adapter design requires raw immutable evidence and redaction. | **Designed / partial implementation seam** | Pancake-specific fixtures and logs proving token/PII redaction; raw hash and mapping-error preservation. |
| Idempotency and checkpoint | Generic manual envelope and checkpoint design exist; Pancake replay semantics are not proven. | **Designed / not provider-verified** | Same event/version + same payload no-op; valid update append; same identity/version with changed payload conflict/quarantine; checkpoint separate from canonical state. |
| Product/engineering gate | PH4 plan and verdict require Q-03/Q-04 plus review. | **NOT PASSED** | Product + Engineering review of the refreshed evidence and explicit flag decision. |

## Q-03 and Q-04 posture

### Q-03 — read API feasibility

Q-03 remains a **historical snapshot plus partial follow-up**, not a closed live contract. The KB snapshot says the Public API has useful endpoint coverage and the Q-03 draft says the read path is feasible for planning. The later spike adds bounded evidence about dashboard/internal reads, but it explicitly says:

- the credential was a cookie export, not a verified Public API token;
- internal dashboard auth and endpoint behavior cannot be promoted to a Public API contract;
- sampled records and fields do not prove Public API schema or channel coverage;
- pagination branches and sample responses do not establish complete cursor/`has_more` semantics;
- observed IDs/timestamps do not prove immutable event/version or replay/conflict semantics.

**Q-03 result for the PH4 gate: UNKNOWN/PARTIAL; not sufficient to turn the feature flag on.**

### Q-04 — webhook semantics

Q-04 remains **UNKNOWN**. Existing evidence says the webhook page could not be used to reliably capture a complete event catalog/schema and no subscription/receiver was created. The missing contract includes:

- subscription and account enablement;
- event names and raw payload shape by channel;
- signature/HMAC or other authenticity mechanism;
- delivery identifier and timestamp semantics;
- retry, timeout, duplicate and out-of-order behavior;
- replay/idempotency and failure/quarantine rules.

A WebSocket observed in a dashboard is not evidence of a vendor webhook contract. Until these are measured, realtime delivery stays deferred and polling/manual fallback remains the safe posture.

## Allowed implementation posture while PH4 is OFF

- Continue the manual/synthetic adapter and its immutable raw envelope, hash, workspace scope, explicit unknowns and redaction boundaries.
- Use a provider adapter only as a future read-only translation boundary; it must not define canonical Customer/Lead identity, Commercial Event meaning, attribution, revenue, or state transitions.
- Keep any future Pancake calls behind an explicit disabled-by-default flag. OFF means zero provider calls.
- Keep checkpoint/cursor state separate from canonical lead state.
- Preserve raw provider payloads and mapping errors without fabrication; quarantine identity/version conflicts.
- Do not send messages, mutate tags/assignments/settings, create orders, or rotate credentials as part of this readiness work.
- Do not use private dashboard endpoints or cookies as production integration dependencies.

## Re-verification protocol

This is the minimum evidence packet for a future T4-00 refresh. It should be performed only by an authorized operator with a disposable/test page and approved credentials; credentials and raw PII must not enter the repository.

### A. Scope and provenance

1. Record provider surface (`Public API`, not dashboard), API version, page/test tenant, region, intended read direction and date.
2. Cite the official endpoint source and record its version/permission/app-review requirements.
3. Store a redacted evidence index with `TEST_ID`, request method/path (without token), permission, response-schema hash, observed behavior, limits, result and unresolved questions.
4. Label each result `documented`, `recorded historical observation`, `live verified`, or `unknown`; do not upgrade historical observations silently.

### B. Read and paging tests

1. Read pages, conversations, messages and customer records needed for the pilot using supported Public API methods only.
2. Exercise first, middle, empty, malformed-cursor and end pages; record ordering, termination, rate responses and checkpoint boundaries.
3. Compare required envelope fields and missing values; preserve unknown rather than infer channel, owner, Lead ID or attribution.
4. Keep the sample anonymized and hash raw response fixtures; retain the raw bytes immutably in the approved evidence store.

### C. Identity, replay and conflict tests

1. Replay the same event/version and payload: expect a no-op.
2. Replay the same identity/version with a changed payload: expect conflict/quarantine, never overwrite.
3. Exercise a valid provider update/version: append the raw version and record its relationship to the current projection.
4. Test process restart and checkpoint recovery; prove cursor state is not canonical state.
5. Record missing version or ordering semantics as UNKNOWN rather than inventing an order.

### D. Webhook tests (Q-04)

1. Obtain an approved test subscription and receiver configuration.
2. Trigger inbound, outbound, comment, tag and assignment cases only where the account/channel supports them.
3. Capture redacted headers/body, delivery IDs, timestamps, status responses and latency.
4. Test signature verification, retry after controlled failures, duplicate delivery, out-of-order delivery and replay.
5. Produce a separate Q-04 verdict. If any contract dimension remains unknown, keep realtime deferred and do not enable a webhook receiver.

### E. Review and enablement

1. Run redaction and security review; confirm no token/cookie/PII in logs or telemetry.
2. Review evidence against I-08, I-11 and I-12 and the still-open canonical decisions.
3. Product + Engineering decide whether the gate is passed; record the decision, date and evidence IDs.
4. Only after approval may a narrow page-scoped read-only flag be enabled. Keep manual fallback and a kill switch.

## Refresh cadence

Refresh the official docs and the live evidence packet before each connector implementation or release, after an API version/deprecation/permission change, and whenever account/channel eligibility changes. A stale snapshot is never proof of current availability. Add a dated verification-log entry for every production connector change, including endpoint, version, permission, source URL and live-test result.

## Sources in this repository

- `docs/implementation-plan/spike/pancake-verdict.md` — historical 2026-11-11 partial spike verdict and limits.
- `docs/implementation-plan/spike/Q-03-pancake-api-feasibility.md` — original KB-snapshot Q-03 framing.
- `docs/implementation-plan/spike/Q-04-webhook-semantics.md` — webhook UNKNOWN and polling fallback.
- `docs/implementation-plan/phases/PH4-pancake-sync.md` — PH4 scope, flag-off rule, tasks and gate.
- `docs/implementation-plan/spike/manual-adapter-spec.md` — manual fallback, immutable raw envelope and idempotency design.
- `docs/external-apis/pancake/api-knowledge-base-2026-09-10/01_PANCAKE_CHAT/ENDPOINT_CATALOG.md` — documented endpoint candidates.
- `docs/external-apis/pancake/api-knowledge-base-2026-09-10/01_PANCAKE_CHAT/AUTH_RATE_LIMITS.md` — documented token/rate-limit snapshot and redaction warning.
- `docs/external-apis/pancake/api-knowledge-base-2026-09-10/01_PANCAKE_CHAT/WEBHOOK_AUDIT.md` — event/payload/signature/retry gap.
- `docs/external-apis/pancake/api-knowledge-base-2026-09-10/SCOPE_AND_COMPLETENESS.md` — catalog vs endpoint completeness and live-test rule.
- `docs/external-apis/pancake/api-knowledge-base-2026-09-10/REMAINING_GAPS.md` — webhook and account/eligibility gaps.
- `docs/external-apis/pancake/api-knowledge-base-2026-09-10/04_CROSS_PLATFORM/API_FEASIBILITY_TEST_PLAN.md` — proposed Pancake read, webhook and linkage tests.
- `docs/reports/rebuild-baseline-2026-11-12/handoff.md` — current handoff's explicit Pancake live-read unknown and PH4 flag-off posture.

## Non-claims

This report does not claim that the Pancake Public API is currently reachable, that any credential works, that a webhook can be subscribed, that a schema is stable, that a rate limit is current, or that Pancake data can be joined deterministically to Lead, customer, campaign, sales outcome, order, revenue or attribution. It does not browse private endpoints, use credentials, edit canonical documentation, or authorize live operation.
