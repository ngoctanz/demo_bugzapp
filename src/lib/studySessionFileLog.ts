import fs from 'node:fs';
import path from 'node:path';

export interface StudySessionLogEntry {
  session_id: string;
  student_name: string;
  account_name: string;
  email: string;
  phone: string;
  device_id: string;
  started_at: number;
  ended_at: number;
  good_duration_ms?: number;
  bad_duration_ms?: number;
}

const CSV_HEADER = [
  'session_id',
  'student_name',
  'account_name',
  'email',
  'phone',
  'device_id',
  'started_at_iso',
  'ended_at_iso',
  'study_duration_seconds',
  'study_duration_minutes',
  'good_duration_seconds',
  'bad_duration_seconds',
].join(',');

function protectSpreadsheetFormula(value: string): string {
  return /^[=+\-@]/.test(value.trimStart()) ? `'${value}` : value;
}

function csvCell(value: string | number): string {
  const safe = protectSpreadsheetFormula(String(value));
  return `"${safe.replaceAll('"', '""')}"`;
}

function firstCsvCell(line: string): string {
  if (!line.startsWith('"')) return line.split(',', 1)[0] || '';
  let out = '';
  for (let i = 1; i < line.length; i += 1) {
    if (line[i] !== '"') {
      out += line[i];
      continue;
    }
    if (line[i + 1] === '"') {
      out += '"';
      i += 1;
      continue;
    }
    break;
  }
  return out;
}

export function buildStudySessionCsvRow(entry: StudySessionLogEntry): string {
  const durationMs = Math.max(0, entry.ended_at - entry.started_at);
  const values = [
    entry.session_id,
    entry.student_name,
    entry.account_name,
    entry.email,
    entry.phone,
    entry.device_id,
    new Date(entry.started_at).toISOString(),
    new Date(entry.ended_at).toISOString(),
    Math.round(durationMs / 1000),
    (durationMs / 60000).toFixed(2),
    Math.round(Math.max(0, entry.good_duration_ms || 0) / 1000),
    Math.round(Math.max(0, entry.bad_duration_ms || 0) / 1000),
  ];
  return values.map(csvCell).join(',');
}

/** Ghi CSV riêng tư phía server, idempotent theo session_id. */
export function appendStudySessionLogCsv(
  filePath: string,
  entry: StudySessionLogEntry
): { appended: boolean; filePath: string } {
  if (!entry.session_id.trim()) throw new Error('session_id is required');
  if (!Number.isFinite(entry.started_at) || !Number.isFinite(entry.ended_at)) {
    throw new Error('started_at and ended_at must be finite timestamps');
  }

  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const existing = fs.existsSync(filePath) ? fs.readFileSync(filePath, 'utf8') : '';
  const alreadyLogged = existing
    .split(/\r?\n/)
    .slice(1)
    .some((line) => line.length > 0 && firstCsvCell(line) === entry.session_id);
  if (alreadyLogged) return { appended: false, filePath };

  const prefix = existing.length === 0 ? `${CSV_HEADER}\n` : existing.endsWith('\n') ? '' : '\n';
  fs.appendFileSync(filePath, `${prefix}${buildStudySessionCsvRow(entry)}\n`, 'utf8');
  try {
    fs.chmodSync(filePath, 0o600);
  } catch {
    // Windows có thể không áp dụng đầy đủ POSIX mode; file vẫn nằm ngoài static web root.
  }
  return { appended: true, filePath };
}
