# TikTok Research API & Commercial Content API

Research: https://developers.tiktok.com/docs/en/research-api-get-started  
Commercial Content: https://developers.tiktok.com/docs/en/commercial-content-api-getting-started

## Research API

Dành cho research projects đủ điều kiện/được phê duyệt. Dùng client credentials/client access token để query public TikTok data theo phạm vi được cấp.

Nhóm dữ liệu/reference hiện gồm public account/video/comment và các query research khác; không coi đây là API phục vụ CRM/marketing production thông thường.

## Commercial Content API

Dùng cho public advertising/advertiser transparency data. API reference hiện có:
- Query Ads
- Query Advertisers
- Get Ad Details
- Get Ad Report

Ví dụ đã xác minh:
`POST /v2/research/adlib/ad/report/` với scope `research.adlib.basic`.

## Liên quan dự án

Không nhầm Commercial Content API với TikTok Marketing API. Một cái là transparency/research public ads; cái còn lại là advertiser account management/measurement.
