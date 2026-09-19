# Meta APIs — Tổng quan

Nguồn developer chính: https://developers.facebook.com/docs/  
Nguồn Postman chính thức do Meta duy trì: https://www.postman.com/meta/

## Họ API trong phạm vi dự án

1. Graph API core
2. Facebook Login / access tokens
3. Pages API
4. Messenger Platform
5. Instagram API
6. Marketing API
7. Lead Ads / Lead retrieval
8. Conversions API / event measurement
9. Business Management / business assets
10. Graph Webhooks
11. WhatsApp Business Platform
12. Threads API

## Kiến trúc chung

Phần lớn Facebook/Instagram/Marketing/WhatsApp management dựa trên Graph API object/edge, access token và granular permissions. Quyền để truy cập tài sản của khách hàng thường có App Review/Advanced Access và có thể yêu cầu Business Verification.

## Nguồn chính thức bổ sung

Meta có các Postman workspace chính thức cho Facebook, Instagram, Facebook Marketing API, Messenger Platform, WhatsApp Business Platform và Threads. Đây là nguồn ví dụ tốt, nhưng changelog/developer docs vẫn là nguồn chuẩn cho thay đổi phiên bản.
