# ĐỊNH NGHĨA BÀI TOÁN — PHIÊN BẢN 2

## Nền tảng hợp nhất tiếp thị, bán hàng và quản lý quan hệ khách hàng

**Dự án:** Ultra Platform  
**Ngày:** 06/10/2026  
**Trạng thái:** Định nghĩa bài toán và kế hoạch kiểm chứng; chưa phải đặc tả sản phẩm hay mô hình dữ liệu đã đóng băng.  

---

## 1. Mục đích và cách đọc tài liệu

Tài liệu xác định vấn đề kinh doanh cần giải quyết, các điều kiện mà giải pháp phải hoạt động trong đó, phạm vi khởi đầu và bằng chứng cần thu thập trước khi mở rộng sản phẩm.

Phiên bản 2 giữ nguyên định nghĩa cốt lõi và định hướng dài hạn của bản trước. Thay đổi chính là tổ chức lại nội dung theo sáu tầng: nỗi đau kinh doanh, nguyên nhân gốc, vấn đề đo lường, ràng buộc tổ chức, yêu cầu sản phẩm và ràng buộc bên ngoài. Phân khúc khách hàng, phạm vi MVP và giả thuyết mô hình được trình bày riêng để tránh coi tất cả là những bài toán ngang hàng.

Các quyết định về MVP dưới đây là lựa chọn phạm vi để kiểm chứng. Chúng không chứng minh rằng thị trường đã có nhu cầu đủ lớn hoặc khách hàng đã sẵn sàng trả tiền. Mọi ngưỡng định lượng trong kế hoạch kiểm chứng đều là **ngưỡng đề xuất đặt trước**, không phải số liệu thực nghiệm hay chuẩn chung của ngành.

## 2. Bối cảnh

Ở doanh nghiệp có hoạt động bán hàng dựa vào quảng cáo và tương tác trực tuyến, một khách hàng thường đi qua nhiều hệ thống và nhiều bộ phận.

Khách có thể biết đến doanh nghiệp qua Meta, TikTok, Google hoặc một nguồn giới thiệu; bình luận hay nhắn tin; được tư vấn và sàng lọc trên Pancake, Fchat, Vpage hoặc công cụ tương tự; rồi được bàn giao cho nhân viên bán hàng để tiếp tục qua điện thoại, Zalo hoặc gặp trực tiếp. Đơn hàng, hợp đồng, ghi danh, thanh toán và doanh thu có thể được ghi nhận trong Sapo, phần mềm chuyên ngành, hệ thống quản lý khách hàng hoặc bảng tính.

Mỗi hệ thống giữ một phần của quá trình. Dữ liệu quảng cáo phản ánh hoạt động thu hút; hội thoại phản ánh những gì đã trao đổi trên kênh được kết nối; nhân viên giữ thông tin từ các tương tác ngoài hệ thống; phần mềm nghiệp vụ giữ trạng thái và kết quả giao dịch.

Về mặt kinh doanh, đây là một quá trình liên tục. Về mặt dữ liệu và trách nhiệm, nó thường bị chia cắt. Khi chuyển kênh hoặc chuyển người phụ trách, doanh nghiệp có thể giữ được số điện thoại nhưng mất nhu cầu đã xác định, điều đã hứa, người tham gia quyết định và việc cần làm tiếp theo.

Không mặc định mọi doanh nghiệp đều gặp vấn đề này ở mức đáng trả tiền. Một số doanh nghiệp vẫn vận hành đủ tốt bằng công cụ hội thoại và bảng tính. Mức độ phổ biến, hậu quả và khả năng chi trả phải được kiểm chứng trong phân khúc cụ thể.

## 3. Định nghĩa cốt lõi và định hướng dài hạn

### 3.1. Định nghĩa tổng hợp của bản gốc

> Doanh nghiệp đang có dữ liệu về cùng một khách hàng nằm rải rác từ nền tảng quảng cáo, hệ thống hội thoại, nhân viên Marketing, nhân viên Bán hàng, hệ thống quản lý khách hàng và hệ thống ghi nhận doanh thu. Khi khách hàng di chuyển qua các bộ phận và kênh khác nhau, danh tính, nguồn gốc, ngữ cảnh, ý nghĩa thương mại, trách nhiệm xử lý và kết quả kinh doanh không được duy trì trong một chuỗi dữ liệu liên tục.

Hệ quả là bộ phận tiếp thị khó nhìn thấy chất lượng thương mại của nguồn khách; bán hàng phải đọc lại, hỏi lại và tự nhớ việc; quản lý khó xác định khách đang bị bỏ quên ở đâu; doanh nghiệp khó nối hoạt động thu hút với kết quả cuối cùng một cách có căn cứ.

### 3.2. North Star được giữ nguyên

> Doanh nghiệp cần duy trì một hành trình thương mại liên tục của khách hàng xuyên qua nhiều hệ thống, nhiều kênh và nhiều bộ phận; trong đó nguồn gốc, danh tính, ngữ cảnh, ý nghĩa thương mại, người chịu trách nhiệm, hành động tiếp theo và kết quả cuối cùng luôn được bảo toàn và có thể truy vết.

Vòng dữ liệu dài hạn của bản gốc:

> Hoạt động thu hút khách hàng → Tương tác → Sàng lọc → Bàn giao → Bán hàng → Kết quả → Doanh thu → Đo lường → Học hỏi → Quay lại tối ưu hoạt động thu hút khách hàng.

Đây là định hướng cần tiến tới. Mức độ thực hiện phải được công bố cùng độ phủ dữ liệu và loại bằng chứng; không diễn giải chữ “luôn” thành cam kết quan sát được mọi tương tác hoặc truy nguyên được toàn bộ doanh thu.

“Hành trình thương mại” trong phát biểu này là khái niệm kinh doanh. Nó chưa quyết định rằng phải có một thực thể dữ liệu riêng mang tên `Journey`.

## 4. Ba điều kiện bất biến

### 4.1. Quan sát không đầy đủ

Hệ thống chỉ nhìn thấy dữ liệu mà nguồn kết nối, quyền truy cập và cách vận hành cho phép. Một cuộc gọi không được ghi nhận hoặc một trao đổi trên kênh chưa kết nối có thể chứa thông tin quyết định nhưng vẫn nằm ngoài tầm quan sát.

Không có bằng chứng trong hệ thống không đồng nghĩa sự việc chưa xảy ra. Ngược lại, có tin nhắn nói một việc đã xảy ra không đồng nghĩa việc đó đã được xác minh.

### 4.2. Dữ kiện có nguồn gốc và mức độ đáng tin cậy khác nhau

Sự kiện hệ thống ghi nhận, lời khai của nhân viên, phát biểu của khách hàng và diễn giải của AI cần được phân biệt. Dữ liệu có thể sai, mâu thuẫn, đến muộn hoặc chỉ phản ánh một phần của sự việc.

Mọi kết luận có tác động vận hành cần truy được về nguồn, bằng chứng và thời điểm. Nhãn nguồn gốc không thay thế đánh giá chất lượng: một sự kiện quan sát được vẫn có thể bị nối sai khách hàng hoặc bị diễn giải sai.

### 4.3. Giá trị phải đến trước yêu cầu nhập liệu

Khi cần con người bổ sung điều hệ thống không nhìn thấy, thao tác đó phải mang lại lợi ích trực tiếp: nhớ lịch gọi lại, giữ lời hứa, tiếp tục công việc nhanh hoặc tránh hỏi lại khách.

Nếu nhân viên phải nhập dữ liệu chủ yếu để phục vụ báo cáo của người khác, việc duy trì dữ liệu trở thành một giả thuyết chưa được chứng minh. Giảm số thao tác và thời gian nhập là điều kiện cần; việc người dùng thực sự sử dụng vẫn phải đo riêng.

## 5. Tầng thứ nhất — Nỗi đau kinh doanh

