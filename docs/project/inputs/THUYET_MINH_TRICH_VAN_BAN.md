# Bản trích văn bản thuyết minh dự án

Nguồn https://docs.google.com/document/d/1u_QcKfS4_pAX27Q1pE6X5CbBvn5ENTLj/edit · Đọc ngày 01/11/2026. Chỉ gồm văn bản, không gồm ảnh nhúng. Các số liệu và khẳng định trong bản trích là nội dung nguồn do dự án cung cấp, chưa được thẩm định độc lập. Không dùng làm dữ liệu hiện tại của dashboard.

CUỘC THI SÁNG TẠO
DÀNH CHO THANH THIẾU NIÊN, NHI ĐỒNG
TOÀN QUỐC NĂM 2026
---------------------------
PHẦN MỀM:
CẢI THIỆN TƯ THẾ NGỒI HỌC VÀ BẢO VỆ THỊ LỰC
THUYẾT MINH PHẦN MỀM
Nhóm học sinh:
Trần Minh Quân – Đỗ Quỳnh Anh
Đà Nẵng, Tháng 7 năm 2026
MỤC LỤC
I. GIỚI THIỆU SẢN PHẨM......................................................................................... 2
II. CÁC CHỨC NĂNG CỦA CHƯƠNG TRÌNH....................................................... 4
III. ĐÁNH GIÁ HIỆU QUẢ THỰC TẾ CỦA SẢN PHẨM..................................... 21
IV. CÁC NGUỒN THAM KHẢO............................................................................... 22
V. CÁC CHƯƠNG TRÌNH HỖ TRỢ XÂY DỰNG PHẦN MỀM.......................... 22
VI. ĐỊNH HƯỚNG TƯƠNG LAI............................................................................... 22
VII. LỜI CẢM ƠN........................................................................................................ 23
GIỚI THIỆU PHẦN MỀM
“CẢI THIỆN TƯ THẾ NGỒI HỌC VÀ BẢO VỆ THỊ LỰC”
I. GIỚI THIỆU SẢN PHẨM
     1. Ý tưởng của sản phẩm
Theo nghiên cứu của Bộ Y tế, năm 2023, có khoảng 35%–40% học sinh bị tật khúc xạ từ nhẹ đến trung bình. Qua khảo sát thực tế, chúng em nhận thấy nhiều bạn học sinh có thói quen ngồi sai tư thế, cúi quá thấp khi học hoặc sử dụng các thiết bị điện tử trong thời gian dài. Những thói quen này có thể gây ảnh hưởng đến mắt và cột sống, làm tăng nguy cơ cận thị và gù lưng. Tuy nhiên, hiện nay vẫn chưa có nhiều công cụ trực quan, sinh động giúp học sinh dễ dàng nhận biết tư thế ngồi đúng, đồng thời hình thành và duy trì thói quen tốt trong học tập hằng ngày.
Ban đầu, chúng em đã tạo ra một phiên bản Flashcard vật lí như thế này:
Hình 1. Flashcard bản vật lí
Nhận thấy rằng bản vật lí này sẽ tốn chi phí làm ra và người mua cũng sẽ tốn tiền. Vì thế, chúng em chưa đăng bán online, chỉ có thể bán cho những người ở độ tuổi học sinh cần nó và ở gần. Từ khi được tiếp xúc với Pygame (thư viện mã nguồn mở của ngôn ngữ lập trình Python), chúng em đã nảy ra ý tưởng tạo nên một chương trình giúp các bạn ở độ tuổi học sinh cải thiện tư thế ngồi và bảo vệ được thị lực một cách trực quan, sinh động để các bạn có thể tự rèn luyện được thói quen tốt này.
Trải qua rất nhiều ngày miệt mài tự học, tìm tòi và thất bại không ít lần. Cuối cùng, nhóm chúng em đã cho ra đời phiên bản hoàn chỉnh đầu tiên của phần mềm “CẢI THIỆN TƯ THẾ NGỒI HỌC VÀ BẢO VỆ THỊ LỰC”
Nhóm chúng em hi vọng rằng, phần mềm nhỏ bé này sẽ trở thành người bạn đồng hành đáng tin cậy cho các bạn học sinh trên hành trình cải thiện tư thế ngồi và bảo vệ thị lực – đồng thời cũng giúp phụ huynh yên tâm hơn khi thấy con mình ngồi đúng tư thế, mắt khỏe giúp con tăng hiệu quả học tập, cơ thể khỏe mạnh và tương lai bền vững để bước tiếp con đường trong tương lai.
     2. Giới thiệu tổng quan về phần mềm
