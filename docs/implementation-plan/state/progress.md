# Progress Tracker

**Updated:** 2026-10-07
**Mode:** Build — PH1 + PH2 code reported done; PH3 persistence verified on real PostgreSQL 16; pilot-loop P0 flow running live (in-memory).
**Problem framing:** `docs/Dinh_nghia_bai_toan_V2.md` (2026-10-06) is a problem-definition and validation-plan source, not a frozen product/domain specification; see `discovery/v2-validation-and-traceability.md`.
**Sources:** `docs/implementation-plan/discovery/2026-10-01-qa.md` (QA-01…59), `discovery/2026-10-01-specification-draft.md`, `discovery/v2-validation-and-traceability.md`, `discovery/q3-annotation-guide.md`, `discovery/q4-provenance-time-mapping.md`, `discovery/q3-q4-synthetic-scenarios-edu-b2c.md`, `03-requirements.md` (R-01…R-41), `SERVICE_MODEL.md`, `state/features.json`
**Code evidence (2026-10-07):** `product/` — `npm run typecheck` exit 0; `npm test` exit 0 (**177 passed / 2 skipped**, 21 files; skip = PG integration when `TEST_DATABASE_URL` absent); `npm run build` exit 0. With real PostgreSQL 16 (docker compose, host :55432): integration 2/2 pass, `migrate:up`/`migrate:down`/re-`up` exit 0, data survives container restart. Pilot loop additionally verified live via `scripts/pilot-smoke.sh` against `node dist/main.js` (13 steps).

> **Evidence boundary:** V2 H1–H8 and numeric thresholds are proposed validation hypotheses, not empirical results or industry benchmarks. QA-01…59/spec draft are intent/proposal records, not frozen requirements. R-29…R-41 remain proposed/deferred and do not expand PH3. CE-1/CE-2/PM-1/MM-1/ID-1/ID-2/LG-1 remain open; no canonical decision is resolved by V2.

---

