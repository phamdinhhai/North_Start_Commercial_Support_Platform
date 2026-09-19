# CẤU TRÚC DỮ LIỆU KẾ HOẠCH

`machine_readable/project_plan.yaml` là file ưu tiên cho AI.

## Trường task

- `task_id`: mã task trong PDF, ví dụ `6.14`.
- `phase`: tên giai đoạn.
- `workstream`: nhóm công việc.
- `work_group`: công việc lớn.
- `task`: đầu việc.
- `description`: mô tả chi tiết / tiêu chí hoàn thành.
- `suggested_owner`: người phụ trách gợi ý; `null` nếu PDF để trống.
- `priority`: P0/P1/P2.
- `status`: trạng thái từ PDF.
- `start_date`, `deadline`: chuẩn ISO `YYYY-MM-DD`.
- `duration_days`: số ngày theo PDF.
- `effort_person_days`: công sức ngày-người.
- `gate_or_milestone`: cổng/mốc nếu có.
- `deliverable`: đầu ra/bằng chứng.
- `risk_note`: rủi ro/ghi chú.
- `source_page`: trang PDF nguồn.

## Không có trong nguồn

PDF không cung cấp dependency chi tiết, actual start/end, phần trăm hoàn thành hay completion evidence. Các trường này không được bịa thêm.