Đây là phần mềm giúp cải thiện tư thế ngồi và bảo vệ được thị lực mà nhóm chúng em đã dành rất nhiều thời gian, công sức và tâm huyết để xây dựng – với mong muốn là các bạn thay đổi được tư thế ngồi, bảo vệ được thị lực nhưng không phải với những dòng chữ khô khan, khó nhớ, mà trở thành một hành trình gồm 28 ngày chia thành 4 tuần, mỗi tuần chia thành 7 ngày, mỗi ngày tích lũy được một kinh nghiệm trên những chiếc Flashcard đầy màu sắc, niềm vui và sự say mê cho các bạn học sinh. Phần mềm “CẢI THIỆN TƯ THẾ NGỒI HỌC VÀ BẢO VỆ THỊ LỰC” không chỉ giúp các bạn nắm vững được tư thế ngồi, thị lực,… mà còn hướng dẫn từng bước một cách sinh động qua những Flashcard đầy màu sắc: từ các bước chi tiết về tư thế lưng, khoảng cách tầm nhìn, đến những mẹo giúp thư giãn cơ cho lưng và mắt giúp thoải mái.
Ngoài ra, trong mỗi Flashcard, chúng em còn tích hợp một biểu tượng để người dùng có thể bấm vào khi chưa hiểu rõ nội dung được trình bày. Khi đó, phần mềm sẽ cung cấp lời giải thích chi tiết và đầy đủ hơn, được các bác sĩ có chuyên môn tại Bệnh viện 199 tư vấn. Sau khi hoàn thành đầy đủ các bài tập trong một ngày, người dùng có thể bấm vàođể nhận được một huy chương thành tích. Huy chương này có thể được chụp lại để lưu giữ làm kỷ niệm. Điều này giúp tạo cảm giác vui vẻ và tự hào khi đạt được thành tựu, đồng thời khuyến khích người dùng duy trì thói quen thực hiện đầy đủ các bài tập mỗi ngày, từ đó góp phần cải thiện tư thế và bảo vệ thị lực.
Ý nghĩa đặc biệt của phần mềm này là:
Giúp các bạn học sinh có thể xem ở bất cứ đâu, bất cứ lúc nào chỉ với một chiếc điện thoại.
Tạo hứng thú, khiến các bạn ham học hỏi các phương pháp trên Flashcard nhờ hình ảnh minh họa sống động.
Và quan trọng nhất, chúng em mong rằng phần mềm này sẽ gieo vào lòng các bạn học sinh một niềm tin rằng: “Ngồi đúng tư thế, chăm sóc đôi mắt – khỏe mạnh mỗi ngày!”.
II. CÁC CHỨC NĂNG CỦA CHƯƠNG TRÌNH
	A. Màn hình chính của phần mềm
	Khi chạy chương trình, giao diện chính của phần mềm sẽ hiện ra như sau:
 
Hình 2. Giao diện màn hình chính
Phần mềm bao gồm những nội dung chính như sau:
4 tuần: Tuần 1 (Ngày 1 – 7)
        Tuần 2 (Ngày 8 – 14)
        Tuần 3 (Ngày 15 – 21)
        Tuần 4 (Ngày 22 – 28)
Mục lục: BOT AI
 Tin tức
 Đội ngũ
 Chứng nhận chuyên môn
 Cộng đồng
 Hỗ trợ người dùng
	B. Chi tiết và hướng dẫn cách sử dụng từng chức năng
	Để làm quen với phần mềm, sau đây xin mời thầy cô và các bạn làm theo chỉ dẫn chi tiết ở bên dưới.
Hình 2. Giao diện màn hình chính
Với các mục này của chúng em sẽ giúp các bạn học sinh dễ dàng thực hiện và ghi nhớ bởi các kiến thức y sinh học đường khô khan được chuyển hóa thành những hình ảnh minh họa sinh động, dễ nhớ, tạo cảm giác hứng thú khi sử dụng.
Sau đây, chúng em xin trình bày chi tiết từng nội dung của phần mềm “Cải thiện tự thế ngồi học và bảo vệ thị lực”.
1. Khi bấm vào các Tuần 
Ví dụ Tuần 1
- Khi bấm vào biểu tượng phần mềm sẽ chuyển đến cửa sổ giao diện mới như Hình 3
Hình 3. Tuần 1
	* Ở “Tuần 1” sẽ có 7 ngày:
	+ Ngày 1
	+ Ngày 2
	+ Ngày 3
	+ Ngày 4
	+ Ngày 5
	+ Ngày 6
	+ Ngày 7
	Sau đây, chúng em sẽ trình bày cụ thể, chi tiết từng phần của “Tuần 1” như sau:
	Ví dụ khi vào Ngày 1
	- Khi bấm vào biểu tượng phần mềm sẽ chuyến đến trang thực hiện hành động đó: 
