# TikTok Minis + Monetization

Bản v1 bỏ sót toàn bộ nhánh này.

## TikTok Minis
TikTok cung cấp hai lớp:
- **TikTok Minis SDK / Mini Games SDK**: JavaScript client APIs chạy trong TikTok.
- **TikTok Minis Server APIs** (`open.tiktokapis.com`): backend OAuth v2, user info, trade orders, subscription/pricing.

Endpoint token đã xác minh:
`POST https://open.tiktokapis.com/v2/oauth/token/`

Nguồn: https://developers.tiktok.com/docs/en/minis-server-apis-overview

## Monetization
- In-App Ads (rewarded/interstitial)
- In-App Purchases / TikTok Beans
- One-time purchases
- Subscriptions
- Revenue/payout setup ở organization level

Nguồn: https://developers.tiktok.com/docs/en/monetization-overview

Project relevance hiện tại: `OUT`, nhưng phải inventory vì user yêu cầu toàn hệ TikTok API.
