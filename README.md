# BUGZ BrightUpGenZ — Hệ sinh thái Học 28 Ngày, Robot Đồng hành Tư thế & Trò chơi Rèn luyện

Phiên bản nộp: **`P06-v1.0` (03/11/2026)** · Dự án Firebase: **`gen-lang-client-0531599250` (`asia-southeast1`)**

**BUGZ BrightUpGenZ** là ứng dụng Webapp/PWA hỗ trợ học sinh trung học cơ sở và tiểu học xây dựng thói quen **Lưng thẳng – Mắt sáng** qua ba phân hệ tách biệt, minh bạch dữ liệu:
1. **Học và thực hành 28 ngày (`/learn`)**: 4 tuần · 28 thẻ bài học chính từ bộ Flashcard gốc (đối chiếu 100% `content_days_manifest.json` và `source_manifest.json`), nút bóng đèn mở đúng thẻ giải thích (`explain1.png`–`explain7.png`), huy chương đúng mốc ngày (5, 7, 10, 14, 15, 21, 25, 28), và quy trình đăng ký nhận chứng nhận tại Ngày 28 (tuyệt đối không tự tạo Ngày 29).
2. **Robot đồng hành & Lịch sử quan sát (`/robot`, `/history`)**: Giám sát tư thế qua kiến trúc chuẩn **Robot/Simulator → MQTT Broker (TLS + ACL) → HTTPS Webhook Bridge (`/api/mqtt/webhook/ingest`) → Firebase Admin SDK → Realtime Database**. Phân biệt chặt chẽ lệnh yêu cầu `monitoring_enabled` và phản hồi `monitoring_active` (ACK), 4 trạng thái `good | bad | absent | unknown`, đếm theo đợt ổn định (`good_count`, `bad_count`), chống trùng QoS1 theo `event_id` ổn định, và bảo vệ ảnh chụp qua Cloud Storage Signed URL (`/api/captures/view-url`).
3. **Trò chơi rèn luyện (`/games`)**: 3 chế độ chơi tương tác (*Tình huống nhanh*, *Góc học tập chuẩn*, *Tiếp sức thói quen*) sử dụng ngân hàng 40 câu hỏi đã duyệt (20 câu *Lưng thẳng* + 20 câu *Mắt sáng*) gắn với 4 cảnh trong `bugz_learning_atlas.png`. Chấm điểm 100% phía server, chống cộng điểm lặp (`+10 / +30 / +20` lần đầu, `+0` khi làm lại), và **tách biệt tuyệt đối 3 chỉ số**: (1) Tiến độ tự thực hành 28 ngày, (2) Điểm trò chơi rèn luyện, và (3) Số đợt tư thế tốt từ Robot.

---

## 1. Cài đặt, Chạy thử và Kiểm thử Tự động

### 1.1. Yêu cầu hệ thống
- Node.js `>= 20.x`
- npm `>= 10.x`
- File cấu hình môi trường `.env` (sao chép từ `.env.example` và điền thông số theo dự án Firebase `gen-lang-client-0531599250`).

### 1.2. Các lệnh chính

```bash
# 1. Cài đặt các gói phụ thuộc
npm install

# 2. Chạy server phát triển (Express + Vite middleware trên cổng 3000)
npm run dev

# 3. Chạy toàn bộ 25 bài kiểm thử đơn vị & bảo mật (P01..P06, T01..T30)
npm test

# 4. Kiểm tra kiểu dữ liệu TypeScript (tsc --noEmit)
npm run lint

# 5. Build bản production (tạo thư mục dist/)
npm run build

# 6. Chạy bản production
npm start

# 7. Xuất gói Demo Backup Seed, Checkpoint P06 và gói ZIP mã nguồn sạch
npx tsx scripts/p06ReleaseTools.ts
```

---

## 2. Kiến trúc Phân quyền (RBAC) & Hợp đồng Dữ liệu Firebase Realtime Database

Hệ thống sử dụng **Firebase Realtime Database** (tuyệt đối không dùng Firestore) với `database.rules.json` mặc định từ chối (`".read": false, ".write": false`).

### 2.1. Ba vai trò người dùng
- **`superadmin`**: Bootstrap một lần phía server (`/api/auth/bootstrap-superadmin`) khi email đã xác minh khớp `SUPERADMIN_BOOTSTRAP_EMAIL` (`minhquantran4312@gmail.com,tamtranmusic@gmail.com`). Không bao giờ cấp quyền Admin bằng điều kiện kiểm tra email phía trình duyệt.
- **`guardian` (Phụ huynh)**: Sở hữu thiết bị (`devices/{device_id}.user_id == auth.uid`), quản lý hồ sơ con đã liên kết (`linked_students/{student_id}: true`), bật/tắt yêu cầu giám sát và cấu hình nhận thông báo.
- **`student` (Học sinh)**: Chỉ đọc/thao tác trên dữ liệu gắn với `student_id` của chính mình; không được đổi chủ sở hữu thiết bị, không tự ghi kết quả Robot hoặc tự cộng điểm trò chơi.

