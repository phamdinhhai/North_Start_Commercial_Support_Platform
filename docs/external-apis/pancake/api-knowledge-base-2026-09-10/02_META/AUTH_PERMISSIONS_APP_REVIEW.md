# Meta — Auth, permissions và App Review

Nguồn: https://developers.facebook.com/docs/permissions/reference/

## Các loại token thường gặp

- User Access Token
- Page Access Token
- App Access Token
- System User Access Token
- Product-specific tokens, ví dụ Threads User Token

Token type hợp lệ phụ thuộc endpoint; không chọn theo tiện lợi.

## Nguyên tắc permission

Meta dùng granular permissions. App chỉ nên request permission thực sự cần; permission thừa là một nguyên nhân thường gặp của review failure.

Tài liệu permissions nêu rằng app cần truy cập dữ liệu của user/business không do app sở hữu/quản lý có thể phải qua **App Review**; **Business Verification** được yêu cầu khi xin Advanced Access.

## Permission có khả năng liên quan dự án

### Facebook Pages/Messenger
- `pages_show_list`
- `pages_read_engagement`
- `pages_read_user_content`
- `pages_manage_metadata`
- `pages_manage_engagement`
- `pages_manage_posts` (nếu thực sự cần)
- `pages_messaging`
- `read_insights`

`pages_messaging` có dependency được docs permission reference liệt kê với `pages_manage_metadata` và `pages_show_list`.

### Marketing
- `ads_read`
- `ads_management`
- `business_management`
- `leads_retrieval` cho Lead Ads khi use case cần.

Meta Postman Marketing docs nêu: quản lý ad account của chính mình có thể dùng Standard Access + ads permissions; quản lý ad account của khách hàng yêu cầu Advanced Access cho permission tương ứng.

### Instagram
Facebook Login model thường dùng các permission như:
- `pages_show_list`
- `instagram_basic`
- `instagram_content_publish`
- `pages_read_engagement`
- `instagram_manage_comments`
- messaging/insights permissions khi use case yêu cầu.

Instagram Login model dùng scope `instagram_business_*` tương ứng.

### WhatsApp
- `business_management`
- `whatsapp_business_management`
- `whatsapp_business_messaging`

## Thiết kế onboarding

Tách rõ:
1. permission kỹ thuật cần;
2. permission thực sự được customer cấp;
3. asset nào customer có quyền;
4. App Review/Advanced Access của app;
5. token scope runtime.