## PH0 — Spike & Research
- [x] T0-01: Q-03 spike (Pancake API docs + auth + paging) — spike docs có, cần re-verify live trước PH4
- [x] T0-02: Q-04 spike (webhook semantics + payload) — như trên
- [x] T0-03: Envelope schema v1 draft — `domain/envelope` đã implement + test (12 tests)
- [x] T0-04: RFC CE-1 + CE-2 draft — ADR-001 interim hypothesis (Gate #A đã fix citations 51f9732)
- [x] T0-05: Synthetic/manual adapter spec — `adapters/manual` (7 tests), synthetic demo path có
- [x] T0-06: Human Gate #A — citations CE-2/PM-1 đã sửa; CE-1/CE-2 vẫn interim, cần RFC chốt trước khi freeze state machine

**Kết luận PH0:** Spike + envelope đủ để không block PH1/PH2; Pancake feasibility (Q-03/Q-04) vẫn BLOCKED-BY cho PH4.

## PH1 — Walking Skeleton
- [x] T1-01: package.json + tsconfig — Node 22, TS, Vitest
- [x] T1-02: NestJS shell + Fastify adapter — `app.module.ts`, `main.ts`
- [x] T1-03: Health endpoint — `health.controller` + test (3 tests)
- [x] T1-04: Lead entity (stable ID) — `domain/lead/lead.ts` + `lead.spec` (13 tests)
- [x] T1-05: Handoff entity — `domain/handoff` (7 tests)
- [x] T1-06: Manual adapter shell — `adapters/manual` (7 tests), raw preserved, no fabrication
- [x] T1-07: Workspace isolation shell — `infra/workspace` (10 tests), synthetic segregation
- [x] T1-08: npm ci/typecheck/test/build pass — pass 2026-09-22 (132 tests)

**Gate L1:** Comprehension — smoke health + domain shell + workspace isolation shell → **đạt (code).**

## PH2 — Domain & Events
- [x] T2-01: Lead entity + state — `lead`, `lead-state` (18 tests), transitions append-audited, interim CE-1
- [x] T2-02: Customer ≠ Lead — `customer` (8 tests), I-01 enforced, không collapse
- [x] T2-03: Handoff entity — `handoff` (7 tests), stable Lead ID, evidence ref, audit
- [x] T2-04: CommercialEvent envelope v1 — `commercial-event` (13 tests), provenance, inferred-only interim (CE-2)
- [x] T2-05: UNKNOWN states — `unknown-states` (7 tests), 5 truth states distinct, không null
- [x] T2-06: Outcome Won/Lost/Unknown — `outcome` (7 tests), claimed + correction append-only
- [x] T2-07: Lead state machine (hypothesis) — `lead-state` interim New→Accepted→Contacting→Follow-up→Won/Lost/Unknown, reversible + audit (BLOCKED-BY CE-1, ADR-001)
- [x] T2-08: Audit/Provenance store — `infra/audit` (8 tests), append-only in-memory
- [x] T2-09: Invariant sweep tests — `domain/invariants.spec` (19 tests), mỗi I-01…I-12 ≥1 test (I-06/I-09 cần thay bằng meaningful check ở lần sweep tới — xem qa.md §10)

**Gate L2:** Vertical slice — lead lifecycle + audit + UNKNOWN visible → **code đạt, chờ human review ADR-001 + sweep I-06/I-09 meaningful.**

## PH3 — Persistence & Auth

> Cập nhật 2026-10-07, tách 3 mức trạng thái: **[✓code]** đã code + unit test · **[✓DB]** đã kiểm chứng trên PostgreSQL thật · **[pilot-ready]** đủ điều kiện cho pilot dữ liệu thật. Mức `[✓DB]` chỉ đạt khi integration test chạy (không skip) trên Postgres 16 local (docker compose, host port 55432 — port 5432 đang bị `edura-postgres` chiếm). Gate L2→L3 chỉ đóng khi `[✓DB]` VÀ auth/RBAC được gắn HTTP guard.

- [✓code][✓DB] T3-01: PostgreSQL setup — `docker-compose.yml`, `.env.example`, `PostgresService` (pool lazy, `withTransaction` rollback khi lỗi — QA-35). Kiểm chứng 2026-10-07: `SELECT 1` OK, container restart giữ dữ liệu (insert → restart → read = 1 row)
- [✓code][✓DB] T3-02: Domain migration v1 — `migrations/001_domain.{up,down}.sql`, `002_telemetry_feedback.{up,down}.sql`. Kiểm chứng: `migrate up` apply 2 migration trên DB sạch, schema 12 bảng public
- [✓code][✓DB] T3-05: Workspace isolation (DB) — `WorkspaceRepository` + `postgres.integration.spec.ts` XPASS (2/2, không skip) — cross-workspace query trả đúng ws-a. `npm run test:integration` fix glob `src/**/*.integration.spec.ts` → `vitest run integration` (glob cũ không match trên vitest 3)
- [✓code][✓DB] T3-08: Migration rollback — `migrate down` rolled back 002, re-`up` pass trên DB thật (unit + integration exit 0)
- [✓code] T3-03: Auth (1-A stub) — `AuthService`: demo header, bootstrap token, Bearer unsigned **chỉ khi `AUTH_DEV_UNSIGNED_TOKENS=true`**; không đọc workspace từ body. **CHƯA gắn HTTP guard — chưa `[✓DB]`, chưa pilot-ready.** `OPEN: PM-1`
- [✓code] T3-04: RBAC — `RbacService` lead-scoped + deny-by-default, export/delete chỉ admin (5 unit tests). **CHƯA gắn guard; AC 401/403/404 cross-workspace qua HTTP chưa test; Manager vẫn workspace-wide tạm (QA-58 chờ PM-1).** Chưa pilot-ready
- [✓code] T3-06: Telemetry — `TelemetryService` tag `releaseVersion` + `flagExposure`, bảng `product_event` (2 unit tests; wiring HTTP endpoint chưa)
- [✓code] T3-07: Structured feedback — `FeedbackService`, bảng `feedback` tách telemetry (3 unit tests; endpoint chưa)

**Verify 2026-10-07 (exit codes kiểm tra riêng, không qua pipe):** `typecheck` exit 0 · `npm test` exit 0 (19 files pass, 1 skip = integration khi thiếu `TEST_DATABASE_URL`; 169 pass / 2 skipped) · `build` exit 0 · integration có DB exit 0 · `migrate:up`/`migrate:down`/re-`up` exit 0.

**Không tự mở rộng PH3 bằng R-29…R-41** (control plane, provisioning, licensing, installer, fleet upgrade). PH3 đã duyệt vẫn là persistence/auth/RBAC/telemetry-feedback cho app/data plane.

## Pilot-loop (mới — P0 flow giáo dục B2C, in-memory + HTTP, chưa wire PG)

> `[✓live]` = chạy thật trên tiến trình Node (`node dist/main.js`, :3111), không chỉ unit test.

- [✓code][✓live] `product/src/modules/pilot-loop/pilot-loop.service.ts` (471 dòng <500) — 10 unit tests; `product/src/api/pilot-loop.controller.ts` + module — 7 tests; `scripts/pilot-smoke.sh` chạy 13 bước trên server thật.
- Luồng đã chạy thật (2026-10-07): intake (raw envelope I-12, attribution UNKNOWN MM-1, workspaceId server-derived) → handoff (work item `proposed` — gửi bàn giao ≠ nhận trách nhiệm) → accept (New→Accepted, CE-1) → reschedule khi còn mở (supersede, item cũ `rescheduled`, không còn nhắc lịch cũ) → complete `declared` (`occurredAt=unknown` — Q4 không backfill) → advance Contacting→Follow-up → outcome Won (`assertionStatus=claimed`, R-15) → GET view.
- Fail-closed đã kiểm chứng bằng HTTP status: unauthenticated → **401**; `observed` không có evidence pointer → **500**; reschedule việc đã completed → **500** (correction, không mở lại ngầm); New→Won ngoài hypothesis CE-1 → **500**.
- RBAC wiring: cùng module auth/rbac — cross-workspace 404 (QA-32/AC-03), unassigned sales 403, owner xem được (7 controller tests). **Chưa** test 401/403/404 qua PG + middleware guard toàn cục; đây vẫn là stub PM-1.
- Trạng thái: **in-memory, chưa persist PG** — data mất khi restart tiến trình; PG-backed repository cho lead/handoff/work/outcome vẫn thuộc T3-05/T3-06 wiring. Work axes (`responsibleParty`/`origin`/`completionEvidence`) là **candidate validation constructs cho Q3** — RFC-005 vẫn Draft, EXP-06 vẫn proposed; không phải canonical model.


## PH4 — Pancake Sync (P1 flagged)
- [ ] T4-01: Pancake adapter
- [ ] T4-02: Envelope mapping + raw preserve
- [ ] T4-03: Idempotency + duplicate audit
- [ ] T4-04: Checkpoint/cursor store
- [ ] T4-05: Redaction
- [ ] T4-06: Feature flag wiring

BLOCKED-BY Q-03/Q-04; flag OFF; manual fallback (QA-07/10).

## PH5 — LVP Slice Hardening
- [ ] T5-01: Queues module
- [ ] T5-02: NextAction lifecycle (QA-18/52)
- [ ] T5-03: Contact attempt/outcome (QA-19/57, BR-10/11/24)
- [ ] T5-04: Outcome Won/Lost/Unknown (correction, Won/refund phân biệt)
- [ ] T5-05: Data Health view (QA-55, AC-08)
- [ ] T5-06: Export/delete + retention (QA-47/48)
- [ ] T5-07: Structured feedback

## PH6 — Pilot & Learning
- [ ] T6-01: Pilot workspace isolation (QA-58: 1 customer → 1 deployment → 1 workspace)
- [ ] T6-02: Experiment exposure logging
- [ ] T6-03: Learning signal instrumentation (QA-55: external user L0)
- [ ] T6-04: Gate review template
- [ ] T6-05: Direction decision document (Continue/Narrow/Pivot/Stop)

---

## Discovery đã brainstorm (2026-10-01/02)

- **Q&A:** QA-01…59 trong `discovery/2026-10-01-qa.md` — phạm vi North Star, journey social-led, Lead = independent purchase decision, event/version dedup, handoff/SLA, Won/payment allocation (QA-59), Lost policy (QA-57), workspace cardinality (QA-58), expiry khóa cả read/export (QA-45), RPO≤15m/RTO≤1h (QA-53), v.v. — là biên bản ý định, không phải đặc tả freeze.
- **Spec draft:** `discovery/2026-10-01-specification-draft.md` — J-01…J-09, BR-01…26, AC-01…08, error matrix, access model proposal (PM-1), logical data contract — là đề xuất, nhiều AC/permission do assistant suy ra cần user review (QA-57…59 đã xác nhận nhưng taxonomy/schema/quyền liên quan chưa duyệt).
- **Deferred backlog:** R-29…R-41 trong `03-requirements.md` §10 (từ `SERVICE_MODEL.md` §1…3) — C-13 Control Plane / C-14 licensing dự kiến, chỉ promote sau human gate và khi chốt mode A/B, license strategy, LLM key custody, provider/data location, v.v.

## Việc tiếp theo (không tự resolve open decisions)

1. Human Gate #A/#B: RFC CE-1 (state matrix) + CE-2 (event scope) → ADR-001 supersede nếu chốt; PM-1 (manager scope theo team/branch — QA-58), MM-1/ID-1/ID-2/LG-1 giữ boundary.
2. Sửa invariant sweep: thay placeholder I-06/I-09 bằng meaningful no-auto-merge/undo và cross-workspace/reassigned/evidence checks; fix nhãn I-10/I-11 nếu còn mismatch.
3. Quyết định scope cho R-29…R-41 trước khi đưa vào phase map (mode A/B sequencing, đường build-vs-compose, license/distribution, expiry/export lock cần legal review).
4. PH3: PostgreSQL + auth + lead-scoped RBAC + workspace isolation DB + telemetry/feedback — đúng phạm vi đã duyệt.
