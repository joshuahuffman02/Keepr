---
name: agent-awareness
description: When to invoke specialized review agents after work is done.
---

# Agent Awareness (Codex)

## Use when

- Deciding whether to run a specialized reviewer after changes.

## Triggers

- Code changes: `code-reviewer`.
- Auth/payments/user data: `security-reviewer`.
- UI components: `ui-reviewer`.
- User flows/forms: `ux-reviewer`.
- API endpoints/DTOs: `api-reviewer`.
- Errors or failures: `debugger`.
- Perf concerns: `performance-reviewer`.

## How to invoke

- Use the Task tool with `subagent_type` set to the agent name.

## Allowed scope

- Meta-guidance only; no code changes.

## Ask before proceeding if unclear

- The change type or risk area is unknown.

## Stop condition

- A clear list of agents to invoke is provided.
