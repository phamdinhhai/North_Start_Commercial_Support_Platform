# Q3/Q4 — Tập tình huống synthetic giáo dục B2C (draft)

**Status:** Draft — synthetic only, no customer PII
**Scope:** Kiểm tra ngữ nghĩa Q3 (người nói/bên thực hiện/việc nội bộ vs kỳ vọng bên ngoài/bằng chứng hoàn thành) và Q4 (provenance/thời gian). Không dùng để ước lượng mức phổ biến hay giá trị thương mại.
**Organization / Reviewers:** TBD — doanh nghiệp thí điểm và 2 reviewer sẽ được chỉ định sau. Dữ liệu thật chỉ dùng khi có consent/phạm vi được duyệt.
**Source:** RFC-005 Q3/Q4, V2 §§9.2–9.3, §7.3.
**Note:** Nhân vật giả (phụ huynh A, học viên B, tư vấn C…), giữ xưng hô “anh/chị/em” tự nhiên. Thời điểm xảy ra/thu thập/ghi nhận có thể khác nhau — ý nghĩa `recorded_at` chính là câu hỏi Q4.

| # | Tình huống (synthetic) | Điểm kiểm tra |
|---|---|---|
| 1 | Khách (phụ huynh): “Chị muốn cho bé học thử trước, thứ Bảy tuần này được không em?” | Yêu cầu học thử; bên thực hiện: doanh nghiệp sắp xếp; hạn cần ngữ cảnh thứ Bảy. |
| 2 | Phụ huynh: “Thứ Sáu em gọi lại cho chị nhé, chị trao đổi với bé đã.” | Yêu cầu gọi lại (doanh nghiệp thực hiện) + kỳ vọng khách trao đổi nội bộ (bên ngoài). |
| 3 | Tư vấn: “Chiều nay em gửi chị thông tin khóa học và học phí nhé.” | Hứa gửi tài liệu; bên thực hiện: tư vấn. |
| 4 | Tư vấn báo: “Em vừa gọi cho chị lúc 15:00, chị hẹn tối trao đổi lại.” | Lời khai qua phone ngoài hệ thống; bằng chứng: declared. |
| 5 | Tư vấn: “Em gửi rồi chị nhé” + không có file/log gửi trong hệ thống | Message quan sát được nhưng hành động gửi vẫn là lời khai. |
| 6 | Phụ huynh: “Chị dời lịch học thử sang thứ Hai 16:00 nhé em.” | Đổi lịch; kiểm tra cập nhật due và xóa nhắc cũ. |
| 7 | Tư vấn A bàn giao cho tư vấn B: “Lead này chị B theo tiếp nhé, phụ huynh muốn học lớp tối.” | Chuyển người phụ trách; kiểm tra gán đúng bên chịu trách nhiệm. |
| 8 | Tư vấn: “Em đã gửi học phí qua Zalo rồi ạ” + tin Zalo không kết nối | Báo đã làm qua kênh ngoài hệ thống; không tự coi là observed. |
| 9 | Phụ huynh: “Để chị hỏi ý kiến bố bé rồi báo em.” | Kỳ vọng bên ngoài; qua mốc chưa có evidence → “chưa quan sát được”, không tự failure. |
| 10 | Cuộc gọi hôm qua, hôm nay mới nhập: `occurred_at` hôm qua, `captured_at`/`recorded_at` hôm nay | Thời điểm xảy ra/thu thập/ghi nhận có thể khác nhau; không ép `occurred_at` = thời điểm ghi nhận. |
| 11 | Phụ huynh: “Gửi cho chị trong chiều nay nhé” | Hạn mơ hồ (khoảng thời gian); không ép thành mốc chính xác. |
| 12 | “Anh nhờ chị gọi lại thứ Sáu sau khi anh trao đổi với sếp nhé” (áp dụng cho phụ huynh trao đổi với người thân) — “Anh trao đổi với vợ anh tối nay, thứ Sáu em gọi lại cho anh nhé.” | Hai mệnh đề: kỳ vọng bên ngoài + yêu cầu gọi lại; tách người nói vs bên phải gọi. |
| 13 | Hủy/hoãn: “Tháng sau bé mới học được, em tạm dừng nhé.” | Hủy/hoãn có lý do; không tự thành Lost. |
| 14 | Gửi nhầm: tư vấn gửi nhầm file học phí cũ | Gửi sai phiên bản không tính hoàn thành đúng. |

**Cách dùng:** Hai reviewer gán nhãn độc lập theo `q3-annotation-guide.md`, ghi bất đồng, hòa giải, sửa hướng dẫn rồi mới chạy đánh giá chính thức. Tập nhỏ này chỉ kiểm tra ngữ nghĩa; mẫu 50–100 và thí điểm vận hành mới trả lời `VH2/VH4/VH5` (dãy V2 §18.1 — xem `HYPOTHESIS_REGISTER.md`).
