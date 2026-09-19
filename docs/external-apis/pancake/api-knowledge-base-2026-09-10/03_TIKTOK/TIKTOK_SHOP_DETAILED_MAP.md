# TikTok Shop Open API — detailed map

Bản v1 chỉ nêu family sơ bộ. Current Partner Center có các data domains/business areas:

Authorization · Event/Webhooks · Seller · Products · Promotion · Orders · Fulfillment · FBT · Logistics · Return & Refund · Finance · Analytics · Customer Service · Customer Engagement · Affiliate Creator · Affiliate Partner · Affiliate Seller · Supply Chain · Data Reconciliation · Tools/SDKs.

## Đặc biệt liên quan dự án
### Customer Service API
Có khả năng đưa buyer messages vào hệ thống CS bên thứ ba: conversation list/messages, send message, create/read conversation, agent settings, media, new-conversation/new-message webhooks. Đây là **custom/approval-gated API** với eligibility và app review nghiêm ngặt.

Nguồn: https://partner.tiktokshop.com/docv2/page/customer-service-api-overview

### Customer Engagement API
Một nhánh riêng cho engagement/CRM messaging tasks, templates, permissions và performance; market/eligibility giới hạn.

### Analytics API
Có version mới 2026; phải theo current endpoint version. Ví dụ đã xác minh: `GET /analytics/202605/shop_products/performance`.

## Versioning
TikTok Shop đặt version **trong từng endpoint path**; không được giả định mọi API dùng cùng một version.

Nguồn:
- https://partner.tiktokshop.com/docv2/page/tts-developer-guide
- https://partner.tiktokshop.com/docv2/page/methods-and-endpoints
