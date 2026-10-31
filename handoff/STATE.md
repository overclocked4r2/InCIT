# STATE (read this first, update it last)

Keep this file short. Replace old text instead of adding to it.

## Current step
**Step 0** (not started). See `handoff/PLAN.md`.

## IN PROGRESS
(nothing. Before each change, write one line here: what and which files. Clear it when done.)

## Done
(none yet)

## Decided by the owner: follow the PS
- The problem statement decides every product question. Do not ask the owner to choose features. If the PS is silent, pick the simplest option that satisfies it and note it under "Decisions made".
- The student portal (attendance, marks, planner, notes, mess, clubs, campus search, student switcher) is NOT in the PS. Its removal is approved. Keep only a read-only timetable by student group.
- The removal list in PROJECT_BRIEF.md section 9 is pre-approved.

## Facts the AI cannot know (ask in ONE short message in Step 0, then record the answers here)
- Path of the starter pack on the owner's machine (STARTER_PACK): ?
- Which AI tools wrote which parts so far (for AI_USAGE.md): ?
- Deployed link and host, if any: ?

## Baseline numbers (measured when the handoff was written; re-measure and replace after each step that changes them)
- `exports/schedule.json`: hard violations 0, soft penalty 203 (S2=80, S3=42, S4=81), booking score 67.0 (22 approved, 1 alternative, 2 rejected, 0 inversions), exam soft penalty 0.
- `exports/schedule_after.json` (sample disruption): hard violations 0, soft penalty 230, booking score 63.0, **185 sessions moved (target: a handful)**.

## Commands (fill the paths in during Step 0)
- Run backend: `uvicorn app.main:app --port 8000 --reload`
- Run frontend: `cd frontend && npm run dev`
- Tests: `pytest -q`
- Official validator, baseline:
  `python STARTER_PACK/validator.py --data data/cit_public.json --schedule exports/schedule.json`
- Official validator, after change:
  `python STARTER_PACK/validator.py --data data/cit_public.json --schedule exports/schedule_after.json --disruption STARTER_PACK/examples/sample_disruption.json --baseline exports/schedule.json`

## Decisions made while working (one line each)
(none yet)

## Known issues / watch out
(none yet. The list of known problems from the start is in PROJECT_BRIEF.md section 8.)
