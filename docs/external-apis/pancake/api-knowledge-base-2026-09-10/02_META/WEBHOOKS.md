# Meta — Webhooks

Nguồn: https://developers.facebook.com/docs/graph-api/webhooks/

## Mô hình

Graph Webhooks cho phép app subscribe object/fields/events và nhận HTTPS callbacks. Mỗi product (Pages/Messenger, Instagram, WhatsApp...) có payload/field riêng trên nền webhook chung.

## Các nhóm cần quan tâm

- Page/Messenger inbound messages, messaging events, post/comment events tùy subscription.
- Instagram comments/messaging/other supported fields.
- Lead Ads lead events.
- WhatsApp messages/status/template/account events.

## Yêu cầu thiết kế connector

- endpoint HTTPS public;
- verification handshake/signature theo product;
- idempotency;
- queue processing ngoài request callback;
- raw payload archive có retention policy;
- handle duplicates/out-of-order;
- schema version compatibility;
- monitoring subscription health.

## Lưu ý

Không gom mọi Meta webhook vào một schema business duy nhất ngay tại ingress. Lưu raw vendor event + normalized event riêng để có thể replay/debug.
