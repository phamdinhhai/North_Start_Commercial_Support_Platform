# Kế hoạch dự án dành cho AI Coding
> **Vai trò của file này:** nguồn context dễ đọc cho AI Coding. Bản dữ liệu có cấu trúc nằm tại `docs/project/project_plan.yaml`. Bản Excel là công cụ quản trị trực quan cho con người.
## 1. Mục tiêu dự án
Xây dựng Revenue Continuity Platform: nối **thu hút khách hàng → Pancake conversation → Lead → bàn giao Marketing sang Sales → theo dõi tiếp → kết quả → doanh thu → đo lường/learning**. Sản phẩm ban đầu là SaaS-ready nhưng triển khai theo mô hình pilot có hướng dẫn, chưa phải self-service SaaS.
### Phạm vi giá trị ban đầu
`Pancake Conversation → Lead → Bàn giao giàu ngữ cảnh → Sales Work Queue → Follow-up → Outcome → Manager Funnel`
### Không ưu tiên ở giai đoạn đầu
- Không xây lại social inbox của Pancake.
- Không xây full CRM/ERP/POS.
- Không xây workflow builder tổng quát.
- Không mở public signup/billing/self-service trước khi chứng minh tính lặp lại.
- Không mở rộng hàng loạt connector quảng cáo trước khi core loop hoạt động.
## 2. Quy tắc AI phải tuân thủ
1. **Không nhảy phase.** Trước khi thực hiện task build, kiểm tra dependency và cổng quyết định liên quan.
2. **Không biến hypothesis thành fact.** Nếu yêu cầu kỹ thuật phụ thuộc Pancake API/terms hoặc dữ liệu chưa xác minh, đánh dấu cần xác minh.
3. **Không tự mở rộng scope.** Feature request không có trong P0/P1 hoặc không phục vụ core loop phải được ghi vào backlog thay vì code ngay.
4. **Ưu tiên vertical slice có giá trị.** Behavior capture → data integrity → intelligence; dashboard không được đi trước dữ liệu nguồn.
5. **AI mutation phải audit được.** Các Commercial Event/AI inference quan trọng cần evidence, confidence, source, previous/new value và khả năng undo khi áp dụng.
6. **Customer != Lead.** Một khách hàng có thể có nhiều Lead/acquisition episode; không gộp hai khái niệm trong domain model.
7. **Conversation source != acquisition lineage != revenue attribution.** Ba khái niệm phải độc lập.
8. **Honest unknown > fake precision.** Không suy diễn attribution hoặc identity nếu thiếu bằng chứng.
9. **Pancake-first, không Pancake-dependent.** Domain model dùng Interaction/Customer/Lead/Handoff/CommercialEvent/Outcome; Pancake là adapter.
10. Khi hoàn tất một task, cập nhật trạng thái trong `project_plan.yaml` và ghi bằng chứng/đường dẫn artifact nếu workflow dự án cho phép.

## 3. Các cổng quyết định
| Cổng | Hạn dự kiến | Ý nghĩa |
|---|---:|---|
| G1 — Vấn đề / ICP đủ rõ để tiếp tục | 2026-10-23 | Tiếp tục / thu hẹp ICP / đổi hướng / nghiên cứu thêm |
| G2 — MVP + khả thi kỹ thuật | 2026-11-20 | Chốt phạm vi build / cắt scope / lùi build |
| G3 — Alpha đủ sẵn sàng cho khách thật | 2027-02-12 | Cho phép pilot / giữ nội bộ để sửa |
| G4 — Pilot đợt 1 chứng minh giá trị và tính lặp lại | 2027-04-02 | Paid pilot tiếp / verticalize / sửa sản phẩm |
| G5 — Sẵn sàng thương mại giới hạn | 2027-06-04 | Ra mắt giới hạn / trì hoãn / thay đổi mô hình triển khai |

## 4. Tổng quan giai đoạn
| Giai đoạn | Bắt đầu | Hạn chót | Số task | P0 |
|---|---:|---:|---:|---:|
| 0. Khởi động & Quản trị | 2026-09-09 | 2026-09-11 | 6 | 6 |
| 1. Chuẩn bị nghiên cứu | 2026-09-09 | 2026-09-18 | 10 | 7 |
| 2. Khám phá khách hàng / thị trường | 2026-09-17 | 2026-10-23 | 18 | 15 |
| 3. Kiểm chứng kinh doanh / tiếp cận thị trường | 2026-09-30 | 2026-10-23 | 9 | 5 |
| 4. Định nghĩa sản phẩm & trải nghiệm người dùng | 2026-10-26 | 2026-11-20 | 15 | 12 |
| 5. Khả thi kỹ thuật & kiến trúc | 2026-10-19 | 2026-11-20 | 15 | 11 |
| 6. Xây dựng MVP — Nền tảng | 2026-11-23 | 2026-12-21 | 10 | 7 |
| 7. Xây dựng MVP — Luồng cốt lõi | 2026-12-14 | 2027-01-22 | 10 | 7 |
| 8. Xây dựng MVP — Đo lường & trí tuệ | 2027-01-04 | 2027-01-29 | 8 | 3 |
| 9. Kiểm thử, bảo mật & sẵn sàng Alpha | 2027-01-04 | 2027-02-12 | 14 | 12 |
| 10. Pilot với đối tác thiết kế — Đợt 1 | 2027-02-15 | 2027-04-02 | 15 | 15 |
| 11. Chuẩn hoá sản phẩm v0.2 | 2027-04-05 | 2027-04-16 | 7 | 6 |
| 12. Pilot trả phí — Đợt 2 | 2027-04-05 | 2027-05-28 | 7 | 7 |
| 13. Sẵn sàng thương mại | 2027-05-17 | 2027-06-07 | 12 | 7 |
| 14. Ra mắt thương mại giới hạn & ổn định | 2027-06-07 | 2027-06-30 | 6 | 5 |

## 5. Danh sách task chi tiết

### 0. Khởi động & Quản trị

#### 0.1 — Chốt điều lệ dự án
- **Nhóm:** Quản trị → Thiết lập dự án
- **Mô tả / hoàn thành khi:** Viết 1 trang: phạm vi vấn đề, luận điểm sản phẩm hiện tại, phạm vi nghiên cứu, nội dung không làm và quyền ra quyết định. Hoàn thành khi Nhà sáng lập/Trưởng sản phẩm cùng đồng ý mốc ban đầu.
- **Người phụ trách gợi ý:** Nhà sáng lập / Trưởng sản phẩm
- **Loại:** Quyết định | **Ưu tiên:** P0 | **Trạng thái:** Hoàn thành
- **Thời gian:** 2026-09-09 → 2026-09-09 (1 ngày lịch; ~0.5 ngày-người)
- **Phụ thuộc:** Không
- **Đầu ra / bằng chứng:** Điều lệ dự án v0.1

#### 0.2 — Thiết lập nguồn tài liệu chuẩn
- **Nhóm:** Quản trị → Thiết lập dự án
- **Mô tả / hoàn thành khi:** Chọn repo tài liệu hiện có làm nguồn tài liệu chuẩn; quy ước Known / Inferred / Hypothesis / To Kiểm chứng; quy tắc cập nhật nhật ký quyết định.
- **Người phụ trách gợi ý:** Trưởng sản phẩm
- **Loại:** Vận hành nghiên cứu | **Ưu tiên:** P0 | **Trạng thái:** Đang thực hiện
- **Thời gian:** 2026-09-09 → 2026-09-10 (2 ngày lịch; ~0.5 ngày-người)
- **Phụ thuộc:** 0.1
- **Đầu ra / bằng chứng:** Quy tắc quản trị tài liệu

#### 0.3 — Thiết lập Master Plan & cadence
- **Nhóm:** Quản trị → Thiết lập dự án
- **Mô tả / hoàn thành khi:** Lập mốc kế hoạch ban đầu, lập kế hoạch hàng tuần, rà soát nghiên cứu 2 lần/tuần và rà soát chiến lược hàng tháng.
- **Người phụ trách gợi ý:** Trưởng sản phẩm
- **Loại:** Vận hành | **Ưu tiên:** P0 | **Trạng thái:** Hoàn thành
- **Thời gian:** 2026-09-09 → 2026-09-09 (1 ngày lịch; ~0.5 ngày-người)
- **Phụ thuộc:** 0.1
- **Đầu ra / bằng chứng:** Kế hoạch tổng + nhịp họp

#### 0.4 — Xác định nhóm nòng cốt 90 ngày
- **Nhóm:** Quản trị → Nhóm & năng lực
- **Mô tả / hoàn thành khi:** Chỉ định role tối thiểu: Nhà sáng lập/Sản phẩm, Research/PM, 2-3 Eng, Design, Implementation/CS; ghi rõ người kiêm nhiệm và capacity.
- **Người phụ trách gợi ý:** Nhà sáng lập
- **Loại:** Vận hành | **Ưu tiên:** P0 | **Trạng thái:** Chưa bắt đầu
- **Thời gian:** 2026-09-09 → 2026-09-11 (3 ngày lịch; ~1.0 ngày-người)
- **Phụ thuộc:** 0.1
- **Đầu ra / bằng chứng:** RACI / sơ đồ năng lực
- **Rủi ro / lưu ý:** Nếu thiếu Implementation/CS, discovery dễ lệch về tech.

#### 0.5 — Khởi tạo sổ đăng ký rủi ro
- **Nhóm:** Quản trị → Quản trị rủi ro
- **Mô tả / hoàn thành khi:** Ghi các rủi ro lớn: Pancake API/điều khoản, biến thiên quy trình, dòng liên kết dữ liệu, mức độ áp dụng của Sales, độ tin cậy phân bổ, hiệu quả kinh tế triển khai và phình phạm vi.
- **Người phụ trách gợi ý:** Trưởng sản phẩm
- **Loại:** Rủi ro | **Ưu tiên:** P0 | **Trạng thái:** Chưa bắt đầu
- **Thời gian:** 2026-09-10 → 2026-09-11 (2 ngày lịch; ~0.5 ngày-người)
- **Phụ thuộc:** 0.1
- **Đầu ra / bằng chứng:** Sổ đăng ký rủi ro v0.1

#### 0.6 — Định nghĩa tiêu chí cổng quyết định ban đầu
- **Nhóm:** Quản trị → Ra quyết định
- **Mô tả / hoàn thành khi:** Xác định tiêu chí đạt/không đạt sơ bộ cho Cổng 1-5; cho phép sửa tiêu chí khi bằng chứng mới xuất hiện nhưng phải ghi nhật ký lý do.
- **Người phụ trách gợi ý:** Nhà sáng lập / Trưởng sản phẩm
- **Loại:** Quyết định | **Ưu tiên:** P0 | **Trạng thái:** Chưa bắt đầu
- **Thời gian:** 2026-09-10 → 2026-09-11 (2 ngày lịch; ~0.5 ngày-người)
- **Phụ thuộc:** 0.1
- **Đầu ra / bằng chứng:** Tiêu chí cổng quyết định v0.1

### 1. Chuẩn bị nghiên cứu

#### 1.1 — Lập danh mục giả thuyết
- **Nhóm:** Nghiên cứu → Thiết kế nghiên cứu
- **Mô tả / hoàn thành khi:** Gom toàn bộ giả thuyết hiện có: ICP vùng Vàng, mất mát khi bàn giao, vấn đề theo dõi tiếp, khả năng quan sát của quản lý, nợ CRM, đo lường thu hút khách đa kênh.
- **Người phụ trách gợi ý:** Sản phẩm / Nghiên cứu
- **Loại:** Nghiên cứu | **Ưu tiên:** P0 | **Trạng thái:** Chưa bắt đầu
- **Thời gian:** 2026-09-09 → 2026-09-12 (4 ngày lịch; ~1.5 ngày-người)
- **Phụ thuộc:** 0.2
- **Đầu ra / bằng chứng:** Danh sách giả thuyết

#### 1.2 — Ưu tiên giả thuyết theo risk
- **Nhóm:** Nghiên cứu → Thiết kế nghiên cứu
- **Mô tả / hoàn thành khi:** Chấm Tác động x Mức chưa chắc chắn x Chi phí kiểm chứng; ưu tiên giả thuyết có thể làm sản phẩm sai hoàn toàn nếu sai.
- **Người phụ trách gợi ý:** Sản phẩm / Nghiên cứu
- **Loại:** Nghiên cứu | **Ưu tiên:** P0 | **Trạng thái:** Chưa bắt đầu
- **Thời gian:** 2026-09-12 → 2026-09-14 (3 ngày lịch; ~1.0 ngày-người)
- **Phụ thuộc:** 1.1
- **Đầu ra / bằng chứng:** Giả thuyết đã ưu tiên

#### 1.3 — Thiết kế bộ câu hỏi phỏng vấn theo vai trò người dùng
- **Nhóm:** Nghiên cứu → Thiết kế phỏng vấn
- **Mô tả / hoàn thành khi:** Tạo bộ câu hỏi riêng cho Marketing, Sales, Quản lý/Nhà sáng lập; ưu tiên hành vi lần gần nhất, xem trực tiếp tài liệu/công cụ hiện dùng, tần suất/chi phí vấn đề và cách xử lý hiện tại.
- **Người phụ trách gợi ý:** Sản phẩm / Nghiên cứu
- **Loại:** Nghiên cứu | **Ưu tiên:** P0 | **Trạng thái:** Chưa bắt đầu
- **Thời gian:** 2026-09-11 → 2026-09-15 (5 ngày lịch; ~2.0 ngày-người)
- **Phụ thuộc:** 1.2
- **Đầu ra / bằng chứng:** 3 bộ câu hỏi phỏng vấn

#### 1.4 — Thiết kế danh sách kiểm tra tài liệu/bằng chứng
- **Nhóm:** Nghiên cứu → Thu thập bằng chứng
- **Mô tả / hoàn thành khi:** Yêu cầu khách cho xem hệ thống tag, bảng theo dõi bán hàng trên Sheet, nhóm bàn giao, báo cáo, Lead mẫu, ghi chú theo dõi tiếp, quy tắc đặt tên quảng cáo.
- **Người phụ trách gợi ý:** Sản phẩm / Nghiên cứu
- **Loại:** Nghiên cứu | **Ưu tiên:** P1 | **Trạng thái:** Chưa bắt đầu
- **Thời gian:** 2026-09-14 → 2026-09-16 (3 ngày lịch; ~1.0 ngày-người)
- **Phụ thuộc:** 1.3
- **Đầu ra / bằng chứng:** Danh sách kiểm tra bằng chứng thực tế

#### 1.5 — Thiết kế mẫu ghi chép & quy tắc mã hoá
- **Nhóm:** Nghiên cứu → Vận hành nghiên cứu
- **Mô tả / hoàn thành khi:** Chuẩn hoá ghi chép: quan sát, trích dẫn, vấn đề, cách xử lý tạm, tần suất, chi phí, mức độ nghiêm trọng, độ mạnh bằng chứng và giả thuyết bị tác động.
- **Người phụ trách gợi ý:** Sản phẩm / Nghiên cứu
- **Loại:** Vận hành nghiên cứu | **Ưu tiên:** P1 | **Trạng thái:** Chưa bắt đầu
- **Thời gian:** 2026-09-14 → 2026-09-16 (3 ngày lịch; ~1.0 ngày-người)
- **Phụ thuộc:** 1.3
- **Đầu ra / bằng chứng:** Mẫu ghi chép phỏng vấn

#### 1.6 — Định nghĩa mẫu nghiên cứu mục tiêu
- **Nhóm:** Nghiên cứu → Chọn mẫu
- **Mô tả / hoàn thành khi:** Mục tiêu 20-30 phỏng vấn: Sales 8-10, Marketing 6-8, Quản lý/Nhà sáng lập 6-8; ít nhất 3 ngành; ưu tiên quy trình phụ thuộc nhiều vào Pancake.
- **Người phụ trách gợi ý:** Sản phẩm / Nghiên cứu
- **Loại:** Nghiên cứu | **Ưu tiên:** P0 | **Trạng thái:** Chưa bắt đầu
- **Thời gian:** 2026-09-14 → 2026-09-16 (3 ngày lịch; ~0.5 ngày-người)
- **Phụ thuộc:** 1.2
- **Đầu ra / bằng chứng:** Kế hoạch chọn mẫu

#### 1.7 — Lập danh sách 40-60 đối tượng nghiên cứu tiềm năng
- **Nhóm:** Nghiên cứu → Tuyển người tham gia nghiên cứu
- **Mô tả / hoàn thành khi:** Dùng mạng lưới/khách Pancake/agency/giới thiệu để có đủ phễu; gắn ngành, số lượng Lead, cơ cấu đội ngũ, tình trạng CRM.
- **Người phụ trách gợi ý:** Nhà sáng lập / Sales
- **Loại:** Nghiên cứu | **Ưu tiên:** P0 | **Trạng thái:** Chưa bắt đầu
- **Thời gian:** 2026-09-14 → 2026-09-18 (5 ngày lịch; ~2.0 ngày-người)
- **Phụ thuộc:** 1.6
- **Đầu ra / bằng chứng:** Danh sách đối tượng nghiên cứu