| Vai trò | Nỗi đau | Hậu quả cần kiểm chứng |
|---|---|---|
| Khách hàng | Phải nhắc lại nhu cầu, nhận thông tin thiếu nhất quán, chờ lời hứa chưa được thực hiện | Mất thời gian, giảm tin tưởng, kéo dài quyết định |
| Nhân viên bán hàng | Nhận thông tin liên hệ nhưng thiếu ngữ cảnh; phải đọc lại và nhớ việc | Tăng thời gian chuẩn bị, bỏ sót việc, phản hồi thiếu phù hợp |
| Nhân viên tiếp thị | Bàn giao khách nhưng thiếu phản hồi có căn cứ về chất lượng và kết quả | Khó cải thiện nguồn khách và nội dung thu hút |
| Quản lý bán hàng | Thấy trạng thái nhưng thiếu bằng chứng và danh sách việc cần can thiệp | Phát hiện muộn khách bị bỏ quên, khó phân biệt nguyên nhân |
| Người trả tiền cho hệ thống | Có nhiều công cụ nhưng không nhìn được sự liên tục của quá trình | Chi phí vận hành tăng, đầu tư quảng cáo và nhân sự khó đánh giá |

### 5.1. Mất ngữ cảnh khi bàn giao

Quy trình thường chỉ chuyển tên, số điện thoại và vài ghi chú. Những thông tin làm nên mối quan hệ trước đó vẫn nằm trong hội thoại: sản phẩm quan tâm, nhu cầu, phản đối, tài liệu đã gửi, cam kết và lịch hẹn.

Vấn đề cần giải quyết là giúp người tiếp nhận tiếp tục được công việc đang diễn ra, với bằng chứng đủ để kiểm tra, thay vì phải tự dựng lại toàn bộ bối cảnh.

### 5.2. Bỏ sót hành động và trách nhiệm

“Chiều nay em gửi báo giá” tạo ra việc doanh nghiệp phải thực hiện. “Thứ Sáu gọi lại cho anh” là yêu cầu doanh nghiệp gọi lại, không phải cam kết khách sẽ gọi. Một yêu cầu mới chưa được trả lời có thể tạo ra trách nhiệm theo quy định phục vụ.

Khi các việc này chỉ nằm trong tin nhắn hoặc trí nhớ, tổ chức khó biết ai đang chịu trách nhiệm, hạn nào đã được thống nhất và việc đã hoàn thành đến mức nào.

### 5.3. Không nhìn được chất lượng nguồn khách

Số lượt nhấp, số hội thoại và chi phí trên khách tiềm năng không phản ánh đầy đủ nhu cầu, mức phù hợp, khả năng tiếp cận hay kết quả thương mại. Hai nguồn có cùng số khách tiềm năng có thể đem lại kết quả khác nhau.

Doanh nghiệp cần nối dữ liệu đầu quá trình với các kết quả được định nghĩa nhất quán. Nhu cầu này thuộc định hướng dài hạn; không đồng nghĩa phải triển khai đầy đủ truy nguyên doanh thu ngay trong MVP.

### 5.4. Không biết nơi cần can thiệp

Một báo cáo tổng hợp có thể cho biết tỷ lệ chuyển đổi giảm nhưng chưa cho biết khách nào chưa có người nhận, lời hứa nào sắp trễ, hoặc trạng thái nào mâu thuẫn với bằng chứng mới.

Giá trị quản trị cần kiểm chứng là biến dữ liệu thành danh sách trường hợp cụ thể cần hành động, có người xử lý và lý do rõ ràng. Số lượng cảnh báo tự nó không phải giá trị.

## 6. Tầng thứ hai — Nguyên nhân gốc

| Nguyên nhân | Biểu hiện | Điều cần phân biệt |
|---|---|---|
| Phân mảnh hệ thống | Hội thoại, công việc và kết quả nằm ở các nơi khác nhau | Nhiều công cụ có thể hợp lý; vấn đề là thiếu liên kết và trách nhiệm xuyên công cụ |
| Phân mảnh danh tính | Cùng người có nhiều mã kênh; nhiều người có thể dùng chung thông tin liên hệ | Mã kênh, người liên hệ và tổ chức không đồng nhất |
| Phân mảnh lần phát sinh nhu cầu | Khách quay lại, có nhiều nhu cầu hoặc nhiều người cùng tham gia một quyết định | Khách hàng không đồng nghĩa với một khách tiềm năng hay một cơ hội |
| Mất ý nghĩa thương mại | Tin nhắn lưu được nhưng việc phải làm và tác động lên quá trình không được cấu trúc | Nội dung gốc khác với diễn giải và quyết định nghiệp vụ |
| Khoảng trống quan sát | Trao đổi tiếp tục ngoài kênh được kết nối | Chưa thấy khác với chưa xảy ra |
| Khoảng trống trách nhiệm | Đã chuyển số điện thoại nhưng chưa có người nhận hoặc lịch hành động | Gửi bàn giao khác với nhận trách nhiệm |
| Định nghĩa không thống nhất | Mỗi bộ phận hiểu “đủ điều kiện”, “thành công”, “doanh thu” khác nhau | Chuẩn hóa theo doanh nghiệp, có phiên bản và thời điểm hiệu lực |

### 6.1. Cá nhân, tổ chức và vai trò

Với bán hàng cho tổ chức, người nhắn tin có thể là đầu mối, người đề xuất, người quyết định hoặc người phụ trách thanh toán. Những vai trò này có thể khác nhau giữa các cơ hội.

Cần kiểm chứng liệu mô hình `Customer` hiện có đã biểu diễn đủ người liên hệ, tổ chức và vai trò trong quyết định mua hay chưa. Việc tách `Contact`/`Organization` hoặc bổ sung quan hệ cần được đối chiếu với canonical (`DOMAIN_MODEL.md`, `IDENTITY_MODEL.md`, `GLOSSARY.md`) và phê duyệt riêng; không tạo khái niệm `Person` gộp cả hai khi chưa có quyết định.

### 6.2. Phân biệt hành trình với khách tiềm năng

Khách quay lại sau nhiều tháng không tự động chứng minh cần `Journey`; nhiều bản ghi `Lead` có thể đã biểu diễn được. Một khách có hai nhu cầu song song cũng cần được đối chiếu với năng lực thực tế của mô hình hiện có.

Phép thử là: có trường hợp nào mà dùng `Lead` và `Opportunity` hiện tại làm sai quan hệ, quy nguồn hoặc trách nhiệm ở mức đáng kể không? Nếu có thể giải bằng cấu hình hoặc quan hệ sẵn có, chưa cần thêm thực thể.

## 7. Tầng thứ ba — Vấn đề đo lường

### 7.1. Ba khái niệm nguồn khác nhau

| Khái niệm | Câu hỏi | Ví dụ |
|---|---|---|
| Nguồn thu hút | Hoạt động nào đưa khách đến trong lần phát sinh nhu cầu này? | Một quảng cáo cụ thể, tìm kiếm tự nhiên, giới thiệu |
| Kênh tương tác | Cuộc trao đổi đang diễn ra ở đâu? | Messenger, điện thoại, Zalo |
| Quy tắc ghi nhận kết quả | Doanh nghiệp phân bổ kết quả cho nguồn nào theo phương pháp nào? | Ghi nhận cho nguồn đầu tiên hoặc nguồn cuối cùng đủ điều kiện |

Chuyển sang Zalo không được tự động thay nguồn thu hút thành Zalo. Khách đến từ Meta cũng không đủ để xác định quảng cáo cụ thể nào.

### 7.2. Truy nguyên khác với tác động nhân quả

Nối được quảng cáo, khách và đơn hàng chứng minh một chuỗi liên kết theo bằng chứng và quy tắc. Nó chưa chứng minh rằng quảng cáo làm phát sinh đơn hàng đó, hoặc tắt quảng cáo sẽ làm mất đúng phần doanh thu được ghi nhận.

Đo tác động tăng thêm cần thiết kế kiểm chứng riêng. MVP không đưa ra kết luận nhân quả từ báo cáo quy nguồn.

### 7.3. Nguồn gốc gắn trên từng dữ kiện

| Giá trị | Ý nghĩa | Ví dụ |
|---|---|---|
| `observed` — quan sát được | Nguồn được kết nối ghi nhận trực tiếp sự kiện đang xét | Hệ thống ghi nhận gửi một tệp qua hội thoại |
| `declared` — được khai báo | Một người tuyên bố điều đã làm hoặc đã xảy ra | Nhân viên báo đã gửi hợp đồng qua Zalo |
| `inferred` — được suy luận | Kết luận được diễn giải từ bằng chứng khác | AI nhận định khách đang trì hoãn quyết định |