### 2.2. Bốn nhánh gốc bắt buộc & các nhánh mở rộng có lý do

| Nhánh RTDB | Vai trò & Quy tắc bảo vệ (`database.rules.json`) |
| :--- | :--- |
| `users/{uid}` | Hồ sơ tài khoản. Client không được tự ghi trường `role` hoặc `linked_students`. |
| `devices/{device_id}` | Thiết bị Robot (`user_id` là UID phụ huynh sở hữu, `active_student_id`, `monitoring_enabled`, `monitoring_active`, `status`). Client chỉ được cập nhật `monitoring_enabled` hoặc `active_student_id` hợp lệ; chỉ Bridge/Server mới được ghi `monitoring_active` và telemetry. |
| `sessions/{device_id}/{session_id}` | Phiên giám sát Robot (`student_id`, `start_time`, `end_time`, `good_count`, `bad_count`, `source`). Chỉ Server/Bridge ghi. |
| `alerts/{device_id}/{session_id}/{alert_id}` | Cảnh báo tư thế (`type`, `timestamp`, `message`, `capture_id`, `source`). Chỉ Server/Bridge ghi; người dùng có quyền được đánh dấu `acknowledged_at`. |
| `students/{student_id}` | Hồ sơ học sinh riêng biệt để 1 phụ huynh quản lý nhiều con. |
| `practice_progress/{student_id}/days/{day_no}` | Tiến độ thực hành 28 ngày (`self_practice` tách biệt với `robot_assisted`). |
| `certificate_requests/{student_id}` | Yêu cầu cấp chứng nhận hoàn thành Ngày 28 (chỉ mở khi đủ 28/28 ngày). |
| `questions_public/{question_id}` | 40 câu hỏi đã duyệt hiển thị cho học sinh (**không chứa `correct_key` hay `explanation`**). |
| `question_answers_server/{question_id}` | Đáp án và giải thích chỉ đọc/chấm bởi Backend Admin SDK. |
| `game_attempts/{student_id}/{attempt_id}` | Lịch sử lượt chơi và điểm do server chấm (chống cộng điểm lặp). |
| `notification_jobs/{alert_id}` | Trạng thái định tuyến thông báo độc lập (`queued` → `provider_accepted` → `delivered` → `read` / `blocked_missing_config` / `suppressed_quiet_hours`). |

---

## 3. Giao thức MQTT Robot & Xử lý Lịch sử (Chặng P03)

- **Adapter đã chốt cho bản nộp**: `webhook_https` — MQTT Broker xác thực thiết bị qua TLS + ACL rồi gọi `POST /api/mqtt/webhook/ingest` kèm `x-mqtt-webhook-secret`, hoặc gửi lệnh qua `POST /api/robot/command/monitoring`.
- **Nơi duy nhất quyết định đợt (Single Episode Authority)**: Bridge phía server (`server_bridge_episode_engine`) là nơi duy nhất chuyển các thông điệp trạng thái thành bộ đếm đợt ổn định (`good_count`, `bad_count`).
- **4 trạng thái chuẩn**: `good`, `bad`, `absent`, `unknown`. Khi học sinh rời ghế (`absent`) hoặc thiếu độ tin cậy/mất chuẩn (`unknown`), hệ thống không tự biến thành tư thế sai (`bad`).
- **Tách yêu cầu và ACK**: Khi người dùng bật giám sát, hệ thống ghi `monitoring_enabled=true` và hiển thị *"Đang gửi yêu cầu giám sát — chờ Robot phản hồi ACK..."*. Chỉ khi nhận gói MQTT ACK từ Robot/Simulator mới chuyển `monitoring_active=true`.
- **Chống trùng QoS1**: Mỗi gói MQTT đi kèm `event_id` ổn định; gói phát lại (retry) được trả về `deduplicated: true` và không tăng lặp `good_count` / `bad_count` hoặc tạo cảnh báo trùng.
- **Bảo vệ ảnh chụp**: Payload MQTT chỉ gửi `capture_id` / metadata (tuyệt đối chặn `base64` ảnh trong MQTT/RTDB). Ảnh được truy xuất qua `/api/captures/view-url` sau khi kiểm tra quyền sở hữu.

---

## 4. Kịch bản Thuyết trình & Demo Thi 6 Phút (`[REAL / SIMULATOR]`)

Kịch bản 6 phút được tích hợp trực tiếp tại trang **`/integration-status`** (kèm nút **Reset Dữ liệu Demo Sạch** trước giờ thi):

