# Hướng dẫn Cấu hình Biến Môi trường theo Từng Chặng (`ENV_SETUP.md`)

Phiên bản 1.1 · Ngày 01/11/2026 · Dự án **BUGZ BrightUpGenZ**

## 1. Nguyên tắc Phân chặng & Bảo mật

1. **Chặng P00 (Hiện tại):** **Không bắt buộc** cấu hình bất kỳ dịch vụ bên ngoài nào (Firebase, MQTT, FCM, Email) để chạy lệnh `npm run build`, `npm run typecheck` hoặc mở giao diện khung 3 module trên trình duyệt. Hệ thống không tự khởi tạo SDK khi thiếu cấu hình để tránh lỗi crash lúc khởi động.
2. **Chỉ yêu cầu khi chạy tính năng của chặng tương ứng:**
   - **Chặng P01:** Firebase Authentication (Google Login) & Firebase Realtime Database.
   - **Khi Backend thực sự cần sử dụng (từ P01 trở đi):** Firebase Admin SDK (xác minh ID token, cấp quyền SuperAdmin, ghi RTDB an toàn từ backend).
   - **Chặng P03:** MQTT Broker, Robot Bridge và Cloud Storage (lưu ảnh capture riêng tư).
   - **Chặng P04:** FCM Web Push và dịch vụ gửi Email cảnh báo/chứng nhận.
3. **Hiển thị trung thực:** Khi một nhóm biến chưa được cấu hình, giao diện hiển thị rõ nhãn **`Chưa cấu hình`** và API trả về mã lỗi cấu hình tường minh (`503 SERVICE_NOT_CONFIGURED`), tuyệt đối không giả đăng nhập, không giả gửi thông báo và không giả dữ liệu Robot thật.
4. **Quy tắc bảo mật tuyệt đối:**
   - Không điền giá trị giả (dummy/placeholder) để vượt qua bước kiểm tra.
   - **TUYỆT ĐỐI KHÔNG** đặt Firebase Admin credential, MQTT secret/password hoặc SMTP password/API key vào biến có tiền tố `VITE_*` (vì biến `VITE_*` được đóng gói công khai xuống trình duyệt).

---

## 2. Bảng Tổng hợp Toàn bộ Biến Môi trường