Mỗi dữ kiện cần có nguồn, tham chiếu bằng chứng, thời điểm xảy ra (`occurred_at`) và thời điểm ghi nhận (`recorded_at`). Khi thời điểm xảy ra không rõ, phải giữ trạng thái chưa rõ hoặc khoảng thời gian; không điền thời điểm ghi nhận để tạo độ chính xác giả.

Ví dụ, việc hệ thống nhìn thấy tin nhắn “em gửi rồi nhé” là quan sát được **tin nhắn**. Nội dung “hợp đồng đã được gửi” vẫn là một lời khai báo về **hành động gửi**. Hai điều này không được gộp thành một bằng chứng hoàn thành.

`Unobserved` không phải nguồn gốc của dữ kiện. Nó diễn tả thiếu bằng chứng cho điều cần biết.

### 7.4. Độ phủ quan sát có mẫu số xác định

Không dùng “số tương tác nhìn thấy / toàn bộ tương tác thật” khi không biết toàn bộ tương tác thật. Thay vào đó, đo phần thông tin bắt buộc mà từng giai đoạn cần để vận hành.

Ví dụ, một lần bàn giao cần sáu nhóm thông tin: nguồn thu hút, nhu cầu hiện tại, sản phẩm quan tâm, người tiếp nhận, tương tác gần nhất và hành động tiếp theo. Các trường bắt buộc, điều kiện áp dụng và loại bằng chứng chấp nhận được phải được khóa trước khi đo.

Một hồ sơ đạt 5/6 nhóm chỉ đạt độ phủ 5/6 theo danh sách đó. Điều này không có nghĩa hệ thống nhìn thấy 83% mọi tương tác của khách.

“Chưa rõ” là thông tin hữu ích để tránh kết luận sai nhưng không được tính như đã có bằng chứng. Trường không áp dụng chỉ được loại khỏi mẫu số theo quy tắc đặt trước, có lý do lưu lại.

### 7.5. Chất lượng liên kết và sự không chắc chắn

Phân biệt liên kết tất định, liên kết do con người khai báo, liên kết suy luận và chưa nối được. Một số điện thoại trùng không tự động chứng minh đúng người, đúng lần phát sinh nhu cầu hay đúng quảng cáo. Liên kết tất định cần xét phạm vi mã nguồn, thông tin dùng chung và từng đoạn của chuỗi.

Không hiển thị xác suất do mô hình tự báo khi chưa được hiệu chuẩn. Nguồn gốc bằng chứng và mức đủ bằng chứng là hai chiều riêng; không trộn “quan sát được” với “bằng chứng mạnh” thành một bảng phân loại duy nhất.

Nhãn chất lượng như đủ, một phần, mâu thuẫn hoặc chưa đủ phải có tiêu chí kiểm tra. Khách hàng ít giao dịch có thể sử dụng các nhãn này lâu dài mà không cần một xác suất số học.

### 7.6. Kết quả và giá trị sau giao dịch đầu tiên

Thắng cơ hội, tạo đơn, ghi danh, thu tiền, tái đăng ký, gia hạn và hoàn tiền là các kết quả khác nhau. Không dùng một trạng thái “thành công” để thay cho tất cả.

Định hướng dài hạn phải xét cả kết quả sau giao dịch đầu tiên. Khi báo cáo doanh thu, cần nêu loại doanh thu, thời điểm ghi nhận và cách xử lý hủy, hoàn, thu một phần hoặc gia hạn. Giá trị cơ hội ước tính không được trình bày như doanh thu thực thu.

Các kết quả vẫn thuộc mô-đun nghiệp vụ tương ứng. Cơ chế liên kết kết quả liên mô-đun chưa được quyết định ở đây. Các phương án tham chiếu trực tiếp, bản ghi liên kết hoặc tham chiếu bằng chứng cần được đánh giá về ownership, cardinality, sửa đổi và provenance trước khi phê duyệt triển khai.

## 8. Tầng thứ tư — Ràng buộc tổ chức

### 8.1. Người mua và người dùng có lợi ích khác nhau

Quản lý có thể mua để giảm khách bị bỏ quên. Nhân viên bán hàng sử dụng nếu hệ thống giúp nhận ngữ cảnh nhanh và giảm việc phải nhớ. Tiếp thị cần phản hồi về nguồn khách. Không giả định một lợi ích báo cáo của quản lý sẽ tự động tạo động lực nhập liệu cho bán hàng.

Thí điểm phải đo cả giá trị cho người mua và mức sử dụng của người làm việc hằng ngày. Không coi việc nhân viên đăng nhập theo yêu cầu là bằng chứng chấp nhận sản phẩm.

### 8.2. Chuẩn hóa định nghĩa và trách nhiệm

Doanh nghiệp cần thống nhất điều kiện đủ tiêu chuẩn, thời điểm giao và nhận trách nhiệm, thời hạn phục vụ, cách xác nhận hoàn thành và cách ghi nhận kết quả.

Quy định có thể khác giữa doanh nghiệp hoặc thay đổi theo thời gian. Báo cáo phải biết phiên bản quy tắc đã áp dụng. Dữ liệu đến muộn không được mặc định thành lỗi thực thi của nhân viên.

### 8.3. Tránh dùng khoảng trống dữ liệu để quy lỗi

Khi một tương tác chưa được ghi nhận, kết luận đầu tiên là thiếu khả năng quan sát. Chưa thể kết luận nhân viên không làm việc hoặc khách không giữ lời.

Ngoại lệ phải cho phép người phụ trách bổ sung bằng chứng, sửa diễn giải hoặc ghi đè có lý do. Đo thời gian xử lý và chất lượng dữ liệu cần đi cùng bối cảnh khối lượng công việc, giờ làm và phân công.

## 9. Tầng thứ năm — Yêu cầu sản phẩm rút ra từ bài toán

Đây là các yêu cầu về hành vi cần đạt, chưa phải danh sách bảng dữ liệu hoặc công nghệ phải triển khai.

### 9.1. Gói ngữ cảnh bàn giao có bằng chứng

Người tiếp nhận cần thấy nhu cầu hiện tại, sản phẩm quan tâm, phản đối quan trọng, tài liệu đã gửi, các bên liên quan đã biết, điều đang chờ và hành động tiếp theo. Mỗi thông tin quan trọng phải mở được bằng chứng hoặc được ghi rõ là khai báo, suy luận hay chưa rõ.

Gói bàn giao cần thể hiện độ mới và phạm vi dữ liệu. Bản tóm tắt không được làm mất nội dung gốc, biến lời khách dự kiến thành sự kiện đã xảy ra, hoặc tự nâng giai đoạn bán hàng.

### 9.2. Theo dõi việc cần làm theo hai trục

| Trục | Giá trị | Ý nghĩa |
|---|---|---|
| Bên chịu trách nhiệm | Nội bộ / bên ngoài | Doanh nghiệp thực hiện hay đang chờ phía khách hoặc một bên khác |
| Nguồn phát sinh | Cam kết hoặc yêu cầu rõ / chính sách hoặc SLA / ngầm hoặc suy luận | Vì sao việc này xuất hiện |

Nguồn phát sinh khác với nguồn gốc bằng chứng. Một trách nhiệm rõ có thể được nhập tay với provenance `declared`; một trách nhiệm theo SLA có thể được tạo từ sự kiện `observed`.

| Nội dung | Bên chịu trách nhiệm | Nguồn phát sinh | Cách xử lý |
|---|---|---|---|
| “Chiều nay em gửi báo giá” | Nội bộ | Cam kết rõ | Đề xuất việc gửi, người phụ trách và hạn tương ứng |
| “Thứ Sáu gọi lại cho anh” | Nội bộ | Yêu cầu rõ | Đề xuất lịch gọi lại; không gán khách là người phải gọi |
| Khách đặt câu hỏi chưa được trả lời | Nội bộ | Chính sách hoặc SLA đã cấu hình | Tạo việc theo quy định phục vụ, xét giờ làm và ngoại lệ |
| “Thứ Sáu anh trao đổi với sếp” | Bên ngoài | Cam kết rõ | Ghi kỳ vọng; khi chưa quan sát được kết quả thì đề xuất theo dõi |
| AI đề xuất hỏi lại ngân sách | Nội bộ | Suy luận | Đề xuất để người dùng chấp nhận; chưa phải nghĩa vụ đã giao |

### 9.3. Trạng thái thực hiện tách khỏi bằng chứng hoàn thành

