# Hướng dẫn Triển khai Thực tế Firebase & Backend Bridge — BUGZ BrightUpGenZ (P06)

Phiên bản: `P06-v1.0` · Ngày cập nhật: `03/11/2026`  
Dự án Firebase đích: **`gen-lang-client-0531599250`** (`asia-southeast1`)  
Realtime Database URL: `https://gen-lang-client-0531599250-default-rtdb.asia-southeast1.firebasedatabase.app`  
Cloud Storage Bucket: `gen-lang-client-0531599250.firebasestorage.app`

---

## 1. Phân biệt rõ: Nút Deploy Cloud Run của AI Studio vs. Bản nộp Firebase Hosting / Rules / Functions

> **QUY TẮC BẮT BUỘC (Mục 7 Instruction & Mục 15 Artifact):**
> - Nút **Deploy** trên giao diện AI Studio chỉ đóng gói container Node.js (`server.ts` + `dist/`) lên **Cloud Run** (`ais-pre-...run.app`).
> - Việc bấm nút Deploy của AI Studio **KHÔNG** tự động:
>   1. Deploy `database.rules.json` lên Firebase Realtime Database.
>   2. Deploy `storage.rules` lên Cloud Storage for Firebase.
>   3. Deploy tĩnh `dist/` lên **Firebase Hosting** (`gen-lang-client-0531599250.web.app`).
>   4. Tự động chuyển các biến môi trường (Secrets) từ AI Studio sang Firebase Functions / Cloud Run production nếu người chủ project chưa khai báo.

Tài liệu này cung cấp đúng chuỗi lệnh CLI và cấu hình khớp 100% với mã nguồn hiện tại (`firebase.json`, `database.rules.json`, `storage.rules`, `server.ts`) để chủ dự án (`minhquantran4312@gmail.com` / `tamtranmusic@gmail.com`) thực thi trên máy trạm có quyền Firebase Owner/Editor.

---

## 2. Cấu trúc File Cấu hình Firebase trong Repository

| File trong Repo | Vai trò thực tế | Trạng thái |
| :--- | :--- | :--- |
| `firebase.json` | Khai báo `database` (`database.rules.json`), `storage` (`storage.rules`) và `hosting` (`public: "dist"`, SPA rewrite `** -> /index.html`, proxy `/api/**` tới Cloud Run service `bugz-api-bridge` tại `asia-southeast1`, header `no-store` cho `/sw.js`, `/firebase-messaging-sw.js`, `/api/**`). | Đã khớp mã nguồn |
| `database.rules.json` | Security Rules cho **Firebase Realtime Database** (Default deny `false`, khóa 4 nhánh gốc `users`, `devices`, `sessions`, `alerts` và các nhánh mở rộng; chặn client tự nâng quyền `role`, tự đổi `user_id` thiết bị, tự ghi kết quả Robot hoặc tự cộng điểm game). | Đã kiểm chứng 15/15 rule tests |
| `storage.rules` | Security Rules cho **Cloud Storage** (`captures/{deviceId}/{sessionId}/{captureId}` chặn client đọc trực tiếp, giới hạn MIME `image/jpeg\|png\|webp` và kích thước `<= 2MB`; ảnh chỉ mở qua signed URL từ `/api/captures/view-url` sau khi kiểm tra RBAC). | Đã tạo & kiểm tra |
| `.env.example` | Danh mục đầy đủ các biến môi trường client (`VITE_*`) và server (`FIREBASE_*`, `MQTT_*`, `SMTP_*`, `FCM_*`). Không chứa bất kỳ khóa bí mật thật nào. | Đã kiểm tra T30 |

---

## 3. Các bước do Chủ Dự án thực hiện trên Google Cloud / Firebase Console

Trước khi chạy lệnh deploy, người có quyền quản trị project `gen-lang-client-0531599250` cần xác nhận 5 thiết lập Console sau:

1. **Firebase Authentication → Settings → Authorized domains**:
   - Thêm domain chạy thật:
     - `gen-lang-client-0531599250.web.app`
     - `gen-lang-client-0531599250.firebaseapp.com`
     - `ais-dev-cpvxdfw7ppcnylrbqrv7t6-716862869640.asia-southeast1.run.app`
     - `ais-pre-cpvxdfw7ppcnylrbqrv7t6-716862869640.asia-southeast1.run.app`
   - Bật Sign-in method: **Google** (và **Email/Password** nếu dùng tài khoản test học sinh).
2. **Project Settings → Service Accounts**:
   - Tạo khóa JSON cho Firebase Admin SDK và nạp vào biến môi trường server `FIREBASE_SERVICE_ACCOUNT_JSON` (tuyệt đối không commit file JSON vào Git hoặc đặt tiền tố `VITE_`).
3. **Project Settings → Cloud Messaging → Web configuration**:
   - Tạo **Web Push certificate (VAPID key pair)** và điền public key vào biến `VITE_FIREBASE_VAPID_KEY`.
4. **MQTT Broker (EMQX / HiveMQ Cloud TLS 8883)**:
   - Tạo tài khoản thiết bị từng Robot (`robot-bugz-01`), bật ACL chỉ cho phép thiết bị publish `bugz/robot/{device_id}/+` và subscribe `bugz/robot/{device_id}/command/+`.
   - Cấu hình Webhook HTTPS từ Broker trỏ tới `POST https://<DOMAIN>/api/mqtt/webhook/ingest` kèm header `x-mqtt-webhook-secret: <MQTT_WEBHOOK_SECRET>`.
5. **Email Provider (SMTP / Transactional Email)**:
   - Khai báo `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `ALERT_EMAIL_FROM` trên môi trường chạy `server.ts`.

---

## 4. Quy trình Build, Kiểm thử & Deploy Từng phần bằng CLI

### Bước 4.1. Cài đặt & Kiểm thử trước khi Deploy (Pre-flight Check)

```bash
# 1. Cài đặt dependencies
npm ci

