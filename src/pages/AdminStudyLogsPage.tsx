import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowLeft,
  Clock3,
  Download,
  GraduationCap,
  LockKeyhole,
  RefreshCw,
  Search,
  Users,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

interface StudyLogRow {
  session_id: string;
  student_name: string;
  account_name: string;
  email: string;
  phone: string;
  device_id: string;
  started_at: number;
  ended_at: number;
  study_duration_ms: number;
  study_duration_minutes: number;
  good_duration_ms?: number;
  bad_duration_ms?: number;
}

interface StudyLogSummary {
  session_count: number;
  learner_count: number;
  total_study_duration_ms: number;
  total_good_duration_ms: number;
  total_bad_duration_ms: number;
}

const EMPTY_SUMMARY: StudyLogSummary = {
  session_count: 0,
  learner_count: 0,
  total_study_duration_ms: 0,
  total_good_duration_ms: 0,
  total_bad_duration_ms: 0,
};
function formatDuration(ms: number): string {
  const totalMinutes = Math.max(0, Math.round((Number(ms) || 0) / 60000));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return hours > 0 ? `${hours} giờ ${minutes} phút` : `${minutes} phút`;
}

function formatDateTime(timestamp: number): string {
  return new Intl.DateTimeFormat('vi-VN', {
    timeZone: 'Asia/Ho_Chi_Minh',
    dateStyle: 'short',
    timeStyle: 'medium',
  }).format(new Date(timestamp));
}

function csvCell(value: string | number): string {
  const raw = String(value ?? '');
  const protectedValue = /^[=+\-@]/.test(raw.trimStart()) ? `'${raw}` : raw;
  return `"${protectedValue.replaceAll('"', '""')}"`;
}

