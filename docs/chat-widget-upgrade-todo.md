# Keepr Chat Widget Upgrade - Comprehensive To-Do

Goal: Bring Keepr's guest, portal, staff, and support chat experiences up to the quality bar of the Vercel Chat SDK while keeping Keepr-specific booking and operations workflows first-class.

## Requirements (Confirmed)
- All surfaces should reach parity: public booking widget, guest portal, staff dashboard, staff-to-Keepr support.
- Aim for the "best" experience, not just parity.
- Public guest chat is session-only (no persistence).
- Support escalation should include in-chat ticketing with direct email fallback.

## Recommended Approach (Best)
- Adopt the Vercel Chat SDK UI/UX patterns and message schema (message parts, tool approvals, data stream events).
- Keep the NestJS chat and AI services as the source of truth for permissions and tool execution.
- Add an AI SDK-compatible streaming adapter (SSE or proxy) so `@ai-sdk/react`-style UI patterns can be used in Keepr.
- Unify guest/staff/support into a shared chat shell with per-surface capability toggles.

## Immediate Next Steps (Priority)
- [x] Fix chat scroll containment for long responses (wheel/touch stays inside chat panel).
- [x] Add long-response UX rules (collapse/expand and max-height cards).
- [x] Add readable KPI summaries to reduce wall-of-text responses.
- [x] Surface structured KPI snapshot cards (json-render callout) in the chat timeline.
- [x] Auto-open artifact panel when a new json-render report arrives (staff only).
- [x] Re-verify scroll containment for long AI responses on trackpad + touch and harden nested scroll handling if page scroll bleed persists.

## Audience-Specific To-Do

### 1) Public Booking (Guest, session-only)
- [x] Unify widget with new chat shell (brandable, quick actions, modern styling).
- [x] Ensure no chat history persistence and no PII retention.
- [x] Add booking-focused suggested prompts (dates, party size, RV length, amenities).
- [x] Add "action cards" for recommendations (site cards, availability, quotes).
- [x] Add "handoff to booking form" with prefilled params.
- [x] Add clear privacy and consent copy at first open.

### 2) Guest Portal (Authenticated)
- [x] Enable persisted chat history (guest-only scope).
- [x] Add "resume chat" with conversation list in portal.
- [x] Allow attachments (images or PDFs for receipts, gate codes, etc).
- [ ] Add guest-specific tools: balance check, reservation changes, policy lookup.
- [x] Add guest-specific tools: balance check, reservation changes, policy lookup.
- [x] Add post-stay follow-ups and review prompts.

### 3) Staff Dashboard (Operations)
- [x] Unify widget with staff shell (tool approvals, action drafts).
- [x] Add persistent staff history (campground-scoped).
- [x] Add search and filters for staff history.
- [x] Auto-title conversations for the history list.
- [x] Add staff quick actions: arrivals, departures, occupancy, maintenance.
- [x] Add tool execution UI (confirmations, forms, selections).
- [x] Add json-render-powered inline report/graph cards in staff chat (source: `/Users/josh/Documents/GitHub/github extra stuff/json-render-main`).
- [x] Add json-render payloads to occupancy and revenue tool results for inline charts/tables.
- [x] Add structured results for tools (availability, balances, tasks).
- [x] Add audit trail for actions executed by AI.

### 4) Staff -> Keepr Support (Owner Contact)
- [x] Add "Contact Keepr" mode inside the staff chat.
- [x] Add in-chat ticketing flow with severity and evidence links.
- [x] Attach transcripts and optional files to tickets.
- [x] Provide direct email fallback + expected response times.

## Feature Parity Checklist (Vercel Chat SDK)
- [x] Streaming responses with incremental rendering.
- [x] Message actions: copy, edit, regenerate, feedback.
- [x] Suggested prompts and contextual quick actions.
- [x] Attachments: upload, preview, and inline rendering.
- [x] Tool call UI: approve/deny, show input/output.
- [x] Artifact panel or sidecar (quotes, documents, dashboards).
- [x] Chat history sidebar for authenticated chats (per-conversation history view).
- [x] Optional visibility/share controls (staff-only, internal).
- [x] Polished UI: animations, skeletons, responsive layout, scroll control.

## Workstreams (Implementation To-Do)

### UX/UI
- [x] Define shared chat shell layout and variants (guest, portal, staff, support).
- [x] Create message rendering rules for text, tool calls, attachments, and cards.
- [x] Establish tone and microcopy for guest vs staff vs support modes.
- [x] Add mobile and kiosk-specific UI rules.
- [x] Define long-response layout rules (collapsible blocks, max height).
- [x] Add scroll hinting for long content blocks.
- [x] Add compact KPI snapshot layout (arrivals + occupancy trend) for staff reports.
- [x] Add keyboard and touch-friendly scroll affordances for long message blocks (e.g., scroll-to-top/down hints).

