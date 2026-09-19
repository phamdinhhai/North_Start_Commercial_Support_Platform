# Meta Instagram API

Nguồn: https://developers.facebook.com/docs/instagram-platform/  
Postman: https://www.postman.com/meta/instagram/overview

## Hai mô hình authorization chính

### 1. Instagram API with Facebook Login

Dành cho Instagram Professional account (Business/Creator) và yêu cầu liên kết Facebook Page. Có thể:
- đọc/publish media;
- quản lý/reply comments;
- mentions/hashtag media;
- metadata/metrics;
- messaging khi có permission phù hợp.

Postman liệt kê permission phổ biến: `pages_show_list`, `instagram_basic`, `instagram_content_publish`, `pages_read_engagement`, `instagram_manage_comments`.

### 2. Instagram API with Instagram Login

Dành cho professional account và **không yêu cầu linked Facebook Page**. Scope mới có prefix:
- `instagram_business_basic`
- `instagram_business_content_publish`
- `instagram_business_manage_messages`
- `instagram_business_manage_comments`

Các scope cũ `business_*` đã bị deprecated từ 27/01/2025 theo official Postman docs.

## Nhóm capability

- Account/profile/media
- Content publishing
- Comments/replies
- Mentions/hashtags
- Insights
- Messaging conversations/messages cho professional accounts với scope phù hợp
- Webhooks

## Giới hạn đáng chú ý

Consumer/non-professional accounts không nằm trong phạm vi API professional business management này.

## Liên quan dự án

Nếu Pancake đã cung cấp Instagram conversation, direct Instagram API chỉ cần khi:
- thiếu metadata cần thiết;
- cần messaging/control ngoài capability Pancake;
- cần source/insight trực tiếp;
- cần đối soát identity.
