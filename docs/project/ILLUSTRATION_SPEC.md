# Thiết kế hình minh họa BUGZ

Đã tạo một ảnh PNG 1254×1254 px, atlas 2×2 gồm bốn cảnh. Không gọi là 4K. Đây là ảnh biên soạn mới bằng công cụ tạo ảnh tích hợp, phục vụ câu hỏi và phần dẫn chuyện. Tư liệu gốc của dự án vẫn giữ riêng.

Cùng cặp nhân vật nam–nữ xuyên suốt. Nam tóc nâu ngắn, áo polo teal, quần short kem, giày sáng. Nữ tóc bob nâu có kẹp vàng, váy coral và áo trắng. Phong cách hoạt hình 3D mềm, bề mặt mờ, ánh sáng lớp học dịu, màu teal, mint, kem, xanh trời. Nhân vật chưa được gán là thành viên hoặc học sinh thật của dự án.

- POSTURE ở ô trên trái: góc học và tư thế đọc.
- DESK ở ô trên phải: bàn ghế, kê chân và đèn.
- EYES ở ô dưới trái: nghỉ nhìn gần bên cửa sổ.
- MOVE ở ô dưới phải: nghỉ vận động nhẹ.

Đã xem hình tạo ra để kiểm tra bố cục bốn cảnh, cùng hai nhân vật và không có chữ. Hình chỉ minh họa chủ đề, không phải sơ đồ công thái học có tỷ lệ đo. Không dùng vị trí mắt/tay/chân trong ảnh AI để tự động chấm tư thế hoặc suy khoảng cách cm. Trước khi làm bài chọn hình đúng/sai cần thiết kế và thẩm định riêng các ảnh đáp án.

## Prompt gốc để tạo tiếp cùng hướng

```text
Create ONE square educational illustration atlas, a single coherent 2 by 2 panel sheet, perfectly equal quadrants separated by thin clean cream gutters. This is an image asset for a Vietnamese student posture and eye-care quiz, for ages 8-14. Style: premium friendly 3D clay cartoon, soft matte textures, rounded forms, warm daylight, teal mint sky blue cream with tiny coral accents. Use the SAME TWO Vietnamese schoolchildren in every quadrant: boy short dark brown side-part hair teal polo cream shorts white sneakers, girl dark brown bob hair small yellow hairclip coral pinafore over white shirt white sneakers. Big expressive eyes, natural child proportions. Panel top-left: side three-quarter view of boy reading upright comfortably at correctly sized school desk, shoulders relaxed, back lightly supported, feet flat on the floor, book at comfortable distance; girl smiles and gently points to comfortable posture. Panel top-right: girl at bright tidy desk and boy adjusting a stable footrest and a desk lamp; show comfortable supported feet, shoulders relaxed and lamp illuminating book without glare. Panel bottom-left: both children taking an eye break at their classroom window, looking toward a clearly distant green tree outside, daylight, calm, no sun gazing. Panel bottom-right: both children have stepped away from desks for a relaxed walking and stretching break, cheerful, arms gently raised, no extreme neck bends. Each quadrant must be a distinct complete medium-wide scene with generous safe margins, and exactly these two consistent characters. All depictions educational, physically plausible and appropriate. Do not include any text, letters, numerals, rulers, medical symbols, logos, watermarks, speech bubbles or captions. No diagnosis imagery, no scary effects, no spine x-rays. Image itself is illustrative only; no exact measurement graphics.
```

Khi tạo cảnh mới, đính kèm ảnh atlas làm tham chiếu nhận diện và chất liệu. Giữ trang phục, tóc, tỷ lệ, palette; chỉ thay hành động và góc máy cần thiết. Các chữ, số đo, đáp án và nhãn giao diện được vẽ bằng code để có thể kiểm tra chính xác.
