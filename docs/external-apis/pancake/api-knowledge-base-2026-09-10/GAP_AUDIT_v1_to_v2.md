# Audit chênh lệch v1 → v2

**Ngày audit:** 2026-09-10  
**Mục tiêu:** kiểm tra lại tuyên bố “toàn bộ tài liệu API Pancake Chat, Meta, TikTok” và tìm các nhánh bị bỏ sót.

## Kết luận

Cảm giác “vẫn thiếu nhiều” là **đúng**. Bản v1 hữu ích cho phạm vi tích hợp của dự án nhưng đã vô tình dùng phạm vi *social/business core* thay cho yêu cầu *tất cả API*. Vì vậy v1 không nên được dùng như một catalog đầy đủ.

## Các khoảng thiếu lớn đã phát hiện

### Pancake
- API reference đã có khá tốt ở mức endpoint, nhưng phần Webhook chưa được catalog payload/event đầy đủ vì trang chính thức render bằng JavaScript và chưa có contract tĩnh dễ trích xuất.
- Cần live capture webhook từ tài khoản thật để xác nhận event names, payload, retry/signature semantics và channel differences.

### Meta — thiếu trong v1
- **Meta Ad Library API**.
- **Meta Content Library API** (restricted research API).
- Bản đồ **toàn hệ Meta Developer**: AI/Meta Model API, Horizon OS SDK/API, Wearables SDK/API surfaces.
- Facebook/Graph platform inventory sâu hơn: Facebook Login, Reels Publishing, Pages, Messenger sub-surfaces, API-adjacent surfaces.
- Marketing API sâu hơn: targeting, audiences, catalog, pixels/datasets, experiments/rules, generative features, business assets.
- WhatsApp Cloud API bị gom quá thô: Templates, Flows, Phone Numbers, Business Profiles, Commerce Settings, Payments, QR codes, Analytics/Billing, Block Users, Calling API, Direct Send, Usernames/BSUID, unified Embedded Signup v4…
- Threads API bị gom quá thô: publish, replies, mentions, insights, keyword/tag discovery.
- Legacy/deprecated inventory chưa tách rõ.

### TikTok — thiếu trong v1
- **TikTok GO** và merchant/local-service API.
- **TikTok Minis**: client SDK + backend Server APIs.
- **Monetization**: in-app ads, IAP/Beans, subscription/one-time purchase.
- **Scopes Reference** và Integration Essentials chưa được xem là một lớp riêng.
- **VCE (Virtual Compute Environment)** trong Research & Insights.
- Marketing API chỉ mới ở family-level quá thô; còn thiếu Business Center, campaign variants, Smart+, Dedicated Campaign, Super Split Test, creatives/add-ons, lead generation, webhooks, MMM, measurement stack…
- Organic API thiếu nhiều sub-API: Accounts, Mentions, TikTok One, Discovery, Spark Ads Recommendation với capabilities chi tiết.
- Business Messaging API thiếu automatic messages, welcome, suggested questions, chat prompts, unlock conversations, webhook/review requirements.
- TikTok Shop thiếu độ sâu ở Analytics, Customer Service, Customer Engagement, ba Affiliate APIs, Supply Chain, Data Reconciliation, SDK/tools và các version mới.

## Thay đổi phương pháp ở v2

1. Không dùng số lượng file/endpoint như bằng chứng completeness.
2. Mỗi entry có `coverage_level`:
   - `endpoint_verified`: đã thấy method/path ở nguồn chính thức.
   - `family_verified`: đã xác minh API family/capability, chưa khóa endpoint cụ thể.
   - `official_doc_discovered`: thấy tài liệu chính thức nhưng cần kiểm tra contract trước khi code.
   - `legacy_deprecated`: chỉ để migration/nhận diện tài liệu cũ.
3. Tách `project_relevance` (`P0..P3`, `OUT`) khỏi completeness. API ngoài dự án **vẫn xuất hiện trong catalog**.
4. Với Meta/TikTok, “tất cả” được hiểu là **inventory toàn bộ developer/API families công khai hoặc restricted-but-documented**; không tuyên bố endpoint-level 100% cho hàng nghìn endpoint động nếu chưa enumerate từ reference chính thức.

## Việc vẫn chưa thể gọi là “xong 100%”

- Pancake Webhook: cần tài khoản thật/live payload.
- Meta/TikTok: endpoint contract, permissions, region và version phải được mở lại ở official reference ngay trước khi code.
- Một số API restricted/partner-only chỉ lộ reference đầy đủ sau khi account/app được duyệt.

Bản v2 vì vậy là **catalog kiểm toán đáng tin hơn**, không phải bản mirror đóng băng của tài liệu vendor.
