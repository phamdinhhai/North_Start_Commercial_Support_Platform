# Delivery artifacts

BMad-managed / delivery-oriented artifacts belong here.

Layout hiện hành:

- `stories/` — story đã duyệt
- `contracts/` — execution contract JSON theo vai trò (manager / backend / integration / qa / reviewer)

> **Trạng thái 2026-10-27:** `BOOT-001` là **artifact lịch sử của PH1** và **đã được supersede bởi `docs/implementation-plan/phases/PH1…PH6.md` + `ADR-002`** (PH3 hiện đã bật persistence PostgreSQL, điều BOOT-001 từng defer). Giữ nguyên để bảo toàn audit trail (I-05); **không dùng nó để chỉ đạo công việc hiện tại**.
> **Schema:** các JSON trong `contracts/` trước đây được mô tả là tương thích `ai-team/execution-contract.schema.yaml`; thư mục/schema đó **không tồn tại trong repo này**. Chúng chỉ còn giá trị tham chiếu hình dạng payload — không có validator nào trong repo đọc chúng.
