# InCIT — Implementation Progress Log

> **Purpose**: Resume any broken session instantly. Read THIS file first.

## Project Summary

**InCIT** is an institutional timetable & resource scheduling system for the Zephyr Hackathon (CrunchWeek). It must:
1. Load the CIT dataset (`data/cit_public.json` — 189 sessions, 27 rooms, 40 faculty, 14 groups, 25 booking requests, 41 exams)
2. Generate a valid timetable via OR-Tools CP-SAT solver
3. Process Spectra-week (fest_week) booking requests with priority rules
4. Schedule exams
5. Handle disruptions and re-solve
6. Export `exports/schedule.json` and `exports/schedule_after.json` in the exact format the **official validator** (`C:\Users\aruna\Downloads\CrunchWeek_StarterPack\validator.py`) expects
7. Provide a polished React frontend for demo

### Key Reference Files
- **Starter Pack**: `C:\Users\aruna\Downloads\CrunchWeek_StarterPack\` (README, validator, data, examples)
- **Dataset**: `c:\Users\aruna\Desktop\PRGS\InCIT\data\cit_public.json` (copied from starter pack)
- **Official Validator**: `C:\Users\aruna\Downloads\CrunchWeek_StarterPack\validator.py`
- **Sample Disruption**: `C:\Users\aruna\Downloads\CrunchWeek_StarterPack\examples\sample_disruption.json`

### Tech Stack
- **Backend**: Python, FastAPI, SQLAlchemy, Alembic, OR-Tools, SQLite
- **Frontend**: React + Vite + TypeScript + Tailwind CSS (to be created at `frontend/`)
- **Venv**: `.venv/` (all deps installed)

---

## Completed Work

### Phase 1 — Foundation ✅
- [x] Repo inspected, existing code preserved
- [x] SQLAlchemy models (19 tables) — `app/models.py` — unchanged, well-structured
- [x] Database setup with FK/WAL — `app/db.py` — unchanged
- [x] Alembic migration with SQLite triggers for published schedule immutability — `alembic/versions/0001_schema_v1.py`
- [x] Deterministic validator — `app/validator.py` — unchanged, 8 tests passing
- [x] All 8 existing tests pass (`tests/test_validator.py`)
- [x] Dependencies installed: fastapi, sqlalchemy, alembic, pydantic, ortools, pytest, uvicorn, python-multipart, httpx

### Phase 2 — Backend Services ✅
- [x] **Config** — `app/config.py` — paths, DB URL, CORS, team name
- [x] **Dataset loader** — `app/dataset.py` — cached JSON loader with typed accessors
- [x] **OR-Tools solver** — `app/solver.py` — CP-SAT model with all hard constraints (H1-H14) and soft objectives (S1, S5, S6)
- [x] **Booking engine** — `app/booking_engine.py` — Spectra week processor with priority ordering, role-category cap, displacement logic
- [x] **Exam scheduler** — `app/exam_scheduler.py` — greedy scheduler with half-capacity rooms
- [x] **NL parser** — `app/nl_parser.py` — regex-based parser for English + Hindi, extracts attendance/duration/windows/rooms/needs
- [x] **Pydantic schemas** — `app/schemas.py` — all request/response models
- [x] **App state** — `app/state.py` — in-memory singleton managing timetable, bookings, audit, versioning, export
- [x] **Validator bridge** — `app/validator_bridge.py` — official validator logic as importable module
- [x] **FastAPI app** — `app/main.py` — all API routes (see file map below)
- [x] Backend starts successfully (`uvicorn app.main:app --port 8000`)

### Phase 3 — Solver ✅ (code written, needs runtime test)
- [x] OR-Tools CP-SAT model created with all constraints
- [ ] **NEEDS TEST**: Run solver on actual dataset and validate output with official validator

### Phase 4 — Frontend 🔴 NOT STARTED
- [ ] Create Vite + React + TypeScript + Tailwind project at `frontend/`
- [ ] Design system / layout shell
- [ ] Dashboard page
- [ ] Timetable view (grid by day/period, filterable)
- [ ] Solver trigger + progress UI
- [ ] NL booking page
- [ ] Fest week / Spectra booking decisions view
- [ ] Rescheduling UI
- [ ] Disruption upload UI
- [ ] Audit log view
- [ ] Validation report view
- [ ] Export controls

### Phase 5 — Integration & Demo 🔴 NOT STARTED
- [ ] Run solver end-to-end
- [ ] Validate with official validator
- [ ] Apply sample disruption, re-solve, export `schedule_after.json`
- [ ] Validate after-disruption schedule
- [ ] Final test suite
- [ ] Update README with setup/demo instructions

---

## API Endpoints (all at localhost:8000)

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/health` | Health check |
| GET | `/api/dashboard` | Dashboard stats |
| GET | `/api/dataset/status` | Dataset load status |
| GET | `/api/rooms` | List rooms |
| GET | `/api/faculty` | List faculty |
| GET | `/api/student-groups` | List student groups |
| GET | `/api/sessions` | List sessions |
| GET | `/api/courses` | List courses |
| GET | `/api/booking-requests` | Booking requests + priority info |
| GET | `/api/exams` | List exams |
| GET | `/api/calendar` | Calendar config |
| POST | `/api/solver/generate` | Run OR-Tools solver |
| GET | `/api/timetable` | Get timetable (filterable) |
| POST | `/api/timetable/publish` | Publish draft |
| POST | `/api/timetable/archive` | Archive current |
| GET | `/api/timetable/versions` | Version history |
| GET | `/api/fest-week` | Spectra booking decisions |
| POST | `/api/fest-week/reprocess` | Reprocess bookings |
| POST | `/api/nl-parse` | Parse NL booking text |
| POST | `/api/nl-book` | Parse + attempt booking |
| POST | `/api/reschedule` | Request reschedule |
| GET | `/api/reschedule/history` | Reschedule history |
| POST | `/api/disruption/apply` | Apply disruption |
| POST | `/api/disruption/upload` | Load disruption file |
| DELETE | `/api/disruption` | Clear disruption |
| GET | `/api/validate` | Run official validator |
| GET | `/api/export/schedule` | Export as JSON |
| POST | `/api/export/save` | Save to exports/ |
| GET | `/api/audit` | Audit log |
| POST | `/api/reset` | Reset all state |

