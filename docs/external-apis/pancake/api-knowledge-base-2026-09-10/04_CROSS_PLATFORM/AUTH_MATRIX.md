# Ma trận xác thực

| Hệ | Base/host chính | Auth chính | Đặc điểm |
|---|---|---|---|
| Pancake User API | pages.fm/api/v1 | `access_token` query | account-level |
| Pancake Page API | pages.fm/api/public_api/v1,v2 | `page_access_token` query | scoped theo Page |
| Meta Graph | graph.facebook.com/{version} | Bearer/query access token tùy client | granular permissions + asset access |
| Threads | graph.threads.net | OAuth 2.0 / Threads token | product-specific scopes |
| TikTok for Developers | open.tiktokapis.com/v2 | Bearer token | Login Kit/user/client token tùy API |
| TikTok API for Business | business-api.tiktok.com/open_api/v1.3 | `Access-Token` header | app permission + business/advertiser authorization |
| TikTok Shop | open-api.tiktokglobalshop.com | access token + request signing | seller/creator/partner auth; version trong path |

## Security baseline

- token vault server-side;
- encrypt at rest;
- redact URL/query token;
- rotate/revoke path;
- per-tenant credential isolation;
- never expose system/app secret to browser;
- audit connector access.
