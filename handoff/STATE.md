# STATE (read this first, update it last)

Keep this file short. Replace old text instead of adding to it.

## Current step
**Step 12** (in progress). Deployment preparation is next when the owner says "continue".

## IN PROGRESS
(nothing. Step 12a is complete. Do not start deployment preparation until the owner says "continue".)

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
- Added Step 6 login and role protections: four seeded demo accounts, central permissions, self-approval prevention, Admin reset, a sign-in page, README credentials, and 43 passing tests.
- Completed Step 7 booking decisions: categories now come only from the requester role, cancelled and alternative decisions always explain themselves, and an approved institute event can relocate (never drop) a class. Added 4 booking-engine tests; 47 tests pass.
- Completed Step 8 manual forms: structured room bookings go through a deterministic gate, named conflicts are blocked, and authorised staff can submit timetable changes for Admin approval. The forms work without an LLM key; 48 tests and the frontend build pass.
- Completed Step 9a LLM draft parsing: an optional Gemini wrapper uses an environment key and strict local schema, with deterministic English/Hinglish parsing and the manual form as the safe fallback. The NL screen also turns too-short messages into plain guidance. All 8 public examples, dataset text, and adversarial prompts are covered; 60 tests pass.
- Completed user-requested UI Step 1: placed the user controls inside the header flex row so they no longer overlap the top-bar event label; frontend build passes.
- Completed user-requested UI Step 2: all signed-in users can chat with friendly greetings and capability answers; Admin and Club representative alone can create final bookings, while other roles receive a normal explanation. All 64 tests and the frontend build pass.
- Completed user-requested UI Step 2b: general chat uses Gemini when available and shows AI mode; key/API failures log their reason and use a role-aware Basic mode fallback. Booking drafts and validity checks remain deterministic; 65 tests and the frontend build pass.
- Completed user-requested UI Step 2c: the backend shell has no Gemini key, so Basic mode is correctly active; it now logs `GEMINI_API_KEY is not configured`, varies fallback replies, and answers mode/help/thanks/frustration questions. All 67 tests and the frontend build pass.
- Completed user-requested chat follow-up step: Basic and AI chat can keep a short-lived booking draft, merge a missing detail such as `2 hours`, and explain deterministic room-capacity alternatives after a rejection. All 69 tests and the frontend build pass.
- Corrected the chat design at the owner's request: removed phrase-by-phrase hardcoded conversation replies. General chat now goes to Gemini, and without a key Basic mode gives one honest limitation message while deterministic booking support remains available. All 69 tests and the frontend build pass.
- Repaired Gemini API integration and booking persistence: the API key travels in a header, model HTTP failures log safe details and retry Flash-Lite, and approved chat bookings reserve their slot and render as timetable booking entries. All 72 tests and the frontend build pass.
- Completed Step 9b faculty assistant and explanations: a strict Gemini change draft goes to the solver, then the deterministic validity gate, and finally the existing Admin approval gate. Class and booking “why” answers are built from reason codes and fall back to those codes when Gemini is unavailable. All 75 tests and the frontend build pass.
- Completed Step 10 role-aware frontend: the four roles see focused navigation and dashboard actions, timetable filters cover room/faculty/group views, Admin controls are not shown to read-only roles, and narrow screens use horizontal navigation plus a scrollable timetable with a fixed period label. Frontend build passes.
- Completed Step 11 documentation: replaced stale benchmark and feature claims with a clean-machine README, current architecture diagram, setup/check commands, demo accounts, validator instructions, and honest limitations. Reconciled `AI_USAGE.md` with the AI log; 75 tests and the frontend build pass.
- Completed owner-approved Step 12a solver repair: the disruption solver locks 176 unaffected sessions, then repairs only the impacted/new sessions. The fresh `schedule_after.json` has 0 hard violations, soft penalty 3, and 13 moves (7 time, 6 room-only); all 77 tests pass.

## Decided by the owner: follow the PS
- The problem statement decides every product question. Do not ask the owner to choose features. If the PS is silent, pick the simplest option that satisfies it and note it under "Decisions made".
- The student portal (attendance, marks, planner, notes, mess, clubs, campus search, student switcher) is NOT in the PS. Its removal is approved. Keep only a read-only timetable by student group.
- The removal list in PROJECT_BRIEF.md section 9 is pre-approved.

## Facts the AI cannot know (ask in ONE short message in Step 0, then record the answers here)
- Path of the starter pack on the owner's machine (STARTER_PACK): `C:\Users\aruna\Desktop\PRGS\CrunchWeek_StarterPack`
- Which AI tools wrote which parts so far (for AI_USAGE.md): Claude built most of the foundation; Opus continued the work through Antigravity; Codex performed Step 0 cleanup.
- Deployed link and host, if any: none yet (deployment is planned for Step 12).

## Baseline numbers (measured when the handoff was written; re-measure and replace after each step that changes them)
- `exports/schedule.json`: regenerated through the app in partial Step 12; hard violations 0, soft penalty 3 (S1=0, S2=0, S3=0, S4=3, S5=0, S6=0), booking score 60.5 (20 approved, 2 alternatives, 3 rejected, 0 priority inversions), exam soft penalty 0.
- `exports/schedule_after.json` (sample disruption): regenerated through the app in Step 12a; hard violations 0, soft penalty 3 (S1=0, S2=0, S3=0, S4=3, S5=0, S6=0), booking score 60.5 (20 approved, 2 alternatives, 3 rejected, 0 priority inversions), exam soft penalty 0, **13 sessions moved** (7 time, 6 room-only).
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
- Step 6 uses short, clearly demo-only credentials in `app/auth.py`; no real account or API secret is stored in the project.
- The owner approved the README demo-credentials section, and Step 6 now explicitly permits that file.
- Step 7 treats role_category_cap as the request category itself, because the problem statement says the role, never request text, determines priority.
- Step 7 distinguishes a class from a booking using the dataset session IDs, not an ID naming convention.
- Step 8 keeps manual booking checks stateless like the existing NL booking checker; it records an audit event but does not silently add an unapproved booking to the published schedule.
- Step 9a uses Gemini only to fill a draft. The app ignores model-supplied priority, validates its JSON locally, and keeps the existing deterministic placement checks as the only validity decision.
- Step 9b freezes other class times while the solver finds a compatible room for the requested class; its result is checked against the live timetable before a pending proposal is recorded.
- Step 10 keeps the API as the authority for permissions; hiding an unsuitable frontend action improves clarity but does not replace backend role checks.
- Step 11 documents the organiser validator through a user-provided `STARTER_PACK` environment variable so no owner-specific path appears in the README.
- Step 12 leaves `schedule_after.json` unchanged rather than hand-editing or exporting an invalid result when the disruption solver returns `unknown`.
- Step 12a: `unknown` meant the old solver had not found even one valid answer before the time limit because it was still searching placements for every existing class alongside soft-score optimisation. The repair locks current assignments that the disruption does not touch, leaving only affected and new sessions to search; an infeasible direct repair still retries without locks.
- The later user-requested UI steps are tracked in `HANDOFF.md`; do not start them until the owner says "continue".

## Known issues / watch out
- The ignored local runtime leftovers (`.freebuff`, caches, logs, database, and build output) are not tracked; `frontend/dist` is regenerated by the required build check.
- The literal Step 1 path grep cannot be empty because `handoff/PLAN.md` and `handoff/PROJECT_BRIEF.md` intentionally contain `C:\Users` examples, and `STATE.md` must retain the owner's exact path.
- Step 12a generated the valid disruption export. Step 12 still needs deployment preparation and a configured host/account; do not hand-edit either export.
