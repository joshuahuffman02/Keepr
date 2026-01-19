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
- [ ] Add post-stay follow-ups and review prompts.

### 3) Staff Dashboard (Operations)
- [x] Unify widget with staff shell (tool approvals, action drafts).
- [x] Add persistent staff history (campground-scoped).
- [x] Add search and filters for staff history.
- [x] Auto-title conversations for the history list.
- [x] Add staff quick actions: arrivals, departures, occupancy, maintenance.
- [x] Add tool execution UI (confirmations, forms, selections).
- [x] Add json-render-powered inline report/graph cards in staff chat (source: `/Users/josh/Documents/GitHub/github extra stuff/json-render-main`).
- [ ] Add structured results for tools (availability, balances, tasks).
- [ ] Add audit trail for actions executed by AI.

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
- [ ] Tool call UI: approve/deny, show input/output.
- [x] Artifact panel or sidecar (quotes, documents, dashboards).
- [x] Chat history sidebar for authenticated chats (per-conversation history view).
- [ ] Optional visibility/share controls (staff-only, internal).
- [ ] Polished UI: animations, skeletons, responsive layout, scroll control.

## Workstreams (Implementation To-Do)

### UX/UI
- [x] Define shared chat shell layout and variants (guest, portal, staff, support).
- [ ] Create message rendering rules for text, tool calls, attachments, and cards.
- [ ] Establish tone and microcopy for guest vs staff vs support modes.
- [ ] Add mobile and kiosk-specific UI rules.

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

### API + Backend (NestJS)
- [x] Add AI SDK-compatible SSE endpoint or proxy for streaming.
- [ ] Standardize chat message parts schema (text, tool, file, card).
- [ ] Add endpoints for chat history list + delete.
- [x] Add endpoints for votes/feedback and regenerations.
- [x] Add file upload endpoints + storage metadata.
- [ ] Extend tool execution endpoints for guest and staff.

### AI + Tools
- [ ] Split system prompts by mode: public guest, portal guest, staff ops, support.
- [ ] Add guardrails for PII and sensitive actions.
- [ ] Expand tool catalog: availability, holds, rate checks, maintenance tickets, guest messaging.
- [ ] Add "explain the action" summaries for staff approvals.

### Data + Storage
- [x] Decide on storage for attachments (S3 or existing storage).
- [ ] Add retention rules (public guest: no persistence).
- [ ] Add transcript export for staff and support tickets.
- [ ] Add deletion workflow (GDPR-style delete, per-campground).

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

## Progress Notes
- Phase 0 shipped: shared chat shell, unified message rendering, and prompt suggestions across public booking, portal, staff, and support.
- Streaming uses an SSE proxy with chunked responses; swap to true token streaming when provider streaming is available.
- Message actions, conversation list, and authenticated history sidebar are live in the shared chat widget.
- Attachments now support upload, preview, and inline rendering for staff + portal guests using the existing uploads service.
- Staff history now supports search + time filters with auto-titled conversation summaries.
- Artifact sidecar panel surfaces availability, quote, and report outputs from tool results.
- Json-render report/graph cards now render inside the staff artifact sidecar when tool results include a json-render tree.
- Feedback/regenerate actions now emit analytics events when a session ID is available.
- Support chat now includes an in-chat ticket composer with severity, transcripts, attachments, and SLA/email fallback messaging.

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
