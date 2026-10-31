import type {
  DashboardStats,
  TimetableResponse,
  SolverResponse,
  Room,
  Faculty,
  StudentGroup,
  Session,
  Course,
  FestWeekResponse,
  NLParseResponse,
  NLBookResponse,
  RescheduleRequest,
  RescheduleHistoryEntry,
  DisruptionChange,
  AuditLogEntry,
  ValidationReport,
  ExamAssignment,
} from './types';

const BASE = '/api';

async function request<T>(endpoint: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${endpoint}`, {
    headers: { 'Content-Type': 'application/json', ...(init?.headers as Record<string, string> ?? {}) },
    ...init,
  });
  if (!res.ok) {
    let msg = `HTTP ${res.status}`;
    try {
      const j = await res.json();
      if (j.detail) msg = typeof j.detail === 'string' ? j.detail : JSON.stringify(j.detail);
    } catch { /* empty */ }
    throw new Error(msg);
  }
  return res.json() as Promise<T>;
}

export const api = {
  /* ── Health & Dashboard ── */
  health: () => request<{ status: string; timetable_status: string }>('/health'),
  dashboard: () => request<DashboardStats>('/dashboard'),

  /* ── Dataset catalog ── */
  datasetStatus: () => request<Record<string, unknown>>('/dataset/status'),
  rooms: () => request<Room[]>('/rooms'),
  faculty: () => request<Faculty[]>('/faculty'),
  studentGroups: () => request<StudentGroup[]>('/student-groups'),
  sessions: () => request<Session[]>('/sessions'),
  courses: () => request<Course[]>('/courses'),
  bookingRequests: () => request<Record<string, unknown>>('/booking-requests'),
  exams: () => request<ExamAssignment[]>('/exams'),
  calendar: () => request<Record<string, unknown>>('/calendar'),

  /* ── Solver & Timetable ── */
  generateTimetable: (timeLimit = 120, numWorkers = 8) =>
    request<SolverResponse>('/solver/generate', {
      method: 'POST',
      body: JSON.stringify({ time_limit_seconds: timeLimit, num_workers: numWorkers }),
    }),
  timetable: (filters?: { day?: string; room_id?: string; faculty_id?: string; group_id?: string }) => {
    const qs = new URLSearchParams();
    if (filters?.day) qs.set('day', filters.day);
    if (filters?.room_id) qs.set('room_id', filters.room_id);
    if (filters?.faculty_id) qs.set('faculty_id', filters.faculty_id);
    if (filters?.group_id) qs.set('group_id', filters.group_id);
    const q = qs.toString();
    return request<TimetableResponse>(`/timetable${q ? `?${q}` : ''}`);
  },
  publishTimetable: () => request<{ status: string; version: number }>('/timetable/publish', { method: 'POST' }),
  archiveTimetable: () => request<{ status: string; version: number }>('/timetable/archive', { method: 'POST' }),
  timetableVersions: () => request<Record<string, unknown>>('/timetable/versions'),

  /* ── Fest week / Spectra ── */
  festWeek: () => request<FestWeekResponse>('/fest-week'),
  reprocessFestWeek: () => request<Record<string, unknown>>('/fest-week/reprocess', { method: 'POST' }),

  /* ── NL Booking ── */
  nlParse: (text: string) =>
    request<NLParseResponse>('/nl-parse', { method: 'POST', body: JSON.stringify({ text }) }),
  nlBook: (text: string) =>
    request<NLBookResponse>('/nl-book', { method: 'POST', body: JSON.stringify({ text }) }),

  /* ── Rescheduling ── */
  reschedule: (data: RescheduleRequest) =>
    request<{ success: boolean; message: string; conflicts: string[] }>('/reschedule', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  rescheduleHistory: () => request<RescheduleHistoryEntry[]>('/reschedule/history'),

  /* ── Disruptions ── */
  applyDisruption: (changes: DisruptionChange[]) =>
    request<{ status: string; changes: number; message: string }>('/disruption/apply', {
      method: 'POST',
      body: JSON.stringify({ changes }),
    }),
  clearDisruption: () => request<{ status: string }>('/disruption', { method: 'DELETE' }),

  /* ── Validation & Export ── */
  validate: () => request<ValidationReport>('/validate'),
  exportSchedule: () => request<Record<string, unknown>>('/export/schedule'),
  saveExport: (filename = 'schedule.json') =>
    request<{ status: string; path: string }>(`/export/save?filename=${encodeURIComponent(filename)}`, { method: 'POST' }),

  /* ── Audit ── */
  audit: (limit = 100) => request<AuditLogEntry[]>(`/audit?limit=${limit}`),

  /* ── System ── */
  reset: () => request<{ status: string }>('/reset', { method: 'POST' }),
};
