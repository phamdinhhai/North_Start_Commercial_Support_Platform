# Meta Graph API & Pages API

Nguồn: https://developers.facebook.com/docs/graph-api/  
Pages: https://developers.facebook.com/docs/pages-api/  
Postman Facebook: https://www.postman.com/meta/facebook/overview

## Graph API

Graph API là nền tảng object/edge của Meta social APIs. Request phổ biến dạng:

`https://graph.facebook.com/{version}/{object-id}?fields=...`

Các pattern quan trọng:

- `GET /me/accounts` — lấy Pages user quản lý và Page access token/tasks theo quyền.
- `GET /{page-id}` — Page metadata.
- Page edges cho posts/feed/photos/videos/comments/insights/conversations/subscribed apps tùy permission và phiên bản.

## Pages API

Page object là trung tâm cho Facebook business presence. Access phụ thuộc Page ownership/tasks, permission và Public Content/Metadata Access khi đọc Page không thuộc user.

### Nhóm chức năng nên catalog

- Page discovery/list managed Pages
- Page profile/metadata
- Posts/feed/published posts
- Photos/videos
- Comments/replies/engagement moderation
- Page insights
- Page subscriptions/webhooks
- Page conversations/Messenger access (kết hợp Messenger Platform)

## Lưu ý dự án

Pancake đã đứng trên các social APIs để hợp nhất conversation. Dự án chỉ nên gọi Pages API trực tiếp khi cần data/capability Pancake không cung cấp hoặc cần đối soát nguồn.
