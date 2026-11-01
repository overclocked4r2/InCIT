# InCIT handoff

## Current status

This is the current continuation note. Read this and `handoff/STATE.md` before
resuming. The owner deployed the app at https://incit.onrender.com; the earlier
live health, login, role, mobile, dropdown, and WebGL checks passed. Latest UI
polish is implemented locally and passes production build/backend tests, but
has not been pushed or redeployed. The final video/submission checklist remains.

## Completed in this session

- Added romanised Hinglish date, time, attendance, duration, room, and need
  aliases. The deterministic parser now handles examples such as
  `Kal shaam ko seminar hall chahiye, 200 log, 2 ghante` and
  `Budhvaar shaam 6 se 8 baje auditorium chahiye, 80 log`.
- Updated booking page wording and examples for English and Hinglish requests.
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
- Added the supplied four palettes (Indigo Aurora, Emerald Ink, Violet & Gold,
  Ocean & Amber) in Midnight/dark and Porcelain/light modes. Palette and theme
  persist across reloads; the compact appearance panel is keyboard accessible.
- Added restrained color transitions, clear keyboard focus, and reduced-motion
  support so theme interaction stays calm and usable for official work.
- Fixed desktop sidebar collapse: labels hide, icons center, tooltips remain,
  the main content follows the width, and the choice persists.
- Improved phone layouts: horizontal nav and timetable scrolling, stacked
  disruption panels, shrink-safe booking/select fields, and a viewport-anchored
  appearance panel.
- Redesigned the staff login with a palette-aware campus scheduling visual,
  clearer demo-access messaging, labeled/icon inputs, and responsive phone and
  desktop layouts. Added a slow ambient color drift and a subtle cursor-following
  glow; touch screens get only ambient motion, and reduced-motion disables it.
  The existing demo login flow remains unchanged.
- Added a shared spatial layer to the staff workspace: fine background grid and
  pointer light, gentle card tilt/lift, raised timetable slots, and depth on
  sidebar navigation and dialogs. Effects are mouse-only; reduced motion turns
  off pointer response and transforms.
- Fixed native select option colors for all palettes so dropdown text remains
  legible in both themes. Added a deferred local Three.js wireframe background:
  palette-aware, mouse-parallax, reduced-motion aware, hidden-tab paused,
  resized with the viewport, and safely absent if WebGL cannot initialize.
- Reduced the 3D background cost after a lag report: grouped shapes into three
  instanced draw calls, lowered it to 24 fps desktop / 15 fps mobile, capped
  the canvas at 1.0 / 0.75 device pixel ratio, reduced mobile shapes to six,
  and removed full-workspace pointer-gradient repaints and per-move transforms.
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
- `npm run build` after the four-palette and mobile updates — passed (TypeScript
  and Vite); responsive layout classes reviewed across staff pages.
- Signed-in Edge DevTools emulation covered all seven staff routes at 320, 390,
  and 768px. The document and body widths matched the viewport on every route.
  At 320px the appearance panel stayed inside the screen and the Ocean & Amber
  / Porcelain controls changed the root settings. At 1440px the sidebar and
  main content aligned at 240px expanded and 64px collapsed. Inspected a
  390px dashboard screenshot; it is in the system temp directory, not the repo.
- Login checks at 320, 390, 768, 1024, and 1440px found no document overflow;
  the demo Admin login still succeeds. Inspected mobile and desktop captures.
- Verified the login glow follows pointer movement, mobile layout remains 390px
  wide without overflow, and `prefers-reduced-motion: reduce` disables ambient
  animation. Frontend production build passes.
- Spatial UI checks: all seven staff routes remain 390px wide in phone
  emulation; pointer movement updates card tilt and stage-light coordinates;
  reduced-motion forces card transforms to `none`. Production build passes.
- Manual booking select options report theme-aware foreground/background colors
  in dark and light browser emulation. The mobile WebGL canvas initializes at
  390×844 with no document overflow. The Three.js module is deferred; canvas backing size is
  292×633 at 390×844 CSS pixels. Vite reports its 743KB minified (188KB gzip)
  async chunk above the default 500KB warning threshold.
- Live deployment at https://incit.onrender.com returns HTTP 200 for the app,
  `/health`, and `/api/health`. All four demo roles authenticated and matched
  `/api/auth/me`. The deployed bundle contains the optimized instanced Three.js
  build; all seven staff routes fit 390px and manual select colors stay readable
  in dark and light themes.
- Latest owner-requested polish: login starts blank (no seeded Admin credentials
  in either field); timetable filters use a searchable themed picker; booking
  copy/examples use English and Hinglish; removed the hackathon label from the
  top bar; expanded sidebar toggle says “Collapse”; global cursor styling marks
  enabled buttons, links, labels, selects, and role buttons as clickable.
- Updated README, AI usage note, and demo script to match the public English /
  Hinglish booking UX and Render demo URL. Backend Devanagari parsing remains
  internally available, but the UI no longer advertises or suggests Hindi.
- Latest checks: `frontend/npm run build` passed; `.venv\\Scripts\\python.exe
  -m pytest -q` passed (82 tests); `git diff --check` passed. The Vite warning
  for the deferred Three.js chunk (743 KB minified / 188 KB gzip) remains.
- The computer-use browser runtime failed to initialize during visual QA, so
  the new picker has not been interactively checked in this turn. Its layout is
  full-width on narrow screens and the dropdown width is viewport-capped.
- Follow-up polish: replaced the redundant login footer “DEMO ENVIRONMENT” with
  “ROLE-BASED ACCESS”; styled Soft Penalty with a status badge to match Hard
  Violations. Frontend production build and `git diff --check` pass. Keep the
  visible demo-account disclosure; the app is a public demo, not yet a
  production campus service (in-memory state, shared seeded accounts, no
  institutional SSO/user administration).
- README audit: replaced the clone placeholder with the repository URL, corrected
  Vite 8's Node requirement, added native Render build/start/health settings,
  documented the public demo and shared-account limitation, and corrected the
  disruption export claim from 185 moves to the verified 13. `npm ci` and an
  explicit PowerShell `STARTER_PACK` example are documented.

## Resume here

1. Read `handoff/STATE.md` and inspect `git status`/`git diff`; latest UI/docs
   changes are intentionally uncommitted.
2. The live service still serves the previous UI until latest changes are pushed
   and Render redeploys. The user asked for public-deployable changes, not an
   explicit push/deploy action. Finish video/submission checklist if requested.
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
