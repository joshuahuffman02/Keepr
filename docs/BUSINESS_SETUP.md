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

### The Basic Formula

Every month (or whenever you want to take money out):

```
REVENUE (what came in)
  - EXPENSES (what you paid for services)
  - TAX RESERVE (30% of what's left)
  - CASH BUFFER (keep 2-3 months expenses)
  = WHAT YOU CAN TAKE
```

### Practical Example

Say Keepr made $5,000 this month:

| Item | Amount | Running Total |
|------|--------|---------------|
| Revenue | $5,000 | $5,000 |
| - Stripe fees (2.9%) | -$145 | $4,855 |
| - Railway | -$50 | $4,805 |
| - Vercel | -$20 | $4,785 |
| - Resend | -$20 | $4,765 |
| - Other expenses | -$50 | $4,715 |
| **Net Profit** | | **$4,715** |
| - Tax reserve (30%) | -$1,415 | $3,300 |
| - Cash buffer (if needed) | -$300 | $3,000 |
| **= What you can take** | | **$3,000** |

### Your Goal: Passive Income (5 hrs/week max)

You want to hire people to run this so you're not trading time for money. That means:
- **Take less now** → Build a hiring fund
- **Hire contractors early** → Buy back your time
- **Target: 5 hours/week** → Strategy calls, decisions, not execution

### The Hiring Fund Strategy

Instead of taking all the profit, split it:

```
Net Profit (after tax reserve)
  ├── 30% → Your pocket (living money)
  ├── 50% → Hiring fund (to pay contractors/employees)
  └── 20% → Growth fund (marketing, tools, runway)
```

**Why 50% to hiring?** Contractors cost $25-75/hr. You need runway to:
- Hire a part-time support person ($500-1500/mo)
- Hire a developer for features ($2000-5000/mo)
- Have 2-3 months of their pay saved up before hiring

### When Can You Hire?

| Role | Cost | Revenue Needed | Your Time Saved |
|------|------|----------------|-----------------|
| Support (part-time VA) | $500-800/mo | $2,000/mo | 10-15 hrs/week |
| Developer (contractor) | $2,000-4,000/mo | $6,000/mo | 15-20 hrs/week |
| Operations manager | $3,000-5,000/mo | $10,000/mo | 20+ hrs/week |

**First hire recommendation:** Part-time VA for customer support. Biggest time sink, easiest to delegate.

### Adjusted Draw Strategy

**Phase 1: Pre-Revenue / Early ($0-2k/mo)**
- Take: 20-30% of profit (just enough to stay motivated)
- Hiring fund: 50%
- Buffer: 20-30%
- **Your time:** 15-20 hrs/week (building)

**Phase 2: First Customers ($2k-5k/mo)**
- Take: 30% of profit
- Hiring fund: 50% → Hire support VA
- Buffer/growth: 20%
- **Your time:** 10-15 hrs/week (VA handles support)

**Phase 3: Growing ($5k-10k/mo)**
- Take: 30-40% of profit
- Hiring fund: 40% → Add part-time dev
- Growth: 20%
- **Your time:** 5-10 hrs/week (strategy only)

**Phase 4: Scaled ($10k+/mo)**
- Take: 40-50% of profit
- Team costs: 30-40%
- Growth: 10-20%
- **Your time:** 5 hrs/week (CEO role - decisions only)

### Realistic Timeline to 5 hrs/week

| Revenue | Timeline | Your Role |
|---------|----------|-----------|
| $0-2k/mo | Months 1-6 | Everything (founder mode) |
| $2-5k/mo | Months 6-12 | Hire VA, stop doing support |
| $5-10k/mo | Year 1-2 | Hire dev, stop doing features |
| $10k+/mo | Year 2+ | Strategy only, 5 hrs/week |

### What 5 hrs/week Looks Like

When you're there, your week is:
- **Monday (1 hr):** Review metrics, check Slack from team
- **Wednesday (2 hrs):** Weekly call with team, make decisions
- **Friday (2 hrs):** Review finances, plan next week, strategic thinking

Everything else is handled by:
- VA: Customer support, onboarding help, email
- Developer: Bug fixes, new features, deployments
- You: Direction, big decisions, relationships

### Contractor vs Employee

**Start with contractors:**
- No payroll taxes
- No benefits to provide
- Easy to scale up/down
- Pay per hour or per project

**Consider employees when:**
- Need someone 30+ hrs/week consistently
- Want more control/loyalty
- Revenue exceeds $15-20k/mo
- Ready for payroll complexity

