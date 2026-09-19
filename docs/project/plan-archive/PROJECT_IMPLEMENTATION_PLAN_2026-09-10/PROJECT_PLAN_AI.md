# KẾ HOẠCH DỰ ÁN - BẢN DÀNH CHO AI

**Nguồn:** `Losa247 Khách hàng và Công việc - Chatbot  - Kế hoạch triển khai sản phẩm mới.pdf`  
**Snapshot:** 10/09/2026  
**Số task:** 119  
**Số giai đoạn:** 11

> Đây là bản chuyển cấu trúc từ PDF để AI đọc/tra cứu dễ hơn. Không coi timeline là cam kết bất biến và không coi việc lặp lại tài liệu là bằng chứng độc lập.

## Tóm tắt giai đoạn

| Giai đoạn | Task | Bắt đầu | Kết thúc | Công sức (ngày-người) | P0 |
|---|---:|---:|---:|---:|---:|
| 1. Định nghĩa sản phẩm & trải nghiệm người dùng | 15 | 2026-10-26 | 2026-11-20 | 32.5 | 12 |
| 2. Khả thi kỹ thuật & kiến trúc | 15 | 2026-10-19 | 2026-11-20 | 39.5 | 11 |
| 3. Xây dựng MVP — Nền tảng | 10 | 2026-11-23 | 2026-12-21 | 46.0 | 7 |
| 4. Xây dựng MVP — Luồng cốt lõi | 10 | 2026-12-14 | 2027-01-22 | 48.0 | 7 |
| 5. Xây dựng MVP — Đo lường & trí tuệ | 8 | 2027-01-04 | 2027-01-29 | 41.0 | 3 |
| 6. Kiểm thử, bảo mật & sẵn sàng Alpha | 14 | 2027-01-04 | 2027-02-12 | 49.0 | 12 |
| 7. Pilot với đối tác thiết kế — Đợt 1 | 15 | 2027-02-15 | 2027-04-02 | 61.0 | 15 |
| 8. Chuẩn hoá sản phẩm v0.2 | 7 | 2027-04-05 | 2027-04-16 | 26.0 | 6 |
| 9. Pilot trả phí — Đợt 2 | 7 | 2027-04-05 | 2027-05-28 | 34.0 | 7 |
| 10. Sẵn sàng thương mại | 12 | 2027-05-17 | 2027-06-07 | 29.0 | 7 |
| 11. Ra mắt thương mại giới hạn & ổn định | 6 | 2027-06-07 | 2027-06-30 | 16.0 | 5 |

## Danh sách task chi tiết


# 1. Định nghĩa sản phẩm & trải nghiệm người dùng

## 1.1 - Cập nhật luận điểm sản phẩm

- **Nhóm công việc:** Sản phẩm
- **Công việc lớn:** Chiến lược sản phẩm
- **Mô tả / tiêu chí hoàn thành:** Viết lời hứa sản phẩm, ICP, wedge, nội dung không làm theo bằng chứng mới; lưu giả định bị bác bỏ.
- **Ưu tiên:** P0
- **Trạng thái:** Chưa bắt đầu
- **Thời gian:** 2026-10-26 -> 2026-10-27 (2 ngày)
- **Công sức:** 1.0 ngày-người
- **Đầu ra/Bằng chứng:** Luận điểm sản phẩm v0.2
- **Trang nguồn:** 1

## 1.2 - Chốt kết quả MVP

- **Nhóm công việc:** Sản phẩm
- **Công việc lớn:** Phạm vi MVP
- **Mô tả / tiêu chí hoàn thành:** MVP phải chứng minh vòng: Pancake Hội thoại -> Bàn giao -> Sales theo dõi tiếp -> Kết quả -> Phản hồi cho Quản lý.
- **Ưu tiên:** P0
- **Trạng thái:** Chưa bắt đầu
- **Thời gian:** 2026-10-27 -> 2026-10-28 (2 ngày)
- **Công sức:** 1.0 ngày-người
- **Đầu ra/Bằng chứng:** MVP kết quả trạng tháiment
- **Trang nguồn:** 1

## 1.3 - Lập Bắt buộc / Nên có / Để sau / Không làm

- **Nhóm công việc:** Sản phẩm
- **Công việc lớn:** Phạm vi MVP
- **Mô tả / tiêu chí hoàn thành:** Bắt buộc: connector, lead/handoff, sales queue, theo dõi tiếp, kết quả, phễu. Để sau: AI nâng cao, kết nối nhiều nền tảng quảng cáo, đối chiếu sự thật CRM, định tuyến.
- **Ưu tiên:** P0
- **Trạng thái:** Chưa bắt đầu
- **Thời gian:** 2026-10-28 -> 2026-10-30 (3 ngày)
- **Công sức:** 1.5 ngày-người
- **Đầu ra/Bằng chứng:** Ma trận phạm vi
- **Trang nguồn:** 1

## 1.4 - Định nghĩa đối tượng cốt lõi & ngữ nghĩa

- **Nhóm công việc:** Sản phẩm
- **Công việc lớn:** Quy tắc nghiệp vụ
- **Mô tả / tiêu chí hoàn thành:** Phác thảo Khách hàng, Lead/Lần thu hút khách, Bàn giao, Người phụ trách, Hoạt động, Cam kết, Kết quả, Doanh thu, Bằng chứng; Khách hàng != Lead.
- **Ưu tiên:** P0
- **Trạng thái:** Chưa bắt đầu
- **Thời gian:** 2026-10-28 -> 2026-11-03 (7 ngày)
- **Công sức:** 3.0 ngày-người
- **Đầu ra/Bằng chứng:** Domain ngữ nghĩa v0.1
- **Trang nguồn:** 1

## 1.5 - Định nghĩa dữ liệu Sales tối thiểu bắt buộc

- **Nhóm công việc:** Sản phẩm
- **Công việc lớn:** Đo lường
- **Mô tả / tiêu chí hoàn thành:** Chốt dữ liệu tối thiểu bắt buộc: kết quả liên hệ, đạt/không đạt chuẩn, trạng thái, Won/Lost, doanh thu/lý do mất; kiểm tra ma sát nhập liệu.
- **Ưu tiên:** P0
- **Trạng thái:** Chưa bắt đầu
- **Thời gian:** 2026-10-29 -> 2026-11-03 (6 ngày)
- **Công sức:** 1.5 ngày-người
- **Đầu ra/Bằng chứng:** Hợp đồng dữ liệu tối thiểu
- **Trang nguồn:** 1

## 1.6 - Thiết kế Thiết lập sẵn sàng đo lường

- **Nhóm công việc:** Sản phẩm
- **Công việc lớn:** Đo lường
- **Mô tả / tiêu chí hoàn thành:** Luồng cấu hình định nghĩa Lead/Đạt chuẩn/Không liên hệ được/Won/Lost/Doanh thu và SLA theo từng khách hàng.
- **Ưu tiên:** P1
- **Trạng thái:** Chưa bắt đầu
- **Thời gian:** 2026-11-02 -> 2026-11-06 (5 ngày)
- **Công sức:** 2.0 ngày-người
- **Đầu ra/Bằng chứng:** Đặc tả thiết lập đo lường
- **Trang nguồn:** 1

## 1.7 - Thiết kế bản đồ không gian làm việc theo vai trò

- **Nhóm công việc:** Thiết kế
- **Công việc lớn:** Kiến trúc thông tin
- **Mô tả / tiêu chí hoàn thành:** Marketing tiếp tục làm việc gần Pancake; hàng đợi công việc thương mại của Sales; màn hình chú ý/phễu của Quản lý; thiết lập Quản trị.
- **Ưu tiên:** P0
- **Trạng thái:** Chưa bắt đầu
- **Thời gian:** 2026-10-29 -> 2026-11-03 (6 ngày)
- **Công sức:** 2.0 ngày-người
- **Đầu ra/Bằng chứng:** Kiến trúc thông tin
- **Trang nguồn:** 1

## 1.8 - Vẽ Marketing -> luồng bàn giao

- **Nhóm công việc:** Thiết kế
- **Công việc lớn:** Luồng người dùng
- **Mô tả / tiêu chí hoàn thành:** Từ hội thoại tới đạt chuẩn/tạo Lead/giao Sales; hiển thị nguồn/bối cảnh; xử lý trùng/khách quay lại.
- **Ưu tiên:** P0
- **Trạng thái:** Chưa bắt đầu
- **Thời gian:** 2026-11-02 -> 2026-11-06 (5 ngày)
- **Công sức:** 3.0 ngày-người
- **Đầu ra/Bằng chứng:** Luồng bàn giao
- **Trang nguồn:** 1

## 1.9 - Vẽ luồng Lead của Sales

- **Nhóm công việc:** Thiết kế
- **Công việc lớn:** Luồng người dùng
- **Mô tả / tiêu chí hoàn thành:** Mới -> nhận -> liên hệ -> hành động tiếp -> theo dõi tiếp - > kết quả; tối thiểu nhập trường dữ liệu.
- **Ưu tiên:** P0
- **Trạng thái:** Chưa bắt đầu
- **Thời gian:** 2026-11-02 -> 2026-11-06 (5 ngày)
- **Công sức:** 3.0 ngày-người
- **Đầu ra/Bằng chứng:** Luồng Sales
- **Trang nguồn:** 1

## 1.10 - Vẽ luồng Quản lý

- **Nhóm công việc:** Thiết kế
- **Công việc lớn:** Luồng người dùng
- **Mô tả / tiêu chí hoàn thành:** Funnel + lớp cảnh báo: handoff SLA, quá hạn, chưa liên hệ, Won/Lost; xem sâu bằng chứng.
- **Ưu tiên:** P1
- **Trạng thái:** Chưa bắt đầu
- **Thời gian:** 2026-11-04 -> 2026-11-09 (6 ngày)
- **Công sức:** 2.5 ngày-người
- **Đầu ra/Bằng chứng:** luồng Quản lý
- **Trang nguồn:** 1

## 1.11 - Thiết kế Sự kiện thương mại v0

- **Nhóm công việc:** Sản phẩm
- **Công việc lớn:** Sự kiện thương mại (Commercial Event)
- **Mô tả / tiêu chí hoàn thành:** Chọn 5-8 sự kiện MVP có bằng chứng + độ tin cậy; ưu tiên cam kết/đạt chuẩn/liên hệ/kết quả, chưa tự động thay đổi rủi ro cao.
- **Ưu tiên:** P1
- **Trạng thái:** Chưa bắt đầu
- **Thời gian:** 2026-11-03 -> 2026-11-09 (7 ngày)
- **Công sức:** 2.0 ngày-người
- **Đầu ra/Bằng chứng:** Đặc tả Sự kiện thương mại v0
- **Trang nguồn:** 1

## 1.12 - Dựng mẫu thử tương tác v0

- **Nhóm công việc:** Thiết kế
- **Công việc lớn:** Mẫu thử
- **Mô tả / tiêu chí hoàn thành:** Mẫu thử cho 3 vai trò chính, tập trung một câu chuyện Lead đầu-cuối; không trau chuốt giao diện quá mức.
- **Ưu tiên:** P0
- **Trạng thái:** Chưa bắt đầu
- **Thời gian:** 2026-11-06 -> 2026-11-12 (7 ngày)
- **Công sức:** 4.0 ngày-người
- **Đầu ra/Bằng chứng:** Mẫu thử tương tác
- **Trang nguồn:** 1

