# TikTok Shop Open API

Developer guide: https://partner.tiktokshop.com/docv2/page/tts-developer-guide  
API concepts: https://partner.tiktokshop.com/docv2/page/tts-api-concepts-overview  
Methods/endpoints: https://partner.tiktokshop.com/docv2/page/methods-and-endpoints  
Authorization: https://partner.tiktokshop.com/docv2/page/authorization-overview-202407

## Hệ riêng biệt

TikTok Shop API không dùng `open.tiktokapis.com` hay `business-api.tiktok.com` làm business resource server.

### Domains chính
- Business API: `https://open-api.tiktokglobalshop.com`
- Token exchange/refresh: `https://auth.tiktok-shops.com`
- Seller authorization US: `https://services.us.tiktokshop.com/open/authorize`
- Seller authorization ROW: `https://services.tiktokshop.com/open/authorize`
- Creator authorization: TikTok Shop Alliance flow
- Partner authorization: partner domains theo market.

## 12 foundational API categories trong official concepts

1. Product API
2. Order API
3. Fulfillment API
4. Return & Refund API
5. Logistics API
6. Promotion API
7. Finance API
8. Seller API
9. Authorization API
10. Events API
11. Data Reconciliation API
12. Supply Chain API

Current reference navigation còn có Analytics, Customer Service, Customer Engagement, Affiliate Creator, Affiliate Partner, Affiliate Seller và Tools tùy app/market/access.

## Versioning

Version là segment trong endpoint path và **không nên giả định mọi endpoint cùng version**. V2 là các version `202309` trở lên; legacy V1 (<202309) đã được TikTok Shop thông báo sunset hoàn toàn vào 31/12/2025.

Ví dụ:
- `GET /authorization/202309/shops`
- `GET /finance/202309/statements`
- `GET /finance/202309/payments`
- `GET /order/202309/orders...` theo endpoint reference.
- một số endpoint mới có version như `202406`, `202501`, `202502`.

## Auth/signing

OAuth-style authorization lấy `auth_code` → access/refresh token, nhưng business API requests còn có request signing (`app_key`, timestamp, sign, token header theo reference). Dùng SDK generated từ Partner Center nếu phù hợp; SDK package phụ thuộc app/scope/version.

## Liên quan dự án

TikTok Shop chỉ P0/P1 nếu ICP bán trực tiếp trên TikTok Shop và revenue/order outcome ở Shop cần nối với conversation/ads. Nếu không, để ngoài critical path.
