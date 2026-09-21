# TRẠNG THÁI KẾ HOẠCH HIỆN TẠI

**Ngày snapshot:** 10/09/2026  
**Nguồn:** `Losa247 Khách hàng và Công việc - Chatbot  - Kế hoạch triển khai sản phẩm mới.pdf`  
**Số task:** 119  
**Số giai đoạn:** 11

## Trạng thái

- PDF nguồn ghi toàn bộ task là **Chưa bắt đầu**.
- Task có ngày bắt đầu sớm nhất trong nguồn: **2.1 - Xác minh lại Pancake API/điều khoản hiện tại**, bắt đầu **19/10/2026**.
- Kế hoạch kéo dài đến **30/06/2027**.
- PDF nguồn **không mô tả công việc từ 10/09/2026 đến 18/10/2026**. Điều này chỉ có nghĩa là nguồn không chứa các đầu việc đó; AI không được suy ra rằng không có việc cần làm trong khoảng thời gian này.

## Nguyên tắc khi AI dùng file này

1. Không tự đổi trạng thái task nếu không có bằng chứng hoặc chỉ thị của người dùng.
2. Không tự coi deadline là cam kết bất biến; đây là baseline lập kế hoạch.
3. Không tự nhảy qua các cổng quyết định.
4. Nếu một task cần thông tin chưa có trong repo, ghi rõ `BLOCKED/NEEDS_INPUT` trong ghi chú làm việc thay vì bịa dữ liệu.
5. Khi người dùng thay đổi kế hoạch, cập nhật `project_plan.yaml` trước, sau đó đồng bộ JSON/Markdown.