## 1.13 - Kiểm thử mẫu thử với 5-7 người dùng

- **Nhóm công việc:** Nghiên cứu
- **Công việc lớn:** Khả năng sử dụng
- **Mô tả / tiêu chí hoàn thành:** Tối thiểu 2 Sales, 2 Marketing, 2 Quản lý; đo khả năng hiểu, ma sát nhập liệu, thiếu bối cảnh và độ tin cậy.
- **Ưu tiên:** P0
- **Trạng thái:** Chưa bắt đầu
- **Thời gian:** 2026-11-12 -> 2026-11-17 (6 ngày)
- **Công sức:** 3.0 ngày-người
- **Đầu ra/Bằng chứng:** Kết quả kiểm thử sử dụng
- **Trang nguồn:** 1

## 1.14 - Sửa phạm vi theo khả dụng + khả thi

- **Nhóm công việc:** Sản phẩm
- **Công việc lớn:** Phạm vi MVP
- **Mô tả / tiêu chí hoàn thành:** Cắt những flow khó hiểu/giá trị thấp; giữ tính đầy đủ đầu-cuối.
- **Ưu tiên:** P0
- **Trạng thái:** Chưa bắt đầu
- **Thời gian:** 2026-11-18 -> 2026-11-19 (2 ngày)
- **Công sức:** 1.0 ngày-người
- **Cổng/Mốc:** Cổng 2
- **Đầu ra/Bằng chứng:** MVP phạm vi candidate
- **Trang nguồn:** 1

## 1.15 - Chốt PRD MVP v0.1

- **Nhóm công việc:** Sản phẩm
- **Công việc lớn:** Đặc tả yêu cầu sản phẩm (PRD)
- **Mô tả / tiêu chí hoàn thành:** Câu chuyện người dùng, quy tắc, tiêu chí chấp nhận, sự kiện phân tích, trường hợp biên, nội dung loại trừ rõ ràng.
- **Ưu tiên:** P0
- **Trạng thái:** Chưa bắt đầu
- **Thời gian:** 2026-11-19 -> 2026-11-20 (2 ngày)
- **Công sức:** 2.0 ngày-người
- **Cổng/Mốc:** Cổng 2 - 20/11
- **Đầu ra/Bằng chứng:** PRD MVP v0.1
- **Trang nguồn:** 1


# 2. Khả thi kỹ thuật & kiến trúc

## 2.1 - Xác minh lại Pancake API/điều khoản hiện tại

- **Nhóm công việc:** Kỹ thuật
- **Công việc lớn:** Tích hợp Pancake
- **Mô tả / tiêu chí hoàn thành:** Xác nhận khả năng đọc hội thoại/khách hàng/tin nhắn/tag/giao việc, phạm vi token, giới hạn tốc độ, webhook/polling và ranh giới thương mại/quyền gửi tin nhắn.
- **Ưu tiên:** P0
- **Trạng thái:** Chưa bắt đầu
- **Thời gian:** 2026-10-19 -> 2026-10-27 (9 ngày)
- **Công sức:** 3.0 ngày-người
- **Đầu ra/Bằng chứng:** Ma trận khả năng Pancake
- **Rủi ro/Ghi chú:** Không hứa original-channel send nếu terms/API chưa xác nhận.
- **Trang nguồn:** 1

## 2.2 - Xây dựng thử nghiệm Pancake chỉ đọc

- **Nhóm công việc:** Kỹ thuật
- **Công việc lớn:** Tích hợp Pancake
- **Mô tả / tiêu chí hoàn thành:** Kết nối trang thử nghiệm; nạp hội thoại/khách hàng/tin nhắn mẫu và đo độ ổn định.
- **Ưu tiên:** P0
- **Trạng thái:** Chưa bắt đầu
- **Thời gian:** 2026-10-26 -> 2026-11-04 (10 ngày)
- **Công sức:** 5.0 ngày-người
- **Đầu ra/Bằng chứng:** Thử nghiệm nạp dữ liệu chạy được
- **Trang nguồn:** 1

## 2.3 - Đánh giá webhook và polling

- **Nhóm công việc:** Kỹ thuật
- **Công việc lớn:** Độ ổn định tích hợp
- **Mô tả / tiêu chí hoàn thành:** Thiết kế chiến lược đồng bộ, thử lại, con trỏ/điểm lưu, sự kiện trùng và đối soát.
- **Ưu tiên:** P0
- **Trạng thái:** Chưa bắt đầu
- **Thời gian:** 2026-11-02 -> 2026-11-06 (5 ngày)
- **Công sức:** 2.0 ngày-người
- **Đầu ra/Bằng chứng:** Quyết định kiến trúc đồng bộ
- **Trang nguồn:** 1

## 2.4 - Thiết kế bảo mật token/thông tin xác thực

- **Nhóm công việc:** Kỹ thuật
- **Công việc lớn:** Bảo mật
- **Mô tả / tiêu chí hoàn thành:** Lưu trữ/mã hoá, cách ly dữ liệu khách hàng, xoay vòng/thu hồi, kiểm toán quyền truy cập kết nối.
- **Ưu tiên:** P0
- **Trạng thái:** Chưa bắt đầu
- **Thời gian:** 2026-10-28 -> 2026-11-05 (9 ngày)
- **Công sức:** 2.0 ngày-người
- **Đầu ra/Bằng chứng:** Thiết kế thông tin xác thực
- **Trang nguồn:** 1

## 2.5 - Thiết kế mô hình tương tác trung lập nhà cung cấp

- **Nhóm công việc:** Kỹ thuật
- **Công việc lớn:** Kiến trúc nghiệp vụ
- **Mô tả / tiêu chí hoàn thành:** Thực thể nội bộ dùng Tương tác/Khách hàng/Lead/Sự kiện; Pancake là bộ chuyển đổi. Tránh khóa miền nghiệp vụ vào đối tượng Pancake.
- **Ưu tiên:** P0
- **Trạng thái:** Chưa bắt đầu
- **Thời gian:** 2026-11-03 -> 2026-11-09 (7 ngày)
- **Công sức:** 3.0 ngày-người
- **Đầu ra/Bằng chứng:** Mô hình nghiệp vụ v0.1
- **Trang nguồn:** 1

## 2.6 - Thiết kế Khách hàng chuẩn + Lead ID

- **Nhóm công việc:** Kỹ thuật
- **Công việc lớn:** Định danh
- **Mô tả / tiêu chí hoàn thành:** Quy tắc cho ID điện thoại/mạng xã hội, Lead/Lần thu hút khách ổn định, trùng/mở lại; luồng sửa thủ công.
- **Ưu tiên:** P0
- **Trạng thái:** Chưa bắt đầu
- **Thời gian:** 2026-11-05 -> 2026-11-11 (7 ngày)
- **Công sức:** 3.0 ngày-người
- **Đầu ra/Bằng chứng:** Thiết kế định danh/Lead ID
- **Trang nguồn:** 1

## 2.7 - Thiết kế kiến trúc đa khách hàng sẵn sàng SaaS

- **Nhóm công việc:** Kỹ thuật
- **Công việc lớn:** Đa khách hàng (multi-tenant)
- **Mô tả / tiêu chí hoàn thành:** ID khách hàng, ranh giới tổ chức/người dùng/vai trò, phân vùng dữ liệu; chưa xây phần thanh toán/tự phục vụ.
- **Ưu tiên:** P0
- **Trạng thái:** Chưa bắt đầu
- **Thời gian:** 2026-11-05 -> 2026-11-11 (7 ngày)
- **Công sức:** 2.0 ngày-người
- **Đầu ra/Bằng chứng:** Kiến trúc đa khách hàng
- **Trang nguồn:** 1

## 2.8 - Thiết kế phân quyền theo Lead

- **Nhóm công việc:** Kỹ thuật
- **Công việc lớn:** Phân quyền (RBAC)
- **Mô tả / tiêu chí hoàn thành:** Marketing/Quản trị có quyền rộng hơn; Sales chỉ truy cập Lead được giao; Quản lý có khả năng quan sát. Không yêu cầu Sales có quyền toàn trang trong ứng dụng.
- **Ưu tiên:** P0
- **Trạng thái:** Chưa bắt đầu
- **Thời gian:** 2026-11-09 -> 2026-11-13 (5 ngày)
- **Công sức:** 2.0 ngày-người
- **Đầu ra/Bằng chứng:** Ma trận phân quyền (RBAC)
- **Trang nguồn:** 1

## 2.9 - Thử nghiệm nhanh trích xuất thương mại

- **Nhóm công việc:** Kỹ thuật
- **Công việc lớn:** Khả thi AI
- **Mô tả / tiêu chí hoàn thành:** Kiểm thử tóm tắt + nhu cầu/phản đối/cam kết trên tin nhắn mẫu; lưu đoạn bằng chứng và độ tin cậy.
- **Ưu tiên:** P1
- **Trạng thái:** Chưa bắt đầu
- **Thời gian:** 2026-11-04 -> 2026-11-13 (10 ngày)
- **Công sức:** 5.0 ngày-người
- **Đầu ra/Bằng chứng:** Mốc đánh giá AI trích xuất
- **Trang nguồn:** 1

## 2.10 - Định nghĩa chính sách người duyệt

- **Nhóm công việc:** Kỹ thuật
- **Công việc lớn:** Khả thi AI
- **Mô tả / tiêu chí hoàn thành:** Xác định sự kiện nào tự động, sự kiện nào chỉ gợi ý; đánh giá chi phí báo sai; yêu cầu có kiểm toán/hoàn tác.
- **Ưu tiên:** P1
- **Trạng thái:** Chưa bắt đầu
- **Thời gian:** 2026-11-12 -> 2026-11-16 (5 ngày)
- **Công sức:** 1.5 ngày-người
- **Đầu ra/Bằng chứng:** Chính sách hành động AI
- **Trang nguồn:** 1

## 2.11 - Đánh giá khả thi liên kết nguồn thu hút khách Meta

- **Nhóm công việc:** Kỹ thuật
- **Công việc lớn:** Đo lường
- **Mô tả / tiêu chí hoàn thành:** Xác định định danh thực sự có sẵn từ Pancake/Meta để nối Campaign/Ad -> Hội thoại -> Lead; kiểm thử độ bao phủ xác định chắc chắn.
- **Ưu tiên:** P0
- **Trạng thái:** Chưa bắt đầu
- **Thời gian:** 2026-11-05 -> 2026-11-13 (9 ngày)
- **Công sức:** 4.0 ngày-người
- **Đầu ra/Bằng chứng:** Thử nghiệm liên kết nguồn Meta
- **Trang nguồn:** 1

## 2.12 - Chỉ kiểm tra khả thi kết nối TikTok/Google

- **Nhóm công việc:** Kỹ thuật
- **Công việc lớn:** Mở rộng nguồn thu hút khách
- **Mô tả / tiêu chí hoàn thành:** Không xây dựng; chỉ xác minh xác thực/ID báo cáo/chi phí và khả năng nối dòng liên kết nguồn để tránh ngõ cụt thiết kế.
- **Ưu tiên:** P2
- **Trạng thái:** Chưa bắt đầu
- **Thời gian:** 2026-11-10 -> 2026-11-17 (8 ngày)
- **Công sức:** 2.0 ngày-người
- **Đầu ra/Bằng chứng:** Ghi chú khả thi kết nối tương lai
- **Trang nguồn:** 1