| STT | Tên biến đầy đủ | Phạm vi | Chức năng | Nơi lấy giá trị | Định dạng cần nhập (Không in giá trị secret thật) | Chặng bắt buộc sử dụng |
|---|---|---|---|---|---|---|
| 1 | `APP_URL` | Server | URL gốc của ứng dụng để tạo liên kết phản hồi (deep link trong email/push) | AI Studio tự động cấp khi chạy Cloud Run hoặc tự đặt ở local | URL có `http://` hoặc `https://` không có dấu `/` cuối (VD: `http://localhost:3000`) | Tùy chọn ở P00; dùng cho deep link ở **P04** |
| 2 | `GEMINI_API_KEY` | Server | Khóa mặc định của môi trường AI Studio (BUGZ không dùng AI tự sinh giáo trình hay đáp án game) | AI Studio tự tiêm từ Secrets (không bắt buộc cho luồng BUGZ) | Chuỗi ký tự API key hoặc để trống `""` | **Không bắt buộc** |
| 3 | `VITE_FIREBASE_API_KEY` | Client (Public) | Web API Key khởi tạo Firebase Client SDK (Auth, RTDB, FCM) | Firebase Console → Project Settings → General → Your apps (Web app) → `apiKey` | Chuỗi bắt đầu bằng `AIza...` (khoảng 39 ký tự, không khoảng trắng) | **P01** |
| 4 | `VITE_FIREBASE_AUTH_DOMAIN` | Client (Public) | Tên miền xác thực Google OAuth của Firebase Auth | Firebase Console → Project Settings → General → Your apps → `authDomain` | Tên miền dạng `<project-id>.firebaseapp.com` (không có `https://`) | **P01** |
| 5 | `VITE_FIREBASE_DATABASE_URL` | Client (Public) | Đường dẫn gốc tới **Firebase Realtime Database** (Không dùng Firestore) | Firebase Console → Realtime Database → Data tab (URL ở đầu bảng dữ liệu) | URL đầy đủ bắt đầu bằng `https://`, kết thúc bằng `.firebaseio.com` hoặc `.firebasedatabase.app` | **P01** |
| 6 | `VITE_FIREBASE_PROJECT_ID` | Client (Public) | Mã định danh dự án Firebase phía trình duyệt | Firebase Console → Project Settings → General → `Project ID` | Chuỗi chữ thường, số và dấu gạch ngang (VD: `bugz-brightupgenz-prod`) | **P01** |
| 7 | `VITE_FIREBASE_APP_ID` | Client (Public) | Mã định danh ứng dụng Web trong Firebase | Firebase Console → Project Settings → General → Your apps → `appId` | Chuỗi định dạng `1:<sender_number>:web:<hex_id>` | **P01** |
| 8 | `FIREBASE_PROJECT_ID` | Server-only | Mã dự án Firebase để Admin SDK đối chiếu khi xác minh ID Token | Cùng giá trị với `VITE_FIREBASE_PROJECT_ID` trong Firebase Console | Chuỗi `Project ID` (VD: `bugz-brightupgenz-prod`) | **Khi Backend thực sự cần sử dụng (từ P01)** |
| 9 | `FIREBASE_DATABASE_URL` | Server-only | URL Realtime Database để Admin SDK đọc/ghi dữ liệu từ backend | Cùng giá trị với `VITE_FIREBASE_DATABASE_URL` trong Firebase Console | URL đầy đủ `https://<db-name>.<region>.firebasedatabase.app` | **Khi Backend thực sự cần sử dụng (từ P01)** |
| 10 | `FIREBASE_SERVICE_ACCOUNT_JSON` *(Cách 1 - Khuyên dùng trên AI Studio)* | Server-only (Secret) | Credential của Firebase Admin SDK dưới dạng chuỗi JSON hoặc Base64 (không cần tạo file rời) | Firebase Console → Project Settings → Service accounts → **Generate new private key** (mở file `.json` vừa tải) | Chuỗi JSON thu gọn trên **1 dòng** (`{"type":"service_account","project_id":"...","private_key":"-----BEGIN PRIVATE KEY-----\n...","client_email":"..."}`) **HOẶC** chuỗi **Base64** của toàn bộ file JSON đó. *(Xem Mục 3.1 bên dưới)* | **Khi Backend thực sự cần sử dụng (từ P01)** *(Chỉ cần nhập biến số 10 HOẶC số 11)* |
| 11 | `FIREBASE_SERVICE_ACCOUNT_KEY_PATH` *(Cách 2 - Dùng khi chạy máy cá nhân)* | Server-only | Đường dẫn tới file JSON Service Account lưu trên đĩa cứng máy chủ | Đường dẫn nội bộ tới file `.json` tải từ Firebase Console → Service accounts | Đường dẫn file kết thúc bằng `.json` (VD: `./secrets/service-account.json`). Không dùng nếu đã điền `FIREBASE_SERVICE_ACCOUNT_JSON`. | **Khi Backend thực sự cần sử dụng (từ P01)** *(Chỉ cần nhập biến số 10 HOẶC số 11)* |
| 12 | `SUPERADMIN_BOOTSTRAP_EMAIL` | Server-only | Email duy nhất được phép nhận quyền `superadmin` khi đăng nhập Google đã xác minh | Đặc tả gốc trong file Word dự án BUGZ | Địa chỉ email hợp lệ. Mặc định: `minhquantran4312@gmail.com` | **Khi Backend thực sự cần sử dụng (từ P01)** |
| 13 | `MQTT_ADAPTER_MODE` | Server / Bridge | Chọn cơ chế kết nối giữa MQTT Broker và Backend | Tự chọn theo kiến trúc hạ tầng Broker thực tế (Mục 10 Artifact) | Chỉ chấp nhận đúng 1 trong 2 chuỗi: `"webhook_https"` (mặc định) hoặc `"node_worker"`. *(Xem Mục 3.2 bên dưới)* | **P03** |
| 14 | `MQTT_BROKER_URL` | Server / Bridge | Địa chỉ kết nối MQTT Broker (có TLS) | Trang quản trị MQTT Broker (EMQX Cloud, HiveMQ Cloud, Mosquitto TLS...) | URL có tiền tố giao thức và cổng, ví dụ: `mqtts://broker-host.example.com:8883` hoặc `wss://broker-host.example.com:8084/mqtt` | **P03** |
| 15 | `MQTT_WEBHOOK_SHARED_SECRET` | Server-only (Secret) | Chuỗi bí mật để Backend xác thực gói tin do Broker Rule Engine đẩy vào `POST /api/ingest/mqtt` | Tự tạo chuỗi ngẫu nhiên độ dài >= 32 ký tự và cấu hình khớp vào Header `x-mqtt-bridge-secret` trên Rule Engine của Broker | Chuỗi ký tự ngẫu nhiên (Hex/Base64, >= 32 ký tự). *(Bắt buộc khi `MQTT_ADAPTER_MODE="webhook_https"`)* | **P03** |
| 16 | `MQTT_PUBLISH_API_URL` | Server-only | HTTP REST Endpoint của Broker để Backend phát lệnh bật/tắt giám sát xuống topic `bugz/v1/devices/{id}/commands` | Tài liệu HTTP Publish API của MQTT Broker đang dùng (VD: EMQX REST API `/api/v5/publish`) | URL HTTPS đầy đủ (VD: `https://<broker-api-host>/api/v5/publish`). *(Bắt buộc khi `MQTT_ADAPTER_MODE="webhook_https"`)* | **P03** |
| 17 | `MQTT_PUBLISH_API_TOKEN` | Server-only (Secret) | Khóa xác thực (API Key / Bearer / Basic token) khi Backend gọi `MQTT_PUBLISH_API_URL` | Trang quản trị API Keys trên MQTT Broker Console | Chuỗi token xác thực theo chuẩn Broker. *(Bắt buộc khi `MQTT_ADAPTER_MODE="webhook_https"`)* | **P03** |
| 18 | `MQTT_BRIDGE_USERNAME` | Bridge Worker | Tên đăng nhập MQTT dành riêng cho Node Bridge Worker | Trang quản trị Authentication/Credentials trên MQTT Broker | Chuỗi username (VD: `bugz-bridge-worker`). *(Chỉ bắt buộc khi `MQTT_ADAPTER_MODE="node_worker"`)* | **P03** |
| 19 | `MQTT_BRIDGE_PASSWORD` | Bridge Worker (Secret) | Mật khẩu MQTT của Node Bridge Worker | Trang quản trị Authentication/Credentials trên MQTT Broker | Chuỗi mật khẩu bảo mật. *(Chỉ bắt buộc khi `MQTT_ADAPTER_MODE="node_worker"`)* | **P03** |
| 20 | `VITE_FIREBASE_STORAGE_BUCKET` | Client (Public) | Tên Bucket Cloud Storage phía client | Firebase Console → Storage → tên bucket (`gs://...` bỏ phần `gs://`) | Chuỗi dạng `<project-id>.firebasestorage.app` hoặc `<project-id>.appspot.com` | **P03** |
| 21 | `FIREBASE_STORAGE_BUCKET` | Server-only | Tên Bucket Cloud Storage để Backend cấp Signed URL tải/xem ảnh capture riêng tư | Cùng giá trị với `VITE_FIREBASE_STORAGE_BUCKET` | Chuỗi dạng `<project-id>.firebasestorage.app` hoặc `<project-id>.appspot.com` | **P03** |
| 22 | `VITE_FIREBASE_MESSAGING_SENDER_ID` | Client (Public) | Mã Sender ID cho Firebase Cloud Messaging (Web Push) | Firebase Console → Project Settings → Cloud Messaging → `Sender ID` | Chuỗi chữ số (VD: `123456789012`) | **P04** |
| 23 | `VITE_FIREBASE_VAPID_KEY` | Client (Public) | Khóa công khai Web Push (VAPID Public Key) để trình duyệt đăng ký nhận thông báo | Firebase Console → Project Settings → Cloud Messaging → Web configuration → Web Push certificates → `Key pair` | Chuỗi Base64URL dài khoảng 87 ký tự bắt đầu bằng `B...` | **P04** |
| 24 | `EMAIL_PROVIDER` | Server-only | Chọn phương thức gửi email cảnh báo và yêu cầu chứng nhận Ngày 28 | Tự chọn theo dịch vụ email hiện có | Chỉ chấp nhận đúng 1 trong 3 chuỗi: `"smtp"`, `"resend"`, hoặc `"sendgrid"`. *(Xem Mục 3.3 bên dưới)* | **P04** |
| 25 | `EMAIL_FROM_ADDRESS` | Server-only | Địa chỉ người gửi hiển thị trong email gửi tới phụ huynh/Admin | Địa chỉ/tên miền đã xác minh trên dịch vụ SMTP, Resend hoặc SendGrid | Địa chỉ email chuẩn `no-reply@ten-mien.com` hoặc `BUGZ BrightUpGenZ <no-reply@ten-mien.com>` | **P04** |
| 26 | `SMTP_HOST` | Server-only | Máy chủ SMTP gửi thư đi | Nhà cung cấp email (Gmail App Password, Amazon SES SMTP, Brevo, Mailgun...) | Tên miền máy chủ SMTP (VD: `smtp.gmail.com` hoặc `smtp-relay.brevo.com`). *(Bắt buộc khi `EMAIL_PROVIDER="smtp"`)* | **P04** |
| 27 | `SMTP_PORT` | Server-only | Cổng kết nối máy chủ SMTP | Nhà cung cấp SMTP | Số nguyên dạng chuỗi: `"587"` (STARTTLS) hoặc `"465"` (TLS). *(Bắt buộc khi `EMAIL_PROVIDER="smtp"`)* | **P04** |
| 28 | `SMTP_USER` | Server-only | Tài khoản đăng nhập máy chủ SMTP | Nhà cung cấp SMTP | Chuỗi tên đăng nhập/email SMTP. *(Bắt buộc khi `EMAIL_PROVIDER="smtp"`)* | **P04** |
| 29 | `SMTP_PASS` | Server-only (Secret) | Mật khẩu hoặc App Password của tài khoản SMTP | Nhà cung cấp SMTP (nếu dùng Gmail phải tạo App Password 16 ký tự, không dùng mật khẩu tài khoản chính) | Chuỗi mật khẩu SMTP. *(Bắt buộc khi `EMAIL_PROVIDER="smtp"`)* | **P04** |
| 30 | `EMAIL_API_KEY` | Server-only (Secret) | API Key gửi email qua HTTPS REST API khi không dùng SMTP | Bảng điều khiển Resend (`re_...`) hoặc SendGrid (`SG....`) | Chuỗi API Key của nhà cung cấp. *(Chỉ bắt buộc khi `EMAIL_PROVIDER="resend"` hoặc `"sendgrid"`)* | **P04** |

