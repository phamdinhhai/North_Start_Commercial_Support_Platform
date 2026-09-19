# TikTok for Developers — Catalog sản phẩm

Nguồn: https://developers.tiktok.com/doc/

| Product | Mục đích |
|---|---|
| Login Kit | OAuth 2.0, user authorization/token |
| Display API | profile + video data của user đã authorize |
| Content Posting API | direct post/upload video/photo |
| Share Kit | share content từ app sang TikTok |
| Research API | public data cho research client được duyệt |
| Commercial Content API | public ads/advertiser transparency data |
| Data Portability API | user-authorized export data |
| Webhooks | callbacks cho auth/content/data portability events |
| Embed Videos / TikTok Embeds | embed content |
| Green Screen Kit | share/creative kit, không phải backend data API chính |

## Base API v2

Các REST APIs hiện đại của TikTok for Developers thường dùng `https://open.tiktokapis.com/v2/...` và Bearer token. Không áp base này cho API for Business hay TikTok Shop.
