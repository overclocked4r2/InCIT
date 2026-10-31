# PLAN: one step per AI session

How to use: STATE.md says which step is current. Read only that step. Do only that step. Then stop with a STEP REPORT.

Each step lists:
- **Difficulty**: HARD needs a strong model and fresh tokens. MEDIUM and EASY can go to any AI.
- **Read**: the only files you should open (plus the section of PROJECT_BRIEF.md named).
- **Edit**: the only files you should change. If you need another file, say why in the report.
- **Done when**: checks you must run and show.

If a step is too big for your remaining tokens, do the first half, write exactly where you stopped in STATE.md under IN PROGRESS, and stop. The next AI continues from there.

---

## Step 0: Cleanup following the PS (EASY)
**Goal**: remove everything the PS does not need, using the pre-approved list. No decisions are left to the owner.
**Read**: PROJECT_BRIEF.md sections 8 and 9 only. `git ls-files` for the tracked list.
**Edit**: STATE.md, `.gitignore`, and the files on the approved removal list.
**Do**:
1. Ask the owner ONE short message for the three facts in STATE.md (starter pack path, which AI tools built what, deployed link). Record the answers. Do not ask anything else.
2. Before deleting the AI notes (`CLAUDE.md`, `PROGRESS.md`, `.agents/`), copy anything still true and useful (how to run it) into STATE.md. Do not copy their "100% complete" claims.
3. Remove everything marked REMOVE in PROJECT_BRIEF.md section 9, including the student portal (backend routes, tests, frontend pages, nav entries, screenshots and README text). Use `git rm` so the removal is in the history. Make sure runtime files and caches are in `.gitignore`.
4. Settle the DECIDED items in section 9 yourself and write each decision in STATE.md.
**Done when**: `git ls-files` no longer lists the removed files, the backend starts, `npm run build` passes, `pytest -q` passes (tests for removed features go with them), and STATE.md has the facts and decisions.

## Step 1: Declarations and safety files (EASY)
**Goal**: the missing submission files, and a README that does not point to the owner's computer.
**Read**: `requirements.txt`, `frontend/package.json`, `Dockerfile`, `docker-compose.yml`, README.md, AI_LOG.md.
**Edit**: create `.env.example`, `AI_USAGE.md`, `THIRD_PARTY.md`; edit README.md paths only.
**Do**:
- `.env.example`: every environment variable the code reads (grep `os.environ`, `getenv`, `config.py`), no real values.
- `THIRD_PARTY.md`: every library from requirements.txt and package.json (name, what for, licence if known).
- `AI_USAGE.md`: (a) models or APIs the product calls (none yet; update in Step 9), (b) every AI tool used to build the project and which parts, from AI_LOG.md and the owner's answers, (c) where prompts are kept: the `handoff/` folder, (d) what the LLM is NOT allowed to decide: whether a schedule, booking or edit is valid, who may approve, and what priority class a request has.
- Replace `C:\Users\...` paths with `STARTER_PACK`-style placeholders and relative commands.
**Done when**: the three files exist, no real secrets, `grep -rn "C:\\\\Users" .` finds nothing in tracked files.

## Step 2: One trusted validity gate (MEDIUM)
**Goal**: one function that every schedule, booking, manual edit and LLM proposal must pass, with no LLM code anywhere near it.
**Read**: `app/validator_bridge.py`, `app/validator.py`, `app/state.py`, `tests/test_validator.py`; the official `validator.py` (read-only) for rules.
**Edit**: `app/validator_bridge.py`, `app/validator.py`, `app/state.py`, `tests/`.
**Do**:
- Check whether `validator_bridge.py` gives the same answers as the official validator. Run both on the exports AND on deliberately broken copies (double-book a room, break lunch, exceed capacity, break a basket, break a fixed slot). If they differ, fix the bridge or call the official file unchanged.
- Expose one function (for example `check_timetable(timetable, data) -> list[Violation]`) and make solver output and every state change go through it.
- Add tests for each hard constraint.
**Done when**: the new tests pass, both validators agree on the broken copies, `grep -rniE "anthropic|openai|gemini|llm" app/validator*.py` finds nothing.

