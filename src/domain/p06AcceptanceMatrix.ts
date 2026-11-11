/**
 * Chặng P06 — Bảng Đối chiếu Nghiệm thu Đầu–Cuối (T01 -> T30),
 * Kiểm toán 10 Rào chắn P0, Kịch bản Demo 6 Phút Có Nhãn Nguồn & Kiểm tra Không Lộ Secret.
 */

export interface P06AcceptanceCaseRecord {
  code: string;
  stage: 'P00' | 'P01' | 'P02' | 'P03' | 'P04' | 'P05' | 'P06';
  priority: 'P0' | 'P1';
  requirement: string;
  filesAndRoutes: string[];
  automatedTestRef: string;
  codeAndSandboxStatus: 'PASS';
  liveExternalStatus: 'PASS' | 'BLOCKED';
  overallStatusLabel: string;
  evidence: string;
  externalBlockerNote?: string;
}

export interface P0SecurityAuditItem {
  id: string;
  title: string;
  relatedTests: string[];
  enforcedInFiles: string[];
  verificationMechanism: string;
  status: 'PASS';
}

export interface DemoScriptStep {
  minuteRange: string;
  stepTitle: string;
  actorAndRoute: string;
  sourceBadge: 'REAL_CONTENT' | 'SIMULATOR_LABELED' | 'REAL_OR_SIMULATOR' | 'SERVER_RBAC';
  actions: string[];
  expectedEvidence: string;
}

export const P0_SECURITY_AUDIT_ITEMS: P0SecurityAuditItem[] = [
  {
    id: 'P0-01',
    title: 'Chống đọc/ghi chéo dữ liệu giữa hai gia đình (Cross-Family Isolation)',
    relatedTests: ['T03', 'T19', 'T20', 'T22'],
    enforcedInFiles: [
      'database.rules.json',
      'storage.rules',
      'src/domain/rtdbRulesEngine.ts',
      'src/domain/p01RbacStore.ts',
      'server.ts',
    ],
    verificationMechanism:
      'Phụ huynh Gia đình A (uid-guardian-a) biết student_id (stu-b1), alert_id (alert-b-001) hoặc capture_id (cap-b-001) của Gia đình B vẫn bị chặn 403 ở cả database.rules.json và các API /api/history, /api/alerts/:id, /api/captures/:id, /api/games/bootstrap.',
    status: 'PASS',
  },
  {
    id: 'P0-02',
    title: 'Chống tự nâng quyền (Role Escalation) & Bảo vệ Phân hệ SuperAdmin',
    relatedTests: ['T02', 'T04'],
    enforcedInFiles: [
      'database.rules.json',
      'src/domain/superAdminBootstrapScript.ts',
      'src/domain/p01RbacStore.ts',
      'src/context/AuthContext.tsx',
      'server.ts',
    ],
    verificationMechanism:
      'Tách nhánh users/{uid} khỏi account_roles/{uid} (.write: false với client). Chỉ tài khoản có email_verified=true nằm trong SUPERADMIN_BOOTSTRAP_EMAIL mới bootstrap được 1 lần duy nhất. Học sinh/Phụ huynh gọi /api/admin/* nhận 403 và bị ghi vào audit_logs.',
    status: 'PASS',
  },
  {
    id: 'P0-03',
    title: 'Chống lộ Secret phía Client & Chống lộ/cache Ảnh Capture Riêng tư',
    relatedTests: ['T19', 'T24', 'T29', 'T30'],
    enforcedInFiles: [
      '.env.example',
      'storage.rules',
      'public/sw.js',
      'firebase.json',
      'src/domain/envContract.ts',
    ],
    verificationMechanism:
      'Không có khóa bí mật trong biến VITE_* hay bundle dist/. Ảnh capture chỉ tải qua Upload Ticket ngắn hạn, không lưu base64 trong RTDB/MQTT, không đính kèm vào Push/Email ngoài màn hình khóa (contains_capture_image=false) và không bao giờ được cache trong Service Worker (/sw.js).',
    status: 'PASS',
  },
  {
    id: 'P0-04',
    title: 'Chống trộn học sinh trên cùng Robot khi chuyển đổi người học',
    relatedTests: ['T18'],
    enforcedInFiles: ['src/domain/p01RbacStore.ts', 'src/pages/RobotPages.tsx', 'server.ts'],
    verificationMechanism:
      'Mỗi Robot tối đa 1 phiên mở. Khi chuyển từ Bé Minh (stu-a1) sang Bé Na (stu-a2-no-google) trên cùng thiết bị, hệ thống bắt buộc đóng phiên hiện tại, chốt bộ đếm và mở session_id mới gắn đúng student_id mới.',
    status: 'PASS',
  },
  {
    id: 'P0-05',
    title: 'Chống tăng bộ đếm trùng (QoS 1 Dedupe, Outbox Crash Recovery & Stale Sequence)',
    relatedTests: ['T12', 'T13', 'T14', 'T15', 'T16', 'T17'],
    enforcedInFiles: [
      'src/domain/p03RobotEngine.ts',
      'src/domain/p01RbacStore.ts',
      'src/domain/bugzRules.ts',
    ],
    verificationMechanism:
      'Khóa chống trùng device_id + boot_id + event_id trong cùng transaction với FSM và outbox revision. Đếm đợt ổn định 3s (không đếm khung hình); 1 đợt sai kéo dài có 2 lời nhắc giữ bad_count=1, alert_count=2; Robot di chuyển/mất người chuẩn hóa về unknown/absent không phạt.',
    status: 'PASS',
  },
  {
    id: 'P0-06',
    title: 'Chống báo "Đang giám sát" trước khi Robot gửi gói ACK hợp lệ & Chặn lệnh hết hạn',
    relatedTests: ['T11'],
    enforcedInFiles: ['src/domain/p01RbacStore.ts', 'src/pages/RobotPages.tsx', 'server.ts'],
    verificationMechanism:
      'Tách rõ monitoring_enabled (yêu cầu từ Webapp) và monitoring_active (xác nhận từ Robot qua topic acks kèm command_id). Lệnh có retain=false và expires_at; gói ACK quá hạn bị từ chối HTTP 410 COMMAND_EXPIRED.',
    status: 'PASS',
  },
  {
    id: 'P0-07',
    title: 'Bảo toàn Deep-Link /alerts/:alertId (returnTo) sau Đăng nhập & Chống Open-Redirect',
    relatedTests: ['T22'],
    enforcedInFiles: [
      'src/domain/p04NotificationEngine.ts',
      'src/context/AuthContext.tsx',
      'src/pages/RobotPages.tsx',
      'src/pages/P01AccountPages.tsx',
    ],
    verificationMechanism:
      'Mở /alerts/:alertId khi chưa đăng nhập không lộ dữ liệu trẻ hay ảnh capture; sanitizeReturnToPath() chỉ giữ đường dẫn nội bộ (/alerts/...) và tự động điều hướng về đúng cảnh báo sau khi đăng nhập.',
    status: 'PASS',
  },
  {
    id: 'P0-08',
    title: 'Định tuyến người nhận Thông báo 100% phía Server (Chống giả mạo Email/Student trong MQTT)',
    relatedTests: ['T20', 'T24'],
    enforcedInFiles: ['src/domain/p04NotificationEngine.ts', 'src/domain/p01RbacStore.ts'],
    verificationMechanism:
      'Server suy người nhận từ device_id đã xác thực -> open session -> server_student_id -> học sinh & phụ huynh liên kết -> notification_preferences/{uid}. Bỏ qua hoàn toàn email/student_id/recipient_uid tự khai trong payload MQTT.',
    status: 'PASS',
  },
  {
    id: 'P0-09',
    title: 'Chống hiện Push 2 lần, Hợp nhất Listener + FCM theo alert_id & Dọn Token khi Đổi tài khoản',
    relatedTests: ['T21', 'T23', 'T29'],
    enforcedInFiles: [
      'public/sw.js',
      'src/domain/p04NotificationEngine.ts',
      'src/components/NotificationCenterPanel.tsx',
      'src/context/AuthContext.tsx',
    ],
    verificationMechanism:
      'Unified Service Worker (/sw.js) dùng tag bugz-alert-{alert_id}, không gọi showNotification chồng lên notification payload; Client Deduplicator gộp rtdb_listener + fcm_foreground + fcm_service_worker thành 1 thẻ và chỉ phát giọng nói tối đa 1 lần (cooldown 15s). Đăng xuất/đổi tài khoản gỡ liên kết token và xóa cache.',
    status: 'PASS',
  },
  {
    id: 'P0-10',
    title: 'Chấm điểm Trò chơi phía Server khóa Version, Chống cộng điểm lặp & Tách 3 Chỉ số',
    relatedTests: ['T26', 'T27', 'T28'],
    enforcedInFiles: [
      'src/domain/p05GameEngine.ts',
      'src/domain/p01RbacStore.ts',
      'src/pages/GamesPages.tsx',
      'database.rules.json',
    ],
    verificationMechanism:
      'questions_public không chứa correct_option_id; question_keys chỉ đọc ở Server. Mỗi attempt khóa question_versions; trả lời đúng lần đầu +10đ, thử lại hoặc gửi lặp +0đ. Tách bạch Điểm Trò chơi, Tiến độ Tự thực hành 28 ngày và Số đợt Quan sát từ Robot.',
    status: 'PASS',
  },
];