Việc nội bộ có thể đang mở, đã hoàn thành, bị hủy; quá hạn chỉ được xác định khi có hạn hợp lệ và việc còn mở. Tình trạng bằng chứng hoàn thành được ghi riêng: quan sát được, khai báo, suy luận hoặc chưa có.

Một nhân viên được phép chủ động xác nhận đã làm việc, nhưng phải lưu là hoàn thành theo khai báo. AI nhìn thấy câu “em gửi rồi” chỉ đề xuất cập nhật hoặc ghi nhận lời khai; không tự đóng việc như đã xác minh.

Bằng chứng quan sát được cũng phải phù hợp với tiêu chí hoàn thành. Gửi tệp có thể đáp ứng việc “gửi báo giá”, nhưng không chứng minh khách đã đọc hay đồng ý. Nhầm tệp, nhầm người hoặc nhầm phiên bản không được tính là hoàn thành đúng.

Kỳ vọng phía khách được trình bày là đang chờ, đã quan sát được kết quả, đã được khai báo hoặc chưa quan sát được sau mốc dự kiến. Hết mốc không tự biến thành “khách thất bại nghĩa vụ”. Hệ thống có thể đề xuất một việc theo dõi nội bộ, có quy tắc tránh tạo việc trùng.

### 9.4. Ghi nhanh tương tác ngoài hệ thống

Sau cuộc gọi hoặc trao đổi ngoài kênh kết nối, người dùng cần chọn nhanh kết quả và hành động tiếp theo. Việc xác nhận một sự kiện đơn giản nên thực hiện được bằng một chạm; luồng có kết quả, lịch hẹn và người phụ trách có thể cần tối đa ba thao tác chính trong nguyên mẫu kiểm chứng.

Không hứa mọi thông tin phức tạp đều nhập được bằng một chạm. Thời gian nhập và tỷ lệ ghi nhận thực tế sẽ quyết định liệu cách này đủ bù khoảng trống quan sát hay không.

### 9.5. Trạng thái hiện tại cùng lịch sử bằng chứng

Giữ trạng thái hiện tại để vận hành và lịch sử bổ sung để giải thích vì sao trạng thái thay đổi. Phân biệt sự kiện khách hàng, hành động của người dùng, thay đổi nghiệp vụ và diễn giải của AI.

Sửa diễn giải cần giữ dấu vết sửa; không ghi đè nội dung gốc để biến suy luận thành sự thật. Nhật ký chỉ-thêm là nguyên tắc đối với cập nhật nghiệp vụ thông thường, không phải cam kết lưu dữ liệu cá nhân vĩnh viễn. Việc lưu, xóa và ẩn dữ liệu tuân theo chính sách được xác định riêng.

Không yêu cầu triển khai kiến trúc tái dựng toàn bộ trạng thái từ sự kiện. Lịch sử và bảng trạng thái hiện tại có thể cùng tồn tại.

### 9.6. AI đề xuất; hành động nghiệp vụ có thẩm quyền riêng

AI có thể trích thông tin, đề xuất việc, tìm mâu thuẫn và giải thích bằng chứng. AI không được tự coi suy luận là sự kiện đã xảy ra, tự ghép danh tính mơ hồ, tự xác nhận giao dịch thành công hoặc hoàn thành việc ngoài tầm quan sát.

Chuyển trạng thái cần đối chiếu điều kiện của doanh nghiệp. Cho phép ngoại lệ có lý do và dấu vết, vì quá trình bán hàng có thể quay lại hoặc chạy song song. Trong thí điểm đầu tiên, đề xuất từ AI được người dùng xác nhận trước khi có tác động nghiệp vụ.

### 9.7. Danh sách ngoại lệ có thể hành động

Các trường hợp ưu tiên gồm bàn giao chưa có người nhận, khách chưa có bước tiếp theo, việc nội bộ sắp đến hạn, yêu cầu chưa trả lời và trạng thái mâu thuẫn với bằng chứng mới.

Mỗi ngoại lệ cần có người phụ trách, bằng chứng, độ mới, lý do và hành động khả dụng. Cần đo cảnh báo sai, cảnh báo lặp và tỷ lệ người dùng thực sự xử lý; tránh biến thiếu dữ liệu thành một hàng đợi cảnh báo vô hạn.

## 10. Tầng thứ sáu — Ràng buộc bên ngoài

| Ràng buộc | Hệ quả đối với phạm vi và kiểm chứng |
|---|---|
| Khả năng truy cập API, webhook và dữ liệu lịch sử | Chỉ cam kết sau khi xác minh quyền và dữ liệu thực tế; kiểm tra cả dữ liệu đến muộn, thiếu và trùng |
| Chính sách nguồn dữ liệu | Mỗi kết nối phải được kiểm tra về phạm vi sử dụng và lưu trữ tại thời điểm thiết kế |
| Dữ liệu cá nhân và quyền truy cập | Xác định mục đích, quyền xử lý, phân quyền và chính sách lưu/xóa trước thí điểm |
| Nguồn dữ liệu thay đổi hoặc mất kết nối | Phải hiển thị phạm vi mất quan sát và độ mới; tránh tiếp tục báo cáo như dữ liệu đầy đủ |
| Khả năng thực thi của đội ngũ | Chọn một nguồn hội thoại và một quy trình khởi đầu; không triển khai đồng thời toàn bộ hệ sinh thái |

Tài liệu này không xác nhận API cụ thể hiện cung cấp dữ liệu nào, không đưa ra ngưỡng tối ưu quảng cáo của nền tảng và không kết luận việc xử lý dữ liệu đã đáp ứng pháp luật. Những nội dung đó cần kiểm tra tài liệu và yêu cầu hiện hành khi thiết kế kết nối. Dữ liệu đã băm cũng không được mặc định là đủ điều kiện để chuyển cho bên thứ ba.

## 11. Phân khúc và vai trò triển khai

### 11.1. Phân khúc khởi đầu

Ưu tiên doanh nghiệp đã vượt khả năng quản lý bằng hộp thư nhưng chưa triển khai hoặc chưa vận hành hiệu quả một hệ thống quản lý khách hàng đầy đủ. Họ đang dùng nhãn, ghi chú, phân công và bảng tính để thay cho trạng thái, hồ sơ và công việc.

Nhóm phù hợp để tuyển thí điểm cần có hoạt động bàn giao thật, việc theo dõi lặp lại, người bán hàng sẵn sàng thử và người mua có thể lượng hóa chi phí bỏ sót. Nhu cầu có thể là bán cho tổ chức hoặc quy trình cần nhiều lần tư vấn; mức độ tham gia của tổ chức và nhiều người liên hệ cần được đo trong mẫu.

### 11.2. MVP chỉ chọn vai trò A

| Vai trò | Mô tả | Quyết định hiện tại |
|---|---|---|
| A — Nền tảng vận hành nhẹ | Kết nối công cụ hội thoại, giữ ngữ cảnh, trách nhiệm và trạng thái vận hành cần thiết cho doanh nghiệp chưa có hệ thống đầy đủ | Phạm vi MVP |
| B — Đứng cạnh CRM hiện có | Cung cấp năng lực trên dữ liệu đồng bộ với hệ thống quản lý khách hàng khác | Giả thuyết mở rộng; ngoài MVP |

Hai vai trò dùng cùng định hướng sản phẩm, nhưng vai trò B có thêm đồng bộ hai chiều, ánh xạ dữ liệu, xử lý xung đột và quyền cập nhật. Không đưa những yêu cầu này vào giai đoạn đầu.

Giữ mã bên ngoài, hệ thống nguồn và thông tin nguồn có thẩm quyền ở nơi cần thiết để không tự khóa khả năng mở rộng. Điều đó không phải cam kết hỗ trợ đồng bộ hai chiều ngay từ MVP.

### 11.3. Nguồn có thẩm quyền cần rõ ngay trong vai trò A

Mỗi loại bản ghi hoặc trường được đồng bộ cần một nguồn có quyền quyết định cuối cùng trong phạm vi triển khai. Không mặc định nền tảng mới sở hữu toàn bộ dữ liệu.

