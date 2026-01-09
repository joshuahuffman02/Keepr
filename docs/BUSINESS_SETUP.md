# Business Setup Plan

Complete guide for setting up the legal business structure for Keepr.

---

## Table of Contents
1. [Structure Overview](#structure-overview)
2. [How Money Flows](#how-money-flows)
3. [Bank Accounts Explained](#bank-accounts-explained)
4. [Step-by-Step Setup](#step-by-step-setup)
5. [Day-to-Day Operations](#day-to-day-operations)
6. [Paying Yourself](#paying-yourself)
7. [Taxes](#taxes)
8. [QuickBooks Setup](#quickbooks-setup)
9. [Adding Future Projects](#adding-future-projects)
10. [Links & Resources](#links--resources)

---

## Structure Overview

```
┌─────────────────────────────────────────────────────────────┐
│                         YOU                                  │
│                    (Personal Assets)                         │
│        Protected from business liability by LLC shield       │
└─────────────────────────┬───────────────────────────────────┘
                          │ You own 100%
                          ▼
┌─────────────────────────────────────────────────────────────┐
│              [YourName] Holdings LLC                         │
│                                                              │
│  Purpose: Parent company that owns your businesses           │
│  Bank Account: Holdings Checking                             │
│  EIN: #1                                                     │
│                                                              │
│  Money IN:  Distributions from Keepr (profits)               │
│  Money OUT: Your personal draws, taxes, investments          │
└─────────────────────────┬───────────────────────────────────┘
                          │ Holdings owns 100%
                          ▼
┌─────────────────────────────────────────────────────────────┐
│                      Keepr LLC                               │
│                                                              │
│  Purpose: Runs the Keepr business                            │
│  Bank Account: Keepr Business Checking                       │
│  EIN: #2                                                     │
│                                                              │
│  Money IN:  Customer payments (Stripe)                       │
│  Money OUT: Business expenses (Railway, Vercel, etc.)        │
└─────────────────────────────────────────────────────────────┘
```

### Why This Structure?

**Liability Protection:**
- If Keepr gets sued, only Keepr LLC assets are at risk
- Your personal assets (house, car, savings) are protected
- Holdings LLC is also protected from Keepr's liabilities
- Future projects under Holdings are protected from each other

**Tax Flexibility:**
- Both LLCs are "pass-through" entities (profits flow to your personal taxes)
- No double taxation like a C-Corp
- Can elect S-Corp status later for tax savings if profitable

---

## How Money Flows

### Revenue Flow (Money Coming In)

```
Customer pays for reservation
         │
         ▼
┌─────────────────┐
│     Stripe      │ ◄── Takes ~2.9% + $0.30 per transaction
└────────┬────────┘
         │ Deposits daily/weekly
         ▼
┌─────────────────┐
│  Keepr LLC      │ ◄── ALL revenue goes here
│  Bank Account   │
└─────────────────┘
```

**Important:** Customer money goes to Keepr LLC, NOT Holdings.

### Expense Flow (Money Going Out)

```
┌─────────────────┐
│  Keepr LLC      │
│  Bank Account   │
└────────┬────────┘
         │
         ├──► Railway ($20-100/mo) - Keepr pays this
         ├──► Vercel ($0-20/mo) - Keepr pays this
         ├──► Resend ($0-20/mo) - Keepr pays this
         ├──► Domain (~$15/yr) - Keepr pays this
         ├──► QuickBooks ($30/mo) - Keepr pays this
         ├──► Stripe fees (auto-deducted)
         └──► Any other Keepr business expenses
```

**Rule:** If it's a Keepr expense, pay it from the Keepr bank account.

### Profit Distribution (Taking Money Out)

```
┌─────────────────┐
│  Keepr LLC      │
│  Bank Account   │
│                 │
│  Revenue: $5000 │
│  Expenses: $200 │
│  ─────────────  │
│  Profit: $4800  │
└────────┬────────┘
         │ "Distribution" or "Owner's Draw"
         │ (Transfer when you want, any amount up to profit)
         ▼
┌─────────────────┐
│  Holdings LLC   │
│  Bank Account   │
└────────┬────────┘
         │ "Owner's Draw" to yourself
         ▼
┌─────────────────┐
│  Your Personal  │
│  Bank Account   │
└─────────────────┘
```

---

## Bank Accounts Explained

You need **THREE** bank accounts:

### 1. Keepr LLC Business Checking
- **What it's for:** All Keepr business operations
- **Money IN:** Stripe deposits (customer payments)
- **Money OUT:** Business expenses (Railway, Vercel, Resend, etc.)
- **Connected to:** Stripe, QuickBooks
- **Open at:** Mercury or Relay (free, online, startup-friendly)

### 2. Holdings LLC Business Checking
- **What it's for:** Receiving profits from your businesses
- **Money IN:** Distributions from Keepr LLC (and future projects)
- **Money OUT:** Transfers to your personal account, tax payments
- **Connected to:** Nothing (just receives transfers)
- **Open at:** Mercury or Relay

### 3. Your Personal Checking (Already Have)
- **What it's for:** Your personal life
- **Money IN:** Draws from Holdings LLC
- **Money OUT:** Rent, food, personal stuff
- **Keep completely separate from business**

### Example Monthly Flow

```
Month of January:

Keepr LLC Account:
  + $3,000  Stripe deposits (customer payments)
  - $89     Railway
  - $20     Vercel
  - $15     Resend
  - $30     QuickBooks
  - $87     Stripe fees (2.9% + $0.30)
  ────────
  = $2,759  Profit available

You decide to take $2,000 as a distribution:

  Keepr LLC  ──[$2,000]──►  Holdings LLC  ──[$2,000]──►  Personal Account

Keepr LLC keeps $759 as buffer for next month's expenses.
```

---

## Step-by-Step Setup

### Week 1: Holdings LLC

#### Step 1: Register Holdings LLC
1. Go to [mblsportal.sos.state.mn.us](https://mblsportal.sos.state.mn.us)
2. Click "File a New Business"
3. Select "Limited Liability Company (LLC)"
4. Fill in:
   - **Name:** `[YourName] Holdings LLC` (e.g., "Huffman Holdings LLC")
   - **Registered Agent:** Yourself
   - **Registered Office:** Your home address
   - **Member/Organizer:** Your name
5. Pay $155
6. **Save the PDF** - this is your Articles of Organization

#### Step 2: Get Holdings EIN
1. Go to [irs.gov/ein](https://www.irs.gov/businesses/small-businesses-self-employed/apply-for-an-employer-identification-number-ein-online)
2. Click "Apply Online Now"
3. Select "Limited Liability Company"
4. Enter Holdings LLC info exactly as registered
5. **Save the PDF** - this is your EIN confirmation letter

#### Step 3: Open Holdings Bank Account
1. Go to [mercury.com](https://mercury.com) or [relayfi.com](https://relayfi.com)
2. Click "Open an Account"
3. Upload:
   - Articles of Organization (from Step 1)
   - EIN Letter (from Step 2)
   - Your driver's license
4. Wait 1-2 days for approval

---

### Week 2: Keepr LLC

#### Step 4: Register Keepr LLC
1. Go to [mblsportal.sos.state.mn.us](https://mblsportal.sos.state.mn.us)
2. Click "File a New Business"
3. Select "Limited Liability Company (LLC)"
4. Fill in:
   - **Name:** `Keepr LLC`
   - **Registered Agent:** Yourself
   - **Registered Office:** Your home address
   - **Member/Organizer:** `[YourName] Holdings LLC` ⚠️ NOT your personal name!
5. Pay $155
6. **Save the PDF**

#### Step 5: Get Keepr EIN
1. Go to [irs.gov/ein](https://www.irs.gov/businesses/small-businesses-self-employed/apply-for-an-employer-identification-number-ein-online)
2. Select "Limited Liability Company"
3. Enter Keepr LLC info
4. For "Responsible Party" - enter your personal info (you manage it)
5. **Save the PDF**

#### Step 6: Open Keepr Bank Account
1. Go to Mercury or Relay (same bank is fine, separate account)
2. Open account for "Keepr LLC"
3. Upload Keepr's Articles + EIN letter
4. Wait 1-2 days for approval

---

### Week 2-3: Go Live with Stripe

#### Step 7: Complete Stripe Verification
1. Go to [dashboard.stripe.com](https://dashboard.stripe.com)
2. Complete business verification with:
   - **Business name:** Keepr LLC
   - **EIN:** Keepr's EIN (not Holdings)
   - **Bank account:** Keepr's bank account
   - **Business address:** Your address
   - **Your SSN:** Required as beneficial owner
   - **Description:** "Campground reservation management software"

#### Step 8: Create Production Webhook
1. Stripe Dashboard → Developers → Webhooks
2. Add endpoint: `https://api.keeprstay.com/api/payments/webhook`
3. Select events:
   - `payment_intent.succeeded`
   - `payment_intent.payment_failed`
   - `charge.refunded`
   - `invoice.paid`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
4. Copy the signing secret

#### Step 9: Update Environment Variables

**Railway (API):**
```
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
```

**Vercel (Web):**
```
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_...
```

#### Step 10: Test Real Payment
1. Make a real $1.00 payment through your system
2. Verify it shows in Stripe Dashboard
3. Verify Stripe deposits to Keepr bank account
4. Refund the $1.00 (you'll lose ~$0.33 to fees, that's fine)

---

## Day-to-Day Operations

### When a Customer Pays

1. Customer enters payment info on Keepr
2. Stripe processes payment, takes 2.9% + $0.30
3. Stripe deposits remaining amount to Keepr LLC bank account
4. QuickBooks automatically records the income
5. **You don't need to do anything** - it's automatic

### Paying for Services

**Monthly expenses paid from Keepr LLC account:**

| Service | Cost | How to Pay |
|---------|------|-----------|
| Railway | ~$20-100/mo | Add Keepr debit card |
| Vercel | $0-20/mo | Add Keepr debit card |
| Resend | $0-20/mo | Add Keepr debit card |
| QuickBooks | $30/mo | Add Keepr debit card |
| Domain renewal | ~$15/yr | Add Keepr debit card |

**Get a debit card** for Keepr LLC from Mercury/Relay - makes paying for services easy.

### Taking Money Out (Distributions)

When you want to pay yourself:

1. **Check Keepr's balance** - Make sure you have enough after expenses
2. **Transfer to Holdings** - Bank transfer from Keepr → Holdings
   - Label it "Owner Distribution" or "Member Draw"
3. **Transfer to Personal** - Bank transfer from Holdings → Personal
   - Label it "Owner Draw"

**How much can you take?**
- Legally: Up to the total profit
- Practically: Leave 1-2 months of expenses as a buffer

**How often?**
- Whenever you want - weekly, monthly, quarterly
- Most people do monthly or when they need it

---

## Paying Yourself

### Option A: Simple Owner's Draw (Recommended to Start)

Just transfer money when you need it:

```
Keepr LLC  ──►  Holdings LLC  ──►  Personal Account
```

- No payroll to run
- No payroll taxes to calculate
- Just regular bank transfers
- Pay quarterly estimated taxes yourself

### Option B: Salary (Later, If Profitable)

If Keepr makes $50k+ profit/year, consider S-Corp election:

1. Holdings elects S-Corp tax status
2. You become an "employee" of Holdings
3. Pay yourself a reasonable salary (with payroll taxes)
4. Take remaining profit as distributions (no payroll tax)
5. **Saves money on self-employment tax**

This is complex - get an accountant when you reach this point.

---

## Taxes

### What You'll Owe

As a single-member LLC, all profits flow to YOUR personal tax return.

| Tax | Rate | When |
|-----|------|------|
| Federal Income Tax | 10-37% (based on income) | April 15 |
| Minnesota State Tax | 5.35-9.85% | April 15 |
| Self-Employment Tax | 15.3% on profits | April 15 |
| **Estimated Taxes** | Quarterly payments | Apr 15, Jun 15, Sep 15, Jan 15 |

### Set Aside for Taxes

**Rule of thumb:** Set aside 25-30% of profits for taxes.

Example:
- Keepr makes $4,000 profit in January
- Transfer $1,200 (30%) to a savings account for taxes
- Take remaining $2,800 as your distribution

### Quarterly Estimated Taxes

If you expect to owe $1,000+ in taxes, IRS wants quarterly payments:

1. **Calculate:** (Annual expected profit × 30%) ÷ 4
2. **Pay online:** [irs.gov/payments](https://www.irs.gov/payments)
3. **Due dates:** April 15, June 15, September 15, January 15

### Get an Accountant

Seriously, once you're making real money ($20k+/year), pay for an accountant:
- They'll save you more than they cost
- Handle quarterly estimates
- Do your annual return
- Find deductions you'd miss
- Cost: ~$500-1500/year for simple LLC

---

## QuickBooks Setup

QuickBooks tracks all money in/out so you know your profit and can do taxes.

### Step 1: Create QuickBooks Account
1. Go to [quickbooks.intuit.com](https://quickbooks.intuit.com)
2. Choose "Simple Start" plan (~$30/month)
3. **Set up for Keepr LLC** (not Holdings)

### Step 2: Connect Bank Account
1. QuickBooks → Banking → Connect Account
2. Connect Keepr LLC bank account
3. Transactions auto-import daily

### Step 3: Connect Stripe
1. QuickBooks → Apps → Find Stripe
2. Connect your Stripe account
3. Sales auto-sync to QuickBooks

### Step 4: Connect to Keepr (Optional)
1. Keepr Dashboard → Settings → Integrations
2. Click "Connect QuickBooks"
3. Authorize the connection

**Environment Variables (Railway):**
```
QBO_CLIENT_ID=your_client_id
QBO_CLIENT_SECRET=your_client_secret
```

### Step 5: Set Up Categories

Categorize transactions as they come in:

**Income Categories:**
- Reservation Revenue
- Add-on Revenue
- Late Fees / Cancellation Fees

**Expense Categories:**
- Hosting (Railway, Vercel)
- Software Subscriptions (Resend, etc.)
- Payment Processing (Stripe fees)
- Professional Services (accounting, legal)
- Marketing

### Do You Need QuickBooks for Holdings?

**Not yet.** Holdings will just have:
- Money coming in (from Keepr)
- Money going out (to you)

A simple spreadsheet works until you have multiple projects.

---

## Adding Future Projects

When you build another project:

### Setup (Same Process)
1. Register `[ProjectName] LLC` in Minnesota - $155
2. **Owner = Holdings LLC** (not you personally)
3. Get separate EIN
4. Open separate bank account
5. Set up separate Stripe account
6. Keep finances 100% separate from Keepr

### Structure
```
[YourName] Holdings LLC
    ├── Keepr LLC
    ├── Project2 LLC
    └── Project3 LLC
```

### Why Separate?
- If Project2 gets sued, Keepr is protected
- If Project2 fails, its debts don't touch Keepr
- Clean financials for each project
- Could sell one project without affecting others

---

## Complete Checklist

### Week 1
- [ ] Register Holdings LLC ($155)
- [ ] Save Articles of Organization PDF
- [ ] Get Holdings EIN (free)
- [ ] Save EIN confirmation letter PDF
- [ ] Open Holdings bank account (Mercury/Relay)

### Week 2
- [ ] Register Keepr LLC - owner is Holdings LLC ($155)
- [ ] Save Articles of Organization PDF
- [ ] Get Keepr EIN (free)
- [ ] Save EIN confirmation letter PDF
- [ ] Open Keepr bank account (Mercury/Relay)
- [ ] Get Keepr debit card

### Week 2-3
- [ ] Complete Stripe verification with Keepr info
- [ ] Create production Stripe webhook
- [ ] Update Railway env vars (live Stripe keys)
- [ ] Update Vercel env vars (live publishable key)
- [ ] Test real $1 payment + refund

### Week 3-4
- [ ] Sign up for QuickBooks ($30/mo)
- [ ] Connect Keepr bank account to QuickBooks
- [ ] Connect Stripe to QuickBooks
- [ ] Set up income/expense categories

### Ongoing
- [ ] Pay business expenses from Keepr account only
- [ ] Take distributions: Keepr → Holdings → Personal
- [ ] Set aside 25-30% for taxes
- [ ] Pay quarterly estimated taxes
- [ ] Get an accountant when profitable

---

## Total Costs

| Item | One-Time | Monthly |
|------|----------|---------|
| Holdings LLC | $155 | $0 |
| Keepr LLC | $155 | $0 |
| Bank accounts | $0 | $0 |
| QuickBooks | $0 | $30 |
| **Total** | **$310** | **$30** |

Minnesota has no annual LLC fee!

---

## Links & Resources

**Registration:**
- Minnesota LLC Portal: https://mblsportal.sos.state.mn.us
- IRS EIN Application: https://www.irs.gov/businesses/small-businesses-self-employed/apply-for-an-employer-identification-number-ein-online

**Banking:**
- Mercury Bank: https://mercury.com
- Relay Bank: https://relayfi.com

**Payments:**
- Stripe Dashboard: https://dashboard.stripe.com

**Accounting:**
- QuickBooks: https://quickbooks.intuit.com
- Intuit Developer Portal: https://developer.intuit.com

**Taxes:**
- IRS Payments: https://www.irs.gov/payments
- Minnesota Revenue: https://www.revenue.state.mn.us

---

## Timeline Summary

| Week | Tasks |
|------|-------|
| Week 1 | Holdings LLC: register, EIN, bank account |
| Week 2 | Keepr LLC: register, EIN, bank account |
| Week 2-3 | Stripe: verify, webhook, go live |
| Week 3-4 | QuickBooks: setup, connect everything |
| **Total** | **~3-4 weeks to fully operational** |

---

## Quick Reference Card

```
HOLDINGS LLC                      KEEPR LLC
─────────────                     ─────────
EIN: _______________              EIN: _______________
Bank: ______________              Bank: ______________
Account #: _________              Account #: _________

STRIPE
──────
Account ID: _______________
Webhook Secret: ___________

QUICKBOOKS
──────────
Login: _______________
```

---

**Last Updated:** January 2026
