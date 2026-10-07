# Q3 — Hướng dẫn gán nhãn semantic (draft, synthetic-only)

**Status:** Draft — for Product/Data/Architecture review
**Scope:** Kiểm tra ngữ nghĩa Q3 trước khi đóng contract. Dùng tập synthetic giáo dục B2C bên dưới; không phải bằng chứng khách hàng.
**Organization / Reviewers:** TBD (doanh nghiệp thí điểm và 2 reviewer độc lập sẽ được chỉ định; một người có thể kiêm nhiều vai trò nhưng 2 lượt gán nhãn phải độc lập trước khi trao đổi).
**Sources:** RFC-005 §Q3/Q4, V2 §§9.2–9.3, COMMERCIAL_EVENT_MODEL §4.

## Đơn vị gán nhãn
Một utterance/message hoặc ghi nhận hành động = một đơn vị. Mỗi đơn vị tách thành mệnh đề nếu có nhiều ý (ví dụ “gọi lại thứ Sáu sau khi em trao đổi với sếp”).

## Trường gán nhãn
- **speaker:** khách / nhân viên / hệ thống / unknown
- **responsibleParty:** nội bộ (doanh nghiệp) / bên ngoài (khách/bên thứ ba) / chưa rõ
- **origin:** yêu cầu/cam kết rõ / policy/SLA / suy luận / unknown
- **action:** hành động đề xuất/cần làm (verbatim + normalized)
- **expectedTime / dueAt:** thời điểm dự kiến/hạn (verbatim, resolved ISO nếu đủ ngữ cảnh; nếu mơ hồ giữ interval/unknown, không ép thành ngày chính xác)
- **operationalStatus:** proposed / accepted / assigned / due / completed / cancelled / no-observation (cho kỳ vọng bên ngoài)
- **completionEvidence:** observed / declared (claimed) / inferred / absent / conflicted — kèm evidence pointer hoặc lý do thiếu
- **evidenceRef:** raw pointer/hash hoặc “no evidence” reason

## Quy tắc
- Không gán owner/deadline nếu text không có căn cứ.
- Không coi message “em gửi rồi” là bằng chứng đã gửi/người nhận đã đọc.
- Kỳ vọng bên ngoài hết mốc mà không có evidence → “chưa quan sát được”, không tự thành failure/overdue của khách.
- Ghi timezone/precision; `recorded_at` chưa định nghĩa thống nhất — ghi chú để Q4 ánh xạ.

## Phiếu gán nhãn
| caseId | utterance (synthetic) | speaker | responsibleParty | origin | action | expected/due | status | evidence |
|---|---|---|---|---|---|---|---|

## Bất đồng
Ghi loại bất đồng (actor vs speaker, due precision, status vs evidence) và cách hòa giải.
