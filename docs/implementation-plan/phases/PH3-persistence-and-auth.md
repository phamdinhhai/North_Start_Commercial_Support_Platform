# PH3 — Persistence & Auth

**Phase:** PH3 · **Gate trước:** L2 (PH2 domain verified) · **Gate sau:** L2→L3 (persistence durable)
**Trạng thái:** Đang code — P0 slice đã kiểm chứng trên PostgreSQL 16 thật (migrations 001–004). T3-01/02/05/08 `[✓DB]`; T3-03/04 `[✓code][✓live]` (401/403/404 verify qua HTTP, chưa phải APP_GUARD toàn cục); T3-06/07 mới `[✓code]` (chưa wire endpoint). **Chưa đóng Gate L2→L3:** kiểm định HTTP độc lập 2026-10-27 tại `1b72b61` xác nhận 3 cạnh P1 còn mở (**P1-1** dấu `:` trong `idempotencyKey`, **P1-2** kiểm quyền accept/complete theo từng work item + giữ quyền view cho recipient có work item mở, **P1-4** không dùng tin nhắn intake `sourceEnvelopeId` hay `absent`/`conflicted` để đóng work item), cộng optimistic locking chưa làm và telemetry/feedback chưa nối luồng. Chi tiết: `state/progress.md`, `08-verification.md`, `docs/reports/project-status-and-handover.md`.
**Thời lượng:** 2–3 tuần
**Phạm vi:** R-01, R-02, R-03, R-18, R-21, R-22, R-23 · C-03, C-04, C-06, C-07, C-08, C-12
**Ranh giới:** Chỉ app/data plane. R-29…R-41 (control plane, licensing, installer, backup/restore P2) KHÔNG thuộc PH3 — giữ `proposed`, cần human gate trước khi promote.

## Mục tiêu

- PostgreSQL durable cho pilot workspace: data sống qua restart, forward migrations + rollback đã test (R-18).
- Auth + RBAC: authenticate non-demo, authorize theo workspace + role + lead scope (I-09, frozen boundary). Không tự phát token từ email/workspace caller gửi.
- Workspace isolation ở DB: mọi query scoped `workspace_id` server-derived (QA-32).
- Telemetry nền tảng: ProductEvent tag `releaseVersion` + flag exposure; feedback tách telemetry (R-21…R-23).

## Kiến trúc & tài liệu cần cập nhật

- `product/docker-compose.yml` (hoặc `product/docker-compose.dev.yml`): Postgres 16 (+ pgvector nếu cần RAG sau), volume, healthcheck; `.env.example` không chứa secret.
- `product/migrations/` + runner (`product/src/infra/postgres/migrator.ts`, chạy cặp `NNN_name.up.sql` / `NNN_name.down.sql` với `pg_advisory_xact_lock` + kiểm tra lại `schema_migrations` trong cùng transaction).
- Module wiring theo pattern hiện có (`src/app.module.ts` + `HealthModule`): `src/infra/postgres/`, `src/infra/auth/`, `src/infra/rbac/`, `src/infra/telemetry/`, `src/modules/feedback/`. Reuse `WorkspaceStore` contract nhưng thay in-memory bằng PG ở PH3.
- `product/README.md`: cách chạy `docker compose up -d`, chạy migration, seed bootstrap.

## Tasks

