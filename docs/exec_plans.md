# Execution Planning Template

Use this guide when a request spans hours or touches multiple systems (API, web, shared packages, or Rust services). Capture enough detail so reviewers can understand scope, risks, and how correctness will be proved before editing code or docs.

## Structure
1. **Objective** – One sentence on the outcome (e.g., “Add campaign landing route and hook it up to Prisma-based reservations”).
2. **Background** – Dependencies, related tickets, architecture notes, or previous work.
3. **Scope** – APIs, services, and directories that will be touched; call out what will stay untouched.
4. **Steps** – Ordered checklist (analysis → implementation → tests) with owners if the work will be split.
5. **Risks & Mitigations** – Identify unstable dependencies (Prisma migrations, shared SDK safety, Rust rebuild time) and how you will guard against regression.
6. **Verification** – List exact commands to run before claiming success (e.g., `pnpm --dir platform/apps/api test:smoke`, `pnpm --dir platform/apps/web test`, `pnpm lint:web`, `pnpm --dir platform/apps/web test:e2e`, `pnpm ci:sdk`). Cloud runs should repeat these commands in CI if possible.
7. **Documentation / Follow-up** – Note which docs to update (this folder, service runbooks, alerts) and whether new env vars, migrations, or release notes are required.

## Example
- Objective: “Expose reservation stats via API and show widget on marketing homepage.”
- Background: link to `docs/roadmap-public.md` and note Prisma schema used by `platform/apps/api/prisma/reservations`.
- Scope: update `platform/apps/api/src/reservations`, add new Next.js route under `platform/apps/web/app/reservations`, extend shared type in `platform/packages/shared`.
- Steps:
  1. Draft API contract and Prisma query.
  2. Implement resolver and add tests.
  3. Wire up web route/component and run Vitest/Playwright.
  4. Update docs and changelog.
- Risks: Prisma migration drift → run `pnpm --dir platform/apps/api prisma:migrate dev`.
- Verification: run the lint/test commands above plus `pnpm build` if the change touches shared packages; confirm `pnpm --dir platform/apps/web budgets`.

Keep this template near the top of any large task PR so reviewers immediately understand how the work was validated.

## Plan: AI UI Builder (json-render)
- Objective: Add a json-render powered AI UI builder for analytics dashboards, report composers, and staff workflows in Keepr.
- Background: json-render source at `/Users/josh/Documents/GitHub/github extra stuff/json-render-main`; use published `@json-render/react` renderer with Keepr AI provider endpoints.
- Scope: `platform/apps/api/src/ai`, `platform/apps/web/app/ai`, `platform/apps/web/components/ai`, `platform/apps/web/lib/page-registry.ts`.
- Steps:
  1. Add AI UI builder API endpoint with prompt sanitization, schema validation, and fallback tree.
  2. Add web builder page and component registry for dashboard/report/workflow templates.
  3. Wire page registry entry and run verification commands.
- Risks & Mitigations: prompt injection -> use `PromptSanitizerService`; malformed JSON -> validate + fallback; catalog/registry drift -> document follow-up for shared catalog.
- Verification: `pnpm --dir platform/apps/api test:smoke`, `pnpm lint:web`.
- Documentation / Follow-up: note catalog sharing plan in docs; update repo summary if new commands or structure change.
- Status: Completed; changelog updated and verification run.

## Plan: AI UI Builder Integration (phase 2)
- Objective: Persist generated layouts and connect them to live dashboards, reports, and workflows inside Keepr.
- Background: `/ai/ui-builder` renders json-render layouts today; drafts are stored locally per campground.
- Scope: add layout storage in `platform/apps/api`, wire `platform/apps/web/app/ai/ui-builder`, and integrate apply/publish flows in analytics, reports, and operations views. Keep mobile apps out of scope.
- Steps:
  1. Define `UiLayout` storage (campground scope, builder type, JSON tree, prompt metadata, versioning).
  2. Add CRUD API endpoints for layouts with auth/role checks and validation.
  3. Update the UI builder to save/load from the API when available; keep local drafts as fallback.
  4. Add "Apply layout" controls in dashboards/reports/workflows with a default layout fallback.
  5. Add audit logging + feature flag gates for publish actions and action bindings.
