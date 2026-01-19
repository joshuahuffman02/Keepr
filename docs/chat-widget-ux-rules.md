# Chat Widget UX and Message Rendering Rules

Use this guide when editing chat UI or prompt design so guest, staff, and support experiences stay consistent.

## Message Rendering Rules
- Text: lead with a one-line summary, then bullets or short paragraphs; keep long text in collapsible blocks.
- Tool calls: show action title, status, and the key inputs/outputs; require confirmation for any mutation.
- Attachments: show image previews, file name, and size; expose upload status and allow removal before send.
- Cards: provide a clear title, primary metric, timeframe, and a single primary action (open report, view quote).
- Errors: surface the error reason and a recovery next step (retry, open ticket, contact support).

## Tone and Microcopy (by Mode)
### Public guest (booking)
- Tone: warm, conversational, avoid ops jargon.
- UI copy: Title "Keepr Host", subtitle "Booking + stay help".
- Input placeholder: "Share dates, guests, rig, and amenities..."
- Responses: confirm key details, ask clarifying questions, and offer the next action.

### Portal guest (authenticated)
- Tone: supportive, proactive, focused on reservations and account info.
- UI copy: Title "Keepr Host", subtitle "Your stay assistant".
- Input placeholder: "Ask about your reservation, payments, or changes..."
- Responses: show reservation context first, then options or next steps.

### Staff ops (dashboard)
- Tone: concise, action-first, explicit about approvals.
- UI copy: Title "Keepr Ops", subtitle "Operations copilot".
- Input placeholder: "Ask about arrivals, occupancy, tasks..."
- Responses: summarize outcomes, highlight approvals, and list any blockers.

### Support (owner contact)
- Tone: empathetic, clear, and outcome-driven.
- UI copy: Title "Keepr Support", subtitle "Owner help desk".
- Input placeholder: "Share the issue, impact, and desired outcome..."
- Responses: acknowledge the issue, provide a resolution path, and set expectations.

### Partner / action drafts
- Tone: confident, safety-focused, and explicit about approvals.
- UI copy: Title "Keepr Actions", subtitle "Drafts + approvals".
- Input placeholder: "Describe the action you want drafted..."
- Responses: present a draft, ask for approval, and confirm next steps.

## Mobile and Kiosk UI Rules
- Mobile: full-width and near-full-height shell, single panel open by default, history/artifacts hidden until requested.
- Mobile: keep the input pinned above the keyboard, avoid hover-only affordances, and use 44px+ hit targets.
- Kiosk: allow larger width/height, keep quick actions visible, and favor fewer dense controls.
- Kiosk: increase default spacing and ensure session status is always visible.

## Scroll and Accessibility
- Long responses: collapse by default, show scroll hint plus top/bottom buttons, and allow keyboard scrolling.
- Contain wheel/touch within the chat list and nested scrollables to prevent page scroll bleed.
- Provide focus rings and ARIA labels for interactive scroll regions and buttons.

## Verification
- `pnpm --dir platform/apps/web test:e2e`
- Manual: trackpad + touch scroll inside long responses and in nested tool cards.
