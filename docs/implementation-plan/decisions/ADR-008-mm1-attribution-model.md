# ADR-008 — MM-1: Attribution model architecture and conversion export policy (resolves MM-1)

**Ngày:** 2026-11-18
**Trạng thái:** Accepted — owner approval (Phạm Đình Hải) 2026-11-18, theo đề xuất R2-P-04, P-2026-11-18-03, P-2026-11-18-04
**Giải quyết:** `OPEN_DECISIONS.md` MM-1.
**Liên quan:** I-02, I-08 · `MEASUREMENT_MODEL.md` · `TRUST_AND_EVIDENCE.md` (Won là claim) · ADR-005, ADR-006, ADR-007

## Context

Chưa có mô hình attribution canonical; LVP giữ Revenue Attribution = UNKNOWN. Research Ads (R1/R2) cho thấy provider có cửa sổ attribution, restatement và cách đếm conversion khác nhau; capability `ads.offline_conversion.upload` cần ngữ nghĩa rõ trước khi tồn tại ngoài fixture.

## Options

Single deterministic model · data-driven/fractional (cần volume lớn) · **kiến trúc đa mô hình có version, mặc định deterministic giải thích được (chọn)**.

## Decision

1. **Ba tầng tách biệt (I-02):** provider facts (spend, clicks, provider conversions — nguyên trạng, có version/timezone/currency/window) ≠ normalized observations ≠ commercial evidence (lead, handoff, outcome đã xác minh). Provider conversion **không bao giờ** được gộp vào attribution của nền tảng.
2. **`AttributionRecord`** riêng biệt: `{modelId, modelVersion, lookbackWindow, inputTouches (SourceTouch ids), creditSplit, outcomeAssertionId, computedAt}`; append-only, tính lại = record mới. Nhiều mô hình cùng tồn tại để so sánh.
3. **Mô hình mặc định khi module được bật (sau LVP):** *last qualifying touch* (bỏ touch direct/không xác định) với cửa sổ 30 ngày, cấu hình theo workspace và ghi vào từng record; hiển thị kèm *first touch* song song. Mọi giao diện ghi rõ "credit theo mô hình X", **không bao giờ** là nhân quả.
4. **Đầu vào outcome:** chỉ assertion `corroborated` (ADR-005) được dùng cho credit doanh thu; `Won` do người dùng nhập là claim → hiển thị riêng, không tính revenue.
5. **Trong LVP:** Revenue Attribution = UNKNOWN có `unknown_reason` (giữ canonical). Không xây attribution engine trong LVP.
6. **Conversion export (CAPI / TikTok Events / Google Data Manager):** tắt; khi bật sau gate (ADR-007) chỉ export outcome `corroborated`, có cơ sở consent được ghi lại, theo batch do admin phê duyệt (risk high, ADR-006) qua governed action; Google dùng Data Manager API, không dùng legacy offline import.
7. **First ads provider (P-03):** chọn provider mà workspace pilot đầu tiên đang dùng; read-only daily spend + IDs.

## Why this is the best fit

Mô hình deterministic dễ giải thích cho chủ shop/SMB và không đòi volume dữ liệu; kiến trúc version + đa mô hình cho phép nâng cấp (position-based, data-driven) sau này mà không phá dữ liệu cũ; tách provider facts khỏi commercial evidence bảo vệ niềm tin số liệu.

## Revisit trigger

Khi có ≥1 pilot đủ dữ liệu outcome corroborated để so sánh mô hình; khi chính sách provider/consent thay đổi.
