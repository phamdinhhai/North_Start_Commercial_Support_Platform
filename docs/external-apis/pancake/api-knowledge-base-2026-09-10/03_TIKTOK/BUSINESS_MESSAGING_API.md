# TikTok API for Business — Business Messaging API

Nguồn: https://ads.tiktok.com/gateway/docs/

## Mục đích

Direct messaging cho TikTok Business Account, realtime-ish conversation integration, automatic messages và webhook configuration. Access có thể yêu cầu data security/privacy review tùy region/use case.

## Exact endpoints đã xác minh từ current endpoint catalog

### Direct messages
- `POST /v1.3/business/message/send/`
- `GET /v1.3/business/message/conversation/list/`
- `GET /v1.3/business/message/content/list/`
- `POST /v1.3/business/message/media/upload/`
- `GET/POST theo reference /v1.3/business/message/media/download/`
- `/v1.3/business/message/capabilities/get/`
- `/v1.3/business/message/direct_reply/update/`
- `/v1.3/business/message/direct_reply/get/`

### Webhook config
- `/v1.3/business/webhook/update/`
- `/v1.3/business/webhook/list/`
- `/v1.3/business/webhook/delete/`

### Automatic messages
- `/v1.3/business/message/auto_message/create/`
- `/v1.3/business/message/auto_message/update/`
- `/v1.3/business/message/auto_message/status/update/`
- `/v1.3/business/message/auto_message/get/`
- `/v1.3/business/message/auto_message/delete/`
- `/v1.3/business/message/auto_message/sort/`

Ngoài ra current docs có welcome message, suggested questions, chat prompts và conversation unlock workflows; kiểm tra endpoint live nếu use case cần.

## Câu hỏi dự án

- Business Messaging API hiện khả dụng cho customer account/region nào?
- Direct message history retention và pagination ra sao?
- Có identifiers nào nối DM conversation với ad/campaign/lead generation click không?
- Messaging limits và user-initiated/contact policy cụ thể ra sao?
