# Kế hoạch kiểm thử khả thi API

Mục tiêu không phải chứng minh product vision; chỉ xác minh capability kỹ thuật và độ phủ dữ liệu.

## F-API-01 — Pancake full conversation sync

- Tạo Page/test account phù hợp.
- Pull conversations qua cursor.
- Pull full messages.
- So UI với API: count, timestamps, direction, attachments, comments/private replies.
- Ghi % field missing và edge cases.

**Pass:** reconstruct được timeline hội thoại với evidence IDs ổn định ở mức đủ cho discovery prototype.

## F-API-02 — Pancake webhook/incremental

- Trigger inbound/outbound/comment/tag/assignment.
- Ghi payload, latency, retry, duplicate/out-of-order.
- Nếu webhook thiếu event, đo polling cost dưới rate limit.

## F-API-03 — Original-channel outbound qua Pancake

Theo từng channel customer thật dùng:
- Facebook Messenger
- Instagram
- TikTok/Zalo/khác nếu được kết nối

Test send message, attachment, reply/comment, window/policy errors. Không suy từ channel A sang B.

## F-API-04 — Meta Ads read-only

- OAuth customer-style.
- Discover business/ad accounts.
- Pull campaign/adset/ad/creative metadata.
- Pull daily insights.
- Test pagination/async report/limits.

## F-API-05 — Pancake ↔ Meta linkage

Trên 30–100 conversations có source khác nhau:
- liệt kê identifiers Pancake cung cấp;
- tìm matching Meta campaign/ad/post/click identifiers;
- phân loại deterministic / inferred / unknown;
- tính coverage thật, không đặt target trước khi đo.

## F-API-06 — Meta direct Messenger/IG

Chỉ khi product hypothesis cần:
- permission review path;
- read conversation/history;
- send within allowed policy;
- identity map với Pancake.

## F-API-07 — TikTok Marketing

- advertiser auth;
- campaign/adgroup/ad/creative read;
- reporting;
- identifier mapping với Pancake/TikTok conversation.

## F-API-08 — TikTok Business Messaging

- kiểm tra account/region eligibility;
- list conversations/messages;
- send;
- webhook;
- messaging policy/limits;
- map IDs với Pancake.

## F-API-09 — Event feedback

Meta CAPI/TikTok Events API:
- gửi một test outcome event không chứa production PII;
- verify acceptance/dedup diagnostics;
- ghi rõ acceptance != attribution.

## Output chuẩn mỗi test

`TEST_ID, date, app/account, API version, permission, request, response schema hash, observed behavior, limits, evidence, pass/fail, open questions`.
