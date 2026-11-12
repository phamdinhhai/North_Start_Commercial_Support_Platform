# Báo cáo tiến độ tổng hợp — North Start Commercial Support Platform

Ngày báo cáo: 27/10/2026. Toàn bộ trạng thái và số liệu dưới đây được đo tại mốc lưu mã nguồn mới nhất trên nhánh chính chốt ngày 27/10/2026.

## 1. Mở đầu

Dự án xây một tầng nghiệp vụ chung cho doanh nghiệp dịch vụ, giúp giữ nguyên ý nghĩa thương mại của khách hàng khi người này đi qua nhiều hệ thống và nhiều nhân viên phụ trách. Về kinh doanh, đây là một dòng liên tục: thu hút sự chú ý, trò chuyện tư vấn, ghi nhận nhu cầu, bàn giao, hành động bán hàng, kết quả, rồi xác định nguồn tiếp thị đã tạo ra doanh thu. Về dữ liệu và trách nhiệm, dòng đó lại thường bị chia cắt. Khi khách chuyển kênh hoặc chuyển người phụ trách, doanh nghiệp thường giữ được số điện thoại nhưng mất nhu cầu đã xác định, lời hứa đã đưa ra, người tham gia quyết định, và đầu việc cần làm tiếp theo. Hệ quả là nhân viên tư vấn phải đọc lại lịch sử, hỏi lại khách, và tự dùng trí nhớ để biết mình còn nợ việc gì; người quản lý khó biết khách bị bỏ quên ở khâu nào. Sản phẩm nhắm vào khoảng trống đó bằng một hồ sơ thương mại liền mạch, có bằng chứng đối chiếu, có phân quyền, và có lịch sử kiểm toán.

## 2. Phạm vi đang làm và phạm vi chưa làm

Phạm vi hiện tại là vòng nghiệp vụ vận hành thủ công do con người thao tác, áp cho phân khúc thử nghiệm là doanh nghiệp giáo dục tư vấn khóa học cho khách hàng cá nhân, với toàn bộ dữ liệu là dữ liệu giả định dùng cho trình diễn và kiểm chứng. Phần chủ đích chưa làm, đã ghi rõ là hoãn lại, gồm: đồng bộ với nền tảng quản lý hội thoại bên ngoài, trích xuất việc tự động bằng trí tuệ nhân tạo, màn hình ngoại lệ cho cấp quản lý, và đóng gói thương mại cho nhiều đơn vị thuê bao. Cách tách phạm vi này là có chủ đích: phần lõi phải chạy đúng và chứng minh được giá trị trước khi nối vào hệ thống bên ngoài.

## 3. Các hạng mục công việc đã thực hiện

**a. Nền tảng quản trị tài liệu và quy tắc nghiệp vụ.** Thiết lập tầng quy tắc chuẩn mực: bản định hướng cốt lõi của sản phẩm, mười hai nguyên tắc nghiệp vụ bất biến được cố định, quy tắc về độ tin cậy và bằng chứng, quy tắc định danh khách hàng, sổ theo dõi bảy quyết định thiết kế còn để mở chưa được phép tự ý chốt, và hệ thống phân tầng tài liệu để phần làm sau không thể âm thầm phủ quyết quyết định làm trước. Nguyên tắc nền được ghi rõ: bộ kiểm thử báo đạt không được phép thắng một nguyên tắc nghiệp vụ bị vi phạm.

**b. Nghiên cứu khả thi và khảo sát yêu cầu.** Khảo sát nền tảng quản lý hội thoại bên ngoài ở bốn chủ đề: cơ chế xác thực, phân trang dữ liệu lớn, nhận thông báo tự động khi có sự kiện mới, và thiết kế bản ghi bọc dữ liệu gốc kèm thông tin xuất xứ. Song song là biên bản hỏi–đáp nghiệp vụ khoảng 60 mục và bản dự thảo đặc tả yêu cầu. Giới hạn cần nói thẳng: tính khả thi của nền tảng bên ngoài mới dừng ở tài liệu khảo sát, chưa kiểm lại với dịch vụ chạy thật, nên vẫn là rủi ro cho giai đoạn tích hợp.

