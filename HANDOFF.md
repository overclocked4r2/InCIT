# InCIT handoff

## Current status

This is the current continuation note. Read this and `handoff/STATE.md` before
resuming. The product work in this session is complete and verified. Step 12
deployment is the only known external blocker: it needs the owner's Render
service/account or an existing live URL.

## Completed in this session

- Added romanised Hinglish date, time, attendance, duration, room, and need
  aliases. The deterministic parser now handles examples such as
  `Kal shaam ko seminar hall chahiye, 200 log, 2 ghante` and
  `Budhvaar shaam 6 se 8 baje auditorium chahiye, 80 log`.
- Updated the booking page wording and examples to invite English, Hindi, and
  Hinglish requests.
- Changed natural-language booking from immediate reservation to an editable
  suggestion. The user can change room, day, period, duration, attendance,
  purpose, equipment, and groups that must be free.
- Added an explicit submit endpoint. It validates the edited request again
  against room features/capacity, room closures, classes, mandatory groups,
  existing bookings, and the lunch break, and reserves only after it passes.
- Routed the manual booking form through the same final validation and
  reservation gate.
- Centralized booking permissions across all four demo roles; the requester
  role determines the allowed category, which is recorded with a confirmed
  live booking.
- Updated the README and AI declaration to describe the booking review flow,
  supported languages, and role-specific booking access.
- Added two persistent themes: Midnight Tide uses deep navy with soft teal;
  Porcelain uses warm white with ink and ocean teal. The compact header switch
  is keyboard accessible, and accent foregrounds remain readable in both.
- Added restrained color transitions, clear keyboard focus, and reduced-motion
  support so theme interaction stays calm and usable for official work.
- Added regression coverage for Hinglish parsing, no reservation before
  confirmation, revalidation at submission, lunch spans, and group conflicts.

## Verification

- `.venv\\Scripts\\python.exe -m pytest -q` — **82 passed**.
- `cd frontend; npm run build` — passed (TypeScript and Vite production build).
- Official starter-pack validator, `exports/schedule.json` — **0 hard
  violations**, soft penalty 3, booking score 60.5, 0 priority inversions.
- Official starter-pack validator, `exports/schedule_after.json` — **0 hard
  violations**, soft penalty 3, 13 sessions moved (7 time, 6 room-only).
- `git diff --check` — passed.
- `npm run build` after the theme work — passed (TypeScript and Vite).
- A signed-in browser preview was not completed: the Windows computer-use
  layer could not verify the current browser URL, so no browser actions were
  taken. The selector still needs a visual pass when the app can be opened
  safely in a known local preview.

## Resume here

1. Read `handoff/STATE.md` and inspect `git status`/`git diff`; this session's
   changes are intentionally uncommitted.
2. Continue Step 12 only if the owner supplies Render access/service details or
   a live URL. Do not claim deployment or live-login checks are complete.
3. Keep `validator.py` and all organiser starter-pack files unchanged. Never
   edit schedule exports by hand; regenerate them through the app.
4. Gemini is optional and the current shell does not have `GEMINI_API_KEY`.
   Natural-language deterministic parsing, review, and validation work without
   that key.

## Important existing project facts

- InCIT is a staff-side timetable and venue-management demo for the CIT public
  dataset. Its hard-rule gate and organiser validator remain the authority;
  Gemini only helps parse/phrase drafts.
- Both schedule exports already validate with 0 hard violations. The baseline
  has soft penalty 3; sample disruption moves 13 sessions.
- State is in memory and resets on server restart. Demo accounts are listed in
  `README.md`; they are not real credentials.
- See `handoff/AI_LOG.md` for the longer work history and `handoff/PLAN.md` for
  the original numbered implementation plan.