---

## 3. Quy định Định dạng Chi tiết từ Mã nguồn (`src/domain/envContract.ts`)

### 3.1 Định dạng `FIREBASE_SERVICE_ACCOUNT_JSON` và `FIREBASE_SERVICE_ACCOUNT_KEY_PATH`
Hàm `validateServiceAccountConfig` trong `src/domain/envContract.ts` chấp nhận **1 trong 2** cách cấu hình sau (khi Backend thực sự cần gọi Firebase Admin SDK):

- **Cách 1 (Khuyên dùng trên AI Studio Secrets / Cloud Run): `FIREBASE_SERVICE_ACCOUNT_JSON`**
  - **Định dạng A (Single-line JSON):** Toàn bộ nội dung file JSON tải về từ Firebase Console được gom thành 1 dòng duy nhất, giữ nguyên chuỗi `\n` bên trong trường `private_key`.
    - Cấu trúc bắt buộc phải có 3 khóa: `"project_id"`, `"client_email"`, `"private_key"` (chứa `"-----BEGIN PRIVATE KEY-----"`).
  - **Định dạng B (Base64-encoded JSON):** Mã hóa Base64 toàn bộ file `.json` (tránh mọi lỗi ký tự xuống dòng hoặc dấu ngoặc kép khi dán vào ô cấu hình biến môi trường). Hệ thống tự động nhận diện nếu chuỗi không bắt đầu bằng `{` thì sẽ giải mã `Buffer.from(value, 'base64').toString('utf8')` trước khi `JSON.parse`.