### Where to Find Good Contractors

| Role | Where to Look | Budget |
|------|---------------|--------|
| Support VA | Belay, Time Etc, Upwork | $15-25/hr |
| Developer | Toptal, Gun.io, referrals | $50-150/hr |
| Designer | Dribbble, 99designs | $50-100/hr |
| Marketing | Mayple, MarketerHire | $50-100/hr |

### What "Profit" Actually Means

```
Gross Revenue:     $5,000  (what Stripe deposits)
- Stripe Fees:       -$145  (2.9% + $0.30 per transaction)
- Services:          -$140  (Railway, Vercel, Resend, etc.)
- Contractors:         $0  (if any)
────────────────────────────
Net Profit:        $4,715  ← This is what you can distribute
```

### The 30% Tax Reserve (Critical!)

This is non-negotiable. Set aside 30% of net profit for taxes BEFORE calculating what you can take.

**Why 30%?**
- Federal income tax: 12-22% (depends on your bracket)
- Minnesota state tax: 5.35-9.85%
- Self-employment tax: 15.3% (but only on 92.35% of profit)
- Combined effective: Usually 25-35%

**30% is safe.** If you end up owing less, nice surprise. If you owe more, you're not scrambling.

**Where to put it:** Open a savings account at the same bank. Transfer tax reserve there monthly. Don't touch it until quarterly estimate payments are due.

### Cash Buffer Guidelines

Keep this much in Keepr LLC's account at all times:

| Monthly Expenses | Buffer to Keep |
|------------------|----------------|
| $100-300/mo | $500-800 (2-3 months) |
| $300-500/mo | $800-1,500 (2-3 months) |
| $500-1,000/mo | $1,500-3,000 (2-3 months) |

This covers slow months, unexpected costs, or customers requesting refunds.

### Realistic Scenarios

**Scenario 1: Side Project ($500/mo revenue)**
```
Revenue:           $500
- Expenses:        -$100
- Stripe fees:      -$15
= Net Profit:       $385
- Tax reserve:     -$115 (30%)
- Buffer contrib:   -$50 (building up)
= You take:         $220
```
That's $220/month in your pocket. Not life-changing, but real money.

**Scenario 2: Growing ($3,000/mo revenue)**
```
Revenue:         $3,000
- Expenses:        -$150
- Stripe fees:      -$90
= Net Profit:     $2,760
- Tax reserve:     -$830 (30%)
- Buffer:            $0 (already have enough)
= You take:       $1,930
```
$1,930/month = $23k/year extra income.

**Scenario 3: Real Business ($10,000/mo revenue)**
```
Revenue:        $10,000
- Expenses:        -$300
- Stripe fees:     -$300
= Net Profit:     $9,400
- Tax reserve:   -$2,820 (30%)
- Buffer:            $0
= You take:       $6,580
```
$6,580/month = $79k/year. That's a real salary.

### Owner's Draw vs. Salary

**Option A: Simple Owner's Draw (Recommended to Start)**

Just transfer money when you need it:

```
Keepr LLC  ──►  Holdings LLC  ──►  Personal Account
```

- No payroll to run
- No payroll taxes to calculate
- Just regular bank transfers
- Pay quarterly estimated taxes yourself

**Option B: Salary (Later, If Profitable)**

If Keepr makes $50k+ profit/year, consider S-Corp election:

1. Holdings elects S-Corp tax status
2. You become an "employee" of Holdings
3. Pay yourself a reasonable salary (with payroll taxes)
4. Take remaining profit as distributions (no payroll tax)
5. **Saves money on self-employment tax**

This is complex - get an accountant when you reach this point.

### Frequency: How Often to Take Money

| Approach | Pros | Cons |
|----------|------|------|
| **Weekly** | Steady personal cash flow | More transfers to track |
| **Bi-weekly** | Feels like a "paycheck" | Moderate tracking |
| **Monthly** | Easy to track, see full picture | Wait longer for money |
| **As needed** | Flexible | Can lose track of what you've taken |

**Recommendation:** Monthly. At the end of each month:
1. Review revenue and expenses
2. Calculate net profit
3. Transfer 30% to tax savings
4. Transfer remaining to Holdings → Personal

### Don't Forget: The Transfer Path

Money always flows:

```
Keepr LLC → Holdings LLC → Personal
```

Never go directly from Keepr → Personal. Going through Holdings maintains the corporate structure that protects you.

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