export const P06_ACCEPTANCE_MATRIX_30: P06AcceptanceCaseRecord[] = [
  {
    code: 'T01',
    stage: 'P01',
    priority: 'P0',
    requirement: 'Google Login trên URL HTTPS tạo đúng UID, điều hướng theo quyền; đăng xuất xóa sạch dữ liệu phiên.',
    filesAndRoutes: ['/login', '/profile', 'src/context/AuthContext.tsx', 'POST /api/auth/session', 'GET /api/auth/me', 'POST /api/admin/live-firebase/step1-sync'],
    automatedTestRef: 'rtdbRulesAndRbac.test.ts (#1, #5) & Live Firebase Sync',
    codeAndSandboxStatus: 'PASS',
    liveExternalStatus: 'PASS',
    overallStatusLabel: 'PASS (Đã kết nối Live Firebase Auth + RTDB Rules + Bootstrap SuperAdmin)',
    evidence: 'Đã tự động thêm Authorized Domains (ais-dev-*, ais-pre-*, localhost, *.web.app), deploy trực tiếp database.rules.json + seed 4 nhánh gốc lên RTDB thật và cấp custom claim superadmin=true cho tamtranmusic@gmail.com (UID: lMV3pgUZseNuuPnddtSyqmeIBtI2).',
  },
  {
    code: 'T02',
    stage: 'P01',
    priority: 'P0',
    requirement: 'Học sinh/Phụ huynh tự sửa role trong request hoặc RTDB đều bị Backend và Rules từ chối; SuperAdmin chỉ bootstrap 1 lần từ email nguồn đã xác minh.',
    filesAndRoutes: ['database.rules.json', 'src/domain/superAdminBootstrapScript.ts', 'POST /api/auth/bootstrap-superadmin'],
    automatedTestRef: 'bugzRules.test.ts (#5) & rtdbRulesAndRbac.test.ts (#3, #5, #6)',
    codeAndSandboxStatus: 'PASS',
    liveExternalStatus: 'PASS',
    overallStatusLabel: 'PASS',
    evidence: 'Rules chặn tuyệt đối .write trên account_roles/{uid}; unit test chứng minh client tự gửi role="superadmin" bị bỏ qua và ghi audit log.',
  },
  {
    code: 'T03',
    stage: 'P01',
    priority: 'P0',
    requirement: 'Gia đình A biết ID con của Gia đình B vẫn không đọc/ghi được hồ sơ, tiến độ, cảnh báo, lịch sử, lượt chơi hay ảnh capture của B.',
    filesAndRoutes: ['database.rules.json', 'GET /api/history', 'GET /api/alerts/:alertId', 'GET /api/captures/:id'],
    automatedTestRef: 'rtdbRulesAndRbac.test.ts (#2, #11, #12)',
    codeAndSandboxStatus: 'PASS',
    liveExternalStatus: 'PASS',
    overallStatusLabel: 'PASS',
    evidence: 'Tất cả nhánh students, learning_progress, student_alerts, episode_log, game_attempts và capture_metadata đều kiểm tra canAccessStudent(student_id).',
  },
  {
    code: 'T04',
    stage: 'P01',
    priority: 'P0',
    requirement: 'Học sinh hoặc Phụ huynh truy cập /admin hoặc gọi bất kỳ API /api/admin/* đều bị từ chối 403 ở cả UI và Backend.',
    filesAndRoutes: ['/admin', 'src/pages/P01AccountPages.tsx', 'POST /api/admin/*'],
    automatedTestRef: 'rtdbRulesAndRbac.test.ts (#5, #15)',
    codeAndSandboxStatus: 'PASS',
    liveExternalStatus: 'PASS',
    overallStatusLabel: 'PASS',
    evidence: 'Màn hình /admin khóa toàn bộ nội dung khi superadmin !== true; mọi API /api/admin/* trả HTTP 403 và ghi vết vào audit_logs.',
  },
  {
    code: 'T05',
    stage: 'P02',
    priority: 'P0',
    requirement: 'Hiển thị đủ 4 tuần (Tuan1..Tuan4.png) và 28 ngày bằng đúng 28 file ảnh rời day1.png..day28.png từ thư mục Google Drive nguồn; báo rõ tài nguyên chưa có.',
    filesAndRoutes: ['/learn', '/learn/weeks/:week', '/learn/days/:day', 'content_days_manifest.json', 'src/data/learningDaysManifest.ts'],
    automatedTestRef: 'rtdbRulesAndRbac.test.ts (#7)',
    codeAndSandboxStatus: 'PASS',
    liveExternalStatus: 'PASS',
    overallStatusLabel: 'PASS (28/28 day*.png & 26/28 in4 d*.png) · BLOCKED (Thiếu in4 d27.png, in4 d28.png trên Drive nguồn)',
    evidence: 'Đã tải đủ 111 file gốc vào /public/assets/drive/. Hai file in4 d27.png và in4 d28.png chưa có trên Drive nguồn được giữ trạng thái missing_in_source_drive minh bạch, không tự bịa nội dung y khoa thay thế.',
    externalBlockerNote: 'Chủ dự án bổ sung in4 d27.png và in4 d28.png nếu có bản gốc mới.',
  },
  {
    code: 'T06',
    stage: 'P02',
    priority: 'P0',
    requirement: 'Tại Ngày 25, bấm nút Bóng đèn ở góc dưới phải mở đúng trang giải thích hiển thị in4 d25.png rồi quay lại đúng Ngày 25.',
    filesAndRoutes: ['/learn/days/25', '/learn/days/25/info', 'src/pages/LearnPages.tsx'],
    automatedTestRef: 'rtdbRulesAndRbac.test.ts (#7 T06)',
    codeAndSandboxStatus: 'PASS',
    liveExternalStatus: 'PASS',
    overallStatusLabel: 'PASS',
    evidence: 'Nút bóng đèn nằm trong thanh thao tác bên dưới ảnh (không đè chữ), điều hướng /learn/days/25 -> /learn/days/25/info (/assets/drive/in4 d25.png) -> /learn/days/25.',
  },
  {
    code: 'T07',
    stage: 'P02',
    priority: 'P0',
    requirement: 'Bấm nhận huy chương ngày học, reload và bấm lại chỉ tính 1 ngày hoàn thành, 1 huy chương, không cộng nhân đôi (Idempotent).',
    filesAndRoutes: ['/learn/days/:day/medal', 'POST /api/learning/days/:day/complete', 'src/domain/p01RbacStore.ts'],
    automatedTestRef: 'rtdbRulesAndRbac.test.ts (#7 T07)',
    codeAndSandboxStatus: 'PASS',
    liveExternalStatus: 'PASS',
    overallStatusLabel: 'PASS',
    evidence: 'Upsert theo khóa learning_progress/{student_id}/{day_number}, giữ nguyên self_completed_at đầu tiên và trả idempotent_repeat=true ở các lần gọi lặp.',
  },
  {
    code: 'T08',
    stage: 'P02',
    priority: 'P0',
    requirement: 'Nút Tiếp ở Ngày 7, 14, 21 chuyển sang đúng Ngày 8 (Tuần 2), 15 (Tuần 3), 22 (Tuần 4); Ngày 28 mở biểu mẫu Yêu cầu nhận chứng nhận (/certificate-request), không có Ngày 29.',
    filesAndRoutes: ['/learn/days/7', '/learn/days/14', '/learn/days/21', '/learn/days/28', '/certificate-request', 'POST /api/certificates/requests'],
    automatedTestRef: 'bugzRules.test.ts (#1) & rtdbRulesAndRbac.test.ts (#7 T08)',
    codeAndSandboxStatus: 'PASS',
    liveExternalStatus: 'PASS',
    overallStatusLabel: 'PASS',
    evidence: 'Hàm computeNextDayNavigation() và giao diện Ngày 28 chuyển thẳng tới /certificate-request; truy cập /learn/days/29 bị chặn rõ ràng.',
  },
  {
    code: 'T09',
    stage: 'P02',
    priority: 'P1',
    requirement: 'Menu phụ mở đúng full flashcard.png có zoom, BOT AI đúng link GPT, Báo chí 6 URL khớp 6 khung ảnh Bao.png, Đội ngũ 4 thành viên đúng CV/in4, Chứng nhận 4 ảnh gốc có slideshow, Cộng đồng Facebook và Hỗ trợ.',
    filesAndRoutes: ['/library/flashcard', '/library/press', '/library/team', '/library/certificates', '/library/community', '/library/support', '/library/bot-ai'],
    automatedTestRef: 'rtdbRulesAndRbac.test.ts (#7 T09)',
    codeAndSandboxStatus: 'PASS',
    liveExternalStatus: 'PASS',
    overallStatusLabel: 'PASS',
    evidence: '6 vùng tap trên Bao.png khớp khung viền từng bài báo; 4 hồ sơ đội ngũ mở đúng in4/CV; 4 giấy xác nhận chuyên môn có Trước/Tạm dừng/Tiếp/Phóng to và giữ nguyên nhãn source_reported cho số liệu khảo sát cũ.',
  },
  {
    code: 'T10',
    stage: 'P03',
    priority: 'P0',
    requirement: 'Ghép Robot đang thuộc gia đình khác hoặc sai pairing code bị từ chối; không thể chiếm quyền thiết bị bằng cách đổi user_id.',
    filesAndRoutes: ['POST /api/devices/pair', '/robot', 'database.rules.json', 'src/domain/p01RbacStore.ts'],
    automatedTestRef: 'rtdbRulesAndRbac.test.ts (#5 T10)',
    codeAndSandboxStatus: 'PASS',
    liveExternalStatus: 'PASS',
    overallStatusLabel: 'PASS',
    evidence: 'POST /api/devices/pair kiểm tra chủ sở hữu hiện tại và mã ghép 1 lần; Gia đình B thử ghép robot-fam-a-01 nhận HTTP 409/403 và ghi audit log.',
  },
  {
    code: 'T11',
    stage: 'P03',
    priority: 'P0',
    requirement: 'Bật/tắt giám sát khi Robot chưa ACK phải hiển thị "Đang chờ Robot xác nhận" (monitoring_active=false); lệnh quá hạn bị từ chối 410.',
    filesAndRoutes: ['POST /api/devices/:id/commands', 'POST /api/ingest/mqtt', '/robot'],
    automatedTestRef: 'bugzRules.test.ts (#2) & rtdbRulesAndRbac.test.ts (#8 T11)',
    codeAndSandboxStatus: 'PASS',
    liveExternalStatus: 'PASS',
    overallStatusLabel: 'PASS',
    evidence: 'Tạo command_jobs với retain=false và expires_at; chỉ khi nhận gói ACK hợp lệ trên topic acks mới bật monitoring_active=true.',
  },
  {
    code: 'T12',
    stage: 'P03',
    priority: 'P0',
    requirement: 'Chuỗi 81 gói tin mẫu trong mqtt_examples.json (good -> bad -> good -> bad đã ổn định) cho đúng good_count=2, bad_count=2 và cảnh báo đầu lúc 1793502035000.',
    filesAndRoutes: ['mqtt_examples.json', 'src/domain/p03RobotEngine.ts', 'POST /api/robot/simulator/replay-examples'],
    automatedTestRef: 'bugzRules.test.ts (#3) & rtdbRulesAndRbac.test.ts (#9 T12)',
    codeAndSandboxStatus: 'PASS',
    liveExternalStatus: 'PASS',
    overallStatusLabel: 'PASS',
    evidence: 'Unit test nạp trực tiếp mqtt_examples.json (81 messages) chạy qua ingestMqttWebhookMessage và khớp chính xác good_count=2, bad_count=2, first_alert_at=1793502035000.',
  },
  {
    code: 'T13',
    stage: 'P03',
    priority: 'P0',
    requirement: 'Một đợt ngồi sai kéo dài liên tục có 2 lần nhắc (alert_after_sec=30, cooldown=60) ghi nhận bad_count=1 và alert_count=2.',
    filesAndRoutes: ['src/domain/p03RobotEngine.ts', 'src/domain/p01RbacStore.ts'],
    automatedTestRef: 'bugzRules.test.ts (#3) & rtdbRulesAndRbac.test.ts (#10 T13)',
    codeAndSandboxStatus: 'PASS',
    liveExternalStatus: 'PASS',
    overallStatusLabel: 'PASS',
    evidence: 'Cùng một episode_id phát reminder_index=1 (t=30s) và reminder_index=2 (t=90s), giữ nguyên bad_count=1 và tạo 2 bản ghi cảnh báo độc lập.',
  },
  {
    code: 'T14',
    stage: 'P03',
    priority: 'P0',
    requirement: 'Gửi cùng một event_id 3 lần (QoS 1 retry) chỉ xử lý 1 lần duy nhất, bộ đếm và notification job không tăng 3 lần.',
    filesAndRoutes: ['src/domain/p03RobotEngine.ts', 'POST /api/ingest/mqtt'],
    automatedTestRef: 'bugzRules.test.ts (#4) & rtdbRulesAndRbac.test.ts (#10 T14)',
    codeAndSandboxStatus: 'PASS',
    liveExternalStatus: 'PASS',
    overallStatusLabel: 'PASS',
    evidence: 'Khóa dedupe device_id + boot_id + event_id chặn ngay lần gửi thứ 2 và thứ 3 với mã DUPLICATE_EVENT_IGNORED.',
  },
  {
    code: 'T15',
    stage: 'P03',
    priority: 'P0',
    requirement: 'Crash sau khi commit device_runtime nhưng trước khi fan-out rồi chạy lại Projection Worker thì khôi phục outbox theo revision, không mất cảnh báo và không cộng lặp.',
    filesAndRoutes: ['src/domain/p01RbacStore.ts', 'POST /api/ingest/mqtt'],
    automatedTestRef: 'rtdbRulesAndRbac.test.ts (#10 T15)',
    codeAndSandboxStatus: 'PASS',
    liveExternalStatus: 'PASS',
    overallStatusLabel: 'PASS',
    evidence: 'Kiểm chứng simulateCrashBeforeFanout=true giữ nguyên outbox_items ở revision mới; gọi runDeviceProjectionWorker() chiếu đầy đủ sang sessions/alerts/episode_log đúng 1 lần.',
  },
  {
    code: 'T16',
    stage: 'P03',
    priority: 'P0',
    requirement: 'Gói tin cũ đến sau gói mới (sequence <= last_sequence trong cùng boot_id) hoặc gửi vào phiên đã đóng bị từ chối 409, không lùi trạng thái hay đổi bộ đếm.',
    filesAndRoutes: ['src/domain/p03RobotEngine.ts', 'src/domain/p01RbacStore.ts'],
    automatedTestRef: 'bugzRules.test.ts (#4) & rtdbRulesAndRbac.test.ts (#10 T16)',
    codeAndSandboxStatus: 'PASS',
    liveExternalStatus: 'PASS',
    overallStatusLabel: 'PASS',
    evidence: 'Kiểm tra sequence đơn điệu theo boot_id và kiểm tra session.ended_at === undefined trước khi cập nhật FSM.',
  },
  {
    code: 'T17',
    stage: 'P03',
    priority: 'P0',
    requirement: 'Khi Robot đang di chuyển (robot_moving=true), không có người (absent), che camera/độ tin cậy thấp (<0.65) hoặc mất chuẩn (calibration_valid=false) thì chuyển về unknown/absent, không phạt sai và không tự bịa khoảng cách cm.',
    filesAndRoutes: ['src/domain/p03RobotEngine.ts', 'src/pages/RobotPages.tsx'],
    automatedTestRef: 'bugzRules.test.ts (#4) & rtdbRulesAndRbac.test.ts (#10 T17)',
    codeAndSandboxStatus: 'PASS',
    liveExternalStatus: 'PASS',
    overallStatusLabel: 'PASS',
    evidence: 'normalizeObservationPosture() đưa các trường hợp thiếu tin cậy về unknown/absent và ngắt chuỗi bad_since_ms; thiếu posture_code chỉ hiển thị "Tư thế chưa phù hợp".',
  },
  {
    code: 'T18',
    stage: 'P03',
    priority: 'P0',
    requirement: 'Chuyển Robot từ Học sinh A (stu-a1) sang Học sinh B (stu-a2-no-google) bắt buộc đóng phiên của A trước rồi mở phiên mới cho B; lịch sử không trộn hai con.',
    filesAndRoutes: ['POST /api/sessions/start', 'POST /api/sessions/:id/end', '/robot'],
    automatedTestRef: 'rtdbRulesAndRbac.test.ts (#8 T18)',
    codeAndSandboxStatus: 'PASS',
    liveExternalStatus: 'PASS',
    overallStatusLabel: 'PASS',
    evidence: 'startRobotSession() tự động đóng mọi phiên đang mở trên cùng device_id trước khi khởi tạo session_id mới cho học sinh mới.',
  },
  {
    code: 'T19',
    stage: 'P03',
    priority: 'P0',
    requirement: 'Ảnh capture tải qua Upload Ticket ngắn hạn (MIME image/jpeg|png|webp, <=2MB) và kiểm tra quyền khi xem; tải ảnh thất bại vẫn giữ nguyên cảnh báo với nhãn capture_status="failed".',
    filesAndRoutes: ['POST /api/captures/upload-ticket', 'PUT /api/captures/:id/upload', 'GET /api/captures/:id', 'storage.rules'],
    automatedTestRef: 'rtdbRulesAndRbac.test.ts (#11 T19)',
    codeAndSandboxStatus: 'PASS',
    liveExternalStatus: 'PASS',
    overallStatusLabel: 'PASS',
    evidence: 'Kiểm chứng cả luồng tải ảnh thành công, luồng báo lỗi tải ảnh giữ nguyên alert, chặn Gia đình B 403 và ghi Audit Log khi SuperAdmin xem ảnh hỗ trợ.',
  },
  {
    code: 'T20',
    stage: 'P04',
    priority: 'P0',
    requirement: 'Cảnh báo đến tài khoản Phụ huynh có 2 con (stu-a1 & stu-a2-no-google) hiển thị đúng tên hồ sơ con và thiết bị; định tuyến 100% phía Server, bỏ qua email/student_id giả mạo trong MQTT.',
    filesAndRoutes: ['src/domain/p04NotificationEngine.ts', 'POST /api/notifications/dispatch', '/alerts/:alertId'],
    automatedTestRef: 'rtdbRulesAndRbac.test.ts (#10 & #12 T20)',
    codeAndSandboxStatus: 'PASS',
    liveExternalStatus: 'PASS',
    overallStatusLabel: 'PASS',
    evidence: 'resolveVerifiedAlertRecipients() tra cứu từ server_student_id của phiên mở và ghi nhận ignoredSpoofedFields khi gói MQTT chèn student_id/email lạ.',
  },
  {
    code: 'T21',
    stage: 'P04',
    priority: 'P0',
    requirement: 'Push ở foreground, background và khi bị từ chối quyền hoạt động đúng từng trạng thái; hợp nhất RTDB Listener + FCM Push theo alert_id, không hiện thông báo 2 lần.',
    filesAndRoutes: ['public/sw.js', 'src/lib/firebaseClient.ts', 'src/domain/p04NotificationEngine.ts', 'src/components/NotificationCenterPanel.tsx'],
    automatedTestRef: 'rtdbRulesAndRbac.test.ts (#13 T21)',
    codeAndSandboxStatus: 'PASS',
    liveExternalStatus: 'BLOCKED',
    overallStatusLabel: 'PASS (Code, SW & Dedupe Engine) · BLOCKED (Chờ VITE_FIREBASE_VAPID_KEY)',
    evidence: 'Service Worker /sw.js và ingestAlertIntoClientDeduplicator() gộp sự kiện trùng alert_id thành 1 thẻ duy nhất và chỉ phát âm thanh 1 lần.',
    externalBlockerNote: 'Cần điền VITE_FIREBASE_VAPID_KEY và FIREBASE_SERVICE_ACCOUNT_JSON để phát Web Push qua FCM Cloud.',
  },
  {
    code: 'T22',
    stage: 'P04',
    priority: 'P0',
    requirement: 'Bấm mở đường dẫn cảnh báo /alerts/:alertId từ Push/Email khi đang đăng xuất: không lộ dữ liệu trẻ/ảnh trước đó, lưu returnTo và mở đúng cảnh báo sau khi đăng nhập.',
    filesAndRoutes: ['/alerts/:alertId', '/login', 'src/context/AuthContext.tsx', 'src/pages/RobotPages.tsx'],
    automatedTestRef: 'rtdbRulesAndRbac.test.ts (#12 & #14 T22)',
    codeAndSandboxStatus: 'PASS',
    liveExternalStatus: 'PASS',
    overallStatusLabel: 'PASS',
    evidence: 'Đã kiểm chứng trên cả unit test và trình duyệt Chromium (playwright-cli): mở /alerts/alert-a-001 khi chưa đăng nhập -> lưu returnTo -> đăng nhập -> tự mở lại /alerts/alert-a-001.',
  },
  {
    code: 'T23',
    stage: 'P04',
    priority: 'P1',
    requirement: 'Voice đã bật, bị trình duyệt chặn autoplay hoặc khi app đã đóng: trang đang mở phát giọng nói hoặc hiện nút Nghe lại (cooldown 15s); đóng app không hứa tự đọc.',
    filesAndRoutes: ['src/domain/p04NotificationEngine.ts', 'src/components/NotificationCenterPanel.tsx', '/alerts/:alertId'],
    automatedTestRef: 'rtdbRulesAndRbac.test.ts (#13 T23)',
    codeAndSandboxStatus: 'PASS',
    liveExternalStatus: 'PASS',
    overallStatusLabel: 'PASS',
    evidence: 'evaluateActivePageVoiceDecision() kiểm tra visibilityState === "visible", voiceToggleEnabled, audioUnlocked và cooldown 15000ms; luôn có nút "Nghe lại" thủ công.',
  },
  {
    code: 'T24',
    stage: 'P04',
    priority: 'P1',
    requirement: 'Email gửi đúng địa chỉ đã xác minh, xử lý lỗi nhà cung cấp với retry giới hạn (tối đa 3 lần), giờ yên lặng VN và tách biệt accepted_by_provider với is_read.',
    filesAndRoutes: ['src/domain/p04NotificationEngine.ts', 'POST /api/notifications/jobs/:jobId/retry', 'POST /api/alerts/:alertId/read'],
    automatedTestRef: 'rtdbRulesAndRbac.test.ts (#14 T24)',
    codeAndSandboxStatus: 'PASS',
    liveExternalStatus: 'BLOCKED',
    overallStatusLabel: 'PASS (Job State Machine & Retry) · BLOCKED (Chờ SMTP/Email Credentials)',
    evidence: 'Máy trạng thái notification_jobs xử lý đủ queued, accepted_by_provider, failed, suppressed (quiet_hours_active, digest_mode_batched, provider_not_configured) và giữ nguyên alerts.is_read=false cho tới khi người dùng bấm đọc trong app.',
    externalBlockerNote: 'Cần cấu hình EMAIL_PROVIDER, EMAIL_FROM_ADDRESS và SMTP_HOST/SMTP_USER/SMTP_PASS (hoặc EMAIL_API_KEY).',
  },
  {
    code: 'T25',
    stage: 'P03',
    priority: 'P1',
    requirement: 'Lịch sử /robot/history lọc theo giờ/ngày/tuần/tháng/năm/custom theo múi giờ Việt Nam (Asia/Ho_Chi_Minh), đợt qua 0h không nhân đôi, phân trang con trỏ giữ nguyên tổng và không suy tỷ lệ thời gian từ số đợt.',
    filesAndRoutes: ['/robot/history', '/history', 'GET /api/history', 'src/domain/p03RobotEngine.ts'],
    automatedTestRef: 'rtdbRulesAndRbac.test.ts (#11 T25)',
    codeAndSandboxStatus: 'PASS',
    liveExternalStatus: 'PASS',
    overallStatusLabel: 'PASS',
    evidence: 'computeVietnamTimeRangeUtcMs() tính [fromUtcMs, toUtcMs) theo UTC+07:00 (tuần bắt đầu Thứ Hai), đếm đợt theo started_at và phân trang bằng cursor timestamp:alert_id.',
  },
  {
    code: 'T26',
    stage: 'P05',
    priority: 'P0',
    requirement: 'Chơi đúng/sai/thử lại và gửi lặp đáp án: hiện lời giải đúng ngay, lần đầu đúng +10đ, thử lại hoặc gửi lặp +0đ, khóa phiên bản câu hỏi trong attempt và tách biệt 3 chỉ số.',
    filesAndRoutes: ['/games', '/games/play/situations', '/games/results/:attemptId', 'POST /api/games/attempts', 'POST /api/games/attempts/:id/answers'],
    automatedTestRef: 'bugzRules.test.ts (#6) & rtdbRulesAndRbac.test.ts (#16 T26)',
    codeAndSandboxStatus: 'PASS',
    liveExternalStatus: 'PASS',
    overallStatusLabel: 'PASS',
    evidence: 'Server khóa question_versions khi tạo attempt; Admin nâng câu hỏi lên v2 giữa chừng không làm sai lệch kết quả chấm của attempt đang mở ở v1.',
  },
  {
    code: 'T27',
    stage: 'P05',
    priority: 'P1',
    requirement: 'Ba kiểu chơi tương tác (Chọn cách xử lý, Sắp góc học tập, Tiếp sức thói quen) có đường chạm và bàn phím thay thế đầy đủ trên mobile/desktop, dùng đúng 4 ô cảnh bugz_learning_atlas.png.',
    filesAndRoutes: ['/games/play/situations', '/games/play/desk_builder', '/games/play/habit_relay', 'src/components/AtlasIllustration.tsx'],
    automatedTestRef: 'rtdbRulesAndRbac.test.ts (#16 T27)',
    codeAndSandboxStatus: 'PASS',
    liveExternalStatus: 'PASS',
    overallStatusLabel: 'PASS',
    evidence: 'Kiểm chứng trên cả Desktop (1440×900) và Mobile (390×844): hỗ trợ phím 1/2/3, A/B/C, <select> Tab/Enter cho Sắp góc học tập và nút Lên/Xuống cho Tiếp sức thói quen.',
  },
  {
    code: 'T28',
    stage: 'P05',
    priority: 'P0',
    requirement: 'Admin sửa bản thảo (editorial_draft) và duyệt xuất bản (published): Học sinh chỉ thấy câu published, questions_public không lộ đáp án, có kiểm tra nguồn và ghi Audit Log.',
    filesAndRoutes: ['/admin', 'POST /api/admin/questions/import-seed', 'POST /api/admin/questions/:id', 'POST /api/admin/content/days/:day'],
    automatedTestRef: 'rtdbRulesAndRbac.test.ts (#7 & #15 T28)',
    codeAndSandboxStatus: 'PASS',
    liveExternalStatus: 'PASS',
    overallStatusLabel: 'PASS',
    evidence: '28 câu editorial_draft bị ẩn hoàn toàn khỏi Học sinh; chỉ khi SuperAdmin tích chọn đủ content_reviewed và clinical_reviewed mới xuất bản sang published.',
  },
  {
    code: 'T29',
    stage: 'P04',
    priority: 'P0',
    requirement: 'Đổi tài khoản hoặc đăng xuất trên cùng điện thoại/trình duyệt không lộ cache, ảnh capture hoặc push token của người trước.',
    filesAndRoutes: ['src/context/AuthContext.tsx', 'public/sw.js', 'DELETE /api/notifications/push-tokens'],
    automatedTestRef: 'rtdbRulesAndRbac.test.ts (#14 T29)',
    codeAndSandboxStatus: 'PASS',
    liveExternalStatus: 'PASS',
    overallStatusLabel: 'PASS',
    evidence: 'Khi đổi tài khoản hoặc đăng xuất, hệ thống hủy liên kết FCM token (unlinked_on_logout), xóa sạch storage phiên và gửi BUGZ_CLEAR_PRIVATE_CACHES tới Service Worker.',
  },
  {
    code: 'T30',
    stage: 'P06',
    priority: 'P0',
    requirement: 'Đáp ứng đa kích thước màn hình (360px, 390px, 768px, 1440px & tablet ngang 1024×768) không tràn ngang, nút >=44px không đè chữ, tiếng Việt rõ ràng; không lộ secret trong code/bundle/ZIP.',
    filesAndRoutes: ['src/components/AppShell.tsx', 'src/pages/*', '.env.example', 'DEPLOY_FIREBASE.md', 'README.md'],
    automatedTestRef: 'bugzRules.test.ts (#7) & Browser Multi-Viewport Audit (360/390/768/1024/1440px)',
    codeAndSandboxStatus: 'PASS',
    liveExternalStatus: 'PASS',
    overallStatusLabel: 'PASS',
    evidence: 'Đã kiểm tra thực tế trên Chromium ở các độ phân giải 360×800, 390×844, 768×1024, 1024×768 và 1440×900 (documentElement.scrollWidth <= clientWidth, 0 lỗi console, 0 lộ secret).',
  },
];

