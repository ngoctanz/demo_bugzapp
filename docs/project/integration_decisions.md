# Quyết định Kiến trúc & Tích hợp Đóng băng (`integration_decisions.md`)

Phiên bản 1.3 · Cập nhật Chặng P03 (03/11/2026) · Múi giờ mặc định: `Asia/Ho_Chi_Minh` (UTC+7)

## 1. Nền tảng Cơ sở dữ liệu (Database Contract)
- **Quyết định đóng băng:** Sử dụng **Firebase Realtime Database** (`firebase/database`).
- **Quy tắc cấm:** Tuyệt đối không chuyển sang Cloud Firestore hoặc SQL.
- **Bốn nhánh gốc bắt buộc giữ nguyên từ Excel (`firebase_schema_contract.json`):**
  1. `users/{uid}` (`full_name`, `email`)
  2. `devices/{device_id}` (`user_id`, `device_name`, `monitoring_enabled`, `current_posture`, `monitoring_active`, `alert_after_sec`, `last_seen_at`)
  3. `sessions/{device_id}/{session_id}` (`device_id`, `started_at`, `ended_at`, `good_count`, `bad_count`, mở rộng: `student_id`, `source`, `content_day`)
  4. `alerts/{device_id}/{session_id}/{alert_id}` (`session_id`, `message`, `created_at`, `is_read`, mở rộng: `student_id`, `event_id`, `episode_id`, `reminder_index`, `posture_code`, `severity`, `occurred_at`, `received_at`, `time_basis`, `image_id`, `source`)
- **Lưu ý kiểu dữ liệu RTDB:** Không ghi `null` cho trường tùy chọn (vì `null` trong RTDB đồng nghĩa xóa nhánh). Phiên đang mở bỏ trống trường `ended_at`.

## 2. Xác thực & Phân quyền 3 Vai trò (RBAC)
- **Ba vai trò cố định:** `superadmin`, `guardian` (Phụ huynh), `student` (Học sinh). Không thêm vai trò giáo viên hay marketplace.
- **Bootstrap SuperAdmin:** Email nguồn là `minhquantran4312@gmail.com` và `tamtranmusic@gmail.com`. Quyền `superadmin` chỉ được cấp bởi Backend sau khi xác minh Firebase ID Token (`verifyIdToken`), `email_verified === true`, khớp danh sách email nguồn và khóa `system_locks/superadmin_bootstrap` (Run-Once).

## 3. Chốt Một Adapter MQTT Duy Nhất cho Bản Nộp (Chặng P03)
- **Adapter đã chốt cho bản nộp:** **`webhook_https`** — **MQTT Broker có TLS + ACL từng thiết bị, chuyển tiếp sự kiện qua HTTPS Rule Engine/Webhook tới `POST /api/ingest/mqtt` và nhận lệnh điều khiển từ Backend qua HTTP Publish API (`MQTT_PUBLISH_API_URL`)**.
- **Lý do kỹ thuật:**
  - Không giả định Firebase có MQTT Broker tích hợp.
  - Không chạy vòng lặp MQTT subscriber vô hạn trong HTTP Cloud Function ngắn hạn.
  - Giữ một hợp đồng sự kiện duy nhất (`mqtt_examples.json`) tại `POST /api/ingest/mqtt` cho cả Broker thật và Simulator có nhãn (`source="simulator"`).
- **Trạng thái cấu hình thực tế (`configuration/ROBOT_CONNECTION_TEMPLATE.json`):**
  - Hiện tại file `configuration/ROBOT_CONNECTION_TEMPLATE.json` đang ở trạng thái `"TEMPLATE_NOT_CONNECTED"` (`broker.host = null`, `device.device_id = null`).
  - Các biến môi trường còn chờ cấu hình ngoài AI Studio để kết nối Robot vật lý:
    - `MQTT_ADAPTER_MODE="webhook_https"`
    - `MQTT_BROKER_URL="mqtts://<broker-host>:8883"`
    - `MQTT_WEBHOOK_SHARED_SECRET="<hmac-or-shared-secret>"`
    - `MQTT_PUBLISH_API_URL="https://<broker-host>/api/v5/publish"`
    - `MQTT_PUBLISH_API_TOKEN="<broker-publish-api-token>"`
- **Bảo mật TLS, Credential & ACL từng thiết bị trên Broker:**
  - Mỗi Robot vật lý xác thực với Broker qua TLS (`mqtts://`, cổng `8883`) bằng username/client_id riêng trùng với `device_id`.
  - ACL trên Broker khóa chặt từng `device_id`:
    - Quyền **Publish** của Robot `{device_id}`:
      - `bugz/v1/devices/{device_id}/observations` (QoS 1, `retain=false`)
      - `bugz/v1/devices/{device_id}/events` (QoS 1, `retain=false`)
      - `bugz/v1/devices/{device_id}/presence` (QoS 1, `retain=true`, có timestamp)
      - `bugz/v1/devices/{device_id}/acks` (QoS 1, `retain=false`)
    - Quyền **Subscribe** của Robot `{device_id}`:
      - `bugz/v1/devices/{device_id}/commands` (QoS 1, `retain=false`, có `expires_at`)
  - Khi Broker chuyển tiếp gói tin vào `POST /api/ingest/mqtt`, Backend bắt buộc kiểm tra:
    1. Header xác thực Webhook (`x-bugz-webhook-secret`) hoặc quyền Admin Simulator (`source=simulator` chỉ cho phép `superadmin` trong môi trường demo).
    2. Khớp `device_id` giữa **MQTT client identity (`client_id` / `username`)**, **topic (`bugz/v1/devices/{topic_device_id}/...`)** và **`payload.device_id`**. Nếu lệch bất kỳ thành phần nào -> từ chối `403 DEVICE_IDENTITY_MISMATCH`.

