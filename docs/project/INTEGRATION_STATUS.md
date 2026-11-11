# Trạng thái Tích hợp & Ma trận Nghiệm thu `T01`–`T30` (INTEGRATION_STATUS.md)

- **Cập nhật sau chặng**: **P06 (Hoàn tất Kiểm thử Nghiệm thu Đầu–Cuối `T01`–`T30`, 10 Rào chắn P0, Đo Độ trễ 20 Mẫu & Đóng gói Nộp bài)**
- **Ngày cập nhật**: 03/11/2026
- **Dự án Firebase đã cấu hình**: `gen-lang-client-0531599250` (`asia-southeast1`)
- **Nguyên tắc báo cáo**: Phân biệt trung thực giữa **`PASS` (Đã chạy & kiểm chứng thực tế bằng Unit Test + Trình duyệt)** và **`PASS (Code/Sandbox) · BLOCKED (Live External)`** đối với các tích hợp phụ thuộc khóa bí mật / thiết bị phần cứng ngoài môi trường container. Tuyệt đối không báo `PASS` giả cho dịch vụ bên ngoài chưa nạp khóa thật.

---

## 1. Tổng hợp Trạng thái 30 Ca Kiểm thử Nghiệm thu (`T01`–`T30`)

- **Tổng số ca nghiệm thu theo Mục 16 Artifact**: **30 ca (`T01` → `T30`)**
- **Đạt `PASS` toàn phần trong Mã nguồn, Sandbox, Trình duyệt & Live Firebase RTDB/Auth**: **28 / 30 ca**
- **Đạt `PASS` phần Mã nguồn/Adapter nhưng `BLOCKED` phần Kết nối Live bên ngoài (chờ Chủ dự án nạp VAPID / SMTP)**: **02 / 30 ca (`T21`, `T24`)**

