# ADR-009 — Content digests and raw-frame retention for integration evidence

**Ngày:** 2026-11-18
**Trạng thái:** Accepted — owner approval (Phạm Đình Hải) 2026-11-18, theo đề xuất R2-P-09
**Liên quan:** I-12 · `TRUST_AND_EVIDENCE.md` §4 · `ARCHITECTURE_CONSTITUTION.md` §7 · review A (A-m7), review C/D (unkeyed contentHash)

## Context

Observer Pancake và browser companion tính SHA-256 **không khoá** trên payload chứa nội dung tin nhắn. Hash không khoá của nội dung ngắn (số điện thoại, "ok", mã đơn) có thể bị đoán/so khớp offline → rò rỉ PII. Frame bị quarantine (schema drift) hiện không lưu raw.

## Options

Lưu raw mã hoá có retention · hash-only không khoá · **keyed HMAC theo workspace, không lưu raw mặc định (chọn)**.

## Decision

1. Mọi digest trên nội dung khách hàng dùng **HMAC-SHA256 với khoá theo workspace** giữ phía server (có `kid`, xoay vòng được). Digest chỉ so sánh được trong cùng workspace và cùng khoá.
2. **Browser companion không gửi digest dẫn xuất từ nội dung** (body). Chỉ gửi metadata đã lọc và fingerprint cấu trúc (hình dạng khoá, không giá trị). Trường `payloadHash` bị loại khỏi hợp đồng upload.
3. **Raw frame quarantine không được lưu mặc định.** Chỉ cho phép research capture: cờ tường minh, workspace được uỷ quyền, mã hoá at-rest, retention tối đa 7 ngày, xoá tự động, ghi audit.
4. I-12 (raw immutable) áp dụng cho **Interaction evidence được chấp nhận**, không áp dụng cho frame telemetry/research bị quarantine.

## Why

Bảo vệ PII theo mặc định, vẫn giữ khả năng dedupe/đối soát trong tenant; tránh để extension trở thành kênh rò rỉ nội dung.

## Implementation (R3-C, R3-D, R3-E)

Port `ContentDigester` (adaptive-connectivity); server-side intake bỏ `payloadHash` khỏi observation contract; companion ngừng tính hash body; tests chứng minh hai workspace cho digest khác nhau với cùng nội dung.