## 2.13 - Thiết kế mô hình Đã biết/Suy luận/Không biết

- **Nhóm công việc:** Kỹ thuật
- **Công việc lớn:** Sức khoẻ dữ liệu
- **Mô tả / tiêu chí hoàn thành:** Mỗi liên kết có phương pháp/độ tin cậy; tính độ bao phủ; hiển thị rõ phần thiếu kết quả/nguồn.
- **Ưu tiên:** P1
- **Trạng thái:** Chưa bắt đầu
- **Thời gian:** 2026-11-11 -> 2026-11-17 (7 ngày)
- **Công sức:** 2.0 ngày-người
- **Đầu ra/Bằng chứng:** Mô hình sức khoẻ dữ liệu
- **Trang nguồn:** 1

## 2.14 - Rà soát kiến trúc + ước lượng công sức

- **Nhóm công việc:** Kỹ thuật
- **Công việc lớn:** Kiến trúc
- **Mô tả / tiêu chí hoàn thành:** Rà soát đầu-cuối, xác định trở ngại cứng, ước lượng xây dựng theo khối công việc và xác nhận phần để sau.
- **Ưu tiên:** P0
- **Trạng thái:** Chưa bắt đầu
- **Thời gian:** 2026-11-17 -> 2026-11-19 (3 ngày)
- **Công sức:** 2.0 ngày-người
- **Cổng/Mốc:** Cổng 2
- **Đầu ra/Bằng chứng:** Kiến trúc + ước lượng
- **Trang nguồn:** 1

## 2.15 - Cổng 2: Xây / Thu hẹp / Thử nghiệm lại

- **Nhóm công việc:** Kỹ thuật
- **Công việc lớn:** Quyết định qua cổng
- **Mô tả / tiêu chí hoàn thành:** Chỉ tiếp tục nếu nạp dữ liệu Pancake + định danh + dòng liên kết đầu-cuối đủ khả thi cho Pilot và phạm vi MVP phù hợp năng lực đội ngũ.
- **Ưu tiên:** P0
- **Trạng thái:** Chưa bắt đầu
- **Thời gian:** 2026-11-20 -> 2026-11-20 (1 ngày)
- **Công sức:** 1.0 ngày-người
- **Cổng/Mốc:** Cổng 2 - 20/11
- **Đầu ra/Bằng chứng:** Quyết định xây dựng
- **Trang nguồn:** 1


# 3. Xây dựng MVP — Nền tảng

## 3.1 - Kho mã/CI-CD/môi trường

- **Nhóm công việc:** Kỹ thuật
- **Công việc lớn:** Thiết lập quy trình phát hành
- **Mô tả / tiêu chí hoàn thành:** Thiết lập dev/staging/prod nhẹ, rà soát mã, chuyển đổi dữ liệu, bí mật hệ thống và hoàn tác phát hành cơ bản.
- **Ưu tiên:** P0
- **Trạng thái:** Chưa bắt đầu
- **Thời gian:** 2026-11-23 -> 2026-11-27 (5 ngày)
- **Công sức:** 3.0 ngày-người
- **Đầu ra/Bằng chứng:** Quy trình phát hành
- **Trang nguồn:** 1

## 3.2 - Mốc giám sát log/lỗi

- **Nhóm công việc:** Kỹ thuật
- **Công việc lớn:** Giám sát hệ thống
- **Mô tả / tiêu chí hoàn thành:** Log có cấu trúc, bảng lỗi tích hợp, ID yêu cầu, khả năng quan sát job đồng bộ.
- **Ưu tiên:** P1
- **Trạng thái:** Chưa bắt đầu
- **Thời gian:** 2026-11-25 -> 2026-12-02 (8 ngày)
- **Công sức:** 2.0 ngày-người
- **Đầu ra/Bằng chứng:** Observability hiện trạng
- **Trang nguồn:** 1

## 3.3 - Lõi tổ chức/người dùng/đăng nhập

- **Nhóm công việc:** Kỹ thuật
- **Công việc lớn:** Khách hàng/Xác thực
- **Mô tả / tiêu chí hoàn thành:** Tạo không gian khách hàng thủ công; mời/đăng nhập; chưa tự đăng ký/thanh toán.
- **Ưu tiên:** P0
- **Trạng thái:** Chưa bắt đầu
- **Thời gian:** 2026-11-23 -> 2026-12-04 (12 ngày)
- **Công sức:** 6.0 ngày-người
- **Đầu ra/Bằng chứng:** Module tổ chức/xác thực
- **Trang nguồn:** 1

## 3.4 - Phân quyền vai trò + phạm vi Lead

- **Nhóm công việc:** Kỹ thuật
- **Công việc lớn:** Phân quyền (RBAC)
- **Mô tả / tiêu chí hoàn thành:** Implement Admin/Marketing/Sales/Quản lý access và phạm vi Lead được giao.
- **Ưu tiên:** P0
- **Trạng thái:** Chưa bắt đầu
- **Thời gian:** 2026-12-01 -> 2026-12-09 (9 ngày)
- **Công sức:** 4.0 ngày-người
- **Đầu ra/Bằng chứng:** Phân quyền RBAC đã áp dụng
- **Trang nguồn:** 1

## 3.5 - Xác thực/thiết lập kết nối

- **Nhóm công việc:** Kỹ thuật
- **Công việc lớn:** Kết nối Pancake
- **Mô tả / tiêu chí hoàn thành:** Cấu hình quản trị nội bộ to connect Pancake và kiểm tra thông tin xác thực.
- **Ưu tiên:** P0
- **Trạng thái:** Chưa bắt đầu
- **Thời gian:** 2026-11-30 -> 2026-12-07 (8 ngày)
- **Công sức:** 4.0 ngày-người
- **Đầu ra/Bằng chứng:** Luồng thiết lập kết nối
- **Trang nguồn:** 1

## 3.6 - Nạp hội thoại/khách hàng

- **Nhóm công việc:** Kỹ thuật
- **Công việc lớn:** Kết nối Pancake
- **Mô tả / tiêu chí hoàn thành:** Đồng bộ đủ mức vận hành thật cho các đối tượng cần thiết; có điểm lưu, thử lại và loại trùng.
- **Ưu tiên:** P0
- **Trạng thái:** Chưa bắt đầu
- **Thời gian:** 2026-12-03 -> 2026-12-16 (14 ngày)
- **Công sức:** 8.0 ngày-người
- **Đầu ra/Bằng chứng:** Nạp dữ liệu ổn định
- **Trang nguồn:** 1

## 3.7 - Customer/Lead/Handoff cấu trúc dữ liệu

- **Nhóm công việc:** Kỹ thuật
- **Công việc lớn:** Mô hình dữ liệu
- **Mô tả / tiêu chí hoàn thành:** Implement canonical Customer, Lead, Handoff, owner, dòng liên kết nguồn, timestamps.
- **Ưu tiên:** P0
- **Trạng thái:** Chưa bắt đầu
- **Thời gian:** 2026-11-30 -> 2026-12-11 (12 ngày)
- **Công sức:** 6.0 ngày-người
- **Đầu ra/Bằng chứng:** Mô hình dữ liệu cốt lõi
- **Trang nguồn:** 1

## 3.8 - Activity/Outcome/Revenue cấu trúc dữ liệu

- **Nhóm công việc:** Kỹ thuật
- **Công việc lớn:** Mô hình dữ liệu
- **Mô tả / tiêu chí hoàn thành:** Contact attempts, theo dõi tiếp, trạng thái, Won/Lost, lost reason, doanh thu; thay đổi có kiểm toán.
- **Ưu tiên:** P0
- **Trạng thái:** Chưa bắt đầu
- **Thời gian:** 2026-12-07 -> 2026-12-16 (10 ngày)
- **Công sức:** 5.0 ngày-người
- **Đầu ra/Bằng chứng:** Mô hình dữ liệu thực thi
- **Trang nguồn:** 1

## 3.9 - Audit trail hiện trạng

- **Nhóm công việc:** Kỹ thuật
- **Công việc lớn:** Nhật ký kiểm toán
- **Mô tả / tiêu chí hoàn thành:** Ghi ai làm gì, khi nào, từ nguồn nào cho các thay đổi trạng thái/kết quả/giao việc; hỗ trợ hoàn tác với các thay đổi đơn giản.
- **Ưu tiên:** P1
- **Trạng thái:** Chưa bắt đầu
- **Thời gian:** 2026-12-14 -> 2026-12-21 (8 ngày)
- **Công sức:** 3.0 ngày-người
- **Đầu ra/Bằng chứng:** Nhật ký kiểm toán
- **Trang nguồn:** 1

## 3.10 - Cấu hình định nghĩa đo lường

- **Nhóm công việc:** Kỹ thuật
- **Công việc lớn:** Cấu hình quản trị
- **Mô tả / tiêu chí hoàn thành:** Cấu hình quản trị nội bộ cho Đạt chuẩn, Không liên hệ được, Won, lý do Lost và SLA.
- **Ưu tiên:** P1
- **Trạng thái:** Chưa bắt đầu
- **Thời gian:** 2026-12-07 -> 2026-12-18 (12 ngày)
- **Công sức:** 5.0 ngày-người
- **Đầu ra/Bằng chứng:** Cấu hình đo lường v0
- **Trang nguồn:** 2


# 4. Xây dựng MVP — Luồng cốt lõi

## 4.1 - Tạo Lead từ hội thoại

- **Nhóm công việc:** Sản phẩm/Kỹ thuật
- **Công việc lớn:** Marketing
- **Mô tả / tiêu chí hoàn thành:** Từ hội thoại đã đồng bộ, tạo/đánh dấu Lead đạt chuẩn đồng thời giữ nguồn, bối cảnh và định danh khách hàng.
- **Ưu tiên:** P0
- **Trạng thái:** Chưa bắt đầu
- **Thời gian:** 2026-12-14 -> 2026-12-23 (10 ngày)
- **Công sức:** 5.0 ngày-người
- **Đầu ra/Bằng chứng:** Luồng tạo Lead
- **Trang nguồn:** 2

## 4.2 - Marketing -> Sales handoff

- **Nhóm công việc:** Sản phẩm/Kỹ thuật
- **Công việc lớn:** Bàn giao
- **Mô tả / tiêu chí hoàn thành:** Assign Sales, create handoff timestamp/SLA, package bối cảnh, tránh bàn giao trùng.
- **Ưu tiên:** P0
- **Trạng thái:** Chưa bắt đầu
- **Thời gian:** 2026-12-21 -> 2027-01-05 (16 ngày)
- **Công sức:** 6.0 ngày-người
- **Đầu ra/Bằng chứng:** Luồng bàn giao
- **Trang nguồn:** 2

## 4.3 - Danh sách Lead của tôi

- **Nhóm công việc:** Sản phẩm/Kỹ thuật
- **Công việc lớn:** Không gian làm việc Sales
- **Mô tả / tiêu chí hoàn thành:** Chế độ xem: Mới, đến hạn hôm nay, quá hạn, chờ khách, không liên hệ được; hỗ trợ xem nhanh ưu tiên.
- **Ưu tiên:** P0
- **Trạng thái:** Chưa bắt đầu
- **Thời gian:** 2026-12-28 -> 2027-01-08 (12 ngày)
- **Công sức:** 6.0 ngày-người
- **Đầu ra/Bằng chứng:** Hàng đợi Sales
- **Trang nguồn:** 2

