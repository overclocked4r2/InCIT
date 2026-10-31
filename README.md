# InCIT — Institutional Timetable & Resource Scheduling Engine

[![FastAPI](https://img.shields.io/badge/FastAPI-0.115+-009688?logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com)
[![OR-Tools](https://img.shields.io/badge/Google_OR--Tools-CP--SAT-4285F4?logo=google&logoColor=white)](https://developers.google.com/optimization)
[![React](https://img.shields.io/badge/React-19.0-61DAFB?logo=react&logoColor=black)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![Vite](https://img.shields.io/badge/Vite-8.0-646CFF?logo=vite&logoColor=white)](https://vitejs.dev)
[![TailwindCSS](https://img.shields.io/badge/Tailwind_CSS-v4-38B2AC?logo=tailwindcss&logoColor=white)](https://tailwindcss.com)
[![Validation](https://img.shields.io/badge/Official_Validator-0_Hard_Violations-success)](file:///exports/schedule.json)

**InCIT** is an institutional resource scheduling platform built for the **Zephyr Hackathon / CrunchWeek**. It combines Google's OR-Tools CP-SAT constraint programming solver, a prioritized booking engine for campus festivals, an exam room allocator, and a dual-language (English + Hindi) natural language booking parser into an interactive, real-time web dashboard.

---

## 🌟 Key Capabilities & Highlights

1. **Deterministic Constraint Satisfaction (CP-SAT)**:
   - Implements **all Hard Constraints H1 through H14** (faculty conflict-free, room capacity, equipment/type match, student group non-overlap, basket slot synchronization, daily faculty hour caps, lunch preservation, lab start restrictions).
   - Solves the complete 189-session institutional dataset in under **15 seconds** with **0 Hard Violations**.
   - Minimises the solver-side soft objectives (**S1** faculty avoid-preferences, **S5** room utilisation, **S6** P9 usage); the official validator additionally scores S2–S4.

2. **Spectra Fest-Week Booking Engine**:
   - Makes booking decisions using the official priority order: `exam`, `regular_session`, `institute_event`, `guest_lecture`, `department_event`, then `club_event`; equal requests use the earlier submission time.
   - Uses the requester's role to set the category (Admin, Faculty, Department coordinator, or Club), rejects cancelled requests, and offers clear alternatives where possible.

3. **Semester Exam Scheduler**:
   - Automatically allocates 41 semester exams into half-capacity rooms to ensure social distancing and strict non-cheating conditions.
   - Avoids group clashes across AM/PM exam slots; faculty invigilator rosters are a planned extension.

4. **Dual-Language Natural Language Booking (English & Hindi)**:
   - Regex-powered bilingual NLP engine extracting attendee counts, time windows, day preferences, accessibility needs, and equipment requests.
   - Understands native Hindi input (e.g., *"कल दोपहर 2 बजे 50 लोगों के लिए सेमिनार हॉल चाहिए"*).

5. **Dynamic Disruption Simulation & Re-Solving**:
   - Simulates emergency room closures (e.g., maintenance), sudden faculty leave, and urgent session insertions.
   - Instant re-solve capability with audit logging and stability metrics.

6. **Interactive Dark-Mode Web Dashboard**:
   - Modern React 19 + TypeScript + Vite frontend.
   - Interactive Timetable Grid (Day × Period matrix) filterable by Faculty, Room, or Student Group.
   - Fest-week approvals view, live bilingual NL booking sandbox, disruption tester, and one-click JSON export.

## 🏆 Official Validator Benchmark Results

Both output schedules were tested directly against the official CrunchWeek StarterPack `validator.py`:

### Baseline Schedule (`exports/schedule.json`)
```
Dataset: cit-public-v1   Schedule says: cit-public-v1   Team: InCIT
Hard violations: 0  {}
Soft penalty: 203  {'S1': 0, 'S2': 80, 'S3': 42, 'S4': 81, 'S5': 0, 'S6': 0}
Bookings: score 67.0 | approved 22, alternatives 1, rejected 2, session overrides 0, priority inversions 0
Exam soft penalty: 0
```

### Disrupted Schedule (`exports/schedule_after.json`)
```
Dataset: cit-public-v1   Schedule says: cit-public-v1   Team: InCIT
Hard violations: 0  {}
Soft penalty: 230  {'S1': 0, 'S2': 116, 'S3': 15, 'S4': 99, 'S5': 0, 'S6': 0}
Bookings: score 63.0 | approved 20, alternatives 3, rejected 2, session overrides 0, priority inversions 0
Exam soft penalty: 0
Stability: 185 sessions moved (179 changed time, 6 room only)
```

---

## 🏗️ System Architecture

```mermaid
graph TD
    User([User / Browser]) <--> Frontend[React 19 + Vite Frontend]
    Frontend <--> API[FastAPI Backend :8000]
    
    subgraph Core Engine
        API <--> Solver[OR-Tools CP-SAT Solver]
        API <--> Booking[Fest-Week Booking Engine]
        API <--> Exam[Exam Scheduler]
        API <--> NL[Bilingual NL Parser]
        API <--> State[Thread-Safe In-Memory State]
    end
    
    subgraph Data & Storage
        State <--> Dataset[(cit_public.json)]
        State <--> Exports[exports/*.json]
    end

    Exports --> Validator[CrunchWeek validator.py]
```

---

## 📁 Repository Structure

```
InCIT/
├── app/                        # FastAPI Backend Application
│   ├── main.py                 # REST API endpoints & route definitions (40+ endpoints)
│   ├── solver.py               # Google OR-Tools CP-SAT solver implementation
│   ├── booking_engine.py       # Fest-week / Spectra priority booking system
│   ├── exam_scheduler.py       # Exam room & slot scheduler (half capacity)
│   ├── nl_parser.py            # Bilingual English/Hindi natural language parser
│   ├── validator.py            # Deterministic interval validation engine
│   ├── validator_bridge.py     # Adapter to official CrunchWeek validator
│   ├── state.py                # In-memory runtime state, versioning, audit trail
│   ├── schemas.py              # Pydantic v2 schemas for all inputs/outputs
│   └── config.py               # Global settings, paths, CORS configurations
├── frontend/                   # React 19 Frontend Dashboard
│   ├── src/
│   │   ├── components/         # Layout and reusable UI components
│   │   ├── pages/
│   │   │   ├── Exams.tsx       # Exam slots, rooms and half-capacity seat plans
│   │   │   ├── Dashboard.tsx   # Admin system overview, KPIs, and status metrics
│   │   │   ├── Timetable.tsx   # Admin solver trigger + Day × Period matrix grid
│   │   │   ├── SpectraWeek.tsx # Fest-week bookings & priority decisions
│   │   │   ├── NLBooking.tsx   # Conversational booking sandbox (EN/HI)
│   │   │   ├── Disruption.tsx  # Outage simulator & dynamic re-solver
│   │   │   └── Audit.tsx       # Audit trail, version history & export
│   │   ├── components/CommandPalette.tsx  # Keyboard page navigation
│   │   ├── api.ts              # Typed API client for FastAPI
│   │   └── types.ts            # TypeScript interfaces matching backend models
│   ├── package.json
│   └── vite.config.ts
├── data/
│   └── cit_public.json         # Official 189-session benchmark dataset
├── exports/
│   ├── schedule.json           # Baseline timetable export
│   └── schedule_after.json     # Post-disruption timetable export
├── tests/
│   ├── test_validator.py       # Unit tests for validation logic
│   ├── test_nl_parser.py       # Bilingual parser regression tests
│   └── solver_e2e.py           # End-to-end integration test runner
├── requirements.txt            # Python dependencies
└── README.md                   # Project documentation
```

---

## 🚀 Quickstart Guide

### Prerequisites
- Python 3.11+
- Node.js 18+ and npm

### 1. Backend Setup
```bash
# Clone the repository and enter the directory
cd InCIT

# Create and activate virtual environment
python -m venv .venv
source .venv/bin/activate       # On Windows: .\.venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Run unit tests
pytest tests/ -q

# Start the FastAPI server
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```
Interactive Swagger documentation is available at **http://localhost:8000/docs**.

### 2. Frontend Setup
In a new terminal:
```bash
cd InCIT/frontend

# Install dependencies
npm install

# Start Vite dev server
npm run dev
```
Open **http://localhost:5173** to access the dashboard.

### 3. Run Official Validator
Verify the output files against the official StarterPack validator:
```bash
# Replace STARTER_PACK with the organiser starter-pack folder.
# Validate Baseline
python STARTER_PACK/validator.py --data data/cit_public.json --schedule exports/schedule.json

# Validate Disrupted
python STARTER_PACK/validator.py --data data/cit_public.json --schedule exports/schedule_after.json --baseline exports/schedule.json --disruption STARTER_PACK/examples/sample_disruption.json
```

### 4. Run with Docker (single container)
The multi-stage image builds the React dashboard and serves it from FastAPI, so the whole product runs on one port:
```bash
docker compose up --build
```
Open **http://localhost:8000**. The API, dashboard, and Swagger docs (`/docs`) are all served by the same container. No Node.js or Python install is required on the host.

---

## Demo accounts

| Role | Username | Password |
| --- | --- | --- |
| Admin | `admin@incit.demo` | `admin123` |
| Department coordinator | `coordinator@incit.demo` | `coord123` |
| Faculty | `faculty@incit.demo` | `faculty123` |
| Club representative | `club@incit.demo` | `club123` |


## 🎤 Judging Kit
- [5-minute demo script](docs/demo_script.md) — pre-flight, timeline, exact clicks, recovery plan.

---

## 📡 API Endpoints Overview

| Category | Endpoint | Method | Description |
|---|---|---|---|
| **System** | `/api/health` | GET | Health check status |
| **System** | `/api/dashboard` | GET | Overall KPI stats and schedule state |
| **Dataset** | `/api/dataset/status` | GET | Status of loaded rooms, sessions, faculty |
| **Dataset** | `/api/rooms`, `/api/faculty`, `/api/student-groups`, `/api/sessions` | GET | Query dataset entities |
| **Solver** | `/api/solver/generate` | POST | Trigger CP-SAT solver with configurable timeout |
| **Timetable** | `/api/timetable` | GET | Fetch active schedule with filters (room, faculty, group, day) |
| **Timetable** | `/api/timetable/publish`, `/api/timetable/archive` | POST | Publish or archive drafts |
| **Fest Week** | `/api/fest-week` | GET | View prioritized room booking decisions |
| **Fest Week** | `/api/fest-week/reprocess` | POST | Re-evaluate bookings against current timetable |
| **NL Booking** | `/api/nl-parse` | POST | Parse natural language request (English/Hindi) |
| **NL Booking** | `/api/nl-book` | POST | Parse and automatically place a booking |
| **Disruptions** | `/api/disruption/apply` | POST | Apply faculty/room outages or add/remove sessions |
| **Disruptions** | `/api/disruption/upload` | POST | Ingest disruption JSON file |
| **Reschedule** | `/api/reschedule` | POST | Check conflicts and move a single session |
| **Validation** | `/api/validate` | GET | Run the deterministic validator bridge over the current schedule |
| **Exports** | `/api/export/schedule`, `/api/export/save` | GET / POST | Export schedule in official schema format |
| **Audit** | `/api/audit` | GET | Query full immutable audit event trail |

---

## 👥 Hackathon Team
**Team InCIT**  
Developed for Zephyr Hackathon / CrunchWeek.
