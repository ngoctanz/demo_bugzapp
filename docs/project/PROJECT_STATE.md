# Trạng thái Dự án (PROJECT_STATE.md) — BUGZ BrightUpGenZ

- **Chặng hiện tại**: **Đã hoàn tất Chặng P06 (Kiểm thử nghiệm thu đầu–cuối `T01`–`T30`, Kiểm toán 10 Rào chắn P0, Đo độ trễ 20 mẫu, Sao lưu/Khôi phục/Reset Demo, Đóng gói PWA/Hosting/Rules & Tài liệu Nộp bài)** trên cùng dự án xuyên suốt.
- **Ngày cập nhật**: 03/11/2026
- **Dự án Firebase đích**: `gen-lang-client-0531599250` (`asia-southeast1`)
- **Chặng tiếp theo**: **Sẵn sàng Thuyết trình & Demo 6 Phút / Chủ dự án chạy lệnh CLI trong `DEPLOY_FIREBASE.md` để xuất bản lên Firebase Hosting & mở 3 tích hợp ngoài (`T01`, `T21`, `T24`)**.

---

## 1. Tóm tắt Lịch sử Hoàn thành Xuyên suốt (`P00` → `P06`)

| Chặng | Nội dung Trọng tâm | Trạng thái | Kiểm thử Tự động |
| :--- | :--- | :--- | :--- |
| **P00** | Khởi tạo kiến trúc Full-Stack (React 19 + TypeScript + Express `server.ts`), khóa hợp đồng schema RTDB (`firebase_schema_contract.json`), nạp manifest nguồn (`source_manifest.json`, `content_days_manifest.json`). | **HOÀN TẤT** | Suite `#1–#7` PASS |
| **P01** | Firebase Authentication, Bootstrap SuperAdmin 1 lần phía server (`minhquantran4312@gmail.com,tamtranmusic@gmail.com`), RBAC 3 vai trò (`superadmin`, `guardian`, `student`), `database.rules.json` (15 quy tắc), mã mời 1 lần & ghép nối thiết bị chống chiếm quyền. | **HOÀN TẤT** | Suite `#8–#13` PASS (`T01`–`T04`, `T10`) |
| **P02** | Module Học & Thực hành 28 ngày (`/learn`) từ ảnh rời gốc Google Drive (`day1.png`–`day28.png`, `in4 d*.png`, `HC d*.png`), nút bóng đèn & huy chương idempotent, luồng chứng nhận Ngày 28 (không có Ngày 29), Thư viện Flashcard/Báo chí/Đội ngũ/Chứng nhận với hotspot khớp khung viền 100%, Admin CMS chặn xuất bản Ngày 27/28 thiếu ảnh `in4`. | **HOÀN TẤT** | Suite `#14` PASS (`T05`–`T09`, `T28`) |
| **P03** | Tích hợp Robot MQTT qua HTTPS Webhook Bridge (`/api/mqtt/webhook/ingest`), một nơi duy nhất tính đợt ổn định (`server_bridge_episode_engine`), tách lệnh `monitoring_enabled` và `monitoring_active` (ACK), 4 trạng thái `good\|bad\|absent\|unknown`, chống trùng QoS1 + Outbox crash recovery, bảo vệ ảnh capture riêng tư, lọc lịch sử theo múi giờ Việt Nam. | **HOÀN TẤT** | Suite `#15–#18` PASS (`T11`–`T19`, `T25`) |
| **P04** | Pipeline thông báo đa kênh định tuyến từ `device -> session -> server_student_id -> guardian/student -> preferences`, chống trùng Listener + FCM Push theo `alert_id`, Active-Page Voice có nút Nghe lại và lời nhắc tích cực, Notification Job state machine (`queued`, `accepted_by_provider`, `suppressed_quiet_hours`, `failed`), dọn token khi đổi tài khoản (`T29`). | **HOÀN TẤT** | Suite `#19–#21` PASS (`T20`–`T24`, `T29`) |
| **P05** | Module Trò chơi Rèn luyện 3 kiểu tương tác (`/games`, `situations`, `desk_builder`, `habit_relay`), nhập 40 câu seed (`question_bank.json`, 20 Lưng thẳng + 20 Mắt sáng) qua Admin Dry-Run & Import, tách `questions_public` (không lộ đáp án) và `question_keys` (chỉ server đọc), chấm điểm server chống cộng điểm lặp, tách biệt tuyệt đối 3 chỉ số. | **HOÀN TẤT** | Suite `#22–#23` PASS (`T26`–`T28`) |
| **P06** | Ma trận nghiệm thu đầu–cuối 30 ca (`T01`–`T30`) & 10 Rào chắn P0 (`/integration-status`), đo độ trễ 20 mẫu (`p95 = 2.092ms <= 5000ms`), Sao lưu/Khôi phục/Reset dữ liệu Demo chuẩn, gia cố PWA Service Worker (`public/sw.js` chống cache dữ liệu riêng tư), `storage.rules`, `firebase.json`, `DEPLOY_FIREBASE.md`, `README.md`, kịch bản Demo 6 phút & gói mã nguồn sạch. | **HOÀN TẤT** | Suite `#24–#25` PASS (`25/25` tổng) |

