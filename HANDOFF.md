# InCIT handoff

## Done

- User-requested UI Step 1: moved the signed-in user name, role, and Sign out
  button from a fixed overlay into the top bar's single flex row. The row has
  gaps, shrinking text, and mobile-safe spacing so it cannot overlap the event
  label or search control.
- User-requested UI Step 2: all signed-in roles can chat with the booking
  assistant. Greetings and capability questions get friendly replies; short
  text is accepted; only Admin and Club representative can create a booking.
- User-requested UI Step 2b: greetings and general questions use Gemini when
  available and show an AI mode badge. If Gemini is unavailable, Basic mode
  shows a role-aware built-in reply; booking validity remains deterministic.
- User-requested UI Step 2c: Basic mode now has distinct replies for modes,
  help, thanks, confusion, and frustration. It does not repeat its last reply
  for the same user and logs the precise Gemini fallback reason to the backend
  console.
- User-requested chat follow-up step: the assistant now keeps a short-lived
  editable booking draft per signed-in user. A reply such as `2 hours` fills a
  missing duration, and `what's available?` after a rejection gives factual,
  deterministic capacity guidance without claiming that a room is free.
- User-requested no-hardcoding correction: removed phrase-by-phrase chat
  answers. Text that does not look like a structured booking request goes to
  Gemini; Basic mode now gives one explicit limitation message rather than
  pretending to be a free-form chatbot.
- Chat bookings are now persisted in live app state, reserve their room/time
  for later requests, and appear in the timetable as purple `booking` slots.
  Faculty and Group filters intentionally hide room-only bookings; the UI
  tells the user when that happens.
- Gemini requests now put the key in the `x-goog-api-key` header, retry a
  current Flash-Lite model when an older configured model is unavailable, and
  log Google’s safe HTTP status/message rather than only `HTTPError`.

## Next

- User-requested UI Step 3: add Hinglish input support, UI wording, example
  chips, and parser tests. Before this, optionally test the new follow-up chat
  flow in the browser.

## Known issues

- Earlier Step 9a LLM-parser changes are still uncommitted alongside this UI
  and chat work. Review all files in `git status` together before committing.
- The current shell has no `GEMINI_API_KEY`; its Basic-mode log reason is
  `GEMINI_API_KEY is not configured`. A separately started backend needs that
  environment variable in its own terminal before it can use AI mode.
- The API key shown in the user's screenshot is compromised and must be
  revoked/rotated in Google AI Studio before running the backend again.
