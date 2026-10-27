# Spike Q-03 — Pancake API Feasibility

**PH0** · **Trạng thái:** Draft — mới đối chiếu trên **tài liệu KB snapshot**, **chưa** kiểm chứng live với dịch vụ Pancake thật (`T4-00` trước PH4)
**Mục đích:** Xác định feasibility đọc dữ liệu commercial từ Pancake qua API.

---

## 1. Verdict

| Kết luận | Chi tiết |
|----------|----------|
| **Đọc dữ liệu Pancake qua API** | 📄 KB-SNAPSHOT (cần re-verify live ở `T4-00` trước khi bật PH4) |
| **Webhook/push realtime** | ⚠️ Chưa xác định — BLOCKED-BY Q-04 |
| **Block PH1 coding?** | ❌ Không — manual/synthetic P0 adapter unblocked |

---

## 2. Evidence (từ KB snapshot — chưa verify live)

### Auth
- API key-based 📄 KB-SNAPSHOT — server-side encrypted store (I-11); cần live verify tại `T4-00`
- OAuth/token: ⚠️ ASSUMED — cần verify, không block adapter boundary

### Paging
- Cursor-based: 📄 KB-SNAPSHOT — `next_cursor` + `has_more` (cần live verify)
- Limit/offset: 📄 KB-SNAPSHOT

### Payload & Envelope
- Envelope shape: ✅ DESIGNED IN DOMAIN — `(workspaceId, connection, externalRecordId)` + timestamps + raw payload + hash
- Record types: 📄 KB-SNAPSHOT — Conversation / Message / Customer / Note / Order
- Raw evidence: ✅ ENFORCED IN DOMAIN — immutable (I-12), SHA-256 hash

### Idempotency
- External record IDs: 📄 KB-SNAPSHOT — giả định immutable phía Pancake (I-11, I-12); cần live verify
- Cursor checkpoint: ✅ DESIGNED — tách biệt canonical state

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