| Dữ liệu | Đề xuất cho thí điểm | Điều cần khóa trước triển khai |
|---|---|---|
| Tin nhắn gốc và sự kiện gửi trên kênh | Công cụ hội thoại nguồn | Mã nguồn, quyền đọc, sửa/xóa và độ mới |
| Liên kết giữa các danh tính | Nền tảng, sau xác nhận theo quy tắc | Tiêu chí nối, tách lại và xử lý dùng chung thông tin |
| Trạng thái bán hàng và việc theo dõi | Nền tảng trong vai trò A | Quyền đổi trạng thái và cách xử lý nhãn tương ứng ở công cụ nguồn |
| Thông tin người liên hệ | Quyết định theo từng trường | Chiều cập nhật, thứ tự ưu tiên và xử lý mâu thuẫn |
| Đơn hàng, ghi danh, thu tiền | Mô-đun hoặc hệ thống thực sự ghi nhận kết quả | Không dùng trạng thái hội thoại thay bằng chứng nghiệp vụ |

Bảng này là mẫu phân công thẩm quyền, chưa phải cấu hình đã được xác nhận của bất kỳ khách hàng nào.

## 12. Phạm vi MVP và lối vào thị trường

### 12.1. Gói khởi đầu

**Bàn giao ngữ cảnh kết hợp theo dõi việc cần làm và cam kết.**

Gói này sử dụng cùng nguồn hội thoại để giúp nhân viên nhận khách nhanh hơn, giữ trách nhiệm và giảm bỏ sót. Giá trị cho người dùng là giảm đọc lại và nhớ việc; giá trị cho người mua là giảm khách bị bỏ quên. Cả hai vẫn là giả thuyết cần kiểm chứng.

Quy trình khởi đầu: kết nối hội thoại Pancake → chuẩn bị ngữ cảnh có bằng chứng → người phụ trách xác nhận bàn giao → người tiếp nhận nhận trách nhiệm → xác nhận việc và lịch theo dõi → ghi nhận thực hiện hoặc bổ sung thông tin ngoài hệ thống.

Pancake là nguồn triển khai đầu tiên, không phải ranh giới dài hạn của bài toán. Tầm nhìn vẫn bao gồm các nền tảng hội thoại khác và nguồn gốc như Meta, TikTok, Google; mỗi kết nối được đưa vào theo bằng chứng và nguồn lực.

### 12.2. Phần tối thiểu cần có để kiểm chứng

- Gói ngữ cảnh truy được về hội thoại, có thông tin chưa rõ và độ mới.
- Người giao, người nhận, thời điểm và trạng thái nhận trách nhiệm.
- Đề xuất việc có người phụ trách, hạn và bằng chứng; người dùng chấp nhận hoặc sửa.
- Nhắc việc và danh sách ngoại lệ cho quy trình đã chọn.
- Xác nhận thực hiện và ghi nhanh tương tác ngoài hệ thống, phân biệt loại bằng chứng.
- Đo mức sử dụng, thời gian tiết kiệm, độ phủ và lỗi; giữ lịch sử sửa.
- Liên kết danh tính đủ cho nguồn đầu tiên, có cơ chế xác nhận và tách khi sai.

### 12.3. Phần chưa thuộc MVP

- Thay thế toàn bộ CRM, bán hàng, kế toán hoặc phần mềm chuyên ngành.
- Đồng bộ hai chiều với CRM bên ngoài.
- Tự quan sát mọi cuộc gọi, mọi tài khoản Zalo hoặc mọi tương tác trực tiếp.
- Tự ghép danh tính thiếu bằng chứng hoặc tự động hóa hành động nghiệp vụ chỉ từ suy luận AI.
- Truy nguyên đầy đủ doanh thu đa kênh, kết luận nhân quả hoặc tối ưu ngân sách tự động.
- Gửi kết quả về nền tảng quảng cáo.
- Cơ sở dữ liệu đồ thị, khai phá quy trình hoặc kiến trúc sự kiện toàn phần chỉ để phục vụ giả thuyết chưa kiểm chứng.
- Toàn bộ vòng đời gia hạn, hoàn tiền và giá trị khách hàng dài hạn. Các kết quả này vẫn phải được bảo toàn trong định hướng liên kết dữ liệu về sau.

### 12.4. Rủi ro cạnh tranh và phạm vi

Tóm tắt AI có thể được công cụ hội thoại khác bổ sung. Lợi thế của gói khởi đầu phải được kiểm chứng ở khả năng tiếp tục công việc, giữ trách nhiệm, biết mức hoàn thành và xử lý ngoại lệ qua thời gian.

Không dùng lợi thế dài hạn về dữ liệu hay vòng quảng cáo để biện minh cho việc mở rộng MVP trước khi gói khởi đầu tạo giá trị đủ rõ.

## 13. Bộ chỉ số kiểm chứng North Star

Các chỉ số phải gắn với nhóm hồ sơ, khoảng thời gian, phiên bản quy tắc và mẫu số cụ thể. Báo cáo tỷ lệ cùng tử số, mẫu số và số trường hợp chưa đủ dữ liệu.

| Chỉ số | Định nghĩa vận hành | Cách đọc và giới hạn |
|---|---|---|
| Tính liên tục ngữ cảnh — Context Continuity Rate | Số lần bàn giao mà người nhận xác nhận đủ ngữ cảnh để tiếp tục, đồng thời đạt kiểm tra độc lập / tổng lần bàn giao thuộc phạm vi | Không chỉ đo đủ trường; tách nguyên nhân thiếu dữ liệu và diễn giải sai |
| Độ phủ ngữ cảnh bàn giao — Handoff Context Coverage | Số mục thông tin bắt buộc có bằng chứng đạt tiêu chí / số mục bắt buộc áp dụng | Báo cáo cả toàn bộ và riêng phần có bằng chứng quan sát được |
| Hoàn thành đúng hạn — Obligation Completion Rate | Số việc nội bộ đến hạn được hoàn thành đúng tiêu chí trước hạn / tổng việc nội bộ đến hạn, không bị hủy hợp lệ | Tách quan sát được và khai báo; chưa rõ vẫn nằm trong mẫu số và báo cáo riêng |
| Độ phủ quan sát theo giai đoạn — Observation Coverage | Số yêu cầu thông tin của giai đoạn có bằng chứng đạt tiêu chí / tổng yêu cầu áp dụng đã đặt trước | Đo khả năng vận hành theo danh sách; không đo toàn bộ tương tác thật |
| Độ phủ nối quảng cáo tất định — Deterministic Attribution Coverage | Số trường hợp có chuỗi liên kết tất định từ quảng cáo cụ thể đến lần nhu cầu và kết quả xác định / tổng trường hợp đến từ quảng cáo, có kết quả và nằm trong phạm vi đánh giá | Báo cáo riêng từng đoạn; không tính khớp người là khớp quảng cáo |
| Doanh thu chưa thể quy nguồn — Unknown Attribution Rate | Doanh thu thuộc phạm vi nhưng chưa được nối nguồn theo chính sách bằng chứng / tổng doanh thu thuộc phạm vi | Công bố loại doanh thu và phần chỉ được khai báo hoặc suy luận; chưa có dữ liệu tiền thì chưa tính |
| Khách phải nhắc lại — Customer Repetition Rate | Số lần bàn giao có yêu cầu nhắc lại thông tin quan trọng vốn đã được cung cấp / số lần bàn giao có tương tác tiếp nối được đánh giá | Tách hỏi để xác nhận hoặc làm rõ khỏi hỏi lại do mất ngữ cảnh; công bố số lần chưa quan sát được |

Đo bổ sung thời gian chuẩn bị bàn giao, tỷ lệ việc hữu ích, cảnh báo sai, thời gian ghi nhanh và mức sử dụng lặp lại. Độ phủ nối quảng cáo và doanh thu là chỉ số chiến lược; thiếu dữ liệu cho chúng không tự động làm gói MVP thất bại.

Đối với việc hoàn thành đến muộn, ghi cả thời điểm thực hiện và thời điểm hệ thống biết được. Báo cáo phải công bố ngày chốt dữ liệu và cập nhật lại khi nhận bằng chứng muộn, tránh tính độ trễ nhập liệu thành độ trễ thực hiện.

## 14. Ví dụ xuyên suốt

Khách nhắn: **“Giá này được, gửi hợp đồng cho anh xem. Thứ Sáu anh trao đổi lại với sếp.”**

