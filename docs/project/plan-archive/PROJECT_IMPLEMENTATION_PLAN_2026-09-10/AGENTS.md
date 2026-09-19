# AGENTS.md - Quy tắc sử dụng kế hoạch cho AI Coding

File này hướng dẫn AI/Agent làm việc với kế hoạch dự án được chuyển từ PDF nguồn.

## Thứ tự đọc

1. `CURRENT_STATE.md`
2. `PROJECT_PLAN_AI.md`
3. `machine_readable/project_plan.yaml` khi cần truy vấn task có cấu trúc
4. `source/KE_HOACH_GOC.pdf` chỉ để đối chiếu nguồn

## Nguồn sự thật

- Nội dung task, ngày, mức ưu tiên, trạng thái, cổng/mốc và đầu ra được lấy từ PDF nguồn.
- `project_plan.yaml` là bản cấu trúc thuận tiện nhất cho máy, nhưng **không thay đổi ý nghĩa của PDF**.
- Nếu bản cấu trúc và PDF mâu thuẫn, báo cho người dùng và ưu tiên kiểm tra PDF; không tự sửa theo suy đoán.

## Quy tắc thực thi

- Không tự bắt đầu task chỉ vì deadline gần. Chỉ thực thi khi người dùng giao việc hoặc repo thể hiện task đang làm.
- Kiểm tra `priority`, `status`, `start_date`, `deadline`, `gate_or_milestone` trước khi đề xuất task tiếp theo.
- Không vượt qua cổng quyết định khi chưa có quyết định rõ ràng.
- Không biến các giả thuyết sản phẩm/thị trường thành fact.
- Không tự điền `suggested_owner` khi PDF nguồn để trống.
- PDF nguồn không có cột dependency. Không tự tạo dependency chi tiết như thể đó là dữ liệu nguồn; nếu cần, ghi rõ đó là **dependency suy luận**.
- Ưu tiên tiếng Việt. Chỉ giữ thuật ngữ chuẩn khi dịch làm giảm rõ nghĩa: API, CRM, MVP, SaaS, Lead, Sales, Marketing, Pilot, Alpha, RBAC, E2E, CI/CD.

## Khi hoàn thành một task

AI nên đề xuất cập nhật các trường sau, nhưng chỉ ghi khi có bằng chứng:

- `status`
- `actual_start` (nếu repo sau này bổ sung trường)
- `actual_end`
- `completion_evidence`
- `notes`

Không được đánh dấu `Done` chỉ vì đã tạo code; tiêu chí hoàn thành nằm trong `description` và `deliverable`.

## Cổng quyết định quan trọng

Xem `DECISION_GATES.md`. Một số task gần cổng chỉ chuẩn bị bằng chứng; task quyết định cổng mới cho phép chuyển pha.