# 2. Chạy toàn bộ 25 bộ unit test & kiểm tra bảo mật (T01..T30, RBAC, MQTT, P04, P05, P06)
npm test

# 3. Kiểm tra TypeScript (0 lỗi)
npm run lint

# 4. Build gói production frontend vào thư mục dist/
npm run build

# 5. Tạo/cập nhật gói Demo Backup Seed & Checkpoint P06
npx tsx scripts/p06ReleaseTools.ts
```

### Bước 4.2. Đăng nhập Firebase CLI & Chọn đúng Project

```bash
npx firebase-tools login
npx firebase-tools use gen-lang-client-0531599250
```

### Bước 4.3. Deploy Realtime Database Rules & Cloud Storage Rules

```bash
# Deploy chỉ Realtime Database Security Rules (database.rules.json)
npx firebase-tools deploy --only database --project gen-lang-client-0531599250

# Deploy chỉ Cloud Storage Security Rules (storage.rules)
npx firebase-tools deploy --only storage --project gen-lang-client-0531599250
```

### Bước 4.4. Deploy Backend API & MQTT Webhook Bridge (`bugz-api-bridge`) lên Cloud Run (`asia-southeast1`)

Vì `firebase.json` định tuyến `/api/**` về dịch vụ `bugz-api-bridge` tại vùng `asia-southeast1`, triển khai backend Express (`server.ts`) bằng Google Cloud CLI:

```bash
gcloud run deploy bugz-api-bridge \
  --source . \
  --region asia-southeast1 \
  --project gen-lang-client-0531599250 \
  --allow-unauthenticated \
  --set-env-vars="NODE_ENV=production,FIREBASE_PROJECT_ID=gen-lang-client-0531599250,FIREBASE_DATABASE_URL=https://gen-lang-client-0531599250-default-rtdb.asia-southeast1.firebasedatabase.app,FIREBASE_STORAGE_BUCKET=gen-lang-client-0531599250.firebasestorage.app,SUPERADMIN_BOOTSTRAP_EMAIL=minhquantran4312@gmail.com,tamtranmusic@gmail.com,MQTT_ADAPTER_MODE=webhook_https"
```

*(Lưu ý: Bổ sung `--set-secrets` từ Google Secret Manager cho `FIREBASE_SERVICE_ACCOUNT_JSON`, `MQTT_WEBHOOK_SECRET`, `SMTP_PASS` để bảo mật khóa bí mật).*

### Bước 4.5. Deploy Frontend PWA lên Firebase Hosting

```bash
# Đảm bảo đã chạy npm run build để có thư mục dist/ mới nhất
npm run build

# Deploy lên Firebase Hosting
npx firebase-tools deploy --only hosting --project gen-lang-client-0531599250
```

---

## 5. Chạy Script Bootstrap SuperAdmin Một Lần & Nhập Ngân hàng Câu hỏi

Sau khi Backend đã kết nối Admin SDK:

1. **Bootstrap SuperAdmin**:
   - Đăng nhập bằng Google với email `minhquantran4312@gmail.com` hoặc `tamtranmusic@gmail.com`.
   - Gọi `POST /api/auth/bootstrap-superadmin` (hoặc bấm nút **"Xác minh & Cấp quyền SuperAdmin"** tại `/admin`). Backend đối chiếu `SUPERADMIN_BOOTSTRAP_EMAIL` + `email_verified == true` trước khi cấp custom claim `role='superadmin'` và ghi `users/{uid}/role = 'superadmin'`.
2. **Import & Duyệt Ngân hàng 40 câu hỏi (Chặng P05)**:
   - Tại `/admin` → khu vực **Quản trị Ngân hàng Câu hỏi & Trò chơi (P05)**:
     - Bấm **Dry-Run Kiểm tra Seed (40 câu)** để xác nhận 20 câu `posture` + 20 câu `eyes` hợp lệ.
     - Bấm **Import Bản thảo (`editorial_draft`)** vào nhánh `question_bank_admin`.
     - Bấm **Duyệt & Xuất bản 40 câu sang `questions_public`** (tự động tách lời giải/đáp án đúng sang `question_answers_server` để không lộ đáp án cho trình duyệt).

---

## 6. Quy trình Sao lưu (Backup), Khôi phục (Restore) và Reset Dữ liệu Demo trước Giờ Thi

SuperAdmin có thể thực hiện ngay trên giao diện **`/integration-status`** (mục **Sao lưu / Khôi phục / Reset Dữ liệu Demo Chuẩn P06**) hoặc qua API/CLI:

- **Tải bản chụp JSON hiện tại**:
  - Giao diện: Bấm **"Xuất & Tải JSON Backup"** tại `/integration-status`.
  - API: `GET /api/admin/demo/backup` (với header `x-bugz-uid: uid-superadmin-01` hoặc Bearer ID Token của SuperAdmin).
- **Reset về trạng thái Demo sạch (trước mỗi lượt thuyết trình 6 phút)**:
  - Giao diện: Bấm **"Reset Dữ liệu Demo Sạch"** tại `/integration-status`.
  - API: `POST /api/admin/demo/reset` — khôi phục sạch hồ sơ mẫu (`stu-a1` Bé Minh, `stu-a2` Bé An), thiết bị `robot-bugz-01`, phiên mẫu, 28 ngày học và 40 câu hỏi đã duyệt mà không phải khởi động lại server.
- **Khôi phục từ file `docs/project/DEMO_BACKUP_SEED_P06.json`**:
  - API: `POST /api/admin/demo/restore` với body `{ "snapshot": <nội dung JSON> }`.
