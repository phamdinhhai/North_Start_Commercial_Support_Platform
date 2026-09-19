# Verification Log

## 2026-09-10

- Pancake developer root: xác minh base URLs, token model, 5 calls/page/s và endpoint catalog chính.
- Pancake webhook page: xác minh URL tồn tại; event schema chưa đọc đủ qua crawler → giữ trạng thái cần verify live.
- Meta official Postman team/workspaces: xác minh Facebook, Instagram, Messenger, Marketing, WhatsApp, Threads resources.
- Meta versioning: snapshot Graph/Marketing v26.0 current; Graph v20 hết hạn 24/09/2026; Marketing v24 hết hạn 06/10/2026.
- TikTok for Developers docs: xác minh product list, Login Kit, Display, Content Posting, Research, Commercial Content, Data Portability, Webhooks.
- TikTok API for Business: xác minh 3 nhánh Marketing/Organic/Business Messaging, base URL v1.3 và nhiều endpoint/family hiện hành.
- TikTok Shop: xác minh 12 foundational API categories, domains/auth model, version-in-path và V1 legacy sunset.

## Quy tắc cập nhật

Mỗi lần code một connector production, thêm một dòng gồm ngày, API/version, endpoint, permission, source URL và kết quả live test.