## 4.4 - Chi tiết Lead + bối cảnh

- **Nhóm công việc:** Sản phẩm/Kỹ thuật
- **Công việc lớn:** Không gian làm việc Sales
- **Mô tả / tiêu chí hoàn thành:** Hiển thị tóm tắt/nguồn/kênh gốc/bằng chứng hội thoại/dòng thời gian thương mại/hành động tiếp theo.
- **Ưu tiên:** P0
- **Trạng thái:** Chưa bắt đầu
- **Thời gian:** 2027-01-04 -> 2027-01-13 (10 ngày)
- **Công sức:** 5.0 ngày-người
- **Đầu ra/Bằng chứng:** Chi tiết Lead
- **Trang nguồn:** 2

## 4.5 - Nhận Lead/kết quả liên hệ

- **Nhóm công việc:** Sản phẩm/Kỹ thuật
- **Công việc lớn:** Thực thi Sales
- **Mô tả / tiêu chí hoàn thành:** Sales nhận Lead; ghi Đã liên hệ/Không nghe máy/Không hợp lệ/Khác kèm thời gian; tối thiểu thao tác.
- **Ưu tiên:** P0
- **Trạng thái:** Chưa bắt đầu
- **Thời gian:** 2027-01-04 -> 2027-01-12 (9 ngày)
- **Công sức:** 4.0 ngày-người
- **Đầu ra/Bằng chứng:** Luồng kết quả liên hệ
- **Trang nguồn:** 2

## 4.6 - Hành động tiếp + hạn

- **Nhóm công việc:** Sản phẩm/Kỹ thuật
- **Công việc lớn:** Theo dõi tiếp
- **Mô tả / tiêu chí hoàn thành:** Tạo hành động tiếp theo và hạn; cho phép hoàn thành/dời lịch; hiển thị việc quá hạn và người phụ trách.
- **Ưu tiên:** P0
- **Trạng thái:** Chưa bắt đầu
- **Thời gian:** 2027-01-06 -> 2027-01-15 (10 ngày)
- **Công sức:** 5.0 ngày-người
- **Đầu ra/Bằng chứng:** Lõi theo dõi tiếp
- **Trang nguồn:** 2

## 4.7 - Ghi nhận Đạt chuẩn/Won/Lost

- **Nhóm công việc:** Sản phẩm/Kỹ thuật
- **Công việc lớn:** Kết quả
- **Mô tả / tiêu chí hoàn thành:** Ghi nhận trạng thái/kết quả, lý do mất và doanh thu; kiểm tra theo cấu hình đo lường.
- **Ưu tiên:** P0
- **Trạng thái:** Chưa bắt đầu
- **Thời gian:** 2027-01-08 -> 2027-01-18 (11 ngày)
- **Công sức:** 5.0 ngày-người
- **Đầu ra/Bằng chứng:** Ghi nhận kết quả
- **Trang nguồn:** 2

## 4.8 - Commercial timeline

- **Nhóm công việc:** Sản phẩm/Kỹ thuật
- **Công việc lớn:** Dòng thời gian
- **Mô tả / tiêu chí hoàn thành:** Hiển thị sự kiện bàn giao/liên hệ/theo dõi tiếp/kết quả theo thứ tự thời gian, kèm nguồn và bằng chứng.
- **Ưu tiên:** P1
- **Trạng thái:** Chưa bắt đầu
- **Thời gian:** 2027-01-13 -> 2027-01-20 (8 ngày)
- **Công sức:** 4.0 ngày-người
- **Đầu ra/Bằng chứng:** Dòng thời gian thương mại
- **Trang nguồn:** 2

## 4.9 - Thông báo đến hạn/quá hạn cơ bản

- **Nhóm công việc:** Sản phẩm/Kỹ thuật
- **Công việc lớn:** Thông báo
- **Mô tả / tiêu chí hoàn thành:** Thông báo trong ứng dụng/email cho bàn giao mới và việc theo dõi tiếp đến hạn/quá hạn; chưa mở rộng phức tạp đa kênh.
- **Ưu tiên:** P1
- **Trạng thái:** Chưa bắt đầu
- **Thời gian:** 2027-01-13 -> 2027-01-21 (9 ngày)
- **Công sức:** 4.0 ngày-người
- **Đầu ra/Bằng chứng:** Thông báo v0
- **Trang nguồn:** 2

## 4.10 - Thử nghiệm liên tục kênh gốc trong sản phẩm

- **Nhóm công việc:** Sản phẩm/Kỹ thuật
- **Công việc lớn:** Kênh gốc
- **Mô tả / tiêu chí hoàn thành:** Nếu API/điều khoản cho phép: dùng link/deep-link hoặc luồng gửi có kiểm soát; nếu không, hiển thị kênh/bối cảnh và chuyển lại Marketing khi cần.
- **Ưu tiên:** P1
- **Trạng thái:** Chưa bắt đầu
- **Thời gian:** 2027-01-11 -> 2027-01-22 (12 ngày)
- **Công sức:** 4.0 ngày-người
- **Đầu ra/Bằng chứng:** Liên tục kênh v0
- **Rủi ro/Ghi chú:** Feature may be constrained by Pancake permissions/terms.
- **Trang nguồn:** 2


# 5. Xây dựng MVP — Đo lường & trí tuệ

## 5.1 - Phễu Quản lý v0

- **Nhóm công việc:** Dữ liệu
- **Công việc lớn:** Phễu
- **Mô tả / tiêu chí hoàn thành:** Hội thoại/Lead/Bàn giao/Đã liên hệ/Đạt chuẩn/Won- Lost: số lượng + tỷ lệ chuyển đổi; phân tách theo Sales/nguồn khi dữ liệu đủ tin cậy.
- **Ưu tiên:** P0
- **Trạng thái:** Chưa bắt đầu
- **Thời gian:** 2027-01-11 -> 2027-01-22 (12 ngày)
- **Công sức:** 6.0 ngày-người
- **Đầu ra/Bằng chứng:** Quản lý phễu
- **Trang nguồn:** 2

## 5.2 - Chỉ số SLA

- **Nhóm công việc:** Dữ liệu
- **Công việc lớn:** Phân tích bàn giao
- **Mô tả / tiêu chí hoàn thành:** Số lượng bàn giao, đã nhận/đã liên hệ, trung vị thời gian tới liên hệ đầu tiên, vi phạm, danh sách chưa liên hệ.
- **Ưu tiên:** P0
- **Trạng thái:** Chưa bắt đầu
- **Thời gian:** 2027-01-13 -> 2027-01-22 (10 ngày)
- **Công sức:** 4.0 ngày-người
- **Đầu ra/Bằng chứng:** Handoff báo cáo
- **Trang nguồn:** 2

## 5.3 - Tuân thủ theo dõi tiếp

- **Nhóm công việc:** Dữ liệu
- **Công việc lớn:** Phân tích theo dõi tiếp
- **Mô tả / tiêu chí hoàn thành:** Theo dõi việc đến hạn/hoàn thành/quá hạn theo Sales; hiển thị danh sách quá hạn và xu hướng đơn giản.
- **Ưu tiên:** P1
- **Trạng thái:** Chưa bắt đầu
- **Thời gian:** 2027-01-15 -> 2027-01-25 (11 ngày)
- **Công sức:** 3.0 ngày-người
- **Đầu ra/Bằng chứng:** Follow-up báo cáo
- **Trang nguồn:** 2

## 5.4 - Chỉ số độ bao phủ v0

- **Nhóm công việc:** Dữ liệu
- **Công việc lớn:** Sức khoẻ dữ liệu
- **Mô tả / tiêu chí hoàn thành:** Tính % Lead có nguồn, bàn giao, kết quả Sales và doanh thu; phân loại Đã biết/Suy luận/Không biết cho dòng liên kết nguồn.
- **Ưu tiên:** P0
- **Trạng thái:** Chưa bắt đầu
- **Thời gian:** 2027-01-15 -> 2027-01-27 (13 ngày)
- **Công sức:** 5.0 ngày-người
- **Đầu ra/Bằng chứng:** Sức khoẻ dữ liệu v0
- **Trang nguồn:** 2

## 5.5 - Dòng liên kết nguồn Meta v0

- **Nhóm công việc:** Dữ liệu
- **Công việc lớn:** Liên kết nguồn Meta
- **Mô tả / tiêu chí hoàn thành:** Lưu dòng liên kết campaign/ad có sẵn từ thử nghiệm Pancake/Meta; báo cáo độ bao phủ và phần chưa biết, không tạo độ chính xác giả.
- **Ưu tiên:** P1
- **Trạng thái:** Chưa bắt đầu
- **Thời gian:** 2027-01-11 -> 2027-01-27 (17 ngày)
- **Công sức:** 6.0 ngày-người
- **Đầu ra/Bằng chứng:** Liên kết nguồn Meta v0
- **Trang nguồn:** 2

## 5.6 - Tóm tắt có bằng chứng v0

- **Nhóm công việc:** AI
- **Công việc lớn:** Tóm tắt hội thoại
- **Mô tả / tiêu chí hoàn thành:** Tạo tóm tắt ngắn về nhu cầu/sản phẩm/phản đối/cam kết; liên kết về bằng chứng; người dùng có thể sửa/đánh dấu.
- **Ưu tiên:** P1
- **Trạng thái:** Chưa bắt đầu
- **Thời gian:** 2027-01-04 -> 2027-01-20 (17 ngày)
- **Công sức:** 7.0 ngày-người
- **Đầu ra/Bằng chứng:** Tóm tắt AI v0
- **Trang nguồn:** 2

## 5.7 - Phát hiện cam kết Khách/Sales

- **Nhóm công việc:** AI
- **Công việc lớn:** Cam kết
- **Mô tả / tiêu chí hoàn thành:** Phát hiện cam kết rõ ràng và gợi ý hạn/hành động; ở Alpha chỉ gợi ý trừ khi đã chứng minh ngưỡng độ tin cậy.
- **Ưu tiên:** P1
- **Trạng thái:** Chưa bắt đầu
- **Thời gian:** 2027-01-13 -> 2027-01-27 (15 ngày)
- **Công sức:** 6.0 ngày-người
- **Đầu ra/Bằng chứng:** Gợi ý cam kết v0
- **Trang nguồn:** 2

## 5.8 - Giao diện bằng chứng/độ tin cậy

- **Nhóm công việc:** AI
- **Công việc lớn:** Độ tin cậy
- **Mô tả / tiêu chí hoàn thành:** Hiển thị bằng chứng, độ tin cậy, tin nhắn nguồn và hành động phản hồi; không tự động thay đổi theo cách khó giải thích.
- **Ưu tiên:** P1
- **Trạng thái:** Chưa bắt đầu
- **Thời gian:** 2027-01-20 -> 2027-01-29 (10 ngày)
- **Công sức:** 4.0 ngày-người
- **Đầu ra/Bằng chứng:** AI độ tin cậy UI
- **Trang nguồn:** 2


# 6. Kiểm thử, bảo mật & sẵn sàng Alpha

## 6.1 - Lập ma trận kiểm thử MVP

