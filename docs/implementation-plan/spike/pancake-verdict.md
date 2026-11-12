# Pancake live spike verdict — 2026-11-11

**Trạng thái: PARTIAL — chưa thông qua Gate trước PH4.**
**Phạm vi T4-00:** có bằng chứng live dashboard/internal read; Public API và Q-04 chưa hoàn tất.
**PH4:** giữ feature flag OFF; manual/synthetic loop tiếp tục độc lập.

## Evidence và kết quả

Đã dùng REA + REAP trên `https://pancake.vn/dashboard` với cookie người dùng cung cấp; dashboard có 3 trang TikTok và khảo sát một trang.

| Hạng mục | Kết quả | Phạm vi bằng chứng |
|---|---|---|
| Dashboard authenticated | OBSERVED | Cookie session mở được dashboard/inbox. |
| Conversations | OBSERVED | API nội bộ GET 200; phép đọc bổ sung lấy hai trang × 40 bản ghi, overlap ID bằng 0 trong mẫu. |
| Messages/customers | OBSERVED | GET bổ sung có customer_id/user_view=false trả 200, 15 messages và customer fields. |
| Auth helper | STATIC-DERIVED | Bundle dùng cookie_session; xóa access_token với API nội bộ cùng origin. |
| Pagination contract | PARTIAL | Client có current_count/next_cursor/cursor_mode; hai response mẫu không có next_cursor/has_more. Chưa duyệt hết hoặc kiểm chứng ổn định. |
| Public API credential/auth | UNKNOWN | Credential được cung cấp là cookie export; chưa xác minh Public API token hiện hữu hoặc endpoint public live. |
| Record/event identity/version | UNKNOWN | Thấy external IDs/timestamps; chưa chứng minh bất biến, event version, update/replay/conflict semantics QA-10. |
| Webhook/signature/retry/order | UNKNOWN | Không tạo subscription/receiver. WebSocket UI không xác nhận webhook. |
| Rate limit/expired auth | UNKNOWN | Không stress test hoặc làm hết hạn phiên. |
| PH4 engineering + product gate | NOT PASSED | Đợt khảo sát không thay thế quyết định Product + Engineering. |

Báo cáo: [REA research](../../research/pancake-rea-2026-11-11/README.md).
Evidence: [index](../../research/pancake-rea-2026-11-11/evidence-index.json), [read probes](../../research/pancake-rea-2026-11-11/read-probes.json), [source excerpts](../../research/pancake-rea-2026-11-11/trace-excerpts.json).

## Điều chỉnh cách hiểu Q-03

[Q-03](Q-03-pancake-api-feasibility.md) là snapshot lịch sử. Phép đo này bổ sung bằng chứng nhưng không đổi toàn bộ snapshot thành live-verified.

- Chưa có bằng chứng xác nhận API key-based auth cho dashboard; build hiện tại dùng cookie session nội bộ.
- Không áp dụng mặc định cursor/has_more cho mọi endpoint. Client có nhánh current_count và cursor tùy dữ liệu.
- Thấy record/customer/message fields không có nghĩa Public API hỗ trợ cùng schema hoặc channel coverage.
- Không dùng private dashboard endpoint/cookie làm hợp đồng adapter production chỉ vì thử đọc thành công.

## Tác động phiên và giới hạn

Navigation inbox ban đầu tự gửi POST activate_bot và get_multiple_shops, trả 200; tác động server chưa được xác minh. Sau đó chặn HTTP ngoài GET/HEAD/OPTIONS; điều này hạn chế một số views và không chặn WebSocket. Không chủ động gửi tin, lưu settings, gán người, tạo đơn hoặc tạo/rotate token.

Source semantic analyzer hết deadline 45/90 giây; excerpt/offset/hash là lexical trace từ REA-exported scripts. Capture có attach/policy/completeness limitations; giữ nguyên trong evidence.

## Điều kiện cần trước khi mở PH4

1. Existing Public API credential được cấp đúng một page pilot; kiểm chứng quyền và schema bằng read endpoint được hỗ trợ.
2. Chạy hết paging có termination/order rõ ràng; phân biệt event/version với mutable record ID.
3. Kiểm chứng idempotency no-op/update/conflict/quarantine, checkpoint và raw immutable với fixture ẩn danh.
4. Q-04 có verdict riêng về subscription, signing, delivery ID, retry/order/replay; nếu chưa biết, ghi UNKNOWN và giữ realtime deferred.
5. Engineering + Product review verdict theo gate hiện hành; flag OFF/manual fallback và redaction vẫn bắt buộc.

Giữ nguyên I-01…I-12 và các canonical open decisions; không suy tag → commercial state, assignee → Sales owner, hoặc customer ID → Lead ID.