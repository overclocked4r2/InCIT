# InCIT Project Progress & Deliverables Tracker

**Project**: InCIT (Institutional Timetable & Resource Scheduling Engine)  
**Hackathon**: Zephyr Hackathon / CrunchWeek  
**Team**: `InCIT`  
**Current Status**: **ALL 5 PHASES COMPLETED (100%)**

---

## Milestone Checklist

### Phase 1: Database Foundation & Deterministic Validator ✅
- [x] Schema v1.0 design with 19 SQLAlchemy 2.0 ORM models (`app/models.py`).
- [x] SQLite WAL mode configuration with foreign key constraints (`app/db.py`).
- [x] Alembic migration script (`alembic/versions/0001_schema_v1.py`).
- [x] Interval-based deterministic validator independent of OR-Tools (`app/validator.py`).
- [x] 8 passing unit tests covering overlap, room capacity, and policy checks (`pytest tests/`).

### Phase 2: Core Solver & Backend Services ✅
- [x] Dataset loader with caching for `data/cit_public.json` (`app/dataset.py`).
- [x] OR-Tools CP-SAT solver implementation (`app/solver.py`) modeling:
  - Hard constraints: H1 (all scheduled), H2 (faculty non-overlap), H3 (group non-overlap), H4 (room non-overlap), H5 (capacity), H6 (room type), H7 (faculty availability), H8 (room availability), H9 (lunch gap & bounds), H10 (accessibility), H11 (basket slots), H12 (faculty daily hours), H14 (fixed slots).
  - Soft constraints: S1 (travel), S2 (idle gaps), S3 (compact days), S4 (daily load balance), S5 (early morning lab avoidance), S6 (late afternoon preference).
- [x] Spectra Fest-Week prioritized booking engine (`app/booking_engine.py`) with role category caps and displacement logic.
- [x] Exam room & slot scheduler (`app/exam_scheduler.py`) enforcing 50% room capacity and group/room clash avoidance. Invigilator roster assignment remains a planned extension.
- [x] Bilingual Natural Language booking parser (`app/nl_parser.py`) supporting English and Hindi.
- [x] In-memory state manager with versioning and audit trail (`app/state.py`).
- [x] FastAPI REST application (`app/main.py`) with 25+ endpoints.

### Phase 3: Solver Verification & Benchmarking ✅
- [x] Tested against full 189-session CIT dataset.
- [x] Solve time: ~15 seconds on 8 workers.
- [x] Verified zero memory leaks and stable constraint propagation.

### Phase 4: Frontend Web Dashboard ✅
- [x] React 19 + TypeScript + Vite 8 scaffold with Tailwind CSS v4.
- [x] Typed API client (`frontend/src/api.ts`).
- [x] Glassmorphic dark-mode dashboard components (`Layout.tsx`, `ui.tsx`).
- [x] 6 dedicated functional views:
  1. `Dashboard.tsx`: KPI cards, schedule metrics, quick actions.
  2. `Timetable.tsx`: Interactive Day × Period matrix grid with faculty, room, and student group filters + live solver trigger.
  3. `SpectraWeek.tsx`: Fest-week prioritized bookings with decision status and alternative room recommendations.
  4. `NLBooking.tsx`: Bilingual conversational booking sandbox with quick-test English & Hindi presets.
  5. `Disruption.tsx`: Real-time disruption simulator (room maintenance, faculty leave, added sessions) with re-solve trigger.
  6. `Audit.tsx`: Real-time immutable audit trail, version history, and one-click JSON export.
- [x] Verified production build (`npm run build` exits 0 with 0 TypeScript/Vite errors).

### Phase 5: Official Validator & Submission Deliverables ✅
- [x] Baseline schedule exported to `exports/schedule.json`.
- [x] Official starter pack validator executed on baseline:
  - **Hard violations: 0**
  - **Soft penalty: 203**
  - **Booking score: 67.0** (22 approved, 1 alternative, 2 rejected, 0 inversions)
  - **Exam soft penalty: 0**
- [x] Disrupted schedule exported to `exports/schedule_after.json` using `sample_disruption.json`.
- [x] Official starter pack validator executed on disrupted schedule:
  - **Hard violations: 0**
  - **Soft penalty: 230**
  - **Booking score: 63.0** (20 approved, 3 alternatives, 2 rejected, 0 inversions)
  - **Exam soft penalty: 0**
  - **Stability: 185 sessions moved**
- [x] End-to-end test runner (`run_solver_e2e.py`) verified against live server.

### Phase 6: Student & Campus Portal ✅
- [x] Backend portal service (`app/portal.py`) with six demo profiles mapped to real groups.
- [x] Dashboard payload: next class, attendance, projected SGPA/CGPA, exams, events, mess, notifications.
- [x] Attendance logging with 75% target maths, what-if simulator, CSV export, JSON persistence.
- [x] Marks/CGPA projection with component breakdown and semester trend.
- [x] Exam timetable with half-capacity seat plans filtered to the student's group.
- [x] Weekly planner with fest events and contiguous free study windows.
- [x] Notes CRUD with server-side persistence, plus events/clubs/mess endpoints.
- [x] ⌘K campus search and student profile switcher (localStorage-backed).
- [x] Cold-start bootstrap from `exports/schedule.json`, so the portal works before the solver runs.
- [x] 8 new integration tests (`tests/test_portal.py`); full suite 21 passing.
- [x] Production frontend build verified.
