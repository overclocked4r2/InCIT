# AI usage

## Product AI or model APIs

If `GEMINI_API_KEY` is configured, InCIT can use the Gemini API to turn an
English or Hinglish request into an editable booking draft, turn a faculty
request into an editable timetable-change draft, and phrase explanations from
facts already produced by code. The prompts are in `prompts/`; the small API
wrapper and strict output schemas are in `app/llm.py`. With no key or an API
failure, the deterministic parser and manual forms remain available, and
explanations show their code-derived reason codes directly.

## AI tools used to build InCIT

- Claude: built most of the project foundation.
- Opus, through Antigravity: continued development before the handoff process.
- Codex: removed the out-of-scope student portal and unused database layer in Step 0, then created the project declaration files in Step 1.

Prompts are kept in `prompts/`; handoff instructions are kept in `handoff/`.

## Safety boundary

An LLM must never decide whether a timetable, booking, or edit is valid. It must not decide who may approve a request or the request's priority class. Those decisions must come from InCIT's deterministic code and the dataset rules.

The LLM output is validated against a strict local schema, then the existing
deterministic room and timetable checks decide whether a booking can proceed.
