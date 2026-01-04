# Go-To-Market Metrics Dashboard

## Overview

This document defines the key metrics for tracking Keepr's go-to-market performance. Use this as a guide for building internal dashboards and reporting.

---

## Metric Categories

### 1. Awareness Metrics

Track how many potential customers are discovering Keepr.

| Metric | Definition | Target | Tracking Source |
|--------|------------|--------|-----------------|
| **Website Visitors** | Unique visitors per month | 5,000+ | Google Analytics |
| **Organic Traffic** | Visitors from search engines | 2,000+ | Google Analytics |
| **Blog Pageviews** | Views on blog content | 1,000+ | Google Analytics |
| **Social Impressions** | LinkedIn + Twitter reach | 50,000+ | Native analytics |
| **Direct Traffic** | Brand searches/direct visits | 500+ | Google Analytics |

**Key Ratios:**
- Organic % of total traffic (target: 40%+)
- Blog % of total traffic (target: 20%+)

---

### 2. Engagement Metrics

Track how visitors interact with content.

| Metric | Definition | Target | Tracking Source |
|--------|------------|--------|-----------------|
| **Time on Site** | Average session duration | 2:30+ | Google Analytics |
| **Pages per Session** | Average pages viewed | 2.5+ | Google Analytics |
| **Bounce Rate** | Single-page sessions | <60% | Google Analytics |
| **Newsletter Signups** | Email list growth | 100+/mo | Email platform |
| **Demo Page Visits** | Visitors to /demo | 500+/mo | Google Analytics |
| **Pricing Page Visits** | Visitors to /pricing | 300+/mo | Google Analytics |
| **ROI Calculator Uses** | Completed calculations | 100+/mo | Custom event |

**Key Ratios:**
- Demo page visit rate (demo visits / total visitors)
- Pricing page visit rate

---

### 3. Lead Metrics

Track potential customer generation.

| Metric | Definition | Target | Tracking Source |
|--------|------------|--------|-----------------|
| **Total Leads** | All form submissions | 50+/mo | CRM |
| **Demo Requests** | Demo form submissions | 20+/mo | CRM |
| **Email Signups** | Newsletter + gated content | 30+/mo | Email platform |
| **Contact Form** | General inquiries | 10+/mo | CRM |
| **Inbound Calls** | Phone inquiries | 5+/mo | Phone system |

**Lead Sources (Track %):**
- Organic search
- Direct
- Social media
- Email campaigns
- Paid (if applicable)
- Referral

**Lead Quality Indicators:**
- Park size mentioned
- Current software mentioned
- Timeline mentioned
- Budget/pricing questions

---

### 4. Conversion Metrics

Track lead-to-customer progression.

| Metric | Definition | Target | Tracking Source |
|--------|------------|--------|-----------------|
| **Demo Scheduled** | Leads that book a demo | 50% of demo requests | CRM |
| **Demo Completed** | Demos actually held | 75% of scheduled | CRM |
| **Trial Started** | Started using product | 40% of demos | Product |
| **Converted to Paid** | Became paying customer | 30% of trials | Stripe |
| **Sales Cycle Length** | Days from lead to close | <30 days | CRM |

**Conversion Funnel:**
```
Website Visitor
     |
     v (X% convert)
Lead (form submission)
     |
     v (50% convert)
Demo Scheduled
     |
     v (75% complete)
Demo Completed
     |
     v (40% convert)
Trial Started
     |
     v (30% convert)
Paying Customer
```

---

### 5. Revenue Metrics

Track financial performance.

| Metric | Definition | Target | Tracking Source |
|--------|------------|--------|-----------------|
| **MRR** | Monthly Recurring Revenue | Growing 15%/mo | Stripe |
| **New MRR** | MRR from new customers | Track | Stripe |
| **Expansion MRR** | MRR from upsells | Track | Stripe |
| **Churned MRR** | MRR lost to cancellations | <5% of MRR | Stripe |
| **Net New MRR** | New + Expansion - Churned | Growing | Stripe |
| **ARPU** | Average Revenue Per User | $400+ | Stripe |
| **LTV** | Lifetime Value | $10,000+ | Calculated |
| **CAC** | Customer Acquisition Cost | <$500 | Calculated |
| **LTV:CAC Ratio** | Payback efficiency | >3:1 | Calculated |

**Revenue Breakdown:**
- Base subscription ($100)
- Per-booking fees
- Add-on services

---

### 6. Customer Health Metrics

Track existing customer engagement.

| Metric | Definition | Target | Tracking Source |
|--------|------------|--------|-----------------|
| **Monthly Active Users** | Users logging in monthly | 90%+ | Product |
| **Feature Adoption** | % using key features | Track per feature | Product |
| **Support Tickets** | Tickets per customer/month | <1 | Support system |
| **NPS Score** | Net Promoter Score | 50+ | Survey |
| **Churn Rate** | Customers canceling | <3%/mo | Stripe |
| **Expansion Rate** | Customers upgrading | Track | Stripe |

