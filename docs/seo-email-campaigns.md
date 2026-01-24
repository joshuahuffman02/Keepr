# SEO & Email Campaigns Setup

## Analytics & Tracking (per campground)

- Fields: GA4 Measurement ID, Meta Pixel ID on Campground (set in `Settings → Analytics & Tracking`).
- These load only on public park pages with the selected campground slug.
- Env: `NEXT_PUBLIC_APP_BASE` sets canonical/base URLs for meta/sitemap/robots.

## SEO

- Public park pages now emit: meta/OG/Twitter tags, canonical, JSON-LD (LodgingBusiness/Campground), and dynamic images.
- `sitemap.ts` and `robots.ts` use `NEXT_PUBLIC_APP_BASE`; sitemap includes published campgrounds.

## Email Campaigns (Postmark)

- Models: Campaign, CampaignSend with per-campground scope.
- Audience: guests with `marketingOptIn = true`, `email` present, and at least one reservation for the campground.
- Sending: `/campaigns/:id/send` uses Postmark via `EmailService`, records providerMessageId, statuses in `CampaignSend`.
- Opt-in: marketingOptIn enforced; add unsubscribe/ manage-preferences link in templates (Postmark supports track/unsub).
- UI: `Settings → Campaigns` to create drafts (name, subject, from, HTML) and “Send now”.

## Unsubscribe / compliance

- Honor `marketingOptIn`; do not send when false.
- Include visible unsubscribe/footer links in campaign HTML (Postmark can manage via server-side template variables if desired).
- Respect fromEmail domain DKIM/SPF for deliverability.
