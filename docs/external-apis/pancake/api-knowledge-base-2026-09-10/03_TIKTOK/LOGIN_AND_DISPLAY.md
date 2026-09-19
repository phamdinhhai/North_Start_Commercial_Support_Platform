# TikTok Login Kit & Display API

Login: https://developers.tiktok.com/docs/en/login-kit-overview  
Display: https://developers.tiktok.com/docs/en/display-api-get-started

## Login Kit

OAuth 2.0. Flow chung:
1. app đăng ký client key/secret;
2. redirect user authorize scopes;
3. nhận authorization code;
4. backend exchange code → access token + refresh token;
5. lưu/refresh server-side.

Scope baseline: `user.info.basic`; scope khác cần pre-approval tùy product.

## Display API

Endpoint chính:
- `GET /v2/user/info/`
- `POST /v2/video/list/`
- `POST /v2/video/query/`

Scope thường dùng: `user.info.basic`, `video.list`.

## Liên quan dự án

Display API là creator/user-authorized data, không phải Ads Manager API và không phải Business Messaging API.
