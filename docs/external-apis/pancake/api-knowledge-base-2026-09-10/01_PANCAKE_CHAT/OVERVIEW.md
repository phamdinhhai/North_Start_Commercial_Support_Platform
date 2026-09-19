# Pancake Chat API — Tổng quan

Nguồn chính: https://developer.pancake.biz/

## Base URL được tài liệu hóa

- User API: `https://pages.fm/api/v1`
- Page API v1: `https://pages.fm/api/public_api/v1`
- Page API v2: `https://pages.fm/api/public_api/v2`

## Nhóm API trong tài liệu

Pages, Conversations, Messages, Statistics, Export Data, Customers, Call logs, Tags, Posts, Users, Page's Contents, Chat Plugin và Schemas.

## Mô hình làm việc

1. User token để lấy danh sách Page và sinh Page token.
2. Page token để gọi dữ liệu theo Page.
3. Lấy Conversation → Messages → Customer và metadata vận hành.
4. Có endpoint write cho tag, assignment, read/unread, customer note, customer update, round-robin và send message.

## Lưu ý quan trọng cho dự án

Pancake nên được xem là nguồn interaction/conversation. Không mặc định rằng metadata quảng cáo của mọi channel đều có cùng độ sâu hoặc có thể join thẳng tới Ads API của vendor.
