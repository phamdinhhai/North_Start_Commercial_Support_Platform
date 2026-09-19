# TikTok API for Business — Marketing API

Nguồn: https://ads.tiktok.com/gateway/docs/

## Nhóm chức năng lớn trong reference hiện tại

### Quản lý quảng cáo
- Business Center / advertiser/account
- Campaign
- Ad Group
- Ad
- Identity
- Targeting
- Budget/bidding
- Search Ads / Smart+ / specialized objectives

### Creative
- Image/video/files
- Creative library/assets
- Spark Ads
- Instant Page/cards/catalog-based formats
- Creative tools/recommendations/preview

### Audience
- Custom audiences
- Lookalike audiences
- Audience/segment mapping

### Catalog/commerce ads
- Catalogs/products/product sets/feed
- Dynamic/commerce ad capabilities
- GMV Max và các productized campaign types tùy access

### Reporting
- Synchronous reporting
- Asynchronous reporting
- Basic reports
- Audience/creative/playable/DSA/Business Center/GMV Max reporting tùy endpoint
- Reporting Subscription API

### Measurement
- Events API 2.0: Web/App/Offline/CRM
- Legacy Events API 1.0
- Pixel/App Events
- Custom Conversions
- Lead Generation / lead retrieval / CRM postback

### Tools/other
- Locations/regions, interests, languages, OS/device/carriers, bid suggestions
- Brand Safety
- Verification
- Welcome messages
- API playground/service status

## Exact endpoint examples đã xác minh

- `GET /v1.3/campaign/get/`
- `POST /v1.3/campaign/create/`
- `POST /v1.3/campaign/update/`
- `POST /v1.3/campaign/status/update/`
- `POST /v1.3/adgroup/create/`
- `GET /v1.3/search/region/`
- `POST /v1.3/catalog/product/upload/`
- `POST /v1.3/segment/mapping/`
- Lead webhook subscription legacy/reference pattern: `/subscription/subscribe/` với object `LEAD` — phải kiểm tra current v1.3 guide trước implementation.

## Dự án

Ưu tiên đầu tiên là advertiser/campaign/ad/creative metadata + reporting/insights + lead/outcome linkage, chưa cần campaign creation.