### Web (Next.js)
- [x] Build shared chat components under `platform/apps/web/components/chat`.
- [x] Replace `AiChatWidget`, `SupportChatWidget`, and dashboard/portal wrappers with shared shell.
- [x] Add history sidebar for authenticated surfaces.
- [x] Add message actions (copy, edit, regenerate, feedback).
- [x] Add prompt suggestions that are contextual to page and user role.
- [x] Add attachment picker and preview panel.
- [x] Add staff history search + filters and auto-titles.
- [x] Add artifact sidecar panel.
- [x] Wire json-render into the chat artifact panel for staff graphs/reports.
- [x] Add jump-to-latest control and autoscroll guard for long chat responses.
- [x] Render markdown (links, lists, code blocks) inside chat messages.
- [x] Support GFM tables + code block copy in chat messages.
- [x] Add staff-only internal notes toggle + styling.
- [x] Ensure chat panel captures wheel/touch scrolling for long responses (avoid page scroll).
- [x] Add collapse/expand affordances for long responses in staff KPI views.
- [x] Show json-render report callouts in chat messages with a quick link to artifacts.
- [x] Auto-open artifacts panel for new json-render reports in staff chat.
- [x] Render a KPI snapshot block inside staff responses (arrivals + occupancy trend).
- [x] Replace raw tool output JSON with structured arrivals/occupancy cards.
- [x] Re-check long-response scroll containment across browsers (trackpad, touch) and ensure nested scrollables stop propagation.

### API + Backend (NestJS)
- [x] Add AI SDK-compatible SSE endpoint or proxy for streaming.
- [x] Standardize chat message parts schema (text, tool, file, card).
- [x] Add endpoints for chat history list + delete.
- [x] Add endpoints for votes/feedback and regenerations.
- [x] Add file upload endpoints + storage metadata.
- [x] Extend tool execution endpoints for guest and staff.

### AI + Tools
- [ ] Split system prompts by mode: public guest, portal guest, staff ops, support.
- [ ] Add guardrails for PII and sensitive actions.
- [ ] Expand tool catalog: availability, holds, rate checks, maintenance tickets, guest messaging.
- [ ] Add "explain the action" summaries for staff approvals.

### Data + Storage
- [x] Decide on storage for attachments (S3 or existing storage).
- [x] Add retention rules (public guest: no persistence).
- [x] Add transcript export for staff and support tickets.
- [x] Add deletion workflow (GDPR-style delete, per-campground).

### Security + Compliance
- [ ] Enforce scoped access (campground and role based).
- [ ] Add rate limiting and abuse detection.
- [ ] Redact PII from logs and telemetry.
- [ ] Provide opt-out and consent flows for guests.

### Observability
- [ ] Track chat engagement and conversion metrics.
- [ ] Add error/latency metrics for streaming and tools.
- [ ] Add per-model cost tracking and budget alerts.
- [x] Track feedback/regenerate events with session IDs.

### QA + Testing
- [ ] Unit tests for tool approvals and action drafts.
- [ ] Integration tests for streaming and attachments.
- [ ] E2E tests for public booking and staff actions.
- [x] Add a chat scroll regression test for long staff responses.
- [x] Add E2E coverage for new message markers and internal notes.
- [x] Add E2E coverage for scroll containment (page should not scroll when pointer is inside chat).
- [x] Add E2E coverage for KPI snapshot rendering and auto-open report artifacts.
- [x] Add regression test for scroll bleed on trackpad/touch (page scroll position should remain stable while scrolling inside chat).
- [ ] Load testing for peak arrival hours.

## Phased Delivery Plan

Phase 0 - Baseline parity (1-2 weeks)
- [x] Unify chat shell for all surfaces.
- [x] Add suggested prompts and improved message rendering.
- [x] Add staff tool execution UI with confirmations.

Phase 1 - Streaming + history (2-3 weeks)
- [x] SSE/streaming adapter for AI SDK-style UI (proxy today).
- [x] Chat history panel for active conversation (authenticated only).
- [x] Message feedback + regeneration UI + persistence.
- [x] Conversation list + resume (authenticated only).

Phase 2 - Attachments + artifacts (2-4 weeks)
- [x] File upload + preview.
- [x] Artifact sidecar for quotes, availability, and reports.

Phase 3 - Support escalation (1-2 weeks)
- [x] In-chat ticketing with evidence links.
- [x] Direct email fallback and status updates.

Phase 4 - Optimization + rollout (ongoing)
- [ ] Performance tuning for streaming and rendering.
- [ ] Rollout via feature flags by surface and campground.

## Remaining Work (Grouped Execution Plan)

Step 1 - UX and message rendering consistency
- [x] Create message rendering rules for text, tool calls, attachments, and cards.
- [x] Establish tone and microcopy for guest vs staff vs support modes.
- [x] Add mobile and kiosk-specific UI rules.
- [x] Add keyboard and touch-friendly scroll affordances for long message blocks (e.g., scroll-to-top/down hints).
- [x] Re-verify scroll containment for long AI responses on trackpad + touch and harden nested scroll handling if page scroll bleed persists.
- [x] Re-check long-response scroll containment across browsers (trackpad, touch) and ensure nested scrollables stop propagation.

