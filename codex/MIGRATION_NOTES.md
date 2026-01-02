# Codex Migration Notes

## What was copied
- Copied the original Claude workspace verbatim: `./codex/claude-mirror/.claude/`.
- Original source remains at `./.claude/` and is unchanged.

## What was optimized (and why)
- Created concise, bullet-based Codex versions in:
  - `./codex/agents/`
  - `./codex/skills/`
- Changes made to reduce token usage and increase clarity:
  - Long narratives converted to short bullets.
  - Added explicit **Allowed scope**, **Ask before proceeding if unclear**, and **Stop condition** sections.
  - Removed redundancy while preserving intent and personality.

## When to use which
- Use `./codex/agents/` and `./codex/skills/` for daily Codex work.
- Use `./codex/claude-mirror/.claude/` when you need the original, full-length Claude guidance.