| Nội dung | Ghi nhận có căn cứ | Điều chưa được kết luận |
|---|---|---|
| “Giá này được” | Phát biểu của khách về mức giá; AI có thể đề xuất diễn giải | Chưa chứng minh phê duyệt mua hay giao dịch thắng |
| “Gửi hợp đồng cho anh xem” | Yêu cầu rõ, tạo đề xuất việc nội bộ | Chưa chứng minh hợp đồng đã gửi; chưa có hạn chính xác nếu chưa thống nhất |
| “Thứ Sáu anh trao đổi lại với sếp” | Kỳ vọng một sự kiện phía khách, với thời gian cần phân giải theo ngữ cảnh và múi giờ | Chưa chứng minh đã trao đổi hay sếp là người quyết định cuối cùng |
| “Sếp” | Có thêm bên liên quan được nhắc đến | Chưa đủ để tạo một người liên hệ có danh tính xác định |

Người nhận bàn giao thấy yêu cầu gửi hợp đồng, mốc dự kiến phía khách và các thông tin chưa rõ. Khi nhân viên gửi đúng hợp đồng qua kênh được kết nối, hệ thống có thể dùng sự kiện phù hợp làm bằng chứng cho việc gửi. Nếu nhân viên chỉ báo “đã gửi qua Zalo”, ghi nhận hoàn thành theo khai báo sau xác nhận của người dùng.

Sau mốc thứ Sáu, nếu chưa có thông tin mới, hệ thống đề xuất theo dõi. Không kết luận khách chưa trao đổi nội bộ. Việc tiếp tục cũng không tự làm cơ hội chuyển sang “thành công”.

## 15. Giả thuyết còn mở và quan hệ với mô hình hiện có

| Giả thuyết | Bằng chứng cần có | Hướng quyết định |
|---|---|---|
| `Journey` cần tồn tại riêng | Trường hợp mô hình Lead/Opportunity hiện có không biểu diễn được mà gây sai quy nguồn, trách nhiệm hoặc kết quả | Chỉ nâng thành thực thể khi có hậu quả đáng kể; nếu chưa đủ, giữ nguyên mô hình |
| Cần nhóm người tham gia mua và vai trò theo lần nhu cầu | Nhiều người của một tổ chức tham gia cùng quyết định; vai trò ảnh hưởng bàn giao và hành động | Đưa kết quả vào quyết định danh tính tổ chức và liên kết vai trò |
| Kết quả liên mô-đun cần cơ chế truy nguyên chung | Một nhu cầu nối đến nhiều kết quả hoặc kết quả thuộc mô-đun khác | Đối chiếu quyết định liên kết nguồn gốc nghiệp vụ liên mô-đun; không thêm `Outcome` tùy tiện |
| Theo dõi việc có giá trị ngoài nhắc lịch | Việc xuất hiện đủ thường xuyên, phát hiện được, biết mức hoàn thành và có hậu quả khi bỏ sót | Xác nhận hoặc thu hẹp gói khởi đầu |
| Ghi nhanh đủ bù phần ngoài hệ thống | Nhân viên sử dụng lặp lại, nhập nhanh và ghi đủ nội dung quan trọng | Nếu không đạt, chọn quy trình quan sát tốt hơn hoặc đổi cách thu thập |
| Chuỗi kết quả về quảng cáo đem lại giá trị | Định nghĩa ổn định, đủ dữ liệu, đủ sự kiện và phù hợp điều kiện xử lý | Chỉ nghiên cứu mở rộng khi vượt điều kiện riêng |

Hai decision đã được nhắc trong thảo luận là `CROSS_MODULE_BUSINESS_PROVENANCE_MODEL` và `ORGANIZATION_IDENTITY_AND_DEDUP_MODEL`. Tài liệu này dùng chúng làm đích đối chiếu, không xác nhận nội dung hay trạng thái hiện tại vì bộ hồ sơ mô hình chính thức không nằm trong hai tệp nguồn.

Không tạo một Domain Model v0 song song. Lược đồ thử nghiệm ở phần sau chỉ dùng để thu bằng chứng và đưa kết quả về các quyết định chính thức.

## 16. Kế hoạch kiểm chứng trên 50–100 hồ sơ thực

### 16.1. Mục tiêu và đơn vị mẫu

Mục tiêu là xác định gói khởi đầu có giải một vấn đề đủ phổ biến, đủ quan sát được và đủ giá trị hay không; đồng thời kiểm tra những khái niệm nào thực sự cần trong mô hình.

Đơn vị đánh giá là **một hồ sơ của một lần phát sinh nhu cầu thương mại**, không phải một tin nhắn và cũng không mặc định là một thực thể Journey. Hồ sơ có thể chứa nhiều hội thoại, hoạt động được khai báo, bàn giao và kết quả. Nhãn thử nghiệm không trở thành mã nghiệp vụ sản xuất.

Đề xuất bắt đầu với **80 hồ sơ từ 3–5 doanh nghiệp phù hợp**, trong biên 50–100 tùy dữ liệu được phép sử dụng. Có thể cần đọc nhiều hơn 100 luồng hội thoại để dựng đủ hồ sơ có lịch sử. Một giai đoạn dữ liệu quá ngắn không đủ kiểm tra khách quay lại sau nhiều tháng.

### 16.2. Lấy mẫu và giảm sai lệch

1. Xác định doanh nghiệp, khoảng thời gian, quy trình và tiêu chí “đang hoạt động thương mại” trước khi chọn hồ sơ.
2. Chọn mẫu ngẫu nhiên hoặc phân tầng theo quy tắc đặt trước trong tập đủ điều kiện; giữ cả hồ sơ ít tín hiệu, bị mất dữ liệu và chưa có kết quả.
3. Phân tầng theo bàn giao, kết quả và mức hoạt động ngoài hệ thống khi thông tin đó có sẵn. Nếu lấy tỷ lệ khác phân bố thật, báo cáo theo tầng hoặc trọng số; không lấy trung bình mẫu làm tỷ lệ thị trường.
4. Dùng một tập bổ sung có chủ đích cho trường hợp hiếm: nhiều nhu cầu, nhiều người, số điện thoại dùng chung, mâu thuẫn, đổi lịch. Tập này dùng kiểm tra khả năng biểu diễn và lỗi, không dùng tính mức phổ biến.
5. Chia hồ sơ cùng người hoặc tổ chức vào cùng một nhóm phát triển hoặc đánh giá, để tránh rò rỉ giữa hai tập.

Mẫu vài doanh nghiệp là kiểm chứng trong phân khúc đã chọn, chưa đại diện toàn bộ SME. Không tổng hợp để che việc một doanh nghiệp không đạt điều kiện.

### 16.3. Hai vòng kiểm chứng

**Vòng 1 — Đánh giá hồi cứu:** dùng dữ liệu lịch sử để đo mức phổ biến, chất lượng trích xuất, phần quan sát được, liên kết quảng cáo và khả năng biểu diễn bằng mô hình hiện có.

**Vòng 2 — Thí điểm vận hành:** dùng nguyên mẫu với người dùng thật trong khoảng 2–4 tuần đề xuất để đo thời gian, ghi nhanh, mức sử dụng, hoàn thành việc và giá trị cho người mua. Chọn thời lượng dài hơn nếu chu kỳ bán hàng hoặc số lượt bàn giao không đủ.

Hồi cứu không chứng minh được mức sử dụng tương lai, mức giảm bỏ sót hay khả năng trả tiền. Tương quan việc trễ với kết quả xấu chỉ là tín hiệu để thiết kế thí điểm, không phải bằng chứng việc trễ gây mất doanh thu.

### 16.4. Gán nhãn và tập đánh giá khóa

Với 80 hồ sơ, đề xuất dùng khoảng 20 hồ sơ phát triển hướng dẫn và nguyên mẫu, khoảng 60 hồ sơ đánh giá khóa. Nếu tổng mẫu thay đổi, giữ khoảng 20–25% cho phát triển; phân nhóm trước khi chạy mô hình.

Hai người gán nhãn độc lập các mục cốt lõi trong tập đánh giá: ngữ cảnh bàn giao, việc cần làm, bên chịu trách nhiệm, hạn, bằng chứng hoàn thành và liên kết nguồn. Đối chiếu khác biệt theo hướng dẫn chung; ghi lại trường hợp không thể kết luận.

Nhãn chuẩn chỉ xác nhận điều bằng chứng cho phép. Không coi lời nhập tay là sự thật đã quan sát và không điền kết quả chưa có. Phỏng vấn nhân viên có thể bổ sung lời khai nhưng vẫn mang nguồn gốc khai báo.

