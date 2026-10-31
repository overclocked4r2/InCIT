# InCIT — Six-Slide Pitch Deck Outline

**Deck length:** 6 slides, ~30 seconds each, aligned to the 5-minute demo script in [demo_script.md](demo_script.md).

**Design direction:** dark glassmorphic UI, one accent colour (violet), large numbers, almost no bullet text. Every claim on a slide must be one you can point to in the product or in the validator output.

---

## Slide 1 — “The timetable that proves itself”

**Subtitle:** Institutional scheduling for the weekly timetable, fest week, and exams.

**On-slide content**
- InCIT · Team InCIT · Zephyr Hackathon / CrunchWeek
- Four metric chips along the bottom:
  - **189** sessions scheduled
  - **0** hard violations
  - **41** exams placed
  - **2** languages supported
- One-line footer: *Verified by the official CrunchWeek validator, not by us.*

**Visual**
Full-bleed dashboard screenshot: [assets/dashboard.png](assets/dashboard.png).
Crop to the KPI row and the “0 hard violations” status card.

**Speaker notes (25 s)**
> "InCIT schedules an entire institute: 189 sessions across 27 rooms, 40 faculty, 14 groups, 25 fest bookings, and 41 exams. The headline is not that it runs. It is that the official validator finds zero hard violations — twice."

---

## Slide 2 — “A campus is a constraint graph, not a calendar”

**Subtitle:** Three coupled workloads, one shared pool of rooms and people.

**On-slide content**
- Weekly timetable: faculty, room, and cohort clashes; labs; lunch; basket slots.
- Spectra week: priority order, role caps, displacement of classes.
- Exams: half-capacity rooms, AM/PM slots, no group double-booking.
- Bottom callout: **“A spreadsheet can hold one of these. It cannot hold all three and prove the result.”**

**Visual**
Three-column diagram, each column a workload, all arrows converging on one “Rooms · Faculty · Groups” cylinder.

**Speaker notes (25 s)**
> "The hard part is not any single constraint. It is that fest week and exams compete for the same rooms as the weekly timetable, and every change can invalidate the others."

---

## Slide 3 — “One engine, four solvers, one audit trail”

**Subtitle:** React dashboard on a FastAPI core, with OR-Tools CP-SAT at the centre.

**On-slide content**
- **Frontend:** React 19 + TypeScript + Vite + Tailwind — six views, live API.
- **Core:** CP-SAT timetable solver · priority booking engine · greedy exam scheduler · bilingual NL parser.
- **Proof loop:** internal deterministic validator + official StarterPack `validator.py` bridge.
- **State:** versioned drafts, publish/archive, immutable audit log, JSON export.

**Visual**
Left-to-right architecture strip:
`React UI → FastAPI /api → {CP-SAT · Bookings · Exams · NL} → SQLite/Alembic → schedule.json → Official validator`

**Speaker notes (30 s)**
> "The UI never computes a schedule. It calls a FastAPI service. The service owns the constraints and the state, and the same JSON export feeds the official validator. That separation is why we can prove the result instead of demoing a screenshot."

---

## Slide 4 — “H1–H14 are hard. Soft preferences are priced.”

**Subtitle:** What the solver refuses to break, and what it trades off.

**On-slide content**
- Hard constraints: no faculty / room / group double-booking; capacity and room type; accessibility; faculty and room unavailability; lunch; lab starts P2/P6; basket slots move together; fixed slots; daily hour caps.
- Soft objectives **in the solver**: faculty avoid-preferences (S1), room utilisation (S5), P9 usage (S6).
- Soft rules **scored by the official validator**: group gaps (S2), daily load (S3), repeated lectures (S4) — reported, not yet in the objective.
- Fest-week rules: official priority order, role-category caps, displacement only for institute events.
- Exams: 50% room capacity, AM/PM slots, no group clash.

**Visual**
Two stacked bands — “HARD: cannot violate” in solid violet, “SOFT: priced” in outlined violet — with the constraint names as small chips. Small inset: [assets/timetable.png](assets/timetable.png).

**Speaker notes (30 s)**
> "This is the intellectual core. Hard constraints are model invariants, not post-hoc checks. Soft preferences are penalties the solver can trade. And fest-week priority is encoded as a category cap per role, so the engine cannot approve a request above the requester's authority."

---

## Slide 5 — “Proof, not promises”

**Subtitle:** Same dataset, same official validator, two scenarios.

**On-slide content**

| Metric | Baseline | After disruption |
|---|---|---|
| Hard violations | **0** | **0** |
| Soft penalty | 203 | 230 |
| Bookings score | 67.0 | 63.0 |
| Approved / alternative / rejected | 22 / 1 / 2 | 20 / 3 / 2 |
| Priority inversions | 0 | 0 |
| Exam soft penalty | 0 | 0 |
| Sessions moved | — | 185 (179 time, 6 room-only) |

- Callout: **189/189 assigned in the baseline; 190/190 after the added session. 41/41 exams placed. 0 hard violations by the official validator.**
- Footnote: disruption = faculty leave + room closure + added session (the added session makes the disrupted dataset 190 sessions).

**Visual**
The table above, plus a small terminal-style block showing the validator line `Hard violations: 0 {}`.

**Speaker notes (35 s)**
> "These are the numbers we will defend. Zero hard violations on both runs, zero priority inversions, zero exam penalty. The soft penalty rises from 203 to 230 after disruption, and 185 sessions move — that is the honest cost of re-solving from scratch, and it is visible in the export rather than hidden."

---

## Slide 6 — “From 189 to 10,000 — and the ask”

**Subtitle:** What is built, what is next, and what we want to build with you.

**On-slide content**
- **Built:** full timetable + fest week + exams + bilingual booking + disruption re-solve + audit/export, all in one stack.
- **Next:** stability-aware re-solve (baseline-distance objective), invigilator rosters, Postgres + auth, department-level decomposition for 10k sessions.
- **Ask:** pilot on one real institute term; we bring the constraint model and the validator loop.
- Closing line: **“A schedule you can inspect, explain, and defend.”**

**Visual**
Roadmap as three chevrons: *Prove (now) → Stabilise (next) → Scale (pilot)*. Screenshot fragment: [assets/nl-hindi-booking.png](assets/nl-hindi-booking.png) or [assets/spectra-week.png](assets/spectra-week.png) as a small inset.

**Speaker notes (30 s)**
> "We are not claiming production readiness. We are claiming a correct, inspectable scheduling core and a product that demonstrates every hard case. The next milestone is stability-aware re-planning, then a pilot on a real term."

---

## Numbers to memorise

| Claim | Value |
|---|---|
| Sessions / rooms / faculty / groups | 189 / 27 / 40 / 14 |
| Sessions in disrupted export | 190 (189 + 1 added) |
| Session mix | 153 lectures, 27 labs, 9 tutorials |
| Booking requests / cancellations | 25 / 2 |
| Exams | 41 |
| Solver result | optimal, 189/189, ~25 s |
| Baseline validator | 0 hard, soft 203, bookings 67.0, exams 0 |
| Disrupted validator | 0 hard, soft 230, bookings 63.0, exams 0 |
| Stability | 185 moved (179 time, 6 room-only) |
| Unit tests | 13 passing |

**Do not say:** “AI”, “zero soft penalty”, “invigilators assigned”, “instant re-solve”, or “15 seconds”. Say **deterministic parser**, **soft penalty 203/230**, **exam rooms at half capacity**, **~25 seconds**, **time-boxed CP-SAT**.