- Risks & Mitigations: schema drift -> share JSON schema in shared package; large trees -> cap size and validate; permissions -> enforce org + role checks.
- Verification: `pnpm --dir platform/apps/api test:smoke`, `pnpm lint:web`, `pnpm --dir platform/apps/web test`, `pnpm build`.
- Documentation / Follow-up: update `docs/architecture.mmd` and `docs/frontend.mmd` with the layout lifecycle; note new feature flag and env vars if added.
- Status: Proposed; awaiting approval.

## Plan: Chat Widget Upgrade (Vercel parity)
- Objective: Bring Keepr's guest, portal, staff, and support chat UX to Vercel Chat SDK quality, with public chats session-only and in-chat ticketing for staff support.
- Background: Reference `docs/chat-widget-upgrade-todo.md` and the Vercel Chat SDK template at `/Users/josh/Documents/GitHub/github extra stuff/ai-chatbot-main`; existing widgets live in `platform/apps/web/components/chat`, `platform/apps/web/components/ai`, and `platform/apps/web/components/support`.
- Scope: `platform/apps/web/components/chat`, `platform/apps/web/components/ai`, `platform/apps/web/components/support`, `platform/apps/web/components/dashboard`, `platform/apps/web/components/portal`, `platform/apps/api/src/chat`, `platform/apps/api/src/ai`, `platform/apps/web/lib`, `docs/chat-widget-upgrade-todo.md`.
- Steps:
  1. Phase 0: unify chat shell + message rendering, align suggested prompts, and baseline tool approval UI for staff.
  2. Phase 1: add AI SDK-compatible streaming adapter (SSE/proxy) and wire `@ai-sdk/react`-style UI patterns.
  3. Phase 1b: add authenticated chat history list + resume; keep public guest chat session-only.
  4. Phase 2: add attachments + artifact sidecar (quotes, availability, reports).
  5. Phase 3: add in-chat ticketing + email fallback for staff-to-Keepr support.
  6. Run verification commands after each batch.
- Risks & Mitigations: streaming adapter complexity -> incremental rollout + feature flags; PII retention -> session-only public chat + retention policy; action safety -> confirmations + audit trail; attachment storage -> choose storage provider with scoped access.
- Verification: `pnpm lint:web`, `pnpm --dir platform/apps/api test:smoke`, `pnpm --dir platform/apps/web test`, `pnpm --dir platform/apps/web test:e2e`, `pnpm build`.
- Documentation / Follow-up: update `docs/frontend.mmd` as shared chat shell conventions emerge; keep `docs/chat-widget-upgrade-todo.md` current as phases ship.
- Status: In progress; Phase 0 complete; Phase 1 streaming + message actions + history panel delivered; Phase 1b conversation list + resume delivered; feedback/regenerate persistence delivered; Phase 2 attachments upload + preview delivered; staff history search/filters + auto-titles delivered; artifact sidecar delivered; feedback/regenerate analytics events delivered; attachment content type typing + support/partner history role filters fixed for web build; Phase 3 support ticket composer with severity, transcript, attachments, and SLA/email fallback delivered; json-render report/graph cards now render in the chat artifact panel.

## Plan: Campground Onboarding Finalization
- Objective: Finalize campground ownership + bookability on launch, align onboarding step payloads, and tighten onboarding invite/AI import safety.
- Background: Onboarding flow spans `platform/apps/web/app/(public)/onboarding` and `platform/apps/api/src/onboarding` with early-access invites and AI import.
- Scope: `platform/apps/api/src/onboarding`, `platform/apps/api/src/onboarding/ai-import`, `platform/apps/web/app/(public)/onboarding`, `platform/CHANGELOG.md`.
- Steps:
  1. Update API to finalize launch and accept flat/nested onboarding payloads; add invite access checks and filename sanitization.
  2. Align web onboarding payloads and back-compat parsing.
  3. Update changelog and run verification commands.
