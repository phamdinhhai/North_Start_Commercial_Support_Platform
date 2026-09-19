# TikTok Data Portability API

Nguồn: https://developers.tiktok.com/docs/en/data-portability-api-get-started

## Điều kiện

Cần TikTok developer app, Login Kit, Webhooks và Data Portability product/scope approval.

## Scope

Có single/ongoing cho 4 nhóm:
- `all`
- `activity`
- `directmessages`
- `postsandprofile`

Ví dụ: `portability.directmessages.single`, `portability.directmessages.ongoing`.

## API lifecycle

1. Add Data Request
2. Check Status
3. Cancel nếu cần
4. Webhook `portability.download.ready`
5. Download trong thời gian cho phép.

## Endpoint đã xác minh

- `POST /v2/user/data/add/`
- `POST /v2/user/data/cancel/`
- các endpoint status/download theo API Reference live.

## Lưu ý

Đây là user portability/export, không phải realtime Business Messaging inbox API.
