# WhatsApp Business Platform

Nguồn: https://developers.facebook.com/docs/whatsapp/  
Postman chính thức: https://www.postman.com/meta/whatsapp-business-platform/overview

## Các API/surface chính

### WhatsApp Cloud API

API official do Meta host cho business messaging. Nhóm trong official Postman:
- Get Started
- WABAs
- Registration
- Phone Numbers
- Webhook Subscriptions
- Messages
- Templates
- Flows
- Media
- Typing indicators
- Business Profiles

Send message dùng pattern:
`POST /{phone-number-id}/messages`

Có thể gửi text, media, templates và mark incoming message read. Status message được theo dõi qua Webhooks.

### WhatsApp Business Management API

Quản lý WABA và assets liên quan: business accounts, phone numbers, templates, subscriptions, analytics/billing/commerce tùy reference. Official Postman cũ đã được đánh dấu **MOVED/deprecated collection** và request đã được chuyển vào Cloud API collection; capability API vẫn tồn tại theo developer docs.

### WhatsApp Flows API

Tạo rich/structured interactions như booking, product browsing, feedback.

### Embedded Signup

Onboarding solution cho Solution/Tech partners để onboard business mới. Release production cần App Review/Advanced Access cho các permission liên quan theo docs.

### On-Premises API

Được Meta đánh dấu deprecated; dùng Cloud API cho tích hợp mới.

## Permission thường gặp

- `business_management`
- `whatsapp_business_management`
- `whatsapp_business_messaging`

## Media

Official Postman liệt kê:
- `POST /{phone-number-id}/media`
- `GET /{media-id}`
- `DELETE /{media-id}`
- download từ media URL.

## Liên quan dự án

Có thể là channel trực tiếp sau này. Không nên dùng cho MVP nếu customer hiện chủ yếu Phone/Zalo và chưa có WhatsApp Business adoption.
