---
name: accessibility
description: Web accessibility (WCAG 2.1 AA) for forms, interactive UI, and content.
allowed-tools: Read, Write, Edit, Glob, Grep
---

# Accessibility (Codex)

## Use when
- Building forms, interactive components, or reviewing UI for a11y.

## Key rules
- POUR: perceivable, operable, understandable, robust.
- Contrast: 4.5:1 normal text, 3:1 large text and UI.
- Keyboard access: visible focus, logical tab order, escape to close.
- Semantic HTML first; ARIA only when needed.
- Clear labels, errors, and help text for forms.

## Quick checks
- All controls are reachable by keyboard.
- Focus indicators are visible.
- No meaning conveyed by color alone.
- Images have correct alt text.
- Dynamic updates announced (status/alert).

## Allowed scope
- A11y guidance and checklist only unless asked to implement.

## Ask before proceeding if unclear
- Target component/flow or compliance level is not specified.

## Stop condition
- A concise a11y checklist and fixes are provided.
