# InCIT

InCIT is a timetable and campus-room scheduling demo for the Zephyr Hackathon / CrunchWeek dataset. It creates a weekly timetable, checks room booking requests, schedules exams, and lets staff propose timetable changes for Admin approval.

The important safety rule is simple: AI can help turn words into a draft, but only InCIT's own code and the organiser validator decide whether a timetable, booking, or change is valid.

## What it does

- Builds a timetable from the 189-session public dataset with OR-Tools.
- Checks hard rules such as room capacity, faculty and group clashes, lunch, lab slots, accessibility, fixed slots, and availability.
- Scores Spectra bookings by the dataset's priority rules and explains every rejection or alternative.
- Lets Faculty and Department coordinators submit change proposals; an Admin must approve a proposal before it changes the timetable.
- Provides timetable views by room, faculty, group, and day, including a phone-friendly read-only view.
- Accepts English and Hinglish booking requests as editable drafts. A user reviews the room, time, and requirements before the app validates and reserves it. Gemini is optional and only fills drafts or phrases code-derived explanations.

## Architecture

```mermaid
flowchart LR
    Browser[React + Vite dashboard] <--> API[FastAPI API]
    API <--> State[In-memory demo state]
    API --> Solver[OR-Tools timetable solver]
    API --> Booking[Deterministic booking engine]
    API --> Exams[Exam scheduler]
    API --> Gate[Validity gate]
    API -. optional draft or phrasing .-> Gemini[Gemini API]
    Dataset[cit_public.json] --> Solver
    Dataset --> Booking
    Solver --> Gate
    Booking --> Gate
    Gate --> Exports[Schedule JSON exports]
    Exports --> Validator[Organiser validator.py]
```

## Tech stack

- Backend: Python, FastAPI, Pydantic, OR-Tools CP-SAT
- Frontend: React, TypeScript, Vite, Tailwind CSS
- Data: the organiser's `cit_public.json` dataset and JSON schedule exports
- Optional AI: Gemini API, with prompts kept in `prompts/`

## Run from a clean machine

### You need

- Python 3.11 or newer
- Node.js 18 or newer with npm
- The organiser StarterPack folder if you want to run the official validator

### 1. Get the code and install Python packages

```powershell
git clone <YOUR_REPOSITORY_URL>
cd InCIT
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
```

On macOS or Linux, activate the environment with:

```bash
source .venv/bin/activate
```

### 2. Install the frontend packages

```powershell
cd frontend
npm install
cd ..
```

### 3. Run the app

Open two terminals in the repository. In the first terminal, start the API:

```powershell
.\.venv\Scripts\python.exe -m uvicorn app.main:app --port 8000 --reload
```

In the second terminal, start the frontend:

```powershell
cd frontend
npm run dev
```

Open the address Vite prints (normally `http://localhost:5173`). The API documentation is at `http://localhost:8000/docs`.

### 4. Optional Gemini setup

Copy `.env.example` to `.env`, then add a Gemini key only if you want AI draft parsing and explanation phrasing. Do not commit `.env` or a real key.

Without a key, manual forms, deterministic booking checks, timetable views, and code-derived explanations still work.

### 5. Run checks

```powershell
.\.venv\Scripts\python.exe -m pytest -q
cd frontend
npm run build
cd ..
```

## Demo accounts

| Role | Username | Password | Main use |
| --- | --- | --- | --- |
| Admin | `admin@incit.demo` | `admin123` | Approve timetable proposals, reset demo data, and request institute events |
| Department coordinator | `coordinator@incit.demo` | `coord123` | Generate timetables, submit changes, and request department events |
| Faculty | `faculty@incit.demo` | `faculty123` | Read timetables, request class changes, and request guest lectures |
| Club representative | `club@incit.demo` | `club123` | Submit club venue requests |

## A quick demo path

1. Sign in as the Department coordinator and open **Solver & timetable**.
2. Filter by a room, faculty member, or student group to find a class.
3. Open **NL booking** to prepare a room booking or a faculty change request.
4. Sign in as Admin and open **Disruptions & approvals** to approve or reject a pending class-change proposal.

## Validate the exported schedules

Set `STARTER_PACK` to the path of the organiser's StarterPack folder, then run these commands from the InCIT repository:

```powershell
python "$env:STARTER_PACK/validator.py" --data data/cit_public.json --schedule exports/schedule.json
python "$env:STARTER_PACK/validator.py" --data data/cit_public.json --schedule exports/schedule_after.json --disruption "$env:STARTER_PACK/examples/sample_disruption.json" --baseline exports/schedule.json
```

The committed baseline export was last checked with 0 hard violations and a soft penalty of 3. The committed disruption export is intentionally an older 185-move example; Step 12 regenerates it through the app before submission.

## Known limitations

- This is a demo: state is kept in memory and resets when the server restarts.
- Demo credentials are intentionally simple and are not suitable for a real deployment.
- Gemini is optional. It never makes a validity, priority, or approval decision, and the app falls back to deterministic/manual paths if it is down.
- Public demo: [incit.onrender.com](https://incit.onrender.com). Demo data is in memory and resets when the service restarts.
- The app is designed around the supplied public dataset, not a production identity or database system.

## AI use and safety

See [AI_USAGE.md](AI_USAGE.md) for the product's optional Gemini use, the AI tools used to build the project, and the rules that keep validity decisions in deterministic code.