| Thời lượng | Nội dung trình diễn | Đường dẫn | Nhãn chế độ |
| :--- | :--- | :--- | :--- |
| **Phút 0:00 – 1:00** | **1. Bài toán, Thư viện Gốc & Bảo mật RBAC**: Trình bày số liệu khảo sát có nhãn `source_reported` (trường THCS Nguyễn Trãi), mở Thư viện Flashcard/Báo chí/Đội ngũ/Chứng nhận với hotspot khớp viền 100%, chuyển nhanh 3 vai trò (`SuperAdmin`, `Phụ huynh`, `Học sinh`) để chứng minh RBAC. | `/`, `/library`, `/admin` | `[REAL]` |
| **Phút 1:00 – 2:15** | **2. Hành trình Học & Thực hành 28 Ngày**: Mở Ngày 1 → bấm biểu tượng bóng đèn xem thẻ giải thích gốc `explain1.png` → đánh dấu hoàn thành → kiểm tra Ngày 28 mở khóa biểu mẫu Yêu cầu Chứng nhận (xác nhận không có Ngày 29). | `/learn` | `[REAL]` |
| **Phút 2:15 – 3:45** | **3. Robot Đồng hành, ACK & Chống trùng QoS1**: Chọn hồ sơ **Bé Minh (`stu-a1`)** → bấm **Yêu cầu Bật Giám sát** (`monitoring_enabled=true`, chờ ACK) → bấm **Robot Gửi ACK** (`monitoring_active=true`) → bắn kịch bản 4 trạng thái (`good`, `bad`, `absent`, `unknown`) và thử gửi lại cùng `event_id` để chứng minh chống trùng QoS1. | `/robot`, `/history` | `[REAL + SIMULATOR]` |
| **Phút 3:45 – 4:45** | **4. Pipeline Thông báo Đa kênh & Giờ Yên lặng**: Kiểm tra cảnh báo vừa phát sinh định tuyến từ thiết bị → phiên → `student_id` phía server → phụ huynh liên kết. Bấm **Phát giọng nhắc mẫu** (lời nhắc ấm áp, nút Nghe lại), kiểm tra nhật ký trạng thái (`queued`/`delivered`/`read`) và khung giờ yên lặng. | `/settings/notifications`, `/history` | `[REAL]` |
| **Phút 4:45 – 6:00** | **5. Trò chơi Rèn luyện 3 Chế độ & Tách biệt 3 Chỉ số**: Chơi nhanh 3 chế độ (*Tình huống nhanh*, *Góc học tập chuẩn*, *Tiếp sức thói quen*), thử trả lời lại câu đã đúng để chứng minh server chấm `+0 điểm` chống cày điểm, và chỉ rõ 3 ô chỉ số độc lập trên đầu trang. | `/games`, `/integration-status` | `[REAL]` |

---

## 5. Ma trận Nghiệm thu `T01`–`T30` & Các Hạng mục Chờ Cấu hình Ngoài (External Blockers)

Toàn bộ 30 ca kiểm thử (`T01`–`T30`) và 10 chốt chặn P0 có mặt đầy đủ tại trang **`/integration-status`** và API **`GET /api/system/p06-verification-matrix`**:
- **27 / 30 ca đạt `PASS` hoàn toàn** bằng unit test tự động (`npm test`, 25/25 suite PASS) và kiểm tra trình duyệt thực tế (`playwright-cli` trên 5 khung hình `360×800`, `390×844`, `768×1024`, `1024×768`, `1440×900`).
- **03 / 30 ca đạt `PASS (Code/Sandbox) · BLOCKED (Live External)`** (được báo cáo trung thực, tuyệt đối không giả lập thành `PASS` tích hợp ngoài):
  1. **`T01` (Live Google OAuth Domain & Service Account JSON)**: Mã nguồn đã tích hợp `signInWithPopup` + `/api/auth/bootstrap-superadmin`. Chờ chủ dự án whitelist domain chạy thật trên Firebase Console → Authorized domains và nạp `FIREBASE_SERVICE_ACCOUNT_JSON`.
  2. **`T21` (Live FCM Web Push VAPID Key)**: Mã nguồn đã có `public/firebase-messaging-sw.js` và luồng lưu token FCM. Chờ chủ dự án tạo cặp khóa Web Push VAPID trên Firebase Console và điền vào `VITE_FIREBASE_VAPID_KEY`.
  3. **`T24` (Live SMTP Email Credentials)**: Mã nguồn đã tách trạng thái `queued` / `provider_accepted` / `blocked_missing_config`. Chờ chủ dự án cấu hình `SMTP_HOST`, `SMTP_USER`, `SMTP_PASS` trên môi trường server.

Chi tiết triển khai từng lệnh CLI được trình bày đầy đủ trong **[`DEPLOY_FIREBASE.md`](./DEPLOY_FIREBASE.md)**.

---

