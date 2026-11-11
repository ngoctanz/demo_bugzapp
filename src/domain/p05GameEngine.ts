import rawQuestionBank from '../../question_bank.json' with { type: 'json' };
import rawGameBlueprints from '../../game_blueprints.json' with { type: 'json' };
import rawIllustrationManifest from '../../illustration_manifest.json' with { type: 'json' };

export type IllustrationId = 'POSTURE' | 'DESK' | 'EYES' | 'MOVE';
export type QuestionTopic = 'lung_thang' | 'mat_sang';
export type QuestionStatus = 'editorial_draft' | 'published';
export type GameModeId = 'situations' | 'desk_builder' | 'habit_relay';

export interface QuestionOptionItem {
  id: 'A' | 'B' | 'C';
  text: string;
}

export interface QuestionApprovalState {
  content_reviewed: boolean;
  clinical_reviewed: boolean;
  reviewed_by?: string;
  reviewed_at?: number;
}

export interface RawSeedQuestion {
  id: string;
  topic: QuestionTopic;
  type: 'single_choice';
  age_groups: string[];
  difficulty: number;
  prompt: string;
  options: QuestionOptionItem[];
  correct_option_id: 'A' | 'B' | 'C';
  explanation: string;
  feedback_correct: string;
  feedback_incorrect: string;
  source_days: number[];
  source_refs: string[];
  source_fact: string;
  illustration_id: IllustrationId;
  version: number;
  status: QuestionStatus;
  approval: QuestionApprovalState;
  scoring: {
    first_correct_points: number;
    repeat_points: number;
  };
  note: string;
}

/**
 * Nhánh công khai `questions_public/{question_id}` cho Client đọc.
 * QUY TẮC BẮT BUỘC (Mục 8.2 Artifact & Ca kiểm thử T28):
 * Tuyệt đối KHÔNG chứa `correct_option_id`, `feedback_correct`, `feedback_incorrect` hoặc đáp án chấm điểm!
 */
export interface PublicQuestionRecord {
  id: string;
  topic: QuestionTopic;
  type: 'single_choice';
  age_groups: string[];
  difficulty: number;
  prompt: string;
  options: QuestionOptionItem[];
  source_days: number[];
  source_refs: string[];
  source_fact: string;
  illustration_id: IllustrationId;
  version: number;
  status: QuestionStatus;
  approval: QuestionApprovalState;
  scoring: {
    first_correct_points: number;
    repeat_points: number;
  };
  note: string;
  updated_at: number;
}

/**
 * Nhánh Server-Only `question_keys/{question_id}/{version}`
 * Chỉ Backend / SuperAdmin được đọc để chấm điểm theo phiên bản cố định trong attempt (T26).
 */
export interface ServerQuestionKeyRecord {
  question_id: string;
  version: number;
  correct_option_id: 'A' | 'B' | 'C';
  explanation: string;
  feedback_correct: string;
  feedback_incorrect: string;
  source_days: number[];
  first_correct_points: number;
  repeat_points: number;
  updated_at: number;
}

export interface IllustrationCellSpec {
  row: number;
  column: number;
  background_position: string;
  alt: string;
}

export interface IllustrationManifestSpec {
  atlas_file: string;
  grid: { rows: number; columns: number };
  usage: string;
  css: {
    background_size: string;
    aspect_ratio: string;
  };
  illustrations: Record<IllustrationId, IllustrationCellSpec>;
}

export interface DeskBuilderTaskSpec {
  item: 'foot_support' | 'adjust_lamp' | 'clear_desk';
  target: 'feet' | 'work_area' | 'desk';
  feedback: string;
}

export interface HabitRelayCardSpec {
  id: 'prepare' | 'study' | 'pause' | 'return';
  text: string;
}

export interface GameBlueprintSpec {
  schema_version: number;
  status: string;
  games: [
    {
      id: 'situations';
      title: string;
      interaction: 'single_choice';
      questions_per_round: number;
      timer_default: boolean;
      question_source: string;
      rules: string[];
    },
    {
      id: 'desk_builder';
      title: string;
      interaction: 'drag_or_tap_match';
      source_days: number[];
      tasks: DeskBuilderTaskSpec[];
      accessibility: string;
      grading: string;
    },
    {
      id: 'habit_relay';
      title: string;
      interaction: 'sequence_and_reflect';
      source_days: number[];
      scenario: string;
      cards: HabitRelayCardSpec[];
      correct_sequence: Array<'prepare' | 'study' | 'pause' | 'return'>;
      grading: string;
    }
  ];
}