**c. Nền tảng kỹ thuật dùng chung.** Dựng bộ khung ứng dụng: chốt phiên bản môi trường chạy và ngôn ngữ lập trình, tầng dịch vụ nhận yêu cầu qua mạng, công cụ kiểm thử tự động, điểm kiểm tra tình trạng hệ thống, ranh giới cô lập bước đầu giữa các đơn vị kinh doanh, cùng hai quy trình kiểm tra kiểu dữ liệu và đóng gói bản chạy.

**d. Mô hình nghiệp vụ cốt lõi.** Khách hàng và cơ hội tư vấn thương mại được giữ là hai thực thể tách biệt, không gộp làm một. Bàn giao được mô hình hóa thành đối tượng có người giao, người nhận, bằng chứng và dấu vết. Kết quả tư vấn được ghi kèm cơ chế đính chính bằng cách thêm bản ghi mới, không xóa bản cũ. Tình trạng thiếu thông tin được phân loại tường minh thành năm mức độ thay vì để trống. Nhật ký kiểm toán chỉ ghi thêm, không sửa, không xóa. Mọi thông tin suy luận đều đặt trong bản ghi bọc dữ liệu có xuất xứ, độ tin cậy và mốc thời gian.

**e. Lưu trữ bền vững và bảo vệ dữ liệu.** Vòng nghiệp vụ chạy trên cơ sở dữ liệu quan hệ thật với bốn phiên bản cấu trúc dữ liệu, cả chiều nâng và hạ đều đã chạy kiểm chứng. Thay đổi trạng thái và dấu vết kiểm toán nằm trong cùng một giao dịch, không thể mất một trong hai. Một quy tắc an toàn dữ liệu đã được sửa sau phản biện: bản ghi cũ chưa rõ thuộc đơn vị nào được đưa vào bảng cách ly để giữ nguyên dữ liệu gốc thay vì xóa, còn quy trình nâng cấp cấu trúc từ chối tự đoán chủ sở hữu khi thông tin nhập nhằng — hệ thống dừng lại và hoàn tác toàn bộ.

**f. Phân quyền và cách ly dữ liệu giữa các đơn vị.** Mọi thao tác đều đòi hỏi danh tính đã xác nhận. Đơn vị này không nhìn thấy dữ liệu của đơn vị khác: hồ sơ không thuộc mình được trả lời là không tìm thấy thay vì báo bị cấm, tránh tiết lộ sự tồn tại của hồ sơ. Quyền truy cập bị khóa trong phạm vi hồ sơ khách được phân công. Ba quyền — xem, chấp nhận bàn giao, và cập nhật — được tách rời đến từng đầu việc cụ thể: chủ sở hữu hồ sơ không thể tự chấp nhận hay tự hoàn tất thay cho người nhận bàn giao, và người nhận bàn giao trước vẫn giữ được quyền xem hồ sơ chừng nào đầu việc của họ còn hiệu lực, ngay cả khi có bàn giao tiếp theo cho người thứ ba.

**g. Luồng nghiệp vụ dùng thử chạy được từ đầu đến cuối.** Luồng gồm: ghi nhận tình huống khách phát sinh; bàn giao sang nhân viên tư vấn cụ thể; người nhận xem và chấp nhận; tạo đầu việc kèm bên chịu trách nhiệm và hạn chót; hoàn tất công việc kèm bằng chứng; ghi kết quả; dời hạn chót bằng cách tạo đầu việc thay thế và khóa đầu việc cũ; đọc lại lịch sử kiểm toán. Luồng đã chạy qua dịch vụ mạng thật trên cơ sở dữ liệu thật với kịch bản 16 bước và 60 điều kiện đối chiếu, kể cả tắt rồi khởi động lại tiến trình ứng dụng. Khi vi phạm rào cản nghiệp vụ, hệ thống trả lỗi hợp lệ kèm mã nguyên nhân tường minh thay vì lỗi hệ thống.