- Risks & Mitigations: missing owner user -> fallback to invite email lookup; payload drift -> back-compat parsing on web + nested support in API; auth edge cases -> allow platform staff to bypass.
- Verification: `pnpm --dir platform/apps/api test:smoke`, `pnpm lint:web`.
- Documentation / Follow-up: capture any onboarding UX gaps found during regression QA.
- Status: Completed; verification run.

## Plan: Onboarding Reservation Import Hardening
- Objective: Ensure onboarding reservation import enforces token scope/expiry, uses active sites only, respects conflict checks, and honors system pricing.
- Background: Onboarding reservation import endpoints are used by `platform/apps/web/app/(public)/onboarding` with early-access tokens.
- Scope: `platform/apps/api/src/data-import`, `platform/apps/web/app/(public)/onboarding`, `platform/CHANGELOG.md`.
- Steps:
  1. Enforce onboarding token expiry/scope and tighten import execution rules (conflicts, system pricing, guest dedupe).
  2. Align onboarding reservation import API base handling in web client.
  3. Run verification commands and update changelog.
- Risks & Mitigations: system pricing gaps -> fall back to CSV unless explicitly toggled; inactive sites in imports -> filter and reject at execution; token expiry edge cases -> validate invite/session expirations.
- Verification: `pnpm --dir platform/apps/api test:smoke`, `pnpm lint:web`.
- Documentation / Follow-up: confirm whether an explicit conflict override should be supported in UI/API.
- Status: Completed; verification run.

## Plan: Onboarding Import Checklist + Coverage
- Objective: Guide onboarding users to export the right forms from their prior system, track missing fields, and allow a warning override.
- Background: AI import flow already classifies uploads but lacks system-specific guidance and completeness tracking.
- Scope: `platform/apps/api/src/onboarding/ai-import`, `platform/apps/web/app/(public)/onboarding/[token]/steps/DataImport.tsx`, `platform/apps/web/app/(public)/onboarding/[token]/components/ai-import`, `platform/CHANGELOG.md`.
- Steps:
  1. Add import requirements + coverage endpoint for system-specific forms and missing fields.
  2. Update onboarding AI import UI with checklist, missing info panel, and override flow.
  3. Persist system selection + override state on continue and highlight next exports to grab.
  4. Add data_import draft-save endpoint and show import metadata on Review/Launch.
  5. Sync draft coverage into wizard state and feed import status into go-live warnings.
  6. Run verification commands and update changelog.
- Risks & Mitigations: missing columns in PDFs/images -> rely on AI extraction before coverage; system export naming drift -> keep forms descriptive and allow "Other" option; missing required data -> explicit warning + checkbox override.
- Verification: `pnpm --dir platform/apps/api test:smoke`, `pnpm lint:web`.
- Documentation / Follow-up: persisted system selection + override acceptance in the `data_import` payload; added draft-save endpoint + Review/Launch import metadata panel; synced draft changes to wizard state + go-live warnings.
- Status: Completed; verification run; follow-up applied for data_import persistence + next-exports prompt + draft-save/review panel + go-live warning sync.

## Recent living-doc updates
- **2026-01-12**: `docs/repo_summary.md` now highlights `docs/architecture.mmd`, `docs/frontend.mmd`, and this `docs/exec_plans.md` file as the go-to living references for architecture, UX, and cross-system execution plans; refresh all three whenever a major entry point, environment, or verification command changes.
- **2026-01-18**: Added `scripts/status.sh` as the local `/status` helper for Codex environment snapshots; updated repo summary to document the helper command.
