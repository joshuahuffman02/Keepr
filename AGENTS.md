# AGENTS.md instructions for /Users/josh/Documents/GitHub/Keepr

## Role
- You are Codex, the coding agent; optimize for clear plans, small verified changes, and living docs.

## Workflow (patterns + best practices)
- Step 1: run `/status`, share the model/profile/config snapshot, then do a structure scan (`ls`, `rg`, tree) and summarize what you see.
- Step 2: produce a short repo summary and a checklist plan (files, risks, verification commands) before editing; update the plan when you complete a step.
- Step 3: implement in small batches, and after each batch run the relevant build/test/lint commands before moving on.
- Step 4: document the change (CHANGELOG entry or docs note explaining what/why and any follow-ups).
- Step 5: finish with a delta summary, listing touched files and verification commands.

## Prompting patterns
- Anchor answers to the exact files/dirs you will edit so reviewers know scope.
- Attach relevant snippets, context, or stack traces that explain the issue you are solving.
- Include exact verification commands you plan to run, and call out tradeoffs (performance, DX, security) if the change isn’t obvious.
- When tradeoffs arise, describe alternatives and why you chose one.

## Configuring Codex for our environment
- Preferred model profiles: “fast” for exploration, “deep” for refactors or orchestration.
- Sandbox: `workspace-write`; approval policy: `on-request`; network: restricted; mention these when relevant.
- Support Linux/macOS/Windows; avoid OS-specific assumptions and note caveats when impossible.
- Always run `/status` at the start; if the command fails, capture the error and still describe the current environment manually.
- At session end provide a concise delta summary that ties changes to verification commands and outstanding questions.

## CLI + IDE tips
- Use `/status`, `/models`, `/plan`, `/verify` to manage task state; mention which step you are on in your plan or summary.
- Keep diffs small and self-contained; if a task is large, split it into batches with intermediate verification.
- Push long-running builds/tests into cloud/container runs and describe how to rerun them locally if needed.

## Advanced workflows (headless SDK)
- Emit structured JSON (plan, results, diffs) alongside Markdown for automation-friendly listeners when the workflow is complex.
- Prefer containerized runs (`pnpm --dir ...`, Docker, or scripts/) for builds/tests that touch multiple packages; reference the script you used.
- When delegating to cloud agents, state what was executed there and what remains for the local environment.

## Progressive discovery
- Maintain these living docs and keep them in sync: `docs/repo_summary.md`, `docs/exec_plans.md`, `docs/architecture.mmd`, `docs/frontend.mmd`.
- Link them early in this file so future sessions load the freshest guidance first; update them whenever structure/commands change.

## Commands reference
- Dev: `pnpm dev` (runs API + web simultaneously via `concurrently`).
- Build: `pnpm build` (shared SDK, Prisma generate, NestJS, Next.js).
- Test: `pnpm --dir platform/apps/api test` (Jest) and `pnpm --dir platform/apps/web test` (Vitest when relevant).
- Lint: `pnpm lint:web` (Next.js ESLint plus `scripts/check-no-any-no-assert.js`).
- Format: `pnpm format` (runs `pnpm lint:fix` to sync eslint fixes and no-any checks).
- E2E: `pnpm --dir platform/apps/web test:e2e` (Playwright).
