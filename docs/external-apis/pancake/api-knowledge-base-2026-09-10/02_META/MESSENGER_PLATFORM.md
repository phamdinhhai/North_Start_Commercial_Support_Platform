# Meta Messenger Platform

Nguồn chính: https://developers.facebook.com/docs/messenger-platform/  
Postman chính thức: https://www.postman.com/meta/messenger-platform-api/collection/iyp204x/messenger-platform-api

## Điều kiện cơ bản

Postman chính thức nêu cần:
- Facebook Page;
- Meta app với `pages_messaging`;
- Page access token từ người có `MESSAGE` task;
- người nhận đã nhắn Page trong 24h hoặc thuộc trường hợp được phép nhắn ngoài cửa sổ chuẩn/đã đồng ý phù hợp.

## Send API

Endpoint phổ biến:

`POST https://graph.facebook.com/{version}/{page-id}/messages`

Hỗ trợ:
- text;
- media attachment;
- templates;
- quick replies;
- sender actions như `mark_seen`, `typing_on`, `typing_off`;
- các kiểu message khác theo reference/version.

## Nhận message

Inbound events thường đi qua Graph Webhooks/Page subscription. Cần verify chính xác fields/events hiện hành khi triển khai.

## Câu hỏi feasibility cho dự án

- Có được phép cho Sales gửi qua Messenger trực tiếp từ platform hay phải đi qua Pancake?
- Page token/permission được customer cấp theo mô hình B2B SaaS như thế nào?
- Messaging window/tag/consent nào áp dụng cho use case follow-up cụ thể?
- Có thể map PSID/Page identity với identity Pancake trả về deterministic không?