export interface GameQuestionAnswerSubmissionRecord {
  question_id: string;
  locked_version: number;
  selected_option_id: 'A' | 'B' | 'C';
  is_correct: boolean;
  attempt_count_for_question: number;
  points_awarded: number;
  feedback_text: string;
  explanation_text: string;
  source_days: number[];
  answered_at: number;
}

export interface DeskBuilderSubmissionRecord {
  pairs: Record<string, string>;
  correct_count: number;
  total_tasks: number;
  is_all_correct: boolean;
  points_awarded: number;
  task_feedbacks: Array<{
    item: string;
    selected_target: string;
    expected_target: string;
    is_correct: boolean;
    feedback: string;
  }>;
  source_days: number[];
  submitted_at: number;
}

export interface HabitRelaySubmissionRecord {
  ordered_card_ids: string[];
  expected_sequence: string[];
  is_correct: boolean;
  self_reflection_text: string;
  self_reported_only_disclaimer: string;
  points_awarded: number;
  source_days: number[];
  submitted_at: number;
}

export interface GameAttemptRecord {
  attempt_id: string;
  student_id: string;
  game_id: GameModeId;
  topic_filter: 'all' | QuestionTopic;
  timer_enabled: boolean;
  timer_seconds?: number;
  status: 'in_progress' | 'completed';
  score: number;
  max_possible_score: number;
  question_ids: string[];
  /** Phiên bản cố định của từng câu hỏi lúc bắt đầu lượt chơi (T26) */
  question_versions: Record<string, number>;
  answers: Record<string, GameQuestionAnswerSubmissionRecord>;
  desk_builder_submission?: DeskBuilderSubmissionRecord;
  habit_relay_submission?: HabitRelaySubmissionRecord;
  recommended_review_days: number[];
  created_at: number;
  updated_at: number;
  completed_at?: number;
}

export interface SeedImportValidationReport {
  ok: boolean;
  dryRun: boolean;
  schemaVersion: number;
  totalQuestions: number;
  lungThangCount: number;
  matSangCount: number;
  editorialDraftCount: number;
  publishedCount: number;
  publicLeakCheckPassed: boolean;
  clinicalSafetyCheckPassed: boolean;
  errors: string[];
  questionsPublic: Record<string, PublicQuestionRecord>;
  questionKeys: Record<string, Record<string, ServerQuestionKeyRecord>>;
}

export const ILLUSTRATION_MANIFEST: IllustrationManifestSpec =
  rawIllustrationManifest as unknown as IllustrationManifestSpec;

export const GAME_BLUEPRINTS: GameBlueprintSpec =
  rawGameBlueprints as unknown as GameBlueprintSpec;

export const RAW_QUESTION_BANK_SEED = rawQuestionBank as unknown as {
  schema_version: number;
  created_at: string;
  language: string;
  status: QuestionStatus;
  counts: { total: number; lung_thang: number; mat_sang: number };
  medical_review: string;
  sources: Record<string, { title: string; url: string }>;
  questions: RawSeedQuestion[];
};

/**
 * Danh sách 12 câu hỏi mẫu (6 Lưng thẳng + 6 Mắt sáng) được SuperAdmin duyệt khởi tạo
 * trong môi trường Sandbox để Học sinh có thể chơi thử ngay 1 vòng 5 câu hợp lệ,
 * trong khi 28 câu còn lại giữ nguyên `editorial_draft` để kiểm thử chặn câu nháp (T28).
 * Khi Admin bấm "Import Seed gốc (40 câu editorial_draft)", toàn bộ 40 câu sẽ về `editorial_draft`.
 */
export const INITIAL_BOOTSTRAP_PUBLISHED_QUESTION_IDS: ReadonlySet<string> = new Set([
  'BUGZ-Q001',
  'BUGZ-Q002',
  'BUGZ-Q003',
  'BUGZ-Q004',
  'BUGZ-Q005',
  'BUGZ-Q006',
  'BUGZ-Q021',
  'BUGZ-Q022',
  'BUGZ-Q023',
  'BUGZ-Q024',
  'BUGZ-Q025',
  'BUGZ-Q026',
]);

