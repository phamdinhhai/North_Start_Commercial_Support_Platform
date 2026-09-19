# Kết quả recheck toàn bộ API Knowledge Base

**Ngày:** 2026-09-10

## Kết luận ngắn
Bản v1 **thiếu nhiều** so với yêu cầu ban đầu. Bản v2 đã mở lại phạm vi và audit theo developer ecosystem hiện hành.

## Trước và sau
- v1: 126 catalog rows, chủ yếu Pancake endpoints + Meta/TikTok family-level theo phạm vi dự án.
- v2: 497 catalog rows.
  - Pancake: 30
  - Meta: 167
  - TikTok: 300
- Exact method + path được gắn `endpoint_verified`: 83
- Family/capability đã xác minh nhưng chưa được phép tự suy endpoint: 405
- Official docs đã thấy nhưng cần mở lại contract: 4
- Legacy/deprecated: 5

## Những thiếu sót lớn của v1 đã sửa
### Meta
Ad Library API; Content Library API; toàn hệ Meta Developer (AI/Horizon/Wearables); Facebook/Graph/Login/Reels inventory; Marketing API sâu hơn; WhatsApp Cloud API chi tiết + Calling/Direct Send/Usernames/BSUID/Unified Onboarding; Threads publish/read/replies/mentions/insights/discovery; legacy/deprecated map.

### TikTok
TikTok GO; TikTok Minis; Monetization; Scopes/Integration Essentials; VCE; Marketing API sâu hơn; Organic API chi tiết; Business Messaging chi tiết; Events/Measurement stack; TikTok Shop Analytics/Customer Service/Customer Engagement/Affiliate/Supply Chain/Data Reconciliation/SDK tools.

### Pancake
Public API vẫn là phần có endpoint coverage tốt nhất. Webhook được tách thành một gap cần live test thay vì tự dựng schema.

## Cách dùng an toàn
- Dùng `machine_readable/api_family_catalog_v2.json` để tìm **cái gì tồn tại**.
- Dùng `machine_readable/endpoint_catalog_verified.json` khi cần exact method/path đã xác minh.
- Trước production code vẫn mở `source_url` để kiểm tra version, permission, region và app review.
