# Pancake Chat — Xác thực và rate limit

Nguồn: https://developer.pancake.biz/

## User Access Token

- Query parameter: `access_token`
- Dùng cho API cấp account: lấy Pages, sinh `page_access_token`.
- Theo docs snapshot: tối đa khoảng 90 ngày và có thể bị vô hiệu khi logout/không còn hiệu lực.
- Coi như credential nhạy cảm; không đưa vào frontend hoặc log.

## Page Access Token

- Query parameter: `page_access_token`
- Dùng cho phần lớn Page APIs.
- Scoped theo Page.
- Theo docs snapshot: không tự hết hạn; mất hiệu lực khi xóa/regenerate.

## Header

Tài liệu hiện mô tả token được truyền bằng query parameter, không dùng `Authorization` header cho các endpoint nêu trên.

## Rate limit

- `5 calls / page / second`.
- Vượt giới hạn: HTTP `429 Too Many Requests`.
- Connector nên có queue, per-page limiter, backoff và retry có giới hạn.

## Rủi ro kỹ thuật

Token nằm trong URL có thể rò qua access log/proxy. Hệ thống của ta phải chủ động redact query parameter credential trong logging/observability.
