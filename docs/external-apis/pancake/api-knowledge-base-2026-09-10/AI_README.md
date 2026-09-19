# AI README — cách dùng API Knowledge Base v2

## Quy tắc bắt buộc
1. Đọc `GAP_AUDIT_v1_to_v2.md` và `SCOPE_AND_COMPLETENESS.md` trước.
2. Khi chọn API để code, query `machine_readable/api_catalog_v2.json` theo `platform`, `ecosystem`, `family`, `project_relevance`.
3. `endpoint_verified` = method/path đã thấy ở source chính thức tại ngày snapshot, **nhưng vẫn phải kiểm tra version/permission hiện hành trước production**.
4. `family_verified` = chỉ được dùng cho feasibility/design, **không được tự suy ra endpoint**.
5. `official_doc_discovered` = cần mở tài liệu và xác minh contract.
6. `legacy_deprecated` = không dùng cho integration mới.
7. Không suy luận API capability từ UI product capability.
8. Không suy luận quyền access chỉ vì endpoint tồn tại.
9. Region/app-review/partner eligibility là một phần của feasibility.
10. Với Pancake Webhook, chưa được khóa schema trước live capture.

## Project priority
- P0: trực tiếp ảnh hưởng Conversation → Lead → Sales → Outcome / acquisition measurement.
- P1: khả năng mở rộng gần.
- P2/P3: supporting/optional.
- OUT: inventory để completeness, không đưa vào roadmap hiện tại.

## Nguồn sự thật
Official reference/changelog hiện hành > official Postman/official developer announcements > knowledge base snapshot > third-party examples.

## File nên dùng khi code endpoint cụ thể
- `machine_readable/endpoint_catalog_verified.json`: chỉ các dòng có method + path cụ thể đã xác minh.
- `machine_readable/api_family_catalog_v2.json`: bản đồ capability; không tự suy ra endpoint từ file này.
- `machine_readable/legacy_v1/`: chỉ để trace bản cũ, không dùng làm source hiện hành.
