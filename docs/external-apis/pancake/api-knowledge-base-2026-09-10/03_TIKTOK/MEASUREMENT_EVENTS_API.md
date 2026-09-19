# TikTok — Events API / Measurement

Nguồn: https://ads.tiktok.com/gateway/docs/

## Events API 2.0

Current API for Business docs có guides riêng cho:
- Web Events
- App Events
- Offline Events
- CRM Events

Kèm authentication, parameters, responses/errors, supported events, Limited Data Use và payload helpers.

## Events API 1.0

Vẫn xuất hiện như legacy reference cho App/Web. Tích hợp mới nên kiểm tra hướng dẫn 2.0 trước.

## Pixel / SDK

Tài liệu còn có TikTok Pixel, App Events SDK, Advanced Matching, GTM integrations, event deduplication, ttclid và _ttp.

## Nguyên tắc dự án

Sending CRM/Revenue events về TikTok là một feedback channel cho ads measurement/optimization; nó không tự biến TikTok attribution thành “ground truth”. Lưu riêng:
- event business xác nhận;
- identifier gửi vendor;
- vendor attribution/reporting result;
- attribution model nội bộ.
