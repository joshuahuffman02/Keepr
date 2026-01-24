# Pre-Launch Checklist

Actionable steps required before going live with paying customers.

---

## 1. Payments (Stripe)

### Current State

- Using Stripe **test mode** (`sk_test_...`)
- Test cards work, but no real money flows

### Action Items

- [ ] Complete Stripe account verification (business info, bank account)
- [ ] Switch to **live mode** API keys
- [ ] Set environment variables in Railway:
  ```
  STRIPE_SECRET_KEY=sk_live_...
  STRIPE_PUBLISHABLE_KEY=pk_live_...
  STRIPE_WEBHOOK_SECRET=whsec_...  (create new webhook for production URL)
  ```
- [ ] Create production webhook endpoint in Stripe Dashboard pointing to:
      `https://your-api-domain.railway.app/payments/webhook`
- [ ] Test a real $1 transaction, then refund it

---

## 2. Domain & SSL

### Current State

- [x] **COMPLETE** - Custom domains configured:
  - Production: `keeprstay.com` (Vercel) + `api.keeprstay.com` (Railway)
  - Staging: `staging.keeprstay.com` (Vercel) + `api-staging.keeprstay.com` (Railway)
- [x] SSL certificates active (auto via Vercel/Railway)
- [x] DNS managed via Cloudflare

### Action Items

- [x] ~~Purchase domain~~ - `keeprstay.com` acquired
- [x] ~~Add custom domain in Vercel for frontend~~
- [x] ~~Add custom domain in Railway for API~~
- [x] ~~Configure DNS records (Cloudflare)~~
- [x] ~~SSL certificates~~ - automatic
- [x] ~~Update environment variables~~:
  - `NEXT_PUBLIC_API_BASE` configured per environment
  - `NEXTAUTH_URL` set correctly

---

## 3. QuickBooks Integration

### Current State

- OAuth flow is built but no developer app registered

### Action Items

- [ ] Create Intuit Developer account: https://developer.intuit.com/
- [ ] Create a new app (QuickBooks Online and Payments)
- [ ] Set OAuth redirect URI: `https://api.keeprstay.com/integrations/oauth/qbo/callback`
- [ ] Get credentials and set in Railway:
  ```
  QBO_CLIENT_ID=...
  QBO_CLIENT_SECRET=...
  ```
- [ ] Test OAuth flow with a sandbox QuickBooks company
- [ ] Apply for production access (Intuit reviews your app)

---

## 4. Email Provider

### Current State

- [x] **COMPLETE** - Resend integration built (`email.service.ts`)
- Supports Resend (primary), Postmark, and SMTP fallback
- All transactional email templates implemented

### Action Items

- [x] ~~Choose email provider~~ - Resend selected
- [x] ~~Integration code~~ - Full Resend API integration in `email.service.ts`
- [ ] Set `RESEND_API_KEY` in Railway (or use `onboarding@resend.dev` for testing)
- [ ] Verify sending domain in Resend dashboard for production
- [ ] Configure SPF, DKIM, DMARC DNS records (in Cloudflare)
- [ ] Test transactional emails work in staging

---

## 5. SMS Provider (Optional)

### Current State

- [x] **COMPLETE** - Twilio integration built (`sms.service.ts`)
- SMS delivery tracking and DLR (delivery receipts) supported

### Action Items

- [x] ~~Choose provider~~ - Twilio selected
- [x] ~~Integration code~~ - Full Twilio integration in `sms.service.ts`
- [ ] Set Twilio env vars in Railway:
  ```
  TWILIO_ACCOUNT_SID=...
  TWILIO_AUTH_TOKEN=...
  TWILIO_PHONE_NUMBER=+1...
  ```
- [ ] Test SMS for check-in reminders

---

## 6. Database

### Current State

- [x] **COMPLETE** - Using Supabase PostgreSQL with GitHub branching integration
- Production database on main Supabase project
- Staging uses Supabase branch database

### Action Items

- [x] ~~Automated backups~~ - enabled via Supabase
- [x] ~~Point-in-time recovery~~ - available via Supabase
- [ ] Document backup/restore procedure
- [x] ~~Connection pooling~~ - Supabase Pooler enabled

---

## 7. Authentication & Security

### Current State

- [x] **MOSTLY COMPLETE** - NextAuth v5 configured with JWT strategy
- [x] Rate limiting via `@nestjs/throttler` on all endpoints
- [x] ScopeGuard validates campgroundId ownership on every request
- [x] RolesGuard enforces role-based access control
- [x] Account lockout after failed login attempts

### Action Items

- [x] ~~Rate limiting~~ - Implemented via @Throttle decorators
- [x] ~~Auth guards~~ - JwtAuthGuard, ScopeGuard, RolesGuard all active
- [x] ~~Multi-tenant isolation~~ - ScopeGuard validates user memberships
- [ ] Generate new production secrets (if not already set):
  ```bash
  openssl rand -base64 32  # For NEXTAUTH_SECRET
  openssl rand -base64 32  # For JWT_SECRET
  ```
- [ ] Verify NEXTAUTH_URL is set correctly in Vercel
- [ ] Test password reset flow in staging

---

## 8. File Storage (Photos/Documents)

### Current State

- May be using local storage or placeholder

### Action Items