**Key Features to Track Adoption:**
- Online booking enabled
- Dynamic pricing active
- AI recommendations viewed
- Staff scheduling used
- POS transactions processed
- Automated emails configured

---

## Dashboard Views

### Executive Dashboard (Weekly)

**Summary Cards:**
- MRR (with trend)
- New customers this month
- Active trials
- Pipeline value

**Charts:**
- MRR trend (12-month)
- New leads by week
- Conversion funnel
- Customer growth

### Marketing Dashboard (Daily/Weekly)

**Summary Cards:**
- Website visitors (7-day)
- Leads generated (7-day)
- Demo requests (7-day)
- Top traffic source

**Charts:**
- Traffic by source
- Blog performance
- Landing page conversions
- Lead source breakdown

### Sales Dashboard (Daily)

**Summary Cards:**
- Open opportunities
- Demos scheduled this week
- Trials expiring soon
- Pipeline value

**Tables:**
- Active leads (sorted by last activity)
- Upcoming demos
- Trials in progress
- Recently closed (won/lost)

### Product Dashboard (Weekly)

**Summary Cards:**
- Active users (30-day)
- Feature adoption score
- Support ticket volume
- NPS score

**Charts:**
- Usage trend
- Feature adoption heatmap
- Support categories
- Churn risk indicators

---

## Reporting Cadence

### Daily Standup Metrics
- Leads generated
- Demos scheduled
- Active trials
- Any urgent issues

### Weekly Review Metrics
- Full funnel review
- Traffic and content performance
- Pipeline review
- Customer health check

### Monthly Business Review
- MRR analysis
- CAC/LTV calculations
- Churn analysis
- Competitive landscape
- Content performance deep-dive

### Quarterly Strategy Review
- Market analysis
- Pricing review
- Feature prioritization based on adoption
- GTM strategy adjustments

---

## Data Sources Integration

| Source | Data Type | Integration |
|--------|-----------|-------------|
| **Google Analytics** | Website traffic, behavior | GA4 API |
| **Stripe** | Revenue, subscriptions | Stripe API |
| **CRM (HubSpot/Pipedrive)** | Leads, opportunities | Native API |
| **Email Platform** | Newsletter metrics | Provider API |
| **Product Database** | Usage metrics | Prisma/SQL |
| **Support System** | Ticket data | Provider API |

---

## Alerts and Thresholds

### Red Alerts (Immediate Action)
- Churn rate >5% in a month
- Demo no-show rate >40%
- Support ticket spike (3x normal)
- Revenue decline month-over-month

### Yellow Alerts (Monitor Closely)
- Lead volume down 20% week-over-week
- Conversion rate down 10%
- NPS below 40
- Trial conversion below 20%

### Green Indicators (Celebrate)
- Hit MRR milestone
- 30-day churn-free streak
- NPS above 70
- Case study published

---

## Calculation Formulas

### Customer Acquisition Cost (CAC)
```
CAC = (Marketing Spend + Sales Spend) / New Customers
```

### Lifetime Value (LTV)
```
LTV = ARPU x Gross Margin % x (1 / Monthly Churn Rate)
```

### LTV:CAC Ratio
```
LTV:CAC = LTV / CAC
Target: >3:1
```

### Net Revenue Retention
```
NRR = (Starting MRR + Expansion - Churn) / Starting MRR
Target: >100%
```

### Lead Velocity Rate
```
LVR = (Leads This Month - Leads Last Month) / Leads Last Month
Target: >10% growth
```

---

## Tool Recommendations

### Analytics
- **Google Analytics 4** - Website behavior
- **Mixpanel/Amplitude** - Product analytics
- **Hotjar** - User session recording

### CRM
- **HubSpot Free** - Starting out
- **Pipedrive** - Sales-focused
- **Close.com** - Outbound-focused

### Dashboard
- **Metabase** - Open source, SQL-based
- **Geckoboard** - Simple TV dashboards
- **Looker** - Enterprise-grade

### Revenue
- **Stripe Dashboard** - Native Stripe
- **ChartMogul** - Subscription analytics
- **ProfitWell** - Free for Stripe users

---

## Implementation Checklist

- [ ] Set up Google Analytics 4 with enhanced tracking
- [ ] Implement UTM parameters for all campaigns
- [ ] Configure goal/event tracking for key actions
- [ ] Set up CRM and integrate with forms
- [ ] Create Stripe webhook for revenue tracking
- [ ] Build product usage tracking
- [ ] Set up automated weekly email reports
- [ ] Create executive dashboard view
- [ ] Document all metric definitions
- [ ] Train team on dashboard usage