Hình 4. Ngày 1
	Ngoài ra, còn có 2 biểu tượng nhỏ là      và     :
+ Biểu tượng bóng đèn: Khi bấm vào biểu tượng này, người dùng sẽ xem được lời tư vấn chi tiết từ các chuyên gia tại Bệnh viện 199. Nếu chưa hiểu rõ một hành động, các bạn học sinh có thể bấm vào để xem thêm thông tin.
	+ Biểu tượng huy chương: Sau khi hoàn thành tất cả các bước trong ngày, người dùng có thể bấm vào biểu tượng này để nhận huy chương tương ứng. Huy chương có thể được lưu lại hoặc chia sẻ với mọi người, giúp người dùng cảm thấy vui vẻ, tự hào vì đã đạt được một thành tựu và có thêm động lực để tiếp tục duy trì thói quen tốt mỗi ngày.
	        Hình 5. Lời tư vấn chi tiết		      Hình 6. Nhận huy chương sau khi hoàn thành
	- Khi bấm vào thì giao diện sẽ chuyển sang ngày tiếp theo một cách nhanh chóng, không cần phải Back ra giao diện Tuần rồi chọn ngày tiếp theo.
- Đối với các ngày tiếp theo từ ngày 1 đến ngày 27 đều sẽ có phần chi tiết lời tư vấn, huy chương tương tự như vậy.
- Nhưng với ngày 28 chúng ta sẽ có một điều bất ngờ:
Hình 7. Ngày 28
- Khi này chúng ta sẽ thấy một nút màu xanh lá thay vì là nút tiếp những ngày tiếp theo.
- Khi bấm vào, chúng ta sẽ bị nhảy qua một trang email ở trạng thái gửi
- Khi bấm gửi, hệ thống mail sẽ nhận được thông báo và nhóm chúng em sẽ tiến hành làm chứng chỉ chúc mừng sau khi người dùng hoàn thành 28 ngày.

Hình 8. Mẫu chứng chỉ
	2. Phần mục lục
Hình 9. Giao diện mục lục
	- Khi bấm vào ở Giao diện màn hình chính, giao diện sẽ hiện sang giao diện mục lục như Hình 9
	* Ở “Mục lục” sẽ có các mục như:
	+ Xem Flashcard
	+ BOT AI
	+ Tin tức
	+ Đội ngũ
	+ Chứng nhận chuyên môn
	+ Cộng đồng
	+ Hỗ trợ
	2.1 Xem flashcard
Hình 10. Xem Flashcard
- Ngoài ra còn có thể bấm vào ở giao diện màn hình chính để có thể xem.
- Đây là mục toàn bộ 28 Flashcard người dùng chỉ cần một chạm và lướt để tìm ra Flashcard mình cần mà không phải tìm từng tuần.
	2.2 BOT AI

Hình 11. BOT AI
- Khi bấm vào mục “BOT AI” thì sẽ được dịch chuyển sang ChatGPT bởi con BOT này nhóm em tạo bằng ChatGPT, nhóm em đã nộp các bài báo cáo, những kiến thức liên quan đến y sinh học đường vào trước khi tạo ra con BOT. Vì vậy BOT sẽ trả lời đúng trọng tâm vấn đề mà người dùng thắc mắc.
	2.3 Tin tức
- Khi bấm vào mục “Tin tức” thì giao diện sẽ chuyển sang một giao diện mới, hiển thị nhiều trang tin tức để các bạn học sinh có thể đọc thêm, những tin tức này có thể chứng minh được sự hiệu quả của Flashcard. Ngoài ra, còn có thể lan tỏa rộng ra nhiều nơi hơn để nhiều người có thể biết đến.
Hình 12. Giao diện tin tức
	- Ở giao diện tin tức, hiện tại nhóm em đã được 5 trang tin tức đăng bài, giao diện sẽ có 5 mục, và các bạn khi dùng và muốn đọc thì có thể bấm vào thì giao diện sẽ chuyển sang trình duyệt WEB như hình.