export const AdminStudyLogsPage: React.FC = () => {
  const { loading: authLoading, effectiveRole, email, authenticatedFetch } = useAuth();
  const isSuperAdmin = effectiveRole === 'superadmin';
  const [logs, setLogs] = useState<StudyLogRow[]>([]);
  const [summary, setSummary] = useState<StudyLogSummary>(EMPTY_SUMMARY);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadLogs = async () => {
    if (!isSuperAdmin) return;
    setLoading(true);
    setError('');
    try {
      const res = await authenticatedFetch('/api/admin/study-logs?limit=500');
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Không thể tải nhật ký phiên học.');
      setLogs(Array.isArray(data.logs) ? data.logs : []);
      setSummary(data.summary || EMPTY_SUMMARY);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không thể tải nhật ký phiên học.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isSuperAdmin) void loadLogs();
    else if (!authLoading) setLoading(false);
  }, [authLoading, isSuperAdmin]);

  const filteredLogs = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase('vi');
    if (!normalized) return logs;
    return logs.filter((row) =>
      [row.student_name, row.account_name, row.email, row.phone, row.session_id, row.device_id]
        .join(' ')
        .toLocaleLowerCase('vi')
        .includes(normalized)
    );
  }, [logs, query]);

  const downloadCsv = () => {
    const header = [
      'Tên học sinh',
      'Tên tài khoản',
      'Email',
      'Số điện thoại',
      'Bắt đầu',
      'Kết thúc',
      'Tổng phút học',
      'Phút tư thế tốt',
      'Phút cần chỉnh',
      'Thiết bị',
      'Mã phiên',
    ];
    const rows = filteredLogs.map((row) => [
      row.student_name,
      row.account_name,
      row.email,
      row.phone,
      formatDateTime(row.started_at),
      formatDateTime(row.ended_at),
      (row.study_duration_ms / 60000).toFixed(2),
      ((row.good_duration_ms || 0) / 60000).toFixed(2),
      ((row.bad_duration_ms || 0) / 60000).toFixed(2),
      row.device_id,
      row.session_id,
    ]);
    const csv = `\uFEFF${[header, ...rows].map((row) => row.map(csvCell).join(',')).join('\n')}`;
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `bugz-study-logs-${new Date().toISOString().slice(0, 10)}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  if (authLoading) {
    return <div className="rounded-2xl bg-white p-8 text-sm text-slate-600">Đang xác minh quyền…</div>;
  }

  if (!isSuperAdmin) {
    return (
      <section className="mx-auto max-w-xl rounded-3xl border border-rose-200 bg-white p-8 text-center shadow-sm">
        <LockKeyhole className="mx-auto h-10 w-10 text-rose-600" />
        <h1 className="mt-4 text-xl font-extrabold text-slate-900">Không có quyền truy cập</h1>
        <p className="mt-2 text-sm text-slate-600">
          Nhật ký có thông tin liên hệ và chỉ tài khoản Superadmin mới được xem.
        </p>
        <Link to="/learn" className="mt-5 inline-flex rounded-xl bg-slate-900 px-4 py-2 text-sm font-bold text-white">
          Quay lại trang học
        </Link>
      </section>
    );
  }

  return (
    <div className="space-y-5">
      <section className="rounded-3xl bg-gradient-to-br from-slate-950 via-teal-950 to-teal-800 p-6 text-white shadow-sm sm:p-8">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <Link to="/admin" className="inline-flex items-center gap-1.5 text-xs font-bold text-teal-100 hover:text-white">
              <ArrowLeft className="h-4 w-4" /> Trung tâm quản trị
            </Link>
            <h1 className="mt-3 text-2xl font-extrabold sm:text-3xl">Nhật ký thời gian học</h1>
            <p className="mt-1 text-sm text-teal-50/85">Dữ liệu riêng tư · Superadmin {email}</p>
          </div>
          <div className="flex gap-2">
            <button onClick={() => void loadLogs()} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-white/20 bg-white/10 px-4 text-sm font-bold hover:bg-white/20">
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> Làm mới
            </button>
            <button onClick={downloadCsv} disabled={filteredLogs.length === 0} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-amber-400 px-4 text-sm font-bold text-slate-950 hover:bg-amber-300 disabled:opacity-50">
              <Download className="h-4 w-4" /> Tải CSV
            </button>
          </div>
        </div>
      </section>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: 'Phiên đã lưu', value: summary.session_count, icon: Clock3 },
          { label: 'Học sinh', value: summary.learner_count, icon: Users },
          { label: 'Tổng thời gian học', value: formatDuration(summary.total_study_duration_ms), icon: GraduationCap },
          { label: 'Thời gian cần chỉnh', value: formatDuration(summary.total_bad_duration_ms), icon: Clock3 },
        ].map(({ label, value, icon: Icon }) => (
          <div key={label} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs">
            <Icon className="h-5 w-5 text-teal-700" />
            <div className="mt-3 text-xs font-semibold text-slate-500">{label}</div>
            <div className="mt-1 text-xl font-extrabold text-slate-900">{value}</div>
          </div>
        ))}
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white shadow-xs">
        <div className="flex flex-col gap-3 border-b border-slate-200 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="font-extrabold text-slate-900">Danh sách phiên học</h2>
            <p className="text-xs text-slate-500">Hiển thị {filteredLogs.length}/{logs.length} phiên gần nhất</p>
          </div>
          <label className="relative block w-full sm:max-w-sm">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Tìm tên, email, SĐT, mã phiên…" className="w-full rounded-xl border border-slate-300 py-2.5 pl-9 pr-3 text-sm outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100" />
          </label>
        </div>

        {error && <div className="m-4 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">{error}</div>}
        <div className="overflow-x-auto">
          <table className="min-w-[1100px] w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">Học sinh</th><th className="px-4 py-3">Liên hệ</th><th className="px-4 py-3">Bắt đầu</th><th className="px-4 py-3">Kết thúc</th><th className="px-4 py-3">Thời gian học</th><th className="px-4 py-3">Tốt / Cần chỉnh</th><th className="px-4 py-3">Thiết bị</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredLogs.map((row) => (
                <tr key={`${row.device_id}:${row.session_id}`} className="hover:bg-slate-50/70">
                  <td className="px-4 py-3"><div className="font-bold text-slate-900">{row.student_name}</div><div className="text-xs text-slate-500">{row.account_name}</div></td>
                  <td className="px-4 py-3"><div className="text-slate-800">{row.email || '—'}</div><div className="text-xs text-slate-500">{row.phone || '—'}</div></td>
                  <td className="px-4 py-3 text-slate-700">{formatDateTime(row.started_at)}</td>
                  <td className="px-4 py-3 text-slate-700">{formatDateTime(row.ended_at)}</td>
                  <td className="px-4 py-3 font-bold text-teal-800">{formatDuration(row.study_duration_ms)}</td>
                  <td className="px-4 py-3"><span className="text-emerald-700">{formatDuration(row.good_duration_ms || 0)}</span><span className="mx-1 text-slate-300">/</span><span className="text-rose-700">{formatDuration(row.bad_duration_ms || 0)}</span></td>
                  <td className="px-4 py-3"><div className="font-medium text-slate-700">{row.device_id}</div><div className="max-w-40 truncate font-mono text-[10px] text-slate-400" title={row.session_id}>{row.session_id}</div></td>
                </tr>
              ))}
              {!loading && filteredLogs.length === 0 && <tr><td colSpan={7} className="px-4 py-12 text-center text-slate-500">Chưa có phiên học phù hợp.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
};
