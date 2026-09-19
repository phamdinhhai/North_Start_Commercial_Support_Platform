# Phạm vi và mức độ đầy đủ

## “Tất cả” trong bộ này nghĩa là gì?

Bộ v2 inventory toàn bộ **họ API / SDK / developer surface được vendor công bố** mà chúng tôi tìm thấy trong các developer center hiện hành của Pancake, Meta và TikTok. Với Meta và TikTok, một số hệ sinh thái có hàng nghìn method/endpoint và thay đổi theo version; vì vậy phải phân biệt:

- **Catalog completeness:** API family/capability có được inventory hay không.
- **Endpoint completeness:** mọi method/path có được enumerate và xác minh hay không.

### Pancake Chat
- Mức endpoint: cao cho Public API hiện được expose trong API Reference.
- Webhook: chưa đủ để coi payload/event-level hoàn tất; cần live test.

### Meta
- Catalog-level: bao phủ Social technologies, Research/Transparency, AI/Model API inventory, Horizon API/SDK inventory và Wearables inventory.
- Endpoint-level: sâu ở các vùng liên quan dự án (Messenger, Instagram messaging, Marketing/Ads, WhatsApp, Threads), nhưng **không tuyên bố mirror 100% mọi Graph edge/SDK symbol**.

### TikTok
- Catalog-level: bao phủ TikTok for Developers, TikTok API for Business, TikTok GO, TikTok Minis/Monetization và TikTok Shop Open API.
- Endpoint-level: exact endpoint được ghi khi source chính thức hiện rõ; các nhánh partner/market-dependent giữ family-level.

## Quy tắc cho AI Coding

`family_verified` KHÔNG phải API contract. Trước khi code production phải:
1. mở `source_url`;
2. xác nhận version hiện hành;
3. xác nhận app type / market / permission / review;
4. copy exact method + path + request/response schema;
5. live-test bằng app/tài khoản phù hợp;
6. lưu evidence vào verification log.
