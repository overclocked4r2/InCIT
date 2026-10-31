# InCIT — Judge Q&A Preparation

Five questions you should expect, with answers that match the code and the validator output. Each answer is designed to fit in 20–30 seconds.

---

## 1. “You claim zero hard violations. How do we know you are not grading your own homework?”

**Answer:**
> "We do not grade it. The committed exports are run through the official CrunchWeek StarterPack `validator.py`, which is independent of our code. Baseline: **0 hard violations, soft 203**. Disrupted: **0 hard violations, soft 230**. We also keep an internal deterministic validator and a bridge that mirrors the official rules, so the UI can validate without shelling out. The export is the same JSON the official validator reads."

**Evidence to show**
- `exports/schedule.json` and `exports/schedule_after.json`.
- Exact command from the README.
- The validator output line: `Hard violations: 0  {}`.

**If they push:** the bridge is a re-implementation used for live feedback, not the source of truth. The headline numbers come from the official validator.

---

## 2. “One disruption moved 185 sessions. Isn’t that unusable?”

**Answer:**
> "It is the honest cost of re-solving from scratch. The current model optimises hard feasibility and three soft preferences; it has no term that rewards staying close to the baseline. So the solver is free to find a different valid plan, and it does — **179 sessions change time, 6 change room only**.
>
> We report stability as a first-class metric rather than hiding it. The next change is a baseline-distance objective: penalise moving a session, or pin unaffected sessions and re-solve only the affected neighbourhood. The architecture already stores the baseline, so this is an objective change, not a rewrite."

**Do not say:** "185 is fine" or "stability does not matter." Say it is the known next optimisation.

**If they ask why not implement it now:** the hackathon deadline prioritised correctness across three schedulers; stability is a measured follow-up.

---

## 3. “Why a regex parser instead of an LLM? Isn't that less impressive?”

**Answer:**
> "It is deliberately less magical and more usable. The parser is deterministic, runs offline with zero latency and zero cost, and every field it extracts can be shown to the user. It handles English and Hindi, including Devanagari and romanised Hindi: attendance, duration, day, period window, room type, equipment, accessibility, and cohort.
>
> The demo request becomes **60 students, Wednesday, periods 5–6, classroom**, and the engine approves **CR-205**. An LLM can sit in front as a fallback for messy free text, but it should not be the component that decides whether a room is double-booked."

**Evidence**
- Click the Hindi preset; the parsed-details panel shows attendance, duration, room types, and confidence.
- 13 unit tests, including five parser regressions for the demo prompts.

**If they ask about ambiguous input:** the parser returns a targeted follow-up question instead of guessing. Example: “I need a lab for 40 students Thursday morning” asks for the missing duration.

---

## 4. “Will this scale to a real institute — thousands of sessions?”

**Answer:**
> "The current benchmark is 189 sessions across 27 rooms and 5 days, solved to optimality in roughly **25 seconds** on a laptop. The model is a Boolean assignment per session × day × start × compatible room, so it grows with real rooms and slots, not combinatorially in the abstract.
>
> For 10,000 sessions, the plan is decomposition: solve per department or cohort, freeze shared resources between slices, add symmetry breaking, and warm-start from the previous term. CP-SAT is time-boxed, so it always returns the best feasible plan within the budget rather than hanging."

**Be honest:** "We have not benchmarked at 10,000 sessions. The path is decomposition plus warm starts; the current numbers are the proof that the constraint model is sound."

---

## 5. “What is not production-ready?”

**Answer:**
> "Three things, and we will name them before you do.
>
> First, runtime state is in memory — drafts, audit log, and disruption state reset with the process. The SQLAlchemy models and Alembic migration exist, but the live demo path does not persist to them yet.
>
> Second, there is no authentication or multi-tenancy; this is a single-institute demo.
>
> Third, exams allocate **rooms and slots at half capacity** and avoid group clashes, but faculty invigilator rosters are not assigned. The faculty availability and daily-hour constraints are already modelled, so that is a thin extension.
>
> Stability-aware re-solving is the fourth, and we have already covered it."