## 6. Модел AI Giám sát Tư thế Ngồi Chính diện (V6 · 36 Đặc trưng) & Các Mốc Cảnh báo Sinh cơ học

Hệ thống tích hợp trực tiếp mô hình **Front-View 5-Class Posture Recognition V6** (MediaPipe Pose Landmarker 3D + 36 đặc trưng hình học & độ lệch cá nhân hóa) tại `src/lib/frontPostureEngine.ts` và bộ giám sát chạy nền xuyên trang `src/components/posture/`.

### 6.1. Bảng các mốc độ nghiêng & thông số kích hoạt cảnh báo

| Nhóm lỗi tư thế | Thông số đo (`features`) | Ngưỡng báo Vàng (`WARNING`) | Ngưỡng thoát về Xanh (`GOOD` - Hysteresis) | Mô tả & Hành vi nhắc nhở |
| :--- | :--- | :--- | :--- | :--- |
| **1. Lệch hai vai** (`shoulder_imbalance`) | `shoulder_roll_deg` / `delta_shoulder_roll_deg` | **`>= 6.0°`** *(hoặc lệch so với chuẩn cá nhân `>= 5.2°`)* | **`< 4.2°`** *(lệch chuẩn `< 3.8°`)* | Phát hiện nhích/nghiêng lệch vai trái hoặc phải. |
| **2. Nghiêng đầu sang bên** (`head_tilt_left` / `right`) | `ear_roll_deg` (`head_roll_deg`) / `neck_lateral_bend_deg` | **`>= 11.0°`** *(hoặc độ uốn cổ bên `>= 9.5°`)* | **`< 8.5°`** *(độ uốn cổ `< 7.5°`)* | Phát hiện nghiêng đầu qua vai trái hoặc phải. |
| **3. Cúi đầu tới trước / Rụt cổ** (`leaning_forward` / `text_neck`) | • `neck_sagittal_pitch_deg`<br>• `delta_head_pitch_nose_ear`<br>• `delta_neck_height_nose`<br>• `delta_head_to_shoulder_ratio` | • Góc cúi cổ 3D **`>= 22.0°`**<br>• Chúc mũi/tai **`>= +0.30`** (~`15°–17°`)<br>• Chiều cao cổ tụt **`<= -18%`**<br>• Đầu nhô gần màn hình **`>= +14%`** | • Góc cúi cổ **`< 19.5°`**<br>• Chúc mũi/tai **`< +0.24`**<br>• Chiều cao cổ **`> -14%`**<br>• Tỷ lệ đầu/vai **`< +11%`** | Phát hiện cúi gằm đầu, rụt cổ hoặc dí sát mắt vào màn hình. |
| **4. Ngả / Trượt lưng ra sau** (`leaning_backward` / `slouch_backward`) | `torso_sagittal_pitch_deg` / `delta_head_to_shoulder_ratio` | Góc ngả lưng **`<= -5.5°`** hoặc đầu lùi xa thu nhỏ **`<= -10.5%`** | Đưa lưng về thẳng tự nhiên | Phát hiện trượt hông, ngả người ra sau ghế. |
| **5. Nghiêng lệch trục thân** (`leaning_left` / `leaning_right`) | `nose_offset_x_norm` / `delta_nose_offset_x` | Lệch tâm ngang **`>= 5.5% – 7.5%`** bề rộng vai | **`< 4.2%`** bề rộng vai | Trọng tâm đầu và thân trên lệch khỏi đường trục giữa. |
| **6. Tay chống cằm** (`chin_rest`) | `min_wrist_to_face_norm` | Khoảng cách cổ tay tới mặt **`<= 0.38 – 0.42`** | **`> 0.46`** | Phát hiện đưa tay lên chống cằm hoặc tựa má khi ngồi học. |

### 6.2. Cơ chế Chuyển trạng thái 3 Tầng & Chống báo giả khi đang chỉnh tư thế
- **Từ Xanh (`GOOD`) → Vàng (`WARNING`):** Phản hồi **tức thì (`0s` debounce)** ngay khi chạm mốc cảnh báo để hiển thị lưu ý nhẹ trên khung HUD và thanh **Dynamic Island** (khi đang ở các trang `/learn`, `/games`, `/library`...).
- **Từ Vàng (`WARNING`) → Đỏ (`BAD`):** Debounce **`10.0 giây` (10s)** — chỉ khi giữ tư thế sai liên tục đủ `10.0s` mới chuyển sang cảnh báo Đỏ, phát giọng nhắc và **ngay lập tức cộng thêm lượt cảnh báo / đợt cần chỉnh ở bảng thống kê bên dưới**. Nhờ khoảng đệm 10 giây ở trạng thái Vàng, học sinh có đủ thời gian tự điều chỉnh về tư thế chuẩn mà không bị nhảy sớm sang Đỏ.