export const FORBIDDEN_CLINICAL_CLAIM_PATTERNS = [
  /cam kết chữa khỏi cận/i,
  /cam kết chữa khỏi cận thị/i,
  /chữa khỏi cận thị 100%/i,
  /cam kết chữa gù/i,
  /đảm bảo hết cận 100%/i,
  /chứng nhận y tế chữa bệnh/i,
];

/**
 * Adapter kiểm tra và tách `question_bank.json` thành:
 * - `questions_public/{question_id}` (KHÔNG có `correct_option_id`, `feedback_correct`, `feedback_incorrect`)
 * - `question_keys/{question_id}/{version}` (Server-only)
 * Hỗ trợ chế độ `dryRun` và chế độ giữ nguyên `editorial_draft` cho toàn bộ 40 câu.
 */
export function validateAndSplitQuestionBankSeed(
  options: {
    dryRun?: boolean;
    mode?: 'strict_editorial_draft' | 'sandbox_with_12_published' | 'all_40_published';
    reviewerUid?: string;
    nowMs?: number;
  } = {}
): SeedImportValidationReport {
  const dryRun = Boolean(options.dryRun);
  const mode = options.mode || 'strict_editorial_draft';
  const nowMs = options.nowMs ?? Date.now();
  const reviewerUid = options.reviewerUid || 'uid-superadmin-01';

  const errors: string[] = [];
  const questionsPublic: Record<string, PublicQuestionRecord> = {};
  const questionKeys: Record<string, Record<string, ServerQuestionKeyRecord>> = {};

  let lungThangCount = 0;
  let matSangCount = 0;
  let editorialDraftCount = 0;
  let publishedCount = 0;
  let publicLeakCheckPassed = true;
  let clinicalSafetyCheckPassed = true;

  const rawQuestions = Array.isArray(RAW_QUESTION_BANK_SEED.questions)
    ? RAW_QUESTION_BANK_SEED.questions
    : [];

  if (rawQuestions.length !== 40) {
    errors.push(`Số lượng câu hỏi seed phải đúng 40 câu, thực tế: ${rawQuestions.length}.`);
  }

  for (const q of rawQuestions) {
    if (!q.id || !/^BUGZ-Q\d{3}$/.test(q.id)) {
      errors.push(`Mã câu hỏi không hợp lệ: ${String(q.id)}`);
    }
    if (q.topic === 'lung_thang') {
      lungThangCount += 1;
    } else if (q.topic === 'mat_sang') {
      matSangCount += 1;
    } else {
      errors.push(`Chủ đề không hợp lệ ở câu ${q.id}: ${String(q.topic)}`);
    }

    if (!Array.isArray(q.options) || q.options.length !== 3) {
      errors.push(`Câu ${q.id} phải có đúng 3 lựa chọn A, B, C.`);
    }

    if (!['A', 'B', 'C'].includes(q.correct_option_id)) {
      errors.push(`Câu ${q.id} có correct_option_id không hợp lệ: ${String(q.correct_option_id)}`);
    }

    if (
      !Array.isArray(q.source_days) ||
      q.source_days.length === 0 ||
      q.source_days.some((d) => typeof d !== 'number' || d < 1 || d > 28)
    ) {
      errors.push(`Câu ${q.id} thiếu ngày nguồn hợp lệ (1..28).`);
    }

    if (!['POSTURE', 'DESK', 'EYES', 'MOVE'].includes(q.illustration_id)) {
      errors.push(`Câu ${q.id} có illustration_id không thuộc 4 cảnh Atlas: ${String(q.illustration_id)}`);
    }

    // Kiểm tra không chứa lời hứa chữa bệnh sai quy định trong lời giải thích chuẩn
    const combinedEditorialText = `${q.prompt} ${q.explanation} ${q.feedback_correct}`;
    for (const pat of FORBIDDEN_CLINICAL_CLAIM_PATTERNS) {
      if (pat.test(combinedEditorialText)) {
        clinicalSafetyCheckPassed = false;
        errors.push(`Câu ${q.id} vi phạm quy tắc ngôn ngữ sức khỏe: ${pat.source}`);
      }
    }

    const shouldPublishInSandbox =
      mode === 'all_40_published' ||
      (mode === 'sandbox_with_12_published' && INITIAL_BOOTSTRAP_PUBLISHED_QUESTION_IDS.has(q.id));

    const status: QuestionStatus = shouldPublishInSandbox ? 'published' : 'editorial_draft';
    const approval: QuestionApprovalState = shouldPublishInSandbox
      ? {
          content_reviewed: true,
          clinical_reviewed: true,
          reviewed_by: reviewerUid,
          reviewed_at: nowMs,
        }
      : {
          content_reviewed: Boolean(q.approval?.content_reviewed),
          clinical_reviewed: Boolean(q.approval?.clinical_reviewed),
        };

    if (status === 'published') {
      publishedCount += 1;
    } else {
      editorialDraftCount += 1;
    }

    const version = Number(q.version) || 1;

    const pubRecord: PublicQuestionRecord = {
      id: q.id,
      topic: q.topic,
      type: 'single_choice',
      age_groups: Array.isArray(q.age_groups) ? [...q.age_groups] : ['primary', 'lower_secondary'],
      difficulty: Number(q.difficulty) || 1,
      prompt: q.prompt,
      options: q.options.map((opt) => ({ id: opt.id, text: opt.text })),
      source_days: [...q.source_days],
      source_refs: Array.isArray(q.source_refs) ? [...q.source_refs] : ['PROJECT_FLASHCARDS'],
      source_fact: q.source_fact || '',
      illustration_id: q.illustration_id,
      version,
      status,
      approval,
      scoring: {
        first_correct_points: q.scoring?.first_correct_points ?? 10,
        repeat_points: q.scoring?.repeat_points ?? 0,
      },
      note: q.note || 'Minh họa dẫn chuyện; đáp án dựa trên nội dung chữ và nguồn, không đo từ ảnh.',
      updated_at: nowMs,
    };

    // Đảm bảo tuyệt đối không rò rỉ đáp án sang nhánh public
    if (
      'correct_option_id' in (pubRecord as unknown as Record<string, unknown>) ||
      'feedback_correct' in (pubRecord as unknown as Record<string, unknown>) ||
      'feedback_incorrect' in (pubRecord as unknown as Record<string, unknown>)
    ) {
      publicLeakCheckPassed = false;
      errors.push(`Rò rỉ khóa chấm điểm trong bản ghi public của câu ${q.id}`);
    }

    questionsPublic[q.id] = pubRecord;
    questionKeys[q.id] = {
      [String(version)]: {
        question_id: q.id,
        version,
        correct_option_id: q.correct_option_id,
        explanation: q.explanation,
        feedback_correct: q.feedback_correct,
        feedback_incorrect: q.feedback_incorrect,
        source_days: [...q.source_days],
        first_correct_points: q.scoring?.first_correct_points ?? 10,
        repeat_points: q.scoring?.repeat_points ?? 0,
        updated_at: nowMs,
      },
    };
  }

  if (lungThangCount !== 20 || matSangCount !== 20) {
    errors.push(
      `Phân bổ chủ đề phải đúng 20 câu Lưng thẳng và 20 câu Mắt sáng (thực tế: ${lungThangCount} / ${matSangCount}).`
    );
  }

  return {
    ok: errors.length === 0 && publicLeakCheckPassed && clinicalSafetyCheckPassed,
    dryRun,
    schemaVersion: RAW_QUESTION_BANK_SEED.schema_version || 1,
    totalQuestions: rawQuestions.length,
    lungThangCount,
    matSangCount,
    editorialDraftCount,
    publishedCount,
    publicLeakCheckPassed,
    clinicalSafetyCheckPassed,
    errors,
    questionsPublic,
    questionKeys,
  };
}