- [ ] Set up AWS S3 bucket (or Cloudflare R2, Railway Object Storage)
- [ ] Configure bucket for public read (photos) or signed URLs (documents)
- [ ] Set environment variables:
  ```
  AWS_ACCESS_KEY_ID=...
  AWS_SECRET_ACCESS_KEY=...
  AWS_S3_BUCKET=campreserv-uploads
  AWS_REGION=us-east-1
  ```
- [ ] Update upload endpoints to use cloud storage
- [ ] Set up CDN (CloudFront) for faster image delivery

---

## 9. Monitoring & Alerts

### Current State

- [x] **COMPLETE** - Full observability stack built
- [x] Sentry integration ready (`sentry.ts` + `sentry.*.config.ts`)
- [x] Health endpoints: `/health` (liveness) + `/ready` (readiness)
- [x] Prometheus metrics with SLO tracking
- [x] Alert sinks: Slack + PagerDuty integration
- [x] Synthetic checks: DB, Redis, Stripe, Email
- [x] Queue lag monitoring with alerts

### Action Items

- [x] ~~Error tracking code~~ - Sentry fully integrated
- [x] ~~Health endpoints~~ - `/health` and `/ready` implemented
- [x] ~~Alert infrastructure~~ - AlertSinksService with rate limiting
- [ ] Set `SENTRY_DSN` in Railway (API) and `NEXT_PUBLIC_SENTRY_DSN` in Vercel (Web)
- [ ] Set `SLACK_WEBHOOK_URL` for Slack alerts (or `PAGERDUTY_ROUTING_KEY` for PagerDuty)
- [ ] Set up external uptime monitoring (BetterUptime/UptimeRobot) pointing to `/health`
- [ ] Optional: Add Vercel Analytics or PostHog for product analytics

---

## 10. Legal & Compliance

### Action Items

- [ ] Privacy Policy page (required for Stripe, email providers)
- [ ] Terms of Service page
- [ ] Cookie consent banner (if serving EU users)
- [ ] Refund/cancellation policy
- [ ] PCI compliance confirmation (Stripe handles most of this)

---

## 11. Other Integrations (As Needed)

### Xero (International Accounting)

- [ ] Register at https://developer.xero.com/
- [ ] Set `XERO_CLIENT_ID`, `XERO_CLIENT_SECRET`
- [ ] Callback: `https://api.keeprstay.com/integrations/oauth/xero/callback`

### HubSpot (CRM)

- [ ] Register at https://developers.hubspot.com/
- [ ] Set `HUBSPOT_CLIENT_ID`, `HUBSPOT_CLIENT_SECRET`

### Zendesk (Support)

- [ ] Create OAuth client in Zendesk admin
- [ ] Set `ZENDESK_CLIENT_ID`, `ZENDESK_CLIENT_SECRET`, `ZENDESK_SUBDOMAIN`

---

## 12. Pre-Launch Testing

### Action Items

- [ ] Create test campground account end-to-end
- [ ] Complete full booking flow with real (test mode) payment
- [ ] Test email delivery to multiple providers (Gmail, Outlook, Yahoo)
- [ ] Test on mobile devices (iOS Safari, Android Chrome)
- [ ] Load test critical endpoints
- [ ] Verify all "Coming Soon" features are properly gated

---

## Environment Variables Summary

### Railway (API) - Required

```bash
NODE_ENV=production
DATABASE_URL=postgresql://...    # Supabase connection string

# Auth
JWT_SECRET=<generate with: openssl rand -base64 32>

# Stripe (switch to sk_live_... when ready)
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...

# Email (Resend)
RESEND_API_KEY=re_...

# SMS (Twilio) - Optional
TWILIO_ACCOUNT_SID=...
TWILIO_AUTH_TOKEN=...
TWILIO_PHONE_NUMBER=+1...

# Monitoring
SENTRY_DSN=https://...@sentry.io/...
SLACK_WEBHOOK_URL=https://hooks.slack.com/...  # For alerts
```

### Vercel (Web) - Required

```bash
NEXT_PUBLIC_API_BASE=https://api.keeprstay.com/api
NEXTAUTH_URL=https://keeprstay.com
NEXTAUTH_SECRET=<generate with: openssl rand -base64 32>
AUTH_SECRET=<same as NEXTAUTH_SECRET>
NEXT_PUBLIC_SENTRY_DSN=https://...@sentry.io/...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
```

### Optional Integrations

```bash
# QuickBooks
QBO_CLIENT_ID=...
QBO_CLIENT_SECRET=...

# File Storage
AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...
AWS_S3_BUCKET=keepr-uploads
```

---

## Launch Day Checklist

### Infrastructure (Already Done)

- [x] DNS configured (Cloudflare)
- [x] SSL working on custom domains
- [x] Database backups enabled (Supabase)
- [x] Health endpoints responding

### Before Launch

- [ ] All env vars set in Railway + Vercel (see summary above)
- [ ] Sentry DSN configured and test error captured
- [ ] Slack webhook configured and test alert sent
- [ ] Stripe webhook verified for production URL
- [ ] Email delivery tested (Resend)
- [ ] Full booking flow tested end-to-end

### Go Live

- [ ] Switch Stripe to live mode keys
- [ ] Test real $1 payment + refund
- [ ] Monitor error dashboard for first 24 hours
- [ ] Support email/chat ready
- [ ] Announcement ready (social, email list)

---

**Last Updated:** January 2026
