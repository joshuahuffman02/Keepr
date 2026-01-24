# NPS + Reviews Architecture (Campreserv)

This document locks the stack, providers, and boundaries for the NPS + reviews rollout so implementation stays aligned with the existing platform (NestJS API + Next.js app).

## Stack Choices

- **Frontend:** Next.js (app router) with React 19, Tailwind UI patterns already in repo.
- **Backend:** NestJS (existing `@campreserv/api`) with Prisma + PostgreSQL.
- **Messaging:** Postmark for email (already wired in `email.service`), Twilio for SMS webhooks (`communications` module). We will reuse these providers for NPS invites and review requests.
- **Caching/queues:** Redis (ioredis already present) for rate limits + lightweight queues; cron via Nest schedule.
- **Search/filters:** Postgres-first; add OpenSearch later if needed.
- **Auth:** Existing JWT staff/guest flows; public NPS/review links use signed invite tokens.

## Service Boundaries (modules)

- **NPS module:** surveys, sampling rules, invites, responses, events, metrics, and detractor ticket creation. Own controllers + Prisma models.
- **Reviews module:** review requests, reviews, moderation queue, exposure (where displayed), search filters, helpful votes, replies.
- **Comms integration:** reuse `EmailService`/Postmark for email sends; Twilio webhooks for SMS inbound status; signed tokens for public forms.
- **Support integration:** detractors auto-create `SupportReport` linked to campground/reservation/guest.

## Data Model (Prisma)

- **NPS**
  - `NpsSurvey`: id, campgroundId, name, question, status (draft/active/archived), channel flags, locales, cool-down days, sampling %, metadata.
  - `NpsRule`: surveyId, trigger (`post_checkout`, `post_booking`, `manual`), percentage, cooldownDays, segmentJson, isActive.
  - `NpsInvite`: surveyId, guestId?, reservationId?, campgroundId, channel (email/sms/inapp), status (queued/sent/responded/expired), token (unique), expiresAt, sentAt, openedAt, respondedAt.
  - `NpsResponse`: surveyId, inviteId?, guestId?, reservationId?, score (0-10), comment, tags, sentiment, createdAt.
  - `NpsEvent`: inviteId, type (open/click/unsub), payload json.
- **Reviews**
  - `ReviewRequest`: campgroundId, guestId?, reservationId?, channel, status, token, expiresAt, sentAt, respondedAt.
  - `Review`: campgroundId, guestId?, reservationId?, rating (1-5), title, body, photos[], tags[], sentiment, source (onsite/email/kiosk/import), status (pending/approved/rejected), exposure (public/private), createdAt.
  - `ReviewModeration`: reviewId, status, reasons[], decidedBy, decidedAt.
  - `ReviewVote`: reviewId, guestId?, ipHash, value (helpful/not), unique per reviewer.
  - `ReviewReply`: reviewId, authorType (staff/guest), body, createdAt.

## Channels & Flows (Phase 1 focus)

- In-app widget (Next.js) fetches active survey + signed invite token; 2-step score + comment; detractors create support ticket.
- Email invites: POST `/nps/invites` -> create invite + send Postmark email with tokenized link.
- Public response page uses token for lookup (no auth), records response, updates invite status, and emits detractor ticket.

## Security & Integrity

- HMAC/signed tokens per invite (single-use, expires).
- Rate limits per IP and per invite token for submission.
- CSRF on authenticated in-app form; no PII in URLs.

## Observability

- Metrics: send volume, open/click, response rate, NPS by period/segment, detractor SLAs, review volume/ratings.
- Logs: invite send errors, webhook failures; dead-letter for failed sends kept in Postgres with retry flag.

## Rollout phasing (matches plan)

1. Phase 1: NPS core (models, invites, responses, sampling rules), in-app widget + email, score/response dashboards, detractor ticketing.
2. Phase 2: Reviews system (requests, moderation, public display) + promoter branch from NPS.
3. Phase 3: SMS/kiosk channels, sentiment/themes, anomaly alerts, BI exports, 3P review sync.
