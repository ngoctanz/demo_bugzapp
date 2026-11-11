// BUGZ BrightUpGenZ - Canonical Source Mapping & Asset Registry (P00 + P02)
// Synchronized 100% with Google Drive folder https://drive.google.com/drive/folders/17jX1J0xhyvYG5lfKrTMu6fdViTQsg9M6,
// Cover folder https://drive.google.com/drive/folders/1EggVzvXD4fh2i8De52TBSnXCQ3KP0b3v,
// content_days_manifest.json, source_manifest.json, and inputs/YEU_CAU_GOC_TRICH_VAN_BAN.md.

import { DAY_COVER_DRIVE_IDS, WEEK_COVER_DRIVE_IDS } from './driveAssetRegistry.ts';

export interface AssetRef {
  name: string;
  drive_id: string | null;
  status: 'verified' | 'not_yet_verified' | 'special_day28_certificate_flow';
  original_bytes_downloaded: boolean;
  runtime_url?: string;
}

export interface LearningDayManifestItem {
  day_number: number;
  week_number: 1 | 2 | 3 | 4;
  title_transcribed: string;
  slogan_transcribed: string;
  cover_asset?: AssetRef;
  primary_asset: AssetRef;
  info_asset: AssetRef;
  medal_asset: AssetRef;
  source_ref: string;
  practice_steps: string[];
  self_eval_heading: string;
  self_eval_items: string[];
  qr_note?: string;
  ocr_status: 'transcribed_from_full_flashcard_png' | 'not_transcribed';
  info_ocr_status: 'verified_in_drive_and_downloaded' | 'verified_in_drive_metadata_only' | 'not_yet_verified_in_drive';
  publish_status: 'draft_pending_asset_and_content_verification' | 'published';
  clinical_review_flag: boolean;
  clinical_review_note?: string;
  question_ids: string[];
  next_day: number | null;
  completion_type: 'self_reported';
  source_version: string;
}

export interface WeekMapAssetItem {
  week_number: 1 | 2 | 3 | 4;
  title: string;
  asset_name: string;
  drive_id: string;
  runtime_url: string;
  cover_asset_name: string;
  cover_drive_id: string;
  cover_runtime_url: string;
  days_range: [number, number];
}

