# Meta — Ưu tiên nghiên cứu cho dự án

## P0

### Marketing measurement
- OAuth/App Review path cho `ads_read` ở B2B SaaS.
- Discover Business/ad account assets.
- Campaign/AdSet/Ad/Creative metadata.
- Insights theo ngày/campaign/ad/creative và các breakdown cần thiết.
- Lead Ads identifiers nếu ICP dùng Lead Forms.

### Facebook/Instagram conversation — chỉ để đối soát Pancake
- Xác minh identity IDs Pancake trả về có map được Graph/Page/IG IDs không.
- Xác minh direct API access nếu muốn fallback/original-channel action.

## P1

- Lead Ads webhooks.
- Conversions API / server-side outcome feedback.
- Direct Messenger/Instagram messaging nếu Pancake không đáp ứng use case.

## P2

- WhatsApp direct channel.
- Threads.
- Ads creation/optimization write APIs.

## Nguyên tắc

Đừng xin `ads_management`, `pages_manage_posts` hoặc write permissions chỉ vì có thể. Với pilot measurement, read-only surface nhỏ giúp giảm security/review burden.
