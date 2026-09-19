# Meta Marketing API

Nguồn: https://developers.facebook.com/docs/marketing-apis/  
Postman chính thức: https://www.postman.com/meta/facebook-marketing-api/overview

## Mô hình object cốt lõi

`Ad Account → Campaign → Ad Set → Ad Creative → Ad → Insights`

## Nhóm chức năng lớn

- Ad Account management
- Campaign CRUD/status
- Ad Set CRUD/status, budget/bid/targeting
- Ad CRUD/status
- Ad Creative/asset management
- Targeting search/spec
- Audiences & Custom Audiences
- Catalog/Product Set/Dynamic ads assets
- Pixels/Datasets/event sources
- Custom Conversions / Offline conversion data
- Lead Ads assets/forms/leads
- Insights/reporting, breakdowns, action breakdowns, async jobs
- Business/system user assignment và asset access
- Reach/frequency, delivery estimate và các specialized ad capabilities theo version

## Auth/access

Official Postman nêu:
- own ad account: Standard Access + `ads_read`/`ads_management` có thể đủ;
- manage other businesses' ad accounts: Advanced Access cho `ads_read`/`ads_management` tương ứng.

Có thể dùng User hoặc System User token tùy mô hình.

## Insights API

Insights cung cấp interface thống nhất để lấy quảng cáo statistics. Hỗ trợ breakdowns/action breakdowns, filtering và async jobs cho kết quả lớn.

## Versioning

Dùng version config. Snapshot hiện là v26.0. Một số field/placement/deprecation có thể thay đổi out-of-cycle hoặc có ngày cross-version enforcement.

## Liên quan dự án

Ứng dụng ban đầu nhiều khả năng cần **read/insights**, không cần quyền tạo/chỉnh Ads. Xin `ads_management` chỉ khi use case thật sự cần để giảm review surface.
