/* ── Domain types aligned with backend schemas (app/schemas.py) ── */

export interface Room {
  id: string;
  name: string;
  building: string;
  type: string;
  capacity: number;
  features: string[];
  accessible: boolean;
  allowed_uses: string[];
}

export interface Faculty {
  id: string;
  name: string;
  department: string;
  max_hours_per_day: number;
}

export interface StudentGroup {
  id: string;
  name: string;
  year: number;
  department: string;
  size: number;
}

export interface Session {
  id: string;
  course_id: string;
  kind: string;
  groups: string[];
  faculty_id: string;
  size: number;
  duration: number;
  room_types: string[];
  basket_slot?: string | null;
  fixed_slot?: { day: string; start_period: number; room_id?: string } | null;
}

export interface Course {
  id: string;
  name: string;
  department?: string;
  lecture_hours: number;
  tutorial_hours: number;
  lab_blocks: number;
}

/* Timetable */
export interface TimetableAssignment {
  session_id: string;
  day: string;
  start_period: number;
  room_id: string;
  /* enriched fields from GET /api/timetable */
  course_id?: string;
  kind?: string;
  faculty_id?: string;
  groups?: string[];
  size?: number;
  duration?: number;
  room_name?: string;
  room_type?: string;
  room_capacity?: number;
}

export interface TimetableResponse {
  status: string;
  solver_status: string | null;
  version: number;
  generated_at: string | null;
  published_at: string | null;
  total_assignments: number;
  live_booking_count?: number;
  visible_live_booking_count?: number;
  assignments: TimetableAssignment[];
}

export interface SolverResponse {
  status: string;
  assignments: TimetableAssignment[];
  stats: Record<string, unknown>;
  violations: string[];
}

/* Dashboard */
export interface DashboardStats {
  total_sessions: number;
  scheduled_sessions: number;
  total_rooms: number;
  total_faculty: number;
  total_groups: number;
  total_booking_requests: number;
  approved_bookings: number;
  rejected_bookings: number;
  alternative_bookings: number;
  total_exams: number;
  scheduled_exams: number;
  timetable_status: string;
  solver_status: string | null;
  hard_violations: number;
  soft_penalty: number;
}

/* Fest week bookings */
export interface BookingDecision {
  request_id: string;
  status: string;
  day?: string | null;
  start_period?: number | null;
  end_period?: number | null;
  room_id?: string | null;
  reason?: string | null;
}

export interface FestWeekResponse {
  fest_week: {
    bookings: BookingDecision[];
    session_overrides: Record<string, unknown>[];
  } | null;
  status: string;
}

/* NL Booking */
export interface NLParseResponse {
  attendance?: number | null;
  duration_periods?: number | null;
  windows: Record<string, unknown>[];
  room_types: string[];
  needs: string[];
  requested_room?: string | null;
  mandatory_for_groups: string[];
  title?: string | null;
  follow_up?: string | null;
  confidence: number;
  raw_text: string;
}

export interface NLBookResponse {
  status: string;
  parsed?: NLParseResponse;
  booking?: {
    room_id: string;
    room_name: string;
    room_type: string;
    room_capacity: number;
    day: string;
    start_period: number;
    end_period: number;
  };
  follow_up?: string;
  message?: string;
  accessibility_warning?: string | null;
  mode?: 'ai' | 'basic';
}

/* Reschedule */
export interface RescheduleRequest {
  session_id: string;
  new_day: string;
  new_start_period: number;
  new_room_id: string;
  reason: string;
}

export interface RescheduleHistoryEntry {
  session_id: string;
  status: string;
  reason: string;
  conflicts?: string[];
  old?: TimetableAssignment;
  new?: TimetableAssignment;
  timestamp: string;
}

/* Disruption */
export interface DisruptionChange {
  type: string;
  faculty_id?: string;
  room_id?: string;
  days?: string[];
  periods?: number[];
  reason?: string;
}

/* Audit */
export interface AuditLogEntry {
  id: string;
  action: string;
  entity_type: string;
  entity_id: string;
  actor?: string | null;
  timestamp: string;
  details: Record<string, unknown>;
}

/* Validation */
export interface ValidationReport {
  hard_violations: Record<string, unknown>[];
  hard_violation_count: number;
  hard_by_rule: Record<string, number>;
  soft_penalties: Record<string, number>;
  soft_total: number;
  warnings: string[];
  bookings?: Record<string, unknown> | null;
}

export type Day = 'MON' | 'TUE' | 'WED' | 'THU' | 'FRI';
export const DAYS: Day[] = ['MON', 'TUE', 'WED', 'THU', 'FRI'];
export const PERIODS = [1, 2, 3, 4, 5, 6, 7, 8, 9];

export interface ExamAssignment {
  exam_id: string;
  day: string;
  session: string;
  rooms: string[];
}
