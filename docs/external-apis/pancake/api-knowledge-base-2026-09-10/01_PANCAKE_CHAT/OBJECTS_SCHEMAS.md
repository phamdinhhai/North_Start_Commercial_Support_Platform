# Pancake Chat — Objects / Schemas

Nguồn: https://developer.pancake.biz/

Tài liệu hiện liệt kê các schema/khái niệm như Page, Conversation, Assign User, Messages/Response, Sentiment, Customer Message, Private Reply, Inbox Message, Reply Comment và WhatsApp Template message/params.

## Object cần map cho dự án

- Page/Connection
- Conversation
- Message
- Customer/Page Customer
- User/Assignee
- Tag
- Post
- Call log
- Customer note
- Ad/campaign statistics (chỉ dùng đúng phạm vi dữ liệu trả về)

## Quy tắc thiết kế

Không dùng object Pancake làm domain object cốt lõi trực tiếp. Adapter nên map sang các khái niệm nội bộ trung tính như `InteractionChannel`, `Conversation`, `Message`, `ExternalIdentity`, `SourceEvidence`.
