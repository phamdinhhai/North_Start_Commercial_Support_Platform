# Owner Sign-Off Package — Release Baseline `f61ceee` (PR #5 -> `main`)

**Date:** 2026-11-27
**Repository Owner:** Phạm Đình Hải
**Target Pull Request:** PR #5 (`exec/r4163-acceptance` -> `main`, state `OPEN`, `mergeStateStatus: CLEAN`, 492 commits, 1,082 files changed, `+79,909 / -242`)
**Exact Release Baseline SHA:** `f61ceee22f8df8cc0dc3ffd8db3423d79630aecd` (`f61ceee`)
**Merge-Base (`main`):** `5d6c20673218f02c0972263126e8654eadee18c9` (`5d6c206`)
**Hosted CI on `f61ceee`:** PASS — `CI / release gate` runs `45937217235` (`pull_request`) and `45937211670` (`push`), all 3 jobs `SUCCESS` (`product`, `React frontend build and contract`, `Browser operator workflow`). Prior candidate `703cce7a4978cba8bb887da745d2532818590f9c` also passed runs `45932612513` / `45932607599`.
**Package Status:** `PENDING_OWNER_MERGE_SIGN_OFF` · **Production / Live Provider Authorization:** `NO (DENIED / SEPARATE GATE)`

---

## 1. Approval Boundary: Merge Authorization vs. Production / Provider Authorization

Signing off this package authorizes **code/documentation consolidation of PR #5 (`f61ceee`) into `main` only**. It explicitly **does not** authorize production deployment, live customer data ingestion, external provider calls, or outbound capability activation.

| Authorization Track | Covered by This Sign-Off? | Scope & Enforcement | Blocking Conditions |
|---|---|---|---|
| **Track A — PR #5 Merge into `main`** | **YES (requested)** | Merges R2–R4.16.3 code, migrations `008`–`024`, owner-approved canonical supersession (`bd4ee87`, ADR-005..008), ADR-009, and verification/ops reports into `main` as default-OFF / synthetic-only foundations + local/CI-verified LVP loop. | Owner confirmation of Sections 2, 3, and 4 below; PR #5 review approval; PR description populated. |
| **Track B — Production / Real-Data / Live Provider Enablement** | **NO (explicitly excluded)** | Live OIDC IdP, external KMS/HSM custody, real customer PII, live Pancake/Meta/Ads/POS calls or webhooks, outbound governed actions, research-capture storage in pilot/prod. | Blocked by R3 `OAR-01`..`OAR-12` (`docs/reports/r3-operational-hardening-2026-11-27/owner-action-required-register.md`), Gate O/P evidence (`operational-gate-matrix.md`), PH4 provider spike verdict, and per-capability ADR-007 decision records. |

---

## 2. Canonical Supersession Review (ADR-005..008, Commit `bd4ee87`)

PR #5 carries commit `bd4ee87197a1c37a429aca6353d0169562c2ab11` (`2026-11-18`), which applied owner-approved supersessions to three files under `docs/canonical/` (`+31 / -9` lines total):
- `docs/canonical/OPEN_DECISIONS.md` (`+21 / -6`)
- `docs/canonical/COMMERCIAL_EVENT_MODEL.md` (`+9 / -2`)
- `docs/canonical/IDENTITY_MODEL.md` (`+1 / -1`)

**Unchanged normative guardrails:** Frozen invariants `I-01`..`I-12` are untouched. Historical rows in `OPEN_DECISIONS.md` are retained verbatim with dated supersession prefixes and a supersession log. **Remaining OPEN canonical decisions:** `CE-1` (state machine/transition table), `ID-1` (identity merge thresholds/undo), `ID-2` (Twenty/external CRM schema mapping). Also accepted outside `docs/canonical/`: `ADR-009` (keyed workspace HMAC content digests, no browser body digests, no raw frame retention by default).

### 2.1 Before / After, Rationale, Evidence, and Implications

