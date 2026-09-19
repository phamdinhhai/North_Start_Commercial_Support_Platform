# TikTok API for Business

Nguồn: https://ads.tiktok.com/gateway/docs/  
Overview tiếng Việt: https://ads.tiktok.com/resources/help/article/marketing-api?lang=vi

## Ba API chính

1. **Marketing API** — Ads Manager ở quy mô programmatic.
2. **Organic API** — quản lý organic presence; Accounts, Mentions, TikTok One, Discovery, Spark Ads Recommendation.
3. **Business Messaging API** — direct messages, automatic messages, webhooks.

## Base URL và version

- Base: `https://business-api.tiktok.com/open_api`
- Current documented version: `v1.3`
- Format: `{base}/{version}/{endpoint}`
- Auth thường dùng header `Access-Token`.

## Platform mechanics

Docs gồm: developer app, authorization, authentication, rate limits, app permissions, sandbox accounts, Postman collection, API service status và return codes.

## Cảnh báo

Feature/permission/rate limit có thể khác theo app access level, advertiser/business account và region. Không dùng một universal limit cho mọi endpoint.
