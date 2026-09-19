# Các khoảng còn chưa thể xác nhận 100%

Bản v2 đã sửa vấn đề **bỏ sót API family**, nhưng vẫn không nên tuyên bố là mirror 100% mọi endpoint/symbol của ba vendor.

## Pancake
- Webhook event names, raw payload schemas, retry/ordering/idempotency/security behavior cần live capture từ tài khoản thật.
- Một số khả năng có thể phụ thuộc page/account enablement.

## Meta
- Graph API là graph rộng với rất nhiều node/edge/field và thay đổi theo version/permission; v2 không mirror từng edge.
- Meta Horizon có hàng nghìn SDK symbols cho Unity/Unreal/Spatial/OpenXR/Android; v2 inventory build paths/families, không sao chép toàn reference.
- Wearables và Meta Model API được inventory toàn hệ, nhưng không enumerate từng SDK method/model endpoint vì ngoài scope project.
- Restricted/research APIs và một số business capabilities cần access approval mới xác minh được toàn contract.

## TikTok
- Marketing API và Shop Open API có rất nhiều endpoint theo feature, market và version; v2 inventory toàn family và exact endpoint quan trọng/đã thấy rõ, không giả định những endpoint chưa thấy.
- Business Messaging và Shop Customer Service có review/eligibility; live test cần app được duyệt.
- TikTok Shop version nằm trong từng endpoint path nên phải kiểm tra từng API khi triển khai.
- TikTok Minis/GO/Monetization đang phát triển nhanh trong 2026; cần kiểm tra changelog ngay trước build.

## Definition of Done để đạt endpoint-level gần 100%
1. Có machine-readable export/OpenAPI/Postman chính thức cho từng ecosystem, hoặc crawl toàn reference.
2. Enumerate method/path/version/scope cho từng endpoint.
3. Diff với navigation/index của vendor để không thiếu category.
4. Đánh deprecation/region/access level.
5. Live-test các endpoint P0/P1 với credentials thật.
6. Đặt lịch refresh vì API không phải tài liệu tĩnh.