| Decision / ADR | Before (`main` @ `5d6c206`) | After (`f61ceee` via `bd4ee87`) | Rationale & Supporting Evidence | Security / Operational Implications | Residual Risks & Revisit Triggers |
|---|---|---|---|---|---|
| **CE-2** -> `ADR-005` (`COMMERCIAL_EVENT_MODEL.md` §2, `OPEN_DECISIONS.md`) | `CE-2` OPEN. Ambiguous whether `CommercialEvent` is inferred-only or generalized for observed/claimed/imported facts; implementations forbidden to assume either. | *Commercial Assertion* umbrella with two typed kinds: `CommercialEvent` = `inferred` only (I-04 pipeline: draft, confidence, evidence); `AssertionEnvelope` = `observed \| claimed \| imported \| user_confirmed`. Technical records (receipts, enrollments, telemetry, audit, action lifecycle) are not assertions. AI action proposals require a same-workspace draft CE + ≥1 evidence pointer (`EVIDENCE_REQUIRED`); verified action outcomes emit `observed` `AssertionEnvelope` only and never directly mutate Commercial State. | Preserves I-03/I-04 boundary between AI inference and observed facts while unifying provenance/audit. **Evidence:** `docs/reports/r2-2026-11-18/architecture-canonical-review.md` (R2-P-01/02, A-M2); `docs/reports/r3-2026-11-18/final-architecture-review-2026-11-19.md` (`action-evidence.ts`, `action-outcome-assertion.ts`); durable outbox in migrations `014`/`017`. | Prevents AI from bypassing CE/evidence pipeline or auto-mutating Commercial State. Outbox/delivery (`A-03`) is implemented and synthetic-tested, but has no production alert/SLO or on-call owner yet. | `CE-1` remains OPEN (no canonical transition table). `A-02`/`A-03` remain Gate O/P BLOCKED for real data. Revisit when RFC `CE-1` closes or Gate L3/L4 needs a new assertion kind. |
| **PM-1** -> `ADR-006` (`IDENTITY_MODEL.md` §6, `OPEN_DECISIONS.md`) | `PM-1` OPEN. Only single Lead-scoped Sales sentence canonicalized; manager/admin/viewer boundaries and principal/membership lifecycle unenumerated. | Frozen capability matrix over existing 4 base roles (`admin`, `manager`, `sales`, `viewer` — no new roles). `sales` = assigned/active-recipient lead scope (I-09); `viewer` = read-only same scope; `manager` = supervisory scope (workspace in LVP, team-narrowable later); `admin`-only = membership, connector enrollment, export/delete, high-risk actions, kill switch. Internal UUID principal (`platform_user`) mapped from `external_identity(issuer, subject)`; revoke-terminal, append-audited membership; IdP claims never grant commercial roles. | OIDC + membership (`010`) made real principals reachable; explicit matrix eliminates silent privilege expansion and IdP lock-in. **Evidence:** `docs/reports/r2-2026-11-18/{iam-membership.md,enrollment-issuance.md,architecture-canonical-review.md}` (R2-P-05..08, A-M5/M6); `docs/reports/r3-2026-11-18/final-architecture-review-2026-11-19.md` (A-01 viewer fix); `703cce7` (viewer/demo denial on feedback/telemetry + admin/manager telemetry scoping); Playwright & HTTP RBAC tests. | Deny-by-default server-side authorization; revoke takes effect on next request; token TTL ≤ 15m; issuer-secret enrollment fail-closed outside local/test. No production IdP, multi-instance session store, or emergency revocation drill verified yet (`OAR-09`). | Manager scope is workspace-wide until `Team` entity exists. `OAR-09`/`OAR-10` (prod IdP, distributed rate-limiting/WAF) remain OPEN. Revisit at Gate L3/L4 or when adding `Team`/new roles. |
| **LG-1** -> `ADR-007` (`OPEN_DECISIONS.md`) | `LG-1` OPEN. Sequencing tension between 5-engine North Star vision and minimal LVP continuity loop; risk of platform foundations becoming silent outbound product scope. | Two-layer scope: active product = LVP continuity loop only; 5-engine vision = long-term reference. Foundations allowed only if flag-off, synthetic/contract-tested, no Commercial State writes, no live external mutations. Outbound/consequential capabilities exist only in test fixtures; production catalog is empty (deny-all). Real-data enablement requires per-capability decision record (provider rights, readback contract, ADR-006 risk class, kill switch, rollback) after PH4 verdict. | Prevents scope drift and unauthorized provider automation while allowing hardened foundation work. **Evidence:** `docs/reports/r2-2026-11-18/architecture-canonical-review.md` (A-M3, R2-P-03); `capability-catalog.ts` (empty prod catalog); migration `011` seeds zero capabilities; `018`/`022`/`023` constrained to synthetic routes/modes; `verification.json` (`providerCalls: 0`, `providerMutations: 0`). | Hard fail-closed boundary against live provider writes and reverse-engineered protocols (research-only unless written provider authorization artifact exists). | Risk of future drift if flags/catalog are modified without an ADR-007 decision record (`OAR-12`). P3 remains `SEND_UNRESOLVED`, P4 `NOT_TESTED`, P5 `NOT_VERIFIED`. Revisit at Gate L5 or PH4 verdict. |
| **MM-1** -> `ADR-008` (`OPEN_DECISIONS.md`) | `MM-1` OPEN. No canonical attribution model, credit split, or conversion-export rule; LVP keeps Revenue Attribution `UNKNOWN`. | Three separated layers (I-02): provider facts ≠ normalized observations ≠ commercial evidence. Versioned, append-only multi-model `AttributionRecord`. Post-LVP default = *last qualifying touch* (30-day configurable window) alongside *first touch*; UI states model credit ≠ causation. Only `corroborated` outcomes count toward revenue (`Won` claim stays separate). LVP retains `Revenue Attribution = UNKNOWN`. Conversion export (CAPI/TikTok/Google Data Manager) stays disabled and high-risk admin-gated (ADR-006/007). | Protects metric integrity by keeping provider conversions separate from canonical evidence and avoiding premature attribution engine work in LVP. **Evidence:** `docs/reports/r2-2026-11-18/architecture-canonical-review.md` (R2-P-04, A-M3); no attribution engine built in LVP; `commercial-journey-status.md` & browser tests verify `UNKNOWN/UNVERIFIED` display. | Blocks unconsented or uncorroborated conversion uploads; prevents provider restatements from overwriting commercial truth. | No corroborated-outcome pilot dataset exists yet; conversion export remains unbuilt/disabled. Revisit after ≥1 pilot with corroborated outcomes or provider/consent policy change. |