---

## 2. Danh mục File Đã Tạo / Cập nhật trong Chặng P06

1. **Ma trận Nghiệm thu `T01`–`T30`, Kiểm toán 10 Rào chắn P0 & Kịch bản Demo 6 Phút**:
   - `src/domain/p06AcceptanceMatrix.ts`: Định nghĩa đầy đủ 30 ca kiểm thử `T01`–`T30` (tách bạch `codeAndSandboxStatus: 'PASS'` và `liveExternalStatus: 'PASS' | 'BLOCKED'`), 10 mục kiểm toán bảo mật P0 (`P0-01`..`P0-10`), kịch bản Demo 6 phút có gắn nhãn nguồn (`REAL_CONTENT`, `REAL_OR_SIMULATOR`, `SERVER_RBAC`), và hàm kiểm tra rò rỉ khóa bí mật `verifyNoSecretsLeakedReport`.
2. **Đo Độ trễ Kỹ thuật 20 Mẫu & Sao lưu / Khôi phục / Reset Demo**:
   - `src/domain/p01RbacStore.ts`: Bổ sung `exportDemoBackupSnapshot` (tự động ẩn `secret_hash` của thiết bị), `restoreDemoBackupSnapshot`, `resetCleanDemoState`, và `runIngestLatencyBenchmark20Samples` (đo 20 chu kỳ liên tiếp từ gói MQTT hợp lệ → Bridge FSM → Outbox → Projection → tạo Alert/Notification Job).
   - `server.ts`: Bổ sung các API:
     - `GET /api/system/p06-verification-matrix`
     - `POST /api/system/benchmark-latency`
     - `GET /api/admin/demo/backup` (chỉ SuperAdmin)
     - `POST /api/admin/demo/restore` (chỉ SuperAdmin)
     - `POST /api/admin/demo/reset` (chỉ SuperAdmin)
3. **Giao diện Trung tâm Nghiệm thu P06 (`/integration-status`)**:
   - `src/pages/LibraryAndSystemPages.tsx` & `src/components/AppShell.tsx`: Nâng cấp toàn diện trang `/integration-status` với bảng điều khiển **Reset Dữ liệu Demo Sạch**, **Xuất & Tải JSON Backup**, **Khôi phục từ JSON**, nút chạy trực tiếp **Phép đo Độ trễ 20 Mẫu (`p95 <= 5000ms`)**, **10 Rào chắn P0**, **Bảng Đối chiếu 30 Ca Kiểm thử `T01`–`T30` có bộ lọc**, và **Kịch bản Thuyết trình 6 Phút**.
