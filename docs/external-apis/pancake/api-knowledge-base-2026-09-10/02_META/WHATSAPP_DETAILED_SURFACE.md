# WhatsApp Business Platform — bề mặt API chi tiết

Bản v1 gom WhatsApp quá thô. Official Cloud API collection hiện có các nhóm:

- Get Started / Registration
- WhatsApp Business Accounts (WABAs)
- Phone Numbers
- Webhook Subscriptions
- Messages
- Templates
- Flows
- Media
- Typing indicators / read state
- Business Profiles
- Commerce Settings
- Payments API — Singapore
- Payments API — India
- QR codes
- Business Portfolio
- Analytics
- Billing
- On-Prem Account Migration
- Block Users
- Business Compliance

Nguồn: https://www.postman.com/meta/whatsapp-business-platform/collection/wlk6lh4/whatsapp-cloud-api

## Các capability mới/đáng chú ý 2026
- **Calling API** — voice calls trên WhatsApp Business Platform.
- **Direct Send API** — utility message qua Cloud API `/messages` mà không cần pre-approved template trong các trường hợp eligible.
- **Usernames + BSUID** — backend identity changes cần cập nhật parsing/request logic.
- **Embedded Signup v4 / Unified Onboarding** — unified onboarding flow cho WhatsApp, Messenger và Instagram Direct.

Nguồn announcement/implementation chính thức: https://developers.meta.com/resources/videos/

Không được coi video announcement là đủ để code exact contract; trước implementation phải mở current Cloud API/Business Management API reference.