### 2.2 Precise Canonical Approval Scope

- **Approved for merge into `main`:** Exact diffs in `bd4ee87` across `docs/canonical/OPEN_DECISIONS.md`, `docs/canonical/COMMERCIAL_EVENT_MODEL.md`, and `docs/canonical/IDENTITY_MODEL.md`, plus `ADR-005`..`ADR-009` in `docs/implementation-plan/decisions/` and registry validation updates (`product/scripts/registry-validation.mjs`).
- **Explicitly NOT approved / unchanged:** No changes to `I-01`..`I-12`; no resolution of `CE-1`, `ID-1`, or `ID-2` (`OAR-13` guardrail).

---

## 3. Database Migrations Confirmation (`008`–`024`)

PR #5 adds **17 paired SQL migrations** (`008` through `024`, 34 files, `+936` lines; zero edits to `001`–`007`). All migrations are additive or guard-hardening, carry matching `.down.sql` rollbacks, and were exercised on clean disposable PostgreSQL in CI (`product` job on `f61ceee`, 31 integration suites / 169 tests / 0 skips at acceptance checkpoint) and in the 19-table logical restore rehearsal (`product/scripts/restore-rehearsal.mjs` + `restore-rehearsal.test.mjs`).

| Migration | Primary Objects / Schema Change | Governance & Safety Posture |
|---|---|---|
| `008_integration_receipts` | `integration_enrollment`, `integration_receipt` | Experimental research observations only; zero FKs into commercial truth. |
| `009_work_completion_provenance` | `ALTER TABLE pilot_work_item` (`declaration`, `confirmed`) | Additive nullable columns (I-05/I-12); legacy `NULL` = unknown. |
| `010_workspace_membership` | `platform_user`, `external_identity`, `workspace_membership`, `membership_audit` | ADR-006: internal UUID principal, 4 existing base roles only, revoke-terminal, DELETE blocked, audited grants/revokes. |
| `011_governed_actions` | `governed_action_proposal`, `governed_action_event`, projection/audit tables | ADR-005/006/007: storage only; **seeds zero capabilities**; append-only events; no live executors. |
| `012_content_digest` | `ALTER TABLE commercial_envelope` (`raw_payload_digest` JSONB + CHECK) | ADR-009: additive keyed `hmac-sha256-v1` metadata (`algorithm_version`, `kid`, `value`); historical rows untouched. |
| `013_pilot_closure` | `pilot_context_revision`, `pilot_closure_command` | Additive LVP workflow history and idempotency ledger; workspace-scoped FKs. |
| `014_assertion_delivery` | `assertion_outbox` | ADR-005 / A-03: transactional outbox for observed action assertions; research/synthetic scheduler only. |
| `015_data_lifecycle` | `data_lifecycle_policy`, `data_lifecycle_preview` | Planning metadata only; no automated erasure, canonical mutations, or default schedule. |
| `016_contact_attempt` | `pilot_contact_attempt`, unique index `contact_envelope_workspace_key` | Claimed manual contact history (`acquisition_mode='claimed'`); no canonical state transitions. |
| `017_assertion_ops` | Expanded `assertion_outbox.last_error` CHECK + `assertion_delivery_audit` (immutable triggers) | A-03 operational replay/stop audit trail; append-only enforced via DB triggers. |
| `018_source_integration` | `source_connection`, `source_native_message`, `source_receipt` | Synthetic intake only (`CHECK (route = provider || '-synthetic')`); message ID ≠ customer/lead identity. |
| `019_source_receipt_lookup_indexes` | `source_receipt_message_history`, `source_receipt_explicit_event` | Additive query performance indexes on `source_receipt`. |
| `020_source_episode_link` | `source_episode_link` | Explicit versioned `link`/`unlink`/`reject` receipt-to-episode history; does not merge identities (I-06). |
| `021_source_link_receipt_guard` | Preflight consistency check + receipt guard trigger on `source_episode_link` | Additive defense under `SHARE ROW EXCLUSIVE` lock; never repairs/rewrites existing history. |
| `022_sync_stream` | `sync_stream` | ADR-007: local offline-synthetic cursor state (`capability='synthetic-messages'`, `mode='offline-synthetic'`); no provider secrets/payloads. |
| `023_fabricated_delivery` | `fabricated_delivery`, `fabricated_delivery_attempt` | Offline signed fixture delivery ledger; no provider token or live permission. |
| `024_research_capture_receipts` | `research_capture_receipt`, `research_capture_audit`, `research_capture_failure` | ADR-009 §3 / A-04: AES-256-GCM ciphertext (`bytea`) only, immutable `expires_at <= accepted_at + 7 days`, post-expiry-only delete requiring same-TX `PURGED` audit; explicitly refuses pilot/prod; covered by 19-table `restore-rehearsal.mjs` in `f61ceee`. |

