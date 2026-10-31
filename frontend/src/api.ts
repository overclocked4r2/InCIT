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
  NLBookingSubmission,
  RescheduleRequest,
  RescheduleHistoryEntry,
  DisruptionChange,
  AuditLogEntry,
  ValidationReport,
  ExamAssignment,
} from './types';

const BASE = '/api';
let authToken: string | null = null;

export function setAuthToken(token: string | null) {
  authToken = token;
}

async function request<T>(endpoint: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${endpoint}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
      ...(init?.headers as Record<string, string> ?? {}),
    },
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

export type ManualBookingRequest = {
  room_id: string;
  day: string;
  start_period: number;
  duration_periods: number;
  purpose: string;
  attendance: number;
  needs: string[];
};

export type ManualBookingResponse = {
  status: 'approved' | 'rejected' | 'not_allowed';
  message: string;
  booking?: { room_id: string; room_name: string; day: string; start_period: number; end_period: number; purpose: string };
};

export type FacultyChangeResponse = {
  status: 'pending' | 'needs_clarification' | 'manual_form';
  message?: string;
  draft?: Record<string, unknown> | null;
  proposal?: { message: string; changes: unknown[] };
};

export type ExplanationResponse = {
  subject: string;
  message: string;
  mode: 'ai' | 'code';
  reason_codes: Array<{ code: string; detail: string }>;
};

export const api = {
  /* ── Health & Dashboard ── */
  health: () => request<{ status: string; timetable_status: string }>('/health'),
  dashboard: () => request<DashboardStats>('/dashboard'),

  /* ── Demo login ── */
  login: (username: string, password: string) =>
    request<{ token: string; user: DemoUser }>('/auth/login', {
      method: 'POST', body: JSON.stringify({ username, password }),
    }),
  me: () => request<DemoUser>('/auth/me'),

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
  manualBooking: (data: ManualBookingRequest) =>
    request<ManualBookingResponse>('/manual-booking', { method: 'POST', body: JSON.stringify(data) }),

  /* ── NL Booking ── */
  nlParse: (text: string) =>
    request<NLParseResponse>('/nl-parse', { method: 'POST', body: JSON.stringify({ text }) }),
  nlBook: (text: string) =>
    request<NLBookResponse>('/nl-book', { method: 'POST', body: JSON.stringify({ text }) }),
  submitNlBooking: (draft: NLBookingSubmission) =>
    request<{ status: string; message: string; booking?: NLBookResponse['booking'] & { booking_id?: string } }>('/nl-book/submit', { method: 'POST', body: JSON.stringify(draft) }),
  facultyChange: (text: string) =>
    request<FacultyChangeResponse>('/faculty-change', { method: 'POST', body: JSON.stringify({ text }) }),
  explainClass: (sessionId: string) => request<ExplanationResponse>(`/explain/class/${encodeURIComponent(sessionId)}`),
  explainBooking: (requestId: string) => request<ExplanationResponse>(`/explain/booking/${encodeURIComponent(requestId)}`),

  /* ── Rescheduling ── */
  reschedule: (data: RescheduleRequest) =>
    request<{ success: boolean; message: string; conflicts: string[]; changes: unknown[] }>('/reschedule', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  rescheduleHistory: () => request<RescheduleHistoryEntry[]>('/reschedule/history'),
  decideReschedule: (requestId: string, decision: 'approved' | 'rejected', comments = '') =>
    request<{ status: string; message: string }>(`/reschedule/${requestId}/decision`, {
      method: 'POST',
      body: JSON.stringify({ request_id: requestId, decision, comments }),
    }),

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

export type DemoUser = {
  username: string;
  name: string;
  role: string;
};
