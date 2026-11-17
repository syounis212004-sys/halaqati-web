# Skill enforcement (Claude Code hooks)

Real enforcement, not instructions. Wired in `.claude/settings.json`; rules in `rules.json`; code in `enforce.py` (python3 stdlib only, works in Claude Code cloud sessions).

## What is enforced
- **PreToolUse** denies (exit 2) `Edit/Write/MultiEdit/NotebookEdit`, risky `Bash` writes, `git commit/push`, `gh workflow run/release`, and the `mcp__github__actions_run_trigger` of an RC workflow when the acting agent has not invoked the required skills (see `rules.json`: UI → ui-ux-pro-max (+ android-design on Android), logic → test-driven-development, motion code → halaqati-motion-guidance, bug-fix prompts → systematic-debugging, large edits → `.ua` graph consulted, audit prompts → ponytail-audit, large changes → ponytail-review before commit and before stopping, web UI → a Playwright MCP tool used).
- **PostToolUse** records `Skill` invocations (`log/skills.jsonl`) and evidence of `.ua/` reads and Playwright use per actor.
- **Actors**: `(session_id, agent_id | main)`. A sub-agent must invoke the skills itself; it never inherits the main agent's. `SubagentStart` tells it so; `SubagentStop`/`Stop` block unreviewed large changes.
- **Release verification** (`verify_release.py`): pinned zip hash, version consistency (workflow ↔ zip ↔ source), publish-update zip hash/version. The same idea runs in CI as `.github/scripts/release_gate.py` before a release is published.
- Enforcement files are protected: only the **user** can unlock them or waive a rule, by writing `ENFORCE-WAIVE: <skill|config|release|playwright|*> <reason>` in a prompt (hooks read the user's prompt; Claude cannot forge it). Waivers are logged.

## Limits (be honest)
- A log entry proves a skill was **invoked**, not that its guidance was **applied well**. Quality is checked by ponytail-review, CI and humans.
- Bash can be obfuscated; the `git commit/push` gate is the backstop (it checks every changed file against the session's recorded skills).
- Skills used through the user's own `/slash` command are not `Skill` tool calls and are not recorded.
- Hooks do not run in sessions started without this repo's `.claude/settings.json`.
- An internal hook crash is logged and ignored (never bricks a session); an unreadable `rules.json` blocks edits.

Test: `python3 .claude/enforce/test_enforce.py`. Summary of a session: `python3 .claude/enforce/enforce.py report`.
