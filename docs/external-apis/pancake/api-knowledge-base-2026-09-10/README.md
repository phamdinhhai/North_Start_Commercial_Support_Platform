# Pancake + Meta + TikTok API Knowledge Base — AUDITED v2

**Snapshot:** 2026-09-10  
**Mục đích:** kho tri thức API cho nghiên cứu khả thi và AI Coding của dự án Revenue/Commercial Continuity.

Bản này được tạo sau khi audit lại v1 và xác nhận v1 đã thiếu nhiều API families. Xem ngay `GAP_AUDIT_v1_to_v2.md`.

## Điểm mới
- Inventory Meta không còn bị giới hạn âm thầm ở social/business: có bản đồ AI, Horizon, Wearables; social/business được đào sâu.
- Bổ sung Meta Ad Library API, Meta Content Library API, WhatsApp 2026 surfaces, Threads sâu hơn.
- Bổ sung TikTok GO, TikTok Minis, Monetization, Scopes, VCE.
- Đào sâu TikTok API for Business và TikTok Shop.
- Catalog machine-readable tăng lên **497 entries** và có `coverage_level` để tránh fake completeness.

## Không phải gì?
Không phải bản copy/mirror toàn bộ nội dung tài liệu vendor. Vendor docs thay đổi liên tục và nhiều endpoint restricted theo app/market. Bộ này là **map + verified catalog + source registry**, để biết chính xác cần mở tài liệu nào và mức chắc chắn ra sao.

## Bắt đầu
1. `GAP_AUDIT_v1_to_v2.md`
2. `SCOPE_AND_COMPLETENESS.md`
3. `MASTER_INDEX.md`
4. `AI_README.md`
5. `machine_readable/api_catalog_v2.json`
