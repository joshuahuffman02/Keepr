# AGENTS.md (Codex Constitution)

## Source of truth
- Claude originals: ./.claude (read-only)
- Codex mirror of Claude: ./codex/claude-mirror/.claude (read-only)
- Codex-optimized agents/skills: ./codex/agents/ and ./codex/skills/

## Core rules
- Prefer small, focused tasks; if a task is larger, propose a breakdown but proceed when the goal is clear.
- Avoid refactors unrelated to the request; touch adjacent files only when needed to fix the issue.
- Stop when acceptance checks pass or the task is complete.
- Ask before proceeding only when the goal is unclear (max 3 questions).

## Default workflow
- Plan briefly when helpful, then implement and self-review.

## Multi-agent rules
- If multiple agents are active, prefer separate branches to avoid conflicts.
- Coordinate if scope overlaps or conflicts arise.

## Stop conditions
- Acceptance checklist passes, or task is blocked, or scope is exceeded.
- No extra improvements beyond acceptance.

## Output format
- Short bullets: what changed, files touched, tests run (or "not run").
- Keep responses concise and operational.

## Run/test/lint discovery
- Autodetect from package.json, README, and scripts/.
- If still unclear, ask up to 3 questions then wait.
