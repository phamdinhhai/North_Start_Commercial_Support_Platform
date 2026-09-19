# Pancake Chat — Endpoint catalog

Nguồn: https://developer.pancake.biz/  
**Lưu ý:** path dưới đây là path tương đối; chọn User API/Page API v1/v2 theo endpoint reference live trước khi code.

| Method | Path | Mục đích | Auth |
|---|---|---|---|
| GET | `/pages` | List pages | User token |
| POST | `/pages/{page_id}/generate_page_access_token` | Sinh/regenerate Page token | User token |
| GET | `/pages/{page_id}/conversations` | Danh sách hội thoại; docs nêu tối đa 60/request, cursor last_conversation_id | Page token |
| POST | `/pages/{page_id}/conversations/{conversation_id}/tags` | Thêm/bỏ tag hội thoại | Page token |
| POST | `/pages/{page_id}/conversations/{conversation_id}/assign` | Gán người xử lý | Page token |
| POST | `/pages/{page_id}/conversations/{conversation_id}/read` | Đánh dấu đã đọc | Page token |
| POST | `/pages/{page_id}/conversations/{conversation_id}/unread` | Đánh dấu chưa đọc | Page token |
| GET | `/pages/{page_id}/conversations/{conversation_id}/messages` | Lấy lịch sử tin nhắn | Page token |
| POST | `/pages/{page_id}/conversations/{conversation_id}/messages` | Gửi tin vào hội thoại | Page token |
| GET | `/pages/{page_id}/statistics/pages_campaigns` | Thống kê campaign quảng cáo theo khả năng Pancake | Page token |
| GET | `/pages/{page_id}/statistics/ads` | Thống kê quảng cáo | Page token |
| GET | `/pages/{page_id}/statistics/customer_engagements` | Thống kê tương tác khách hàng | Page token |
| GET | `/pages/{page_id}/statistics/customer_feedbacks` | Thống kê phản hồi/đánh giá | Page token |
| GET | `/pages/{page_id}/statistics/pages` | Thống kê Page | Page token |
| GET | `/pages/{page_id}/statistics/tags` | Thống kê Tag | Page token |
| GET | `/pages/{page_id}/statistics/users` | Thống kê User/nhân viên | Page token |
| GET | `/pages/{page_id}/export_data` | Xuất dữ liệu hội thoại/quảng cáo theo docs | Page token |
| GET | `/pages/{page_id}/posts` | Danh sách bài đăng | Page token |
| GET | `/pages/{page_id}/tags` | Danh sách tag | Page token |
| GET | `/pages/{page_id}/users` | Danh sách user/availability/round-robin metadata | Page token |
| POST | `/pages/{page_id}/round_robin_users` | Cập nhật user round-robin | Page token |
| GET | `/pages/{page_id}/sip_call_logs` | Lịch sử cuộc gọi SIP | Page token |
| GET | `/pages/{page_id}/page_customers` | Danh sách/thông tin khách theo Page | Page token |
| PUT | `/pages/{page_id}/page_customers/{page_customer_id}` | Cập nhật thông tin khách | Page token |
| POST | `/pages/{page_id}/page_customers/{page_customer_id}/notes` | Tạo note | Page token |
| PUT | `/pages/{page_id}/page_customers/{page_customer_id}/notes` | Cập nhật note | Page token |
| DELETE | `/pages/{page_id}/page_customers/{page_customer_id}/notes` | Xóa note | Page token |
| GET | `/pages/{page_id}/avatar/{psid}` | Lấy URL avatar; docs snapshot ghi không cần auth | Không/verify |
| POST | `/pages/{page_id}/upload_contents` | Upload media/nội dung để dùng khi gửi tin | Page token |
| POST | `/pke_chat_plugin/messages` | Gửi/tạo hội thoại qua Pancake Chat Plugin | Theo Chat Plugin docs |

## Pagination

Docs snapshot nêu `GET /pages/{page_id}/conversations` tối đa 60 hội thoại/request và dùng `last_conversation_id` để phân trang. Với các list endpoint khác, phải đọc pagination schema của endpoint live.
