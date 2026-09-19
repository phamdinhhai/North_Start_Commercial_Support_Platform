# Ma trận webhook

| Hệ | Webhook | Trạng thái repo | Gợi ý triển khai |
|---|---|---|---|
| Pancake | Có trang Webhooks | Cần verify event schema | test live + fallback polling |
| Meta Graph/Page/Messenger | Có | Catalog | signature/verification + idempotent queue |
| Meta Instagram | Có qua product webhooks | Catalog | subscribe đúng fields/account |
| Meta Lead Ads | Có lead notifications | Catalog | preserve leadgen/source IDs |
| Meta WhatsApp | Có | Đã xác minh ở mức platform | message/status callbacks, WABA subscription |
| TikTok for Developers | Có | Event list đã xác minh | trả 200 nhanh, idempotent |
| TikTok API for Business | Có | Messaging config + marketing subscriptions cataloged | separate ingress namespace |
| TikTok Shop | Có Events API/webhooks | Catalog | version/event type theo Partner Center |

## Chuẩn internal

Vendor webhook → raw immutable event → dedup → normalized integration event → domain policy/action.