- **Nhóm công việc:** Kiểm thử (QA)
- **Công việc lớn:** Chiến lược kiểm thử
- **Mô tả / tiêu chí hoàn thành:** Luồng chuẩn + trường hợp biên: Lead trùng, trễ đồng bộ, thiếu số điện thoại, mở lại, sai người phụ trách, nguồn không đầy đủ, sửa Lost/Won.
- **Ưu tiên:** P0
- **Trạng thái:** Chưa bắt đầu
- **Thời gian:** 2027-01-04 -> 2027-01-12 (9 ngày)
- **Công sức:** 3.0 ngày-người
- **Đầu ra/Bằng chứng:** Ma trận kiểm thử
- **Trang nguồn:** 2

## 6.2 - Tạo dữ liệu kiểm thử đại diện

- **Nhóm công việc:** Kiểm thử (QA)
- **Công việc lớn:** Dữ liệu kiểm thử chuẩn
- **Mô tả / tiêu chí hoàn thành:** Dữ liệu tổng hợp/ẩn danh cho 5 kịch bản, định danh đa kênh, hội thoại nhiễu, thiếu nguồn.
- **Ưu tiên:** P0
- **Trạng thái:** Chưa bắt đầu
- **Thời gian:** 2027-01-08 -> 2027-01-15 (8 ngày)
- **Công sức:** 3.0 ngày-người
- **Đầu ra/Bằng chứng:** Dữ liệu kiểm thử chuẩn
- **Trang nguồn:** 2

## 6.3 - Kiểm thử lỗi đồng bộ Pancake

- **Nhóm công việc:** Kiểm thử (QA)
- **Công việc lớn:** Tích hợp
- **Mô tả / tiêu chí hoàn thành:** Token hết hạn, giới hạn tốc độ, webhook/polling trùng, thiếu tin nhắn, kết nối lại, nạp bù.
- **Ưu tiên:** P0
- **Trạng thái:** Chưa bắt đầu
- **Thời gian:** 2027-01-18 -> 2027-01-29 (12 ngày)
- **Công sức:** 5.0 ngày-người
- **Đầu ra/Bằng chứng:** Connector QA báo cáo
- **Trang nguồn:** 2

## 6.4 - Kiểm thử E2E Marketing -> Doanh thu

- **Nhóm công việc:** Kiểm thử (QA)
- **Công việc lớn:** Quy trình
- **Mô tả / tiêu chí hoàn thành:** Tự động/thủ công E2E: hội thoại->lead->handoff- >contact->theo dõi tiếp->Won/Lost->phễu.
- **Ưu tiên:** P0
- **Trạng thái:** Chưa bắt đầu
- **Thời gian:** 2027-01-20 -> 2027-02-02 (14 ngày)
- **Công sức:** 5.0 ngày-người
- **Đầu ra/Bằng chứng:** E2E pass báo cáo
- **Trang nguồn:** 2

## 6.5 - Rà soát RBAC / cách ly khách hàng

- **Nhóm công việc:** Bảo mật
- **Công việc lớn:** Quyền truy cập
- **Mô tả / tiêu chí hoàn thành:** Kiểm tra Sales không truy cập Lead/khách hàng khác; hành động quản trị có kiểm toán; giới hạn quyền truy cập bí mật kết nối.
- **Ưu tiên:** P0
- **Trạng thái:** Chưa bắt đầu
- **Thời gian:** 2027-01-25 -> 2027-02-03 (10 ngày)
- **Công sức:** 3.0 ngày-người
- **Đầu ra/Bằng chứng:** Danh sách kiểm tra bảo mật
- **Trang nguồn:** 2

## 6.6 - Chính sách lưu/xoá dữ liệu ban đầu

- **Nhóm công việc:** Bảo mật
- **Công việc lớn:** Quyền riêng tư
- **Mô tả / tiêu chí hoàn thành:** Định nghĩa thời hạn lưu dữ liệu Pilot, quy trình xoá, xuất/sao lưu, xử lý dữ liệu nhạy cảm; rà soát pháp lý trước khi dùng dữ liệu khách hàng.
- **Ưu tiên:** P0
- **Trạng thái:** Chưa bắt đầu
- **Thời gian:** 2027-01-18 -> 2027-02-05 (19 ngày)
- **Công sức:** 3.0 ngày-người
- **Đầu ra/Bằng chứng:** Chính sách riêng tư/lưu trữ Pilot
- **Trang nguồn:** 2

## 6.7 - Sao lưu/khôi phục + giám sát

- **Nhóm công việc:** Kỹ thuật
- **Công việc lớn:** Độ ổn định
- **Mô tả / tiêu chí hoàn thành:** Sao lưu hàng ngày khi phù hợp, kiểm thử khôi phục, cảnh báo job và trang sức khoẻ kết nối cho nhóm nội bộ.
- **Ưu tiên:** P1
- **Trạng thái:** Chưa bắt đầu
- **Thời gian:** 2027-01-25 -> 2027-02-05 (12 ngày)
- **Công sức:** 4.0 ngày-người
- **Đầu ra/Bằng chứng:** Vận hành readiness
- **Trang nguồn:** 2

## 6.8 - Sự kiện phân tích sản phẩm

- **Nhóm công việc:** Sản phẩm
- **Công việc lớn:** Thiết lập đo lường
- **Mô tả / tiêu chí hoàn thành:** Theo dõi kích hoạt, handoff, contact, theo dõi tiếp, kết quả, phản hồi AI, lỗi; avoid chỉ số MAU hình thức.
- **Ưu tiên:** P1
- **Trạng thái:** Chưa bắt đầu
- **Thời gian:** 2027-01-25 -> 2027-02-05 (12 ngày)
- **Công sức:** 3.0 ngày-người
- **Đầu ra/Bằng chứng:** Gắn đo lường sử dụng
- **Trang nguồn:** 2

## 6.9 - Viết sổ tay triển khai Pilot

- **Nhóm công việc:** Thành công KH/Vận hành
- **Công việc lớn:** Triển khai
- **Mô tả / tiêu chí hoàn thành:** Khám phá -> hiện trạng -> buổi chốt định nghĩa -> cấu hình -> đào tạo -> theo dõi sát -> rà soát tuần -> tổng kết kinh doanh.
- **Ưu tiên:** P0
- **Trạng thái:** Chưa bắt đầu
- **Thời gian:** 2027-01-18 -> 2027-02-05 (19 ngày)
- **Công sức:** 4.0 ngày-người
- **Đầu ra/Bằng chứng:** Sổ tay triển khai
- **Trang nguồn:** 2

## 6.10 - Tạo đào tạo theo vai trò

- **Nhóm công việc:** Thành công KH/Vận hành
- **Công việc lớn:** Đào tạo
- **Mô tả / tiêu chí hoàn thành:** Marketing 30m, Sales 45m, Quản lý 30m; theo tác vụ, không tour tính năng.
- **Ưu tiên:** P0
- **Trạng thái:** Chưa bắt đầu
- **Thời gian:** 2027-01-25 -> 2027-02-08 (15 ngày)
- **Công sức:** 4.0 ngày-người
- **Đầu ra/Bằng chứng:** Tài liệu/kịch bản đào tạo
- **Trang nguồn:** 2

## 6.11 - Chọn 3-5 đối tác thiết kế Đợt 1

- **Nhóm công việc:** Tiếp cận thị trường (GTM)
- **Công việc lớn:** Sẵn sàng Pilot
- **Mô tả / tiêu chí hoàn thành:** Dùng điểm sàng lọc; ký phạm vi/quyền truy cập dữ liệu/cam kết người bảo trợ; ưu tiên cùng ngành nếu có thể.
- **Ưu tiên:** P0
- **Trạng thái:** Chưa bắt đầu
- **Thời gian:** 2027-01-18 -> 2027-02-05 (19 ngày)
- **Công sức:** 3.0 ngày-người
- **Đầu ra/Bằng chứng:** Nhóm Pilot Đợt 1
- **Trang nguồn:** 2

## 6.12 - Thỏa thuận Pilot / DPA tối thiểu

- **Nhóm công việc:** Tiếp cận thị trường (GTM)
- **Công việc lớn:** Hợp đồng
- **Mô tả / tiêu chí hoàn thành:** Phạm vi, trách nhiệm, xử lý dữ liệu, bảo mật thông tin, giới hạn hỗ trợ, phí Pilot nếu áp dụng.
- **Ưu tiên:** P0
- **Trạng thái:** Chưa bắt đầu
- **Thời gian:** 2027-01-25 -> 2027-02-08 (15 ngày)
- **Công sức:** 3.0 ngày-người
- **Đầu ra/Bằng chứng:** Mẫu thỏa thuận Pilot
- **Trang nguồn:** 2

## 6.13 - Tuần dùng thử nội bộ

- **Nhóm công việc:** Sản phẩm
- **Công việc lớn:** Alpha
- **Mô tả / tiêu chí hoàn thành:** Nhóm nòng cốt chạy quy trình mô phỏng + nội bộ; ghi lỗi và điểm ma sát hàng ngày.
- **Ưu tiên:** P0
- **Trạng thái:** Chưa bắt đầu
- **Thời gian:** 2027-02-01 -> 2027-02-05 (5 ngày)
- **Công sức:** 5.0 ngày-người
- **Đầu ra/Bằng chứng:** Nhật ký lỗi dùng thử nội bộ
- **Trang nguồn:** 2

## 6.14 - Cổng 3: Sẵn sàng Alpha?

- **Nhóm công việc:** Sản phẩm
- **Công việc lớn:** Quyết định qua cổng
- **Mô tả / tiêu chí hoàn thành:** Cho Pilot chạy nếu E2E P0 đạt, không có lỗi bảo mật nghiêm trọng, sổ tay/đào tạo sẵn sàng và kết nối đủ ổn định.
- **Ưu tiên:** P0
- **Trạng thái:** Chưa bắt đầu
- **Thời gian:** 2027-02-12 -> 2027-02-12 (1 ngày)
- **Công sức:** 1.0 ngày-người
- **Cổng/Mốc:** Cổng 3 - 12/02
- **Đầu ra/Bằng chứng:** Quyết định Alpha đi/không đi
- **Trang nguồn:** 2


# 7. Pilot với đối tác thiết kế — Đợt 1

## 7.1 - Khởi động + lập bản đồ quy trình từng đối tác

- **Nhóm công việc:** Triển khai
- **Công việc lớn:** Chuẩn bị Pilot
- **Mô tả / tiêu chí hoàn thành:** Lập bản đồ thu hút khách -> Pancake -> bàn giao -> Sales - > kết quả; xác định điểm khác so với chuẩn.
- **Ưu tiên:** P0
- **Trạng thái:** Chưa bắt đầu
- **Thời gian:** 2027-02-15 -> 2027-02-19 (5 ngày)
- **Công sức:** 5.0 ngày-người
- **Đầu ra/Bằng chứng:** Hiện tại-trạng thái maps
- **Trang nguồn:** 2

## 7.2 - Chỉ số hiện trạng từng đối tác

