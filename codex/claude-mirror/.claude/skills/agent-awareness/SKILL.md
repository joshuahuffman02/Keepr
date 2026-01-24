---
name: agent-awareness
description: Guidelines for when to automatically invoke specialized review agents. Use this knowledge to proactively delegate review tasks after completing work.
---

# Agent Invocation Guidelines

## Available Agents

This project has specialized review agents in `.claude/agents/`. Use the Task tool to invoke them.

## When to Invoke Agents

### After Writing/Modifying Code

**Invoke: `code-reviewer`**

- After creating new components or features
- After fixing bugs
- After refactoring
- Before committing significant changes

### After Working on Security-Sensitive Code

**Invoke: `security-reviewer`**

- After modifying authentication/authorization
- After adding API endpoints
- After handling user input
- After payment-related changes
- After changes to data access patterns

### After Creating/Modifying UI Components

**Invoke: `ui-reviewer`**

- After creating new React components
- After styling changes
- After layout modifications
- When adding new pages

### After Building User-Facing Features

**Invoke: `ux-reviewer`**

- After implementing new user flows
- After adding forms
- After modifying navigation
- When adding interactive features

### After API Changes

**Invoke: `api-reviewer`**

- After creating new endpoints
- After modifying DTOs
- After changes to services
- After NestJS module changes

### When Encountering Errors

**Invoke: `debugger`**

- Build failures
- Runtime errors
- Test failures
- Unexpected behavior

### For Performance Concerns

**Invoke: `performance-reviewer`**

- Before deploying major features
- When pages feel slow
- After adding database queries
- When bundle size increases

## How to Invoke

Use the Task tool with `subagent_type` matching the agent name:

```
Task tool:
- subagent_type: "code-reviewer"
- prompt: "Review the changes I just made to [files]"
```

## Proactive Behavior

**DO proactively invoke agents when:**

1. You've completed a significant piece of work
2. The work touches areas the agent specializes in
3. The user would benefit from a second opinion

**DON'T invoke agents when:**

1. Making trivial changes (typos, comments)
2. The user explicitly says not to review
3. Just reading/exploring code without changes

## Example Triggers

| User Request                  | After Completion, Invoke         |
| ----------------------------- | -------------------------------- |
| "Add a new settings page"     | ui-reviewer, ux-reviewer         |
| "Fix the login bug"           | code-reviewer, security-reviewer |
| "Create API for reservations" | api-reviewer, security-reviewer  |
| "Why is this page slow?"      | performance-reviewer             |
| "Build failed, help"          | debugger                         |
