# TikTok — Ưu tiên nghiên cứu cho dự án

## P0 nếu TikTok nằm trong acquisition của design partner

- API for Business auth + advertiser discovery.
- Campaign/AdGroup/Ad/Creative metadata.
- Reporting/insights.
- Lead Generation identifiers/webhook nếu customer dùng.
- Business Messaging availability và permission ở Việt Nam/customer account.

## P1

- Events API 2.0 cho downstream CRM/Revenue event feedback.
- Organic Accounts/mentions nếu cần context ngoài DM.

## P2

- TikTok for Developers Display/Content Posting.
- Research/Commercial Content (trừ research use case riêng).
- Data Portability.
- TikTok Shop nếu ICP không bán trên Shop.

## Không suy diễn

- Có conversation TikTok trong Pancake không chứng minh ta có quyền gọi Business Messaging API trực tiếp.
- Có TikTok ad data không chứng minh conversation có ad_id/click_id để join deterministic.
- TikTok Shop order không mặc định cùng identity với TikTok DM user.
