# TikTok for Developers — Webhooks

Nguồn: https://developers.tiktok.com/docs/en/webhooks-events

## Event types đã được docs snapshot liệt kê

- `authorization.removed`
- `video.upload.failed`
- `video.publish.completed`
- `portability.download.ready`

Payload chung có các field như `client_key`, `event`, `create_time`, `user_openid`, `content` (serialized JSON, tùy event).

Docs nêu callback nhận HTTPS POST; consumer phải trả 200 nhanh. Delivery có retry và cần thiết kế idempotent. Không đồng nhất webhook này với TikTok API for Business Webhooks hoặc TikTok Shop Webhooks.