#### 1.8 — Soạn kịch bản tiếp cận
- **Nhóm:** Nghiên cứu → Tuyển người tham gia nghiên cứu
- **Mô tả / hoàn thành khi:** Thông điệp không chào bán sản phẩm; xin 45 phút hiểu quy trình Marketing -> Sales; đổi lại chia sẻ mốc so sánh/kết quả nghiên cứu.
- **Người phụ trách gợi ý:** Nhà sáng lập / Nghiên cứu
- **Loại:** Nghiên cứu | **Ưu tiên:** P1 | **Trạng thái:** Chưa bắt đầu
- **Thời gian:** 2026-09-15 → 2026-09-16 (2 ngày lịch; ~0.5 ngày-người)
- **Phụ thuộc:** 1.6
- **Đầu ra / bằng chứng:** Tin nhắn tiếp cận

#### 1.9 — Thiết kế bảng định lượng vấn đề
- **Nhóm:** Nghiên cứu → Thiết lập đo lường
- **Mô tả / hoàn thành khi:** Mẫu thu hiện trạng: Lead/tháng, cách bàn giao, thời gian liên hệ đầu tiên, quy trình theo dõi tiếp, không liên hệ được, thời gian quản lý làm báo cáo, ước tính Lead bị mất.
- **Người phụ trách gợi ý:** Sản phẩm / Dữ liệu
- **Loại:** Đo lường | **Ưu tiên:** P0 | **Trạng thái:** Chưa bắt đầu
- **Thời gian:** 2026-09-15 → 2026-09-18 (4 ngày lịch; ~1.5 ngày-người)
- **Phụ thuộc:** 1.2
- **Đầu ra / bằng chứng:** Bảng đo hiện trạng

#### 1.10 — Cập nhật danh sách xác minh nguồn hiện tại
- **Nhóm:** Nghiên cứu → Nghiên cứu tài liệu
- **Mô tả / hoàn thành khi:** Danh sách thông tin thực tế cần kiểm tra lại trước build: khả năng/giới hạn/điều khoản API Pancake, độ bao phủ quảng cáo Meta, khả năng gửi qua kênh, cơ chế giá/seat; không dùng giả định cũ như thông tin thực tế.
- **Người phụ trách gợi ý:** Sản phẩm / Kỹ thuật
- **Loại:** Nghiên cứu | **Ưu tiên:** P0 | **Trạng thái:** Chưa bắt đầu
- **Thời gian:** 2026-09-16 → 2026-09-18 (3 ngày lịch; ~1.0 ngày-người)
- **Phụ thuộc:** 1.1
- **Đầu ra / bằng chứng:** Danh sách cần xác minh

### 2. Khám phá khách hàng / thị trường

#### 2.1 — Phỏng vấn Sales đợt 1 (4-5 người)
- **Nhóm:** Nghiên cứu khách hàng → Phỏng vấn
- **Mô tả / hoàn thành khi:** Đi sâu vào 5 Lead gần nhất: mất bối cảnh, theo dõi tiếp, điện thoại/Zalo/kênh gốc, trí nhớ cá nhân và cách dùng Sheet.
- **Người phụ trách gợi ý:** Sản phẩm / Nghiên cứu
- **Loại:** Nghiên cứu | **Ưu tiên:** P0 | **Trạng thái:** Chưa bắt đầu
- **Thời gian:** 2026-09-17 → 2026-09-25 (9 ngày lịch; ~4.0 ngày-người)
- **Phụ thuộc:** 1.3, 1.7
- **Đầu ra / bằng chứng:** Ghi chép phỏng vấn Sales đợt 1

#### 2.2 — Phỏng vấn Marketing đợt 1 (3-4 người)
- **Nhóm:** Nghiên cứu khách hàng → Phỏng vấn
- **Mô tả / hoàn thành khi:** Quan sát đánh giá đạt chuẩn/bàn giao, trách nhiệm sở hữu, theo dõi nguồn/campaign, yêu cầu từ Sales, báo cáo cho quản lý.
- **Người phụ trách gợi ý:** Sản phẩm / Nghiên cứu
- **Loại:** Nghiên cứu | **Ưu tiên:** P0 | **Trạng thái:** Chưa bắt đầu
- **Thời gian:** 2026-09-17 → 2026-09-25 (9 ngày lịch; ~3.0 ngày-người)
- **Phụ thuộc:** 1.3, 1.7
- **Đầu ra / bằng chứng:** Ghi chép phỏng vấn Marketing đợt 1

#### 2.3 — Phỏng vấn Quản lý/Nhà sáng lập đợt 1 (3-4 người)
- **Nhóm:** Nghiên cứu khách hàng → Phỏng vấn
- **Mô tả / hoàn thành khi:** Tập trung khả năng quan sát, KPI, phân bổ doanh thu, độ tin cậy báo cáo, sự kháng cự CRM, yếu tố kích hoạt mua.
- **Người phụ trách gợi ý:** Nhà sáng lập / Nghiên cứu
- **Loại:** Nghiên cứu | **Ưu tiên:** P0 | **Trạng thái:** Chưa bắt đầu
- **Thời gian:** 2026-09-18 → 2026-09-26 (9 ngày lịch; ~3.0 ngày-người)
- **Phụ thuộc:** 1.3, 1.7
- **Đầu ra / bằng chứng:** Ghi chép phỏng vấn Quản lý đợt 1

#### 2.4 — Theo dõi thực tế 2 quy trình bàn giao
- **Nhóm:** Nghiên cứu khách hàng → Quan sát quy trình
- **Mô tả / hoàn thành khi:** Quan sát một Lead đi từ Pancake qua Marketing tới Sales; ghi chuyển công cụ, sao chép/dán, thời gian chờ, mất bối cảnh, đổi người phụ trách.
- **Người phụ trách gợi ý:** Sản phẩm / Nghiên cứu
- **Loại:** Nghiên cứu | **Ưu tiên:** P0 | **Trạng thái:** Chưa bắt đầu
- **Thời gian:** 2026-09-21 → 2026-09-30 (10 ngày lịch; ~3.0 ngày-người)
- **Phụ thuộc:** 2.1, 2.2
- **Đầu ra / bằng chứng:** 2 bản đồ hành trình hiện tại

#### 2.5 — Phân tích tag/note/Sheet cách xử lý tạm
- **Nhóm:** Nghiên cứu khách hàng → Rà soát tài liệu/công cụ hiện dùng
- **Mô tả / hoàn thành khi:** Thu 5+ mẫu thực tế; phân loại Tag -> giai đoạn, Note -> trường dữ liệu, Sheet -> pipeline/báo cáo, trí nhớ -> nhắc việc.
- **Người phụ trách gợi ý:** Sản phẩm / Nghiên cứu
- **Loại:** Nghiên cứu | **Ưu tiên:** P1 | **Trạng thái:** Chưa bắt đầu
- **Thời gian:** 2026-09-21 → 2026-10-02 (12 ngày lịch; ~3.0 ngày-người)
- **Phụ thuộc:** 1.4, 2.1
- **Đầu ra / bằng chứng:** Phân loại cách xử lý tạm

#### 2.6 — Đo chi phí bàn giao thủ công
- **Nhóm:** Nghiên cứu khách hàng → Định lượng vấn đề
- **Mô tả / hoàn thành khi:** Ước lượng số lần Sales hỏi Marketing, thời gian tìm bối cảnh, chậm liên hệ đầu tiên, chuyển sang kênh kém phù hợp và công sức liên hệ lại.
- **Người phụ trách gợi ý:** Sản phẩm / Dữ liệu
- **Loại:** Đo lường | **Ưu tiên:** P0 | **Trạng thái:** Chưa bắt đầu
- **Thời gian:** 2026-09-24 → 2026-10-02 (9 ngày lịch; ~2.0 ngày-người)
- **Phụ thuộc:** 2.4, 1.9
- **Đầu ra / bằng chứng:** Handoff tax hiện trạng

#### 2.7 — Đo hiện trạng thất bại khi theo dõi tiếp
- **Nhóm:** Nghiên cứu khách hàng → Định lượng vấn đề
- **Mô tả / hoàn thành khi:** Xác định cách việc theo dõi tiếp được ghi nhớ, số việc quá hạn, Lead bị quên và tình huống “khách nhắn lại mới nhớ”; thu số liệu nếu có.
- **Người phụ trách gợi ý:** Sản phẩm / Dữ liệu
- **Loại:** Đo lường | **Ưu tiên:** P0 | **Trạng thái:** Chưa bắt đầu
- **Thời gian:** 2026-09-24 → 2026-10-02 (9 ngày lịch; ~2.0 ngày-người)
- **Phụ thuộc:** 2.1, 1.9
- **Đầu ra / bằng chứng:** Follow-up hiện trạng

#### 2.8 — Đo chi phí quan sát/báo cáo của quản lý
- **Nhóm:** Nghiên cứu khách hàng → Định lượng vấn đề
- **Mô tả / hoàn thành khi:** Đo thời gian gom báo cáo, hỏi Sales, đối soát Marketing-Sales và mức tin tưởng vào chuỗi nguồn -> doanh thu hiện tại.
- **Người phụ trách gợi ý:** Sản phẩm / Dữ liệu
- **Loại:** Đo lường | **Ưu tiên:** P1 | **Trạng thái:** Chưa bắt đầu
- **Thời gian:** 2026-09-25 → 2026-10-03 (9 ngày lịch; ~2.0 ngày-người)
- **Phụ thuộc:** 2.3, 1.9
- **Đầu ra / bằng chứng:** Management báo cáoing hiện trạng

#### 2.9 — Phỏng vấn Sales đợt 2 (4-5 người)
- **Nhóm:** Nghiên cứu khách hàng → Phỏng vấn
- **Mô tả / hoàn thành khi:** Kiểm tra khả năng lặp lại và phản ví dụ; ưu tiên ngành khác đợt 1.
- **Người phụ trách gợi ý:** Sản phẩm / Nghiên cứu
- **Loại:** Nghiên cứu | **Ưu tiên:** P0 | **Trạng thái:** Chưa bắt đầu
- **Thời gian:** 2026-09-28 → 2026-10-09 (12 ngày lịch; ~4.0 ngày-người)
- **Phụ thuộc:** 2.1
- **Đầu ra / bằng chứng:** Ghi chép Sales đợt 2

#### 2.10 — Phỏng vấn Marketing đợt 2 (3-4 người)
- **Nhóm:** Nghiên cứu khách hàng → Phỏng vấn
- **Mô tả / hoàn thành khi:** Kiểm chứng dòng liên kết nguồn, đo lường quảng cáo, định nghĩa Lead và trách nhiệm bàn giao.
- **Người phụ trách gợi ý:** Sản phẩm / Nghiên cứu
- **Loại:** Nghiên cứu | **Ưu tiên:** P0 | **Trạng thái:** Chưa bắt đầu
- **Thời gian:** 2026-09-28 → 2026-10-09 (12 ngày lịch; ~3.0 ngày-người)
- **Phụ thuộc:** 2.2
- **Đầu ra / bằng chứng:** Ghi chép Marketing đợt 2

#### 2.11 — Phỏng vấn Quản lý/Nhà sáng lập đợt 2 (3-4 người)
- **Nhóm:** Nghiên cứu khách hàng → Phỏng vấn
- **Mô tả / hoàn thành khi:** Kiểm chứng người mua, mức sẵn sàng thay đổi quy trình, mức sẵn sàng tham gia Pilot/triển khai và thời điểm cần CRM.
- **Người phụ trách gợi ý:** Nhà sáng lập / Nghiên cứu
- **Loại:** Nghiên cứu | **Ưu tiên:** P0 | **Trạng thái:** Chưa bắt đầu
- **Thời gian:** 2026-09-29 → 2026-10-10 (12 ngày lịch; ~3.0 ngày-người)
- **Phụ thuộc:** 2.3
- **Đầu ra / bằng chứng:** Ghi chép Quản lý đợt 2

#### 2.12 — Theo dõi thực tế thêm 2-3 workflows
- **Nhóm:** Nghiên cứu khách hàng → Quan sát quy trình
- **Mô tả / hoàn thành khi:** Tập trung trường hợp Sales nhiều bước, telesales, booking hoặc dịch vụ giá trị cao để tìm ranh giới Xanh/Vàng/Đỏ.
- **Người phụ trách gợi ý:** Sản phẩm / Nghiên cứu
- **Loại:** Nghiên cứu | **Ưu tiên:** P1 | **Trạng thái:** Chưa bắt đầu
- **Thời gian:** 2026-10-01 → 2026-10-12 (12 ngày lịch; ~4.0 ngày-người)
- **Phụ thuộc:** 2.9, 2.10
- **Đầu ra / bằng chứng:** Bản đồ hành trình bổ sung

#### 2.13 — Chấm điểm 6-8 ngành
- **Nhóm:** Nghiên cứu thị trường → Chấm điểm ngành
- **Mô tả / hoàn thành khi:** Chấm chu kỳ bán hàng, số lượng Lead, số lần bàn giao, cường độ theo dõi tiếp, phân mảnh kênh, áp lực cần CRM, mức sẵn sàng chuẩn hoá.
- **Người phụ trách gợi ý:** Sản phẩm / Chiến lược
- **Loại:** Nghiên cứu | **Ưu tiên:** P0 | **Trạng thái:** Chưa bắt đầu
- **Thời gian:** 2026-10-05 → 2026-10-13 (9 ngày lịch; ~3.0 ngày-người)
- **Phụ thuộc:** 2.4, 2.12
- **Đầu ra / bằng chứng:** Bảng chấm điểm ngành

#### 2.14 — Kiểm chứng mô hình Xanh / Vàng / Đỏ
- **Nhóm:** Nghiên cứu thị trường → Vùng vận hành phù hợp
- **Mô tả / hoàn thành khi:** Đặt doanh nghiệp đã phỏng vấn vào vùng vận hành; xem vùng Vàng có đủ rõ và có vấn đề mạnh nhất không.
- **Người phụ trách gợi ý:** Sản phẩm / Chiến lược
- **Loại:** Nghiên cứu | **Ưu tiên:** P0 | **Trạng thái:** Chưa bắt đầu
- **Thời gian:** 2026-10-08 → 2026-10-14 (7 ngày lịch; ~1.5 ngày-người)
- **Phụ thuộc:** 2.13
- **Đầu ra / bằng chứng:** Operating envelope bằng chứng

#### 2.15 — Buổi tổng hợp nghiên cứu #1
- **Nhóm:** Nghiên cứu khách hàng → Tổng hợp nghiên cứu
- **Mô tả / hoàn thành khi:** Nhóm các vấn đề, cách làm phản hiệu quả, phản ví dụ; cập nhật trạng thái giả thuyết và bằng chứng còn thiếu.
- **Người phụ trách gợi ý:** Nhà sáng lập / Sản phẩm
- **Loại:** Quyết định | **Ưu tiên:** P0 | **Trạng thái:** Chưa bắt đầu
- **Thời gian:** 2026-10-12 → 2026-10-13 (2 ngày lịch; ~1.0 ngày-người)
- **Phụ thuộc:** 2.9, 2.10, 2.11
- **Đầu ra / bằng chứng:** Tổng hợp nghiên cứu v0.1

#### 2.16 — Phỏng vấn bổ sung theo khoảng trống bằng chứng
- **Nhóm:** Nghiên cứu khách hàng → Bổ sung khoảng trống bằng chứng
- **Mô tả / hoàn thành khi:** Thực hiện 3-5 phỏng vấn chỉ để đóng câu hỏi quan trọng còn mâu thuẫn: người mua, biến thiên quy trình, mức sử dụng của Sales hoặc liên kết dữ liệu.
- **Người phụ trách gợi ý:** Sản phẩm / Nghiên cứu
- **Loại:** Nghiên cứu | **Ưu tiên:** P0 | **Trạng thái:** Chưa bắt đầu
- **Thời gian:** 2026-10-14 → 2026-10-20 (7 ngày lịch; ~3.0 ngày-người)
- **Phụ thuộc:** 2.15
- **Đầu ra / bằng chứng:** Gap-closing bằng chứng

#### 2.17 — Tổng hợp xếp hạng vấn đề
- **Nhóm:** Nghiên cứu khách hàng → Tổng hợp nghiên cứu
- **Mô tả / hoàn thành khi:** Xếp hạng vấn đề theo tần suất x mức độ nghiêm trọng x chi phí kinh tế x mức sẵn sàng thay đổi; tách vấn đề “có thì tốt” khỏi “bắt buộc giải quyết”.
- **Người phụ trách gợi ý:** Sản phẩm / Chiến lược
- **Loại:** Quyết định | **Ưu tiên:** P0 | **Trạng thái:** Chưa bắt đầu
- **Thời gian:** 2026-10-20 → 2026-10-22 (3 ngày lịch; ~2.0 ngày-người)
- **Phụ thuộc:** 2.16, 2.6, 2.7, 2.8
- **Cổng / Mốc:** Cổng 1
- **Đầu ra / bằng chứng:** Pain ranking + bằng chứng table

#### 2.18 — Chốt báo cáo nghiên cứu Cổng 1
- **Nhóm:** Nghiên cứu khách hàng → Tổng hợp nghiên cứu
- **Mô tả / hoàn thành khi:** Viết kết luận: ICP khả dĩ, vấn đề lớn nhất, phản ví dụ, điều chưa biết, khuyến nghị tiếp tục/chuyển hướng/thu hẹp.
- **Người phụ trách gợi ý:** Nhà sáng lập / Sản phẩm
- **Loại:** Quyết định | **Ưu tiên:** P0 | **Trạng thái:** Chưa bắt đầu
- **Thời gian:** 2026-10-22 → 2026-10-23 (2 ngày lịch; ~1.0 ngày-người)
- **Phụ thuộc:** 2.17
- **Cổng / Mốc:** Cổng 1 — 23/10
- **Đầu ra / bằng chứng:** Bản ghi nhớ nghiên cứu Cổng 1

