# STATE (read this first, update it last)

Keep this file short. Replace old text instead of adding to it.

## Current step
**Step 6** (not started). See `handoff/PLAN.md`.

## IN PROGRESS
(nothing. Before each change, write one line here: what and which files. Clear it when done.)

## Done
- Removed the pre-approved student portal, its tests, screenshots, routes, UI, and README text.
- Kept a staff-facing exam schedule and the timetable group filter.
- Removed unused SQLAlchemy/Alembic files: the running app uses the in-memory `state` object, not that database layer.
- Moved the live end-to-end script to `tests/solver_e2e.py`; it now accepts `INCIT_API_URL` and runs from any directory.
- Backend health check, frontend build, and 13 tests passed after cleanup.
- Recorded the owner's starter-pack path, AI history, and deployment status.
- Added environment, AI-use, and third-party declarations; README validator commands now use `STARTER_PACK`.
- Added one deterministic validity gate for solver output, manual reschedules, and booking changes; all 30 tests pass.
- Added S2–S4 soft penalties to the solver and regenerated the baseline schedule; all 32 tests pass.
- Added stable rescheduling: the solver makes existing sessions expensive to move, returns a per-session old/new/reason diff, and reports a plain-language no-fix conflict. The sample disruption now moves 13 sessions, not 185; all 36 tests pass.
- Added a pending/approved/rejected reschedule approval gate: changes remain proposals until approval, the validity gate runs before applying, and the UI shows the old/new diff before Admin controls. All 39 tests pass.

## Decided by the owner: follow the PS
- The problem statement decides every product question. Do not ask the owner to choose features. If the PS is silent, pick the simplest option that satisfies it and note it under "Decisions made".
- The student portal (attendance, marks, planner, notes, mess, clubs, campus search, student switcher) is NOT in the PS. Its removal is approved. Keep only a read-only timetable by student group.
- The removal list in PROJECT_BRIEF.md section 9 is pre-approved.

## Facts the AI cannot know (ask in ONE short message in Step 0, then record the answers here)
- Path of the starter pack on the owner's machine (STARTER_PACK): `C:\Users\aruna\Desktop\PRGS\CrunchWeek_StarterPack`
- Which AI tools wrote which parts so far (for AI_USAGE.md): Claude built most of the foundation; Opus continued the work through Antigravity; Codex performed Step 0 cleanup.
- Deployed link and host, if any: none yet (deployment is planned for Step 12).

## Baseline numbers (measured when the handoff was written; re-measure and replace after each step that changes them)
- `exports/schedule.json`: hard violations 0, soft penalty 3 (S1=0, S2=0, S3=0, S4=3, S5=0, S6=0), booking score 63.0 (20 approved, 3 alternatives, 2 rejected, 0 inversions), exam soft penalty 0. Solver time: 44.33 seconds (60-second cap).
- `exports/schedule_after.json` (sample disruption): hard violations 0, soft penalty 230, booking score 63.0, **185 sessions moved (target: a handful)**.
- Step 4 generated sample result (not written to `exports/`): official validator hard violations 0, soft penalty 3, **13 sessions moved** (7 time changes, 6 room-only); solve time 24.47 seconds.

## Commands (fill the paths in during Step 0)
- Run backend: `uvicorn app.main:app --port 8000 --reload`
- Run frontend: `cd frontend && npm run dev`
- Tests: `pytest -q`
- Official validator, baseline:
  `python STARTER_PACK/validator.py --data data/cit_public.json --schedule exports/schedule.json`
- Official validator, after change:
  `python STARTER_PACK/validator.py --data data/cit_public.json --schedule exports/schedule_after.json --disruption STARTER_PACK/examples/sample_disruption.json --baseline exports/schedule.json`

## Decisions made while working (one line each)
- Removed the unused database and migration layer because `main.py` and `state.py` do not import or use it.
- Retained `Exams.tsx` as a staff-only view backed by the scheduled exam assignments.
- Kept the demo script, removed its student-portal segment, and replaced its local starter-pack path with `STARTER_PACK`.
- Kept the exact starter-pack path only in the required owner-facts record; all product-facing commands use `STARTER_PACK`.
- The public `check_timetable` gate checks timetable sessions; `run_validation` adds booking and exam validation for full exports.
- The solver uses occupied group-period variables for S2 and S3, and repeated-course day counts for S4; its requested solve time is capped at 60 seconds.
- Stable rescheduling uses a 10,000-point move cost, ahead of soft preferences, instead of rigid locks so the solver can make the smallest necessary chain of repairs.
- Step 5 records approvals as `Admin (demo)` because authentication is deliberately added in Step 6; that step will replace this with the logged-in user.

## Known issues / watch out
- The ignored local runtime leftovers (`.freebuff`, caches, logs, database, and build output) are not tracked; `frontend/dist` is regenerated by the required build check.
- The literal Step 1 path grep cannot be empty because `handoff/PLAN.md` and `handoff/PROJECT_BRIEF.md` intentionally contain `C:\Users` examples, and `STATE.md` must retain the owner's exact path.
- `exports/schedule_after.json` is intentionally still the old 185-move baseline because this step may not edit exports; regenerate it through the app in Step 12.