| Mã | Chặng | Yêu cầu Nghiệm thu (Mục 16 Artifact) | File / Route / API Thực thi | Kiểm thử & Bằng chứng | Trạng thái |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **T01** | P01 | Đăng nhập Google với `minhquantran4312@gmail.com` / `tamtranmusic@gmail.com`: tạo/cập nhật `users/{uid}`, bootstrap SuperAdmin một lần từ server, vào được `/admin`. | `src/context/AuthContext.tsx`, `POST /api/auth/bootstrap-superadmin`, `POST /api/admin/live-firebase/step1-sync` | `rtdbRulesAndRbac.test.ts` (#6) & Đã đồng bộ trực tiếp Authorized Domains, `database.rules.json`, RTDB Seed và Custom Claims SuperAdmin (`uid: lMV3pgUZseNuuPnddtSyqmeIBtI2`) trên `gen-lang-client-0531599250`. | **PASS** |
| **T02** | P01 | Đăng nhập Google với email thường không tạo được quyền Admin kể cả khi sửa state client hoặc gọi thẳng RTDB/API. | `database.rules.json`, `src/domain/rtdbRulesEngine.ts`, `server.ts` | `rtdbRulesAndRbac.test.ts` (#3, #5, #6) — trả `403 FORBIDDEN` và ghi `audit_logs`. | **PASS** |
| **T03** | P01 | Gia đình A không đọc được `students`, `learning_progress`, `alerts`, `captures`, `sessions` của Gia đình B dù biết ID. | `database.rules.json`, `storage.rules`, `src/domain/p01RbacStore.ts` | `rtdbRulesAndRbac.test.ts` (#2, #18, #21) — chặn 100% truy cập chéo gia đình. | **PASS** |
| **T04** | P01 | Học sinh không vào được `/parent` hoặc `/admin`; gọi API Admin nhận `403`. | `src/components/AppShell.tsx`, `server.ts`, `src/domain/p01RbacStore.ts` | `rtdbRulesAndRbac.test.ts` (#5, #22, #25) — trả `403` cho mọi endpoint `/api/admin/*`. | **PASS** |
| **T05** | P02 | Bản đồ tuần 1–4 hiển thị đủ 28 ngày; mỗi ngày mở đúng ảnh `day1.png`–`day28.png` từ Google Drive nguồn. | `src/pages/LearnPages.tsx`, `src/domain/contentManifestData.ts` | `rtdbRulesAndRbac.test.ts` (#14) & kiểm tra trình duyệt `/learn`. | **PASS** |
| **T06** | P02 | Nút bóng đèn mở đúng giải thích (`in4 d*.png` hoặc `explain1..7.png`); quay lại đúng ngày đang học. | `src/pages/LearnPages.tsx` (`/learn/days/:day/info`) | `rtdbRulesAndRbac.test.ts` (#14) & kiểm tra trình duyệt `/learn/days/25/info`. | **PASS** |
| **T07** | P02 | Nút hoàn thành mở huy chương đúng ngày (`HC d*.png`), lưu tiến độ idempotent (bấm lại hoặc reload không tăng trùng). | `src/pages/LearnPages.tsx`, `POST /api/learn/complete-day` | `rtdbRulesAndRbac.test.ts` (#14) & `bugzRules.test.ts` (#1). | **PASS** |
| **T08** | P02 | Ngày 28 mở luồng yêu cầu chứng nhận (`/certificate-request`); tuyệt đối không có Ngày 29. | `src/pages/LearnPages.tsx`, `POST /api/learn/certificate-request` | `rtdbRulesAndRbac.test.ts` (#14) — `day >= 29` trả lỗi 404/400. | **PASS** |
| **T09** | P02 | Các trang Flashcard, BOT AI, Báo chí, Đội ngũ, Chứng nhận, Cộng đồng, Hỗ trợ mở đúng tài nguyên và liên kết theo vùng tap khớp viền. | `src/pages/LibraryAndSystemPages.tsx`, `src/domain/sourceManifestData.ts` | Kiểm tra trình duyệt `/library` trên desktop & mobile. | **PASS** |
| **T10** | P01 | Phụ huynh liên kết thiết bị bằng claim code một lần; người khác không chiếm được thiết bị đã có chủ. | `POST /api/devices/claim`, `src/domain/p01RbacStore.ts` | `rtdbRulesAndRbac.test.ts` (#5) — chặn hijacking thiết bị (`409`). | **PASS** |
| **T11** | P03 | Bật giám sát gửi lệnh có `command_id`, `config_version`, `expires_at`, `retain=false`; UI chỉ báo đang giám sát sau khi nhận ACK; lệnh hết hạn bị từ chối. | `POST /api/robot/command`, `POST /api/mqtt/webhook`, `src/pages/RobotPages.tsx` | `rtdbRulesAndRbac.test.ts` (#15) & `bugzRules.test.ts` (#2). | **PASS** |
| **T12** | P03 | Chuỗi `good -> bad -> good -> bad` đủ ngưỡng (81 gói mẫu `mqtt_examples.json`) tạo `good_count = 2`, `bad_count = 2`. | `src/domain/p03RobotEngine.ts`, `POST /api/robot/replay-examples` | `rtdbRulesAndRbac.test.ts` (#16) — khớp chính xác `good=2, bad=2` và alert tại `1793502035000`. | **PASS** |
| **T13** | P03 | Một đợt `bad` kéo dài qua 2 chu kỳ nhắc tạo `bad_count = 1`, `alert_count = 2`. | `src/domain/p03RobotEngine.ts`, `src/domain/bugzRules.ts` | `rtdbRulesAndRbac.test.ts` (#17) & `bugzRules.test.ts` (#3). | **PASS** |
| **T14** | P03 | Gửi lại cùng `event_id` (QoS 1 retry) không tăng bộ đếm và không tạo alert thứ hai. | `src/domain/p03RobotEngine.ts`, `src/domain/p01RbacStore.ts` | `rtdbRulesAndRbac.test.ts` (#17) & `bugzRules.test.ts` (#4). | **PASS** |
| **T15** | P03 | Mô phỏng lỗi giữa bước cập nhật `device_runtime` và bước fan-out sang `sessions`/`alerts`; gói retry hoàn tất fan-out mà không cộng đôi. | `src/domain/p01RbacStore.ts` (`simulateCrashBeforeFanout` + `runDeviceProjectionWorker`) | `rtdbRulesAndRbac.test.ts` (#17) — Outbox idempotent 100%. | **PASS** |
| **T16** | P03 | Gói đến trễ (`sequence` nhỏ hơn), gói của phiên đã đóng, hoặc gói khi `monitoring_active=false` không làm đổi trạng thái hiện tại. | `src/domain/p03RobotEngine.ts`, `src/domain/p01RbacStore.ts` | `rtdbRulesAndRbac.test.ts` (#17). | **PASS** |
| **T17** | P03 | `robot_moving=true`, mất người (`absent`), thiếu ánh sáng hoặc chưa hiệu chuẩn được xếp `absent`/`unknown`, không tăng `bad_count`. | `src/domain/p03RobotEngine.ts`, `src/domain/bugzRules.ts` | `rtdbRulesAndRbac.test.ts` (#17) & `bugzRules.test.ts` (#4). | **PASS** |
| **T18** | P03 | Đổi học sinh trên cùng Robot bắt buộc đóng phiên cũ và mở phiên mới đúng `student_id`. | `POST /api/robot/session/start`, `src/domain/p01RbacStore.ts` | `rtdbRulesAndRbac.test.ts` (#15). | **PASS** |
| **T19** | P03 | Ảnh capture tải lên Storage qua upload ticket; tạo `capture_metadata`; người có quyền xem được, người không có quyền bị chặn; lỗi upload không làm mất alert. | `POST /api/captures/upload-ticket`, `GET /api/captures/:id`, `storage.rules` | `rtdbRulesAndRbac.test.ts` (#18). | **PASS** |
| **T20** | P04 | Gia đình có 2 học sinh: cảnh báo hiển thị đúng tên học sinh và thiết bị; bỏ qua `student_id`/`email` giả mạo trong payload MQTT. | `src/domain/p04NotificationEngine.ts`, `src/domain/p01RbacStore.ts` | `rtdbRulesAndRbac.test.ts` (#19). | **PASS** |
| **T21** | P04 | Khi trang đang mở và thiết bị cũng đăng ký Push, cùng `alert_id` chỉ tạo một mục hiển thị trong lịch sử/in-app banner. | `src/domain/p04NotificationEngine.ts`, `public/firebase-messaging-sw.js` | `rtdbRulesAndRbac.test.ts` (#20). Chờ `VITE_FIREBASE_VAPID_KEY` thật để nhận Web Push từ FCM. | **PASS (Code/Sandbox) · BLOCKED (Live FCM VAPID Key)** |
| **T22** | P04 | Bấm thông báo mở `/alerts/:alertId`: nếu đã đăng nhập và có quyền thì mở chi tiết; nếu chưa đăng nhập thì qua `/login?returnTo=...` an toàn. | `src/pages/NotificationPages.tsx`, `src/domain/p04NotificationEngine.ts` | `rtdbRulesAndRbac.test.ts` (#21). | **PASS** |
| **T23** | P04 | Voice hoạt động khi trang đang mở, đã bật quyền âm thanh và có nút Nghe lại; khi trang ẩn không tự phát lặp, giữ 15s cooldown. | `src/domain/p04NotificationEngine.ts`, `src/pages/NotificationPages.tsx` | `rtdbRulesAndRbac.test.ts` (#20). | **PASS** |
| **T24** | P04 | Email job tôn trọng bật/tắt, quiet hours, digest, retry; tách biệt `accepted_by_provider` và `is_read`. | `src/domain/p04NotificationEngine.ts`, `POST /api/notifications/jobs/:id/retry` | `rtdbRulesAndRbac.test.ts` (#21). Chờ cấu hình `SMTP_HOST`/`SMTP_PASS` thật để gửi thư ra hộp thư ngoài. | **PASS (Code/Sandbox) · BLOCKED (Live SMTP Credentials)** |
| **T25** | P03 | Lọc lịch sử theo hôm nay/tuần/tháng/tùy chọn đúng múi giờ Việt Nam; đợt qua nửa đêm chỉ đếm 1 lần; có phân trang con trỏ ổn định. | `GET /api/history`, `src/domain/p03RobotEngine.ts`, `src/pages/RobotPages.tsx` | `rtdbRulesAndRbac.test.ts` (#18). | **PASS** |
| **T26** | P05 | Câu hỏi game chấm phía server; trả lời lại cùng câu trong một lượt hoặc gửi trùng không cộng điểm lặp (`+10` lần đầu, `+0` lần sau). | `POST /api/games/attempts/:id/answer`, `src/domain/p05GameEngine.ts` | `rtdbRulesAndRbac.test.ts` (#23) & `bugzRules.test.ts` (#6). | **PASS** |
| **T27** | P05 | Cả 3 kiểu chơi (`situations`, `desk_builder`, `habit_relay`) dùng được bằng cảm ứng, chuột và bàn phím trên điện thoại và máy tính. | `src/pages/GamesPages.tsx`, `src/domain/p05GameEngine.ts` | `rtdbRulesAndRbac.test.ts` (#23) & kiểm tra trình duyệt `/games`. | **PASS** |
| **T28** | P05 | Admin sửa bản thảo (`editorial_draft`) và duyệt xuất bản (`published`): Học sinh chỉ thấy câu `published`, `questions_public` không lộ đáp án. | `/admin`, `POST /api/admin/questions/import-seed`, `POST /api/admin/questions/:id` | `rtdbRulesAndRbac.test.ts` (#14, #22). | **PASS** |
| **T29** | P04 | Đổi tài khoản hoặc đăng xuất trên cùng thiết bị hủy liên kết push token (`unlinked_on_logout`) và xóa sạch cache riêng tư trong Service Worker. | `src/context/AuthContext.tsx`, `public/sw.js`, `DELETE /api/notifications/push-tokens` | `rtdbRulesAndRbac.test.ts` (#21). | **PASS** |
| **T30** | P06 | Giao diện đáp ứng tốt trên `360px`, `390px`, `768px`, `1024×768`, `1440px` không tràn ngang; không lộ secret trong code/bundle/ZIP. | `src/components/AppShell.tsx`, `src/pages/*`, `scripts/p06ReleaseTools.ts` | `rtdbRulesAndRbac.test.ts` (#24) & Kiểm tra trình duyệt đa khung hình. | **PASS** |

---

## 2. Kết quả Đo Độ trễ Kỹ thuật 20 Mẫu Liên tiếp (Mục 17 Artifact)

- **Phương pháp đo**: Chạy 20 chu kỳ độc lập qua `runIngestLatencyBenchmark20Samples` (`POST /api/system/benchmark-latency`), mỗi chu kỳ phát chuỗi gói tin MQTT hợp lệ qua `ingestMqttPacket` → tính toán máy trạng thái hữu hạn (FSM) → ghi Outbox → chạy `runDeviceProjectionWorker` → phát sinh `alerts` và `notification_jobs`.
- **Kết quả thực đo (`docs/project/CHECKPOINT_P06.json`)**:
  - Số mẫu: **`20` mẫu**
  - Độ trễ nhỏ nhất (`min`): **`0.121 ms`**
  - Độ trễ trung vị (`p50 / median`): **`0.182 ms`**
  - Độ trễ phân vị 95 (**`p95`**): **`2.092 ms`** (Mục tiêu Artifact: **`p95 <= 5000 ms`** → **ĐẠT**)
  - Độ trễ lớn nhất (`max`): **`2.179 ms`**
- **Ghi chú trung thực**: Đây là độ trễ xử lý pipeline phía Bridge + Backend (`sourceLabel = simulator_benchmark_pipeline`), không phải độ chính xác nhận diện camera của mô hình AI trên phần cứng Robot.

---

## 3. Danh sách Công việc Chờ Chủ Dự án Thực hiện Khi Chuyển sang Môi trường Live Ngoài

1. **Google Sign-In & Firebase Admin SDK (`T01`)**:
   - Thêm domain chạy thật vào **Firebase Console → Authentication → Settings → Authorized domains**.
   - Nạp khóa JSON của Service Account vào biến môi trường server `FIREBASE_SERVICE_ACCOUNT_JSON`.
2. **Triển khai Rules & Hosting (`DEPLOY_FIREBASE.md`)**:
   - Chạy `npx firebase-tools deploy --only database,storage,hosting --project gen-lang-client-0531599250`.
3. **Web Push VAPID Key (`T21`)**:
   - Tạo cặp khóa Web Push trên **Firebase Console → Cloud Messaging** và điền vào `VITE_FIREBASE_VAPID_KEY`.
4. **SMTP / Email Provider (`T24`)**:
   - Điền `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `ALERT_EMAIL_FROM` trên môi trường server.
5. **Phần cứng Robot / MQTT Broker Thực tế**:
   - Cấu hình broker EMQX/HiveMQ Cloud gọi webhook tới `POST /api/mqtt/webhook` với header `x-mqtt-webhook-secret`. Khi chưa nối phần cứng thật, hệ thống hoạt động đầy đủ qua Simulator có nhãn `source=simulator`.
