# Business Setup Plan

Guide for setting up the legal business structure for Keepr.

---

## Structure

```
[YourName] Holdings LLC (Minnesota)
    │
    └── Keepr LLC (Minnesota, owned by Holdings)
```

**Why this structure:**
- Each project is isolated liability-wise
- If one project gets sued, others are protected
- Easy to add more projects under Holdings later
- No investors needed

---

## Week 1: Holdings LLC

| Step | Action | Time | Cost |
|------|--------|------|------|
| 1 | Register Holdings LLC at [mblsportal.sos.state.mn.us](https://mblsportal.sos.state.mn.us) | 15 min | $155 |
| 2 | Get EIN at [irs.gov/ein](https://www.irs.gov/businesses/small-businesses-self-employed/apply-for-an-employer-identification-number-ein-online) | 10 min | Free |
| 3 | Open Holdings bank account (Mercury or Relay) | 1-2 days | Free |

### Holdings LLC Registration Details
- **Name:** `[YourName] Holdings LLC` or `[YourName] Ventures LLC`
- **Type:** Domestic Limited Liability Company
- **Registered Agent:** Yourself (your home address)
- **Member:** You (100% ownership)

---

## Week 2: Keepr LLC

| Step | Action | Time | Cost |
|------|--------|------|------|
| 4 | Register Keepr LLC (Owner = "[YourName] Holdings LLC") | 15 min | $155 |
| 5 | Get separate EIN for Keepr LLC | 10 min | Free |
| 6 | Open Keepr bank account (separate from Holdings) | 1-2 days | Free |

### Keepr LLC Registration Details
- **Name:** `Keepr LLC`
- **Type:** Domestic Limited Liability Company
- **Registered Agent:** Yourself (your home address)
- **Member:** `[YourName] Holdings LLC` (NOT you personally - this is important!)

---

## Week 2-3: Go Live with Stripe

| Step | Action | Time | Cost |
|------|--------|------|------|
| 7 | Complete Stripe verification with Keepr LLC info | 1-3 days | Free |
| 8 | Add live Stripe keys to Railway + Vercel | 10 min | Free |
| 9 | Create production webhook in Stripe Dashboard | 5 min | Free |
| 10 | Test real $1 payment, then refund it | 5 min | ~$0.33 fees |

### Stripe Verification Requirements
- Keepr LLC EIN
- Keepr LLC bank account number + routing
- Business address
- Your SSN (as the beneficial owner)
- Brief description: "Campground reservation management software"

### Stripe Keys to Update

**Railway (API):**
```
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
```

**Vercel (Web):**
```
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_...
```

### Create Production Webhook
1. Go to Stripe Dashboard → Developers → Webhooks
2. Add endpoint: `https://api.keeprstay.com/api/payments/webhook`
3. Select events:
   - `payment_intent.succeeded`
   - `payment_intent.payment_failed`
   - `charge.refunded`
   - `invoice.paid`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
4. Copy the signing secret to `STRIPE_WEBHOOK_SECRET`

---

## Total Costs

| Item | Cost |
|------|------|
| Holdings LLC (one-time) | $155 |
| Keepr LLC (one-time) | $155 |
| Annual renewal | $0 (Minnesota doesn't charge!) |
| Bank accounts | Free |
| Stripe | Free (they take % of transactions) |
| **Total** | **$310 one-time** |

---

## What You'll Need (Have Ready)

Before starting registration:
- [ ] Your full legal name
- [ ] Home address
- [ ] Desired LLC names (check availability first)
- [ ] Credit card for payment

For EIN application:
- [ ] LLC name (exactly as registered)
- [ ] LLC address
- [ ] Your SSN
- [ ] Formation date

For bank account:
- [ ] EIN confirmation letter (PDF from IRS)
- [ ] Articles of Organization (PDF from MN)
- [ ] Your ID (driver's license)

---

## Account Reference

| Account | EIN | Bank | Purpose |
|---------|-----|------|---------|
| Holdings LLC | EIN #1 | Holdings checking | Holds ownership, receives dividends |
| Keepr LLC | EIN #2 | Keepr checking | All Keepr revenue + expenses |

---

## Financial Best Practices

1. **Never mix money** - Keep Holdings and Keepr accounts completely separate
2. **Pay yourself properly** - Holdings can "invoice" Keepr for management fees
3. **Track everything** - Use QuickBooks or Wave for bookkeeping
4. **Quarterly taxes** - Set aside ~25-30% for federal + state taxes
5. **Get an accountant** - Worth it once you're making real money

---

## Adding Future Projects

When you have another project:

1. Register `[ProjectName] LLC` in Minnesota ($155)
2. Set owner as `[YourName] Holdings LLC`
3. Get separate EIN
4. Open separate bank account
5. Keep finances completely separate from Keepr

---

## Timeline Summary

| Week | Tasks |
|------|-------|
| Week 1 | Register Holdings LLC, get EIN, open bank account |
| Week 2 | Register Keepr LLC, get EIN, open bank account |
| Week 2-3 | Stripe verification + go live |
| **Total** | **~2-3 weeks** |

---

## QuickBooks Setup

### Step 1: Create QuickBooks Account
1. Sign up at [quickbooks.intuit.com](https://quickbooks.intuit.com)
2. Choose "Simple Start" plan (~$30/month) or "Essentials" if you need multiple users
3. Set up for Keepr LLC (not Holdings)

### Step 2: Connect QuickBooks to Keepr
1. Go to Keepr Dashboard → Settings → Integrations
2. Click "Connect QuickBooks"
3. Sign in with your Intuit account
4. Authorize the connection

### Step 3: Configure Chart of Accounts
QuickBooks will auto-create accounts, but verify these exist:
- **Income:** Reservation Revenue, Add-on Revenue, Late Fees
- **Expenses:** Stripe Fees, Refunds, Operating Expenses
- **Assets:** Accounts Receivable, Bank Account

### Step 4: Set Environment Variables (Railway)
```
QBO_CLIENT_ID=your_client_id
QBO_CLIENT_SECRET=your_client_secret
```

### What Syncs Automatically
- Payments → recorded as income
- Refunds → recorded as expenses
- Daily revenue summary
- Customer records (optional)

---

## Links

- Minnesota LLC Portal: https://mblsportal.sos.state.mn.us
- IRS EIN Application: https://www.irs.gov/businesses/small-businesses-self-employed/apply-for-an-employer-identification-number-ein-online
- Mercury Bank: https://mercury.com
- Relay Bank: https://relayfi.com
- Stripe Dashboard: https://dashboard.stripe.com
- QuickBooks: https://quickbooks.intuit.com
- Intuit Developer (for API keys): https://developer.intuit.com

---

## Complete Timeline

| Week | Tasks |
|------|-------|
| Week 1 | Register Holdings LLC, get EIN, open bank account |
| Week 2 | Register Keepr LLC, get EIN, open bank account |
| Week 2-3 | Stripe verification + go live |
| Week 3-4 | QuickBooks setup + connect to Keepr |
| **Total** | **~3-4 weeks** |

---

**Last Updated:** January 2026