export interface HotspotBoxPct {
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface PressArticleMapping {
  position: string;
  row: number;
  col: number;
  title: string;
  outlet: string;
  url: string;
  hotspot: HotspotBoxPct;
}

export interface TeamMemberMapping {
  id: string;
  position: string;
  row: number;
  col: number;
  name: string;
  role: string;
  cvAssetName: string;
  cvWordRequestedName: string;
  cvDriveId: string;
  cvRuntimeUrl: string;
  contactAssetName: string;
  contactDriveId: string;
  contactRuntimeUrl: string;
  highlight: string;
  hotspot: HotspotBoxPct;
}

export interface ProfessionalCertificateMapping {
  index: number;
  title: string;
  issuer: string;
  assetName: string;
  driveId: string;
  runtimeUrl: string;
  driveViewUrl: string;
  scopeNote: string;
}

export interface SourceVerificationEntry {
  category:
    | 'flashcard_composite'
    | 'week_maps'
    | 'day_primary'
    | 'day_info'
    | 'day_medal'
    | 'library_assets'
    | 'ui_branding';
  asset_key: string;
  word_spec_name: string;
  actual_drive_name: string;
  drive_id: string | null;
  in_runtime_bundle: boolean;
  runtime_path: string | null;
  verification_status:
    | 'RUNTIME_READY'
    | 'DRIVE_METADATA_VERIFIED_BYTES_PENDING'
    | 'MISSING_IN_DRIVE_SOURCE'
    | 'SPECIAL_FLOW';
  note: string;
}

export const DRIVE_FOLDER_URL = 'https://drive.google.com/drive/folders/17jX1J0xhyvYG5lfKrTMu6fdViTQsg9M6';
export const DRIVE_COVER_FOLDER_URL = 'https://drive.google.com/drive/folders/1EggVzvXD4fh2i8De52TBSnXCQ3KP0b3v?usp=sharing';
export const RUNTIME_FULL_FLASHCARD_PATH = '/assets/drive/Flashcard%20full%2028%20ngay.webp';

export const UI_BRANDING_ASSETS = {
  logo1Url: '/assets/drive/logo1.png',
  logo1DriveId: '1gQHY1UhxP95eR_2lnzkjdeVuIKY_4wre',
  bgUrl: '/assets/drive/bg.png',
  bgDriveId: '1dC97U-W3aqXUMMtQ8FUgXxF2VsFeJjlL',
  homeUrl: '/assets/drive/home.png',
  homeDriveId: '10sXGqKFKDTNsFEfIheb221lObJryHVXE',
  mucLucUrl: '/assets/drive/mucluc.png',
  mucLucDriveId: '1CMbGYtU_F3QCB1lbTliSspGmgVCsQALD',
  clickAudioUrl: '/assets/drive/click.mp3',
  clickAudioDriveId: '1zN4kv4McZgo9lq7LlHHK2yAnaBQY0F46',
  pressCompositeUrl: '/assets/drive/Bao.png',
  pressCompositeDriveId: '1C8c7qbHO6Cd3WhYkapbsSkdc-HYUBq0q',
  teamCompositeUrl: '/assets/drive/team.png',
  teamCompositeDriveId: '1ylsvmXPTgEPJwkKaOX-YVDDHVe5_6NgT',
} as const;

export const WEEK_MAPS_4: WeekMapAssetItem[] = [
  {
    week_number: 1,
    title: 'Tuần 1: Làm quen Tư thế & Góc học tập chuẩn',
    asset_name: 'Tuan1.png',
    drive_id: '1G9Py5hn3W3jVBdPJdDEKv4UV7h5W8Lry',
    runtime_url: '/assets/drive/Tuan1.png',
    cover_asset_name: 'Tuan 1.png',
    cover_drive_id: WEEK_COVER_DRIVE_IDS[1],
    cover_runtime_url: '/assets/drive/Tuan%201.webp',
    days_range: [1, 7],
  },
  {
    week_number: 2,
    title: 'Tuần 2: Chăm sóc & Thư giãn Đôi mắt sáng',
    asset_name: 'Tuan2.png',
    drive_id: '1I2_dvW3OT19QE2WtZSlIxJlw9uaFgT0g',
    runtime_url: '/assets/drive/Tuan2.png',
    cover_asset_name: 'Tuan 2.png',
    cover_drive_id: WEEK_COVER_DRIVE_IDS[2],
    cover_runtime_url: '/assets/drive/Tuan%202.webp',
    days_range: [8, 14],
  },
  {
    week_number: 3,
    title: 'Tuần 3: Vận động Cơ – Xương & Nhóm bạn cùng tiến',
    asset_name: 'Tuan3.png',
    drive_id: '129HfWqOS3urEGFc2fpYhjRfj1CR4NQ6n',
    runtime_url: '/assets/drive/Tuan3.png',
    cover_asset_name: 'Tuan 3.png',
    cover_drive_id: WEEK_COVER_DRIVE_IDS[3],
    cover_runtime_url: '/assets/drive/Tuan%203.webp',
    days_range: [15, 21],
  },
  {
    week_number: 4,
    title: 'Tuần 4: Tự giác, Sáng tạo & Nhận Chứng nhận 28 Ngày',
    asset_name: 'Tuan4.png',
    drive_id: '1Eozisvm2UaEVVnhkN_vVjy7z6KJPbspj',
    runtime_url: '/assets/drive/Tuan4.png',
    cover_asset_name: 'Tuan 4.png',
    cover_drive_id: WEEK_COVER_DRIVE_IDS[4],
    cover_runtime_url: '/assets/drive/Tuan%204.webp',
    days_range: [22, 28],
  },
];

export const EXTERNAL_LINKS = {
  botAiGpt: 'https://chatgpt.com/g/g-68ebb31724f88191953cf12f08d5d819-brightupgenz',
  facebookCommunity: 'https://www.facebook.com/profile.php?id=61591629700255',
  superAdminBootstrapEmail: 'minhquantran4312@gmail.com',
  certificateRecipientMailto:
    'mailto:minhquantran4312@gmail.com?subject=Y%C3%AAu%20c%E1%BA%A7u%20nh%E1%BA%ADn%20Ch%E1%BB%A9ng%20nh%E1%BA%ADn%2028%20Ng%C3%A0y%20BrightUpGenZ',
} as const;

// 6 URL Báo chí theo đúng vị trí 3 dòng x 2 cột trên ảnh Bao.png (430x1400)
// Tọa độ hotspot (left, top, width, height tính theo %) khớp chính xác khung viền trắng từng bài trên Bao.png
export const PRESS_LINKS: PressArticleMapping[] = [
  {
    position: 'Hàng 1 - Trái (Dòng 1 · Cột 1)',
    row: 1,
    col: 1,
    outlet: 'RA Journal of Applied Research',
    title: 'Golden Posture – Bright Eyes Flashcard Set: Guiding Proper Sitting Posture and Protecting Vision for Secondary School Students',
    url: 'https://rajournals.in/index.php/rajar/article/view/1797',
    hotspot: { left: 2.33, top: 8.93, width: 46.51, height: 27.86 },
  },
  {
    position: 'Hàng 1 - Phải (Dòng 1 · Cột 2)',
    row: 1,
    col: 2,
    outlet: 'Google Scholar Citation (View article)',
    title: 'Golden Posture – Bright Eyes Flashcard Set (Google Scholar Indexing & Citation)',
    url: 'https://scholar.google.com/citations?view_op=view_citation&hl=en&user=izj-rw0AAAAJ&sortby=pubdate&citation_for_view=izj-rw0AAAAJ:8IsQavbT1M8C',
    hotspot: { left: 50.93, top: 8.93, width: 46.51, height: 27.86 },
  },
  {
    position: 'Hàng 2 - Trái (Dòng 2 · Cột 1)',
    row: 2,
    col: 1,
    outlet: 'Zenodo Open Science Repository',
    title: 'Golden Posture – Bright Eyes Flashcard Set (Zenodo Record #17556640)',
    url: 'https://zenodo.org/records/17556640',
    hotspot: { left: 2.33, top: 38.86, width: 46.51, height: 28.57 },
  },
  {
    position: 'Hàng 2 - Phải (Dòng 2 · Cột 2)',
    row: 2,
    col: 2,
    outlet: 'LinkedIn · RA Journal of Applied Research',
    title: 'Study: Flashcards Improve Posture and Vision in Vietnamese Students',
    url: 'https://www.linkedin.com/posts/ra-journal-of-applied-research-5a3889111_appliedresearch-publichealth-educationinnovation-activity-7392822625502232576-d78z?utm_source=share&utm_medium=member_desktop&rcm=ACoAABwSeAsB3mvh-Z8jbarMjTyjaWuanddphNk',
    hotspot: { left: 50.93, top: 38.86, width: 46.51, height: 28.57 },
  },
  {
    position: 'Hàng 3 - Trái (Dòng 3 · Cột 1)',
    row: 3,
    col: 1,
    outlet: 'Index Copernicus International',
    title: 'ICI World of Journals — Golden Posture – Bright Eyes Flashcard Set (Article ID 4676161)',
    url: 'https://journals.indexcopernicus.com/search/article?articleId=4676161',
    hotspot: { left: 2.33, top: 69.5, width: 46.51, height: 28.57 },
  },
  {
    position: 'Hàng 3 - Phải (Dòng 3 · Cột 2)',
    row: 3,
    col: 2,
    outlet: 'Báo Đà Nẵng',
    title: 'Để ý tưởng khởi nghiệp từ cuộc thi bước vào thực tế',
    url: 'https://baodanang.vn/de-y-tuong-khoi-nghiep-tu-cuoc-thi-buoc-vao-thuc-te-3346332.html',
    hotspot: { left: 50.93, top: 69.5, width: 46.51, height: 28.57 },
  },
];

export const TEAM_MEMBERS: TeamMemberMapping[] = [
  {
    id: 'quan',
    position: 'Dòng 1 · Cột 1',
    row: 1,
    col: 1,
    name: 'Trần Minh Quân',
    role: 'Nhà sáng lập dự án & Tác giả giải pháp Robot - Flashcard',
    cvAssetName: 'Quan CV.png',
    cvWordRequestedName: 'Quan CV.png',
    cvDriveId: '1udJ4eRg1UdrCav63P7cOxPvXq-XB1XfY',
    cvRuntimeUrl: '/assets/drive/Quan%20CV.png',
    contactAssetName: 'in4 Quan.png',
    contactDriveId: '1CKIvEHkKxNoh3OiKvzPFGEN9xMQDmBSo',
    contactRuntimeUrl: '/assets/drive/in4%20Quan.png',
    highlight: 'Bấm vào vị trí Dòng 1 Cột 1 trên team.png mở Quan CV.png; bấm Liên hệ mở in4 Quan.png.',
    hotspot: { left: 3.49, top: 14.47, width: 44.19, height: 32.69 },
  },
  {
    id: 'chip',
    position: 'Dòng 1 · Cột 2',
    row: 1,
    col: 2,
    name: 'Thành viên Thiết kế & Học liệu (Chip)',
    role: 'Thiết kế Flashcard & Minh họa trực quan',
    cvAssetName: 'chip CV.png',
    cvWordRequestedName: 'Chip CV.png',
    cvDriveId: '1CmD5L8d-oKlBdGTW5QIPAttMk34K2zPY',
    cvRuntimeUrl: '/assets/drive/chip%20CV.png',
    contactAssetName: 'in4 chip.png',
    contactDriveId: '1Jolhun-iHpKUuDgVSQ5DTSosmT1EZBII',
    contactRuntimeUrl: '/assets/drive/in4%20chip.png',
    highlight: 'Bấm vào vị trí Dòng 1 Cột 2 trên team.png mở chip CV.png; bấm Liên hệ mở in4 chip.png.',
    hotspot: { left: 52.33, top: 14.47, width: 44.19, height: 32.69 },
  },
  {
    id: 'leader',
    position: 'Dòng 2 · Cột 1',
    row: 2,
    col: 1,
    name: 'Nhóm Điều phối & Phát triển Cộng đồng (Leade)',
    role: 'Điều phối triển khai trường học & Truyền thông',
    cvAssetName: 'leade CV.png',
    cvWordRequestedName: 'leade CV.png',
    cvDriveId: '1Bd51zAr7fbYZJwE-wMwgtoQo8Kd2W2bH',
    cvRuntimeUrl: '/assets/drive/leade%20CV.png',
    contactAssetName: 'in4 leade.png',
    contactDriveId: '1UW88hPkscGrwW4cbY7DZ84Gd5vehJySP',
    contactRuntimeUrl: '/assets/drive/in4%20leade.png',
    highlight: 'Bấm vào vị trí Dòng 2 Cột 1 trên team.png mở leade CV.png; bấm Liên hệ mở in4 leade.png.',
    hotspot: { left: 3.49, top: 50.05, width: 44.19, height: 33.01 },
  },
  {
    id: 'thuy',
    position: 'Dòng 2 · Cột 2',
    row: 2,
    col: 2,
    name: 'Cố vấn / Đồng hành chuyên môn (Thúy)',
    role: 'Cố vấn sư phạm & Đồng hành nội dung',
    cvAssetName: 'Thúy CV.png',
    cvWordRequestedName: 'Thúy CV.png',
    cvDriveId: '1skwzHwT8hjObrub9mtGCTRYJOQ5LITIX',
    cvRuntimeUrl: '/assets/drive/Th%C3%BAy%20CV.png',
    contactAssetName: 'in4 Thúy.png',
    contactDriveId: '1WJCryU2SDZhcm7b4-ASiOuNQWGzykkDL',
    contactRuntimeUrl: '/assets/drive/in4%20Th%C3%BAy.png',
    highlight: 'Bấm vào vị trí Dòng 2 Cột 2 trên team.png mở Thúy CV.png; bấm Liên hệ mở in4 Thúy.png.',
    hotspot: { left: 52.33, top: 50.05, width: 44.19, height: 33.01 },
  },
];

export const PROFESSIONAL_CERTIFICATES: ProfessionalCertificateMapping[] = [
  {
    index: 1,
    title: 'Bệnh viện Phục hồi chức năng Việt Pháp',
    issuer: 'Bệnh viện Phục hồi chức năng Việt Pháp',
    assetName: 'Bệnh viện Phục hồi chức năng Việt Pháp.png',
    driveId: '1hXL4h0SM_BUhJ5t61L2mZkkl66uu8ZbQ',
    runtimeUrl: '/assets/drive/B%E1%BB%87nh%20vi%E1%BB%87n%20Ph%E1%BB%A5c%20h%E1%BB%93i%20ch%E1%BB%A9c%20n%C4%83ng%20Vi%E1%BB%87t%20Ph%C3%A1p.png',
    driveViewUrl: 'https://drive.google.com/file/d/1hXL4h0SM_BUhJ5t61L2mZkkl66uu8ZbQ/view?usp=drive_link',
    scopeNote: 'Áp dụng cho học liệu Flashcard trong hồ sơ gốc. Không tự động thay thế kiểm định thiết bị y tế cho Robot hay Webapp mới.',
  },
  {
    index: 2,
    title: 'Trung tâm Y tế khu vực Hải Châu',
    issuer: 'Trung tâm Y tế khu vực Hải Châu',
    assetName: 'Trung tâm Y tế khu vực Hải Châu.png',
    driveId: '1GL4C5LHZ4jXTbv15hizFklxkteJD2A_q',
    runtimeUrl: '/assets/drive/Trung%20t%C3%A2m%20Y%20t%E1%BA%BF%20khu%20v%E1%BB%B1c%20H%E1%BA%A3i%20Ch%C3%A2u.png',
    driveViewUrl: 'https://drive.google.com/file/d/1GL4C5LHZ4jXTbv15hizFklxkteJD2A_q/view?usp=drive_link',
    scopeNote: 'Áp dụng cho học liệu Flashcard trong hồ sơ gốc. Không tự động thay thế kiểm định thiết bị y tế cho Robot hay Webapp mới.',
  },
  {
    index: 3,
    title: 'Trung tâm Y tế khu vực Sơn Trà',
    issuer: 'Trung tâm Y tế khu vực Sơn Trà',
    assetName: 'Trung tâm Y tế khu vực Sơn Trà.png',
    driveId: '1Lmwgji1YiG80gpY5rl4ZoewUifsT4Ohp',
    runtimeUrl: '/assets/drive/Trung%20t%C3%A2m%20Y%20t%E1%BA%BF%20khu%20v%E1%BB%B1c%20S%C6%A1n%20Tr%C3%A0.png',
    driveViewUrl: 'https://drive.google.com/file/d/1Lmwgji1YiG80gpY5rl4ZoewUifsT4Ohp/view?usp=drive_link',
    scopeNote: 'Áp dụng cho học liệu Flashcard trong hồ sơ gốc. Không tự động thay thế kiểm định thiết bị y tế cho Robot hay Webapp mới.',
  },
  {
    index: 4,
    title: 'Trung tâm Y tế khu vực Thanh Khê',
    issuer: 'Trung tâm Y tế khu vực Thanh Khê',
    assetName: 'Trung tâm Y tế khu vực Thanh Khê.png',
    driveId: '13YHMKD4Lxj2cKtbhOXwuzvzLb4jRZ1sX',
    runtimeUrl: '/assets/drive/Trung%20t%C3%A2m%20Y%20t%E1%BA%BF%20khu%20v%E1%BB%B1c%20Thanh%20Kh%C3%AA.png',
    driveViewUrl: 'https://drive.google.com/file/d/13YHMKD4Lxj2cKtbhOXwuzvzLb4jRZ1sX/view?usp=drive_link',
    scopeNote: 'Áp dụng cho học liệu Flashcard trong hồ sơ gốc. Không tự động thay thế kiểm định thiết bị y tế cho Robot hay Webapp mới.',
  },
];

export const ASSET_NAME_NORMALIZATION: Record<string, { actualDriveName: string; status: string; note: string }> = {
  'Baochi.png': {
    actualDriveName: 'Bao.png',
    status: 'mapped_to_existing_drive_file',
    note: 'Tài liệu Word ghi Baochi.png; thư mục Drive thực tế là Bao.png (ID: 1C8c7qbHO6Cd3WhYkapbsSkdc-HYUBq0q) — đã tải về /assets/drive/Bao.png.',
  },
  'Chip CV.png': {
    actualDriveName: 'chip CV.png',
    status: 'mapped_case_normalized',
    note: 'Chuẩn hóa chữ hoa/thường theo file thực tế trên Drive (ID: 1CmD5L8d-oKlBdGTW5QIPAttMk34K2zPY) — đã tải về /assets/drive/chip CV.png.',
  },
  'in4 Leade.png': {
    actualDriveName: 'in4 leade.png',
    status: 'mapped_case_normalized',
    note: 'Chuẩn hóa chữ hoa/thường theo file thực tế trên Drive (ID: 1UW88hPkscGrwW4cbY7DZ84Gd5vehJySP) — đã tải về /assets/drive/in4 leade.png.',
  },
  'in4 d27.png': {
    actualDriveName: 'in4 d27.png',
    status: 'not_yet_verified',
    note: 'Ngày 27 (Không Flashcard!): chưa có file in4 d27.png trên thư mục Drive gốc; giữ trạng thái thông báo trung thực, không tự bịa nội dung y khoa thay thế.',
  },
  'in4 d28.png': {
    actualDriveName: 'in4 d28.png',
    status: 'not_yet_verified',
    note: 'Ngày 28 (Nhận chứng nhận): chưa có file in4 d28.png trên thư mục Drive gốc; dẫn sang luồng Yêu cầu nhận chứng nhận.',
  },
  'HC d28.png': {
    actualDriveName: 'HC d28.png',
    status: 'special_day28_certificate_flow',
    note: 'Ngày 28 không dùng huy chương lẻ mà chuyển thẳng tới trang Yêu cầu nhận chứng nhận hoàn thành 28 ngày.',
  },
};

interface RawDaySpec {
  day: number;
  week: 1 | 2 | 3 | 4;
  title: string;
  slogan: string;
  primaryId: string;
  infoId: string | null;
  infoStatus?: 'verified' | 'not_yet_verified';
  medalId: string | null;
  medalStatus?: 'verified' | 'special_day28_certificate_flow';
  steps: string[];
  evalHeading?: string;
  evalItems: string[];
  qrNote?: string;
  clinicalFlag?: boolean;
  clinicalNote?: string;
  questionIds?: string[];
}

const RAW_28_DAYS: RawDaySpec[] = [
  {
    day: 1,
    week: 1,
    title: 'Ngồi thẳng nào!',
    slogan: 'Vai thả lỏng, lưng thẳng, đầu thẳng',
    primaryId: '1H9-RBf8qY2-vX6ZeFxEki8SeqLQ3Zfjl',
    infoId: '1zpOeK5-Os7rfW1EKNnB3S7QpqBplwV5e',
    medalId: '1AXnyEiL0805dCOD43hlSyTtMSoz1rRnW',
    steps: [
      '1. Ngồi thẳng lưng, tựa nhẹ vào ghế, vai thả lỏng.',
      '2. Mắt cách vở 30 – 35 cm (ước lượng bằng một cánh tay).',
      '3. Đầu thẳng, không cúi hoặc ngửa quá.',
      '4. Hai chân chạm sàn, không ngồi vắt chéo chân.',
      '5. Giữ tư thế đúng trong 15 phút liên tục, sau đó nghỉ 1 phút vươn vai.',
    ],
    evalItems: [
      'Giữ đúng tư thế trong 15 phút.',
      'Cảm thấy dễ chịu hơn khi học.',
      'Cần nhớ lại vị trí ngồi khi học buổi tối.',
    ],
    qrNote: 'Bạn hãy làm khảo sát 1!',
    questionIds: ['BUGZ-Q001', 'BUGZ-Q004', 'BUGZ-Q008', 'BUGZ-Q020', 'BUGZ-Q021'],
  },
  {
    day: 2,
    week: 1,
    title: 'Khoảng cách 30cm',
    slogan: 'Giữ sách cách mắt 30 cm - nhỏ thôi nhưng bảo vệ đôi mắt to!',
    primaryId: '1IUgyKrnQlzklKo4jYOk57ru1SvATS79a',
    infoId: '1BmLo787PUleBPdA0_CTUBMflSqZ8wsZE',
    medalId: '16Bg5yFoRkc8WCVxLnPWpWYWgD6u2HRel',
    steps: [
      '1. Ngồi thẳng lưng, đầu ngẩng cao.',
      '2. Đặt khuỷu tay lên bàn, từ mắt đến ngón tay mở = khoảng 30 cm.',
      '3. Nếu thấy gần hơn thế, lùi sách ra xa hoặc dùng giá đỡ.',
      '4. Kiểm tra khoảng cách 3 lần/ngày: sáng – trưa – tối.',
    ],
    evalItems: [
      'Giữ được khoảng cách 30 cm khi viết, đọc.',
      'Mắt thấy thoải mái hơn khi học liên tục.',
      'Nhắc bạn bên cạnh đo thử cùng mình.',
    ],
    questionIds: ['BUGZ-Q021', 'BUGZ-Q022', 'BUGZ-Q036'],
  },
  {
    day: 3,
    week: 1,
    title: 'Mắt nhìn ngang tầm',
    slogan: 'Giữ ánh nhìn ngang tầm - học vui không mỏi cổ!',
    primaryId: '12XXdEoMzDfW5JYglr8wDuV_lQk6EqvSh',
    infoId: '1WQ0PKAsHkjalzcuh3K3-tKpgGgyfCTfn',
    medalId: '159mflUTwJmq6lT5eyNisbVDzIrnDp6y8',
    steps: [
      '1. Khi ngồi học, tầm mắt nên ngang với ⅓ trên của trang sách hoặc màn hình.',
      '2. Không cúi đầu quá 20° – nếu phải nhìn xuống nhiều, dùng giá đỡ sách.',
      '3. Khi dùng laptop, kê thêm 1–2 quyển sách bên dưới để nâng màn hình.',
      '4. Thực hành kiểm tra tư thế của mình 3 lần/ngày: sáng – trưa – tối.',
    ],
    evalItems: [
      'Giữ mắt ngang tầm trong 15 phút học.',
      'Cảm giác cổ và vai thoải mái hơn.',
      'Điều chỉnh xong góc học tập có "tầm nhìn đúng tầm mắt".',
    ],
    questionIds: ['BUGZ-Q004', 'BUGZ-Q037'],
  },
  {
    day: 4,
    week: 1,
    title: 'Ánh sáng vừa đủ',
    slogan: 'Hôm nay kiểm tra góc học xem đèn có đúng vị trí chưa nào?',
    primaryId: '1vqBDan0ZbaE7ai9TgskoXamRwRqDjlhI',
    infoId: '12uP3wtH6Wi2ABucIiZy873nE0RqlFXqi',
    medalId: '1QDWzH0Cd1tH6ECtqC4V0QZte-zuUHjbu',
    steps: [
      '1. Bật đèn bàn trước khi trời tối; đặt đèn phía trái nếu em thuận tay phải.',
      '2. Kiểm tra bóng đổ – nếu bóng tay che vở -> đổi góc đèn.',
      '3. Tránh ngồi đối diện ánh sáng mạnh hoặc bóng đèn trần chiếu thẳng.',
      '4. Duy trì ánh sáng ổn định suốt buổi học – không chớp nhấp nháy.',
    ],
    evalItems: [
      'Kiểm tra vị trí đèn học và ánh sáng phòng.',
      'Không còn cảm giác lóa hoặc mỏi mắt.',
      'Giới thiệu góc học có đủ sáng cùng bố/mẹ hoặc bạn bè.',
    ],
    questionIds: ['BUGZ-Q023', 'BUGZ-Q024', 'BUGZ-Q036'],
  },
  {
    day: 5,
    week: 1,
    title: 'Bàn ghế vừa tầm',
    slogan: 'Hôm nay đo thử xem bàn ghế của bạn đã hợp chưa?',
    primaryId: '1EJSl7P7q8Xi_fpn9M5-Wj5XgmqRnxbFy',
    infoId: '1TO6qZWinxMbGpk4uhwxImFSGqgL-uKbu',
    medalId: '1qQLYEIElga-VXMhOd0JzW_2uGCnN67R3',
    steps: [
      '1. Ngồi thử lại bàn học: kiểm tra xem cẳng tay có ngang mặt bàn không.',
      '2. Nếu bàn quá cao -> kê thêm gối ngồi hoặc đổi ghế.',
      '3. Nếu bàn quá thấp -> kê thêm sách dưới chân bàn hoặc dùng giá đỡ vở.',
      '4. Kiểm tra dáng ngồi trong gương hoặc nhờ bạn chụp lại tư thế.',
    ],
    evalItems: [
      'Cẳng tay ngang mặt bàn.',
      'Hai chân chạm sàn, đầu gối vuông góc.',
      'Không còn gập người hoặc rướn cổ.',
    ],
    questionIds: ['BUGZ-Q002', 'BUGZ-Q003', 'BUGZ-Q006', 'BUGZ-Q020'],
  },
  {
    day: 6,
    week: 1,
    title: 'Không nằm đọc!',
    slogan: 'Đọc nằm - mắt than, đọc đứng - mắt sáng!',
    primaryId: '1uhL6Pd3VFFv8JjqzCH5G3VFrnHgc4kPd',
    infoId: '1T5Ylz0OrDVLa1qq-yj4LQqzPB0I69elR',
    medalId: '1D2pQupgspX70QRZ0b0j6QtWSpD_iQXXv',
    steps: [
      '1. Không đọc khi nằm hoặc khi dựa lưng trên giường.',
      '2. Luôn ngồi thẳng lưng, giữ khoảng cách 30–35 cm với trang sách.',
      '3. Đặt sách trên bàn hoặc dùng giá đỡ để dễ quan sát.',
      '4. Khi đọc buổi tối, bật đèn bàn đủ sáng (300–500 lux).',
    ],
    evalItems: [
      'Hôm nay em không đọc sách khi nằm.',
      'Giữ đúng tư thế khi đọc buổi tối.',
      'Cảm thấy mắt dễ chịu hơn khi đọc sách lúc ngồi.',
    ],
    questionIds: ['BUGZ-Q035'],
  },
  {
    day: 7,
    week: 1,
    title: 'Thử thách đầu tiên',
    slogan: '30 phút đầu tiên - khởi đầu hành trình giữ dáng đẹp, mắt sáng!',
    primaryId: '15y9V_pUsy6_SXzqgtrnkIhRxibCvZIo5',
    infoId: '1DskKqRyWko87TSbsDx1ZkBMvzLpWTBDA',
    medalId: '1VTTt0xycL2jM0OqJ0DVlCeHZ2Ls3U-GW',
    steps: [
      '1. Chuẩn bị góc học đạt chuẩn (ánh sáng, bàn ghế, tư thế ngồi).',
      '2. Đặt hẹn giờ 30 phút – tập trung học hoặc đọc.',
      '3. Sau khi hoàn thành, ghi cảm nhận: Mắt có mỏi không? Cổ/lưng có đau không? Có giữ được tư thế chuẩn trong suốt 30 phút?',
    ],
    evalItems: [
      'Giữ tư thế đúng trọn 30 phút.',
      'Tập trung đúng trọn 30 phút.',
      'Tự hào đánh dấu "Tuần đầu tiên hoàn thành!".',
    ],
    qrNote: 'Bạn hãy làm khảo sát 2!',
    questionIds: ['BUGZ-Q015'],
  },
  {
    day: 8,
    week: 2,
    title: '20-20-20',
    slogan: 'Cứ sau 20 phút học, hãy cho đôi mắt nghỉ 20 giây.',
    primaryId: '1IUAZdeZ2Pb1qeYcMRGOmVJ7NvxieYzC1',
    infoId: '1O0BXVNQftPNu0q8AMl0t9bZds_ywQ2ZT',
    medalId: '1okEbrU9WunQi5yMZ1M8pbsvNNlirSL7l',
    steps: [
      '1. Học hoặc đọc 20 phút -> dừng lại, ngẩng đầu lên.',
      '2. Nhìn ra xa khoảng 6 mét (20 feet) – có thể là cây, tường, cửa sổ, bức tường xa.',
      '3. Giữ ánh nhìn đó ít nhất 20 giây, chớp mắt nhẹ 10 lần.',
    ],
    evalItems: [
      'Em đã thực hiện quy tắc 20–20–20 ít nhất 3 lần hôm nay.',
      'Mắt cảm thấy dễ chịu hơn khi học lâu.',
      'Không còn thấy khô, cay hoặc nặng mắt.',
    ],
    questionIds: ['BUGZ-Q025', 'BUGZ-Q026', 'BUGZ-Q027', 'BUGZ-Q038', 'BUGZ-Q040'],
  },
  {
    day: 9,
    week: 2,
    title: 'Chớp mắt 10 lần',
    slogan: 'Đôi mắt cũng cần chớp để thở - chớp 10 lần, nhẹ tênh cả đôi mi!',
    primaryId: '1nkn4C9tZiTZ3xzc92wS0HjEXD5kSIm-0',
    infoId: '1otyTT4VOzlwDHJuCgH_YAgSqy5MLoU2g',
    medalId: '1wjiohLfSiPZ3M4zryNESzdqTs9o4CEqk',
    steps: [
      '1. Sau mỗi 20–30 phút học hoặc nhìn màn hình, dừng lại 10 giây.',
      '2. Nhắm mắt nhẹ – mở ra 10 lần liên tiếp (không nhíu, không bóp chặt mí).',
      '3. Có thể xoa nhẹ hai lòng bàn tay, áp gần mắt để cảm nhận hơi ấm (không chạm trực tiếp).',
      '4. Uống đủ nước – giúp tuyến lệ tiết tốt hơn.',
    ],
    evalItems: [
      'Em đã thực hiện "chớp mắt 10 lần" ít nhất 3 lần trong ngày.',
      'Mắt cảm thấy dễ chịu hơn sau mỗi lần làm.',
      'Không còn thấy khô, cay hoặc nặng mắt.',
    ],
    questionIds: ['BUGZ-Q028', 'BUGZ-Q029'],
  },
  {
    day: 10,
    week: 2,
    title: 'Nhìn xa - gần',
    slogan: 'Đừng để mắt "đứng yên" - Cho đôi mắt vận động như cơ thể!',
    primaryId: '1tMo9CmuDya8H5vKmzk9IAjKIYyyX61Tm',
    infoId: '1Ga9zjOFezHxo3-IUtNcN1xSHC_pT9ZrX',
    medalId: '1DuXaVvKgtKdLLeS2un2LWP-akw8vwp_R',
    steps: [
      '1. Đứng hoặc ngồi ở tư thế thoải mái.',
      '2. Nhìn ra xa (cây, tòa nhà, điểm ngoài cửa sổ) trong 10 giây.',
      '3. Sau đó, nhìn lại vật gần (bút, sách, tay mình) trong 10 giây.',
      '4. Lặp lại 5 lần liên tiếp, hít thở chậm, thả lỏng vai.',
      '5. Có thể kết hợp bài tập này sau mỗi 30 phút học.',
    ],
    evalItems: [
      'Em đã tập nhìn xa – gần ít nhất 2 lần trong hôm nay.',
      'Cảm thấy mắt dễ chịu hơn, nhìn rõ hơn sau khi đổi tiêu cự.',
      'Nhớ được khoảng cách an toàn giữa mắt và sách khi quay lại học.',
    ],
    questionIds: ['BUGZ-Q032'],
  },
  {
    day: 11,
    week: 2,
    title: 'Massage mắt',
    slogan: 'Một phút massage - Đánh thức đôi mắt sáng trong!',
    primaryId: '1pS9sj2R7V-Yst3nGS-RjMhIVGp8yW2Sn',
    infoId: '15_STTw0XTZXnJpcX0nEWriTB2ERtlkQN',
    medalId: '1_fXe3kwqUucnz3XohhJot_cJNiwhZW2r',
    steps: [
      '1. Rửa tay sạch trước khi thực hiện.',
      '2. Nhắm mắt, dùng hai ngón trỏ và giữa xoa nhẹ quanh hốc mắt theo vòng tròn nhỏ 5–10 lần.',
      '3. Dùng đầu ngón tay ấn nhẹ vào thái dương trong 5 giây rồi thả lỏng.',
      '4. Áp hai lòng bàn tay ấm lên mắt (không đè trực tiếp vào nhãn cầu) trong 10 giây.',
      '5. Hít thở sâu 3 nhịp, chớp nhẹ 3–5 lần để mắt quen sáng.',
    ],
    evalItems: [
      'Em đã massage mắt ít nhất 2 lần hôm nay.',
      'Đôi mắt thấy ấm, nhẹ và dễ chịu hơn sau khi làm.',
      'Nhớ rửa tay sạch và không ấn mạnh vào nhãn cầu.',
    ],
    clinicalFlag: true,
    clinicalNote: 'Cần rà soát y khoa: nhấn mạnh chỉ xoa nhẹ quanh xương hốc mắt, tuyệt đối không ấn trực tiếp lên nhãn cầu.',
    questionIds: [],
  },
  {
    day: 12,
    week: 2,
    title: 'Rửa mặt bằng nước mát',
    slogan: 'Một làn nước mát - Xua tan mỏi mệt cho đôi mắt!',
    primaryId: '1nmnRWh2aCE0IXS64uPn75TSmCpzRnpR3',
    infoId: '1PjXTSlfhMKw4g_W9fJf8FwadnanTInMm',
    medalId: '10FI4j9uFvdh-cVhDeTlqV0iA5LUJW6N9',
    steps: [
      '1. Dùng nước sạch mát (không lạnh buốt).',
      '2. Vỗ nhẹ nước lên vùng quanh mắt và trán 3–5 lần.',
      '3. Nhắm mắt, vỗ nhẹ nước lên mí mắt để mi mắt được thư giãn.',
      '4. Dùng khăn mềm thấm khô nhẹ nhàng, không chà xát.',
      '5. Có thể thực hiện 2–3 lần/ngày: sau giờ học sáng, chiều và tối.',
    ],
    evalItems: [
      'Em đã rửa mặt bằng nước mát sau giờ học.',
      'Mắt thấy nhẹ, dễ chịu hơn sau khi làm.',
      'Em đã tránh dùng nước lạnh buốt hoặc chà xát mạnh quanh mắt.',
    ],
    clinicalFlag: true,
    clinicalNote: 'Cần rà soát y khoa: hướng dẫn nhắm mắt vỗ nhẹ nước sạch bên ngoài, không tạt nước trực tiếp vào mắt đang mở.',
    questionIds: [],
  },
  {
    day: 13,
    week: 2,
    title: 'Hạn chế màn hình sau 21h',
    slogan: 'Tắt màn hình - bật giấc mơ đẹp',
    primaryId: '1vOlyW6L9AKoWuUlm22Zxg5VkikC5epvO',
    infoId: '1FK1t6fLf0NTTC0AfVhKSv-veWmGokVbO',
    medalId: '1SzaNWvIrQHwXOeS75i-4EA4tqYA3Q81t',
    steps: [
      '1. Ghi lại thời gian dùng điện thoại trong ngày (đặc biệt sau 20h).',
      '2. Tắt hoặc cất màn hình trước 21h – để mắt và não được nghỉ.',
      '3. Trước khi ngủ, đọc sách giấy hoặc nghe nhạc nhẹ thay vì lướt màn hình.',
      '4. Dán nhãn nhỏ ở góc bàn học: "Sau 21h – nghỉ cho mắt sáng".',
    ],
    evalItems: [
      'Em đã dừng dùng điện thoại trước 21h hôm nay.',
      'Em thấy dễ ngủ và ít mỏi mắt hơn.',
      'Em đã ghi lại thời lượng sử dụng điện thoại vào mỗi ngày.',
    ],
    questionIds: ['BUGZ-Q030'],
  },
  {
    day: 14,
    week: 2,
    title: 'Nhìn xanh cho mắt khỏe',
    slogan: 'Nhìn cây xanh 2 phút - đôi mắt nói lời cảm ơn!',
    primaryId: '1plHixgYjuL3MPdWc9FLjQJ9zj4s-1M4T',
    infoId: '1aT0UcDGRHBP6K-IkPNsKy4Eb5pNd2hMd',
    medalId: '1clxvrQhM5FcF-U0X3yTLg-BOwcgDVt_T',
    steps: [
      '1. Khi học xong 1 tiết hoặc 30 phút đọc sách, rời mắt khỏi màn hình / vở, nhìn ra xa ít nhất 6 mét – khoảng 2 phút.',
      '2. Tập trung nhìn cây xanh, bầu trời, hoặc đồ vật màu xanh lá trong phòng.',
      '3. Trong lúc nhìn, thở chậm, chớp mắt nhẹ để mắt được dưỡng ẩm.',
    ],
    evalItems: [
      'Em đã nhìn ra xanh ít nhất 2 lần trong ngày học.',
      'Mắt em cảm thấy nhẹ và dễ chịu hơn.',
      'Hoàn thành khảo sát cảm nhận.',
    ],
    qrNote: 'Bạn hãy làm khảo sát 3!',
    questionIds: ['BUGZ-Q031', 'BUGZ-Q032'],
  },
  {
    day: 15,
    week: 3,
    title: 'Vươn vai mỗi giờ',
    slogan: 'Mỗi giờ vươn vai - Mỏi mệt bay ngay!',
    primaryId: '1I35cnQHKxiD3xrKtmRqtCkU1mx4c1q5c',
    infoId: '1Ty56MXHRZKQTbVbKWPiCFdaD4amvvRCW',
    medalId: '1Eninv07piitL3QNGRMxrOUqOKa7F_hVO',
    steps: [
      '1. Ngồi thẳng lưng.',
      '2. Đan hai tay vào nhau, vươn người lên cao trong 5 giây.',
      '3. Hít sâu – thở ra chậm 3 lần.',
      '4. Xoay vai nhẹ 5 vòng ra sau, 5 vòng ra trước.',
      '5. Nghiêng đầu nhẹ sang trái – phải mỗi bên 5 giây.',
      '6. Mỉm cười rồi tiếp tục học!',
    ],
    evalItems: [
      'Em đã thực hiện bài tập ít nhất 2 lần trong hôm nay.',
      'Cơ thể cảm thấy nhẹ và dễ thở hơn sau khi vươn vai.',
      'Nhớ lại hoặc nhắc bạn cùng vươn vai mỗi giờ học.',
    ],
    questionIds: ['BUGZ-Q005', 'BUGZ-Q013'],
  },
  {
    day: 16,
    week: 3,
    title: 'Xoay cổ nhẹ nhàng',
    slogan: 'Cổ xoay chậm - Mỏi biến mất!',
    primaryId: '1T45pvRnnwghkb_CZ1tDUu5K1Nyye2rD1',
    infoId: '1EdCGrDf1vlyRGwU_bN0oxI7Zm6AcM2aS',
    medalId: '1OtN5uMrNLSQJ45CETxy-5mLNKiUZll7R',
    steps: [
      '1. Ngồi thẳng lưng, mắt nhìn về phía trước.',
      '2. Quay đầu sang trái thật chậm và giữ 3 giây.',
      '3. Quay về giữa, rồi xoay sang phải đếm giữ 3 giây.',
      '4. Lặp lại 5 vòng mỗi bên.',
      '5. Nghiêng nhẹ đầu sang hai bên vai (tránh xoay tròn cổ 360 độ mạnh hoặc bẻ cổ).',
      '6. Hít sâu – thở chậm, cảm nhận cổ nhẹ ra.',
    ],
    evalItems: [
      'Em đã xoay cổ đủ 5 vòng chậm.',
      'Cổ em thấy nhẹ hơn và dễ quay hơn.',
      'Em nhớ ngồi thẳng lưng khi quay lại học tập.',
    ],
    clinicalFlag: true,
    clinicalNote: 'Cần rà soát y khoa: chỉ nghiêng/quay chậm trong biên độ sinh lý, không xoay cổ mạnh 360 độ hoặc tự bẻ cổ.',
    questionIds: [],
  },
  {
    day: 17,
    week: 3,
    title: 'Chống đẩy tường',
    slogan: 'Hoạt động thể chất - vai khỏe, lưng thẳng!',
    primaryId: '12m-jHiULkrQFBIYOeqLEgZI45Ong5am3',
    infoId: '1xd_Qpy6MBKz_ZGnd5O1UjS_pgCYxrc5s',
    medalId: '17s2Jfs2NEucYRneeDHy6EyvHoZ36LJDq',
    steps: [
      '1. Đứng thẳng, cách tường một sải tay.',
      '2. Đặt hai bàn tay lên tường, cao ngang hai vai.',
      '3. Giữ lưng, cổ, chân thành một đường thẳng.',
      '4. Hít vào khi hạ người gần tường.',
      '5. Thở ra khi đẩy người trở lại vị trí ban đầu.',
      '6. Thực hiện 10 lần liên tiếp, có thể lặp lại 2–3 hiệp/ngày.',
    ],
    evalItems: [
      'Em đã làm đủ 10 lần chống đẩy.',
      'Em thấy vai, tay và lưng khỏe hơn sau khi tập.',
      'Em có thể mời thêm bạn để vui và đều đặn hơn.',
    ],
    questionIds: [],
  },
  {
    day: 18,
    week: 3,
    title: 'Đi lại một phút',
    slogan: 'Mỗi 45 phút học - 1 phút đi lại cho khoẻ mạnh cả ngày!',
    primaryId: '1mFd9Y6q44PPIYqImuCsGjx0jNeFUJ8Ww',
    infoId: '1VSVtnAYJpCdSORIm68NVRChS_UjRIOiW',
    medalId: '15Uj5fenZNE0blE2tc16x37jaaRvclpKb',
    steps: [
      '1. Sau 45 phút học, đứng dậy khỏi ghế.',
      '2. Đi bộ chậm quanh bàn hoặc hành lang ít nhất 1 phút.',
      '3. Kết hợp vươn vai, xoay cổ, hít thở sâu 3 lần.',
      '4. Nhìn ra cửa sổ để mắt thư giãn.',
      '5. Sau đó trở lại bàn học, ngồi đúng tư thế, mắt nhìn ngang tầm.',
    ],
    evalItems: [
      'Em đã rời bàn học và đi lại ít nhất 1 phút sau mỗi 45 phút.',
      'Em thấy dễ chịu, tỉnh táo hơn.',
      'Em nhớ thực hiện đều mỗi buổi học.',
    ],
    questionIds: ['BUGZ-Q005', 'BUGZ-Q014'],
  },
  {
    day: 19,
    week: 3,
    title: 'Đặt lại bàn học',
    slogan: 'Không gian gọn - Tư thế chuẩn - Tinh thần sáng!',
    primaryId: '1S1Jj7iO_1QfG4YRv7c4yIp18FmQUcLtp',
    infoId: '1Z2MNSEWod2TOuLuwl8DHHuAsU2bES0tT',
    medalId: '1Xd-rlZuBbC7aZHNVQ30aryxfGuTe3EJd',
    steps: [
      '1. Dọn bàn học sạch, chỉ để sách vở đang dùng.',
      '2. Kiểm tra chiều cao bàn ghế.',
      '3. Kiểm tra ánh sáng.',
      '4. Trang trí góc học một cây nhỏ, khung ảnh nhỏ, hoặc vật yêu thích để tạo cảm xúc tích cực.',
    ],
    evalItems: [
      'Em đã chỉnh lại bàn và ghế vừa tầm.',
      'Góc học tập hôm nay của em sáng và gọn hơn.',
      'Em cảm thấy dễ tập trung và thoải mái hơn khi học.',
    ],
    questionIds: ['BUGZ-Q003', 'BUGZ-Q009'],
  },
  {
    day: 20,
    week: 3,
    title: 'Tư thế khi viết',
    slogan: 'Ngồi đúng - viết đẹp - học vui!',
    primaryId: '1ELNjR2N7S28zm5VxwwglrCA-xiWfzlp3',
    infoId: '1KmV3ohrBYIaGgFIBYEjMcaLLgSEYwI0z',
    medalId: '1ssBAjXpJ2Oh4o73qorwxtiAyUzyCxXWu',
    steps: [
      '1. Ngồi ngay ngắn, lưng thẳng, không tì ngực vào cạnh bàn.',
      '2. Giữ khoảng cách mắt – vở 30–35 cm.',
      '3. Cầm bút bằng 3 ngón, cổ tay thả lỏng.',
      '4. Đặt vở nghiêng nhẹ 15–20 độ về phía tay cầm bút.',
      '5. Quan sát gương hoặc nhờ bạn chụp ảnh để xem tư thế đã chuẩn chưa.',
    ],
    evalItems: [
      'Em đã ngồi thẳng khi viết bài.',
      'Mắt em cách vở khoảng 30 cm.',
      'Em cảm thấy cổ và vai rất nhẹ, thoải mái hơn.',
    ],
    questionIds: ['BUGZ-Q011'],
  },
  {
    day: 21,
    week: 3,
    title: 'Nhóm bạn cùng thẳng lưng',
    slogan: 'Một người thẳng lưng là tốt - cả nhóm thẳng lưng là tuyệt vời!',
    primaryId: '1HEOM0rxNyT9OKzuegzHr7kfMDgSFAF-U',
    infoId: '1flhX8SgHkkyKDrcbyAXkav27GoP6XscG',
    medalId: '1q9TTzhEHxSTkwAsM9-RewI5pozPXJ85v',
    steps: [
      '1. Rủ 2–3 bạn cùng tham gia "Thử thách thẳng lưng".',
      '2. Cùng nhau chụp 1 tấm ảnh hoặc vẽ minh họa nhóm ngồi học đúng tư thế.',
      '3. Trong mỗi tiết học, 1 bạn làm "Người quan sát" – nhắc khéo khi có bạn gù hoặc cúi.',
      '4. Cuối ngày, cả nhóm đánh giá xem ai giữ tư thế tốt nhất.',
    ],
    evalItems: [
      'Em và nhóm bạn đã cùng nhắc nhau thực hiện ít nhất 3 lần trong ngày.',
      'Cả nhóm đều ngồi thẳng lưng ít nhất 1 tiết học.',
      'Hoàn thành khảo sát cảm nhận.',
    ],
    qrNote: 'Bạn hãy làm khảo sát 4!',
    questionIds: ['BUGZ-Q007', 'BUGZ-Q012'],
  },
  {
    day: 22,
    week: 4,
    title: 'Kiểm tra tư thế bản thân',
    slogan: 'Lưng vuông - cao hơn - tự tin hơn!',
    primaryId: '1d8B-K0YEbVC0jlYva1IwB6cGsHwfyfcv',
    infoId: '1kQZUEvVPYYyEWPCnRbkfuCOHj9kh15WL',
    medalId: '1BCGVyPxXuVIVVlLSABw5hQwOlIxJGncJ',
    steps: [
      '1. Chuẩn bị: Một tấm gương lớn hoặc camera điện thoại (nhờ bố/mẹ hỗ trợ).',
      '2. Thực hành đứng nghiêng 90° và nhìn sang bên để thấy dáng lưng.',
      '3. Kiểm tra 3 điểm thẳng hàng: Tai – Vai – Hông cùng nằm trên một đường thẳng.',
      '4. Kiểm tra khi ngồi học: Nhìn gương hoặc nhờ người thân chụp ảnh tư thế ngồi.',
      '5. Nếu lưng bị cong, vai bị lệch, cổ đổ về trước -> điều chỉnh ngay rồi chụp lại để so sánh.',
    ],
    evalItems: [
      'Em đã chụp/gương soi tư thế đúng.',
      'Em nhận ra điểm cần chỉnh sửa.',
      'Em thấy mình thẳng và tự tin hơn.',
    ],
    questionIds: ['BUGZ-Q010'],
  },
  {
    day: 23,
    week: 4,
    title: 'Ghi nhật ký cảm giác mắt',
    slogan: 'Đôi mắt cũng biết kể chuyện - hôm nay chúng muốn nói gì với bạn?',
    primaryId: '11u_cuenEdFq7OZOQAu9aTtvEMWDbRYTz',
    infoId: '1wsNQIq_bIKNDJwUEWWh44yIiV4Fa5PKM',
    medalId: '1gGGnGW53m2uqzkaLN-1EUEpGPmmpqutX',
    steps: [
      '1. Sau một ngày học, hãy dừng lại 2 phút.',
      '2. Hỏi bản thân: "Mắt mình hôm nay thấy thế nào?"',
      '3. Ghi lại trạng thái của mắt: Sáng – khỏe – dễ chịu / Hơi mỏi, khô / Nặng mi, khó nhìn lâu.',
    ],
    evalHeading: 'Tại sao nên làm điều này?',
    evalItems: [
      'Khi ghi lại cảm giác của mắt mỗi ngày, bạn sẽ tự nhận ra những thói quen tốt/xấu ảnh hưởng đến đôi mắt.',
      'Nếu mắt dễ mỏi hơn -> điều chỉnh lại thời gian nhìn màn hình, ánh sáng và khoảng cách ngồi!',
    ],
    questionIds: ['BUGZ-Q029', 'BUGZ-Q033', 'BUGZ-Q034', 'BUGZ-Q038'],
  },
  {
    day: 24,
    week: 4,
    title: 'Chia sẻ mẹo của bạn',
    slogan: 'Mỗi người có một bí kíp riêng để mắt sáng - lưng thẳng. Hãy chia sẻ bí kíp của bạn nhé!',
    primaryId: '1guOb_VF1tseCb37hnlQIKz-jyprEtTRQ',
    infoId: '1_nFqzdFmwmA5eDnORnPafwnutyaADBlE',
    medalId: '1llrC3LUQSs9VJTfcEiiqvAhSZs1wf5Rd',
    steps: [
      '1. Viết một câu khuyên bạn bè về cách giữ mắt khỏe hoặc tư thế đúng.',
      '2. Trình bày trên giấy nhỏ, vẽ minh họa, hoặc gửi qua mục chia sẻ lớp học.',
    ],
    evalHeading: 'Tại sao nên làm điều này?',
    evalItems: [
      'Khi bạn chia sẻ, bạn đang củng cố thói quen của chính mình.',
      'Một lời nhắc nhỏ có thể giúp người khác tránh cận thị hoặc đau lưng!',
      'Đây cũng là một cách lan tỏa tinh thần "Mắt sáng – Học vui – Sống khỏe".',
    ],
    questionIds: ['BUGZ-Q039'],
  },
  {
    day: 25,
    week: 4,
    title: 'Sáng tạo flashcard riêng',
    slogan: 'Giờ đến lượt bạn trở thành nhà thiết kế - tạo ra thẻ học khỏe mạnh của chính mình!',
    primaryId: '1l_-6WoQ_0boQAzg9RfA1NHiJX68zctgh',
    infoId: '1WKcaQhOiIue1hia77h08tTJftyuIOjiR',
    medalId: '1R7mB_paq7EvH752cRgf5NfaGk5rQNG0b',
    steps: [
      '1. Nghĩ ra một thói quen tốt cho mắt hoặc tư thế học tập mà bạn muốn chia sẻ.',
      '2. Vẽ hoặc viết một thẻ flashcard mới: Mặt trước (tên hoạt động + hình minh họa), Mặt sau (hướng dẫn cách làm ngắn gọn, lý do có ích).',
      '3. Có thể dùng Canva, PowerPoint, hoặc vẽ tay rồi chụp ảnh.',
    ],
    evalHeading: 'Vì sao hoạt động này quan trọng?',
    evalItems: [
      'Khi tự sáng tạo, bạn biến kiến thức thành hành động thực tế.',
      'Việc tự nghĩ ra thẻ mới giúp bạn hiểu sâu hơn về cách bảo vệ mắt và tư thế đúng.',
      'Sản phẩm của bạn có thể được chọn làm "Thẻ vàng của khóa sau".',
    ],
    questionIds: ['BUGZ-Q016', 'BUGZ-Q039'],
  },
  {
    day: 26,
    week: 4,
    title: 'Nhắc bạn cùng làm',
    slogan: 'Một mình là thói quen - Cả nhóm là sức mạnh!',
    primaryId: '1iwxrIahwyP6qQ464vl4geLh-b2gXaDo9',
    infoId: '15WFbxpapxaL5Vu3QcC_v-8kKlh5fv45s',
    medalId: '1gEH06tYOGXAikeDN4stcQp64WigPvCyA',
    steps: [
      '1. Chọn ít nhất 1 người bạn cùng thực hiện thử thách "Mắt sáng – Lưng thẳng" để duy trì động lực lâu dài.',
      '2. Hẹn thời điểm nhắc nhau: "Giờ nghỉ giữa tiết, nhớ nhìn xa nhé!" hoặc "Ngồi thẳng lưng lên nào bạn ơi!".',
    ],
    evalItems: [
      'Nhắc đôi giữ thói quen ít nhất 2 lần với bạn.',
      'Cùng bạn thực hiện một bài tập mắt hoặc vươn vai hôm nay.',
    ],
    questionIds: ['BUGZ-Q007', 'BUGZ-Q017'],
  },
  {
    day: 27,
    week: 4,
    title: 'Không Flashcard!',
    slogan: 'Hãy sống - học - đọc - viết - ngồi - nhìn... như cách bạn thấy thoải mái và tự nhiên nhất.',
    primaryId: '1S2e9T28pZfUVTgI4i_yfqq6V8ERH383q',
    infoId: null,
    infoStatus: 'not_yet_verified',
    medalId: '1Mey-84FKEjcpooHQ-a-_ELrOhx6kpppK',
    steps: [
      '1. Trong hôm nay, có những khoảnh khắc nào bạn tự nhớ ngồi đúng hoặc nghỉ mắt mà không cần nhìn thẻ?',
      '2. Có thói quen nào bạn giữ được mà không cần nhắc nhở?',
      '3. Có thói quen nào vẫn cần cố gắng thêm?',
    ],
    evalItems: [
      'Ghi lại 2–3 thói quen tốt mà bạn đã tự nhớ làm hôm nay.',
      'Hoàn thành khảo sát cảm nhận.',
    ],
    qrNote: 'Bạn hãy làm khảo sát 5!',
    questionIds: ['BUGZ-Q018'],
  },
  {
    day: 28,
    week: 4,
    title: 'Nhận chứng nhận "Mắt sáng - Lưng thẳng"',
    slogan: 'Thói quen tốt không tự nhiên có - bạn đã tạo ra nó bằng nỗ lực mỗi ngày!',
    primaryId: '13fRcrc8X-cCY04R4eUGKw8_PhlkdrK_e',
    infoId: null,
    infoStatus: 'not_yet_verified',
    medalId: null,
    medalStatus: 'special_day28_certificate_flow',
    steps: [
      '1. Chụp lại một khoảnh khắc thể hiện thành quả của bạn (bàn học gọn gàng, tư thế đúng, góc sáng đẹp...).',
      '2. Gửi ảnh qua email để nhận chứng nhận hoặc điền biểu mẫu Yêu cầu nhận chứng nhận.',
      '3. Viết 1 câu cảm nghĩ ngắn: "Sau 28 ngày, mình cảm thấy...".',
    ],
    evalHeading: 'Chúc mừng bạn đã hoàn thành Hành trình 28 ngày!',
    evalItems: [
      'Mỗi thói quen tốt là món quà bạn tặng cho chính mình mỗi ngày. 💙',
      'Mở biểu mẫu Yêu cầu nhận chứng nhận (không có Ngày 29).',
    ],
    questionIds: ['BUGZ-Q019', 'BUGZ-Q040'],
  },
];

export const LEARNING_DAYS_28: LearningDayManifestItem[] = RAW_28_DAYS.map((spec) => ({
  day_number: spec.day,
  week_number: spec.week,
  title_transcribed: spec.title,
  slogan_transcribed: spec.slogan,
  cover_asset: {
    name: `cover d${spec.day}.png`,
    drive_id: DAY_COVER_DRIVE_IDS[spec.day] || null,
    status: 'verified',
    original_bytes_downloaded: false,
    runtime_url: `/assets/drive/cover%20d${spec.day}.webp`,
  },
  primary_asset: {
    name: `day${spec.day}.png`,
    drive_id: spec.primaryId,
    status: 'verified',
    original_bytes_downloaded: true,
    runtime_url: `/assets/drive/day${spec.day}.png`,
  },
  info_asset: {
    name: `in4 d${spec.day}.png`,
    drive_id: spec.infoId,
    status: spec.infoStatus ?? 'verified',
    original_bytes_downloaded: Boolean(spec.infoId),
    ...(spec.infoId ? { runtime_url: `/assets/drive/in4%20d${spec.day}.png` } : {}),
  },
  medal_asset: {
    name: `HC d${spec.day}.png`,
    drive_id: spec.medalId,
    status: spec.medalStatus ?? 'verified',
    original_bytes_downloaded: Boolean(spec.medalId),
    ...(spec.medalId ? { runtime_url: `/assets/drive/HC%20d${spec.day}.png` } : {}),
  },
  source_ref: 'PROJECT_FLASHCARDS (Google Drive folder 17jX1J0xhyvYG5lfKrTMu6fdViTQsg9M6 & Cover folder 1EggVzvXD4fh2i8De52TBSnXCQ3KP0b3v)',
  practice_steps: spec.steps,
  self_eval_heading: spec.evalHeading ?? 'Tự đánh giá ✅',
  self_eval_items: spec.evalItems,
  ...(spec.qrNote ? { qr_note: spec.qrNote } : {}),
  ocr_status: 'transcribed_from_full_flashcard_png',
  info_ocr_status: spec.infoId ? 'verified_in_drive_and_downloaded' : 'not_yet_verified_in_drive',
  publish_status: 'draft_pending_asset_and_content_verification',
  clinical_review_flag: Boolean(spec.clinicalFlag),
  ...(spec.clinicalNote ? { clinical_review_note: spec.clinicalNote } : {}),
  question_ids: spec.questionIds ?? [],
  next_day: spec.day < 28 ? spec.day + 1 : null,
  completion_type: 'self_reported',
  source_version: 'v1.4-p02-drive-covers-webp',
}));

export const SOURCE_VERIFICATION_REPORT: SourceVerificationEntry[] = [
  {
    category: 'day_primary',
    asset_key: 'cover d1.png..cover d28.png',
    word_spec_name: 'cover d1.png..cover d28.png (Thumbnail Cover 28 Ngày)',
    actual_drive_name: 'cover d1.png..cover d28.png (Thư mục Drive 1EggVzvXD4fh2i8De52TBSnXCQ3KP0b3v)',
    drive_id: '15FjqBJi-a0JsQPztsxg48hNhiQ8ylpYZ .. 1jx3oUZuThc-ay-KkPrj5pG0Agp3RyMr0',
    in_runtime_bundle: true,
    runtime_path: '/assets/drive/cover d1.webp .. /assets/drive/cover d28.webp',
    verification_status: 'RUNTIME_READY',
    note: 'Tham chiếu trực tiếp 28 ảnh cover d1.png..cover d28.png từ thư mục Google Drive (1EggVzvXD4fh2i8De52TBSnXCQ3KP0b3v), nén chuẩn WebP tự động qua Google FIFE Image CDN (-rw) và đệm tại /tmp/bugz-assets-cache (không lưu file hình ảnh trong kho mã nguồn).',
  },
  {
    category: 'day_primary',
    asset_key: 'day1.png..day28.png',
    word_spec_name: 'day1.png..day28.png',
    actual_drive_name: 'day1.png..day28.png (28 file rời trong thư mục Drive)',
    drive_id: '1H9-RBf8qY2-vX6ZeFxEki8SeqLQ3Zfjl .. 13fRcrc8X-cCY04R4eUGKw8_PhlkdrK_e',
    in_runtime_bundle: true,
    runtime_path: '/assets/drive/day1.png .. /assets/drive/day28.png',
    verification_status: 'RUNTIME_READY',
    note: 'Tham chiếu 28/28 file ảnh thẻ bài học gốc day1.png..day28.png từ thư mục Google Drive (17jX1J0xhyvYG5lfKrTMu6fdViTQsg9M6), nén WebP qua proxy /assets/drive/:filename.',
  },
  {
    category: 'week_maps',
    asset_key: 'Tuan1.png..Tuan4.png',
    word_spec_name: 'Tuan1.png, Tuan2.png, Tuan3.png, Tuan4.png',
    actual_drive_name: 'Tuan1.png, Tuan2.png, Tuan3.png, Tuan4.png',
    drive_id: '1G9Py5hn3W3jVBdPJdDEKv4UV7h5W8Lry, 1I2_dvW3OT19QE2WtZSlIxJlw9uaFgT0g, 129HfWqOS3urEGFc2fpYhjRfj1CR4NQ6n, 1Eozisvm2UaEVVnhkN_vVjy7z6KJPbspj',
    in_runtime_bundle: true,
    runtime_path: '/assets/drive/Tuan1.png .. /assets/drive/Tuan4.png',
    verification_status: 'RUNTIME_READY',
    note: 'Đã tải đủ cả 4 bản đồ tuần gốc Tuan1.png..Tuan4.png từ thư mục Google Drive vào /public/assets/drive/.',
  },
  {
    category: 'day_info',
    asset_key: 'in4 d1.png..in4 d26.png',
    word_spec_name: 'in4 d1.png..in4 d26.png',
    actual_drive_name: 'in4 d1.png..in4 d26.png (26 file rời trong thư mục Drive)',
    drive_id: '1zpOeK5-Os7rfW1EKNnB3S7QpqBplwV5e .. 15WFbxpapxaL5Vu3QcC_v-8kKlh5fv45s',
    in_runtime_bundle: true,
    runtime_path: '/assets/drive/in4 d1.png .. /assets/drive/in4 d26.png',
    verification_status: 'RUNTIME_READY',
    note: 'Đã tải đủ 26/26 file ảnh giải thích gốc in4 d1.png..in4 d26.png từ thư mục Google Drive vào /public/assets/drive/.',
  },
  {
    category: 'day_info',
    asset_key: 'in4 d27.png, in4 d28.png',
    word_spec_name: 'in4 d27.png, in4 d28.png',
    actual_drive_name: 'in4 d27.png, in4 d28.png',
    drive_id: null,
    in_runtime_bundle: false,
    runtime_path: null,
    verification_status: 'MISSING_IN_DRIVE_SOURCE',
    note: 'Chưa có trên thư mục Google Drive gốc (status: not_yet_verified). Tuyệt đối không tự viết giả thuyết y khoa thay thế.',
  },
  {
    category: 'day_medal',
    asset_key: 'HC d1.png..HC d27.png',
    word_spec_name: 'HC d1.png..HC d27.png',
    actual_drive_name: 'HC d1.png..HC d27.png (27 file rời trong thư mục Drive)',
    drive_id: '1AXnyEiL0805dCOD43hlSyTtMSoz1rRnW .. 1Mey-84FKEjcpooHQ-a-_ELrOhx6kpppK',
    in_runtime_bundle: true,
    runtime_path: '/assets/drive/HC d1.png .. /assets/drive/HC d27.png',
    verification_status: 'RUNTIME_READY',
    note: 'Đã tải đủ 27/27 file ảnh huy chương gốc HC d1.png..HC d27.png từ thư mục Google Drive vào /public/assets/drive/.',
  },
  {
    category: 'day_medal',
    asset_key: 'HC d28.png',
    word_spec_name: 'HC d28.png',
    actual_drive_name: 'special_day28_certificate_flow',
    drive_id: null,
    in_runtime_bundle: true,
    runtime_path: '/certificate-request',
    verification_status: 'SPECIAL_FLOW',
    note: 'Ngày 28 không dùng huy chương lẻ mà mở thẳng biểu mẫu Yêu cầu nhận chứng nhận hoàn thành 28 ngày.',
  },
  {
    category: 'flashcard_composite',
    asset_key: 'full flashcard.png',
    word_spec_name: 'full flashcard.png',
    actual_drive_name: 'full flashcard.png',
    drive_id: '1pXDx90HFAV-7oVSFmHv5m6_C8F8qUWdG',
    in_runtime_bundle: true,
    runtime_path: '/assets/drive/full flashcard.png',
    verification_status: 'RUNTIME_READY',
    note: 'Chỉ dùng cho mục menu "Xem Flashcard" (/library/flashcard) có điều khiển Zoom 100%–300%.',
  },
  {
    category: 'library_assets',
    asset_key: 'Bao.png (Word: Baochi.png)',
    word_spec_name: 'Baochi.png',
    actual_drive_name: 'Bao.png',
    drive_id: '1C8c7qbHO6Cd3WhYkapbsSkdc-HYUBq0q',
    in_runtime_bundle: true,
    runtime_path: '/assets/drive/Bao.png',
    verification_status: 'RUNTIME_READY',
    note: 'Đã tải Bao.png về /public/assets/drive/Bao.png và gắn đúng 6 URL báo chí/khoa học theo vị trí 3 dòng x 2 cột.',
  },
  {
    category: 'library_assets',
    asset_key: 'Team CVs & Contacts (9 files)',
    word_spec_name: 'team.png, Quan CV.png, Chip CV.png, in4 Leade.png, in4 Thúy.png, in4 Quan.png, in4 chip.png',
    actual_drive_name: 'team.png, Quan CV.png, chip CV.png, leade CV.png, Thúy CV.png, in4 leade.png, in4 Thúy.png, in4 Quan.png, in4 chip.png',
    drive_id: '1ylsvmXPTgEPJwkKaOX-YVDDHVe5_6NgT (team.png) + 8 hồ sơ',
    in_runtime_bundle: true,
    runtime_path: '/assets/drive/team.png, /assets/drive/Quan CV.png, ...',
    verification_status: 'RUNTIME_READY',
    note: 'Đã tải đầy đủ ảnh gốc team.png và toàn bộ CV/in4 của 4 thành viên về /public/assets/drive/.',
  },
  {
    category: 'library_assets',
    asset_key: 'Chứng nhận chuyên môn (4 bệnh viện / trung tâm y tế)',
    word_spec_name: 'Bệnh viện Phục hồi chức năng Việt Pháp.png, Trung tâm Y tế khu vực Hải Châu.png, Sơn Trà.png, Thanh Khê.png',
    actual_drive_name: 'Bệnh viện Phục hồi chức năng Việt Pháp.png, Trung tâm Y tế khu vực Hải Châu.png, Sơn Trà.png, Thanh Khê.png',
    drive_id: '1hXL4h0SM_BUhJ5t61L2mZkkl66uu8ZbQ, 1GL4C5LHZ4jXTbv15hizFklxkteJD2A_q, 1Lmwgji1YiG80gpY5rl4ZoewUifsT4Ohp, 13YHMKD4Lxj2cKtbhOXwuzvzLb4jRZ1sX',
    in_runtime_bundle: true,
    runtime_path: '/assets/drive/Bệnh viện Phục hồi chức năng Việt Pháp.png ...',
    verification_status: 'RUNTIME_READY',
    note: 'Đã tải đủ 4 ảnh giấy xác nhận chuyên môn gốc về /public/assets/drive/ và hiển thị slideshow.',
  },
  {
    category: 'ui_branding',
    asset_key: 'bg.png, logo1.png, home.png, mucluc.png',
    word_spec_name: 'bg.png, logo1.png, home.png, mucluc.png',
    actual_drive_name: 'bg.png, logo1.png, home.png, mucluc.png',
    drive_id: '1dC97U-W3aqXUMMtQ8FUgXxF2VsFeJjlL, 1gQHY1UhxP95eR_2lnzkjdeVuIKY_4wre, 10sXGqKFKDTNsFEfIheb221lObJryHVXE, 1CMbGYtU_F3QCB1lbTliSspGmgVCsQALD',
    in_runtime_bundle: true,
    runtime_path: '/assets/drive/bg.png, /assets/drive/logo1.png, /assets/drive/home.png, /assets/drive/mucluc.png',
    verification_status: 'RUNTIME_READY',
    note: 'Đã tải đủ bg.png, logo1.png, home.png, mucluc.png từ thư mục Google Drive vào /public/assets/drive/.',
  },
];

export const EXTERNAL_MENU_LINKS = {
  botAiUrl: EXTERNAL_LINKS.botAiGpt,
  communityFacebookUrl: EXTERNAL_LINKS.facebookCommunity,
  fullFlashcardDriveId: '1pXDx90HFAV-7oVSFmHv5m6_C8F8qUWdG',
  fullFlashcardUrl: RUNTIME_FULL_FLASHCARD_PATH,
  supportEmail: EXTERNAL_LINKS.superAdminBootstrapEmail,
};

export const GENTLE_VOICE_REMINDERS = [
  {
    id: 'R01',
    category: 'posture',
    text: 'Bạn nhỏ ơi, mình cùng nâng thẳng lưng và thả lỏng hai vai một chút để ngồi học thoải mái hơn nhé!',
  },
  {
    id: 'R02',
    category: 'eyes',
    text: 'Đôi mắt làm việc chăm chỉ rồi, mình giữ khoảng cách khoảng 30 đến 35 cm với mặt bàn và chớp mắt nhẹ nhé!',
  },
  {
    id: 'R03',
    category: 'break',
    text: 'Đã tới lúc áp dụng quy tắc 20-20-20 rồi! Cùng nhìn ra xa 6 mét trong 20 giây cho mắt thư giãn nào!',
  },
];