### 3. Kiểm chứng kinh doanh / tiếp cận thị trường

#### 3.1 — Xác định người mua có ngân sách/quyền quyết định
- **Nhóm:** Tiếp cận thị trường (GTM) → Khám phá người mua
- **Mô tả / hoàn thành khi:** Từ phỏng vấn, xác định ai có ngân sách + mức cấp thiết + quyền đổi quy trình: Nhà sáng lập, Quản lý Sales, Quản lý Marketing hay Vận hành.
- **Người phụ trách gợi ý:** Nhà sáng lập / GTM
- **Loại:** Nghiên cứu | **Ưu tiên:** P0 | **Trạng thái:** Chưa bắt đầu
- **Thời gian:** 2026-09-30 → 2026-10-14 (15 ngày lịch; ~2.0 ngày-người)
- **Phụ thuộc:** 2.3, 2.11
- **Đầu ra / bằng chứng:** Buyer giả thuyết

#### 3.2 — Thiết kế gói Pilot v0
- **Nhóm:** Tiếp cận thị trường (GTM) → Thiết kế gói chào bán
- **Mô tả / hoàn thành khi:** Đóng gói gói dựa trên vấn đề: Pilot Doanh thu từ Marketing đến Sales; phạm vi, thời lượng, nội dung gồm/không gồm, cam kết khách hàng.
- **Người phụ trách gợi ý:** Nhà sáng lập / Sản phẩm
- **Loại:** GTM | **Ưu tiên:** P0 | **Trạng thái:** Chưa bắt đầu
- **Thời gian:** 2026-10-13 → 2026-10-16 (4 ngày lịch; ~2.0 ngày-người)
- **Phụ thuộc:** 2.15
- **Đầu ra / bằng chứng:** gói Pilot v0

#### 3.3 — Soạn 3 đề xuất giá trị theo vai trò người dùng
- **Nhóm:** Tiếp cận thị trường (GTM) → Đề xuất giá trị
- **Mô tả / hoàn thành khi:** Marketing: biết Lead đi đâu; Sales: có bối cảnh và không quên theo dõi tiếp; Quản lý: thấy điểm rơi rớt và khả năng quan sát doanh thu.
- **Người phụ trách gợi ý:** GTM / Sản phẩm
- **Loại:** GTM | **Ưu tiên:** P1 | **Trạng thái:** Chưa bắt đầu
- **Thời gian:** 2026-10-14 → 2026-10-16 (3 ngày lịch; ~1.0 ngày-người)
- **Phụ thuộc:** 3.1, 2.15
- **Đầu ra / bằng chứng:** Giả thuyết thông điệp

#### 3.4 — Thiết kế câu hỏi về mức sẵn sàng chi trả
- **Nhóm:** Tiếp cận thị trường (GTM) → Nghiên cứu giá
- **Mô tả / hoàn thành khi:** Kiểm thử Pilot trả phí, phí thiết lập, phí phần mềm định kỳ; không neo giá vào per-seat.
- **Người phụ trách gợi ý:** Nhà sáng lập / GTM
- **Loại:** Nghiên cứu | **Ưu tiên:** P1 | **Trạng thái:** Chưa bắt đầu
- **Thời gian:** 2026-10-15 → 2026-10-16 (2 ngày lịch; ~0.5 ngày-người)
- **Phụ thuộc:** 3.2
- **Đầu ra / bằng chứng:** Kịch bản phỏng vấn giá

#### 3.5 — Kiểm thử Pilot trả phí với 5-8 prospects
- **Nhóm:** Tiếp cận thị trường (GTM) → Nghiên cứu giá
- **Mô tả / hoàn thành khi:** Không cần chốt giá; đo phản ứng với triển khai trả phí + mô hình phí định kỳ và trở ngại mua hàng.
- **Người phụ trách gợi ý:** Nhà sáng lập / GTM
- **Loại:** Nghiên cứu | **Ưu tiên:** P0 | **Trạng thái:** Chưa bắt đầu
- **Thời gian:** 2026-10-16 → 2026-10-23 (8 ngày lịch; ~3.0 ngày-người)
- **Phụ thuộc:** 3.4
- **Đầu ra / bằng chứng:** WTP bằng chứng

#### 3.6 — Phỏng vấn 2-3 agency/tư vấn
- **Nhóm:** Tiếp cận thị trường (GTM) → Giả thuyết đối tác
- **Mô tả / hoàn thành khi:** Kiểm tra agency có vấn đề chứng minh revenue downstream và có thể là đối tác phân phối/triển khai không.
- **Người phụ trách gợi ý:** Nhà sáng lập / GTM
- **Loại:** Nghiên cứu | **Ưu tiên:** P2 | **Trạng thái:** Chưa bắt đầu
- **Thời gian:** 2026-10-12 → 2026-10-23 (12 ngày lịch; ~1.5 ngày-người)
- **Phụ thuộc:** 3.1
- **Đầu ra / bằng chứng:** Ghi chép đối tác

#### 3.7 — Lập giả thuyết kinh tế đơn vị v0
- **Nhóm:** Kinh doanh → Kinh tế đơn vị
- **Mô tả / hoàn thành khi:** Ước lượng giờ triển khai, tải hỗ trợ, chi phí hạ tầng/AI biến đổi, cấu trúc hợp đồng mục tiêu; dùng khoảng chứ không độ chính xác giả tạo.
- **Người phụ trách gợi ý:** Nhà sáng lập / Tài chính
- **Loại:** Kinh doanh | **Ưu tiên:** P1 | **Trạng thái:** Chưa bắt đầu
- **Thời gian:** 2026-10-20 → 2026-10-23 (4 ngày lịch; ~1.5 ngày-người)
- **Phụ thuộc:** 3.2, 3.5
- **Đầu ra / bằng chứng:** Kinh tế đơn vị v0

#### 3.8 — Tạo điểm sàng lọc đối tác thiết kế
- **Nhóm:** Tiếp cận thị trường (GTM) → Sàng lọc khách hàng
- **Mô tả / hoàn thành khi:** Tiêu chí: mức sử dụng Pancake, tách Marketing/Sales, số lượng Lead, cường độ theo dõi tiếp, vấn đề của quản lý, người bảo trợ, mức sẵn sàng thay đổi quy trình.
- **Người phụ trách gợi ý:** Nhà sáng lập / Sản phẩm
- **Loại:** GTM | **Ưu tiên:** P0 | **Trạng thái:** Chưa bắt đầu
- **Thời gian:** 2026-10-20 → 2026-10-22 (3 ngày lịch; ~1.0 ngày-người)
- **Phụ thuộc:** 2.17, 3.1
- **Đầu ra / bằng chứng:** Bảng chấm điểm đối tác thiết kế

#### 3.9 — Phiên quyết định Cổng 1
- **Nhóm:** Kinh doanh → Quyết định qua cổng
- **Mô tả / hoàn thành khi:** Quyết định: ICP/ngành ưu tiên, vấn đề ưu tiên, điểm vào ban đầu, mức sẵn sàng Pilot, tiếp tục/chuyển hướng. Không chốt danh sách tính năng trước bằng chứng.
- **Người phụ trách gợi ý:** Nhà sáng lập / Nhóm nòng cốt
- **Loại:** Quyết định | **Ưu tiên:** P0 | **Trạng thái:** Chưa bắt đầu
- **Thời gian:** 2026-10-23 → 2026-10-23 (1 ngày lịch; ~1.0 ngày-người)
- **Phụ thuộc:** 2.18, 3.5, 3.8
- **Cổng / Mốc:** Cổng 1 — 23/10
- **Đầu ra / bằng chứng:** Quyết định Tiếp tục / Thu hẹp / Chuyển hướng

### 4. Định nghĩa sản phẩm & trải nghiệm người dùng

#### 4.1 — Cập nhật luận điểm sản phẩm sau Gate 1
- **Nhóm:** Sản phẩm → Chiến lược sản phẩm
- **Mô tả / hoàn thành khi:** Viết lại lời hứa sản phẩm, ICP, wedge, nội dung không làm theo bằng chứng mới; lưu giả định bị bác bỏ.
- **Người phụ trách gợi ý:** Trưởng sản phẩm
- **Loại:** Sản phẩm | **Ưu tiên:** P0 | **Trạng thái:** Chưa bắt đầu
- **Thời gian:** 2026-10-26 → 2026-10-27 (2 ngày lịch; ~1.0 ngày-người)
- **Phụ thuộc:** 3.9
- **Đầu ra / bằng chứng:** Luận điểm sản phẩm v0.2

#### 4.2 — Chốt kết quả MVP
- **Nhóm:** Sản phẩm → Phạm vi MVP
- **Mô tả / hoàn thành khi:** MVP phải chứng minh vòng: Pancake Hội thoại -> Bàn giao -> Sales theo dõi tiếp -> Kết quả -> Phản hồi cho Quản lý.
- **Người phụ trách gợi ý:** Nhà sáng lập / Sản phẩm
- **Loại:** Quyết định | **Ưu tiên:** P0 | **Trạng thái:** Chưa bắt đầu
- **Thời gian:** 2026-10-27 → 2026-10-28 (2 ngày lịch; ~1.0 ngày-người)
- **Phụ thuộc:** 4.1
- **Đầu ra / bằng chứng:** MVP kết quả trạng tháiment

#### 4.3 — Lập Bắt buộc / Nên có / Để sau / Không làm
- **Nhóm:** Sản phẩm → Phạm vi MVP
- **Mô tả / hoàn thành khi:** Bắt buộc: connector, lead/handoff, sales queue, theo dõi tiếp, kết quả, phễu. Để sau: AI nâng cao, kết nối nhiều nền tảng quảng cáo, đối chiếu sự thật CRM, định tuyến.
- **Người phụ trách gợi ý:** Trưởng sản phẩm
- **Loại:** Sản phẩm | **Ưu tiên:** P0 | **Trạng thái:** Chưa bắt đầu
- **Thời gian:** 2026-10-28 → 2026-10-30 (3 ngày lịch; ~1.5 ngày-người)
- **Phụ thuộc:** 4.2
- **Đầu ra / bằng chứng:** Ma trận phạm vi

#### 4.4 — Định nghĩa đối tượng cốt lõi & ngữ nghĩa
- **Nhóm:** Sản phẩm → Quy tắc nghiệp vụ
- **Mô tả / hoàn thành khi:** Phác thảo Khách hàng, Lead/Lần thu hút khách, Bàn giao, Người phụ trách, Hoạt động, Cam kết, Kết quả, Doanh thu, Bằng chứng; Khách hàng != Lead.
- **Người phụ trách gợi ý:** Sản phẩm + Kỹ thuật
- **Loại:** Sản phẩm | **Ưu tiên:** P0 | **Trạng thái:** Chưa bắt đầu
- **Thời gian:** 2026-10-28 → 2026-11-03 (7 ngày lịch; ~3.0 ngày-người)
- **Phụ thuộc:** 4.2
- **Đầu ra / bằng chứng:** Domain ngữ nghĩa v0.1

#### 4.5 — Định nghĩa dữ liệu Sales tối thiểu bắt buộc
- **Nhóm:** Sản phẩm → Đo lường
- **Mô tả / hoàn thành khi:** Chốt dữ liệu tối thiểu bắt buộc: kết quả liên hệ, đạt/không đạt chuẩn, trạng thái, Won/Lost, doanh thu/lý do mất; kiểm tra ma sát nhập liệu.
- **Người phụ trách gợi ý:** Sản phẩm / Nghiên cứu
- **Loại:** Sản phẩm | **Ưu tiên:** P0 | **Trạng thái:** Chưa bắt đầu
- **Thời gian:** 2026-10-29 → 2026-11-03 (6 ngày lịch; ~1.5 ngày-người)
- **Phụ thuộc:** 4.4, 2.17
- **Đầu ra / bằng chứng:** Hợp đồng dữ liệu tối thiểu

#### 4.6 — Thiết kế Thiết lập sẵn sàng đo lường
- **Nhóm:** Sản phẩm → Đo lường
- **Mô tả / hoàn thành khi:** Luồng cấu hình định nghĩa Lead/Đạt chuẩn/Không liên hệ được/Won/Lost/Doanh thu và SLA theo từng khách hàng.
- **Người phụ trách gợi ý:** Sản phẩm + Thiết kế
- **Loại:** Sản phẩm | **Ưu tiên:** P1 | **Trạng thái:** Chưa bắt đầu
- **Thời gian:** 2026-11-02 → 2026-11-06 (5 ngày lịch; ~2.0 ngày-người)
- **Phụ thuộc:** 4.5
- **Đầu ra / bằng chứng:** Đặc tả thiết lập đo lường

#### 4.7 — Thiết kế bản đồ không gian làm việc theo vai trò
- **Nhóm:** Thiết kế → Kiến trúc thông tin
- **Mô tả / hoàn thành khi:** Marketing tiếp tục làm việc gần Pancake; hàng đợi công việc thương mại của Sales; màn hình chú ý/phễu của Quản lý; thiết lập Quản trị.
- **Người phụ trách gợi ý:** Nhà thiết kế sản phẩm
- **Loại:** Thiết kế | **Ưu tiên:** P0 | **Trạng thái:** Chưa bắt đầu
- **Thời gian:** 2026-10-29 → 2026-11-03 (6 ngày lịch; ~2.0 ngày-người)
- **Phụ thuộc:** 4.2
- **Đầu ra / bằng chứng:** Kiến trúc thông tin

#### 4.8 — Vẽ Marketing -> luồng bàn giao
- **Nhóm:** Thiết kế → Luồng người dùng
- **Mô tả / hoàn thành khi:** Từ hội thoại tới đạt chuẩn/tạo Lead/giao Sales; hiển thị nguồn/bối cảnh; xử lý trùng/khách quay lại.
- **Người phụ trách gợi ý:** Nhà thiết kế sản phẩm
- **Loại:** Thiết kế | **Ưu tiên:** P0 | **Trạng thái:** Chưa bắt đầu
- **Thời gian:** 2026-11-02 → 2026-11-06 (5 ngày lịch; ~3.0 ngày-người)
- **Phụ thuộc:** 4.4, 4.7
- **Đầu ra / bằng chứng:** Luồng bàn giao

#### 4.9 — Vẽ luồng Lead của Sales
- **Nhóm:** Thiết kế → Luồng người dùng
- **Mô tả / hoàn thành khi:** Mới -> nhận -> liên hệ -> hành động tiếp -> theo dõi tiếp -> kết quả; tối thiểu nhập trường dữ liệu.
- **Người phụ trách gợi ý:** Nhà thiết kế sản phẩm
- **Loại:** Thiết kế | **Ưu tiên:** P0 | **Trạng thái:** Chưa bắt đầu
- **Thời gian:** 2026-11-02 → 2026-11-06 (5 ngày lịch; ~3.0 ngày-người)
- **Phụ thuộc:** 4.5, 4.7
- **Đầu ra / bằng chứng:** Luồng Sales

#### 4.10 — Vẽ luồng Quản lý
- **Nhóm:** Thiết kế → Luồng người dùng
- **Mô tả / hoàn thành khi:** Funnel + lớp cảnh báo: handoff SLA, quá hạn, chưa liên hệ, Won/Lost; xem sâu bằng chứng.
- **Người phụ trách gợi ý:** Nhà thiết kế sản phẩm
- **Loại:** Thiết kế | **Ưu tiên:** P1 | **Trạng thái:** Chưa bắt đầu
- **Thời gian:** 2026-11-04 → 2026-11-09 (6 ngày lịch; ~2.5 ngày-người)
- **Phụ thuộc:** 4.7
- **Đầu ra / bằng chứng:** luồng Quản lý

#### 4.11 — Thiết kế Sự kiện thương mại v0
- **Nhóm:** Sản phẩm → Sự kiện thương mại (Commercial Event)
- **Mô tả / hoàn thành khi:** Chọn 5-8 sự kiện MVP có bằng chứng + độ tin cậy; ưu tiên cam kết/đạt chuẩn/liên hệ/kết quả, chưa tự động thay đổi rủi ro cao.
- **Người phụ trách gợi ý:** Sản phẩm + AI/Kỹ thuật
- **Loại:** Sản phẩm | **Ưu tiên:** P1 | **Trạng thái:** Chưa bắt đầu
- **Thời gian:** 2026-11-03 → 2026-11-09 (7 ngày lịch; ~2.0 ngày-người)
- **Phụ thuộc:** 4.4
- **Đầu ra / bằng chứng:** Đặc tả Sự kiện thương mại v0

#### 4.12 — Dựng mẫu thử tương tác v0
- **Nhóm:** Thiết kế → Mẫu thử
- **Mô tả / hoàn thành khi:** Mẫu thử cho 3 vai trò chính, tập trung một câu chuyện Lead đầu-cuối; không trau chuốt giao diện quá mức.
- **Người phụ trách gợi ý:** Nhà thiết kế sản phẩm
- **Loại:** Thiết kế | **Ưu tiên:** P0 | **Trạng thái:** Chưa bắt đầu
- **Thời gian:** 2026-11-06 → 2026-11-12 (7 ngày lịch; ~4.0 ngày-người)
- **Phụ thuộc:** 4.8, 4.9, 4.10
- **Đầu ra / bằng chứng:** Mẫu thử tương tác

