# InCIT — 5-Minute Demo Script

**Goal:** in five minutes, prove three things — the timetable is hard-constraint correct, the product handles the messy parts of campus scheduling, and the result is independently verifiable.

**Target length:** 4:40, leaving 20 seconds of slack.
**Speaker:** one presenter driving; one teammate on standby to restart a server or open the fallback exports.

---

## Pre-flight (T-15 minutes)

1. Start the verified dev path:
   ```bash
   # Terminal 1 — API on :8000
   ./.venv/Scripts/python -m uvicorn app.main:app --host 0.0.0.0 --port 8000
   ```
   ```bash
   # Terminal 2 — dashboard on :5173
   cd frontend && npm run dev
   ```
   If you have already built the image once, `docker compose up` serves the same app on port 8000; do not make the first Docker build part of the live demo.
2. Open `http://localhost:8000` (container) or `http://localhost:5173` (dev), then go to `/dashboard`.
3. Go to **Timetable → Run Solver** once and wait for `189 sessions assigned`. The state is in memory; keep the server process alive. This removes a ~25-second wait from the live demo.
4. Open these tabs in order: Dashboard, Timetable, Spectra Week, NL Booking, Disruptions, Audit Trail. Close notifications and terminal windows.
5. Have the fallback ready: `exports/schedule.json` and `exports/schedule_after.json`, plus this validator command in a terminal:
   ```bash
   python STARTER_PACK/validator.py \
     --data data/cit_public.json --schedule exports/schedule.json
   ```
6. Say the numbers out loud once before you start: **189 sessions, 27 rooms, 40 faculty, 14 groups, 25 booking requests, 41 exams, 0 hard violations.**

> If the solver is mid-run when you are introduced, **do not restart it**. Talk over it; it finishes in roughly 25 seconds and the UI reports the assignment count.

---

## Timeline

| Time | Screen | Beat |
|---|---|---|
| 0:00–0:25 | Dashboard | Hook: the scale of the puzzle |
| 0:25–0:55 | Dashboard | Why this is hard: three coupled workloads |
| 0:55–1:50 | Timetable | CP-SAT and the hard-constraint model |
| 1:50–2:30 | Spectra Week | Fest-week priority, role caps, displacement |
| 2:30–3:10 | NL Booking | Bilingual natural-language booking |
| 3:10–4:05 | Disruptions | Re-solve under a real disruption |
| 4:05–4:40 | Audit Trail | Proof, auditability, close |

---

## Script

### 0:00–0:25 — Hook (Dashboard)

> "This is InCIT. It schedules an entire institute: **189 sessions, 27 rooms, 40 faculty, 14 student groups, 25 fest-week booking requests, and 41 semester exams** — in one weekly plan.
>
> The interesting part is not that it produces a timetable. It is that an **independent official validator checks the output and finds zero hard violations** — on the normal week and on the disrupted week."

*Point at the KPI row: 189/189 scheduled, 27 rooms, 40 faculty, 25 requests, 41 exams.*

### 0:25–0:55 — Why it is hard

> "Three workloads share the same resources. The weekly timetable can't double-book a faculty member, a room, or a cohort. Spectra week then asks for the same rooms, with priority rules. And exams need rooms at **half capacity** while never clashing with a group's other exams.
>
> A spreadsheet can hold one of these. It cannot hold all three, prove the result, and re-plan when reality changes."

### 0:55–1:50 — Timetable (Timetable page)

*Show the Day × Period grid. Hover a cell so the course, room, faculty, and group are visible. Use the Group filter once.*

> "The scheduler is a CP-SAT model. It decides day, start period, and room for every session under constraints H1 through H14: no faculty clash, no room clash, no group clash, room capacity and type, accessibility, faculty availability, room outages, lunch preservation, lab start periods, basket slots that must move together, fixed slots, and daily faculty hour caps.
>
> It solves all 189 sessions to **optimality** — around **25 seconds** on a laptop, with zero hard violations. The grid you see is the draft; publish and archive are versioned, and every action lands in the audit trail.
>
> The solver is not grading its own homework. We replay the schedule through the CrunchWeek StarterPack validator, and the committed export scores **0 hard violations, soft penalty 203**."