/**
 * Lọc danh sách câu hỏi cho Học sinh:
 * QUY TẮC T28: Học sinh chỉ nhận được các câu hỏi có `status === 'published'`.
 * Không bao giờ trả câu hỏi `editorial_draft` cho Học sinh!
 */
export function getPublishedQuestionsForStudent(
  questionsPublic: Record<string, PublicQuestionRecord>,
  topicFilter: 'all' | QuestionTopic = 'all'
): PublicQuestionRecord[] {
  return Object.values(questionsPublic)
    .filter((q) => {
      if (q.status !== 'published') return false;
      if (topicFilter !== 'all' && q.topic !== topicFilter) return false;
      return true;
    })
    .sort((a, b) => a.id.localeCompare(b.id));
}

/**
 * Chấm điểm thao tác "Sắp góc học tập" (`desk_builder` — T27) theo cặp ID đã duyệt trong `game_blueprints.json`.
 * Không suy tọa độ từ ảnh AI.
 */
export function evaluateDeskBuilderSubmission(params: {
  submittedPairs: Record<string, string>;
  alreadyAwardedInHistory: boolean;
  nowMs?: number;
}): DeskBuilderSubmissionRecord {
  const nowMs = params.nowMs ?? Date.now();
  const deskBlueprint = GAME_BLUEPRINTS.games[1];
  const tasks = deskBlueprint.tasks;

  let correctCount = 0;
  const taskFeedbacks = tasks.map((t) => {
    const selectedTarget = String(params.submittedPairs[t.item] || '');
    const isCorrect = selectedTarget === t.target;
    if (isCorrect) {
      correctCount += 1;
    }
    return {
      item: t.item,
      selected_target: selectedTarget,
      expected_target: t.target,
      is_correct: isCorrect,
      feedback: isCorrect
        ? `Chuẩn rồi! ${t.feedback}`
        : `Mình thử đặt lại nhé: ${t.feedback}`,
    };
  });

  const isAllCorrect = correctCount === tasks.length;
  // T26: Chỉ cộng điểm ở lần hoàn thành đúng đầu tiên, không cộng lặp khi bấm nộp lại nhiều lần
  const pointsAwarded = isAllCorrect && !params.alreadyAwardedInHistory ? 30 : 0;

  return {
    pairs: { ...params.submittedPairs },
    correct_count: correctCount,
    total_tasks: tasks.length,
    is_all_correct: isAllCorrect,
    points_awarded: pointsAwarded,
    task_feedbacks: taskFeedbacks,
    source_days: [...deskBlueprint.source_days],
    submitted_at: nowMs,
  };
}