#### 4.13 — Kiểm thử mẫu thử với 5-7 người dùng
- **Nhóm:** Nghiên cứu → Khả năng sử dụng
- **Mô tả / hoàn thành khi:** Tối thiểu 2 Sales, 2 Marketing, 2 Quản lý; đo khả năng hiểu, ma sát nhập liệu, thiếu bối cảnh và độ tin cậy.
- **Người phụ trách gợi ý:** Sản phẩm / Thiết kế
- **Loại:** Nghiên cứu | **Ưu tiên:** P0 | **Trạng thái:** Chưa bắt đầu
- **Thời gian:** 2026-11-12 → 2026-11-17 (6 ngày lịch; ~3.0 ngày-người)
- **Phụ thuộc:** 4.12
- **Đầu ra / bằng chứng:** Kết quả kiểm thử sử dụng

#### 4.14 — Sửa phạm vi theo khả dụng + khả thi
- **Nhóm:** Sản phẩm → Phạm vi MVP
- **Mô tả / hoàn thành khi:** Cắt những flow khó hiểu/giá trị thấp; giữ tính đầy đủ đầu-cuối.
- **Người phụ trách gợi ý:** Trưởng sản phẩm
- **Loại:** Quyết định | **Ưu tiên:** P0 | **Trạng thái:** Chưa bắt đầu
- **Thời gian:** 2026-11-18 → 2026-11-19 (2 ngày lịch; ~1.0 ngày-người)
- **Phụ thuộc:** 4.13, 5.14
- **Cổng / Mốc:** Cổng 2
- **Đầu ra / bằng chứng:** MVP phạm vi candidate

#### 4.15 — Chốt PRD MVP v0.1
- **Nhóm:** Sản phẩm → Đặc tả yêu cầu sản phẩm (PRD)
- **Mô tả / hoàn thành khi:** Câu chuyện người dùng, quy tắc, tiêu chí chấp nhận, sự kiện phân tích, trường hợp biên, nội dung loại trừ rõ ràng.
- **Người phụ trách gợi ý:** Trưởng sản phẩm
- **Loại:** Sản phẩm | **Ưu tiên:** P0 | **Trạng thái:** Chưa bắt đầu
- **Thời gian:** 2026-11-19 → 2026-11-20 (2 ngày lịch; ~2.0 ngày-người)
- **Phụ thuộc:** 4.14
- **Cổng / Mốc:** Cổng 2 — 20/11
- **Đầu ra / bằng chứng:** PRD MVP v0.1

### 5. Khả thi kỹ thuật & kiến trúc

#### 5.1 — Xác minh lại Pancake API/điều khoản hiện tại
- **Nhóm:** Kỹ thuật → Tích hợp Pancake
- **Mô tả / hoàn thành khi:** Xác nhận khả năng đọc hội thoại/khách hàng/tin nhắn/tag/giao việc, phạm vi token, giới hạn tốc độ, webhook/polling và ranh giới thương mại/quyền gửi tin nhắn.
- **Người phụ trách gợi ý:** Trưởng kỹ thuật
- **Loại:** Nghiên cứu kỹ thuật | **Ưu tiên:** P0 | **Trạng thái:** Chưa bắt đầu
- **Thời gian:** 2026-10-19 → 2026-10-27 (9 ngày lịch; ~3.0 ngày-người)
- **Phụ thuộc:** 1.10
- **Đầu ra / bằng chứng:** Ma trận khả năng Pancake
- **Rủi ro / lưu ý:** Không hứa original-channel send nếu terms/API chưa xác nhận.

#### 5.2 — Xây dựng thử nghiệm Pancake chỉ đọc
- **Nhóm:** Kỹ thuật → Tích hợp Pancake
- **Mô tả / hoàn thành khi:** Kết nối trang thử nghiệm; nạp hội thoại/khách hàng/tin nhắn mẫu và đo độ ổn định.
- **Người phụ trách gợi ý:** Kỹ sư Backend
- **Loại:** Kỹ thuật | **Ưu tiên:** P0 | **Trạng thái:** Chưa bắt đầu
- **Thời gian:** 2026-10-26 → 2026-11-04 (10 ngày lịch; ~5.0 ngày-người)
- **Phụ thuộc:** 5.1
- **Đầu ra / bằng chứng:** Thử nghiệm nạp dữ liệu chạy được

#### 5.3 — Đánh giá webhook và polling
- **Nhóm:** Kỹ thuật → Độ ổn định tích hợp
- **Mô tả / hoàn thành khi:** Thiết kế chiến lược đồng bộ, thử lại, con trỏ/điểm lưu, sự kiện trùng và đối soát.
- **Người phụ trách gợi ý:** Kỹ sư Backend
- **Loại:** Kiến trúc | **Ưu tiên:** P0 | **Trạng thái:** Chưa bắt đầu
- **Thời gian:** 2026-11-02 → 2026-11-06 (5 ngày lịch; ~2.0 ngày-người)
- **Phụ thuộc:** 5.2
- **Đầu ra / bằng chứng:** Quyết định kiến trúc đồng bộ

#### 5.4 — Thiết kế bảo mật token/thông tin xác thực
- **Nhóm:** Kỹ thuật → Bảo mật
- **Mô tả / hoàn thành khi:** Lưu trữ/mã hoá, cách ly dữ liệu khách hàng, xoay vòng/thu hồi, kiểm toán quyền truy cập kết nối.
- **Người phụ trách gợi ý:** Trưởng kỹ thuật
- **Loại:** Bảo mật | **Ưu tiên:** P0 | **Trạng thái:** Chưa bắt đầu
- **Thời gian:** 2026-10-28 → 2026-11-05 (9 ngày lịch; ~2.0 ngày-người)
- **Phụ thuộc:** 5.1
- **Đầu ra / bằng chứng:** Thiết kế thông tin xác thực

#### 5.5 — Thiết kế mô hình tương tác trung lập nhà cung cấp
- **Nhóm:** Kỹ thuật → Kiến trúc nghiệp vụ
- **Mô tả / hoàn thành khi:** Thực thể nội bộ dùng Tương tác/Khách hàng/Lead/Sự kiện; Pancake là bộ chuyển đổi. Tránh khóa miền nghiệp vụ vào đối tượng Pancake.
- **Người phụ trách gợi ý:** Trưởng kỹ thuật + Sản phẩm
- **Loại:** Kiến trúc | **Ưu tiên:** P0 | **Trạng thái:** Chưa bắt đầu
- **Thời gian:** 2026-11-03 → 2026-11-09 (7 ngày lịch; ~3.0 ngày-người)
- **Phụ thuộc:** 4.4, 5.2
- **Đầu ra / bằng chứng:** Mô hình nghiệp vụ v0.1

#### 5.6 — Thiết kế Khách hàng chuẩn + Lead ID
- **Nhóm:** Kỹ thuật → Định danh
- **Mô tả / hoàn thành khi:** Quy tắc cho ID điện thoại/mạng xã hội, Lead/Lần thu hút khách ổn định, trùng/mở lại; luồng sửa thủ công.
- **Người phụ trách gợi ý:** Trưởng kỹ thuật
- **Loại:** Kiến trúc | **Ưu tiên:** P0 | **Trạng thái:** Chưa bắt đầu
- **Thời gian:** 2026-11-05 → 2026-11-11 (7 ngày lịch; ~3.0 ngày-người)
- **Phụ thuộc:** 5.5
- **Đầu ra / bằng chứng:** Thiết kế định danh/Lead ID

#### 5.7 — Thiết kế kiến trúc đa khách hàng sẵn sàng SaaS
- **Nhóm:** Kỹ thuật → Đa khách hàng (multi-tenant)
- **Mô tả / hoàn thành khi:** ID khách hàng, ranh giới tổ chức/người dùng/vai trò, phân vùng dữ liệu; chưa xây phần thanh toán/tự phục vụ.
- **Người phụ trách gợi ý:** Trưởng kỹ thuật
- **Loại:** Kiến trúc | **Ưu tiên:** P0 | **Trạng thái:** Chưa bắt đầu
- **Thời gian:** 2026-11-05 → 2026-11-11 (7 ngày lịch; ~2.0 ngày-người)
- **Phụ thuộc:** 5.5
- **Đầu ra / bằng chứng:** Kiến trúc đa khách hàng

#### 5.8 — Thiết kế phân quyền theo Lead
- **Nhóm:** Kỹ thuật → Phân quyền (RBAC)
- **Mô tả / hoàn thành khi:** Marketing/Quản trị có quyền rộng hơn; Sales chỉ truy cập Lead được giao; Quản lý có khả năng quan sát. Không yêu cầu Sales có quyền toàn trang trong ứng dụng.
- **Người phụ trách gợi ý:** Trưởng kỹ thuật + Sản phẩm
- **Loại:** Kiến trúc | **Ưu tiên:** P0 | **Trạng thái:** Chưa bắt đầu
- **Thời gian:** 2026-11-09 → 2026-11-13 (5 ngày lịch; ~2.0 ngày-người)
- **Phụ thuộc:** 4.7, 5.7
- **Đầu ra / bằng chứng:** Ma trận phân quyền (RBAC)

#### 5.9 — Thử nghiệm nhanh trích xuất thương mại
- **Nhóm:** Kỹ thuật → Khả thi AI
- **Mô tả / hoàn thành khi:** Kiểm thử tóm tắt + nhu cầu/phản đối/cam kết trên tin nhắn mẫu; lưu đoạn bằng chứng và độ tin cậy.
- **Người phụ trách gợi ý:** Kỹ sư AI/Dữ liệu
- **Loại:** AI | **Ưu tiên:** P1 | **Trạng thái:** Chưa bắt đầu
- **Thời gian:** 2026-11-04 → 2026-11-13 (10 ngày lịch; ~5.0 ngày-người)
- **Phụ thuộc:** 4.11, 5.2
- **Đầu ra / bằng chứng:** Mốc đánh giá AI trích xuất

#### 5.10 — Định nghĩa chính sách người duyệt
- **Nhóm:** Kỹ thuật → Khả thi AI
- **Mô tả / hoàn thành khi:** Xác định sự kiện nào tự động, sự kiện nào chỉ gợi ý; đánh giá chi phí báo sai; yêu cầu có kiểm toán/hoàn tác.
- **Người phụ trách gợi ý:** Sản phẩm + AI
- **Loại:** AI | **Ưu tiên:** P1 | **Trạng thái:** Chưa bắt đầu
- **Thời gian:** 2026-11-12 → 2026-11-16 (5 ngày lịch; ~1.5 ngày-người)
- **Phụ thuộc:** 5.9
- **Đầu ra / bằng chứng:** Chính sách hành động AI

#### 5.11 — Đánh giá khả thi liên kết nguồn thu hút khách Meta
- **Nhóm:** Kỹ thuật → Đo lường
- **Mô tả / hoàn thành khi:** Xác định định danh thực sự có sẵn từ Pancake/Meta để nối Campaign/Ad -> Hội thoại -> Lead; kiểm thử độ bao phủ xác định chắc chắn.
- **Người phụ trách gợi ý:** Dữ liệu/Backend
- **Loại:** Nghiên cứu kỹ thuật | **Ưu tiên:** P0 | **Trạng thái:** Chưa bắt đầu
- **Thời gian:** 2026-11-05 → 2026-11-13 (9 ngày lịch; ~4.0 ngày-người)
- **Phụ thuộc:** 5.2
- **Đầu ra / bằng chứng:** Thử nghiệm liên kết nguồn Meta

#### 5.12 — Chỉ kiểm tra khả thi kết nối TikTok/Google
- **Nhóm:** Kỹ thuật → Mở rộng nguồn thu hút khách
- **Mô tả / hoàn thành khi:** Không xây dựng; chỉ xác minh xác thực/ID báo cáo/chi phí và khả năng nối dòng liên kết nguồn để tránh ngõ cụt thiết kế.
- **Người phụ trách gợi ý:** Trưởng kỹ thuật
- **Loại:** Nghiên cứu kỹ thuật | **Ưu tiên:** P2 | **Trạng thái:** Chưa bắt đầu
- **Thời gian:** 2026-11-10 → 2026-11-17 (8 ngày lịch; ~2.0 ngày-người)
- **Phụ thuộc:** 5.11
- **Đầu ra / bằng chứng:** Ghi chú khả thi kết nối tương lai

#### 5.13 — Thiết kế mô hình Đã biết/Suy luận/Không biết
- **Nhóm:** Kỹ thuật → Sức khoẻ dữ liệu
- **Mô tả / hoàn thành khi:** Mỗi liên kết có phương pháp/độ tin cậy; tính độ bao phủ; hiển thị rõ phần thiếu kết quả/nguồn.
- **Người phụ trách gợi ý:** Kỹ sư dữ liệu + Sản phẩm
- **Loại:** Kiến trúc | **Ưu tiên:** P1 | **Trạng thái:** Chưa bắt đầu
- **Thời gian:** 2026-11-11 → 2026-11-17 (7 ngày lịch; ~2.0 ngày-người)
- **Phụ thuộc:** 5.6, 5.11
- **Đầu ra / bằng chứng:** Mô hình sức khoẻ dữ liệu

#### 5.14 — Rà soát kiến trúc + ước lượng công sức
- **Nhóm:** Kỹ thuật → Kiến trúc
- **Mô tả / hoàn thành khi:** Rà soát đầu-cuối, xác định trở ngại cứng, ước lượng xây dựng theo khối công việc và xác nhận phần để sau.
- **Người phụ trách gợi ý:** Trưởng kỹ thuật + Nhóm nòng cốt
- **Loại:** Quyết định | **Ưu tiên:** P0 | **Trạng thái:** Chưa bắt đầu
- **Thời gian:** 2026-11-17 → 2026-11-19 (3 ngày lịch; ~2.0 ngày-người)
- **Phụ thuộc:** 5.3, 5.8, 5.9, 5.11, 5.13
- **Cổng / Mốc:** Cổng 2
- **Đầu ra / bằng chứng:** Kiến trúc + ước lượng

#### 5.15 — Cổng 2: Xây / Thu hẹp / Thử nghiệm lại
- **Nhóm:** Kỹ thuật → Quyết định qua cổng
- **Mô tả / hoàn thành khi:** Chỉ tiếp tục nếu nạp dữ liệu Pancake + định danh + dòng liên kết đầu-cuối đủ khả thi cho Pilot và phạm vi MVP phù hợp năng lực đội ngũ.
- **Người phụ trách gợi ý:** Nhà sáng lập / Nhóm nòng cốt
- **Loại:** Quyết định | **Ưu tiên:** P0 | **Trạng thái:** Chưa bắt đầu
- **Thời gian:** 2026-11-20 → 2026-11-20 (1 ngày lịch; ~1.0 ngày-người)
- **Phụ thuộc:** 4.15, 5.14
- **Cổng / Mốc:** Cổng 2 — 20/11
- **Đầu ra / bằng chứng:** Quyết định xây dựng

### 6. Xây dựng MVP — Nền tảng

#### 6.1 — Kho mã/CI-CD/môi trường
- **Nhóm:** Kỹ thuật → Thiết lập quy trình phát hành
- **Mô tả / hoàn thành khi:** Thiết lập dev/staging/prod nhẹ, rà soát mã, chuyển đổi dữ liệu, bí mật hệ thống và hoàn tác phát hành cơ bản.
- **Người phụ trách gợi ý:** Trưởng kỹ thuật
- **Loại:** Kỹ thuật | **Ưu tiên:** P0 | **Trạng thái:** Chưa bắt đầu
- **Thời gian:** 2026-11-23 → 2026-11-27 (5 ngày lịch; ~3.0 ngày-người)
- **Phụ thuộc:** 5.15
- **Đầu ra / bằng chứng:** Quy trình phát hành

#### 6.2 — Mốc giám sát log/lỗi
- **Nhóm:** Kỹ thuật → Giám sát hệ thống
- **Mô tả / hoàn thành khi:** Log có cấu trúc, bảng lỗi tích hợp, ID yêu cầu, khả năng quan sát job đồng bộ.
- **Người phụ trách gợi ý:** Kỹ sư Backend
- **Loại:** Kỹ thuật | **Ưu tiên:** P1 | **Trạng thái:** Chưa bắt đầu
- **Thời gian:** 2026-11-25 → 2026-12-02 (8 ngày lịch; ~2.0 ngày-người)
- **Phụ thuộc:** 6.1
- **Đầu ra / bằng chứng:** Observability hiện trạng

#### 6.3 — Lõi tổ chức/người dùng/đăng nhập
- **Nhóm:** Kỹ thuật → Khách hàng/Xác thực
- **Mô tả / hoàn thành khi:** Tạo không gian khách hàng thủ công; mời/đăng nhập; chưa tự đăng ký/thanh toán.
- **Người phụ trách gợi ý:** Kỹ sư Full-stack
- **Loại:** Kỹ thuật | **Ưu tiên:** P0 | **Trạng thái:** Chưa bắt đầu
- **Thời gian:** 2026-11-23 → 2026-12-04 (12 ngày lịch; ~6.0 ngày-người)
- **Phụ thuộc:** 6.1, 5.7
- **Đầu ra / bằng chứng:** Module tổ chức/xác thực