### 1:50–2:30 — Spectra Week

*Open Spectra Week. Point at the 22 / 1 / 2 cards, then scroll the decisions.*

> "Fest week is where most timetables break. Requests are ranked by the official priority order — exam, regular session, institute event, guest lecture, department event, club event — and each role has a category cap, so a club cannot self-approve an institute-level event.
>
> Only institute events may displace a regular class, and when they do, the displaced session is **moved, not dropped**. Result: **22 approved, 1 alternative offered, 2 rejected** — the two rejections are the cancelled requests — with **zero priority inversions**."

### 2:30–3:10 — NL Booking (click the Hindi example)

*Click the Devanagari example: “मुझे बुधवार को 60 छात्रों के लिए एक क्लासरूम चाहिए, पीरियड 5-6”.*

> "This is the part judges usually expect an LLM for. We deliberately do not use one. A deterministic bilingual parser extracts attendance, duration, day, period window, room type, equipment, and accessibility needs — in English or Hindi, including Devanagari.
>
> This request becomes: **60 students, Wednesday, periods 5–6, classroom**. The engine checks the live timetable, finds **CR-205**, and approves it. No API key, no latency, no hallucination — and every parse is explainable and auditable."

*If asked: the parser also handles romanised Hindi such as “kal dopahar 2 baje 50 logon ke liye seminar hall chahiye”.*

### 3:10–4:05 — Disruptions

*Open Disruptions. Select **Classroom A-102 (CR-102)**, choose `WED`, periods `3–4`, reason "Maintenance", click **Apply Disruption**, then **Re-solve**. Narrate while it runs.*

> "Now reality: a room is closed for maintenance. We apply the outage and re-solve against the disrupted data.
>
> While that runs, here is the honest trade-off. The re-solve prioritises feasibility over stability, so it finds a valid plan even if many sessions move. On the sample disruption — faculty leave, a closed room, and an added session — the disrupted export still validates at **0 hard violations**, with **185 sessions moved**.
>
> Stability is a measurable soft objective, not a hidden one, and the next iteration adds a baseline-distance term to keep unaffected sessions pinned. We report the number because a scheduler you cannot interrogate is not trustworthy."

*When it completes: "189 of 189 assigned again."*

### 4:05–4:40 — Close (Audit Trail)

*Open Audit Trail. Show the event list and the Validate / Export buttons.*

> "Every generate, publish, booking, disruption, and reschedule is logged with a timestamp. From here we export the exact schedule JSON that the official validator reads.
>
> InCIT is one engine for the weekly timetable, fest week, and exams — deterministic, offline, explainable, and **0 hard violations on both official runs**. The next step is stability-aware re-solving at institute scale. Thank you — what would you like us to schedule?"

---

## If something breaks

| Failure | Recovery |
|---|---|
| Solver is slow | Keep talking; it is time-boxed at 120 s. Do not click twice. |
| Backend offline | Switch to `exports/schedule.json` and the validator output already on screen. |
| A booking is rejected live | Treat it as a feature: "the engine rejected it because the slot is genuinely occupied — here is the reason." |
| Disruption re-solve fails | Show `exports/schedule_after.json`; it is the pre-computed disrupted schedule with the same 0-violation result. |
| Hindi input does not parse | Use the English preset with explicit periods; note that the parser is deterministic and requires a day + duration. |

---

## Lines to avoid

- "Our AI figures it out." — There is no LLM in the parsing path; say **deterministic bilingual parser**.
- "We assign invigilators." — The exam scheduler allocates **rooms and slots at half capacity**; faculty invigilation rosters are roadmap.
- "Soft penalty zero." — The solver minimises its own soft subset; the official validator reports **203** (baseline) and **230** (disrupted). Quote those.
- "It takes 15 seconds." — Say **roughly 25 seconds** unless you have just measured it.