Chỉ cho AI xem dữ liệu đã có tại thời điểm cần đưa ra quyết định. Ví dụ, đánh giá gói bàn giao không cho mô hình xem tin nhắn hay kết quả đến sau bàn giao. Đánh giá hoàn thành cũng dùng đúng thời điểm bằng chứng trở nên khả dụng.

Khóa phiên bản mô hình, hướng dẫn, quy tắc và ngưỡng trước khi chạy tập đánh giá. Nếu sửa theo lỗi của tập này, vòng tiếp theo cần tập chưa dùng. Bất đồng nhãn lớn phải được xử lý trước khi coi điểm AI có ý nghĩa.

## 17. Lược đồ kiểm chứng dùng một lần — Validation Schema

Lược đồ phục vụ gán nhãn và so sánh, không phải mô hình nghiệp vụ thứ hai. Nó có thể tồn tại trong bảng tính hoặc tệp dữ liệu và phải bỏ được mà ứng dụng không phụ thuộc.

| Nhóm thông tin | Trường thử nghiệm điển hình | Mục đích |
|---|---|---|
| Mẫu | Mã hồ sơ ẩn danh, doanh nghiệp, tầng mẫu, nhóm phát triển/đánh giá | Kiểm soát mẫu và rò rỉ |
| Bằng chứng | Mã nguồn, tham chiếu, provenance, thời điểm xảy ra/ghi nhận, độ chính xác thời gian | Kiểm tra nguồn và độ mới |
| Ngữ cảnh | Thông tin bắt buộc, nhãn chuẩn, kết quả AI, lỗi hoặc thiếu dữ liệu | Đánh giá bàn giao |
| Việc và kỳ vọng | Bên chịu trách nhiệm, nguồn phát sinh, hành động, hạn, mức quan trọng, bằng chứng hoàn thành | Đánh giá phát hiện và theo dõi |
| Danh tính và quan hệ | Tham chiếu Contact/Organization/Lead/Opportunity hiện có, trường hợp không biểu diễn được | Kiểm tra giả thuyết mô hình |
| Nguồn và kết quả | Bằng chứng từng đoạn liên kết, loại kết quả, giá trị có chứng từ hoặc chưa rõ | Kiểm tra truy nguyên và hậu quả |
| Giá trị sử dụng | Thời gian, sửa tay, cảnh báo hữu ích, ghi nhanh, mức dùng, phản hồi người mua | Đánh giá kinh tế và chấp nhận |
| Quyết định | Mã giả thuyết, decision liên quan, kết quả, hạn chế, bước tiếp theo | Đưa bằng chứng về hồ sơ chính thức |

Mỗi nhóm trường phải gắn với giả thuyết và có ánh xạ sang khái niệm chính thức khi đã có. Không cho mã hồ sơ thử nghiệm hoặc nhãn giả thuyết trở thành phụ thuộc của ứng dụng sản xuất. Sau kiểm chứng, lưu báo cáo và bằng chứng được phép giữ; xóa hoặc lưu giới hạn dữ liệu thử theo chính sách đã thống nhất.

## 18. Ngưỡng quyết định đặt trước

### 18.1. Nguyên tắc

Mỗi giả thuyết phải xét mức phổ biến, khả năng phát hiện hoặc quan sát và hậu quả kinh doanh. Điểm chính xác cao không đủ nếu thông tin hữu ích hiếm; thông tin phổ biến cũng không đủ để tạo một thực thể mới nếu không làm sai công việc hay đo lường.

Các con số dưới đây là đề xuất cho vòng đầu. Nhóm sản phẩm cần khóa chúng trước khi đọc kết quả. Mọi thay đổi sau đó phải được ghi lại và chỉ áp dụng cho vòng mới.

| Mã | Giả thuyết và phép đo | Ngưỡng đề xuất | Quyết định khi không đạt |
|---|---|---|---|
| H1 | Mất ngữ cảnh bàn giao là vấn đề đủ thường xuyên và có ích khi giải | ≥30% lần bàn giao đánh giá được thiếu ít nhất một thông tin trọng yếu; thí điểm giảm ≥30% trung vị thời gian chuẩn bị/tiếp nhận, chất lượng ngữ cảnh không giảm | Thu hẹp nhóm khách hoặc quy trình; nếu chỉ thiếu ít thông tin nhưng không gây hậu quả, chưa coi là giá trị cốt lõi |
| H2 | Việc cần làm có giá trị xuất hiện đủ nhiều | ≥30% hồ sơ thương mại có ít nhất một việc nội bộ cụ thể mà người vận hành xác nhận hữu ích để theo dõi | Xem lại quy trình và gói giá trị; không dùng số việc AI sinh ra thay nhu cầu thật |
| H3 | AI trích việc đủ chính xác để hỗ trợ | Precision ≥95%, recall ≥80% trên tập khóa; ≥90% việc khớp đúng bên chịu trách nhiệm và hành động; ≥90% hạn khớp trong nhóm có hạn xác định được | Giữ cơ chế đề xuất, giảm loại việc hỗ trợ hoặc sửa nguyên mẫu rồi kiểm tra bằng tập mới |
| H4 | Có thể biết mức thực hiện mà không nhập quá nhiều | ≥70% việc quan trọng đến hạn có bằng chứng hoàn thành, chưa hoàn thành theo xác nhận, hoặc hủy hợp lệ; phần hoàn thành theo khai báo báo cáo riêng. Luồng ghi nhanh có trung vị ≤20 giây và được dùng cho ≥80% tương tác ngoài hệ thống thuộc diện cần ghi được kiểm tra | Không khẳng định đã giải theo dõi việc từ đầu đến cuối; chọn quy trình có độ phủ tốt hơn hoặc đổi cách ghi |
| H5 | Gói tạo giá trị vận hành và kinh tế | Thí điểm giảm ≥25% tương đối tỷ lệ việc nội bộ quá hạn/chưa có kết luận sau hạn so với đối chứng phù hợp, không tăng hủy việc để né hạn; ≥2/3 người mua được kiểm chứng chấp nhận thí điểm trả phí ở mức giá đặt trước | Chưa đủ bằng chứng thương mại; xem lại giá trị, mức giá hoặc phân khúc |
| H6 | `Journey` có khác biệt cần thiết với Lead/Opportunity | Trường hợp không biểu diễn được bằng mô hình hiện có và có hậu quả xuất hiện ở ≥10% mẫu đại diện, hoặc gắn với ≥20% doanh thu đã xác minh của mẫu; đồng thời chỉ ra bất biến khác và không có cách đơn giản hơn | Giữ Journey là khái niệm phân tích; nếu hiếm nhưng hậu quả lớn, kiểm tra thêm thay vì bác ngay |
| H7 | Vai trò nhiều người trong tổ chức cần được biểu diễn theo nhu cầu | ≥15% hồ sơ có nhiều người tham gia cùng quyết định và việc thiếu vai trò gây sai bàn giao hoặc bước tiếp theo | Giữ Contact/Organization hiện có; chưa thêm cấu trúc vai trò mới chỉ để làm đầy mô hình |
| H8 | Đủ cơ sở nghiên cứu vòng kết quả về quảng cáo | ≥70% hồ sơ quảng cáo có kết quả đánh giá được nối tất định toàn chuỗi; định nghĩa kết quả ổn định; đồng thời đạt các điều kiện riêng tại mục 19 | Hoãn vòng quảng cáo; không dùng đây làm điều kiện bắt buộc để gói bàn giao/việc thành công |

Đối với H3, cần ít nhất 40 việc chuẩn và ít nhất 40 dự đoán trên tập khóa để báo cáo ngưỡng precision/recall như tín hiệu sàng lọc. Nhóm hạn có mẫu nhỏ phải báo riêng là chưa đủ. Ngay cả đạt ngưỡng trên mẫu nhỏ cũng chưa đủ cho tự động hóa không giám sát.

H4 có hai phần khác nhau: bằng chứng về **trạng thái thực hiện** và độ phủ ghi nhận **tương tác ngoài hệ thống**. Mẫu số phần ngoài hệ thống cần nhật ký kiểm tra hoặc đối chiếu độc lập; nếu chỉ đếm những tương tác người dùng đã nhập thì không thể đo tỷ lệ họ bỏ quên. Nơi không kiểm tra được phải ghi chưa đủ dữ liệu, không coi là đạt.

