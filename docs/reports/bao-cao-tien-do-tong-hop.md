# Báo cáo tiến độ tổng hợp — North Start Commercial Support Platform

Ngày báo cáo: 26/10/2026. Toàn bộ trạng thái và số liệu dưới đây được đo tại mốc lưu mã nguồn mới nhất trên nhánh chính, chốt ngày 08/10/2026.

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

**f. Phân quyền và cách ly dữ liệu giữa các đơn vị.** Mọi thao tác đều đòi hỏi danh tính đã xác nhận. Đơn vị này không nhìn thấy dữ liệu của đơn vị khác: hồ sơ không thuộc mình được trả lời là không tìm thấy thay vì báo bị cấm, tránh tiết lộ sự tồn tại của hồ sơ. Quyền truy cập bị khóa trong phạm vi hồ sơ khách được phân công. Ba quyền — xem, chấp nhận bàn giao, và cập nhật — đã tách rời sau phản biện, khắc phục lỗi bản đầu vốn cho phép người mới được đề xuất nhận đã sửa hộ.

**g. Luồng nghiệp vụ dùng thử chạy được từ đầu đến cuối.** Luồng gồm: ghi nhận tình huống khách phát sinh; bàn giao sang nhân viên tư vấn cụ thể; người nhận xem và chấp nhận; tạo đầu việc kèm bên chịu trách nhiệm và hạn chót; hoàn tất công việc kèm bằng chứng; ghi kết quả; dời hạn chót bằng cách tạo đầu việc thay thế và khóa đầu việc cũ; đọc lại lịch sử kiểm toán. Luồng đã chạy qua dịch vụ mạng thật trên cơ sở dữ liệu thật với kịch bản 15 bước và 53 điều kiện đối chiếu, kể cả tắt rồi khởi động lại tiến trình ứng dụng. Khi vi phạm rào cản nghiệp vụ, hệ thống trả lỗi hợp lệ kèm mã nguyên nhân tường minh thay vì lỗi hệ thống.

**h. Kiểm định và sửa lỗi theo phản biện.** Đợt phản biện đầu tìm ra năm sai sót nghiệp vụ; quá trình ổn định bộ kiểm thử phát hiện thêm lỗi thứ sáu khi hai tiến trình cùng khởi tạo cấu trúc dữ liệu đồng thời. Sáu vòng sửa đã chốt, mỗi vòng kèm kiểm thử hồi quy. Đợt rà soát thứ hai tiếp tục sửa bước nâng cấp cấu trúc thứ tư vốn xóa nhầm bản ghi dữ liệu gốc, đồng thời đồng bộ lại điều kiện kiểm thử và tài liệu.

## 4. Kết quả đo được

| Chỉ số | Giá trị | Thời điểm |
|---|---|---|
| Số bài kiểm thử tự động chạy được | 132 → 238 | 22/09/2026 → 08/10/2026 |
| Trong đó chạy trực tiếp trên cơ sở dữ liệu thật | 10 | 08/10/2026 |
| Độ bao phủ dòng mã nguồn, có cơ sở dữ liệu | khoảng 91% | 08/10/2026 |
| Độ bao phủ dòng mã nguồn, không có cơ sở dữ liệu | khoảng 76% (dưới ngưỡng tự đặt 80%) | 08/10/2026 |
| Phiên bản cấu trúc cơ sở dữ liệu, nâng và hạ đều đã chạy | 4 | 08/10/2026 |
| Điểm truy cập nghiệp vụ đang hoạt động | 10, cùng 1 điểm kiểm tra tình trạng | 26/10/2026 |
| Hạng mục năng lực được theo dõi | 37: 6 xong, 14 đang làm, 4 đã lên kế hoạch, 13 còn đề xuất | 27/10/2026 |

Mốc thời gian chính: lần lưu mã nguồn đầu tiên ngày 19/09/2026; khung nghiên cứu khả thi và bộ khung ứng dụng ngày 21/09/2026; mô hình nghiệp vụ cốt lõi ngày 22/09/2026; lưu trữ bền vững, vòng nghiệp vụ và các vòng sửa lỗi ngày 07–08/10/2026.

## 5. Giới hạn trung thực

Hệ thống chưa có giao diện người dùng: phần mềm mới chỉ cung cấp các điểm truy cập trao đổi dữ liệu ở tầng máy chủ, nên nhân viên tư vấn chưa thể tự vận hành. Toàn bộ bằng chứng hiện là dữ liệu giả định do một người thao tác tạo ra, chưa có người dùng thật; theo đúng quy tắc dự án, dữ liệu giả định không được tính là bằng chứng về giá trị với khách hàng thật. Chưa có quy trình kiểm thử tự động trên hạ tầng chung, nên mọi con số trên đều đo tại máy cá nhân và cần con người rà soát thêm. Cơ chế danh tính hiện là bản tạm phục vụ phát triển: phía gọi tự khai danh tính và vai trò, tuyệt đối chưa an toàn cho dữ liệu khách thật.