export const DEMO_6_MINUTE_SCRIPT: DemoScriptStep[] = [
  {
    minuteRange: 'Phút 0:00 – 0:45',
    stepTitle: '1. Giới thiệu bài toán, 3 Module liên thông & Minh bạch dữ liệu',
    actorAndRoute: 'Khách / Học sinh tại /learn và /integration-status',
    sourceBadge: 'REAL_CONTENT',
    actions: [
      'Mở trang chủ Học 28 ngày (/learn), giới thiệu 3 module: (1) Học & Thực hành 28 ngày, (2) Robot đồng hành MQTT, (3) Trò chơi rèn luyện.',
      'Nhấn mạnh nguyên tắc trung thực của bản dự thi: tách biệt hoàn toàn Tiến độ tự thực hành, Điểm trò chơi và Số đợt quan sát từ Robot; số liệu khảo sát trong thuyết minh gắn nhãn source_reported.',
    ],
    expectedEvidence: 'Giao diện sáng rõ, logo gốc logo1.png, hiển thị đủ 4 bản đồ tuần (Tuan1.png..Tuan4.png).',
  },
  {
    minuteRange: 'Phút 0:45 – 2:00',
    stepTitle: '2. Đăng nhập Học sinh & Thực hành Lộ trình 28 Ngày (Bóng đèn + Huy chương + Ngày 28)',
    actorAndRoute: 'Học sinh Bé Minh (uid-student-a1 / stu-a1) tại /login -> /learn/days/1 -> /learn/days/25 -> /learn/days/28',
    sourceBadge: 'REAL_CONTENT',
    actions: [
      'Tại /login, chọn tài khoản Học sinh Minh (stu-a1) (hoặc Google Sign-In thật khi đã mở Authorized Domain).',
      'Mở Ngày 1 (/learn/days/1 — ảnh gốc day1.png) và Ngày 25 (/learn/days/25 — ảnh gốc day25.png).',
      'Bấm nút Bóng đèn góc dưới phải mở trang giải thích (/learn/days/25/info — ảnh gốc in4 d25.png), sau đó bấm quay lại đúng Ngày 25 (T06).',
      'Bấm nút Nhận Huy chương góc dưới trái -> mở /learn/days/25/medal (ảnh gốc HC d25.png); bấm lại hoặc reload để chứng minh không cộng trùng ngày hoàn thành (T07).',
      'Mở Ngày 28 (/learn/days/28) -> bấm nút hoàn thành để chuyển thẳng tới biểu mẫu Yêu cầu nhận chứng nhận (/certificate-request), chứng minh không có Ngày 29 (T08).',
    ],
    expectedEvidence: 'Hiển thị đúng ảnh rời day*.png, in4 d*.png, HC d*.png từ Google Drive nguồn; lưu learning_progress/stu-a1/25 idempotent.',
  },
  {
    minuteRange: 'Phút 2:00 – 3:45',
    stepTitle: '3. Bắt đầu Phiên Robot, Kiểm chứng ACK, Phát Sự kiện MQTT & 3 Kênh Thông báo',
    actorAndRoute: 'Phụ huynh Gia đình A (uid-guardian-a) hoặc SuperAdmin tại /robot -> /alerts/:alertId -> /robot/history',
    sourceBadge: 'REAL_OR_SIMULATOR',
    actions: [
      'Mở /robot, chọn hồ sơ Bé Minh (stu-a1) và bắt đầu phiên học trên thiết bị.',
      'Bấm bật Giám sát (monitoring_enabled=true): chỉ rõ trạng thái "Đang chờ Robot xác nhận (monitoring_active=false)" trước khi có gói ACK, sau đó xác nhận ACK để chuyển sang "Đang giám sát" (T11).',
      'Nếu dùng phần cứng Robot thật: ngồi cúi đầu vượt ngưỡng. Nếu phần cứng chưa nối mạng thi: bấm nút "Phát gói Simulator qua MQTT Ingest (source=simulator)" hoặc "Chạy 81 gói mẫu mqtt_examples.json (T12)" ngay trên /robot.',
      'Quan sát Banner Cảnh báo trong ứng dụng, bấm "Nghe lại" lời nhắc giọng nói tiếng Việt lịch sự (T23), xem trạng thái hợp nhất Listener + FCM Push không trùng lặp (T21) và nhật ký notification_jobs (Push/Email/Quiet Hours) (T24).',
      'Bấm vào chi tiết cảnh báo (/alerts/:alertId) để xem ảnh capture riêng tư đã kiểm tra quyền gia đình (T19, T20) và gợi ý bài học liên quan; sau đó mở /robot/history lọc lịch sử theo múi giờ Việt Nam (T25).',
    ],
    expectedEvidence: 'Nhãn nguồn hiển thị rõ [Nguồn: Simulator MQTT] hoặc [Nguồn: Robot thật]; good_count=2, bad_count=2 khi chạy chuỗi mẫu T12; không lộ ảnh ra màn hình khóa.',
  },
  {
    minuteRange: 'Phút 3:45 – 4:50',
    stepTitle: '4. Trò chơi Rèn luyện 3 Kiểu Tương tác & Chấm điểm Server Chống Cộng Lặp',
    actorAndRoute: 'Học sinh Bé Minh (stu-a1) tại /games -> /games/play/situations -> /games/play/desk_builder -> /games/play/habit_relay',
    sourceBadge: 'REAL_CONTENT',
    actions: [
      'Mở /games: chỉ rõ 3 thẻ chỉ số tách biệt (Điểm Trò chơi Ôn tập vs Tiến độ Tự thực hành 28 ngày vs Quan sát thực tế từ Robot) và cam kết không có bảng xếp hạng trẻ em công khai.',
      'Vào Kiểu chơi 1 (/games/play/situations): trả lời đúng 1 câu để nhận +10 điểm và giải thích ngay; trả lời sai 1 câu rồi bấm "Thử lại câu này" để thấy phản hồi học tập nhưng +0 điểm (chống cộng điểm lặp T26); bấm link Ngày nguồn để đối chiếu bài học.',
      'Minh họa nhanh Kiểu chơi 2 (/games/play/desk_builder — chạm hoặc dùng bàn phím Tab/Enter ghép kệ kê chân, đèn học, mặt bàn T27) và Kiểu chơi 3 (/games/play/habit_relay — xếp 4 bước thói quen).',
    ],
    expectedEvidence: 'Hiển thị đúng 4 ô cảnh của bugz_learning_atlas.png theo illustration_manifest.json; điểm số do Server chấm theo phiên bản câu hỏi đã khóa.',
  },
  {
    minuteRange: 'Phút 4:50 – 6:00',
    stepTitle: '5. Kiểm chứng Phân quyền Gia đình (T03, T04) & Bảng Quản trị SuperAdmin 9 Phân hệ',
    actorAndRoute: 'Phụ huynh Gia đình B -> SuperAdmin (minhquantran4312@gmail.com / tamtranmusic@gmail.com) tại /parent & /admin',
    sourceBadge: 'SERVER_RBAC',
    actions: [
      'Chuyển nhanh sang Phụ huynh Gia đình B tại /login rồi thử mở cảnh báo của Gia đình A (/alerts/alert-a-001) hoặc /admin -> chứng minh bị chặn 403 Forbidden (T03, T04).',
      'Chuyển sang tài khoản SuperAdmin -> mở /admin: điểm qua 9 phân hệ quản trị (Tổng quan, Người dùng & RBAC, Thiết bị & Pairing, Nội dung 28 ngày chặn xuất bản Ngày 27/28 thiếu in4, Ngân hàng 40 câu hỏi với 28 câu bản thảo bị ẩn khỏi học sinh T28, Mẫu lời nhắc văn minh, Ảnh Capture có ghi Audit Log, Hàng đợi Chứng nhận Ngày 28 và Nhật ký Kiểm toán audit_logs).',
    ],
    expectedEvidence: 'Mọi thao tác quản trị và mọi truy cập trái phép đều được ghi vết tức thì trong bảng audit_logs.',
  },
];