- **Cách 2 (Dùng khi chạy máy local có file trên ổ đĩa): `FIREBASE_SERVICE_ACCOUNT_KEY_PATH`**
  - Nhập đường dẫn tương đối hoặc tuyệt đối trỏ tới file có đuôi `.json` (ví dụ: `./service-account.json`).

### 3.2 Các giá trị được hỗ trợ của `MQTT_ADAPTER_MODE`
Hàm `validateMqttAdapterMode` chỉ chấp nhận đúng **2 giá trị**:
1. `"webhook_https"` *(Mặc định)*:
   - Phù hợp với môi trường serverless / Cloud Functions / Cloud Run.
   - Yêu cầu đi kèm ở chặng **P03**: `MQTT_BROKER_URL`, `MQTT_WEBHOOK_SHARED_SECRET`, `MQTT_PUBLISH_API_URL`, `MQTT_PUBLISH_API_TOKEN`.
2. `"node_worker"`:
   - Phù hợp khi chạy tiến trình Node Bridge duy trì kết nối TCP/TLS liên tục tới Broker.
   - Yêu cầu đi kèm ở chặng **P03**: `MQTT_BROKER_URL`, `MQTT_BRIDGE_USERNAME`, `MQTT_BRIDGE_PASSWORD`.

### 3.3 Các giá trị được hỗ trợ của `EMAIL_PROVIDER`
Hàm `validateEmailProvider` chỉ chấp nhận đúng **3 giá trị**:
1. `"smtp"` *(Mặc định)*:
   - Yêu cầu đi kèm ở chặng **P04**: `EMAIL_FROM_ADDRESS`, `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`.
2. `"resend"`:
   - Gửi qua HTTPS API của Resend. Yêu cầu đi kèm ở chặng **P04**: `EMAIL_FROM_ADDRESS`, `EMAIL_API_KEY`.
3. `"sendgrid"`:
   - Gửi qua HTTPS API của SendGrid. Yêu cầu đi kèm ở chặng **P04**: `EMAIL_FROM_ADDRESS`, `EMAIL_API_KEY`.