**Migration posture note:** Migrations `008`–`024` are confirmed safe for **merge into `main` and disposable local/CI PostgreSQL**. Applying them to any staging or production database requires separate operational change control, backup/PITR readiness (`OAR-06`), and external KMS custody (`OAR-01`–`OAR-04`).

---

## 4. Explicit Merge Authorization Checklist (PR #5 -> `main`)

All technical verification items below are verified against exact SHA `f61ceee` and PR #5; owner sign-off boxes remain intentionally unchecked pending repository owner action.

### 4.1 Verified Technical Preconditions (Evidence-Backed)
- [x] **Exact baseline SHA confirmed:** `f61ceee22f8df8cc0dc3ffd8db3423d79630aecd` is PR #5 HEAD (`exec/r4163-acceptance` -> `main`, `mergeStateStatus: CLEAN`).
- [x] **Hosted CI green on exact HEAD `f61ceee`:** `CI / release gate` runs `45937217235` (`pull_request`) and `45937211670` (`push`) passed all 3 jobs (`product`, `React frontend build and contract`, `Browser operator workflow`).
- [x] **R4.16.3 commercial continuity & RBAC evidence reconciled:** `docs/reports/r4.16.3-native-commercial-continuity/{final-report.md,verification.json,owner-acceptance-addendum-2026-11-26.md}` document 3 consecutive clean disposable-PG browser runs (primary journey + cross-Lead Link/Unlink/Reject), viewer/demo/foreign-workspace denials, and `703cce7` feedback/telemetry boundary hardening.
- [x] **Migration `024` restore rehearsal verified:** `f61ceee` extends `product/scripts/restore-rehearsal.mjs` to all 19 tables (including `research_capture_receipt`, `research_capture_audit`, `research_capture_failure`) and adds `restore-rehearsal.test.mjs` under `npm run test:backup`.
- [x] **Canonical integrity preserved:** Only `bd4ee87` modifies `docs/canonical/` (CE-2, PM-1, LG-1, MM-1 supersession with retained history); `I-01`..`I-12` untouched; `CE-1`, `ID-1`, `ID-2` remain OPEN.
- [x] **Zero live provider activity & fail-closed defaults:** `providerCalls: 0`, `providerMutations: 0`, production capability catalog empty, research capture disabled and refuses pilot/production.