/**
 * Chấm điểm thao tác "Tiếp sức thói quen" (`habit_relay` — T27) theo thứ tự thẻ `prepare -> study -> pause -> return`.
 * Thực hành là tự báo cáo, không khẳng định Robot đã quan sát.
 */
export function evaluateHabitRelaySubmission(params: {
  orderedCardIds: string[];
  selfReflectionText?: string;
  alreadyAwardedInHistory: boolean;
  nowMs?: number;
}): HabitRelaySubmissionRecord {
  const nowMs = params.nowMs ?? Date.now();
  const relayBlueprint = GAME_BLUEPRINTS.games[2];
  const expected = relayBlueprint.correct_sequence;

  const isCorrect =
    Array.isArray(params.orderedCardIds) &&
    params.orderedCardIds.length === expected.length &&
    expected.every((cardId, idx) => params.orderedCardIds[idx] === cardId);

  const pointsAwarded = isCorrect && !params.alreadyAwardedInHistory ? 20 : 0;

  return {
    ordered_card_ids: Array.isArray(params.orderedCardIds) ? [...params.orderedCardIds] : [],
    expected_sequence: [...expected],
    is_correct: isCorrect,
    self_reflection_text: (params.selfReflectionText || '').trim(),
    self_reported_only_disclaimer:
      'Chỉ chấm thứ tự thẻ thói quen; phần thực hành là học sinh tự báo cáo, không khẳng định Robot đã quan sát hay đo lường.',
    points_awarded: pointsAwarded,
    source_days: [...relayBlueprint.source_days],
    submitted_at: nowMs,
  };
}

export interface GentleReminderTemplateRecord {
  template_id: string;
  posture_code: 'HEAD_FORWARD' | 'TRUNK_LEAN' | 'EYES_TOO_CLOSE' | 'GENERAL_BREAK';
  title: string;
  voice_text: string;
  push_body: string;
  no_body_shaming_verified: boolean;
  updated_at: number;
  updated_by: string;
}

