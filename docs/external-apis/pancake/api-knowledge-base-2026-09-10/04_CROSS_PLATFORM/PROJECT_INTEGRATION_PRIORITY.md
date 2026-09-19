# Ưu tiên tích hợp cho dự án — chưa phải quyết định MVP

## Vòng nghiên cứu 1 — interaction truth

1. Pancake Pages/Conversation/Messages/Customers/Users/Tags.
2. Pancake webhook hoặc incremental sync.
3. Pancake outbound send-message theo từng channel.

Mục tiêu: biết ta thực sự quan sát được gì trước/sau bàn giao.

## Vòng nghiên cứu 2 — Meta acquisition truth

1. Meta Marketing read access.
2. Campaign/AdSet/Ad/Creative/Insights.
3. Kiểm tra identifiers trong Pancake payload có join được Meta objects không.
4. Lead Ads nếu case thực tế dùng form.

## Vòng nghiên cứu 3 — TikTok acquisition/conversation

Chỉ tăng P0 khi design partner thật dùng TikTok đáng kể:
1. Marketing reporting.
2. Business Messaging.
3. Lead Gen/Webhooks.
4. Events API feedback.

## Vòng nghiên cứu 4 — direct channel APIs

Messenger/Instagram/WhatsApp/TikTok direct send chỉ triển khai khi:
- Pancake không đáp ứng hành vi cần thiết;
- permission/review/terms cho phép;
- user value đã được discovery chứng minh.

## Vòng nghiên cứu 5 — TikTok Shop

Kích hoạt khi case có order/revenue nằm trên TikTok Shop và cần closed-loop Shop outcome.