4. **Gia cố PWA, Firebase Hosting, Cloud Storage Rules & Chống Cache Riêng tư (`T29`, `T30`)**:
   - `public/sw.js` (`bugz-shell-v1.6.0`): Loại trừ tuyệt đối `/api/*`, `/captures/*`, `*.firebaseio.com`, `*.firebasedatabase.app`, `*.firebasestorage.app`, `*.googleapis.com` khỏi bộ nhớ đệm Service Worker; hỗ trợ thông điệp `BUGZ_CLEAR_PRIVATE_CACHES` khi đăng xuất hoặc đổi tài khoản.
   - `src/context/AuthContext.tsx`: Gửi `BUGZ_CLEAR_PRIVATE_CACHES` tới Service Worker ngay khi đăng xuất hoặc chuyển đổi tài khoản.
   - `public/apple-touch-icon.png`, `public/pwa-192x192.png`, `public/pwa-512x512.png`, `public/pwa-maskable-512x512.png`: Tạo đầy đủ bộ icon PNG chuẩn PWA từ `public/assets/drive/logo1.png`.
   - `storage.rules`: Khóa mặc định (`allow read, write: if false`), bảo vệ nhánh `captures/{deviceId}/{sessionId}/{captureId}` (chặn client đọc trực tiếp, giới hạn `image/jpeg|png|webp` và `<= 2MB`).
   - `firebase.json`: Khai báo đầy đủ `database`, `storage`, và `hosting` (SPA rewrite, `/api/**` rewrite về `bugz-api-bridge` vùng `asia-southeast1`, header `no-store` cho `/sw.js`, `/firebase-messaging-sw.js`, `/api/**`).
5. **Tài liệu Triển khai, Đóng gói & Kiểm thử**:
   - `DEPLOY_FIREBASE.md`: Hướng dẫn từng lệnh CLI deploy `database.rules.json`, `storage.rules`, Cloud Run API Bridge và Firebase Hosting.
   - `README.md`: Tài liệu tổng quan cài đặt, chạy, test, kiến trúc RTDB/MQTT, backup/restore, kịch bản demo 6 phút và danh mục chờ cấu hình ngoài.
   - `scripts/p06ReleaseTools.ts`: Tạo tự động `docs/project/DEMO_BACKUP_SEED_P06.json`, `docs/project/CHECKPOINT_P06.json` và gói mã nguồn sạch `docs/project/BUGZ_BrightUpGenZ_P06_Clean_Source.tar.gz` (không chứa `.env`, `node_modules`, `.git`, hoặc khóa bí mật).
   - `src/domain/rtdbRulesAndRbac.test.ts`: Bổ sung Suite `#24` và `#25` kiểm tra tự động toàn bộ yêu cầu P06.

---

## 3. Kết quả Kiểm thử & Đo lường Kỹ thuật Chặng P06

- **Kiểm thử Đơn vị & Bảo mật (`npm test`)**: **25 / 25 test suites PASS (100%)** trong `845ms`.
- **Kiểm tra Kiểu dữ liệu (`npm run lint`)**: **0 lỗi TypeScript**.
- **Build Production (`npm run build`)**: **PASS** (`dist/` sẵn sàng cho Firebase Hosting).
- **Đo Độ trễ Kỹ thuật 20 Mẫu (`runIngestLatencyBenchmark20Samples`)**:
  - Số mẫu: `20` chu kỳ liên tiếp (gói MQTT hợp lệ → Bridge FSM → Outbox → Projection → tạo Alert & Notification Job).
  - Kết quả: `min = 0.121ms`, `median (p50) = 0.182ms`, **`p95 = 2.092ms`**, `max = 2.179ms` — **ĐẠT mục tiêu SLA kỹ thuật `p95 <= 5000ms`** (Mục 17 Artifact).
- **Kiểm tra Đa Khung hình (`T30` Multi-Viewport Browser Audit)**:
  - Đã xác minh trên Chromium ở 5 kích thước: `360×800`, `390×844`, `768×1024`, `1024×768`, và `1440×900` (`scrollWidth <= clientWidth`, không tràn ngang, 0 lỗi console).
- **Kiểm tra Không lộ Secret & Tối ưu Dung lượng Git/GitHub (`T30` & Quyết định #03)**:
  - `ExposedSecretVarsCount = 0`; gói `/tmp/BUGZ_BrightUpGenZ_P06_Clean_Source.tar.gz` và `docs/project/DEMO_BACKUP_SEED_P06.json` đã được lọc sạch mọi khóa bí mật.
  - Toàn bộ 111 file ảnh/âm thanh gốc từ Google Drive và ảnh Atlas trò chơi được định tuyến qua `src/data/driveAssetRegistry.ts` + `server.ts` (`/tmp/bugz-assets-cache`), loại bỏ 100% file ảnh nhị phân khỏi kho mã nguồn (giảm dung lượng repo từ ~195 MB xuống ~2.1 MB để push lên GitHub tức thì).