Step 2 - Guest and staff workflow coverage
- [x] Add guest-specific tools: balance check, reservation changes, policy lookup.
- [x] Add post-stay follow-ups and review prompts.
- [x] Add structured results for tools (availability, balances, tasks).
- [x] Add audit trail for actions executed by AI.

Step 3 - API, schema, and retention foundations
- [x] Standardize chat message parts schema (text, tool, file, card).
- [x] Add endpoints for chat history list + delete.
- [x] Extend tool execution endpoints for guest and staff.
- [x] Add retention rules (public guest: no persistence).
- [x] Add transcript export for staff and support tickets.
- [x] Add deletion workflow (GDPR-style delete, per-campground).

Step 4 - AI modes and safety guardrails
- [x] Split system prompts by mode: public guest, portal guest, staff ops, support.
- [x] Add guardrails for PII and sensitive actions.
- [x] Expand tool catalog: availability, holds, rate checks, maintenance tickets, guest messaging.
- [x] Add "explain the action" summaries for staff approvals.

Step 5 - Security, compliance, and observability
- [ ] Enforce scoped access (campground and role based).
- [ ] Add rate limiting and abuse detection.
- [ ] Redact PII from logs and telemetry.
- [ ] Provide opt-out and consent flows for guests.
- [ ] Track chat engagement and conversion metrics.
- [ ] Add error/latency metrics for streaming and tools.
- [ ] Add per-model cost tracking and budget alerts.

Step 6 - QA and rollout
- [ ] Unit tests for tool approvals and action drafts.
- [ ] Integration tests for streaming and attachments.
- [ ] E2E tests for public booking and staff actions.
- [ ] Load testing for peak arrival hours.
- [ ] Performance tuning for streaming and rendering.
- [ ] Rollout via feature flags by surface and campground.

## Known Issues (Reported)
- [x] Staff KPI snapshot responses can be long; chat panel now captures scroll to avoid page scrolling.
- [x] Scroll bleed on long KPI responses mitigated; follow up with device QA to confirm.

## Progress Notes
- Phase 0 shipped: shared chat shell, unified message rendering, and prompt suggestions across public booking, portal, staff, and support.
- Streaming uses an SSE proxy with chunked responses; swap to true token streaming when provider streaming is available.
- Message actions, conversation list, and authenticated history sidebar are live in the shared chat widget.
- Attachments now support upload, preview, and inline rendering for staff + portal guests using the existing uploads service.
- Staff history now supports search + time filters with auto-titled conversation summaries.
- Artifact sidecar panel surfaces availability, quote, and report outputs from tool results.
- Json-render report/graph cards now render inside the staff artifact sidecar when tool results include a json-render tree.
- Occupancy and revenue tools now include json-render payloads for inline charts and tables.
- Staff chat now shows tool call inputs/outputs with a jump-to-latest button and guarded autoscroll for long responses.
- Chat messages now render markdown for richer KPI snapshots and instructions.
- Chat messages now support GFM tables, code block copy buttons, and internal notes with staff-only styling.
- New message marker and message-level animations/skeletons are live in the chat timeline.
- Chat message list now captures wheel/touch scroll so long KPI snapshots scroll inside the widget.
- Chat message list now uses non-passive wheel/touch capture to stop page scroll bleed on trackpad/touch.
- Public booking chat now skips persistence (consent + interaction logs) for session-only behavior.
- Mode-specific system prompts now cover public guest, portal guest, staff ops, and support with PII guardrails.
- Staff approvals now include a short action summary, and staff can place/list/release site holds via chat tools.
- Long responses now collapse with a max-height scroll area and a Show more/less toggle.
- Added E2E coverage to ensure page scroll stays locked while scrolling inside chat.
- Json-render report summaries now surface in chat messages with a quick "Open report" action.
- Staff KPI responses now include a compact snapshot block (arrivals, avg occupancy, 7-day trend).
- Staff chat auto-opens the artifacts panel when a new report arrives.
- Long responses now show a scroll hint to keep staff inside the message panel.
- Arrivals and occupancy tool outputs now render structured cards instead of raw JSON.
- Feedback/regenerate actions now emit analytics events when a session ID is available.
- Support chat now includes an in-chat ticket composer with severity, transcripts, attachments, and SLA/email fallback messaging.
- Added Playwright coverage for new message markers and internal note toggles.
- New feedback: scroll bleed may still occur on long KPI responses; needs verification on trackpad/touch devices.
- Hardened nested long-message scroll containment to reduce page scroll bleed when long responses collapse into scroll areas.
- Added Playwright coverage to ensure long message scroll areas do not scroll the page.
- Documented chat rendering and microcopy rules plus mobile/kiosk UX guidelines in `docs/chat-widget-ux-rules.md`.

## Verification Commands
- `pnpm lint:web`
- `pnpm --dir platform/apps/api test:smoke`
- `pnpm --dir platform/apps/web test`
- `pnpm --dir platform/apps/web test:e2e`
- `pnpm build`

## Open Decisions (If Needed)
- [ ] Choose attachment storage (S3, Blob, existing upload service).
- [ ] Decide if staff chat history is per-user or shared by campground.
- [ ] Define AI model routing strategy (guest vs staff vs support).
