# AGENTS.md (Codex Constitution)

## Source of truth
- Claude originals: ./.claude (read-only)
- Codex mirror of Claude: ./codex/claude-mirror/.claude (read-only)
- Codex-optimized agents/skills: ./codex/agents/ and ./codex/skills/

## Core rules
- Prefer larger, end-to-end tasks when the goal is clear; propose a breakdown when helpful but proceed.
- Avoid confirmation checkpoints for routine changes; treat the request as authorization to complete the work.
- Avoid refactors unrelated to the request; touch adjacent files only when needed to fix the issue.
- Use judgment on when to stop; continue if there are clear, aligned improvements that advance the request.
- Ask questions only when genuinely blocked or ambiguity would cause rework; otherwise proceed.

## Default workflow
- Plan only when it materially reduces risk; otherwise implement and self-review.

## Multi-agent rules
- If multiple agents are active, prefer separate branches to avoid conflicts.
- Coordinate if scope overlaps or conflicts arise.

## Stop conditions
- Task is complete or blocked.

## Output format
- Short bullets: what changed, files touched, tests run (or "not run").
- Keep responses concise and operational.

## Run/test/lint discovery
- Autodetect from package.json, README, and scripts/.
- If still unclear, make a reasonable choice and note any testing gaps.
