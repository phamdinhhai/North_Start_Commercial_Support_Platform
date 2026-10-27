# PH4 — Pancake Sync (P1, flagged OFF)

**Phase:** PH4 · **Gate trước:** PH0 spike verdict (Q-03/Q-04) + PH3 durable · **Gate sau:** L3 (loop manual hoàn chỉnh, không bị chặn bởi Pancake)
**Trạng thái:** Planned chi tiết — chưa bắt đầu code
**Thời lượng:** 1–2 tuần (có thể song song PH5 sau khi PH3 T3-02 migration xong)
**P flag:** P1 — feature-flag OFF mặc định; manual/synthetic không bị chặn bởi Pancake lỗi (I-11, ADR-003)
**BLOCKED-BY:** Q-03 (API accessible/filter), Q-04 (webhook semantics) — spike PH0 phải chốt verdict; ADR-003
**Phạm vi:** R-05, R-06, R-26, R-27 · C-05, C-09, C-11

## Mục tiêu

- Pancake read-only ingestion (conversations/messages/customers) → versioned envelope (C-05, C-11).
- Idempotent ingestion đúng semantics QA-10: tách event ID/version bất biến khỏi record ID.
- Checkpoint tách biệt (separate cursor, không gộp vào canonical state).
- Redaction: PII/token không vào logs/telemetry (INTEGRATION_PRINCIPLES §6).
- Flag OFF → không có Pancake API calls; flag ON → envelope+hash+checkpoint đúng QA-10.

## Out of scope

- Pancake sending (deferred).
- Webhook real-time nếu semantics chưa verified — giữ polling spike, không block manual loop.
- Generic connector framework — defer (ARCHITECTURE_CONSTITUTION §2, change seam #9).
- R-40 channel gateway per-channel — không mở rộng PH4 mặc định.

## Tasks

| ID | Task | R | C | AC / Output | Lưu ý |
|---|---|---|---|---|---|
| T4-00 | Re-verify spike Q-03/Q-04 live + ghi verdict (Gate trước PH4) | R-26, R-27 | C-05, C-11 | `docs/implementation-plan/spike/pancake-verdict.md` (API paging/auth + webhook semantics/payload shape) | **Quyết định 2026-10-02: 2-A — engineering tự chạy spike live** (cần credential/fixture thật); nếu không accessible → giữ flag OFF, manual loop đủ (ADR-003) |
| T4-01 | Pancake adapter read-only (fetch conversations/messages/customers) — encrypted credential per-workspace, server-side | R-26, R-27 | C-05, C-11 | `product/src/adapters/pancake/pancake-adapter.ts` + test flag OFF → 0 API calls | I-11 boundary, không inherited semantics; reuse `ManualAdapter` pattern (envelope+idempotency) |
| T4-02 | Envelope mapping + raw preserve + hash — mapping lỗi giữ raw, không fabricate | R-05, R-26 | C-11 | mapping test với fixture Pancake anonymized | I-12 |
| T4-03 | Idempotency đúng QA-10: same event/version+payload → no-op; update hợp lệ → append raw version; same event/version khác payload → conflict/quarantine; không đoán thứ tự khi thiếu version contract | R-06, R-26 | C-05, C-06 | idempotency + quarantine test | Spec draft BR-05/AC-02; khoá chống trùng phải bao gồm `(workspaceId, connection, externalRecordId)` có tách cấu trúc an toàn (tránh va chạm ký tự phân cách — P1-1) + version tách riêng |
| T4-04 | Checkpoint/cursor store tách biệt | R-26, R-27 | C-09 | `product/src/infra/checkpoint/` — cursor không gộp canonical state | — |
| T4-05 | Redaction PII/token trong logs/telemetry | R-27 | C-12, C-05 | redaction test | INTEGRATION_PRINCIPLES §6; QA-38 |
| T4-06 | Feature flag wiring OFF mặc định + manual fallback | R-26, R-27 | C-07 | flag test + E2E manual loop vẫn pass khi flag OFF | — |

## Test

- Flag OFF/ON, mapping với fixture, idempotency no-op vs quarantine, checkpoint tách biệt, redaction.
- Coverage ≥80% line, 100% redaction.

## DoD

- [ ] Flag OFF → không có Pancake API calls (test)
- [ ] Flag ON → envelope+hash+idempotent+checkpoint đúng QA-10 (test)
- [ ] Mapping lỗi giữ raw, không fabricate (I-12)
- [ ] Redaction test pass
- [ ] Canonical unchanged; forbidden paths untouched

## Rủi ro

| Rủi ro | Mitigation |
|---|---|
| Pancake API không accessible | Flag OFF; manual/synthetic fallback (I-11, ADR-003) |
| Payload shape đổi | Envelope versioned; mapping error preserve raw, không fabricate |

## Liên kết

- Tổng quan kế hoạch & kiểm chứng: `../05-phase-map.md`, `../08-verification.md`
- QA: QA-07, QA-10 · Spec draft: BR-05, AC-02 · Invariants: I-11, I-12 · Open: Q-03/Q-04