- **Nhóm công việc:** Triển khai
- **Công việc lớn:** Đo hiện trạng
- **Mô tả / tiêu chí hoàn thành:** Số lượng Lead, thời gian liên hệ đầu tiên, mất mát bàn giao, theo dõi tiếp, độ bao phủ kết quả, công sức báo cáo trước Pilot.
- **Ưu tiên:** P0
- **Trạng thái:** Chưa bắt đầu
- **Thời gian:** 2027-02-15 -> 2027-02-19 (5 ngày)
- **Công sức:** 3.0 ngày-người
- **Đầu ra/Bằng chứng:** Bảng điểm hiện trạng
- **Trang nguồn:** 2

## 7.3 - Buổi chốt định nghĩa doanh thu

- **Nhóm công việc:** Triển khai
- **Công việc lớn:** Định nghĩa nghiệp vụ
- **Mô tả / tiêu chí hoàn thành:** Thống nhất Lead/Đạt chuẩn/Không liên hệ được/Won/Lost/Doanh thu/SLA; ghi lại ngoại lệ.
- **Ưu tiên:** P0
- **Trạng thái:** Chưa bắt đầu
- **Thời gian:** 2027-02-16 -> 2027-02-19 (4 ngày)
- **Công sức:** 4.0 ngày-người
- **Đầu ra/Bằng chứng:** Hợp đồng dữ liệu khách hàng
- **Trang nguồn:** 2

## 7.4 - Kết nối Pancake + cấu hình không gian khách hàng

- **Nhóm công việc:** Triển khai
- **Công việc lớn:** Thiết lập
- **Mô tả / tiêu chí hoàn thành:** Tạo thủ công, người dùng/vai trò, định nghĩa đo lường, ánh xạ nguồn, kiểm tra sức khoẻ dữ liệu.
- **Ưu tiên:** P0
- **Trạng thái:** Chưa bắt đầu
- **Thời gian:** 2027-02-17 -> 2027-02-22 (6 ngày)
- **Công sức:** 4.0 ngày-người
- **Đầu ra/Bằng chứng:** Không gian làm việc đã cấu hình
- **Trang nguồn:** 2

## 7.5 - Đào tạo Marketing / Sales / Quản lý

- **Nhóm công việc:** Triển khai
- **Công việc lớn:** Đào tạo
- **Mô tả / tiêu chí hoàn thành:** Đào tạo theo vai trò, hoàn thành 1 luồng Lead thật, ghi lại điểm gây khó hiểu.
- **Ưu tiên:** P0
- **Trạng thái:** Chưa bắt đầu
- **Thời gian:** 2027-02-22 -> 2027-02-24 (3 ngày)
- **Công sức:** 4.0 ngày-người
- **Đầu ra/Bằng chứng:** Trained pilot người dùng
- **Trang nguồn:** 2

## 7.6 - Đợt 1 vận hành thật

- **Nhóm công việc:** Triển khai
- **Công việc lớn:** Vận hành thật
- **Mô tả / tiêu chí hoàn thành:** Bắt đầu xử lý Lead thật; hỗ trợ hàng ngày trong tuần đầu; nhóm sản phẩm theo dõi chỉ số trọng yếu.
- **Ưu tiên:** P0
- **Trạng thái:** Chưa bắt đầu
- **Thời gian:** 2027-02-24 -> 2027-02-24 (1 ngày)
- **Công sức:** 1.0 ngày-người
- **Cổng/Mốc:** Mốc: Đợt 1 vận hành thật
- **Đầu ra/Bằng chứng:** Pilot vận hành thật
- **Trang nguồn:** 2

## 7.7 - Theo dõi sát tuần 1

- **Nhóm công việc:** Thành công KH/Vận hành
- **Công việc lớn:** Theo dõi sát
- **Mô tả / tiêu chí hoàn thành:** Quan sát hành vi bàn giao/liên hệ/kết quả; không chỉ dựa vào yêu cầu tính năng; ghi cách xử lý tạm và khoảng trống dữ liệu.
- **Ưu tiên:** P0
- **Trạng thái:** Chưa bắt đầu
- **Thời gian:** 2027-02-24 -> 2027-03-03 (8 ngày)
- **Công sức:** 5.0 ngày-người
- **Đầu ra/Bằng chứng:** Theo dõi thực tế findings
- **Trang nguồn:** 2

## 7.8 - Sửa lỗi P0/P1 của Pilot

- **Nhóm công việc:** Kỹ thuật
- **Công việc lớn:** Hỗ trợ Pilot
- **Mô tả / tiêu chí hoàn thành:** Phân loại hàng ngày; chỉ hotfix lỗi nghiêm trọng; tránh để nhóm bị kéo vào yêu cầu tuỳ biến trừ khi đó là trở ngại lặp lại.
- **Ưu tiên:** P0
- **Trạng thái:** Chưa bắt đầu
- **Thời gian:** 2027-02-24 -> 2027-03-12 (17 ngày)
- **Công sức:** 8.0 ngày-người
- **Đầu ra/Bằng chứng:** Các bản vá ổn định Pilot
- **Trang nguồn:** 3

## 7.9 - Rà soát doanh thu hàng tuần #1-#4

- **Nhóm công việc:** Thành công KH/Vận hành
- **Công việc lớn:** Rà soát hàng tuần
- **Mô tả / tiêu chí hoàn thành:** Rà soát Lead/bàn giao/liên hệ/theo dõi tiếp/kết quả/sức khoẻ dữ liệu + điểm rơi rớt lớn nhất; ghi lại quyết định khách hàng.
- **Ưu tiên:** P0
- **Trạng thái:** Chưa bắt đầu
- **Thời gian:** 2027-03-01 -> 2027-03-26 (26 ngày)
- **Công sức:** 8.0 ngày-người
- **Đầu ra/Bằng chứng:** 4 ghi chép rà soát tuần
- **Trang nguồn:** 3

## 7.10 - Đo mức sử dụng & hành vi

- **Nhóm công việc:** Nghiên cứu
- **Công việc lớn:** Mức độ sử dụng
- **Mô tả / tiêu chí hoàn thành:** % Lead đi qua sản phẩm, Sales thực sự xử lý, độ bao phủ kết quả, mức hoàn thành theo dõi tiếp, mẫu lách quy trình.
- **Ưu tiên:** P0
- **Trạng thái:** Chưa bắt đầu
- **Thời gian:** 2027-03-01 -> 2027-03-26 (26 ngày)
- **Công sức:** 4.0 ngày-người
- **Đầu ra/Bằng chứng:** Mức sử dụng dashboard
- **Trang nguồn:** 3

## 7.11 - Đo tác động kinh doanh

- **Nhóm công việc:** Nghiên cứu
- **Công việc lớn:** Giá trị
- **Mô tả / tiêu chí hoàn thành:** So sánh hiện trạng với Pilot: liên hệ đầu tiên, chưa liên hệ, quá hạn, thời gian quản lý làm báo cáo, Lead thu hồi có bằng chứng.
- **Ưu tiên:** P0
- **Trạng thái:** Chưa bắt đầu
- **Thời gian:** 2027-03-15 -> 2027-03-31 (17 ngày)
- **Công sức:** 4.0 ngày-người
- **Đầu ra/Bằng chứng:** Phân tích tác động Pilot
- **Trang nguồn:** 3

## 7.12 - Theo dõi phần chuẩn vs tuỳ biến theo đối tác

- **Nhóm công việc:** Sản phẩm
- **Công việc lớn:** Khả năng lặp lại
- **Mô tả / tiêu chí hoàn thành:** Mỗi phân loại điểm khác: mẫu theo ngành, cấu hình, riêng lẻ, thiếu lõi thật.
- **Ưu tiên:** P0
- **Trạng thái:** Chưa bắt đầu
- **Thời gian:** 2027-02-24 -> 2027-03-31 (36 ngày)
- **Công sức:** 4.0 ngày-người
- **Đầu ra/Bằng chứng:** Ma trận khả năng lặp lại
- **Trang nguồn:** 3

## 7.13 - Kiểm tra gia hạn/tiếp tục trả phí

- **Nhóm công việc:** Tiếp cận thị trường (GTM)
- **Công việc lớn:** Thương mại
- **Mô tả / tiêu chí hoàn thành:** Thảo luận giá trị, mức sẵn sàng chi trả, phí triển khai và mô hình định kỳ trước khi Pilot kết thúc; ghi lại phản đối.
- **Ưu tiên:** P0
- **Trạng thái:** Chưa bắt đầu
- **Thời gian:** 2027-03-22 -> 2027-04-01 (11 ngày)
- **Công sức:** 3.0 ngày-người
- **Đầu ra/Bằng chứng:** Commercial bằng chứng
- **Trang nguồn:** 3

## 7.14 - Tổng kết kinh doanh Đợt 1

- **Nhóm công việc:** Sản phẩm
- **Công việc lớn:** Tổng kết kinh doanh
- **Mô tả / tiêu chí hoàn thành:** Trình bày trước/sau, lưu ý về sức khoẻ dữ liệu, giá trị thu hồi, mức sử dụng, trở ngại chưa giải quyết và trích dẫn/quyết định của khách hàng.
- **Ưu tiên:** P0
- **Trạng thái:** Chưa bắt đầu
- **Thời gian:** 2027-04-01 -> 2027-04-02 (2 ngày)
- **Công sức:** 3.0 ngày-người
- **Cổng/Mốc:** Cổng 4 - 02/04
- **Đầu ra/Bằng chứng:** Tổng kết kinh doanh Đợt 1
- **Trang nguồn:** 3

## 7.15 - Cổng 4: giá trị có lặp lại?

- **Nhóm công việc:** Sản phẩm
- **Công việc lớn:** Quyết định qua cổng
- **Mô tả / tiêu chí hoàn thành:** Quyết định tiếp tục/thu hẹp/chuyên sâu theo ngành. Gợi ý đạt: 3+ đối tác cho thấy giá trị rõ, quy trình phần lớn lặp lại, công sức triển khai giảm và người bảo trợ sẵn sàng trả tiền/tiếp tục.
- **Ưu tiên:** P0
- **Trạng thái:** Chưa bắt đầu
- **Thời gian:** 2027-04-02 -> 2027-04-02 (1 ngày)
- **Công sức:** 1.0 ngày-người
- **Cổng/Mốc:** Cổng 4 - 02/04
- **Đầu ra/Bằng chứng:** Quyết định Đợt 2
- **Trang nguồn:** 3


# 8. Chuẩn hoá sản phẩm v0.2

## 8.1 - Tổng hợp bài học Đợt 1

- **Nhóm công việc:** Sản phẩm
- **Công việc lớn:** Tổng hợp nghiên cứu
- **Mô tả / tiêu chí hoàn thành:** Xếp hạng trở ngại lặp lại/yếu tố tạo giá trị; loại yêu cầu đơn lẻ; cập nhật ICP và nguyên tắc sản phẩm.
- **Ưu tiên:** P0
- **Trạng thái:** Chưa bắt đầu
- **Thời gian:** 2027-04-05 -> 2027-04-07 (3 ngày)
- **Công sức:** 2.0 ngày-người
- **Đầu ra/Bằng chứng:** Bản ghi nhớ bài học
- **Trang nguồn:** 3

## 8.2 - Xác định thay đổi v0.2