Hình 13. ZENODO
	- Giả sử, em bấm vào mục Zenodo, giao diện được đổi sang WEB và truy cập thẳng vào Trang Zenodo và mọi người sẽ đọc thông tin ở đây.
	2.4 Đội ngũ
Hình 14. Giao diện đội ngũ
	- Khi bấm vào “Đội ngũ” giao diện sẽ được đổi sang giao diện đội ngũ có các thành viên của dự án.
	- Sau đó, nếu cần biết về thành viên nào, chỉ cần bấm vào người đó. Giả sử ở đây nhóm em bấm vào bạn Trần Minh Quân.
Hình 15. Giao diện thông tin về thành viên
	- Lúc này, các bạn đã vào được phần thông tin thành viên, nếu muốn liên hệ để hỏi đáp về ứng dụng hoặc những vấn đề liên quan đến dự án thì có thể bấm và giao diện sẽ chuyển đến trang có phương thức liên hệ để các bạn biết.
Hình 16. Phương thức liên hệ
	- Như ở đây, muốn liên hệ với bạn Trần Minh Quân chúng ta có thể liên hệ qua Zalo và Email hoặc có thể gọi điện trực tiếp để có thể giải đáp điều mà người dùng cần muốn biết.
	2.5 Chứng nhận chuyên môn
	- Khi bấm vào mục “Chứng nhận chuyên môn”, giao diện sẽ chuyển sang Google Drive nơi lưu trữ những chứng nhận chuyên môn của nhóm em được các trung tâm Y tế đánh giá về Flashcard vào giáo trình 28 ngày. 
Hình 17. Chứng nhận chuyên môn
	- Hiện tại nhóm chúng em đag có 4 chứng nhận chuyên môn của 4 trung tâm Y tế trong khu vực Thành Phố Đà Nẵng như:
Hình 18. Chứng nhận chuyên môn của Trung tâm Y tế khu vực Thanh Khê
Hình 19. Chứng nhận chuyên môn của phòng khám Phục hồi chức năng Việt Pháp
Hình 20. Chứng nhận chuyên môn của Trung tâm Y tế khu vực Sơn Trà
Hình 21. Chứng nhận chuyên môn của Trung tâm Y tế khu vực Hải Châu
III. ĐÁNH GIÁ HIỆU QUẢ THỰC TẾ CỦA SẢN PHẨM
	Đây là biểu đồ cho thấy các bạn sau 28 ngày sử dụng sản phẩm. Với Ngày 1, thì có 59,3% bạn trong 852 bạn học sinh ở tất cả các Trường học thuộc Thành Phố Đà Nẵng đang thực hiện ngối đúng tư thế, và sau chỉ 1 tuần, thì tỉ lệ đã tăng lên một cách rõ rệt, cho thấy sự hiểu quả của sản phảm với 85% bạn thay đổi được tư thế, và các tuần sau luôn duy trì phong độ ở mức tỉ lệ cao
