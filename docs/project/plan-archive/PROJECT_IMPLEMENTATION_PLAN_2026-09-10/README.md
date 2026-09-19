# Bộ kế hoạch dự án dành cho AI

Bộ này được chuyển từ PDF kế hoạch gốc để AI Coding/Agent có thể đọc và thao tác có cấu trúc.

## File nên dùng

- `AGENTS.md`: quy tắc cho AI.
- `CURRENT_STATE.md`: trạng thái snapshot hiện tại.
- `PROJECT_PLAN_AI.md`: bản Markdown dễ đọc.
- `DECISION_GATES.md`: cổng quyết định/mốc.
- `PLAN_SCHEMA.md`: giải thích schema.
- `machine_readable/project_plan.yaml`: nguồn cấu trúc ưu tiên cho AI.
- `machine_readable/project_plan.json`: dùng cho tooling/code.
- `machine_readable/tasks.csv`: dùng khi cần import bảng.
- `source/KE_HOACH_GOC.pdf`: PDF nguyên bản để đối chiếu.

## Mức bao phủ

- 119 task.
- 11 giai đoạn.
- Lịch trong nguồn: 2026-10-19 -> 2027-06-30.
- Người phụ trách gợi ý phần lớn để trống trong PDF; bộ này giữ `null`, không tự gán.
- Dependency chi tiết không có trong PDF; bộ này không tự bịa dependency.

## Cách đặt vào repo

Có thể chép toàn bộ thư mục này vào `docs/project-plan/`, còn `AGENTS.md` có thể gộp/đặt ở root nếu Coding Agent của bạn ưu tiên đọc file đó.
