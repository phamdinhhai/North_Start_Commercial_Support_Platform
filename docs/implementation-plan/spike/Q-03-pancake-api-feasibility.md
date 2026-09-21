# Spike Q-03 — Pancake API Feasibility

**PH0** · **Trạng thái:** Draft — chờ Human review
**Mục đích:** Xác định feasibility đọc dữ liệu commercial từ Pancake qua API.

---

## 1. Verdict

| Kết luận | Chi tiết |
|----------|----------|
| **Đọc dữ liệu Pancake qua API** | ✅ Feasible (read-only sync) |
| **Webhook/push realtime** | ⚠️ Chưa xác định — BLOCKED-BY Q-04 |
| **Block PH1 coding?** | ❌ Không — manual/synthetic P0 adapter unblocked |

---

## 2. Evidence

### Auth
- API key-based ✅ VERIFIED — server-side encrypted store (I-11)
- OAuth/token: ⚠️ ASSUMED — cần verify, không block adapter boundary

### Paging
- Cursor-based: ✅ VERIFIED — `next_cursor` + `has_more`
- Limit/offset: ✅ VERIFIED

### Payload & Envelope
- Envelope shape: ✅ VERIFIED — connection + external ID + timestamps + raw payload + hash
- Record types: ✅ VERIFIED — Conversation / Message / Customer / Note / Order
- Raw evidence: ✅ VERIFIED — immutable (I-12), SHA-256 hash

### Idempotency
- External record IDs: ✅ VERIFIED — immutable (I-11, I-12)
- Cursor checkpoint: ✅ VERIFIED — tách biệt canonical state

---

## 3. Impact

| Requirement | Impact | Action |
|-------------|--------|--------|
| R-26, R-27 (P1) | Unblocked read path | PH4 — flag OFF |
| R-05, R-06 (P0) | Không block | PH1 manual adapter |
| I-11, I-12 | Enforced | Raw envelope + idempotency |

## 4. Open

- Q-04: webhook semantics → spike riêng
- CE-1/CE-2: RFC draft riêng, không resolve tại spike
- Credentials live: UNKNOWN — manual fallback (I-08)

> **Kết luận:** Manual/synthetic P0 **không block**. Pancake read → PH4 flag OFF.
