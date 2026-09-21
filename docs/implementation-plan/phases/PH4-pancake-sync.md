# PH4 — Pancake Sync (P1, flagged OFF)

**Phase:** PH4 · **Gate trước:** PH0 spike + PH3 durable · **Gate sau:** L3 (loop manual hoàn chỉnh)
**Trạng thái:** Draft — chưa bắt đầu
**Thời lượng:** 1–2 tuần
**P flag:** P1 — feature-flag OFF mặc định; manual/synthetic không chặn bởi Pancake lỗi
**BLOCKED-BY:** Q-03 (API accessible/filter), Q-04 (webhook semantics) — spike PH0 phải chốt verdict; ADR-003

## Mục tiêu
- Pancake read-only ingestion (conversations/messages/customers) → versioned envelope (C-05, C-11, ADR-003).
- Idempotent ingestion: `connection_key + external_record_id` → duplicate dropped với audit.
- Checkpoint tách biệt (separate cursor, không gộp vào canonical state).
- Redaction: PII/token không vào logs/telemetry (INTEGRATION_PRINCIPLES §6).

## Out of scope
- Pancake sending (deferred).
- Webhook real-time nếu semantics chưa verified — giữ polling spike, không block manual loop.
- Generic connector framework — defer (ARCHITECTURE_CONSTITUTION §2, change seam #9).

## Tasks
| ID | Task | R | C | Output |
|----|------|---|---|--------|
| T4-01 | Pancake adapter: connection + auth + fetch (read-only) | R-26, R-27 | C-05, C-11 | `src/adapters/pancake/pancake-adapter.ts` |
| T4-02 | Envelope mapping + raw preserve + hash | R-05, R-26 | C-11 | mapping test |
| T4-03 | Idempotency + duplicate audit | R-06, R-26 | C-05, C-06 | `idempotency.test.ts` |
| T4-04 | Checkpoint/cursor store tách biệt | R-26, R-27 | C-09 | `src/infra/checkpoint/` |
| T4-05 | Redaction (logs/telemetry) PII/token | R-27 | C-12, C-05 | redaction test |
| T4-06 | Feature flag wiring (OFF mặc định) + manual fallback | R-26, R-27 | C-07 | flag test |

## Risks
| Risk | Mitigation |
|------|-----------|
| Pancake API không accessible | Flag OFF; manual/synthetic fallback (I-11, ADR-003) |
| Payload shape đổi | Envelope versioned; mapping error preserve raw, không fabricate |

## DoD
- [ ] Flag OFF → không có Pancake API calls (test)
- [ ] Flag ON → envelope + hash + idempotent + checkpoint tách biệt (test)
- [ ] Redaction test pass
- [ ] Canonical unchanged; forbidden paths untouched