#### 6.4 — Phân quyền vai trò + phạm vi Lead
- **Nhóm:** Kỹ thuật → Phân quyền (RBAC)
- **Mô tả / hoàn thành khi:** Implement Admin/Marketing/Sales/Quản lý access và phạm vi Lead được giao.
- **Người phụ trách gợi ý:** Kỹ sư Backend
- **Loại:** Kỹ thuật | **Ưu tiên:** P0 | **Trạng thái:** Chưa bắt đầu
- **Thời gian:** 2026-12-01 → 2026-12-09 (9 ngày lịch; ~4.0 ngày-người)
- **Phụ thuộc:** 6.3, 5.8
- **Đầu ra / bằng chứng:** Phân quyền RBAC đã áp dụng

#### 6.5 — Xác thực/thiết lập kết nối
- **Nhóm:** Kỹ thuật → Kết nối Pancake
- **Mô tả / hoàn thành khi:** Cấu hình quản trị nội bộ to connect Pancake và kiểm tra thông tin xác thực.
- **Người phụ trách gợi ý:** Kỹ sư Backend
- **Loại:** Kỹ thuật | **Ưu tiên:** P0 | **Trạng thái:** Chưa bắt đầu
- **Thời gian:** 2026-11-30 → 2026-12-07 (8 ngày lịch; ~4.0 ngày-người)
- **Phụ thuộc:** 6.1, 5.4
- **Đầu ra / bằng chứng:** Luồng thiết lập kết nối

#### 6.6 — Nạp hội thoại/khách hàng
- **Nhóm:** Kỹ thuật → Kết nối Pancake
- **Mô tả / hoàn thành khi:** Đồng bộ đủ mức vận hành thật cho các đối tượng cần thiết; có điểm lưu, thử lại và loại trùng.
- **Người phụ trách gợi ý:** Kỹ sư Backend
- **Loại:** Kỹ thuật | **Ưu tiên:** P0 | **Trạng thái:** Chưa bắt đầu
- **Thời gian:** 2026-12-03 → 2026-12-16 (14 ngày lịch; ~8.0 ngày-người)
- **Phụ thuộc:** 6.5, 5.3
- **Đầu ra / bằng chứng:** Nạp dữ liệu ổn định

#### 6.7 — Customer/Lead/Handoff cấu trúc dữ liệu
- **Nhóm:** Kỹ thuật → Mô hình dữ liệu
- **Mô tả / hoàn thành khi:** Implement canonical Customer, Lead, Handoff, owner, dòng liên kết nguồn, timestamps.
- **Người phụ trách gợi ý:** Kỹ sư Backend
- **Loại:** Kỹ thuật | **Ưu tiên:** P0 | **Trạng thái:** Chưa bắt đầu
- **Thời gian:** 2026-11-30 → 2026-12-11 (12 ngày lịch; ~6.0 ngày-người)
- **Phụ thuộc:** 5.5, 5.6, 6.1
- **Đầu ra / bằng chứng:** Mô hình dữ liệu cốt lõi

#### 6.8 — Activity/Outcome/Revenue cấu trúc dữ liệu
- **Nhóm:** Kỹ thuật → Mô hình dữ liệu
- **Mô tả / hoàn thành khi:** Contact attempts, theo dõi tiếp, trạng thái, Won/Lost, lost reason, doanh thu; thay đổi có kiểm toán.
- **Người phụ trách gợi ý:** Kỹ sư Backend
- **Loại:** Kỹ thuật | **Ưu tiên:** P0 | **Trạng thái:** Chưa bắt đầu
- **Thời gian:** 2026-12-07 → 2026-12-16 (10 ngày lịch; ~5.0 ngày-người)
- **Phụ thuộc:** 6.7, 4.5
- **Đầu ra / bằng chứng:** Mô hình dữ liệu thực thi

#### 6.9 — Audit trail hiện trạng
- **Nhóm:** Kỹ thuật → Nhật ký kiểm toán
- **Mô tả / hoàn thành khi:** Ghi ai làm gì, khi nào, từ nguồn nào cho các thay đổi trạng thái/kết quả/giao việc; hỗ trợ hoàn tác với các thay đổi đơn giản.
- **Người phụ trách gợi ý:** Kỹ sư Backend
- **Loại:** Kỹ thuật | **Ưu tiên:** P1 | **Trạng thái:** Chưa bắt đầu
- **Thời gian:** 2026-12-14 → 2026-12-21 (8 ngày lịch; ~3.0 ngày-người)
- **Phụ thuộc:** 6.7, 6.8
- **Đầu ra / bằng chứng:** Nhật ký kiểm toán

#### 6.10 — Cấu hình định nghĩa đo lường
- **Nhóm:** Kỹ thuật → Cấu hình quản trị
- **Mô tả / hoàn thành khi:** Cấu hình quản trị nội bộ cho Đạt chuẩn, Không liên hệ được, Won, lý do Lost và SLA.
- **Người phụ trách gợi ý:** Kỹ sư Full-stack
- **Loại:** Kỹ thuật | **Ưu tiên:** P1 | **Trạng thái:** Chưa bắt đầu
- **Thời gian:** 2026-12-07 → 2026-12-18 (12 ngày lịch; ~5.0 ngày-người)
- **Phụ thuộc:** 4.6, 6.3
- **Đầu ra / bằng chứng:** Cấu hình đo lường v0

### 7. Xây dựng MVP — Luồng cốt lõi

#### 7.1 — Tạo Lead từ hội thoại
- **Nhóm:** Sản phẩm/Kỹ thuật → Marketing
- **Mô tả / hoàn thành khi:** Từ hội thoại đã đồng bộ, tạo/đánh dấu Lead đạt chuẩn đồng thời giữ nguồn, bối cảnh và định danh khách hàng.
- **Người phụ trách gợi ý:** Kỹ sư Full-stack
- **Loại:** Kỹ thuật | **Ưu tiên:** P0 | **Trạng thái:** Chưa bắt đầu
- **Thời gian:** 2026-12-14 → 2026-12-23 (10 ngày lịch; ~5.0 ngày-người)
- **Phụ thuộc:** 6.6, 6.7
- **Đầu ra / bằng chứng:** Luồng tạo Lead

#### 7.2 — Marketing -> Sales handoff
- **Nhóm:** Sản phẩm/Kỹ thuật → Bàn giao
- **Mô tả / hoàn thành khi:** Assign Sales, create handoff timestamp/SLA, package bối cảnh, tránh bàn giao trùng.
- **Người phụ trách gợi ý:** Kỹ sư Full-stack
- **Loại:** Kỹ thuật | **Ưu tiên:** P0 | **Trạng thái:** Chưa bắt đầu
- **Thời gian:** 2026-12-21 → 2027-01-05 (16 ngày lịch; ~6.0 ngày-người)
- **Phụ thuộc:** 7.1, 6.4
- **Đầu ra / bằng chứng:** Luồng bàn giao

#### 7.3 — Danh sách Lead của tôi
- **Nhóm:** Sản phẩm/Kỹ thuật → Không gian làm việc Sales
- **Mô tả / hoàn thành khi:** Chế độ xem: Mới, đến hạn hôm nay, quá hạn, chờ khách, không liên hệ được; hỗ trợ xem nhanh ưu tiên.
- **Người phụ trách gợi ý:** Kỹ sư Frontend
- **Loại:** Kỹ thuật | **Ưu tiên:** P0 | **Trạng thái:** Chưa bắt đầu
- **Thời gian:** 2026-12-28 → 2027-01-08 (12 ngày lịch; ~6.0 ngày-người)
- **Phụ thuộc:** 7.2, 6.4
- **Đầu ra / bằng chứng:** Hàng đợi Sales

#### 7.4 — Chi tiết Lead + bối cảnh
- **Nhóm:** Sản phẩm/Kỹ thuật → Không gian làm việc Sales
- **Mô tả / hoàn thành khi:** Hiển thị tóm tắt/nguồn/kênh gốc/bằng chứng hội thoại/dòng thời gian thương mại/hành động tiếp theo.
- **Người phụ trách gợi ý:** Kỹ sư Frontend
- **Loại:** Kỹ thuật | **Ưu tiên:** P0 | **Trạng thái:** Chưa bắt đầu
- **Thời gian:** 2027-01-04 → 2027-01-13 (10 ngày lịch; ~5.0 ngày-người)
- **Phụ thuộc:** 7.3, 6.6
- **Đầu ra / bằng chứng:** Chi tiết Lead

#### 7.5 — Nhận Lead/kết quả liên hệ
- **Nhóm:** Sản phẩm/Kỹ thuật → Thực thi Sales
- **Mô tả / hoàn thành khi:** Sales nhận Lead; ghi Đã liên hệ/Không nghe máy/Không hợp lệ/Khác kèm thời gian; tối thiểu thao tác.
- **Người phụ trách gợi ý:** Kỹ sư Full-stack
- **Loại:** Kỹ thuật | **Ưu tiên:** P0 | **Trạng thái:** Chưa bắt đầu
- **Thời gian:** 2027-01-04 → 2027-01-12 (9 ngày lịch; ~4.0 ngày-người)
- **Phụ thuộc:** 7.3, 6.8
- **Đầu ra / bằng chứng:** Luồng kết quả liên hệ

#### 7.6 — Hành động tiếp + hạn
- **Nhóm:** Sản phẩm/Kỹ thuật → Theo dõi tiếp
- **Mô tả / hoàn thành khi:** Tạo hành động tiếp theo và hạn; cho phép hoàn thành/dời lịch; hiển thị việc quá hạn và người phụ trách.
- **Người phụ trách gợi ý:** Kỹ sư Full-stack
- **Loại:** Kỹ thuật | **Ưu tiên:** P0 | **Trạng thái:** Chưa bắt đầu
- **Thời gian:** 2027-01-06 → 2027-01-15 (10 ngày lịch; ~5.0 ngày-người)
- **Phụ thuộc:** 6.8, 7.4
- **Đầu ra / bằng chứng:** Lõi theo dõi tiếp

#### 7.7 — Ghi nhận Đạt chuẩn/Won/Lost
- **Nhóm:** Sản phẩm/Kỹ thuật → Kết quả
- **Mô tả / hoàn thành khi:** Ghi nhận trạng thái/kết quả, lý do mất và doanh thu; kiểm tra theo cấu hình đo lường.
- **Người phụ trách gợi ý:** Kỹ sư Full-stack
- **Loại:** Kỹ thuật | **Ưu tiên:** P0 | **Trạng thái:** Chưa bắt đầu
- **Thời gian:** 2027-01-08 → 2027-01-18 (11 ngày lịch; ~5.0 ngày-người)
- **Phụ thuộc:** 6.10, 6.8
- **Đầu ra / bằng chứng:** Ghi nhận kết quả

#### 7.8 — Commercial timeline
- **Nhóm:** Sản phẩm/Kỹ thuật → Dòng thời gian
- **Mô tả / hoàn thành khi:** Hiển thị sự kiện bàn giao/liên hệ/theo dõi tiếp/kết quả theo thứ tự thời gian, kèm nguồn và bằng chứng.
- **Người phụ trách gợi ý:** Kỹ sư Frontend
- **Loại:** Kỹ thuật | **Ưu tiên:** P1 | **Trạng thái:** Chưa bắt đầu
- **Thời gian:** 2027-01-13 → 2027-01-20 (8 ngày lịch; ~4.0 ngày-người)
- **Phụ thuộc:** 7.2, 7.5, 7.6, 7.7
- **Đầu ra / bằng chứng:** Dòng thời gian thương mại

#### 7.9 — Thông báo đến hạn/quá hạn cơ bản
- **Nhóm:** Sản phẩm/Kỹ thuật → Thông báo
- **Mô tả / hoàn thành khi:** Thông báo trong ứng dụng/email cho bàn giao mới và việc theo dõi tiếp đến hạn/quá hạn; chưa mở rộng phức tạp đa kênh.
- **Người phụ trách gợi ý:** Kỹ sư Backend
- **Loại:** Kỹ thuật | **Ưu tiên:** P1 | **Trạng thái:** Chưa bắt đầu
- **Thời gian:** 2027-01-13 → 2027-01-21 (9 ngày lịch; ~4.0 ngày-người)
- **Phụ thuộc:** 7.2, 7.6
- **Đầu ra / bằng chứng:** Thông báo v0

#### 7.10 — Thử nghiệm liên tục kênh gốc trong sản phẩm
- **Nhóm:** Sản phẩm/Kỹ thuật → Kênh gốc
- **Mô tả / hoàn thành khi:** Nếu API/điều khoản cho phép: dùng link/deep-link hoặc luồng gửi có kiểm soát; nếu không, hiển thị kênh/bối cảnh và chuyển lại Marketing khi cần.
- **Người phụ trách gợi ý:** Trưởng kỹ thuật
- **Loại:** Kỹ thuật | **Ưu tiên:** P1 | **Trạng thái:** Chưa bắt đầu
- **Thời gian:** 2027-01-11 → 2027-01-22 (12 ngày lịch; ~4.0 ngày-người)
- **Phụ thuộc:** 5.1, 7.4
- **Đầu ra / bằng chứng:** Liên tục kênh v0
- **Rủi ro / lưu ý:** Feature may be constrained by Pancake permissions/terms.

### 8. Xây dựng MVP — Đo lường & trí tuệ

#### 8.1 — Phễu Quản lý v0
- **Nhóm:** Dữ liệu → Phễu
- **Mô tả / hoàn thành khi:** Hội thoại/Lead/Bàn giao/Đã liên hệ/Đạt chuẩn/Won-Lost: số lượng + tỷ lệ chuyển đổi; phân tách theo Sales/nguồn khi dữ liệu đủ tin cậy.
- **Người phụ trách gợi ý:** Dữ liệu/Full-stack
- **Loại:** Kỹ thuật | **Ưu tiên:** P0 | **Trạng thái:** Chưa bắt đầu
- **Thời gian:** 2027-01-11 → 2027-01-22 (12 ngày lịch; ~6.0 ngày-người)
- **Phụ thuộc:** 7.2, 7.5, 7.7
- **Đầu ra / bằng chứng:** Quản lý phễu

#### 8.2 — Chỉ số SLA
- **Nhóm:** Dữ liệu → Phân tích bàn giao
- **Mô tả / hoàn thành khi:** Số lượng bàn giao, đã nhận/đã liên hệ, trung vị thời gian tới liên hệ đầu tiên, vi phạm, danh sách chưa liên hệ.
- **Người phụ trách gợi ý:** Kỹ sư dữ liệu
- **Loại:** Kỹ thuật | **Ưu tiên:** P0 | **Trạng thái:** Chưa bắt đầu
- **Thời gian:** 2027-01-13 → 2027-01-22 (10 ngày lịch; ~4.0 ngày-người)
- **Phụ thuộc:** 7.2, 7.5
- **Đầu ra / bằng chứng:** Handoff báo cáo

#### 8.3 — Tuân thủ theo dõi tiếp
- **Nhóm:** Dữ liệu → Phân tích theo dõi tiếp
- **Mô tả / hoàn thành khi:** Theo dõi việc đến hạn/hoàn thành/quá hạn theo Sales; hiển thị danh sách quá hạn và xu hướng đơn giản.
- **Người phụ trách gợi ý:** Kỹ sư dữ liệu
- **Loại:** Kỹ thuật | **Ưu tiên:** P1 | **Trạng thái:** Chưa bắt đầu
- **Thời gian:** 2027-01-15 → 2027-01-25 (11 ngày lịch; ~3.0 ngày-người)
- **Phụ thuộc:** 7.6
- **Đầu ra / bằng chứng:** Follow-up báo cáo

#### 8.4 — Chỉ số độ bao phủ v0
- **Nhóm:** Dữ liệu → Sức khoẻ dữ liệu
- **Mô tả / hoàn thành khi:** Tính % Lead có nguồn, bàn giao, kết quả Sales và doanh thu; phân loại Đã biết/Suy luận/Không biết cho dòng liên kết nguồn.
- **Người phụ trách gợi ý:** Kỹ sư dữ liệu
- **Loại:** Kỹ thuật | **Ưu tiên:** P0 | **Trạng thái:** Chưa bắt đầu
- **Thời gian:** 2027-01-15 → 2027-01-27 (13 ngày lịch; ~5.0 ngày-người)
- **Phụ thuộc:** 5.13, 7.7
- **Đầu ra / bằng chứng:** Sức khoẻ dữ liệu v0

#### 8.5 — Dòng liên kết nguồn Meta v0
- **Nhóm:** Dữ liệu → Liên kết nguồn Meta
- **Mô tả / hoàn thành khi:** Lưu dòng liên kết campaign/ad có sẵn từ thử nghiệm Pancake/Meta; báo cáo độ bao phủ và phần chưa biết, không tạo độ chính xác giả.
- **Người phụ trách gợi ý:** Kỹ sư dữ liệu
- **Loại:** Kỹ thuật | **Ưu tiên:** P1 | **Trạng thái:** Chưa bắt đầu
- **Thời gian:** 2027-01-11 → 2027-01-27 (17 ngày lịch; ~6.0 ngày-người)
- **Phụ thuộc:** 5.11, 6.6
- **Đầu ra / bằng chứng:** Liên kết nguồn Meta v0

