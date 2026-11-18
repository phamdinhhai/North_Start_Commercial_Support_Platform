# ADR-007 — LG-1: Two-layer scope and capability enablement gate (resolves LG-1)

**Ngày:** 2026-11-18
**Trạng thái:** Accepted — owner approval (Phạm Đình Hải) 2026-11-18, theo đề xuất R2-P-03, P-2026-11-18-02, P-2026-11-18-10
**Giải quyết:** `OPEN_DECISIONS.md` LG-1.
**Liên quan:** `PRODUCT_CONSTITUTION.md` (engines, LVP scope) · `INTEGRATION_PRINCIPLES.md` · ADR-004 · ADR-006

## Context

North Star mô tả 5 engine; tài liệu phase giới hạn LVP vào vòng tối thiểu. Vòng R1–R2 xây nền tảng (AIL intake, browser companion, governed-action runtime, observability, IAM) — cần quy tắc rõ để nền tảng không âm thầm trở thành phạm vi sản phẩm, đặc biệt các capability outbound (gửi tin Pancake, đổi ngân sách Ads, tạo đơn POS).

## Options

Catalog outbound trong domain nhưng tắt · **chỉ trong test fixture + cổng bật theo từng capability (chọn)** · xoá toàn bộ.

## Decision

1. **Hai tầng phạm vi.** Tầng *sản phẩm hoạt động* = vòng LVP: Conversation input → Context handoff → Sales action → Next action/follow-up → Minimal outcome assertion. Năm engine là *tham chiếu dài hạn*, không phải cam kết hiện tại.
2. **Nền tảng được phép** khi phục vụ vòng LVP và thoả mãn: cờ mặc định tắt, chỉ synthetic/contract-tested, không ghi Commercial State, không mutation ra ngoài.
3. **Capability outbound/consequential** chỉ tồn tại trong test fixture; catalog production rỗng (deny-all). **Bật một capability cho dữ liệu thật** cần một mục trong `00_EXECUTIVE/DECISION_LOG.md` (hoặc ADR) gồm: bằng chứng quyền provider, readback contract, risk class (ADR-006), kill switch, kế hoạch rollback — và chỉ sau khi Gate trước PH4 có verdict.
4. **Thứ tự đường tích hợp Pancake (P-02):** Public API (đọc) + POS webhook chính thức là đường production đầu tiên; socket Phoenix và browser companion chỉ là *gap detector/research*. Quyết định thứ tự này không thay verdict của Gate PH4 (cần evidence spike thật).
5. **Giao thức nội bộ/reverse-engineered (P-10):** chỉ phục vụ research; được nâng lên production chỉ khi có văn bản cho phép của provider được lưu làm artifact.

## Why this is the best fit

Giữ được tốc độ xây nền tảng đúng chuẩn production mà không đẩy sản phẩm vượt bằng chứng nhu cầu; mỗi capability rủi ro cao có một cổng riêng có trách nhiệm và bằng chứng, thay vì một cổng chung mơ hồ.

## Consequences

Đã thực thi trong code R2 (catalog rỗng, fixture test-only, migration 011 không seed). `OPEN_DECISIONS.md` cập nhật supersede trỏ tới ADR này.

## Revisit trigger

Gate L5 (Continue/Narrow/Pivot/Stop) hoặc khi một engine ngoài LVP được founder đưa vào phase.