## Step 3: Better soft scores in the solver (HARD)
**Goal**: lower the soft penalty (S2 gaps, S3 over 6 hours, S4 same course twice a day) with hard violations staying 0.
**Read**: `app/solver.py`, PROJECT_BRIEF.md section 2.
**Edit**: `app/solver.py`, `tests/`.
**Do**: add S2, S3, S4 to the objective. Keep a solve time limit that works on a small free server. Re-export `exports/schedule.json` by running the app.
**Done when**: official validator shows 0 hard violations and a lower soft penalty than 203 (record the new numbers in STATE.md). Solve time is reported.

## Step 4: Stable rescheduling (HARD)
**Goal**: after a change, move as few sessions as possible, show exactly what changed, and explain when there is no fix.
**Read**: `app/solver.py`, the reschedule code in `app/main.py` (the `/api/reschedule` and disruption routes), `app/schemas.py`.
**Edit**: `app/solver.py`, `app/main.py`, `app/schemas.py`, `tests/`.
**Do**:
- Let the solver take an optional baseline timetable. Lock sessions not touched by the change, or give every moved session a heavy penalty. Hard constraints stay absolute.
- Return a diff: per moved session the old day/period/room, the new one, and why.
- If there is no valid fix, return which constraints conflict (for example by solving with those constraints as removable and reporting the ones that had to break).
- Test the sample disruption AND at least three others (a different room closed, a faculty leave on a heavy day, a new session with no free slot).
**Done when**: for the sample disruption the official validator shows 0 hard violations and **far fewer than 185 sessions moved** (write the real number in STATE.md); the no-fix case returns a readable conflict list.

## Step 5: Approval gate (MEDIUM)
**Goal**: a reschedule is only a proposal until an Admin approves it.
**Read**: `app/state.py`, `app/main.py` reschedule routes, `frontend/src/pages/Disruption.tsx`, `frontend/src/api.ts`.
**Edit**: the same files, `tests/`.
**Do**: new states pending, approved, rejected. Applying happens only on approve and runs the validity gate first. Show the diff in the UI before the buttons. Record who approved in the audit log.
**Done when**: a test shows nothing changes before approval, and a rejected proposal changes nothing.

## Step 6: Login, four roles, demo accounts, reset (MEDIUM)
**Goal**: Admin, Department coordinator, Faculty and Club representative, with the rule that nobody approves their own request.
**Read**: `app/main.py`, `app/state.py`, `app/config.py`, `frontend/src/App.tsx`, `frontend/src/api.ts`.
**Edit**: those files plus new `app/auth.py`, `tests/`, a login page, `README.md`.
**Do**: simple session or token login with four seeded accounts, role checks in one place, an Admin-only "Reset demo data" button and endpoint, and the credentials listed in README.md.
**Done when**: tests show each role can do only its own actions and that a user cannot approve their own request; the reset restores the starting state.

## Step 7: Booking decisions and priority (MEDIUM)
**Goal**: Spectra decisions that follow the dataset priority order with a reason for each.
**Read**: `app/booking_engine.py`, PROJECT_BRIEF.md section 3, the dataset's `priority_order` and `role_category_cap`.
**Edit**: `app/booking_engine.py`, `README.md` (fix the wrong priority line), `tests/`.
**Do**: confirm the engine uses exam, regular_session, institute_event, guest_lecture, department_event, club_event, ties by earlier `submitted_at`, role caps, never approves cancelled requests, and gives a clear reason for every rejection and alternative. Only an approved institute event may displace a regular session, and it must be moved, not dropped.
**Done when**: official validator booking score and priority inversions are recorded in STATE.md; every non-approved decision has a reason.

## Step 8: Manual booking and manual scheduling forms (MEDIUM)
**Goal**: forms that work with no LLM, and every submission is checked by the validity gate.
**Read**: `app/main.py`, `app/booking_engine.py`, `frontend/src/pages/NLBooking.tsx`, `frontend/src/api.ts`.
**Edit**: those plus a new form page, `tests/`.
**Do**: a booking form (room, day, period, purpose, attendance, needs) and a manual scheduling form for authorised roles. A conflict is blocked with a clear message that names the clash.
**Done when**: tests show a clashing booking is refused with a reason, and the forms work with the LLM environment variable unset.