Precision = dự đoán việc đúng / tổng dự đoán việc. Recall = việc đúng được phát hiện / tổng việc chuẩn. Khớp việc cần xét nội dung hành động và bên chịu trách nhiệm, không chỉ khớp từ khóa. Hạn mơ hồ được đánh giá riêng; việc không đủ ngữ cảnh thời gian không được ép thành một ngày chính xác.

H5 cần nhóm so sánh đồng thời hoặc thiết kế trước–sau giữ quy tắc, khối lượng và cơ cấu công việc tương đương ở mức có thể. Báo cáo cả số tuyệt đối và tỷ lệ; khi số việc hoặc thời gian theo dõi quá ít, kết luận chưa đủ dữ liệu. Phản hồi “quan tâm” không thay cho chấp nhận mức giá hoặc trả phí. Nếu chưa có ba người mua được kiểm chứng thì chưa kết luận theo ngưỡng 2/3.

H6 không được dùng giá trị cơ hội suy đoán để thay doanh thu. Loại bỏ đếm trùng khi một kết quả nối nhiều hồ sơ. Nếu thiếu dữ liệu tiền, chỉ đánh giá tần suất và hậu quả công việc; chưa phán nhánh ngưỡng doanh thu. Muốn mở rộng thành cấu trúc lõi dùng chung, cần đối chiếu thêm ở ít nhất hai doanh nghiệp; một trường hợp đặc thù có thể chỉ cần cấu hình riêng.

### 18.2. Ba trạng thái kết luận

- **Đạt để đi tiếp:** số liệu vượt ngưỡng, mẫu và bằng chứng đủ cho quyết định hạn chế được nêu; không mặc định đã được chứng minh ở toàn thị trường.
- **Không đạt:** có đủ dữ liệu và kết quả dưới ngưỡng; thu hẹp, đổi hoặc dừng giả thuyết tương ứng.
- **Chưa đủ dữ liệu:** mẫu nhỏ, bằng chứng thiếu, nhãn bất đồng hoặc khoảng bất định vượt qua cả hai phía ngưỡng; thu thêm dữ liệu, không biến thành đạt hoặc không đạt.

Báo cáo khoảng bất định cho tỷ lệ khi phù hợp, cùng sự phụ thuộc giữa các hồ sơ cùng doanh nghiệp. Không coi 100 hồ sơ là 100 quan sát độc lập của toàn thị trường. Các trường hợp hậu quả lớn được phân tích riêng ngay cả khi không làm đổi tỷ lệ tổng.

## 19. Điều kiện mở rộng vòng phản hồi về quảng cáo

Vòng phản hồi kết quả về nền tảng quảng cáo là giả thuyết mở rộng, không phải giai đoạn được bật theo lịch cố định.

Chỉ bắt đầu thiết kế tích hợp cụ thể khi đồng thời có:

1. **Định nghĩa ổn định:** “đủ điều kiện”, “ghi danh”, “thắng cơ hội” hoặc kết quả được chọn có tiêu chí thống nhất và phiên bản rõ.
2. **Bằng chứng nối phù hợp:** đo được từng đoạn nguồn quảng cáo → lần nhu cầu → kết quả; tránh lấy khớp thông tin liên hệ làm bằng chứng cho toàn chuỗi.
3. **Lượng sự kiện phù hợp:** kiểm tra yêu cầu hiện hành của từng nền tảng và mục tiêu tối ưu. Nếu giao dịch cuối quá thưa, đánh giá sự kiện giữa quá trình thay vì tự động chọn doanh thu.
4. **Điều kiện xử lý dữ liệu được xác nhận:** mục đích, cơ sở xử lý, sự đồng ý khi cần, quyền chuyển dữ liệu và chính sách nền tảng được kiểm tra.
5. **Kiểm soát chất lượng:** chống gửi trùng, xử lý đến muộn, sửa/hủy kết quả và giám sát lỗi theo khả năng nền tảng.

Ngưỡng 70% ở H8 là ngưỡng sàng lọc nội bộ đề xuất, không phải yêu cầu của Meta, TikTok hay Google. Vượt ngưỡng đó chưa đủ để triển khai hoặc chứng minh hiệu quả tối ưu quảng cáo.

## 20. Sản phẩm đầu ra của vòng kiểm chứng

| Đầu ra | Nội dung bắt buộc |
|---|---|
| Báo cáo mẫu và chất lượng bằng chứng | Phân bố, thiếu dữ liệu, cách lấy mẫu, số quan sát đủ điều kiện, giới hạn và bất đồng nhãn |
| Báo cáo chất lượng AI | Precision/recall, lỗi hành động/bên chịu trách nhiệm/hạn, mức sửa tay, ví dụ sai và chưa rõ |
| Báo cáo giá trị vận hành | Thời gian, ghi nhanh, cảnh báo, hoàn thành việc, khách phải nhắc lại, mức sử dụng lặp lại |
| Báo cáo giá trị thương mại | Mức giá đã thử, phản hồi có ràng buộc của người mua, chi phí vận hành và trường hợp có hậu quả được xác minh |
| Hồ sơ quyết định | Mỗi H1–H8 có kết quả, dữ liệu, giới hạn và quyết định đi tiếp/thu hẹp/thu thêm |
| Đầu vào mô hình chính thức | Các trường hợp Lead chưa đủ, vai trò tổ chức và liên kết kết quả liên mô-đun; ánh xạ tới decision liên quan |

Sau vòng này mới viết đặc tả sản phẩm chi tiết cho phạm vi có bằng chứng. Kết quả có thể giữ nguyên gói khởi đầu, thu hẹp vào một quy trình quan sát tốt, hoặc thay đổi lối vào nếu phần lớn việc quan trọng vẫn không thể ghi nhận và người dùng không thấy lợi ích đủ lớn.

## 21. Những quyết định hiện tại cần được giữ nhất quán

1. Giữ định nghĩa cốt lõi và North Star của bản gốc.
2. MVP chỉ triển khai vai trò A; nguồn có thẩm quyền vẫn cần xác định theo dữ liệu và trường.
3. Gói khởi đầu là bàn giao ngữ cảnh kết hợp theo dõi việc cần làm, không triển khai đồng thời vòng quảng cáo.
4. Provenance thuộc về dữ kiện; độ phủ quan sát thuộc về hồ sơ hoặc giai đoạn với mẫu số đã xác định.
5. Trạng thái nghiệp vụ, lịch sử bằng chứng và diễn giải AI cùng tồn tại nhưng không thay thế nhau.
6. Lời khai hoàn thành không được tự biến thành hoàn thành đã xác minh; thiếu quan sát không được tự biến thành thất bại.
7. `Journey` vẫn là giả thuyết. Chỉ thêm khái niệm khi thiếu nó gây sai lệch có hậu quả và giải pháp đơn giản hơn không đủ.
8. Lược đồ kiểm chứng có thể bỏ đi; kết quả phải trở về mô hình và hồ sơ quyết định chính thức.
9. Giá trị cho người dùng, khả năng quan sát và khả năng trả tiền phải được kiểm chứng cùng chất lượng AI.

## 22. Nguồn và giới hạn của phiên bản

- **`Dinh_nghia_bai_toan.docx`:** nguồn trực tiếp cho bối cảnh, các vấn đề ban đầu, định nghĩa tổng hợp và North Star được trích nguyên văn ở mục 3.
- **`Pasted text.txt`:** nguồn phản biện về phân tầng vấn đề, độ phủ quan sát, người mua/người dùng, truy nguyên/nhân quả, lịch sử, phạm vi và kiểm chứng.
- **Các kết luận thảo luận tiếp theo:** cơ sở cho vai trò A, gói khởi đầu, hai trục việc cần làm, Journey là giả thuyết, Validation Schema và các điều kiện mở rộng.

Bản DOCX có dẫn tới `NORTH_STAR.md`; phiên bản này kế thừa North Star như đã được ghi trong DOCX, chưa đối chiếu trực tiếp tệp `NORTH_STAR.md`. Bộ mô hình chính thức, tài liệu API và quy định pháp lý hiện hành cũng chưa được cung cấp hoặc xác minh trong công việc biên soạn này. Các ngưỡng kiểm chứng được đề xuất mới và phải được khóa trước khi đánh giá dữ liệu.