### 4.2 Required Owner Decisions to Authorize PR #5 Merge (Track A)
- [ ] **Owner confirms canonical supersession (`bd4ee87`):** Re-affirms `ADR-005` (CE-2), `ADR-006` (PM-1), `ADR-007` (LG-1), and `ADR-008` (MM-1) diffs in `docs/canonical/` for merge into `main`, with `CE-1`, `ID-1`, `ID-2` remaining OPEN.
- [ ] **Owner confirms migrations `008`–`024`:** Accepts the 17 additive/synthetic/foundation migrations entering `main` with production DB rollout still gated.
- [ ] **Owner confirms PR #5 metadata & review:** Populates PR #5 description (currently empty) referencing this sign-off package and `f61ceee`, and records explicit GitHub review approval on PR #5.
- [ ] **Owner authorizes merge of PR #5 (`f61ceee` -> `main`):** Authorizes merge of `exec/r4163-acceptance` into `main` as synthetic/default-OFF baseline only.

### 4.3 Explicitly Deferred — NOT Authorized by Merge (Track B)
- [ ] *(Blocked — separate gate)* **External KMS/HSM & key lifecycle (`OAR-01`..`OAR-04`)** — must replace process/env keyrings before real data.
- [ ] *(Blocked — separate gate)* **Research-capture retention ownership & backup/PITR/quarantine policy (`OAR-05`, `OAR-06`)** — `RESEARCH_CAPTURE_STORAGE_ENABLED` remains `false`.
- [ ] *(Blocked — separate gate)* **On-call, durable monitoring/alerting, and incident drills (`OAR-07`, `OAR-08`, `OAR-11`)**.
- [ ] *(Blocked — separate gate)* **Production OIDC IdP, multi-instance session store, and distributed rate-limiting/WAF (`OAR-09`, `OAR-10`)**.
- [ ] *(Blocked — separate gate)* **Live provider / outbound capability admission (`OAR-12`, PH4 verdict, ADR-007 per-capability decision records)** — P3 (`SEND_UNRESOLVED`), P4 (`NOT_TESTED`), P5 (`NOT_VERIFIED`).

---

## 5. Sign-Off Record

| Field | Value |
|---|---|
| **Baseline SHA** | `f61ceee22f8df8cc0dc3ffd8db3423d79630aecd` |
| **PR / Branch** | PR #5 (`exec/r4163-acceptance` -> `main`) |
| **Approval Scope** | **Track A ONLY** (merge PR #5 into `main`; `productionAuthorization = NO`) |
| **Owner Name & Role** | Phạm Đình Hải (Repository Owner) |
| **Merge Decision** | `[ ] APPROVED FOR MERGE TO MAIN` / `[ ] HOLD (CHANGES REQUESTED)` |
| **Date (UTC)** | `YYYY-MM-DD` |
| **Production / Provider Authorization** | **EXPLICITLY DENIED** — governed separately by `docs/reports/r3-operational-hardening-2026-11-27/owner-action-required-register.md` (`OAR-01`..`OAR-12`) and `ADR-007`. |
