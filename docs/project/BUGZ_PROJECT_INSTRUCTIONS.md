# Instruction dự án BUGZ BrightUpGenZ

Phiên bản 1.1 · Ngày 01/11/2026 · Tài liệu quy tắc để AI đọc trước mỗi chặng lập trình

## Cách áp dụng

Đọc và áp dụng file này cùng `BUGZ_ARTIFACT_TRIEN_KHAI_5_NGAY.md`. File Instruction giữ các nguyên tắc xuyên suốt; Artifact mô tả chi tiết sản phẩm; prompt chặng chỉ định công việc cần thực hiện ngay. Việc đính kèm một file không tự biến nó thành System Instruction của nền tảng. Hãy lưu bản có thể đọc trong `docs/project/` của mã nguồn và đọc lại trước khi sửa mã. Không tuyên bố đã đọc những file thực tế không truy cập được.

Khi chủ dự án yêu cầu thay đổi, ghi quyết định và tác động vào tài liệu quyết định dự án, không âm thầm thay công nghệ hoặc nội dung. Phân biệt các quy tắc trong file này với những thiết lập System instructions của giao diện AI Studio nếu có; quy trình không phụ thuộc vào việc giao diện có ô thiết lập đó hay không.

## 1 Sản phẩm và phạm vi

- Webapp/PWA dùng trên desktop, tablet, điện thoại. Ba module: Học và thực hành 28 ngày, Robot đồng hành, Trò chơi rèn luyện.
- Người dùng: SuperAdmin, Phụ huynh, Học sinh. Admin quản lý đủ phạm vi của Artifact. Không tự thêm vai trò giáo viên, marketplace hoặc multiplayer vào đường găng.
- Dùng React và TypeScript theo mã đã tạo. Không đổi framework hoặc tạo lại dự án ở mỗi chặng.
- Mốc kế hoạch trong Artifact là triển khai 01–05/11/2026 và nộp 06/11/2026. Không dùng hạn gấp để bỏ phân quyền hoặc giả tích hợp.

## 2 Firebase và phân quyền

- Database là **Firebase Realtime Database**. Không tự tạo Firestore thay thế khi AI Studio đề xuất tích hợp Firebase tự động.
- Giữ bốn đường dẫn gốc: `users/{uid}`, `devices/{device_id}`, `sessions/{device_id}/{session_id}`, `alerts/{device_id}/{session_id}/{alert_id}`.
- Mở rộng có lý do theo Artifact. `devices.user_id` vẫn là UID phụ huynh sở hữu; học sinh có `student_id` riêng. Một phiên Robot gắn với một học sinh đã được xác minh.
- `firebase_schema_contract.json` là hợp đồng dữ liệu, không phải Security Rules hoặc bản dump để Import JSON vào root database.
- Google Login dùng Firebase Authentication. Email bootstrap SuperAdmin theo nguồn là `minhquantran4312@gmail.com`; backend xác minh danh tính, email và UID trước cấp quyền. Không cấp Admin bằng điều kiện email phía trình duyệt.
- Rules mặc định từ chối. Backend dùng Admin SDK phải kiểm tra token, vai trò, quan hệ phụ huynh–con và dữ liệu đầu vào. Không chỉ ẩn menu để phân quyền.
- Không cho client tự ghi quyền, owner thiết bị, kết quả Robot, bộ đếm hoặc điểm do server chấm.

## 3 Nội dung và tài nguyên

- Giữ đúng tài liệu, ảnh, trình tự bốn tuần và 28 ngày. Nút bóng đèn mở đúng giải thích; huy chương đúng ngày; ngày 28 đi đến yêu cầu chứng nhận, không có ngày 29.
- Không tự viết nội dung thay phần nguồn chưa có hoặc chưa đọc được. Bảng mapping có đủ 28 mục không chứng minh đã nhập đủ toàn bộ nội dung của 28 ngày.
- `source_manifest.json` là danh mục nguồn, không chứa toàn bộ bytes ảnh. `content_days_manifest.json` là mapping và trạng thái kiểm tra, không phải giáo trình đã OCR đầy đủ.
- Giữ mapping các menu Flashcard, BOT AI, Báo chí, Đội ngũ, Chứng nhận chuyên môn, Cộng đồng, Hỗ trợ theo nguồn. Bấm liên kết phải tới đúng bản ghi hoặc bài, không đưa về trang tổng tùy tiện.
- Ảnh hoạt hình mới chỉ dùng cho lớp câu hỏi và dẫn chuyện; không thay logo hoặc ảnh chuyên môn gốc. Không coi giấy chứng nhận flashcard là chứng nhận Robot hoặc Webapp mới.
- Câu hỏi mới giữ nguồn, phiên bản và trạng thái duyệt. Các nội dung sức khỏe cần rà soát đã được đánh dấu trong Artifact; không thêm lời hứa chữa cận, chữa gù hoặc chứng nhận hiệu quả chưa đo.

## 4 Robot MQTT và lịch sử