#### 8.6 — Tóm tắt có bằng chứng v0
- **Nhóm:** AI → Tóm tắt hội thoại
- **Mô tả / hoàn thành khi:** Tạo tóm tắt ngắn về nhu cầu/sản phẩm/phản đối/cam kết; liên kết về bằng chứng; người dùng có thể sửa/đánh dấu.
- **Người phụ trách gợi ý:** Kỹ sư AI/Dữ liệu
- **Loại:** AI | **Ưu tiên:** P1 | **Trạng thái:** Chưa bắt đầu
- **Thời gian:** 2027-01-04 → 2027-01-20 (17 ngày lịch; ~7.0 ngày-người)
- **Phụ thuộc:** 5.9, 7.4
- **Đầu ra / bằng chứng:** Tóm tắt AI v0

#### 8.7 — Phát hiện cam kết Khách/Sales
- **Nhóm:** AI → Cam kết
- **Mô tả / hoàn thành khi:** Phát hiện cam kết rõ ràng và gợi ý hạn/hành động; ở Alpha chỉ gợi ý trừ khi đã chứng minh ngưỡng độ tin cậy.
- **Người phụ trách gợi ý:** Kỹ sư AI/Dữ liệu
- **Loại:** AI | **Ưu tiên:** P1 | **Trạng thái:** Chưa bắt đầu
- **Thời gian:** 2027-01-13 → 2027-01-27 (15 ngày lịch; ~6.0 ngày-người)
- **Phụ thuộc:** 8.6, 5.10
- **Đầu ra / bằng chứng:** Gợi ý cam kết v0

#### 8.8 — Giao diện bằng chứng/độ tin cậy
- **Nhóm:** AI → Độ tin cậy
- **Mô tả / hoàn thành khi:** Hiển thị bằng chứng, độ tin cậy, tin nhắn nguồn và hành động phản hồi; không tự động thay đổi theo cách khó giải thích.
- **Người phụ trách gợi ý:** Frontend + AI
- **Loại:** Kỹ thuật | **Ưu tiên:** P1 | **Trạng thái:** Chưa bắt đầu
- **Thời gian:** 2027-01-20 → 2027-01-29 (10 ngày lịch; ~4.0 ngày-người)
- **Phụ thuộc:** 8.6, 8.7
- **Đầu ra / bằng chứng:** AI độ tin cậy UI

### 9. Kiểm thử, bảo mật & sẵn sàng Alpha

#### 9.1 — Lập ma trận kiểm thử MVP
- **Nhóm:** Kiểm thử (QA) → Chiến lược kiểm thử
- **Mô tả / hoàn thành khi:** Luồng chuẩn + trường hợp biên: Lead trùng, trễ đồng bộ, thiếu số điện thoại, mở lại, sai người phụ trách, nguồn không đầy đủ, sửa Lost/Won.
- **Người phụ trách gợi ý:** Kiểm thử / Sản phẩm
- **Loại:** Kiểm thử | **Ưu tiên:** P0 | **Trạng thái:** Chưa bắt đầu
- **Thời gian:** 2027-01-04 → 2027-01-12 (9 ngày lịch; ~3.0 ngày-người)
- **Phụ thuộc:** 4.15
- **Đầu ra / bằng chứng:** Ma trận kiểm thử

#### 9.2 — Tạo dữ liệu kiểm thử đại diện
- **Nhóm:** Kiểm thử (QA) → Dữ liệu kiểm thử chuẩn
- **Mô tả / hoàn thành khi:** Dữ liệu tổng hợp/ẩn danh cho 5 kịch bản, định danh đa kênh, hội thoại nhiễu, thiếu nguồn.
- **Người phụ trách gợi ý:** Kiểm thử / Dữ liệu
- **Loại:** Kiểm thử | **Ưu tiên:** P0 | **Trạng thái:** Chưa bắt đầu
- **Thời gian:** 2027-01-08 → 2027-01-15 (8 ngày lịch; ~3.0 ngày-người)
- **Phụ thuộc:** 9.1
- **Đầu ra / bằng chứng:** Dữ liệu kiểm thử chuẩn

#### 9.3 — Kiểm thử lỗi đồng bộ Pancake
- **Nhóm:** Kiểm thử (QA) → Tích hợp
- **Mô tả / hoàn thành khi:** Token hết hạn, giới hạn tốc độ, webhook/polling trùng, thiếu tin nhắn, kết nối lại, nạp bù.
- **Người phụ trách gợi ý:** Kiểm thử + Backend
- **Loại:** Kiểm thử | **Ưu tiên:** P0 | **Trạng thái:** Chưa bắt đầu
- **Thời gian:** 2027-01-18 → 2027-01-29 (12 ngày lịch; ~5.0 ngày-người)
- **Phụ thuộc:** 6.6, 9.2
- **Đầu ra / bằng chứng:** Connector QA báo cáo

#### 9.4 — Kiểm thử E2E Marketing -> Doanh thu
- **Nhóm:** Kiểm thử (QA) → Quy trình
- **Mô tả / hoàn thành khi:** Tự động/thủ công E2E: hội thoại->lead->handoff->contact->theo dõi tiếp->Won/Lost->phễu.
- **Người phụ trách gợi ý:** Kiểm thử
- **Loại:** Kiểm thử | **Ưu tiên:** P0 | **Trạng thái:** Chưa bắt đầu
- **Thời gian:** 2027-01-20 → 2027-02-02 (14 ngày lịch; ~5.0 ngày-người)
- **Phụ thuộc:** 7.7, 8.1
- **Đầu ra / bằng chứng:** E2E pass báo cáo

#### 9.5 — Rà soát RBAC / cách ly khách hàng
- **Nhóm:** Bảo mật → Quyền truy cập
- **Mô tả / hoàn thành khi:** Kiểm tra Sales không truy cập Lead/khách hàng khác; hành động quản trị có kiểm toán; giới hạn quyền truy cập bí mật kết nối.
- **Người phụ trách gợi ý:** Trưởng kỹ thuật / Kiểm thử
- **Loại:** Bảo mật | **Ưu tiên:** P0 | **Trạng thái:** Chưa bắt đầu
- **Thời gian:** 2027-01-25 → 2027-02-03 (10 ngày lịch; ~3.0 ngày-người)
- **Phụ thuộc:** 6.4, 6.9
- **Đầu ra / bằng chứng:** Danh sách kiểm tra bảo mật

#### 9.6 — Chính sách lưu/xoá dữ liệu ban đầu
- **Nhóm:** Bảo mật → Quyền riêng tư
- **Mô tả / hoàn thành khi:** Định nghĩa thời hạn lưu dữ liệu Pilot, quy trình xoá, xuất/sao lưu, xử lý dữ liệu nhạy cảm; rà soát pháp lý trước khi dùng dữ liệu khách hàng.
- **Người phụ trách gợi ý:** Nhà sáng lập / Kỹ thuật / Pháp lý
- **Loại:** Bảo mật | **Ưu tiên:** P0 | **Trạng thái:** Chưa bắt đầu
- **Thời gian:** 2027-01-18 → 2027-02-05 (19 ngày lịch; ~3.0 ngày-người)
- **Phụ thuộc:** 6.6, 6.7
- **Đầu ra / bằng chứng:** Chính sách riêng tư/lưu trữ Pilot

#### 9.7 — Sao lưu/khôi phục + giám sát
- **Nhóm:** Kỹ thuật → Độ ổn định
- **Mô tả / hoàn thành khi:** Sao lưu hàng ngày khi phù hợp, kiểm thử khôi phục, cảnh báo job và trang sức khoẻ kết nối cho nhóm nội bộ.
- **Người phụ trách gợi ý:** Kỹ sư Backend
- **Loại:** Kỹ thuật | **Ưu tiên:** P1 | **Trạng thái:** Chưa bắt đầu
- **Thời gian:** 2027-01-25 → 2027-02-05 (12 ngày lịch; ~4.0 ngày-người)
- **Phụ thuộc:** 6.2, 6.6
- **Đầu ra / bằng chứng:** Vận hành readiness

#### 9.8 — Sự kiện phân tích sản phẩm
- **Nhóm:** Sản phẩm → Thiết lập đo lường
- **Mô tả / hoàn thành khi:** Theo dõi kích hoạt, handoff, contact, theo dõi tiếp, kết quả, phản hồi AI, lỗi; avoid chỉ số MAU hình thức.
- **Người phụ trách gợi ý:** Sản phẩm / Dữ liệu
- **Loại:** Đo lường | **Ưu tiên:** P1 | **Trạng thái:** Chưa bắt đầu
- **Thời gian:** 2027-01-25 → 2027-02-05 (12 ngày lịch; ~3.0 ngày-người)
- **Phụ thuộc:** 7.7
- **Đầu ra / bằng chứng:** Gắn đo lường sử dụng

#### 9.9 — Viết sổ tay triển khai Pilot
- **Nhóm:** Thành công KH/Vận hành → Triển khai
- **Mô tả / hoàn thành khi:** Khám phá -> hiện trạng -> buổi chốt định nghĩa -> cấu hình -> đào tạo -> theo dõi sát -> rà soát tuần -> tổng kết kinh doanh.
- **Người phụ trách gợi ý:** Triển khai / Thành công KH
- **Loại:** Vận hành | **Ưu tiên:** P0 | **Trạng thái:** Chưa bắt đầu
- **Thời gian:** 2027-01-18 → 2027-02-05 (19 ngày lịch; ~4.0 ngày-người)
- **Phụ thuộc:** 4.6, 7.7
- **Đầu ra / bằng chứng:** Sổ tay triển khai

#### 9.10 — Tạo đào tạo theo vai trò
- **Nhóm:** Thành công KH/Vận hành → Đào tạo
- **Mô tả / hoàn thành khi:** Marketing 30m, Sales 45m, Quản lý 30m; theo tác vụ, không tour tính năng.
- **Người phụ trách gợi ý:** Triển khai / Thành công KH
- **Loại:** Vận hành | **Ưu tiên:** P0 | **Trạng thái:** Chưa bắt đầu
- **Thời gian:** 2027-01-25 → 2027-02-08 (15 ngày lịch; ~4.0 ngày-người)
- **Phụ thuộc:** 7.2, 7.3, 8.1
- **Đầu ra / bằng chứng:** Tài liệu/kịch bản đào tạo

#### 9.11 — Chọn 3-5 đối tác thiết kế Đợt 1
- **Nhóm:** Tiếp cận thị trường (GTM) → Sẵn sàng Pilot
- **Mô tả / hoàn thành khi:** Dùng điểm sàng lọc; ký phạm vi/quyền truy cập dữ liệu/cam kết người bảo trợ; ưu tiên cùng ngành nếu có thể.
- **Người phụ trách gợi ý:** Nhà sáng lập / GTM
- **Loại:** GTM | **Ưu tiên:** P0 | **Trạng thái:** Chưa bắt đầu
- **Thời gian:** 2027-01-18 → 2027-02-05 (19 ngày lịch; ~3.0 ngày-người)
- **Phụ thuộc:** 3.8, 3.9
- **Đầu ra / bằng chứng:** Nhóm Pilot Đợt 1

#### 9.12 — Thỏa thuận Pilot / DPA tối thiểu
- **Nhóm:** Tiếp cận thị trường (GTM) → Hợp đồng
- **Mô tả / hoàn thành khi:** Phạm vi, trách nhiệm, xử lý dữ liệu, bảo mật thông tin, giới hạn hỗ trợ, phí Pilot nếu áp dụng.
- **Người phụ trách gợi ý:** Nhà sáng lập / Pháp lý
- **Loại:** Pháp lý | **Ưu tiên:** P0 | **Trạng thái:** Chưa bắt đầu
- **Thời gian:** 2027-01-25 → 2027-02-08 (15 ngày lịch; ~3.0 ngày-người)
- **Phụ thuộc:** 9.6, 9.11
- **Đầu ra / bằng chứng:** Mẫu thỏa thuận Pilot

#### 9.13 — Tuần dùng thử nội bộ
- **Nhóm:** Sản phẩm → Alpha
- **Mô tả / hoàn thành khi:** Nhóm nòng cốt chạy quy trình mô phỏng + nội bộ; ghi lỗi và điểm ma sát hàng ngày.
- **Người phụ trách gợi ý:** Nhóm nòng cốt
- **Loại:** Kiểm thử | **Ưu tiên:** P0 | **Trạng thái:** Chưa bắt đầu
- **Thời gian:** 2027-02-01 → 2027-02-05 (5 ngày lịch; ~5.0 ngày-người)
- **Phụ thuộc:** 9.4, 9.5
- **Đầu ra / bằng chứng:** Nhật ký lỗi dùng thử nội bộ

#### 9.14 — Cổng 3: Sẵn sàng Alpha?
- **Nhóm:** Sản phẩm → Quyết định qua cổng
- **Mô tả / hoàn thành khi:** Cho Pilot chạy nếu E2E P0 đạt, không có lỗi bảo mật nghiêm trọng, sổ tay/đào tạo sẵn sàng và kết nối đủ ổn định.
- **Người phụ trách gợi ý:** Nhà sáng lập / Nhóm nòng cốt
- **Loại:** Quyết định | **Ưu tiên:** P0 | **Trạng thái:** Chưa bắt đầu
- **Thời gian:** 2027-02-12 → 2027-02-12 (1 ngày lịch; ~1.0 ngày-người)
- **Phụ thuộc:** 9.3, 9.4, 9.5, 9.9, 9.10, 9.13
- **Cổng / Mốc:** Cổng 3 — 12/02
- **Đầu ra / bằng chứng:** Quyết định Alpha đi/không đi

### 10. Pilot với đối tác thiết kế — Đợt 1

#### 10.1 — Khởi động + lập bản đồ quy trình từng đối tác
- **Nhóm:** Triển khai → Chuẩn bị Pilot
- **Mô tả / hoàn thành khi:** Lập bản đồ thu hút khách -> Pancake -> bàn giao -> Sales -> kết quả; xác định điểm khác so với chuẩn.
- **Người phụ trách gợi ý:** Triển khai + Sản phẩm
- **Loại:** Vận hành | **Ưu tiên:** P0 | **Trạng thái:** Chưa bắt đầu
- **Thời gian:** 2027-02-15 → 2027-02-19 (5 ngày lịch; ~5.0 ngày-người)
- **Phụ thuộc:** 9.14, 9.11
- **Đầu ra / bằng chứng:** Hiện tại-trạng thái maps

#### 10.2 — Chỉ số hiện trạng từng đối tác
- **Nhóm:** Triển khai → Đo hiện trạng
- **Mô tả / hoàn thành khi:** Số lượng Lead, thời gian liên hệ đầu tiên, mất mát bàn giao, theo dõi tiếp, độ bao phủ kết quả, công sức báo cáo trước Pilot.
- **Người phụ trách gợi ý:** Triển khai + Dữ liệu
- **Loại:** Đo lường | **Ưu tiên:** P0 | **Trạng thái:** Chưa bắt đầu
- **Thời gian:** 2027-02-15 → 2027-02-19 (5 ngày lịch; ~3.0 ngày-người)
- **Phụ thuộc:** 10.1
- **Đầu ra / bằng chứng:** Bảng điểm hiện trạng

#### 10.3 — Buổi chốt định nghĩa doanh thu
- **Nhóm:** Triển khai → Định nghĩa nghiệp vụ
- **Mô tả / hoàn thành khi:** Thống nhất Lead/Đạt chuẩn/Không liên hệ được/Won/Lost/Doanh thu/SLA; ghi lại ngoại lệ.
- **Người phụ trách gợi ý:** Sản phẩm + Triển khai
- **Loại:** Vận hành | **Ưu tiên:** P0 | **Trạng thái:** Chưa bắt đầu
- **Thời gian:** 2027-02-16 → 2027-02-19 (4 ngày lịch; ~4.0 ngày-người)
- **Phụ thuộc:** 10.1
- **Đầu ra / bằng chứng:** Hợp đồng dữ liệu khách hàng

#### 10.4 — Kết nối Pancake + cấu hình không gian khách hàng
- **Nhóm:** Triển khai → Thiết lập
- **Mô tả / hoàn thành khi:** Tạo thủ công, người dùng/vai trò, định nghĩa đo lường, ánh xạ nguồn, kiểm tra sức khoẻ dữ liệu.
- **Người phụ trách gợi ý:** Triển khai + Kỹ thuật
- **Loại:** Vận hành | **Ưu tiên:** P0 | **Trạng thái:** Chưa bắt đầu
- **Thời gian:** 2027-02-17 → 2027-02-22 (6 ngày lịch; ~4.0 ngày-người)
- **Phụ thuộc:** 10.3
- **Đầu ra / bằng chứng:** Không gian làm việc đã cấu hình

#### 10.5 — Đào tạo Marketing / Sales / Quản lý
- **Nhóm:** Triển khai → Đào tạo
- **Mô tả / hoàn thành khi:** Đào tạo theo vai trò, hoàn thành 1 luồng Lead thật, ghi lại điểm gây khó hiểu.
- **Người phụ trách gợi ý:** Triển khai / Thành công KH
- **Loại:** Vận hành | **Ưu tiên:** P0 | **Trạng thái:** Chưa bắt đầu
- **Thời gian:** 2027-02-22 → 2027-02-24 (3 ngày lịch; ~4.0 ngày-người)
- **Phụ thuộc:** 10.4, 9.10
- **Đầu ra / bằng chứng:** Trained pilot người dùng

