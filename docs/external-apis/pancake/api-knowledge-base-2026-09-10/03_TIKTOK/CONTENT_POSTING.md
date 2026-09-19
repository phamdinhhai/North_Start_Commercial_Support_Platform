# TikTok Content Posting API

Nguồn: https://developers.tiktok.com/docs/en/content-posting-api-get-started

## Hai flow

- Direct Post API
- Upload API (đưa content vào TikTok để user hoàn tất)

Hỗ trợ video và photo.

## Reference groups

- Video Direct Post
- Video Upload
- Photo
- Query Creator Info
- Get Post Status

## Endpoint đã xác minh

- `POST /v2/post/publish/creator_info/query/`
- `POST /v2/post/publish/video/init/` — direct video init, scope `video.publish`.
- `POST /v2/post/publish/content/init/` — photo direct/upload, scope `video.publish` hoặc `video.upload`.
- `POST /v2/post/publish/status/fetch/`
- upload URL được API trả về dùng `open-upload.tiktokapis.com`.

Official docs hiện nêu mỗi user access token bị giới hạn 6 request/phút cho một số init endpoints; kiểm tra reference cụ thể thay vì áp cho toàn product.

Unaudited clients có restriction về visibility khi direct posting; cần audit để production behavior đầy đủ.