**h. Kiểm định và sửa lỗi theo phản biện.** Đợt phản biện đầu tìm ra năm sai sót nghiệp vụ; quá trình ổn định bộ kiểm thử phát hiện thêm lỗi thứ sáu khi hai tiến trình cùng khởi tạo cấu trúc dữ liệu đồng thời. Đợt rà soát thứ hai sửa bước nâng cấp cấu trúc cơ sở dữ liệu thứ tư vốn xóa nhầm bản ghi dữ liệu gốc bằng cơ chế đưa vào bảng cách ly. Đợt thẩm định độc lập qua dịch vụ chạy thật tiếp đó phát hiện thêm ba điểm còn hở trong phần triển khai đầu tiên: khóa chống trùng bản ghi có thể va chạm giữa hai đơn vị khi tên kết nối chứa dấu hai chấm; kiểm tra quyền nhận và đóng việc mới dừng ở cấp hồ sơ thay vì cấp từng đầu việc; và việc hoàn tất công việc từng chấp nhận chính tin nhắn hỏi thông tin ban đầu của khách làm bằng chứng quan sát được hoặc cho phép đóng việc khi thiếu bằng chứng. Ngày 27/10/2026, cả ba lỗ hổng này cùng toàn bộ các điều kiện kiểm thử từng viết theo kỳ vọng cũ đã được sửa triệt để và xác nhận lại trên cả bộ nhớ tạm, cơ sở dữ liệu thật, và dịch vụ mạng thật.

## 4. Kết quả đo được

| Chỉ số | Giá trị | Thời điểm |
|---|---|---|
| Số bài kiểm thử tự động chạy được | 132 → 238 → 243 | 22/09/2026 → 08/10/2026 → 27/10/2026 |
| Trong đó chạy trực tiếp trên cơ sở dữ liệu thật | 10 | 27/10/2026 |
| Số điều kiện đối chiếu qua dịch vụ mạng thật và khởi động lại ứng dụng | 53 → 60 (đạt 60/60) | 08/10/2026 → 27/10/2026 |
| Độ bao phủ dòng mã nguồn, có cơ sở dữ liệu | khoảng 91,5% | 27/10/2026 |
| Độ bao phủ dòng mã nguồn, không có cơ sở dữ liệu | khoảng 76,1% (dưới ngưỡng tự đặt 80%) | 27/10/2026 |
| Phiên bản cấu trúc cơ sở dữ liệu, nâng và hạ đều đã chạy | 4 | 08/10/2026 |
| Điểm truy cập nghiệp vụ đang hoạt động | 10, cùng 1 điểm kiểm tra tình trạng | 27/10/2026 |
| Hạng mục năng lực được theo dõi | 37: 6 xong, 14 đang làm, 4 đã lên kế hoạch, 13 còn đề xuất | 27/10/2026 |

Mốc thời gian chính: lần lưu mã nguồn đầu tiên ngày 19/09/2026; khung nghiên cứu khả thi và bộ khung ứng dụng ngày 21/09/2026; mô hình nghiệp vụ cốt lõi ngày 22/09/2026; lưu trữ bền vững và vòng nghiệp vụ ngày 07–08/10/2026; chuẩn hóa toàn bộ hệ thống tài liệu và khóa xong ba lỗ hổng nghiệp vụ còn lại ngày 27/10/2026.

## 5. Giới hạn trung thực

