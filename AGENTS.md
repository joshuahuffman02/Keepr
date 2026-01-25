# AGENTS.md instructions for /Users/josh/Documents/GitHub/Keepr

## Live guidance links

- `docs/repo_summary.md` - stack, entry points, commands, env requirements.
- `docs/exec_plans.md` - execution planning template with verification anchors.
- `docs/architecture.mmd` - high-level system diagram.
- `docs/frontend.mmd` - App Router conventions and tooling expectations.

## Role

- You are Codex, the coding agent; optimize for clear plans, small verified changes, and living docs.

## Workflow (patterns + best practices)

- Step 1: run `./scripts/status.sh` (shell) or `/status` (Codex UI), share the model/profile/config snapshot, then do a structure scan (`ls`, `rg`, tree) and summarize what you see.
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
- Always run `/status` (or `./scripts/status.sh` in shell) at the start; if the command fails, capture the error and still describe the current environment manually.
- At session end provide a concise delta summary that ties changes to verification commands and outstanding questions.

## CLI + IDE tips

- Use `/status` (or `./scripts/status.sh` in shell), `/models`, `/plan`, `/verify` to manage task state; mention which step you are on in your plan or summary.
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

## Codex-only guardrails

- Codex 5.2 is the only agent you should use this month; take extra care to keep it focused on the guardrails below.
- Before making changes, have Codex re-read this `AGENTS.md` and call out any missing guardrails, then append the summary it produces to this file so future runs inherit the same concern.
- Tell Codex to keep every edit “lowest blast radius”—reuse existing patterns, minimize LOC, ban normalization shortcuts or blanket `try/catch`, and let failures bubble instead of silently patching unknown shapes.
- Instruct Codex to explain each failure (“why did this break?” plus “how can we avoid it?”) and then fold those answers into updated instructions/prompts in this repo before completing the ticket.
- Require Codex to audit the repo’s CI/lint/test commands and ensure the following pass without skipping steps: `pnpm lint:web`, `pnpm --dir platform/apps/api test:smoke`, `pnpm --dir platform/apps/web test` (add any extra targeted `pnpm --dir platform/apps/api test -- <path>` if you touch critical services).
- If any workflow fails, force Codex to debug and resolve the root cause before claiming success.
- After a successful run, record the exact prompt/AGENTS snippet you used in this file so teammates can reproduce the optimized Codex-only flow.

## Relevant Codex skills

- `agent-awareness` (`codex/skills/agent-awareness/SKILL.md`): consult this when deciding whether a specialized reviewer (code, security, UI, API, etc.) is warranted once the work is done.
- `nextjs` (`codex/skills/nextjs/SKILL.md`): follow this when touching App Router routes, layouts, or data fetching—server/client boundaries, caching strategy, and route-group conventions are enforced there.
- `nestjs-api` (`codex/skills/nestjs-api/SKILL.md`): use this for any NestJS controller/service/DTO work; keep business logic in services, guard endpoints, validate DTOs, and throw Nest exceptions.
- `prisma-database` (`codex/skills/prisma-database/SKILL.md`): rely on this when writing queries/migrations—select only needed fields, avoid raw SQL, null-check results, paginate large lists, and wrap writes in transactions.
- `ui-development` (`codex/skills/ui-development/SKILL.md`): when editing React/Tailwind components, this skill keeps props typed, tokens consistent, interactions accessible, and responsive states defined.

## Codex guardrails summary (2025-01-16)

- Missing guardrails: no repo-level guidance on where MCP tool configs should live (global vs repo), which Chrome Developer MCP package/version to pin, or how to verify MCP tools are installed correctly.
- Missing guardrails: no guidance on handling network-restricted installs (approved mirrors, offline cache strategy), which affects MCP setup in sandboxed runs.

## Codex guardrails summary (2026-01-25)

- Missing guardrails: no guidance for Supabase MCP auth fallbacks (OAuth vs bearer token), including where Supabase CLI stores tokens (Keychain vs `~/.supabase/access-token`) and how to safely load them.
- Missing guardrails: no explicit instruction on when to restart Codex after MCP config changes to avoid stale server registry.

## Codex failure notes (2026-01-25)

- Failure: Supabase MCP `list_mcp_resources` kept failing with `SUPABASE_ACCESS_TOKEN` missing even after updating config and Keychain.
- Why: Codex MCP server registry appears to cache env/config per session; changes in `~/.codex/config.toml` or launchctl env are not picked up without a full Codex restart.
- Avoidance: When MCP auth or headers are changed, restart Codex before validating. Prefer bearer token in `http_headers` only for temporary debugging, then remove and use env var once the restart is done.

## Codex guardrails summary (2026-01-25, addendum)

- Missing guardrails: no explicit guidance on prioritizing OAuth vs bearer token for MCP auth and how to detect which one is active (`codex mcp list` output semantics).

## Codex guardrails summary (2026-01-25, addendum 2)

- Missing guardrails: no repo-level guidance for when to replace OFFSET pagination with keyset pagination (cursor fields, stability guarantees, and API contracts).
- Missing guardrails: no standard for adding partial indexes in production (naming, WHERE clause conventions, and rollout/rollback notes).
- Missing guardrails: no guidance on when it is safe to run VACUUM (ANALYZE) against production tables (scheduling and impact expectations).

## Codex guardrails summary (2026-01-25, addendum 3)

- Missing guardrails: no standard for documenting and hiding Swagger endpoints that overlap with public API paths (when to hide vs split into new routes).

## Codex guardrails summary (2026-02-02)

- Missing guardrails: no explicit checklist for when to regenerate OpenAPI specs after controller/DTO changes and how to validate SDK types stay in sync.
- Missing guardrails: no guidance on where to document Swagger exclusions so future audits do not re-expose hidden routes.

## Codex prompt snippet (2026-01-25)

```
Do both, and keep the search endpoint hidden.
```

## Codex prompt snippet (2026-02-02)

```
Added the prompt snippet and a new guardrail addendum in AGENTS.md, and documented the Swagger hide decision in docs/repo_summary.md so future audits don’t re‑expose the hidden public campgrounds search endpoint.
```