| ID | Task | R | C | AC / Output | Lưu ý QA/spec / invariant |
|---|---|---|---|---|---|
| T3-01 | Postgres setup + connection pool + docker-compose dev | R-18 | C-03 | Pool khởi động, `SELECT 1` pass, restart giữ data; README ghi cách chạy | Tối thiểu 2–4 vCPU/4GB trong SERVICE_MODEL là ước lượng dev, không hardcode prod threshold |
| T3-02 | Migration v1: `workspace`, `customer`, `lead` (stable ID I-07), `handoff`, `commercial_event`/`assertion` (provenance I-04/I-05), `outcome` (`supersedes` QA-24), `audit`/`outbox`, `envelope` pointer+hash (I-12), unknown states (I-08) | R-18, R-07, R-11, R-16, R-19 | C-03, C-06 | `migrations/001_domain.sql` + test forward; schema khớp `spec draft §7 data contract` | Lead ≠ Customer (I-01) riêng bảng; attribution mặc định UNKNOWN (MM-1); 5 truth states distinct, không null (QA-36) |
| T3-03 | Auth middleware — tách demo vs non-demo, reject unauthenticated, không phát token từ `email/workspaceId` caller gửi | R-02 | C-04, C-12 | Non-demo 401, demo pass; không có `POST /login {email,workspaceId}→token` | **Quyết định 2026-10-02: 1-A — bootstrap stub** (seed admin qua env one-time) để unblock RBAC; ghi `// OPEN: PM-1` cho invite/password/SSO thật (QA-28/29) |
| T3-04 | RBAC guard lead-scoped (I-09) — Sales chỉ assigned lead, Manager/Admin theo capability riêng | R-03 | C-12, C-04 | Cross-workspace 404, unassigned 404, forbidden visible action 403 (spec draft AC-03, QA-30/32) | PM-1 chưa freeze — chỉ enforce frozen boundary + deny-by-default; QA-58 thu hẹp Manager không mặc định workspace-wide |
| T3-05 | Workspace isolation ở DB — mọi query scoped `workspace_id` server-derived, không tin body `workspaceId` | R-01 | C-12 | Integration test: insert ws-a/ws-b rồi query ws-a chỉ thấy ws-a | QA-32: authority server-derived |
| T3-06 | ProductEvent telemetry — tag `releaseVersion` + flag exposure | R-21, R-22 | C-08, C-07 | Event có `releaseVersion`+flag, feedback tách riêng | QA-36/38: redact PII/token, không gửi chat/evidence/learner data |
| T3-07 | Structured feedback repo — có `leadId` + action context, tách telemetry | R-23 | C-08 | Feedback query tách telemetry | — |
| T3-08 | Migration rollback verified + seed/restore smoke | R-18 | C-03 | `down` chạy sạch, re-`up` pass, restart test | Migration rollback ≠ backup/restore (R-35) — ghi rõ trong docs |

## Test

- Unit: auth guard, RBAC matrix (deny-by-default + lead-scoped), workspace scoping.
- Integration: PG start/stop, migration forward/back, cross-workspace isolation, audit append atomic.
- Coverage ≥80% line, 100% auth/RBAC/redaction.
- Verify: `npm --prefix product ci && npm run typecheck && npm test && npm run build` + `docker compose up -d` + migration forward/back test.

## DoD

- [ ] Postgres durable sau restart; rollback đã test
- [ ] Unauthenticated non-demo 401; Sales không thấy lead ngoài assignment (I-09)
- [ ] Mọi query scoped `workspace_id` server-derived
- [ ] Telemetry tag `releaseVersion`+flag; feedback tách telemetry
- [ ] `npm ci && npm run typecheck && npm test && npm run build` pass

## Rủi ro

| Rủi ro | Mitigation |
|---|---|
| Tự phát token/login từ email/workspace | Chỉ bootstrap one-time, ghi seam PM-1, không implement invite/SSO thật trước RFC |
| Tự mở rộng PH3 bằng R-29…R-41 | Giữ `proposed`, không đưa vào milestone PH3 |
| Migration rollback nhầm với backup/restore | Ghi rõ rollback ≠ R-35 backup/restore; backup/restore là phase sau |

## Liên kết

- Tổng quan kế hoạch & kiểm chứng: `../05-phase-map.md`, `../08-verification.md`, `../../reports/project-status-and-handover.md`
- QA: QA-28…32, QA-36/38, QA-58 · Spec draft: §7 data contract, AC-03 · Invariants: I-01, I-07…I-09, I-12 · Open: PM-1
