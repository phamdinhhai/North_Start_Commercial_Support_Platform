# Pancake Chat — Webhooks

Trang chính thức: https://developer.pancake.biz/webhook

## Trạng thái xác minh

**Cần xác minh trước khi code production.** Trang Webhooks tồn tại trong tài liệu chính thức, nhưng snapshot/crawler hiện không trả đủ danh sách event và payload schema.

## Việc phải làm khi feasibility

1. Mở live docs bằng browser đăng nhập nếu cần.
2. Ghi lại toàn bộ event types, signature/verification, retry policy, timeout, payload versioning.
3. Test một Page sandbox/thật với: inbound message, comment, assignment, tag, customer update, outbound message.
4. Đo độ trễ và khả năng duplicate/out-of-order.
5. Nếu webhook không đủ, thiết kế incremental polling có cursor/time watermark.

Không được giả định event schema chỉ dựa vào tên trang Webhooks.
