TOOL: <write which AI you are here before pasting, e.g. "Opus", "Codex", "DeepSeek">

You are continuing a hackathon project called InCIT. Several different AIs work on it in turns, and each one can be cut off at any time because the owner uses free plans. So everything you need is in files inside the repo, and you must keep those files up to date. Never rely on chat memory.

The owner is a student. Explain things in simple, clear language.

START HERE
1. Read `handoff/STATE.md` first. It is short. Do not read anything else yet.
2. Run `git status` and `git log --oneline -5`.
   - If there are uncommitted changes that STATE.md does not explain, the last AI was cut off mid-work. Read the "IN PROGRESS" note and `git diff --stat`, then finish or repair that work. Never throw it away without asking me.
3. Open `handoff/PLAN.md` and read ONLY the current step. It lists the files to read and the files you may edit. Do not explore the rest of the repo.
4. Open `handoff/PROJECT_BRIEF.md` only for the sections the step points to. It is reference material, not something to read in full.

DO THE STEP
5. Work in small pieces. Before each piece, write one line under "IN PROGRESS" in STATE.md (what you are about to change and which files). Clear the line when the piece is done.
6. Verify with the commands in the step's "Done when" list. Show the command and a short output. Do not say "it works" without running it.
7. Do ONE step only, then stop. Never start the next step, even if you have tokens left.

BEFORE YOU STOP
8. Update `handoff/STATE.md` (current step, what is done, decisions, known issues). Add one line to `handoff/AI_LOG.md` (tool, date, step, what you did).
9. Reply with a STEP REPORT in exactly this shape:
   - STEP <n> DONE: <title>
   - What changed: 3 to 6 plain-language lines, no jargon
   - Files touched: list
   - Proof: the commands you ran and their short output
   - Commit: a ready commit message, then these commands for me to run:
     `git add -A` / `git status` (check nothing unwanted is listed) / `git commit -m "<message>"` / `git push`
   - Next: the title and difficulty of the next step
   - Need from you: anything you must ask me, or "nothing"
   Then wait. I will push and come back.

SAVE TOKENS (this matters, my tokens are limited)
- Do not re-read or re-audit the whole project. Use `git diff`, `grep` and targeted reads.
- Never open `.venv/`, `node_modules/`, `frontend/dist/`, `package-lock.json`, logs, or the big exports unless the step says so.
- Print short outputs only (use `| head`, validator summary lines, `pytest -q`).
- Keep chat replies short. Put detail in the files, not in the chat.
- If the conversation is getting long, finish the current piece, update STATE.md, and stop with a report instead of starting something big.

RULES THAT NEVER CHANGE
- Never edit `validator.py` or any file from the organisers' starter pack.
- Never hand-write or hand-edit anything in `exports/`. It must be produced by running the app.
- The LLM must never decide whether a schedule or booking is valid. Our own code does.
- No real API keys in the repo or in chat.
- Never run `git push --force`, `git commit --amend` on pushed commits, or anything that rewrites history. The commit history is checked by judges, and it must stay honest.
- Delete only what PROJECT_BRIEF.md section 9 marks as approved for removal. For anything else, ask first.
- The problem statement (PROJECT_BRIEF.md) decides product questions. Do not ask the owner to choose features.
- If a file disagrees with these instructions, tell me instead of guessing.