## 4. Nơi Quyết định Đợt (Episode Authority) & Máy Trạng thái Tin cậy (Mục 6.2, 6.3, 12.3 Artifact)
- **Nơi duy nhất tính đợt:** **`bridge` (Backend Ingest Engine)** là nơi duy nhất vận hành máy trạng thái đếm đợt ổn định (`good_count`, `bad_count`). Nếu thiết bị khai báo `computes_episodes = true` và gửi `episode.started` / `episode.ended`, Backend sẽ tắt tự tính đợt từ frame để không bao giờ cộng bộ đếm hai lần.
- **Thông số kỹ thuật thử nghiệm (Không phải ngưỡng y khoa hay chẩn đoán bệnh lý):**
  - Thời gian xác nhận đợt ổn định (`stable_ms`): **3.000 ms (3 giây)**.
  - Thời gian bắt đầu phát cảnh báo trong đợt sai (`alert_after_sec`): **30 giây** (cấu hình được theo thiết bị/phiên).
  - Thời gian tối thiểu giữa hai lần nhắc trong cùng một đợt sai (`repeat_after_sec` / cooldown): **60 giây**.
  - Ngưỡng độ tin cậy tối thiểu (`min_confidence`): **0.65**.
- **Chuẩn hóa 4 trạng thái (`good | bad | absent | unknown`):**
  - Khi `robot_moving === true`, thiếu người (`absent`), `confidence < 0.65`, hoặc `calibration_valid === false`, trạng thái bắt buộc chuẩn hóa về `unknown` (hoặc `absent`), **ngắt chuỗi sai liên tục và tuyệt đối không tính là `bad`**.
  - Không suy diễn khoảng cách `cm` từ camera RGB chưa hiệu chuẩn. Khi thiếu `posture_code` hoặc mã không nằm trong `supported_posture_codes`, giữ `posture_code` trống và hiển thị thông điệp chuẩn `"Tư thế chưa phù hợp"`.
- **Kiến trúc 3 bước Chống trùng QoS 1 & Phục hồi Crash (`Inbox -> Runtime Transaction -> Projection Worker`):**
  1. **Inbox & Validation:** Kiểm tra schema, ACL, chống số âm / `NaN`, kiểm tra lệch đồng hồ (`time_basis: "robot_clock_validated" | "server_received_fallback"`).
  2. **Transaction tại `device_runtime/{device_id}`:** Ghi nhận khóa chống trùng `${device_id}:${boot_id}:${event_id}`, kiểm tra thứ tự `sequence` theo `boot_id`, cập nhật FSM, tăng `revision` và đẩy sự kiện vào `outbox` trong cùng một bước nguyên tử.
  3. **Worker Chiếu Idempotent (`Projection Worker`):** Đọc `outbox` theo thứ tự `revision` của từng thiết bị, cập nhật `sessions/{device_id}/{session_id}`, `episode_log/{student_id}/{episode_id}`, `alerts/{device_id}/{session_id}/{alert_id}` và `student_alerts/{student_id}/{alert_id}`. Nếu crash sau khi commit `device_runtime` nhưng trước khi fan-out, lần chạy lại worker hoặc gói retry sẽ khôi phục đầy đủ từ `outbox` mà không mất cảnh báo và không cộng lặp bộ đếm.

## 5. Chính sách Ảnh Capture Riêng tư & Lịch sử Múi giờ Việt Nam (Mục 6.4, 6.5, 12.4 Artifact)
- **Ảnh Capture:**
  - Robot xin `POST /api/captures/upload-ticket` (ngắn hạn 5 phút, giới hạn MIME `image/jpeg | image/png | image/webp`, kích thước tối đa `2MB`) -> PUT ảnh lên Storage riêng tư -> MQTT chỉ truyền `capture_id`.
  - Tuyệt đối không lưu chuỗi `base64` vào Realtime Database hoặc gói MQTT.
  - Khi người dùng xem ảnh qua `GET /api/captures/:id`, Backend kiểm tra quyền sở hữu/liên kết với `student_id` trước khi cấp quyền xem ngắn hạn; nếu là SuperAdmin xem hỗ trợ kỹ thuật, bắt buộc ghi `audit_logs`.
- **Lịch sử & Thống kê:**
  - Lưu trữ bằng UTC epoch milliseconds; hiển thị và lọc theo múi giờ hồ sơ học sinh (mặc định `Asia/Ho_Chi_Minh`, tuần bắt đầu từ Thứ Hai).
  - Khoảng lọc nửa mở `[fromUtcMs, toUtcMs)` chống đếm trùng điểm biên.
  - Đợt tư thế (`episode_log`) kéo dài qua nửa đêm (`00:00`) chỉ được đếm **một lần duy nhất** theo thời điểm bắt đầu đợt (`started_at`).
  - Không bao giờ lấy `good_count / (good_count + bad_count)` để gọi là "tỷ lệ thời gian ngồi đúng".
