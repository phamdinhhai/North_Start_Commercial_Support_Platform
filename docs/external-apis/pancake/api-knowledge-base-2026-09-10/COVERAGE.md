# Coverage — audited v2

**Snapshot:** 2026-09-10  
**Tổng catalog entries:** 497

## Theo vendor
- Pancake: 30
- Meta: 167
- TikTok: 300

## Theo mức xác minh
- `endpoint_verified`: 83
- `family_verified`: 405
- `official_doc_discovered`: 4
- `legacy_deprecated`: 5

## Quan trọng
`endpoint_verified` chỉ áp dụng khi **method + path cụ thể** đã được ghi. Các entry kiểu “multiple endpoints”, “Graph edges”, “API family” đã bị hạ xuống `family_verified` trong lượt kiểm tra chất lượng thứ hai.

Con số entry không đồng nghĩa vendor chỉ có từng đó endpoint. Xem `SCOPE_AND_COMPLETENESS.md`.

## Tuyên bố phù hợp nhất
- Pancake Public API: endpoint coverage tương đối sâu; Webhook event/payload cần live validation.
- Meta: inventory toàn developer ecosystem + sâu ở social/business APIs; không mirror mọi Graph edge/SDK symbol.
- TikTok: inventory TikTok for Developers, API for Business, GO, Minis/Monetization và Shop; exact endpoint chỉ ghi khi official reference được xác minh.