#### 10.6 — Đợt 1 vận hành thật
- **Nhóm:** Triển khai → Vận hành thật
- **Mô tả / hoàn thành khi:** Bắt đầu xử lý Lead thật; hỗ trợ hàng ngày trong tuần đầu; nhóm sản phẩm theo dõi chỉ số trọng yếu.
- **Người phụ trách gợi ý:** Triển khai + Sản phẩm
- **Loại:** Phát hành | **Ưu tiên:** P0 | **Trạng thái:** Chưa bắt đầu
- **Thời gian:** 2027-02-24 → 2027-02-24 (1 ngày lịch; ~1.0 ngày-người)
- **Phụ thuộc:** 10.5
- **Cổng / Mốc:** Mốc: Đợt 1 vận hành thật
- **Đầu ra / bằng chứng:** Pilot vận hành thật

#### 10.7 — Theo dõi sát tuần 1
- **Nhóm:** Thành công KH/Vận hành → Theo dõi sát
- **Mô tả / hoàn thành khi:** Quan sát hành vi bàn giao/liên hệ/kết quả; không chỉ dựa vào yêu cầu tính năng; ghi cách xử lý tạm và khoảng trống dữ liệu.
- **Người phụ trách gợi ý:** Sản phẩm + Thành công KH
- **Loại:** Nghiên cứu | **Ưu tiên:** P0 | **Trạng thái:** Chưa bắt đầu
- **Thời gian:** 2027-02-24 → 2027-03-03 (8 ngày lịch; ~5.0 ngày-người)
- **Phụ thuộc:** 10.6
- **Đầu ra / bằng chứng:** Theo dõi thực tế findings

#### 10.8 — Sửa lỗi P0/P1 của Pilot
- **Nhóm:** Kỹ thuật → Hỗ trợ Pilot
- **Mô tả / hoàn thành khi:** Phân loại hàng ngày; chỉ hotfix lỗi nghiêm trọng; tránh để nhóm bị kéo vào yêu cầu tuỳ biến trừ khi đó là trở ngại lặp lại.
- **Người phụ trách gợi ý:** Kỹ thuật
- **Loại:** Kỹ thuật | **Ưu tiên:** P0 | **Trạng thái:** Chưa bắt đầu
- **Thời gian:** 2027-02-24 → 2027-03-12 (17 ngày lịch; ~8.0 ngày-người)
- **Phụ thuộc:** 10.6
- **Đầu ra / bằng chứng:** Các bản vá ổn định Pilot

#### 10.9 — Rà soát doanh thu hàng tuần #1-#4
- **Nhóm:** Thành công KH/Vận hành → Rà soát hàng tuần
- **Mô tả / hoàn thành khi:** Rà soát Lead/bàn giao/liên hệ/theo dõi tiếp/kết quả/sức khoẻ dữ liệu + điểm rơi rớt lớn nhất; ghi lại quyết định khách hàng.
- **Người phụ trách gợi ý:** Thành công KH + Sản phẩm
- **Loại:** Vận hành | **Ưu tiên:** P0 | **Trạng thái:** Chưa bắt đầu
- **Thời gian:** 2027-03-01 → 2027-03-26 (26 ngày lịch; ~8.0 ngày-người)
- **Phụ thuộc:** 10.6
- **Đầu ra / bằng chứng:** 4 ghi chép rà soát tuần

#### 10.10 — Đo mức sử dụng & hành vi
- **Nhóm:** Nghiên cứu → Mức độ sử dụng
- **Mô tả / hoàn thành khi:** % Lead đi qua sản phẩm, Sales thực sự xử lý, độ bao phủ kết quả, mức hoàn thành theo dõi tiếp, mẫu lách quy trình.
- **Người phụ trách gợi ý:** Sản phẩm / Dữ liệu
- **Loại:** Đo lường | **Ưu tiên:** P0 | **Trạng thái:** Chưa bắt đầu
- **Thời gian:** 2027-03-01 → 2027-03-26 (26 ngày lịch; ~4.0 ngày-người)
- **Phụ thuộc:** 10.6
- **Đầu ra / bằng chứng:** Mức sử dụng dashboard

#### 10.11 — Đo tác động kinh doanh
- **Nhóm:** Nghiên cứu → Giá trị
- **Mô tả / hoàn thành khi:** So sánh hiện trạng với Pilot: liên hệ đầu tiên, chưa liên hệ, quá hạn, thời gian quản lý làm báo cáo, Lead thu hồi có bằng chứng.
- **Người phụ trách gợi ý:** Sản phẩm / Dữ liệu
- **Loại:** Đo lường | **Ưu tiên:** P0 | **Trạng thái:** Chưa bắt đầu
- **Thời gian:** 2027-03-15 → 2027-03-31 (17 ngày lịch; ~4.0 ngày-người)
- **Phụ thuộc:** 10.2, 10.10
- **Đầu ra / bằng chứng:** Phân tích tác động Pilot

#### 10.12 — Theo dõi phần chuẩn vs tuỳ biến theo đối tác
- **Nhóm:** Sản phẩm → Khả năng lặp lại
- **Mô tả / hoàn thành khi:** Mỗi phân loại điểm khác: mẫu theo ngành, cấu hình, riêng lẻ, thiếu lõi thật.
- **Người phụ trách gợi ý:** Trưởng sản phẩm
- **Loại:** Nghiên cứu | **Ưu tiên:** P0 | **Trạng thái:** Chưa bắt đầu
- **Thời gian:** 2027-02-24 → 2027-03-31 (36 ngày lịch; ~4.0 ngày-người)
- **Phụ thuộc:** 10.1, 10.7
- **Đầu ra / bằng chứng:** Ma trận khả năng lặp lại

#### 10.13 — Kiểm tra gia hạn/tiếp tục trả phí
- **Nhóm:** Tiếp cận thị trường (GTM) → Thương mại
- **Mô tả / hoàn thành khi:** Thảo luận giá trị, mức sẵn sàng chi trả, phí triển khai và mô hình định kỳ trước khi Pilot kết thúc; ghi lại phản đối.
- **Người phụ trách gợi ý:** Nhà sáng lập / GTM
- **Loại:** GTM | **Ưu tiên:** P0 | **Trạng thái:** Chưa bắt đầu
- **Thời gian:** 2027-03-22 → 2027-04-01 (11 ngày lịch; ~3.0 ngày-người)
- **Phụ thuộc:** 10.9, 10.11
- **Đầu ra / bằng chứng:** Commercial bằng chứng

#### 10.14 — Tổng kết kinh doanh Đợt 1
- **Nhóm:** Sản phẩm → Tổng kết kinh doanh
- **Mô tả / hoàn thành khi:** Trình bày trước/sau, lưu ý về sức khoẻ dữ liệu, giá trị thu hồi, mức sử dụng, trở ngại chưa giải quyết và trích dẫn/quyết định của khách hàng.
- **Người phụ trách gợi ý:** Nhà sáng lập / Sản phẩm / Thành công KH
- **Loại:** Quyết định | **Ưu tiên:** P0 | **Trạng thái:** Chưa bắt đầu
- **Thời gian:** 2027-04-01 → 2027-04-02 (2 ngày lịch; ~3.0 ngày-người)
- **Phụ thuộc:** 10.11, 10.13
- **Cổng / Mốc:** Cổng 4 — 02/04
- **Đầu ra / bằng chứng:** Tổng kết kinh doanh Đợt 1

#### 10.15 — Cổng 4: giá trị có lặp lại?
- **Nhóm:** Sản phẩm → Quyết định qua cổng
- **Mô tả / hoàn thành khi:** Quyết định tiếp tục/thu hẹp/chuyên sâu theo ngành. Gợi ý đạt: 3+ đối tác cho thấy giá trị rõ, quy trình phần lớn lặp lại, công sức triển khai giảm và người bảo trợ sẵn sàng trả tiền/tiếp tục.
- **Người phụ trách gợi ý:** Nhà sáng lập / Nhóm nòng cốt
- **Loại:** Quyết định | **Ưu tiên:** P0 | **Trạng thái:** Chưa bắt đầu
- **Thời gian:** 2027-04-02 → 2027-04-02 (1 ngày lịch; ~1.0 ngày-người)
- **Phụ thuộc:** 10.12, 10.14
- **Cổng / Mốc:** Cổng 4 — 02/04
- **Đầu ra / bằng chứng:** Quyết định Đợt 2

### 11. Chuẩn hoá sản phẩm v0.2

#### 11.1 — Tổng hợp bài học Đợt 1
- **Nhóm:** Sản phẩm → Tổng hợp nghiên cứu
- **Mô tả / hoàn thành khi:** Xếp hạng trở ngại lặp lại/yếu tố tạo giá trị; loại yêu cầu đơn lẻ; cập nhật ICP và nguyên tắc sản phẩm.
- **Người phụ trách gợi ý:** Trưởng sản phẩm
- **Loại:** Quyết định | **Ưu tiên:** P0 | **Trạng thái:** Chưa bắt đầu
- **Thời gian:** 2027-04-05 → 2027-04-07 (3 ngày lịch; ~2.0 ngày-người)
- **Phụ thuộc:** 10.15
- **Đầu ra / bằng chứng:** Bản ghi nhớ bài học

#### 11.2 — Xác định thay đổi v0.2
- **Nhóm:** Sản phẩm → Phạm vi
- **Mô tả / hoàn thành khi:** Chỉ thay đổi những gì giúp tăng khả năng lặp lại, giảm thời gian triển khai, tăng chất lượng dữ liệu hoặc giá trị cốt lõi.
- **Người phụ trách gợi ý:** Trưởng sản phẩm
- **Loại:** Sản phẩm | **Ưu tiên:** P0 | **Trạng thái:** Chưa bắt đầu
- **Thời gian:** 2027-04-07 → 2027-04-08 (2 ngày lịch; ~1.0 ngày-người)
- **Phụ thuộc:** 11.1
- **Đầu ra / bằng chứng:** v0.2 phạm vi

#### 11.3 — Công cụ thiết lập nội bộ
- **Nhóm:** Kỹ thuật → Hướng dẫn triển khai ban đầu
- **Mô tả / hoàn thành khi:** Giảm công việc thủ công khi tạo tổ chức/người dùng/kết nối/cấu hình; chưa có tự phục vụ công khai.
- **Người phụ trách gợi ý:** Kỹ sư Full-stack
- **Loại:** Kỹ thuật | **Ưu tiên:** P1 | **Trạng thái:** Chưa bắt đầu
- **Thời gian:** 2027-04-05 → 2027-04-16 (12 ngày lịch; ~5.0 ngày-người)
- **Phụ thuộc:** 10.12, 11.2
- **Đầu ra / bằng chứng:** Công cụ cấu hình v0.2

#### 11.4 — Sửa 3 khoảng trống lớn nhất về dòng liên kết nguồn/sức khoẻ dữ liệu
- **Nhóm:** Sản phẩm/Kỹ thuật → Chất lượng dữ liệu
- **Mô tả / hoàn thành khi:** Ưu tiên lỗi thiếu nguồn/kết quả/trùng lặp quan sát được trong Pilot.
- **Người phụ trách gợi ý:** Dữ liệu + Backend
- **Loại:** Kỹ thuật | **Ưu tiên:** P0 | **Trạng thái:** Chưa bắt đầu
- **Thời gian:** 2027-04-05 → 2027-04-16 (12 ngày lịch; ~6.0 ngày-người)
- **Phụ thuộc:** 10.11, 11.2
- **Đầu ra / bằng chứng:** Cải thiện sức khoẻ dữ liệu

#### 11.5 — Sửa 3 điểm ma sát lớn nhất của Sales
- **Nhóm:** Sản phẩm/Kỹ thuật → Mức độ sử dụng
- **Mô tả / hoàn thành khi:** Giảm số thao tác, cải thiện hàng đợi/bối cảnh, làm rõ trạng thái; dựa trên hành vi quan sát, không chỉ yêu cầu.
- **Người phụ trách gợi ý:** Sản phẩm + Full-stack
- **Loại:** Kỹ thuật | **Ưu tiên:** P0 | **Trạng thái:** Chưa bắt đầu
- **Thời gian:** 2027-04-05 → 2027-04-16 (12 ngày lịch; ~6.0 ngày-người)
- **Phụ thuộc:** 10.10, 11.2
- **Đầu ra / bằng chứng:** Trải nghiệm Sales v0.2

#### 11.6 — Chuẩn hoá gói triển khai
- **Nhóm:** Thành công KH/Vận hành → Triển khai
- **Mô tả / hoàn thành khi:** Mẫu cho khởi động, định nghĩa, thiết lập, đào tạo, rà soát tuần; đo số giờ-người triển khai.
- **Người phụ trách gợi ý:** Triển khai / Thành công KH
- **Loại:** Vận hành | **Ưu tiên:** P0 | **Trạng thái:** Chưa bắt đầu
- **Thời gian:** 2027-04-05 → 2027-04-14 (10 ngày lịch; ~4.0 ngày-người)
- **Phụ thuộc:** 10.12, 11.1
- **Đầu ra / bằng chứng:** Bộ triển khai v1

#### 11.7 — Hoàn thiện gói Pilot trả phí
- **Nhóm:** Tiếp cận thị trường (GTM) → Gói chào bán
- **Mô tả / hoàn thành khi:** Dùng bằng chứng Đợt 1 để viết lại điều kiện sàng lọc, phạm vi, khoảng giá, tiêu chí thành công và loại trừ.
- **Người phụ trách gợi ý:** Nhà sáng lập / GTM
- **Loại:** GTM | **Ưu tiên:** P0 | **Trạng thái:** Chưa bắt đầu
- **Thời gian:** 2027-04-05 → 2027-04-09 (5 ngày lịch; ~2.0 ngày-người)
- **Phụ thuộc:** 10.13, 11.1
- **Đầu ra / bằng chứng:** Gói Pilot trả phí v1

### 12. Pilot trả phí — Đợt 2

#### 12.1 — Tuyển 5-10 khách tiềm năng cho Pilot trả phí
- **Nhóm:** Tiếp cận thị trường (GTM) → Danh sách cơ hội bán hàng
- **Mô tả / hoàn thành khi:** Ưu tiên cùng ICP/ngành; sàng lọc bằng bảng chấm điểm chuẩn; không nhận dự án CRM riêng.
- **Người phụ trách gợi ý:** Nhà sáng lập / GTM
- **Loại:** GTM | **Ưu tiên:** P0 | **Trạng thái:** Chưa bắt đầu
- **Thời gian:** 2027-04-05 → 2027-04-23 (19 ngày lịch; ~5.0 ngày-người)
- **Phụ thuộc:** 11.7
- **Đầu ra / bằng chứng:** Danh sách cơ hội Đợt 2

#### 12.2 — Thực hiện khám phá/demo chuẩn
- **Nhóm:** Tiếp cận thị trường (GTM) → Sales
- **Mô tả / hoàn thành khi:** Dùng demo theo quy trình vấn đề; ghi lại độ dài chu kỳ bán và phản đối; tránh bán theo danh sách tính năng.
- **Người phụ trách gợi ý:** Nhà sáng lập / GTM
- **Loại:** GTM | **Ưu tiên:** P0 | **Trạng thái:** Chưa bắt đầu
- **Thời gian:** 2027-04-12 → 2027-04-30 (19 ngày lịch; ~5.0 ngày-người)
- **Phụ thuộc:** 12.1
- **Đầu ra / bằng chứng:** Ghi chép khám phá/demo

#### 12.3 — Chốt 5+ Pilot trả phí
- **Nhóm:** Tiếp cận thị trường (GTM) → Thương mại
- **Mô tả / hoàn thành khi:** Kiểm tra phí Pilot + đề xuất phí định kỳ; chấp nhận hoá đơn/hợp đồng thủ công.
- **Người phụ trách gợi ý:** Nhà sáng lập / GTM
- **Loại:** GTM | **Ưu tiên:** P0 | **Trạng thái:** Chưa bắt đầu
- **Thời gian:** 2027-04-19 → 2027-05-07 (19 ngày lịch; ~4.0 ngày-người)
- **Phụ thuộc:** 12.2
- **Đầu ra / bằng chứng:** Hợp đồng Pilot trả phí

#### 12.4 — Triển khai Đợt 2 bằng sổ tay chuẩn
- **Nhóm:** Triển khai → Hướng dẫn triển khai ban đầu
- **Mô tả / hoàn thành khi:** Theo dõi giờ theo khách, điểm khác và thời gian tới giá trị; nhóm không được tuỳ biến không giới hạn.
- **Người phụ trách gợi ý:** Triển khai / Thành công KH
- **Loại:** Vận hành | **Ưu tiên:** P0 | **Trạng thái:** Chưa bắt đầu
- **Thời gian:** 2027-04-26 → 2027-05-14 (19 ngày lịch; ~10.0 ngày-người)
- **Phụ thuộc:** 12.3, 11.6
- **Đầu ra / bằng chứng:** Các lần vận hành thật Đợt 2

#### 12.5 — Theo dõi hiệu quả kinh tế triển khai/hỗ trợ
- **Nhóm:** Đo lường → Hiệu quả kinh tế
- **Mô tả / hoàn thành khi:** Giờ thiết lập, yêu cầu hỗ trợ, chi phí hạ tầng/AI, quy mô khách hàng, doanh thu; so với mô hình mục tiêu.
- **Người phụ trách gợi ý:** Nhà sáng lập / Tài chính / Thành công KH
- **Loại:** Đo lường | **Ưu tiên:** P0 | **Trạng thái:** Chưa bắt đầu
- **Thời gian:** 2027-04-26 → 2027-05-21 (26 ngày lịch; ~3.0 ngày-người)
- **Phụ thuộc:** 12.4
- **Đầu ra / bằng chứng:** Hiệu quả kinh tế triển khai

