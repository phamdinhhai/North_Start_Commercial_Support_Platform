# Spike Q-04 — Webhook Semantics (Pancake Push Delivery)

**PH0** · **Trạng thái:** Draft — BLOCKED
**Mục đích:** Xác định webhook/push delivery semantics từ Pancake — nếu fail thì polling fallback.

---

## 1. Verdict

| Kết luận | Trạng thái |
|----------|-----------|
| **Webhook delivery realtime** | ⚠️ UNKNOWN — chưa verify được contract |
| **Polling fallback** | ✅ Feasible |
| **Block PH1?** | ❌ Không — poll/manual đủ cho LVP |

---

## 2. Evidence

| Tiêu chí | Trạng thái | Ghi chú |
|----------|-----------|---------|
| Webhook subscription API | ⚠️ UNKNOWN | Chưa có live contract verified |
| Signature/HMAC verification | ⚠️ UNKNOWN | Giả định có, chưa verify |
| Retry/dedup semantics | ⚠️ UNKNOWN | Không xác định idempotency phía push |
| Polling (cursor + limit) | ✅ VERIFIED | Đủ cho PH1/PH4 `next_cursor` flow |

---

## 3. Decision cho LVP

- **Không xây webhook receiver trong PH0/PH1.** Adapter boundary (I-11) phải idempotent bất kể push hay poll.
- **Fallback mặc định: polling** — cursor checkpoint tách biệt canonical state (I-12).
- Nếu webhook contract verified sau PH0 → bổ sung `src/adapters/pancake/webhook/` trong PH4, flag OFF.

---

## 4. Open

- Q-03: đã feasible read path — không block
- CE-1/CE-2: RFC riêng
- Webhook contract → re-verify trước PH4

> **Kết luận:** Defer webhook tới PH4 spike re-verify; PH1 dùng polling contract cho envelope idempotency.
