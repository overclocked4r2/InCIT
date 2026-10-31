# AI usage

## Product AI or model APIs

The product currently calls no LLM, generative-AI model, or AI API. Its English/Hinglish booking parser is deterministic code.

## AI tools used to build InCIT

- Claude: built most of the project foundation.
- Opus, through Antigravity: continued development before the handoff process.
- Codex: removed the out-of-scope student portal and unused database layer in Step 0, then created the project declaration files in Step 1.

Prompts and handoff instructions are kept in `handoff/`.

## Safety boundary

An LLM must never decide whether a timetable, booking, or edit is valid. It must not decide who may approve a request or the request's priority class. Those decisions must come from InCIT's deterministic code and the dataset rules.