- **Nhóm công việc:** Sản phẩm
- **Công việc lớn:** Phạm vi
- **Mô tả / tiêu chí hoàn thành:** Chỉ thay đổi những gì giúp tăng khả năng lặp lại, giảm thời gian triển khai, tăng chất lượng dữ liệu hoặc giá trị cốt lõi.
- **Ưu tiên:** P0
- **Trạng thái:** Chưa bắt đầu
- **Thời gian:** 2027-04-07 -> 2027-04-08 (2 ngày)
- **Công sức:** 1.0 ngày-người
- **Đầu ra/Bằng chứng:** v0.2 phạm vi
- **Trang nguồn:** 3

## 8.3 - Công cụ thiết lập nội bộ

- **Nhóm công việc:** Kỹ thuật
- **Công việc lớn:** Hướng dẫn triển khai ban đầu
- **Mô tả / tiêu chí hoàn thành:** Giảm công việc thủ công khi tạo tổ chức/người dùng/kết nối/cấu hình; chưa có tự phục vụ công khai.
- **Ưu tiên:** P1
- **Trạng thái:** Chưa bắt đầu
- **Thời gian:** 2027-04-05 -> 2027-04-16 (12 ngày)
- **Công sức:** 5.0 ngày-người
- **Đầu ra/Bằng chứng:** Công cụ cấu hình v0.2
- **Trang nguồn:** 3

## 8.4 - Sửa 3 khoảng trống lớn nhất về dòng liên kết nguồn/sức khoẻ dữ liệu

- **Nhóm công việc:** Sản phẩm/Kỹ thuật
- **Công việc lớn:** Chất lượng dữ liệu
- **Mô tả / tiêu chí hoàn thành:** Ưu tiên lỗi thiếu nguồn/kết quả/trùng lặp quan sát được trong Pilot.
- **Ưu tiên:** P0
- **Trạng thái:** Chưa bắt đầu
- **Thời gian:** 2027-04-05 -> 2027-04-16 (12 ngày)
- **Công sức:** 6.0 ngày-người
- **Đầu ra/Bằng chứng:** Cải thiện sức khoẻ dữ liệu
- **Trang nguồn:** 3

## 8.5 - Sửa 3 điểm ma sát lớn nhất của Sales

- **Nhóm công việc:** Sản phẩm/Kỹ thuật
- **Công việc lớn:** Mức độ sử dụng
- **Mô tả / tiêu chí hoàn thành:** Giảm số thao tác, cải thiện hàng đợi/bối cảnh, làm rõ trạng thái; dựa trên hành vi quan sát, không chỉ yêu cầu.
- **Ưu tiên:** P0
- **Trạng thái:** Chưa bắt đầu
- **Thời gian:** 2027-04-05 -> 2027-04-16 (12 ngày)
- **Công sức:** 6.0 ngày-người
- **Đầu ra/Bằng chứng:** Trải nghiệm Sales v0.2
- **Trang nguồn:** 3

## 8.6 - Chuẩn hoá gói triển khai

- **Nhóm công việc:** Thành công KH/Vận hành
- **Công việc lớn:** Triển khai
- **Mô tả / tiêu chí hoàn thành:** Mẫu cho khởi động, định nghĩa, thiết lập, đào tạo, rà soát tuần; đo số giờ-người triển khai.
- **Ưu tiên:** P0
- **Trạng thái:** Chưa bắt đầu
- **Thời gian:** 2027-04-05 -> 2027-04-14 (10 ngày)
- **Công sức:** 4.0 ngày-người
- **Đầu ra/Bằng chứng:** Bộ triển khai v1
- **Trang nguồn:** 3

## 8.7 - Hoàn thiện gói Pilot trả phí

- **Nhóm công việc:** Tiếp cận thị trường (GTM)
- **Công việc lớn:** Gói chào bán
- **Mô tả / tiêu chí hoàn thành:** Dùng bằng chứng Đợt 1 để viết lại điều kiện sàng lọc, phạm vi, khoảng giá, tiêu chí thành công và loại trừ.
- **Ưu tiên:** P0
- **Trạng thái:** Chưa bắt đầu
- **Thời gian:** 2027-04-05 -> 2027-04-09 (5 ngày)
- **Công sức:** 2.0 ngày-người
- **Đầu ra/Bằng chứng:** Gói Pilot trả phí v1
- **Trang nguồn:** 3


# 9. Pilot trả phí — Đợt 2

## 9.1 - Tuyển 5-10 khách tiềm năng cho Pilot trả phí

- **Nhóm công việc:** Tiếp cận thị trường (GTM)
- **Công việc lớn:** Danh sách cơ hội bán hàng
- **Mô tả / tiêu chí hoàn thành:** Ưu tiên cùng ICP/ngành; sàng lọc bằng bảng chấm điểm chuẩn; không nhận dự án CRM riêng.
- **Ưu tiên:** P0
- **Trạng thái:** Chưa bắt đầu
- **Thời gian:** 2027-04-05 -> 2027-04-23 (19 ngày)
- **Công sức:** 5.0 ngày-người
- **Đầu ra/Bằng chứng:** Danh sách cơ hội Đợt 2
- **Trang nguồn:** 3

## 9.2 - Thực hiện khám phá/demo chuẩn

- **Nhóm công việc:** Tiếp cận thị trường (GTM)
- **Công việc lớn:** Sales
- **Mô tả / tiêu chí hoàn thành:** Dùng demo theo quy trình vấn đề; ghi lại độ dài chu kỳ bán và phản đối; tránh bán theo danh sách tính năng.
- **Ưu tiên:** P0
- **Trạng thái:** Chưa bắt đầu
- **Thời gian:** 2027-04-12 -> 2027-04-30 (19 ngày)
- **Công sức:** 5.0 ngày-người
- **Đầu ra/Bằng chứng:** Ghi chép khám phá/demo
- **Trang nguồn:** 3

## 9.3 - Chốt 5+ Pilot trả phí

- **Nhóm công việc:** Tiếp cận thị trường (GTM)
- **Công việc lớn:** Thương mại
- **Mô tả / tiêu chí hoàn thành:** Kiểm tra phí Pilot + đề xuất phí định kỳ; chấp nhận hoá đơn/hợp đồng thủ công.
- **Ưu tiên:** P0
- **Trạng thái:** Chưa bắt đầu
- **Thời gian:** 2027-04-19 -> 2027-05-07 (19 ngày)
- **Công sức:** 4.0 ngày-người
- **Đầu ra/Bằng chứng:** Hợp đồng Pilot trả phí
- **Trang nguồn:** 3

## 9.4 - Triển khai Đợt 2 bằng sổ tay chuẩn

- **Nhóm công việc:** Triển khai
- **Công việc lớn:** Hướng dẫn triển khai ban đầu
- **Mô tả / tiêu chí hoàn thành:** Theo dõi giờ theo khách, điểm khác và thời gian tới giá trị; nhóm không được tuỳ biến không giới hạn.
- **Ưu tiên:** P0
- **Trạng thái:** Chưa bắt đầu
- **Thời gian:** 2027-04-26 -> 2027-05-14 (19 ngày)
- **Công sức:** 10.0 ngày-người
- **Đầu ra/Bằng chứng:** Các lần vận hành thật Đợt 2
- **Trang nguồn:** 3

## 9.5 - Theo dõi hiệu quả kinh tế triển khai/hỗ trợ

- **Nhóm công việc:** Đo lường
- **Công việc lớn:** Hiệu quả kinh tế
- **Mô tả / tiêu chí hoàn thành:** Giờ thiết lập, yêu cầu hỗ trợ, chi phí hạ tầng/AI, quy mô khách hàng, doanh thu; so với mô hình mục tiêu.
- **Ưu tiên:** P0
- **Trạng thái:** Chưa bắt đầu
- **Thời gian:** 2027-04-26 -> 2027-05-21 (26 ngày)
- **Công sức:** 3.0 ngày-người
- **Đầu ra/Bằng chứng:** Hiệu quả kinh tế triển khai
- **Trang nguồn:** 3

## 9.6 - Theo dõi chỉ báo sớm về mức sử dụng/giá trị trong 30 ngày

- **Nhóm công việc:** Đo lường
- **Công việc lớn:** Duy trì sử dụng/Giá trị
- **Mô tả / tiêu chí hoàn thành:** Mức sử dụng, độ bao phủ kết quả, tỷ lệ tuân thủ theo dõi tiếp, mức sử dụng hàng tuần của quản lý và mức sẵn sàng tiếp tục.
- **Ưu tiên:** P0
- **Trạng thái:** Chưa bắt đầu
- **Thời gian:** 2027-05-03 -> 2027-05-28 (26 ngày)
- **Công sức:** 4.0 ngày-người
- **Đầu ra/Bằng chứng:** Bảng theo dõi giá trị Đợt 2
- **Trang nguồn:** 3

## 9.7 - Cập nhật ma trận khả năng lặp lại

- **Nhóm công việc:** Sản phẩm
- **Công việc lớn:** Khả năng lặp lại
- **Mô tả / tiêu chí hoàn thành:** Mục tiêu cần biết: >=70-80% quy trình có thể chuẩn hoá; xác định mẫu theo ngành và thay đổi lõi.
- **Ưu tiên:** P0
- **Trạng thái:** Chưa bắt đầu
- **Thời gian:** 2027-05-17 -> 2027-05-28 (12 ngày)
- **Công sức:** 3.0 ngày-người
- **Đầu ra/Bằng chứng:** Khả năng lặp lại v2
- **Trang nguồn:** 3


# 10. Sẵn sàng thương mại

## 10.1 - Chốt ICP v1 cho ra mắt giới hạn

- **Nhóm công việc:** Chiến lược
- **Công việc lớn:** ICP
- **Mô tả / tiêu chí hoàn thành:** Định nghĩa rõ khách nào được bán và điều kiện loại trừ dựa trên bằng chứng Đợt 1+2.
- **Ưu tiên:** P0
- **Trạng thái:** Chưa bắt đầu
- **Thời gian:** 2027-05-24 -> 2027-05-28 (5 ngày)
- **Công sức:** 1.5 ngày-người
- **Đầu ra/Bằng chứng:** ICP v1
- **Trang nguồn:** 3

## 10.2 - Chốt định vị/thông điệp v1

- **Nhóm công việc:** Tiếp cận thị trường (GTM)
- **Công việc lớn:** Định vị
- **Mô tả / tiêu chí hoàn thành:** Định vị theo vấn đề; nội bộ có thể giữ tên Revenue Continuity, còn thông điệp công khai phải cụ thể.
- **Ưu tiên:** P1
- **Trạng thái:** Chưa bắt đầu
- **Thời gian:** 2027-05-24 -> 2027-05-31 (8 ngày)
- **Công sức:** 2.0 ngày-người
- **Đầu ra/Bằng chứng:** Thông điệp v1
- **Trang nguồn:** 3

## 10.3 - Chốt gói/định giá v1

- **Nhóm công việc:** Tiếp cận thị trường (GTM)
- **Công việc lớn:** Định giá
- **Mô tả / tiêu chí hoàn thành:** Quyết định phí triển khai + phí nền tảng/phí theo mức sử dụng định kỳ; không mặc định theo seat nếu chưa có bằng chứng.
- **Ưu tiên:** P0
- **Trạng thái:** Chưa bắt đầu
- **Thời gian:** 2027-05-24 -> 2027-06-02 (10 ngày)
- **Công sức:** 2.0 ngày-người
- **Đầu ra/Bằng chứng:** Định giá v1
- **Trang nguồn:** 3

## 10.4 - Trang giới thiệu + CTA đăng ký

