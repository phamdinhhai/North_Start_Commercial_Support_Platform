# Meta Lead Ads, Conversions API và measurement

Lead Ads: https://developers.facebook.com/docs/marketing-api/guides/lead-ads/  
Conversions API: https://developers.facebook.com/docs/marketing-api/conversions-api/

## Lead Ads / Lead retrieval

Permission `leads_retrieval` cho phép app được ủy quyền lấy thông tin người đã submit lead form. Permission này có dependencies/access requirements và thường cần App Review cho SaaS phục vụ advertiser khác.

Các mô hình tích hợp:
- pull lead data từ form;
- nhận lead qua webhook/subscription;
- liên kết lead với Page/form/ad/campaign metadata khi field/reference cho phép.

## Conversions API (CAPI)

Dùng để gửi server-side marketing events cho Meta nhằm measurement/optimization. Event source có thể gồm web, app, offline/CRM tùy setup.

### Nguyên tắc dự án

CAPI là **event reporting về Meta**, không phải bằng chứng tự động rằng một revenue event do một ad cụ thể gây ra. Attribution vẫn phải dựa trên model và identifiers/evidence thực tế.

## Offline/custom conversions

Marketing API có các object/edge về offline conversion data sets và custom conversions. Đây là mảng cần phân biệt với CAPI hiện đại và kiểm tra hướng dẫn mới nhất trước implementation.

## Feasibility cần test

- Identifier nào có thể bảo toàn từ click/conversation/lead tới outcome?
- Có fbc/fbp/click identifiers hay leadgen_id/ad_id trong data thực tế không?
- Event match quality và consent/data terms ra sao?
- Revenue event nào business có thể xác nhận đáng tin?
