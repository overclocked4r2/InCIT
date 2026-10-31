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
  parsed: NLParseResponse;
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

/* ── Student portal ── */

export interface PortalStudent {
  id: string;
  name: string;
  roll: string;
  group_id: string;
  department: string;
  year: number;
  semester: number;
  email: string;
  hostel: string;
  accessibility: boolean;
  group_name: string;
  group_size: number;
  initials: string;
  program: string;
  semester_label: string;
  course_count: number;
  credits: number;
}

export interface PortalClass {
  session_id: string;
  course_id: string;
  title: string;
  kind: string;
  faculty: string;
  faculty_id: string;
  room_id: string;
  room: string;
  start_period: number;
  end_period: number;
  duration: number;
  start: string;
  end: string;
  when?: string;
}

export interface AttendanceCourse {
  course_id: string;
  title: string;
  credits: number;
  department?: string;
  weekly_periods: number;
  kinds: string[];
  faculty: string[];
  session_ids: string[];
  attended: number;
  held: number;
  percent: number;
  status: 'critical' | 'watch' | 'safe' | 'comfortable';
  to_reach: number;
  can_miss: number;
}

export interface AttendanceLogEntry {
  id: string;
  student_id: string;
  course_id: string;
  present: boolean;
  timestamp: string;
  source: string;
}

export interface AttendanceSummary {
  overall_percent: number;
  target: number;
  attended: number;
  held: number;
  course_count: number;
  below_target: number;
  critical: number;
  courses: AttendanceCourse[];
  watchlist: AttendanceCourse[];
}

export interface AttendanceResponse extends AttendanceSummary {
  student: PortalStudent;
  log: AttendanceLogEntry[];
}

export interface AttendanceLogResponse {
  status: string;
  entry: AttendanceLogEntry;
  course: AttendanceCourse;
  summary: AttendanceSummary;
}

export interface MarkComponent {
  name: string;
  score: number;
  max: number;
  percent: number;
}

export interface MarkCourse {
  course_id: string;
  title: string;
  credits: number;
  weekly_periods: number;
  session_ids: string[];
  components: MarkComponent[];
  scored: number;
  max: number;
  percent: number;
  grade: string;
  grade_points: number;
}

export interface SemesterPoint {
  semester: number;
  sgpa: number;
  credits: number;
  current: boolean;
}

export interface MarksResponse {
  student: PortalStudent;
  courses: MarkCourse[];
  sgpa: number;
  cgpa: number;
  credits: number;
  semester: number;
  history: SemesterPoint[];
  published_marks: number;
  scored_marks: number;
  best_course: string | null;
  weakest_course: string | null;
}

export interface ExamRoom {
  id: string;
  name: string;
  capacity: number;
}

export interface ExamEntry {
  exam_id: string;
  course_ids: string[];
  titles: string[];
  groups: string[];
  size: number;
  duration_hours: number;
  day: string;
  session: string;
  start: string;
  end: string;
  rooms: ExamRoom[];
  seats: number;
  is_mine: boolean;
}

export interface ExamsResponse {
  exams: ExamEntry[];
  all_exams: ExamEntry[];
  my_count: number;
  total_count: number;
  policy: string;
}

export interface PortalEvent {
  request_id: string;
  title: string;
  requester: string;
  role: string;
  category: string;
  attendance: number;
  status: string;
  day: string;
  start_period: number;
  end_period: number;
  start: string;
  end: string;
  room_id: string;
  room: string;
  needs: string[];
  mandatory_for_groups: string[];
  required_for_you: boolean;
  raw_text: string;
}

export interface EventsResponse {
  events: PortalEvent[];
  for_you: PortalEvent[];
  count: number;
  fest_week: string | null;
}

export interface ClubEntry {
  name: string;
  events: PortalEvent[];
  approved: number;
  total: number;
}

export interface ClubsResponse {
  clubs: ClubEntry[];
  count: number;
}

export interface MessDay {
  day: string;
  menu: { breakfast: string; lunch: string; snacks: string; dinner: string };
  is_today: boolean;
}

export interface MessResponse {
  today: string;
  menu: { breakfast: string; lunch: string; snacks: string; dinner: string };
  days: MessDay[];
  sample: boolean;
}

export interface FreeBlock {
  start_period: number;
  end_period: number;
  start: string;
  end: string;
  periods: number;
}

export interface PlannerDay {
  day: string;
  classes: PortalClass[];
  events: PortalEvent[];
  free_blocks: FreeBlock[];
  class_count: number;
  busy_periods: number[];
}

export interface Workload {
  weekly_classes: number;
  weekly_periods: number;
  busiest_day: string | null;
  earliest: PortalClass | null;
  latest: PortalClass | null;
}

export interface PlannerResponse {
  student: PortalStudent;
  days: PlannerDay[];
  workload: Workload;
  exam_week: { days: string[]; sessions: { id: string; start: string; end: string }[] } | null;
  exams: ExamEntry[];
}

export interface PortalNotification {
  id: string;
  tone: 'warning' | 'info' | 'accent' | 'success';
  title: string;
  detail: string;
  href: string;
}

export interface PortalHome {
  student: PortalStudent;
  timetable: {
    status: string;
    version: number;
    published_at: string | null;
    solver_status: string | null;
    validated: boolean;
    hard_violations: number | null;
    soft_penalty: number | null;
  };
  today: {
    date: string;
    weekday: string;
    is_class_day: boolean;
    classes: PortalClass[];
    next_classes: PortalClass[];
    next_class: PortalClass | null;
    next_day: string;
    label: string;
  };
  attendance: AttendanceSummary;
  marks: MarksResponse;
  exams: ExamEntry[];
  events: PortalEvent[];
  mess: { day: string; menu: MessResponse['menu']; sample: boolean };
  notifications: PortalNotification[];
  workload: Workload;
  notes_count: number;
}

export interface Note {
  id: string;
  student_id: string;
  title: string;
  body: string;
  course_id: string | null;
  pinned: boolean;
  created_at: string;
  updated_at: string;
}

export interface PortalSearchResults {
  query: string;
  courses: { id: string; title: string; department?: string }[];
  faculty: { id: string; name: string; department: string }[];
  rooms: { id: string; name: string; building: string; type: string }[];
  events: { request_id: string; title: string; day: string; start: string; room: string }[];
}
