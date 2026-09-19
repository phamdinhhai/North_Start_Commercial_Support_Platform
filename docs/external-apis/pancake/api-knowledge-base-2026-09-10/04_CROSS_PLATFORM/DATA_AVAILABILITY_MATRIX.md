# Ma trận dữ liệu khả dụng — không đồng nghĩa join được

| Dữ liệu | Pancake | Meta | TikTok Business | TikTok Shop |
|---|---|---|---|---|
| Conversation/message | Mạnh | Messenger/IG direct APIs | Business Messaging | customer-service/Shop domains khác |
| Customer/channel identity | Có theo Pancake model | PSID/IG identifiers theo product | Business Account/conversation IDs | shop/buyer/order identities theo Shop rules |
| Campaign/ad/creative | Meta-oriented stats + metadata tùy Pancake | Marketing API mạnh | Marketing API mạnh | Shop ads nằm ngoài seller order API chính |
| Spend/performance | Pancake stats phạm vi riêng | Insights | Reporting | Shop analytics/finance khác mục đích |
| Lead Form | tùy source/Pancake capture | Lead Ads API | Lead Generation API | không phải khái niệm chính |
| Sales outcome | Chỉ nếu được ghi trong Pancake/workflow | có thể gửi qua CAPI/CRM events, không phải CRM truth | Events API CRM/offline feedback | Order/Finance nếu mua trên Shop |
| Revenue/order | tùy order integration | ad reporting/commerce capabilities, không phải ERP | measurement events, advertiser reports | Order + Finance là source mạnh cho Shop |

**Quan trọng:** “Có dữ liệu ở hai hệ” không có nghĩa có chung key. Feasibility phải đo join coverage thực tế.
