# Pancake Webhook — audit trạng thái

Official docs có trang riêng: https://developer.pancake.biz/webhook

Tuy nhiên trang render bằng JavaScript và lần audit này không lấy được static event catalog/payload schema đầy đủ một cách đáng tin qua web crawler. Vì vậy **không được bịa event names/payload**.

## Việc phải làm để nâng lên endpoint/event-verified
1. Nhờ Pancake Support bật Webhook trên tài khoản test nếu cần.
2. Đăng ký endpoint test có logging raw body + headers + timestamp.
3. Trigger từng event thực tế trên các channel được dùng trong dự án.
4. Lưu raw sample đã ẩn PII.
5. Xác minh retry behavior, timeout, ordering, duplicate delivery/idempotency, signature/secret nếu có.
6. So sánh channel-specific fields.
7. Chỉ sau đó mới khóa `WEBHOOK_EVENT_CATALOG.md` và schemas.

## Không dùng nguồn blog minh họa làm contract
Bài bên thứ ba có thể giúp thử nghiệm nhưng payload ví dụ không phải official contract. Production code chỉ dựa trên official docs + live capture.