- Robot gửi MQTT qua broker có TLS và ACL từng thiết bị; bridge xác thực danh tính và phiên trước khi ghi Firebase. Không nối trực tiếp MQTT vào RTDB bằng một khả năng không tồn tại.
- Chốt một adapter khả thi: broker webhook HTTPS + publish API, hoặc Node bridge trên môi trường duy trì được connection. Không chạy subscriber vô hạn trong HTTP Cloud Function.
- Một nơi duy nhất quyết định đợt: firmware hoặc bridge. Không để cả hai cùng cộng bộ đếm.
- `monitoring_enabled` là yêu cầu; `monitoring_active` là Robot ACK. Không báo đang giám sát trước ACK.
- Giữ bốn trạng thái `good`, `bad`, `absent`, `unknown`. Di chuyển, mất người, mất chuẩn hoặc thiếu độ tin cậy không tự biến thành tư thế sai.
- `good_count`, `bad_count` đếm đợt ổn định, không đếm khung hình. Số cảnh báo có thể lớn hơn số đợt sai. Chống trùng QoS1 theo ID sự kiện ổn định và xử lý crash/retry.
- Không tự suy khoảng cách cm hoặc tên tư thế cụ thể từ kết quả Robot chỉ có good/bad. Ngưỡng giây trong Artifact là cấu hình kỹ thuật thử nghiệm.
- Simulator dùng cùng đường MQTT và có nhãn `source=simulator`. Không ghi trực tiếp DB rồi gọi là đã thử MQTT hoặc Robot thật.
- Ảnh đi qua HTTPS tới Cloud Storage; MQTT gửi metadata/capture_id. Không lưu base64 ảnh trong RTDB. Kiểm tra quyền khi xem ảnh.
- Lọc lịch sử theo học sinh và phạm vi thời gian, UTC trong dữ liệu và múi giờ Việt Nam khi hiển thị. Không suy tỷ lệ thời gian ngồi đúng từ số đợt nếu chưa đo duration.

## 5 Thông báo và trò chơi

- Định tuyến từ thiết bị đã xác thực → phiên → student_id phía server → người nhận đã liên kết → thiết lập kênh. Không tin email hoặc student_id do payload tự khai.
- Push dùng FCM theo quyền và khả năng thiết bị. Voice chỉ cam kết khi trang đang hoạt động và âm thanh được phép; có nút nghe lại. Email dùng provider/SMTP phía server đã cấu hình.
- Không coi ghi DB, provider accepted, delivered và người dùng đã đọc là một trạng thái. Dedupe cảnh báo giữa listener và push.
- Đối chiếu API với phiên bản Firebase SDK thực tế đã cài. Không trộn hai cơ chế đăng ký Messaging khác phiên bản; nếu cần điều chỉnh cách gọi API, ghi rõ thay đổi và giữ hợp đồng người nhận/cảnh báo.
- Lời nhắc nhẹ nhàng, hóm hỉnh, động tác rõ và không chê hình thể. Không gọi Robot là công cụ chẩn đoán.
- Trò chơi dùng ngân hàng đã duyệt. 40 câu seed chia 20 Lưng thẳng và 20 Mắt sáng. Chấm theo server, không cộng điểm lặp.
- Ảnh `bugz_learning_atlas.png` có bốn cảnh cùng cặp nhân vật nam–nữ; mỗi câu dùng ô tương ứng theo manifest. Không dùng ảnh AI làm thước đo tư thế hoặc khoảng cách.
- Tách tiến độ tự thực hành, điểm game và quan sát Robot. Game đạt điểm cao không chứng minh sức khỏe được cải thiện.

## 6 Cách làm việc trong AI Studio

- Một project xuyên suốt. Master Prompt thực hiện vai trò P00 đúng một lần; tiếp theo P01, P02, P03, P04, P05, P06. Không chạy Master rồi chạy P00 lần nữa.
- Trước chặng, xác định file nền và file mới đã thực sự đọc được. File thiếu phải được liệt kê cụ thể; phần mã không phụ thuộc file thiếu vẫn tiếp tục làm.
- Đính kèm chat là nạp ngữ cảnh; tài nguyên runtime phải được nhập/copy thực sự vào mã nguồn hoặc Storage và có manifest tham chiếu đúng. Không dùng URL phiên chat hoặc giả định file đính kèm tự có mặt khi deploy.
- Viết mã và hoàn tất phạm vi chặng. Không chỉ trả kế hoạch khi prompt yêu cầu triển khai.
- Sau mỗi chặng cập nhật `docs/project/PROJECT_STATE.md` và `docs/project/INTEGRATION_STATUS.md`: file đổi, kết quả thử, cấu hình còn chờ, chặng tiếp theo. Hai file trạng thái do AI tạo khi lập trình, không phải bằng chứng tích hợp đã chạy sẵn trong gói tài liệu.
- Lưu commit nếu GitHub đã kết nối hoặc xuất ZIP checkpoint. Khi sửa lỗi, sửa vùng liên quan, không dựng lại toàn bộ app.

## 7 Secrets kiểm thử và deploy

- Không yêu cầu dán private key, service account JSON, mật khẩu SMTP hoặc credential broker vào chat. Dùng Secrets/biến môi trường server của môi trường chạy thực tế. Không dùng biến client công khai để chứa secret.
- Firebase web config và VAPID public key có thể là cấu hình client; không dùng chúng thay Rules. Secret của môi trường preview không được coi là đã tự chuyển sang Firebase Functions khi deploy.
- Người có quyền thực hiện các bước Console/billing/credential; AI chỉ nhận là hoàn tất khi có kết quả xác minh. Không giả đã tạo tài nguyên bên ngoài.
- Bản nộp theo Artifact: frontend trên Firebase Hosting, backend Functions và bridge theo phương án đã chốt. Nút Deploy của AI Studio tới Cloud Run không tự đồng nghĩa với Firebase Hosting hoặc đã deploy Rules/Functions.
- Cần build/typecheck và các ca kiểm thử phù hợp. Kết quả phân biệt PASS, FAIL, BLOCKED, NOT_RUN. `ARTIFACT_CHECKS.json` chỉ mô tả kiểm tra gói tài liệu trước đó, không chứng minh app đã chạy.
- Chỉ kết luận tích hợp thật sau khi thử đúng Firebase project, broker, thiết bị, email provider và quyền tài khoản. Tài liệu mẫu và fixture không phải bằng chứng đo mô hình.