#### 12.6 — Theo dõi chỉ báo sớm về mức sử dụng/giá trị trong 30 ngày
- **Nhóm:** Đo lường → Duy trì sử dụng/Giá trị
- **Mô tả / hoàn thành khi:** Mức sử dụng, độ bao phủ kết quả, tỷ lệ tuân thủ theo dõi tiếp, mức sử dụng hàng tuần của quản lý và mức sẵn sàng tiếp tục.
- **Người phụ trách gợi ý:** Sản phẩm / Dữ liệu
- **Loại:** Đo lường | **Ưu tiên:** P0 | **Trạng thái:** Chưa bắt đầu
- **Thời gian:** 2027-05-03 → 2027-05-28 (26 ngày lịch; ~4.0 ngày-người)
- **Phụ thuộc:** 12.4
- **Đầu ra / bằng chứng:** Bảng theo dõi giá trị Đợt 2

#### 12.7 — Cập nhật ma trận khả năng lặp lại
- **Nhóm:** Sản phẩm → Khả năng lặp lại
- **Mô tả / hoàn thành khi:** Mục tiêu cần biết: >=70-80% quy trình có thể chuẩn hoá; xác định mẫu theo ngành và thay đổi lõi.
- **Người phụ trách gợi ý:** Trưởng sản phẩm
- **Loại:** Quyết định | **Ưu tiên:** P0 | **Trạng thái:** Chưa bắt đầu
- **Thời gian:** 2027-05-17 → 2027-05-28 (12 ngày lịch; ~3.0 ngày-người)
- **Phụ thuộc:** 12.4, 12.6
- **Đầu ra / bằng chứng:** Khả năng lặp lại v2

### 13. Sẵn sàng thương mại

#### 13.1 — Chốt ICP v1 cho ra mắt giới hạn
- **Nhóm:** Chiến lược → ICP
- **Mô tả / hoàn thành khi:** Định nghĩa rõ khách nào được bán và điều kiện loại trừ dựa trên bằng chứng Đợt 1+2.
- **Người phụ trách gợi ý:** Nhà sáng lập / Sản phẩm
- **Loại:** Quyết định | **Ưu tiên:** P0 | **Trạng thái:** Chưa bắt đầu
- **Thời gian:** 2027-05-24 → 2027-05-28 (5 ngày lịch; ~1.5 ngày-người)
- **Phụ thuộc:** 12.7
- **Đầu ra / bằng chứng:** ICP v1

#### 13.2 — Chốt định vị/thông điệp v1
- **Nhóm:** Tiếp cận thị trường (GTM) → Định vị
- **Mô tả / hoàn thành khi:** Định vị theo vấn đề; nội bộ có thể giữ tên Revenue Continuity, còn thông điệp công khai phải cụ thể.
- **Người phụ trách gợi ý:** Nhà sáng lập / GTM
- **Loại:** GTM | **Ưu tiên:** P1 | **Trạng thái:** Chưa bắt đầu
- **Thời gian:** 2027-05-24 → 2027-05-31 (8 ngày lịch; ~2.0 ngày-người)
- **Phụ thuộc:** 13.1, 12.6
- **Đầu ra / bằng chứng:** Thông điệp v1

#### 13.3 — Chốt gói/định giá v1
- **Nhóm:** Tiếp cận thị trường (GTM) → Định giá
- **Mô tả / hoàn thành khi:** Quyết định phí triển khai + phí nền tảng/phí theo mức sử dụng định kỳ; không mặc định theo seat nếu chưa có bằng chứng.
- **Người phụ trách gợi ý:** Nhà sáng lập / Tài chính
- **Loại:** Quyết định | **Ưu tiên:** P0 | **Trạng thái:** Chưa bắt đầu
- **Thời gian:** 2027-05-24 → 2027-06-02 (10 ngày lịch; ~2.0 ngày-người)
- **Phụ thuộc:** 3.7, 12.5, 12.6
- **Đầu ra / bằng chứng:** Định giá v1

#### 13.4 — Trang giới thiệu + CTA đăng ký
- **Nhóm:** Tiếp cận thị trường (GTM) → Trang web
- **Mô tả / hoàn thành khi:** Ban đầu không tự đăng ký; Đặt lịch rà soát quy trình / Đăng ký Pilot; nêu điều kiện phù hợp và bằng chứng tình huống.
- **Người phụ trách gợi ý:** GTM / Thiết kế
- **Loại:** GTM | **Ưu tiên:** P1 | **Trạng thái:** Chưa bắt đầu
- **Thời gian:** 2027-05-31 → 2027-06-07 (8 ngày lịch; ~4.0 ngày-người)
- **Phụ thuộc:** 13.2
- **Đầu ra / bằng chứng:** Trang giới thiệu ra mắt

#### 13.5 — Kịch bản demo + xử lý phản đối
- **Nhóm:** Tiếp cận thị trường (GTM) → Tài liệu hỗ trợ Sales
- **Mô tả / hoàn thành khi:** Vì sao không chỉ dùng CRM/Pancake/Excel+n8n; lưu ý về độ chính xác dữ liệu; kỳ vọng triển khai.
- **Người phụ trách gợi ý:** GTM / Sản phẩm
- **Loại:** GTM | **Ưu tiên:** P1 | **Trạng thái:** Chưa bắt đầu
- **Thời gian:** 2027-05-31 → 2027-06-07 (8 ngày lịch; ~3.0 ngày-người)
- **Phụ thuộc:** 13.2, 12.2
- **Đầu ra / bằng chứng:** Sổ tay Sales v1

#### 13.6 — Chính sách hỗ trợ & chuyển cấp
- **Nhóm:** Thành công KH/Vận hành → Hỗ trợ
- **Mô tả / hoàn thành khi:** Định nghĩa kênh, mức nghiêm trọng, mục tiêu phản hồi, luồng sự cố kết nối và trách nhiệm khách hàng.
- **Người phụ trách gợi ý:** Thành công KH / Kỹ thuật
- **Loại:** Vận hành | **Ưu tiên:** P0 | **Trạng thái:** Chưa bắt đầu
- **Thời gian:** 2027-05-24 → 2027-06-02 (10 ngày lịch; ~2.0 ngày-người)
- **Phụ thuộc:** 12.4
- **Đầu ra / bằng chứng:** Chính sách hỗ trợ

#### 13.7 — Chương trình triển khai & sử dụng 30 ngày
- **Nhóm:** Thành công KH/Vận hành → Thành công khách hàng
- **Mô tả / hoàn thành khi:** Các mốc chuẩn từ khởi động đến tổng kết kinh doanh đầu tiên; định nghĩa chỉ số sức khoẻ.
- **Người phụ trách gợi ý:** Thành công KH / Sản phẩm
- **Loại:** Vận hành | **Ưu tiên:** P1 | **Trạng thái:** Chưa bắt đầu
- **Thời gian:** 2027-05-24 → 2027-06-04 (12 ngày lịch; ~3.0 ngày-người)
- **Phụ thuộc:** 11.6, 12.6
- **Đầu ra / bằng chứng:** Sổ tay Thành công KH v1

#### 13.8 — Điều khoản / Quyền riêng tư / DPA ban đầu
- **Nhóm:** Pháp lý/Bảo mật → Pháp lý thương mại
- **Mô tả / hoàn thành khi:** Rà soát xử lý dữ liệu khách hàng, sử dụng AI, nhà xử lý phụ, lưu/xoá dữ liệu và trách nhiệm kết nối.
- **Người phụ trách gợi ý:** Pháp lý / Nhà sáng lập
- **Loại:** Pháp lý | **Ưu tiên:** P0 | **Trạng thái:** Chưa bắt đầu
- **Thời gian:** 2027-05-17 → 2027-06-04 (19 ngày lịch; ~4.0 ngày-người)
- **Phụ thuộc:** 9.6, 12.3
- **Đầu ra / bằng chứng:** Bộ pháp lý thương mại

#### 13.9 — Danh sách kiểm tra bảo mật cho v1 thương mại
- **Nhóm:** Bảo mật → Sẵn sàng bảo mật
- **Mô tả / hoàn thành khi:** Cách ly khách hàng, lưu thông tin xác thực, kiểm toán, sao lưu, ứng phó sự cố, rà soát quyền truy cập; ghi rõ giới hạn đã biết.
- **Người phụ trách gợi ý:** Trưởng kỹ thuật
- **Loại:** Bảo mật | **Ưu tiên:** P0 | **Trạng thái:** Chưa bắt đầu
- **Thời gian:** 2027-05-17 → 2027-06-04 (19 ngày lịch; ~4.0 ngày-người)
- **Phụ thuộc:** 9.5, 9.7
- **Đầu ra / bằng chứng:** Security readiness báo cáo

#### 13.10 — Quy trình thanh toán/hóa đơn thủ công
- **Nhóm:** Tài chính/Vận hành → Thanh toán
- **Mô tả / hoàn thành khi:** Định nghĩa lịch hợp đồng/hóa đơn/gia hạn; chưa cần hệ thống thanh toán tự phục vụ.
- **Người phụ trách gợi ý:** Tài chính / Vận hành
- **Loại:** Vận hành | **Ưu tiên:** P1 | **Trạng thái:** Chưa bắt đầu
- **Thời gian:** 2027-05-31 → 2027-06-04 (5 ngày lịch; ~1.5 ngày-người)
- **Phụ thuộc:** 13.3
- **Đầu ra / bằng chứng:** Quy trình thanh toán

#### 13.11 — Đóng phạm vi v1
- **Nhóm:** Sản phẩm → Phát hành
- **Mô tả / hoàn thành khi:** Đóng phạm vi ra mắt giới hạn; tạo danh sách việc sau ra mắt; không thêm tính năng tuỳ biến muộn.
- **Người phụ trách gợi ý:** Trưởng sản phẩm
- **Loại:** Quyết định | **Ưu tiên:** P0 | **Trạng thái:** Chưa bắt đầu
- **Thời gian:** 2027-06-01 → 2027-06-03 (3 ngày lịch; ~1.0 ngày-người)
- **Phụ thuộc:** 12.7, 13.1
- **Đầu ra / bằng chứng:** v1 release phạm vi

#### 13.12 — Cổng 5: Sẵn sàng thương mại?
- **Nhóm:** Chiến lược → Quyết định qua cổng
- **Mô tả / hoàn thành khi:** Đạt nếu giá trị lặp lại, khách sẵn sàng trả phí, hiệu quả kinh tế triển khai chấp nhận được, độ tin cậy dữ liệu/bảo mật đủ mức và sổ tay hỗ trợ sẵn sàng.
- **Người phụ trách gợi ý:** Nhà sáng lập / Nhóm nòng cốt
- **Loại:** Quyết định | **Ưu tiên:** P0 | **Trạng thái:** Chưa bắt đầu
- **Thời gian:** 2027-06-04 → 2027-06-04 (1 ngày lịch; ~1.0 ngày-người)
- **Phụ thuộc:** 13.3, 13.6, 13.8, 13.9, 13.11
- **Cổng / Mốc:** Cổng 5 — 04/06
- **Đầu ra / bằng chứng:** Ra mắt giới hạn decision

### 14. Ra mắt thương mại giới hạn & ổn định

#### 14.1 — Bản ứng viên phát hành v1
- **Nhóm:** Phát hành/Triển khai → Phát hành
- **Mô tả / hoàn thành khi:** Phát hành bản v1 có đánh dấu phiên bản, kế hoạch chuyển đổi/hoàn tác, kiểm thử nhanh và ngưỡng giám sát.
- **Người phụ trách gợi ý:** Trưởng kỹ thuật
- **Loại:** Phát hành | **Ưu tiên:** P0 | **Trạng thái:** Chưa bắt đầu
- **Thời gian:** 2027-06-07 → 2027-06-11 (5 ngày lịch; ~3.0 ngày-người)
- **Phụ thuộc:** 13.12
- **Đầu ra / bằng chứng:** Bản ứng viên phát hành v1 (RC)

#### 14.2 — Ra mắt giới hạn
- **Nhóm:** Phát hành/Triển khai → Ra mắt
- **Mô tả / hoàn thành khi:** Chỉ mở bán cho ICP đạt chuẩn; mặc định vẫn tạo tài khoản thủ công + triển khai có hướng dẫn.
- **Người phụ trách gợi ý:** Nhà sáng lập / GTM / Thành công KH
- **Loại:** Phát hành | **Ưu tiên:** P0 | **Trạng thái:** Chưa bắt đầu
- **Thời gian:** 2027-06-14 → 2027-06-14 (1 ngày lịch; ~1.0 ngày-người)
- **Phụ thuộc:** 14.1, 13.4, 13.5
- **Cổng / Mốc:** Mốc: 14/06/2027
- **Đầu ra / bằng chứng:** v1 thương mại giới hạn

#### 14.3 — Phân loại vấn đề ra mắt hàng ngày — 2 tuần đầu
- **Nhóm:** Thành công KH/Vận hành → Ổn định hệ thống
- **Mô tả / hoàn thành khi:** Rà soát sự cố, kích hoạt, sức khoẻ kết nối, hỗ trợ, độ bao phủ dữ liệu; chỉ ưu tiên P0/P1.
- **Người phụ trách gợi ý:** Nhóm nòng cốt
- **Loại:** Vận hành | **Ưu tiên:** P0 | **Trạng thái:** Chưa bắt đầu
- **Thời gian:** 2027-06-14 → 2027-06-25 (12 ngày lịch; ~6.0 ngày-người)
- **Phụ thuộc:** 14.2
- **Đầu ra / bằng chứng:** Nhật ký xử lý sự cố khi ra mắt

#### 14.4 — Theo dõi chỉ số nhóm ra mắt
- **Nhóm:** Đo lường → Chỉ số ra mắt
- **Mô tả / hoàn thành khi:** Danh sách cơ hội đạt chuẩn, tỷ lệ chốt, giờ triển khai ban đầu, kích hoạt, độ bao phủ kết quả, mức sử dụng hàng tuần của quản lý, gánh nặng hỗ trợ.
- **Người phụ trách gợi ý:** Sản phẩm / Dữ liệu
- **Loại:** Đo lường | **Ưu tiên:** P0 | **Trạng thái:** Chưa bắt đầu
- **Thời gian:** 2027-06-14 → 2027-06-30 (17 ngày lịch; ~3.0 ngày-người)
- **Phụ thuộc:** 14.2
- **Đầu ra / bằng chứng:** Bảng theo dõi nhóm ra mắt

#### 14.5 — Danh sách bài học 30 ngày
- **Nhóm:** Sản phẩm → Bài học
- **Mô tả / hoàn thành khi:** Ghi lại ma sát lặp lại, khoảng trống sản phẩm, phản đối GTM và đầu việc triển khai; gắn nhãn Lõi/Theo ngành/Riêng lẻ.
- **Người phụ trách gợi ý:** Trưởng sản phẩm
- **Loại:** Vận hành nghiên cứu | **Ưu tiên:** P1 | **Trạng thái:** Chưa bắt đầu
- **Thời gian:** 2027-06-14 → 2027-06-30 (17 ngày lịch; ~2.0 ngày-người)
- **Phụ thuộc:** 14.2
- **Đầu ra / bằng chứng:** Danh sách việc sau ra mắt

#### 14.6 — Quyết định hướng mở rộng
- **Nhóm:** Chiến lược → Giai đoạn tiếp theo
- **Mô tả / hoàn thành khi:** Rà soát cuối tháng 6: tiếp tục bán có Sales dẫn dắt, chuyên sâu hơn theo ngành, thêm kết nối nguồn thu hút khách, đầu tư tự phục vụ hoặc lùi lại theo bằng chứng.
- **Người phụ trách gợi ý:** Nhà sáng lập / Nhóm nòng cốt
- **Loại:** Quyết định | **Ưu tiên:** P0 | **Trạng thái:** Chưa bắt đầu
- **Thời gian:** 2027-06-30 → 2027-06-30 (1 ngày lịch; ~1.0 ngày-người)
- **Phụ thuộc:** 14.3, 14.4, 14.5
- **Cổng / Mốc:** Mốc: Rà soát tháng 6
- **Đầu ra / bằng chứng:** Quyết định chiến lược nửa cuối 2027

## 6. Cách AI Coding nên dùng kế hoạch
- Khi nhận yêu cầu chung như “tiếp tục project”, xác định task P0/P1 gần nhất chưa hoàn thành mà dependency đã xong.
- Khi nhận yêu cầu code cụ thể, map yêu cầu đó tới `task.id`; nếu không map được, coi là **scope mới** và nêu rõ trước khi triển khai.
- Không xem deadline là lý do bỏ qua research gate.
- Với task Research/Quyết định, AI có thể hỗ trợ tài liệu/phân tích/prototype nhưng không tự đánh dấu giả thuyết là “đã xác thực” nếu chưa có bằng chứng khách hàng.
- Với task Engineering, ưu tiên code nhỏ, test được, có log/audit, và giữ integration adapter tách khỏi domain.
- Với task Pilot/Commercial, không tự động mở self-service signup, billing hoặc multi-plan nếu chưa có quyết định tương ứng.