Hệ thống chưa có giao diện người dùng: phần mềm mới chỉ cung cấp các điểm truy cập trao đổi dữ liệu ở tầng máy chủ, nên nhân viên tư vấn chưa thể tự vận hành. Toàn bộ bằng chứng hiện là dữ liệu giả định do một người thao tác tạo ra, chưa có người dùng thật; theo đúng quy tắc dự án, dữ liệu giả định không được tính là bằng chứng về giá trị với khách hàng thật. Chưa có quy trình kiểm thử tự động trên hạ tầng chung, nên mọi con số trên đều đo tại máy cá nhân và cần con người rà soát thêm. Cơ chế danh tính hiện là bản tạm phục vụ phát triển: phía gọi tự khai danh tính và vai trò, tuyệt đối chưa an toàn cho dữ liệu khách thật.

Sau khi đóng xong cả năm nhóm lỗi nghiệp vụ từ các đợt phản biện, những khoảng trống kỹ thuật còn lại được nhận diện rõ gồm: chưa có cơ chế khóa phiên bản để ngăn hai người lưu đè lên cùng một phiên bản hồ sơ; chưa có rào cản ngăn ghi nhận kết quả thắng hoặc thua khi vẫn còn đầu việc đang mở trên hồ sơ; hai mô-đun ghi nhận sự kiện sử dụng và phản hồi người dùng đã viết xong mã nguồn nhưng chưa nối vào điểm truy cập mạng; và chưa có tệp cấu hình riêng cho bộ kiểm thử tổng thể dù đã khai báo lệnh chạy.

## 6. Hướng tiếp theo

Bước thứ nhất (đã hoàn thành ngày 27/10/2026): sửa triệt để ba lỗ hổng nghiệp vụ còn mở từ đợt thẩm định độc lập, viết lại các điều kiện kiểm thử từng đòi hỏi hành vi sai, và kiểm chứng đạt 243/243 bài kiểm thử cùng 60/60 điều kiện đối chiếu qua dịch vụ mạng thật. Bước thứ hai (trọng tâm kế tiếp): thêm cơ chế khóa phiên bản chống ghi đè đồng thời khi nhiều người cùng cập nhật một hồ sơ, và dựng quy trình kiểm thử tự động trên hạ tầng chung với cơ sở dữ liệu kiểm thử tách biệt. Bước thứ ba: làm một màn hình thao tác tối giản để một tư vấn viên thật tự chạy trọn vòng trên dữ liệu giả định. Mốc gần nhất: một vòng nghiệp vụ đúng, người làm kinh doanh tự vận hành được mà không cần kỹ sư can thiệp.

## Ghi chú về độ tin cậy của số liệu

Số điểm truy cập được đếm trực tiếp từ mã nguồn tại mốc đo (10 điểm nghiệp vụ cộng 1 điểm kiểm tra tình trạng); tài liệu bàn giao kỹ thuật ngày 11/10/2026 ban đầu ghi nhầm là 12 điểm và đã được đính chính lại. Về bảng phân loại hạng mục năng lực ở mục 4: bản trước ngày 26/10/2026 ghi 13 hạng mục xong; sau khi rà soát chéo từng hạng mục với mã nguồn và chính ghi chú bên trong nó, những hạng mục tự khai còn phần hoãn sang giai đoạn sau đã được giữ ở mức "đang làm" theo đúng quy tắc "không được tự nhận là xong khi còn phần hoãn". Về ba lỗ hổng nghiệp vụ được phát hiện trong đợt thẩm định độc lập ngày 11/10/2026: cả ba đều đã được đóng bằng mã nguồn và bài kiểm thử hồi quy tại mốc ngày 27/10/2026 (tăng từ 238 lên 243 bài kiểm thử tự động và từ 53 lên 60 điều kiện kiểm chứng qua mạng thật). Lượt chạy kiểm thử trên cơ sở dữ liệu phát triển có để lại một số nhật ký kiểm toán không còn hồ sơ gốc tương ứng do thiết kế cố ý giữ vĩnh viễn lịch sử kiểm toán ngay cả khi xóa đơn vị thử nghiệm — đây là vấn đề vệ sinh môi trường kiểm thử dùng chung, không ảnh hưởng các con số về số bài kiểm thử và độ bao phủ mã nguồn.