- **Nhóm công việc:** Tiếp cận thị trường (GTM)
- **Công việc lớn:** Trang web
- **Mô tả / tiêu chí hoàn thành:** Ban đầu không tự đăng ký; Đặt lịch rà soát quy trình / Đăng ký Pilot; nêu điều kiện phù hợp và bằng chứng tình huống.
- **Ưu tiên:** P1
- **Trạng thái:** Chưa bắt đầu
- **Thời gian:** 2027-05-31 -> 2027-06-07 (8 ngày)
- **Công sức:** 4.0 ngày-người
- **Đầu ra/Bằng chứng:** Trang giới thiệu ra mắt
- **Trang nguồn:** 3

## 10.5 - Kịch bản demo + xử lý phản đối

- **Nhóm công việc:** Tiếp cận thị trường (GTM)
- **Công việc lớn:** Tài liệu hỗ trợ Sales
- **Mô tả / tiêu chí hoàn thành:** Vì sao không chỉ dùng CRM/Pancake/Excel+n8n; lưu ý về độ chính xác dữ liệu; kỳ vọng triển khai.
- **Ưu tiên:** P1
- **Trạng thái:** Chưa bắt đầu
- **Thời gian:** 2027-05-31 -> 2027-06-07 (8 ngày)
- **Công sức:** 3.0 ngày-người
- **Đầu ra/Bằng chứng:** Sổ tay Sales v1
- **Trang nguồn:** 3

## 10.6 - Chính sách hỗ trợ & chuyển cấp

- **Nhóm công việc:** Thành công KH/Vận hành
- **Công việc lớn:** Hỗ trợ
- **Mô tả / tiêu chí hoàn thành:** Định nghĩa kênh, mức nghiêm trọng, mục tiêu phản hồi, luồng sự cố kết nối và trách nhiệm khách hàng.
- **Ưu tiên:** P0
- **Trạng thái:** Chưa bắt đầu
- **Thời gian:** 2027-05-24 -> 2027-06-02 (10 ngày)
- **Công sức:** 2.0 ngày-người
- **Đầu ra/Bằng chứng:** Chính sách hỗ trợ
- **Trang nguồn:** 3

## 10.7 - Chương trình triển khai & sử dụng 30 ngày

- **Nhóm công việc:** Thành công KH/Vận hành
- **Công việc lớn:** Thành công khách hàng
- **Mô tả / tiêu chí hoàn thành:** Các mốc chuẩn từ khởi động đến tổng kết kinh doanh đầu tiên; định nghĩa chỉ số sức khoẻ.
- **Ưu tiên:** P1
- **Trạng thái:** Chưa bắt đầu
- **Thời gian:** 2027-05-24 -> 2027-06-04 (12 ngày)
- **Công sức:** 3.0 ngày-người
- **Đầu ra/Bằng chứng:** Sổ tay Thành công KH v1
- **Trang nguồn:** 3

## 10.8 - Điều khoản / Quyền riêng tư / DPA ban đầu

- **Nhóm công việc:** Pháp lý/Bảo mật
- **Công việc lớn:** Pháp lý thương mại
- **Mô tả / tiêu chí hoàn thành:** Rà soát xử lý dữ liệu khách hàng, sử dụng AI, nhà xử lý phụ, lưu/xoá dữ liệu và trách nhiệm kết nối.
- **Ưu tiên:** P0
- **Trạng thái:** Chưa bắt đầu
- **Thời gian:** 2027-05-17 -> 2027-06-04 (19 ngày)
- **Công sức:** 4.0 ngày-người
- **Đầu ra/Bằng chứng:** Bộ pháp lý thương mại
- **Trang nguồn:** 3

## 10.9 - Danh sách kiểm tra bảo mật cho v1 thương mại

- **Nhóm công việc:** Bảo mật
- **Công việc lớn:** Sẵn sàng bảo mật
- **Mô tả / tiêu chí hoàn thành:** Cách ly khách hàng, lưu thông tin xác thực, kiểm toán, sao lưu, ứng phó sự cố, rà soát quyền truy cập; ghi rõ giới hạn đã biết.
- **Ưu tiên:** P0
- **Trạng thái:** Chưa bắt đầu
- **Thời gian:** 2027-05-17 -> 2027-06-04 (19 ngày)
- **Công sức:** 4.0 ngày-người
- **Đầu ra/Bằng chứng:** Security readiness báo cáo
- **Trang nguồn:** 3

## 10.10 - Quy trình thanh toán/hóa đơn thủ công

- **Nhóm công việc:** Tài chính/Vận hành
- **Công việc lớn:** Thanh toán
- **Mô tả / tiêu chí hoàn thành:** Định nghĩa lịch hợp đồng/hóa đơn/gia hạn; chưa cần hệ thống thanh toán tự phục vụ.
- **Ưu tiên:** P1
- **Trạng thái:** Chưa bắt đầu
- **Thời gian:** 2027-05-31 -> 2027-06-04 (5 ngày)
- **Công sức:** 1.5 ngày-người
- **Đầu ra/Bằng chứng:** Quy trình thanh toán
- **Trang nguồn:** 3

## 10.11 - Đóng phạm vi v1

- **Nhóm công việc:** Sản phẩm
- **Công việc lớn:** Phát hành
- **Mô tả / tiêu chí hoàn thành:** Đóng phạm vi ra mắt giới hạn; tạo danh sách việc sau ra mắt; không thêm tính năng tuỳ biến muộn.
- **Ưu tiên:** P0
- **Trạng thái:** Chưa bắt đầu
- **Thời gian:** 2027-06-01 -> 2027-06-03 (3 ngày)
- **Công sức:** 1.0 ngày-người
- **Đầu ra/Bằng chứng:** v1 release phạm vi
- **Trang nguồn:** 3

## 10.12 - Cổng 5: Sẵn sàng thương mại?

- **Nhóm công việc:** Chiến lược
- **Công việc lớn:** Quyết định qua cổng
- **Mô tả / tiêu chí hoàn thành:** Đạt nếu giá trị lặp lại, khách sẵn sàng trả phí, hiệu quả kinh tế triển khai chấp nhận được, độ tin cậy dữ liệu/bảo mật đủ mức và sổ tay hỗ trợ sẵn sàng.
- **Ưu tiên:** P0
- **Trạng thái:** Chưa bắt đầu
- **Thời gian:** 2027-06-04 -> 2027-06-04 (1 ngày)
- **Công sức:** 1.0 ngày-người
- **Cổng/Mốc:** Cổng 5 - 04/06
- **Đầu ra/Bằng chứng:** Ra mắt giới hạn decision
- **Trang nguồn:** 3


# 11. Ra mắt thương mại giới hạn & ổn định

## 11.1 - Bản ứng viên phát hành v1

- **Nhóm công việc:** Phát hành/Triển khai
- **Công việc lớn:** Phát hành
- **Mô tả / tiêu chí hoàn thành:** Phát hành bản v1 có đánh dấu phiên bản, kế hoạch chuyển đổi/hoàn tác, kiểm thử nhanh và ngưỡng giám sát.
- **Ưu tiên:** P0
- **Trạng thái:** Chưa bắt đầu
- **Thời gian:** 2027-06-07 -> 2027-06-11 (5 ngày)
- **Công sức:** 3.0 ngày-người
- **Đầu ra/Bằng chứng:** Bản ứng viên phát hành v1 (RC)
- **Trang nguồn:** 3

## 11.2 - Ra mắt giới hạn

- **Nhóm công việc:** Phát hành/Triển khai
- **Công việc lớn:** Ra mắt
- **Mô tả / tiêu chí hoàn thành:** Chỉ mở bán cho ICP đạt chuẩn; mặc định vẫn tạo tài khoản thủ công + triển khai có hướng dẫn.
- **Ưu tiên:** P0
- **Trạng thái:** Chưa bắt đầu
- **Thời gian:** 2027-06-14 -> 2027-06-14 (1 ngày)
- **Công sức:** 1.0 ngày-người
- **Cổng/Mốc:** Mốc: 14/06/2027
- **Đầu ra/Bằng chứng:** v1 thương mại giới hạn
- **Trang nguồn:** 3

## 11.3 - Phân loại vấn đề ra mắt hàng ngày — 2 tuần đầu

- **Nhóm công việc:** Thành công KH/Vận hành
- **Công việc lớn:** Ổn định hệ thống
- **Mô tả / tiêu chí hoàn thành:** Rà soát sự cố, kích hoạt, sức khoẻ kết nối, hỗ trợ, độ bao phủ dữ liệu; chỉ ưu tiên P0/P1.
- **Ưu tiên:** P0
- **Trạng thái:** Chưa bắt đầu
- **Thời gian:** 2027-06-14 -> 2027-06-25 (12 ngày)
- **Công sức:** 6.0 ngày-người
- **Đầu ra/Bằng chứng:** Nhật ký xử lý sự cố khi ra mắt
- **Trang nguồn:** 3

## 11.4 - Theo dõi chỉ số nhóm ra mắt

- **Nhóm công việc:** Đo lường
- **Công việc lớn:** Chỉ số ra mắt
- **Mô tả / tiêu chí hoàn thành:** Danh sách cơ hội đạt chuẩn, tỷ lệ chốt, giờ triển khai ban đầu, kích hoạt, độ bao phủ kết quả, mức sử dụng hàng tuần của quản lý, gánh nặng hỗ trợ.
- **Ưu tiên:** P0
- **Trạng thái:** Chưa bắt đầu
- **Thời gian:** 2027-06-14 -> 2027-06-30 (17 ngày)
- **Công sức:** 3.0 ngày-người
- **Đầu ra/Bằng chứng:** Bảng theo dõi nhóm ra mắt
- **Trang nguồn:** 3

## 11.5 - Danh sách bài học 30 ngày

- **Nhóm công việc:** Sản phẩm
- **Công việc lớn:** Bài học
- **Mô tả / tiêu chí hoàn thành:** Ghi lại ma sát lặp lại, khoảng trống sản phẩm, phản đối GTM và đầu việc triển khai; gắn nhãn Lõi/Theo ngành/Riêng lẻ.
- **Ưu tiên:** P1
- **Trạng thái:** Chưa bắt đầu
- **Thời gian:** 2027-06-14 -> 2027-06-30 (17 ngày)
- **Công sức:** 2.0 ngày-người
- **Đầu ra/Bằng chứng:** Danh sách việc sau ra mắt
- **Trang nguồn:** 3

## 11.6 - Quyết định hướng mở rộng

- **Nhóm công việc:** Chiến lược
- **Công việc lớn:** Giai đoạn tiếp theo
- **Mô tả / tiêu chí hoàn thành:** Rà soát cuối tháng 6: tiếp tục bán có Sales dẫn dắt, chuyên sâu hơn theo ngành, thêm kết nối nguồn thu hút khách, đầu tư tự phục vụ hoặc lùi lại theo bằng chứng.
- **Ưu tiên:** P0
- **Trạng thái:** Chưa bắt đầu
- **Thời gian:** 2027-06-30 -> 2027-06-30 (1 ngày)
- **Công sức:** 1.0 ngày-người
- **Cổng/Mốc:** Mốc: Rà soát tháng 6
- **Đầu ra/Bằng chứng:** Quyết định chiến lược nửa cuối 2027
- **Trang nguồn:** 4