## How to Resume

```bash
cd c:\Users\aruna\Desktop\PRGS\InCIT
.\.venv\Scripts\activate
# Backend
.\.venv\Scripts\python -m uvicorn app.main:app --port 8000 --reload
# Frontend (once created)
cd frontend && npm run dev
```

## File Map

```
InCIT/
├── app/
│   ├── __init__.py          # empty
│   ├── config.py            # Configuration (paths, DB, CORS)
│   ├── db.py                # SQLAlchemy engine/session (EXISTING)
│   ├── models.py            # 19 SQLAlchemy models (EXISTING)
│   ├── validator.py         # Deterministic validator (EXISTING)
│   ├── dataset.py           # CIT JSON loader
│   ├── solver.py            # OR-Tools CP-SAT solver
│   ├── booking_engine.py    # Spectra week booking processor
│   ├── exam_scheduler.py    # Exam scheduler
│   ├── nl_parser.py         # Natural-language booking parser
│   ├── schemas.py           # Pydantic request/response models
│   ├── state.py             # In-memory app state singleton
│   ├── validator_bridge.py  # Official validator as importable module
│   └── main.py              # FastAPI app with all routes
├── alembic/                 # Migrations (EXISTING)
│   └── versions/0001_schema_v1.py
├── data/
│   └── cit_public.json      # CIT dataset (copied from starter pack)
├── tests/
│   └── test_validator.py    # 8 passing validator tests (EXISTING)
├── frontend/                # TO BE CREATED - React+Vite+TS+Tailwind
├── exports/                 # TO BE CREATED - schedule.json outputs
├── .agents/PROGRESS.md      # THIS FILE
├── requirements.txt
└── alembic.ini
```

## Known Issues / Blockers
- Solver not yet tested on actual 189-session dataset — may need time_limit or constraint tuning
- `alembic.ini` line 31 has a space before `datefmt` — cosmetic only
- `test_begin.db` is a leftover file in project root — can be deleted
- No frontend exists yet — immediate next step
