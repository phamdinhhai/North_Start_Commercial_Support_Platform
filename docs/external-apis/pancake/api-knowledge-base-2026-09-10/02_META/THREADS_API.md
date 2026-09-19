# Threads API

Nguồn: https://developers.facebook.com/docs/threads/  
Postman chính thức: https://www.postman.com/meta/threads/overview

## Nhóm chức năng official Postman

- Authorization
- Post to Threads
- Read and Manage Threads
- Read Threads Insights
- Discover Threads
- Display Threads

## Permission thường thấy

- `threads_basic`
- `threads_content_publish`
- `threads_read_replies`
- `threads_manage_replies`
- `threads_manage_insights`
- các scope discovery/mentions khi use case yêu cầu và được tài liệu hóa.

## Endpoint pattern tiêu biểu

- `POST /{threads-user-id}/threads` — tạo container/post/reply theo mode.
- `POST /{threads-user-id}/threads_publish` — publish container.
- `GET /{thread-id}/replies`
- `GET /{threads-media-id}/insights`
- `GET /{threads-user-id}/threads_insights`
- `GET /me/mentions`
- token exchange/long-lived/refresh/debug.

## Quota

Threads có endpoint để đọc publishing limit. Không hard-code con số từ sample; query/runtime docs mới là nguồn đúng cho account/app.

## Liên quan dự án

Hiện thấp, trừ khi Threads trở thành acquisition/conversation channel đáng kể trong ICP.