This answer builds credibility. Judges reward teams that know their boundaries.

---

## Rapid-fire answers

| Question | Answer |
|---|---|
| Why CP-SAT instead of a genetic algorithm or greedy? | Declarative hard constraints, optimality bounds, and a proof of infeasibility. Greedy cannot guarantee H1–H14; CP-SAT can. |
| What happens if the problem is infeasible? | The solver returns `infeasible`; the UI surfaces it, and the constraint set can be relaxed deliberately rather than silently dropping a session. |
| How are basket slots handled? | Sessions sharing a basket slot are forced to the same day and start period, and the group can only have one active basket at a time. |
| How do labs differ? | Labs must start at P2 or P6 and must use a lab-type room; the model encodes both as hard constraints. |
| How do exams avoid clashes? | Exam week has AM/PM slots; a group is assigned at most one exam per slot, and room capacity counts at 50%. All 41 exams are placed with exam soft penalty 0. |
| How does fest-week priority work? | Priority order `exam > regular_session > institute_event > guest_lecture > department_event > club_event`, plus a per-role category cap. Only institute events may displace a regular session, and displaced sessions are moved, not dropped. |
| What are the rejection reasons? | The two rejected requests are the two cancellations; the engine rejects them explicitly rather than leaving them undecided. |
| Is any data sent to a third party? | No. The dataset, solver, parser, and validator all run locally. |
| What did you build versus use? | OR-Tools is the solver library. We built the constraint model, booking engine, exam scheduler, bilingual parser, validation bridge, API, and UI. |
| How long did the solve take? | Roughly 25 seconds for 189 sessions on the demo laptop, with a 120-second time box available. |
| How many tests? | 13 unit tests passing, plus an end-to-end solver script and two official validator runs. |

---

## Known limitations (say these before judges find them)

1. **Stability is measured, not optimised.** 185 sessions moved on the sample disruption.
2. **Invigilator rosters are not assigned.** Exam scheduling covers room capacity, slots, and group clashes.
3. **Runtime state is in memory.** SQLAlchemy models and Alembic migration are scaffolded; the demo does not persist live state.
4. **No auth / multi-tenant isolation.**
5. **The solver objective covers S1, S5, S6.** S2/S3/S4 are scored by the official validator but not yet optimised.
6. **Hindi parsing is keyword-based, not grammar-complete.** It handles the vocabulary and structures in the demo; arbitrary Hindi prose may need the LLM fallback.

---

## Traps to avoid

| Don't say | Say instead |
|---|---|
| "Our AI schedules it." | "Our CP-SAT model schedules it." |
| "Zero soft penalty." | "Soft penalty 203 baseline, 230 disrupted." |
| "We assign invigilators." | "We allocate exam rooms at half capacity and avoid group clashes." |
| "Re-solving is instant." | "Time-boxed; roughly 25 seconds on the demo laptop." |
| "It scales to any size." | "189 sessions today; decomposition and warm starts are the scale path." |
| "The regex is just a fallback." | "The deterministic parser is the product choice: offline, auditable, zero latency." |

---

## If the demo fails

1. **Stay on the current tab.** Do not open a terminal and debug in front of judges.
2. Switch to the committed exports and the validator output.
3. Say: "The export is the artifact that matters; it is the same file the official validator scored."
4. Offer the exact command so a judge can reproduce it after the pitch.

---

## 30-second elevator version

> "InCIT schedules a whole institute — classes, fest-week bookings, and exams — with OR-Tools CP-SAT, a priority booking engine, and a deterministic English/Hindi booking parser. Both the baseline and disrupted schedules pass the official CrunchWeek validator with zero hard violations: 189 of 189 sessions in the baseline, 190 of 190 after the added session, and 41 of 41 exams. It is offline, explainable, and auditable, and the next step is stability-aware re-planning."
