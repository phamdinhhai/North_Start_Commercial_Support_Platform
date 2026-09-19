# Pancake Chat — Mức liên quan với dự án

## P0 — cần feasibility sớm

1. Đọc danh sách Page và quản lý Page token.
2. Sync Conversation có cursor ổn định.
3. Lấy Messages đầy đủ + sender/direction/timestamp/type/attachments.
4. Map Page Customer và identifiers của từng channel.
5. Lấy Users/Tags/assignment để reconstruct vận hành.
6. Kiểm tra webhook hoặc cơ chế incremental sync.
7. Kiểm tra khả năng gửi tin vào conversation hiện hữu và giới hạn theo channel.

## P1

- Customer notes/update.
- Call logs.
- Posts/comment context.
- Ads/campaign/export statistics để so sánh với Meta trực tiếp.

## Câu hỏi không được suy diễn

- Pancake `conversation_id` có ổn định lâu dài không?
- Có field nào liên kết deterministic conversation → Meta ad/campaign/adset không?
- Với mỗi channel (Facebook, Instagram, TikTok, Zalo...), outbound message có cùng capability/rule không?
- API cho Sales gửi tin qua original channel có phù hợp licensing/terms không?