export const DEFAULT_GENTLE_REMINDER_TEMPLATES: Record<string, GentleReminderTemplateRecord> = {
  'tpl-head-forward': {
    template_id: 'tpl-head-forward',
    posture_code: 'HEAD_FORWARD',
    title: 'Nhắc nhẹ: Thả lỏng cổ và vai',
    voice_text: 'Cuốn vở vẫn đợi mình mà! Mình nâng đầu lên một chút và thả lỏng hai vai cho dễ chịu nhé.',
    push_body: 'Gợi ý: Chỉnh lại chỗ ngồi và nâng đầu nhẹ nhàng để cổ đỡ mỏi nhé.',
    no_body_shaming_verified: true,
    updated_at: 1793500000000,
    updated_by: 'system_bootstrap',
  },
  'tpl-trunk-lean': {
    template_id: 'tpl-trunk-lean',
    posture_code: 'TRUNK_LEAN',
    title: 'Nhắc nhẹ: Tựa lưng thoải mái',
    voice_text: 'Lưng mình xin một điểm tựa nhẹ nhàng nào! Mình ngồi gọn vào ghế và đặt hai chân vững nhé.',
    push_body: 'Gợi ý: Ngồi ngay ngắn có điểm tựa lưng và thả lỏng vai theo hướng dẫn Ngày 1.',
    no_body_shaming_verified: true,
    updated_at: 1793500000000,
    updated_by: 'system_bootstrap',
  },
  'tpl-eyes-close': {
    template_id: 'tpl-eyes-close',
    posture_code: 'EYES_TOO_CLOSE',
    title: 'Nhắc nhẹ: Khoảng cách đọc viết & 20-20-20',
    voice_text: 'Cho đôi mắt một khoảng thở vừa phải nào! Mình giữ khoảng cách đọc viết thoải mái và nhớ nghỉ mắt 20-20-20 nhé.',
    push_body: 'Gợi ý: Kiểm tra ánh sáng bàn học và giữ khoảng cách đọc sách vở theo thẻ Ngày 2 & Ngày 8.',
    no_body_shaming_verified: true,
    updated_at: 1793500000000,
    updated_by: 'system_bootstrap',
  },
};

export const DESK_BUILDER_ITEMS: Array<{
  id: 'foot_support' | 'adjust_lamp' | 'clear_desk';
  label: string;
  hint: string;
}> = [
  {
    id: 'foot_support',
    label: 'Bục kê chân vừa tầm',
    hint: 'Đặt ở vị trí Chân để bàn chân có điểm tựa vững khi ghế cao (Ngày 4, 19).',
  },
  {
    id: 'adjust_lamp',
    label: 'Đèn bàn học ánh sáng dịu',
    hint: 'Chiếu sáng vùng trang vở viết để không bị chói hoặc sấp bóng (Ngày 5).',
  },
  {
    id: 'clear_desk',
    label: 'Khay sách vở & bút gọn gàng',
    hint: 'Đặt trên mặt bàn trong tầm với để không phải vươn người lệch vai (Ngày 4, 19).',
  },
];

export const DESK_BUILDER_TARGETS: Array<{
  id: 'feet' | 'work_area' | 'desk';
  label: string;
}> = [
  { id: 'feet', label: 'Vị trí Chân & Gầm bàn (feet)' },
  { id: 'work_area', label: 'Vùng chiếu sáng Trang vở (work_area)' },
  { id: 'desk', label: 'Mặt bàn học trong tầm tay (desk)' },
];

export const HABIT_RELAY_CARDS: Array<{
  id: 'prepare' | 'study' | 'pause' | 'return';
  title: string;
  detail: string;
  day: number;
}> = [
  {
    id: 'prepare',
    title: 'Chuẩn bị góc học tập',
    detail: 'Chỉnh ghế, kê chân và bật đèn đủ sáng trước khi mở sách vở.',
    day: 4,
  },
  {
    id: 'study',
    title: 'Bắt đầu ngồi học thoải mái',
    detail: 'Giữ lưng thẳng tự nhiên, thả lỏng hai vai và giữ khoảng cách mắt vừa phải.',
    day: 1,
  },
  {
    id: 'pause',
    title: 'Nghỉ mắt 20-20-20 & Vươn vai',
    detail: 'Sau mỗi chặng học, nhìn xa thư giãn mắt và đứng dậy vận động nhẹ nhàng.',
    day: 8,
  },
  {
    id: 'return',
    title: 'Quay lại học & Tự quan sát',
    detail: 'Trở lại bàn học và tự cảm nhận sự dễ chịu của cổ, lưng và đôi mắt.',
    day: 26,
  },
];

