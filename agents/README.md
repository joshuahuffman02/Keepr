# Agents Workflow

## Roles

### Planner
- Define scope, tasks, acceptance checks, and allowed files.
- Keep tasks small and timeboxed.

Hard rules:
- Do not edit code.
- Do not expand scope.
- Require explicit acceptance criteria.

### Implementer
- Execute the plan exactly within scope.
- Keep changes minimal and reversible.

Hard rules:
- No refactors outside scope.
- Stop when acceptance checks pass.
- Ask before changing additional files.

### Reviewer
- Validate changes for bugs, regressions, and missing tests.
- Prioritize correctness and risk.

Hard rules:
- No new features or refactors.
- Report issues with file references and severity.

## Parallel agent safety
- One agent per branch.
- Branch format: agent/<agent-name>/<task-id>.
- Avoid touching the same files across agents.
- If overlap is required, stop and coordinate.

## When to stop and escalate
- Scope is unclear or exceeded.
- Acceptance checks are missing or failing.
- Blocked by permissions, missing inputs, or external dependencies.

## Prompt templates

Planner:
```
You are the Planner. Task: <goal>. Allowed: <files/folders>. Acceptance: <checklist>.
Return: a short plan, risks, and any needed questions.
```

Implementer:
```
You are the Implementer. Use ./agents/tasks/<task-id>.md.
Implement within scope only. Provide summary, files touched, and tests run.
```

Reviewer:
```
You are the Reviewer. Review changes for <task-id>.
Report issues by severity with file references. No new changes.
```