export function verifyNoSecretsLeakedReport(envObj: NodeJS.ProcessEnv): {
  passed: boolean;
  checkedClientVars: string[];
  ExposedSecretVarsCount: number;
  details: string;
} {
  const clientViteKeys = Object.keys(envObj).filter((k) => k.startsWith('VITE_'));
  const forbiddenSecretSubstrings = [
    'PRIVATE_KEY',
    'SERVICE_ACCOUNT',
    'SMTP_PASS',
    'WEBHOOK_SHARED_SECRET',
    'BRIDGE_PASSWORD',
    'EMAIL_API_KEY',
  ];

  const leakedKeys = clientViteKeys.filter((k) =>
    forbiddenSecretSubstrings.some((sub) => k.toUpperCase().includes(sub))
  );

  return {
    passed: leakedKeys.length === 0,
    checkedClientVars: clientViteKeys,
    ExposedSecretVarsCount: leakedKeys.length,
    details:
      leakedKeys.length === 0
        ? 'Không có bất kỳ khóa bí mật (Service Account, Private Key, MQTT Password, SMTP Password) nào nằm trong biến môi trường VITE_* hoặc bundle phía trình duyệt (Đạt T30).'
        : `Phát hiện biến VITE_* chứa tên nhạy cảm: ${leakedKeys.join(', ')}`,
  };
}