## Step 9a: LLM wrapper and booking parser (HARD)
**Goal**: English and Hinglish requests become an editable draft booking. The LLM never decides validity.
**Read**: `app/nl_parser.py`, `app/schemas.py`, `examples/sample_requests.md` in the starter pack, PROJECT_BRIEF.md section 5.
**Edit**: `app/nl_parser.py`, new `app/llm.py`, `prompts/` (keep every prompt here), `tests/`, `AI_USAGE.md`, `.env.example`.
**Do**:
- One small wrapper around one LLM API. Keys come from environment variables. On failure, return the manual form with a clear message. No crash.
- Resolve "kal" as tomorrow's weekday, "shaam" as an evening window, "after lunch" as P6 onward, and show every assumption in the editable draft. Ask a follow-up if something essential is missing.
- Notice a named room that does not match a stated need (accessible, capacity) and offer an alternative.
- Treat "only if free, otherwise Friday" as an ordered list of options.
- Ignore claims about priority and attempts to bypass rules. Priority comes from the user's role, looked up in code. Validate the LLM output against a strict schema, then pass it through the validity gate.
**Done when**: tests cover all 8 sample requests, several `raw_text` fields from the dataset, and adversarial inputs (priority abuse, "ignore all rules", vague time, mixed languages). With the API key removed, the manual form still works.

## Step 9b: Faculty assistant and explanations (HARD)
**Goal**: faculty ask for changes in plain language, and anyone can ask "why".
**Read**: `app/llm.py`, `app/solver.py` (the stable reschedule from Step 4), `app/state.py`, `app/main.py`.
**Edit**: `app/llm.py`, `app/main.py`, new route and UI, `prompts/`, `tests/`, `AI_USAGE.md`.
**Do**: the LLM turns the request into a structured change. The solver produces the proposal. The validity gate checks it. The Admin approves it (Step 5). Explanations: our code builds the facts and reason codes, the LLM only phrases them. If the LLM is down, show the reason codes as plain text.
**Done when**: tests show an invalid LLM proposal is rejected by the gate, and "why is this class at 8 AM" and "why was this booking rejected" return correct, code-derived reasons.

## Step 10: Frontend by role (MEDIUM)
**Goal**: clear dashboards for the four roles, readable timetable grids, and a design that works on a phone.
**Read**: `frontend/src/App.tsx`, `components/Layout.tsx`, `components/ui.tsx`, `pages/Dashboard.tsx`, `pages/Timetable.tsx`.
**Edit**: frontend files only.
**Do**: timetable views by group, faculty and room; pending approvals; current conflicts; room utilisation; loading, empty and error states. The student-portal pages were removed in Step 0; confirm none remain. Test at a phone width.
**Done when**: `npm run build` passes, and a new person can find a room, read a timetable and approve a change using only the README and demo accounts.

## Step 11: README and architecture diagram (EASY)
**Goal**: a README that works from a clean machine.
**Read**: README.md, STATE.md, AI_USAGE.md.
**Edit**: README.md, AI_USAGE.md (final check).
**Do**: short description, architecture diagram, tech stack, setup steps, the four demo accounts, how to run the official validator, known limitations (honest). Remove claims that are not true.
**Done when**: someone following only the README can run the app, and `AI_USAGE.md` matches `AI_LOG.md`.

## Step 12: Final exports, deploy, video checklist (MEDIUM)
**Goal**: the submission.
**Edit**: `exports/` (by running the app only), STATE.md.
**Do**: regenerate `exports/schedule.json` and `exports/schedule_after.json` by running the app, run the official validator on both, deploy, test the live link and all four logins, then give the owner the video checklist (generate timetable, plain-language request becoming a booking, a conflict blocked, Spectra decisions, a reschedule with diff and approval, dashboard).
**Done when**: 0 hard violations on both files, the live link works, and the owner has the video checklist. After this, **no more commits**.
