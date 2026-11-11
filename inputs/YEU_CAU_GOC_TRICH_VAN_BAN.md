# Văn bản trích từ Word yêu cầu gốc

Nguồn inputs/01_YEU_CAU_GOC.docx. Bản trích để AI đọc văn bản; Word gốc vẫn giữ để đối chiếu. Không đổi nội dung.

Tôi muốn tạo một ứng dụng chạy trên thiết bị di động với các thông tin cấu trúc, tính năng,  cơ chế hoạt động như sau.

Logic hoạt động:

Người dùng bấm vào ngày cần luyện tập trên màn hình của tuần đó -> chuyển đến trang ngày tương ứng -> Người dùng xác nhận đã hoàn thành bằng việc bấm vào nút có biểu tượng huy chương -> chuyển đến trang huy chương của ngày tương ứng -> hiện nút chuyển đến ngày tiếp theo của tuần đang luyện tập

Cách đặt tên file tương ứng với ngày dựa trên số thứ tự tuần và số thứ tự ngày

Tuần 1 có tên fille là Tuan1 - trong file này có 7 ngày tương ứng với ngày 1 đến ngày 7

Tuần 2 có tên fille là Tuan2 - trong file này có 7 ngày tương ứng với ngày 8 đến ngày 14

Tuần 3 có tên fille là Tuan3 - trong file này có 7 ngày tương ứng với ngày 15 đến ngày 21

Tuần 4 có tên fille là Tuan4 - trong file này có 7 ngày tương ứng với ngày 22 đến ngày 28

Tính năng:

Đăng nhập ứng dụng

Tính năng theo dõi tiến trình luyện tập và người dùng xác nhận đã xem và thực hiện ngày đó bằng việc bấm vào nút huy chương (góc dưới bên trái) trang màn hình ngày luyện tập -> chuyển đến trang có hình huy chương với tên file tương ứng thứ tự ngày là HC d1 đến HC d28

Bấm nút bóng đèn (góc dưới bên phải) tại trang màn hình ngày luyện tập để chuyển đến trang thông tin chi tiết nôi dung của ngày đó. Dữ liệu nhận diện là ví dụ file “day25” là trang chính của ngày 25 thì file “in4 d25” là trang thông tin chi tiết nội dung của ngày 25

Bấm vào nút ngày với số thứ tự ngày tiếp theo sẽ chuyển đến trang luyện tập ngày tiếp theo

Tính menu sidebar có các thành phần:

Xem Flashcard: sử dụng dữ liệu file hình ảnh “full flashcard.png”

BOT AI: chuyển đến Bot AI đã huấn luyện https://chatgpt.com/g/g-68ebb31724f88191953cf12f08d5d819-brightupgenz

Báo Chí: sử dụng dữ liệu file hình ảnh “Baochi.png”. Mỗi vị trí hình trong file hình ảnh sẽ chuyển đến link bài báo tương ứng khi bấm vào, ví dụ:

Hình ở vị trí dòng 1 cột 1 sẽ chuyển đến https://rajournals.in/index.php/rajar/article/view/1797

Hình ở vị trí dòng 1 cột 2 sẽ chuyển đến https://scholar.google.com/citations?view_op=view_citation&hl=en&user=izj-rw0AAAAJ&sortby=pubdate&citation_for_view=izj-rw0AAAAJ:8IsQavbT1M8C

Hình ở vị trí dòng 2 cột 1 sẽ chuyển đến https://zenodo.org/records/17556640

Hình ở vị trí dòng 2 cột 2 sẽ chuyển đến https://www.linkedin.com/posts/ra-journal-of-applied-research-5a3889111_appliedresearch-publichealth-educationinnovation-activity-7392822625502232576-d78z?utm_source=share&utm_medium=member_desktop&rcm=ACoAABwSeAsB3mvh-Z8jbarMjTyjaWuanddphNk

Hình ở vị trí dòng 3 cột 1 sẽ chuyển đến https://journals.indexcopernicus.com/search/article?articleId=4676161

Hình ở vị trí dòng 3 cột 2 sẽ chuyển đến https://baodanang.vn/de-y-tuong-khoi-nghiep-tu-cuoc-thi-buoc-vao-thuc-te-3346332.html

Đội Ngũ: sử dụng dữ liệu file hình ảnh “team.png” cho trang chính. Mỗi vị trí hình trong file hình ảnh sẽ chuyển đến profile cá nhân tương ứng khi bấm vào, ví dụ:

Hình ở vị trí dòng 1 cột 1 sẽ chuyển đến trang có tên file hình ảnh “Quan CV.png”. Khi bấm vào nút liên hệ thì sẽ chuyển đến trang có tên file hình ảnh “in4 Quan.png”