=> Flashcard và giáo trình của nhóm em ngoài tạo ra sự hứng thú khi thức hiện mà còn giúp các bạn thay đổi, và chúng em tin rằng sản phẩm này sẽ có ích với những bạn đang cảm thấy tư thế của mình chưa được tốt.
Đây không chỉ là biểu đồ tổng quan sau 28 ngày, mà còn là các biểu đồ của các bài đánh giá nhanh trước khi dùng và sau khi dùng trong mỗi tuần để biết mức độ cải thiện của các bạn. 
Biểu đồ gạch vàng là thể hiện tỉ lệ các bạn ngồi đúng tư thế trước khi sử dụng còn biểu đồ xanh là thể hiện tỉ lệ các bạn ngồi đúng tư thế sau khi sử dụng. Có thể thấy sau khi sử dụng thì tỉ lệ tăng lên hẳn, nên có thể khẳng định được sự hiệu quả của Flashcard và giáo trình cải thiện tư thế ngồi học và bảo vệ thị lực của nhóm em.
IV. CÁC NGUỒN THAM KHẢO
Bộ Y tế (2024). Báo cáo sức khỏe học đường Việt Nam.
Bộ Giáo dục và Đào tạo (2018). Sách giáo khoa Khoa học tự nhiên 8.
Bộ Giáo dục và Đào tạo (2020). Chăm sóc mắt và phòng chống mù lòa.
Trịnh Minh Phong (2024). Luận án tiến sĩ y học. Thực trạng vẹo cột sống ở học sinh tiểu học tại Thái Nguyên và hiệu quả của một số giải pháp can thiệp.
Hoàng Hữu Khôi (2017). Luận án tiến sĩ y học. Nghiên cứu tật khúc xạ và mô hình can thiệp ở học sinh trung học cơ sở thành phố Đà Nẵng.
Muñoz-Álvarez, M., et al. (2024). "Validation of CVS-Q teen for digital eye strain in adolescents." Journal of Ophthalmology Research.
Oakley, P. A., et al. (2024). "Assessment of Forward Head Posture: Photogrammetry and Symptom Correlation in School-aged Children." Journal of Pediatric Orthopedics.
Các tài liệu khảo sát CVS-Q Teen, FHP,mô hình hành vi học đường (2022–2023)
V. CÁC CHƯƠNG TRÌNH HỖ TRỢ XÂY DỰNG PHẦN MỀM
Pixabay (Tải âm thanh)
MS Word 2016 (Soạn thảo nội dung)
Visual Studio Code (Xây dựng phần mềm)
Ngôn ngữ lập trình Python, thư viện Pygame
Figma (Thiết kế giao diện phần mềm)
VI. ĐỊNH HƯỚNG TƯƠNG LAI
	Về định hướng phát triển trong tương lai, sau khi lắng nghe những góp ý quý báu từ Ban giám khảo và quý thầy cô, chúng em dự kiến sẽ tiếp tục hoàn thiện, nâng cấp phần mềm để trở nên hoàn chỉnh, thân thiện và hiệu quả hơn.
	Không dừng lại ở đó, nhóm chúng em còn ấp ủ kể hoạch xuất phần mềm thanh ứng dụng di động đăng lên CH Play và App store, sản xuất thêm sản phẩm vật lí để cho những bạn không có thiết bị điện tử vẫn có thể sử dụng được, bổ sung thêm chủ đề học đường, mở rộng số lượng Flashcard, nâng cấp và đưa ChatBOT thẳng vào ứng dụng, hạn chế việc phải thoát ra ngoài ứng dụng, xây dựng hệ thông tài khoản cá nhân để lưu lại tiến trình thực hiện, thêm hiệu ứng chuyển giao diện mượt mà hơn.
	Đồng thời nhóm chúng em đang muốn tạo ra một Camera tích hợp AI có hình 
dạng như một món đồ trang trí để bàn, và cách thức hoạt động là luôn theo dõi người ngồi, nếu thấy tư thế chưa đúng, thì Camera sẽ nhắc nhở trực tiếp, đồng thời gửi thông bảo về thiết bị của phụ huynh để có thể biết và dặn dò con mình.
Chúng em hy vọng, với sự phát triển không ngừng, phần mềm sẽ thực sự trở thành người bạn đồng hành thân thiết của cả phụ huynh và các bạn học sinh đang có mong muốn cải thiện tư thế ngồi và bảo vệ được thị lực.
VII. LỜI CẢM ƠN
Trước hết, chúng em xin gửi lời cảm ơn chân thành đến Ban tổ chức cuộc thi Sáng Tạo Thanh Thiếu Niên, Nhi Đồng toàn quốc – nhờ có sân chơi ý nghĩa này, chúng em mới có cơ hội được thể hiện đam mê, thử sức sáng tạo và biến ý tưởng của mình thành sản phẩm thực tế.
Chúng em cũng xin cảm ơn thầy cô ở trường – những người đã luôn tận tình hướng dẫn, động viên và tạo điều kiện thuận lợi nhất để chúng em sắp xếp thời gian học tập và hoàn thành phần mềm “Cải thiện tư thế ngồi học và bảo vệ thị lực”.
Đặc biệt, chúng em xin gửi lời cảm ơn sâu sắc đến bố mẹ và các bạn học cùng lớp, vì đã luôn bên cạnh ủng hộ, góp ý và tiếp thêm tinh thần cho chúng em trên suốt chặng đường thực hiện dự án.
Chúng em chỉ mong rằng, dự án nhỏ bé này của nhóm chúng em sẽ phần nào hỗ trợ được cho các bạn ở độ tuổi học sinh đang ngồi sai tư thế và có mong muốn khắc phục tình trạng đó một cách dễ dàng, dễ thuộc. Và cũng góp thêm một phần công sức nhỏ vào hành trình cải thiện tư thế và bảo vệ thị lực cho các bạn trên khắp mọi miền đất nước.
Chúng em xin trân trọng cảm ơn Ban giám khảo đã lắng nghe!

