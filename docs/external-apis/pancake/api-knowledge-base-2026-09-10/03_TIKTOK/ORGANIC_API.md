# TikTok API for Business — Organic API

Nguồn: https://ads.tiktok.com/gateway/docs/

## Thành phần official overview

- Accounts API
- Mentions API
- TikTok One API
- Discovery API
- Spark Ads Recommendation API

## Accounts API capability trong current reference

- Access token inspector / permission scopes
- Profile data
- Post data
- Business category benchmarks
- Post privacy settings
- Comment list/replies/create/reply/like/hide/delete
- Upload comment image
- Publish public video/photo
- Publishing status
- Recommended hashtags
- Location tags / URL properties / ad authorization và related account utilities tùy endpoint

Endpoint examples:
- `/tt_user/token_info/get/`
- `/business/get/`
- `/business/video/list/`

## Rate limit ví dụ đã xác minh

Accounts API docs snapshot nêu 40 QPM cho mỗi authorized TikTok account + Accounts API endpoint, đồng thời có global app-level QPM theo access level. Không áp con số này cho Marketing/Business Messaging APIs.

## Liên quan dự án

Organic API có thể hữu ích khi cần TikTok brand account/post/comment signals trực tiếp; không thay Business Messaging API cho DM.