Hình ở vị trí dòng 1 cột 2 sẽ chuyển đến  trang có tên file hình ảnh “Chip CV.png” . Khi bấm vào nút liên hệ thì sẽ chuyển đến trang có tên file hình ảnh “in4 chip.png”

Hình ở vị trí dòng 2 cột 1 sẽ chuyển đến  trang có tên file hình ảnh “in4 Leade.png” 

Hình ở vị trí dòng 2 cột 2 sẽ chuyển đến  trang có tên file hình ảnh “in4 Thúy.png” 

Chứng Nhận Chuyên Môn: Sử dụng dữ liệu hình ảnh, hiển thị theo chế độ slide, bấm next để xem tiếp, có nút pause để dừng lại

Bệnh viện Phục hồi chức năng Việt Pháp file sử dụng Bệnh viện Phục hồi chức năng Việt Pháp.png https://drive.google.com/file/d/1hXL4h0SM_BUhJ5t61L2mZkkl66uu8ZbQ/view?usp=drive_link

Trung tâm Y tế khu vực Hải Châu file sử dụng Trung tâm Y tế khu vực Hải Châu.png https://drive.google.com/file/d/1GL4C5LHZ4jXTbv15hizFklxkteJD2A_q/view?usp=drive_link

Trung tâm Y tế khu vực Sơn Trà file sử dụng Trung tâm Y tế khu vực Sơn Trà.png https://drive.google.com/file/d/1Lmwgji1YiG80gpY5rl4ZoewUifsT4Ohp/view?usp=drive_link

Trung tâm Y tế khu vực Thanh Khê file sử dụng Trung tâm Y tế khu vực Thanh Khê.png https://drive.google.com/file/d/13YHMKD4Lxj2cKtbhOXwuzvzLb4jRZ1sX/view?usp=drive_link

Cộng Đồng: Tại mục này sẽ chuyển đến trang Facebook Page https://www.facebook.com/profile.php?id=61591629700255

Nội dung sản phẩm tham chiếu theo file https://docs.google.com/document/d/1u_QcKfS4_pAX27Q1pE6X5CbBvn5ENTLj/edit

Tài nguyên hình ảnh sử dụng để tạo ứng dụng theo thư mục lưu trữ sau:

https://drive.google.com/drive/folders/17jX1J0xhyvYG5lfKrTMu6fdViTQsg9M6

Giao diện

Tuân thủ theo mẫu thiết kế mà tôi đã làm theo các hình ảnh tài liệu trong thư mục hình ảnh https://drive.google.com/drive/folders/17jX1J0xhyvYG5lfKrTMu6fdViTQsg9M6

Thiết kế Trang homepage, sử dụng background từ file bg.png” và có logo của ứng dụng theo file “logo1.png”

Yêu cầu có chức năng đăng nhập bằng Google Login

Tạo trang quản trị cho Admin để quản trị thông tin người dùng và quản trị các chức năng của ứng dụng. Email mặc định là Admin duy nhất là minhquantran4312@gmail.com

## Đích hyperlink đọc từ file gốc

- mailto:minhquantran4312@gmail.com
- https://journals.indexcopernicus.com/search/article?articleId=4676161
- https://www.linkedin.com/posts/ra-journal-of-applied-research-5a3889111_appliedresearch-publichealth-educationinnovation-activity-7392822625502232576-d78z?utm_source=share&utm_medium=member_desktop&rcm=ACoAABwSeAsB3mvh-Z8jbarMjTyjaWuanddphNk
- https://drive.google.com/file/d/1hXL4h0SM_BUhJ5t61L2mZkkl66uu8ZbQ/view?usp=drive_link
- https://baodanang.vn/de-y-tuong-khoi-nghiep-tu-cuoc-thi-buoc-vao-thuc-te-3346332.html
- https://zenodo.org/records/17556640
- https://drive.google.com/file/d/1Lmwgji1YiG80gpY5rl4ZoewUifsT4Ohp/view?usp=drive_link
- https://drive.google.com/file/d/1GL4C5LHZ4jXTbv15hizFklxkteJD2A_q/view?usp=drive_link
- https://docs.google.com/document/d/1u_QcKfS4_pAX27Q1pE6X5CbBvn5ENTLj/edit
- https://drive.google.com/file/d/13YHMKD4Lxj2cKtbhOXwuzvzLb4jRZ1sX/view?usp=drive_link
- https://drive.google.com/drive/folders/17jX1J0xhyvYG5lfKrTMu6fdViTQsg9M6
- https://chatgpt.com/g/g-68ebb31724f88191953cf12f08d5d819-brightupgenz
- https://rajournals.in/index.php/rajar/article/view/1797
- https://scholar.google.com/citations?view_op=view_citation&hl=en&user=izj-rw0AAAAJ&sortby=pubdate&citation_for_view=izj-rw0AAAAJ:8IsQavbT1M8C
