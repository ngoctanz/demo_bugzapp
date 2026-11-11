# Nhật ký Quyết định Dự án (`DECISION_LOG.md`)

Tài liệu này lưu lại các quyết định điều chỉnh chính thức từ Chủ dự án theo quy tắc trong `BUGZ_PROJECT_INSTRUCTIONS.md`:
> *"Khi chủ dự án yêu cầu thay đổi, ghi quyết định và tác động vào tài liệu quyết định dự án, không âm thầm thay công nghệ hoặc nội dung."*

---

## Quyết định #01 — Bổ sung Email SuperAdmin Bootstrap của Chủ dự án (`tamtranmusic@gmail.com`)

- **Ngày ghi nhận:** 02/11/2026
- **Người yêu cầu:** Chủ dự án (`tamtranmusic@gmail.com`)
- **Nội dung quyết định:**
  - Bổ sung tài khoản `tamtranmusic@gmail.com` làm SuperAdmin bên cạnh email gốc trong tài liệu (`minhquantran4312@gmail.com`).
  - Biến cấu hình `SUPERADMIN_BOOTSTRAP_EMAIL` hỗ trợ danh sách email phân tách bằng dấu phẩy: `"minhquantran4312@gmail.com,tamtranmusic@gmail.com"`.
- **Tác động kỹ thuật & Bảo mật:**
  - Giữ nguyên toàn bộ cơ chế bảo mật phía Backend: chỉ cấp quyền `superadmin` khi ID Token đã được xác minh (`email_verified === true`) và email khớp danh sách cho phép trên Server. Tuyệt đối không cấp quyền bằng điều kiện email ở phía trình duyệt.
  - Giữ nguyên tài khoản `minhquantran4312@gmail.com` để toàn bộ ca kiểm thử `T02` theo đặc tả gốc tiếp tục PASS.
  - Bổ sung tài khoản mẫu `uid-superadmin-02` (`tamtranmusic@gmail.com`) vào `P01RbacDomainService` và `SANDBOX_PRESET_ACTORS` để Chủ dự án có thể kiểm thử ngay trên cả chế độ Google Sign-In thật lẫn Emulator Sandbox.

---

## Quyết định #02 — Chuẩn hóa Script Bootstrap SuperAdmin Server-Side Gán Custom Claim `'admin'` & Khóa Bảo Mật Chạy 1 Lần (Run-Once Lock)

- **Ngày ghi nhận:** 02/11/2026
- **Người yêu cầu:** Chủ dự án (`tamtranmusic@gmail.com`)
- **Nội dung quyết định:**
  - Xây dựng script server-side độc lập (`scripts/bootstrapSuperAdmin.ts`, chạy qua `npm run bootstrap:superadmin`) sử dụng Firebase Admin SDK để kiểm tra `SUPERADMIN_BOOTSTRAP_EMAIL`, gán custom claim `'admin'` (`{ admin: true, superadmin: true, role: 'superadmin' }`) trên Firebase Authentication và khóa vĩnh viễn tại `system_locks/superadmin_bootstrap` để chỉ chạy đúng một lần duy nhất.
- **Tác động kỹ thuật & Bảo mật:**
  - `database.rules.json`, `src/context/AuthContext.tsx` và `server.ts` chấp nhận cả `token.admin === true` lẫn `token.superadmin === true`, đảm bảo tương thích ngược hoàn toàn với toàn bộ ca kiểm thử `T01–T04`.
  - Nhánh `system_locks/superadmin_bootstrap` trên Realtime Database có `.write: false` đối với mọi client và sử dụng transaction nguyên tử phía Admin SDK để chặn mọi lần chạy lặp lại (`409 BOOTSTRAP_ALREADY_EXECUTED_ONCE`).

---

## Quyết định #03 — Lưu trữ Tài nguyên Hình ảnh & Âm thanh Ngoài Kho Mã nguồn (Out-of-Repo Cloud & `/tmp` Cache Resolver) Để Đẩy Lên GitHub

- **Ngày ghi nhận:** 06/11/2026
- **Người yêu cầu:** Chủ dự án (`tamtranmusic@gmail.com`)
- **Nội dung quyết định:**
  - Tuyệt đối không lưu các file hình ảnh/âm thanh/nén nhị phân (`public/assets/drive/*` 72MB, `public/assets/aistudio/*` 13MB, `public/assets/runtime/*` 4.7MB, `inputs/full_flashcard.png` 4.7MB, `public/assets/bugz_learning_atlas.png` 2.1MB) trực tiếp trong thư mục mã nguồn dự án để tránh làm nặng kho Git và lỗi khi push lên GitHub.
  - Cấu hình `src/data/driveAssetRegistry.ts` lưu bảng ánh xạ chuẩn 111 file gốc từ thư mục Google Drive của dự án (`17jX1J0xhyvYG5lfKrTMu6fdViTQsg9M6`) và bổ sung bộ định tuyến **Cloud & Out-of-Repo Asset Resolver** trong `server.ts` (`/assets/drive/:filename`, `/assets/bugz_learning_atlas.png`, `/apple-touch-icon.png`, `/pwa-*.png`) kết hợp bộ nhớ đệm ngoài repo tại `/tmp/bugz-assets-cache`.
- **Tác động kỹ thuật & Bảo mật:**
  - Giảm dung lượng toàn bộ kho mã nguồn dự án từ **~195 MB** xuống còn **~2.1 MB** (0 file ảnh PNG/JPG/MP3 nhị phân trong repo), giúp push lên GitHub nhanh và không bao giờ vượt giới hạn payload.
  - Giữ nguyên 100% đường dẫn runtime (`/assets/drive/day1.png`..`day28.png`, `/assets/drive/in4%20d*.png`, `/assets/drive/HC%20d*.png`, `/assets/bugz_learning_atlas.png`) để toàn bộ giao diện và 25/25 bộ kiểm thử tự động (`T01`–`T30`) hoạt động nguyên vẹn.

---

## Quyết định #04 — Thay Thế `window.speechSynthesis` Bằng Mô Hình Giọng Nói AI Neural Phía Server (`gemini-3.8-flash-lite-tts` & `google-neural-vi`)

- **Ngày ghi nhận:** 06/11/2026
- **Người yêu cầu:** Chủ dự án (`tamtranmusic@gmail.com`)
- **Nội dung quyết định:**
  - Thay thế hoàn toàn bộ đọc văn bản mặc định của trình duyệt (`window.speechSynthesis` — phát âm tiếng Việt rất thô hoặc sai dấu trên nhiều thiết bị) bằng dịch vụ tổng hợp giọng nói Neural phía Server (`POST /api/tts/synthesize` trong `server.ts` và client `src/lib/voiceTtsClient.ts`).
  - Tích hợp mô hình **`gemini-3.8-flash-lite-tts`** (qua `@google/genai` SDK phía Server với các giọng `Kore`, `Zephyr`, `Puck`) kết hợp tầng dự phòng tự động **`google-neural-vi`** (Giọng Nữ Tiếng Việt Neural tự nhiên, rõ dấu, độ trễ thấp) và bộ nhớ đệm `/tmp/bugz-tts-cache` ngoài kho Git.
- **Tác động kỹ thuật & Bảo mật:**
  - Khóa `GEMINI_API_KEY` tuyệt đối chỉ dùng phía Server (`server.ts`), không lộ xuống trình duyệt.
  - Giữ nguyên toàn bộ quy tắc kiểm soát Active-Page Voice (`T23`: chỉ tự phát khi tab đang hiển thị `visibilityState === 'visible'`, bật `voice_enabled`, cooldown 15 giây, và luôn có nút **Nghe lại** thủ công).