Đợt thẩm định độc lập qua dịch vụ chạy thật cho thấy ba lỗ hổng nghiệp vụ vẫn còn mở. Thứ nhất, hai đơn vị kinh doanh khác nhau có thể bị trùng khóa chống lặp khi mã định danh chứa ký tự phân cách nhập nhằng (đã tái hiện trên bộ nhớ tạm, chưa tái hiện trực tiếp trên cơ sở dữ liệu thật). Thứ hai, người sở hữu hồ sơ vẫn tự chấp nhận hoặc hoàn tất được đầu việc giao đích danh cho người khác; và người nhận bàn giao trước bị mất quyền xem hồ sơ ngay khi có bàn giao tiếp theo, dù đầu việc của họ còn mở. Thứ ba, đầu việc vẫn đóng được ở mức bằng chứng cao nhất chỉ bằng cách trỏ vào tin nhắn khách hỏi thông tin ban đầu; thậm chí vẫn đóng được khi đánh dấu thiếu bằng chứng hoặc bằng chứng mâu thuẫn, rồi đi tiếp tới kết quả khách chốt đăng ký học. Đáng lưu ý, một số bài kiểm thử và kịch bản trình diễn hiện đang viết theo hướng kỳ vọng chính hành vi sai thứ ba này, nên việc bộ kiểm thử báo đạt chưa chứng minh tính đúng. Ngoài ra chưa có cơ chế chống hai người lưu đè lên cùng một phiên bản hồ sơ, chưa có tệp cấu hình cho bộ kiểm thử tổng thể dù đã khai báo lệnh chạy, và lần cập nhật mã nguồn cuối trên nhánh chính cách ngày báo cáo 18 ngày (08/10/2026 → 26/10/2026).

## 6. Hướng tiếp theo

Bước thứ nhất: sửa triệt để ba lỗ hổng còn mở, viết lại các điều kiện kiểm thử đang đòi hỏi hành vi sai, và kiểm chứng trên cả bộ nhớ tạm lẫn cơ sở dữ liệu thật. Bước thứ hai: thêm cơ chế khóa phiên bản chống ghi đè đồng thời, và dựng quy trình kiểm thử tự động trên hạ tầng chung với cơ sở dữ liệu kiểm thử tách biệt. Bước thứ ba: làm một màn hình thao tác tối giản để một tư vấn viên thật tự chạy trọn vòng trên dữ liệu giả định. Mốc gần nhất: một vòng nghiệp vụ đúng, người làm kinh doanh tự vận hành được mà không cần kỹ sư can thiệp.

## Ghi chú về độ tin cậy của số liệu

Số điểm truy cập được đếm trực tiếp từ mã nguồn tại mốc đo (10 điểm nghiệp vụ cộng 1 điểm kiểm tra tình trạng); tài liệu bàn giao kỹ thuật ngày 11/10/2026 ban đầu ghi nhầm là 12 điểm và đã được đính chính lại. Về bảng phân loại hạng mục năng lực ở mục 4: bản ngày 26/10/2026 ghi 13 hạng mục xong; sau khi rà soát chéo từng hạng mục với mã nguồn và chính ghi chú bên trong nó, 8 hạng mục tự khai còn phần hoãn hoặc dính ba lỗ hổng đang mở đã được hạ về mức "đang làm", nên số liệu chốt là 6 xong / 14 đang làm / 4 đã lên kế hoạch / 13 còn đề xuất. Đây là hướng sửa khắt khe hơn, đúng quy tắc "không được tự nhận là xong khi còn phần hoãn". Về ba lỗ hổng còn mở: báo cáo kiểm tra nội bộ ngày 08/10/2026 đánh dấu các lỗi phản biện đợt đầu đã sửa, nhưng lượt thẩm định độc lập ngày 11/10/2026 đã tái hiện qua dịch vụ mạng thật ba điểm còn hở nêu trên; báo cáo này theo kết quả thực nghiệm khắt khe hơn. Cũng cần ghi nhận: bước nâng cấp cấu trúc cơ sở dữ liệu thứ tư ở vòng sửa đầu từng xóa nhầm bản ghi dữ liệu gốc và chỉ được sửa đúng ở vòng kế tiếp bằng cơ chế cách ly. Lượt chạy kiểm thử ngày 11/10/2026 trên cơ sở dữ liệu phát triển có để lại một số nhật ký kiểm toán không còn hồ sơ gốc tương ứng — đây là vấn đề vệ sinh môi trường kiểm thử dùng chung, không ảnh hưởng các con số về số bài kiểm thử và độ bao phủ mã nguồn.
