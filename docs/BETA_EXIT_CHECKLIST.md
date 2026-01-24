# Beta Exit Checklist

This document defines triggers and requirements for transitioning Keepr from beta/early access to general availability.

## Transition Triggers

Consider exiting beta when ANY of the following thresholds are reached:

### Customer Metrics

- [ ] 10+ paying customers
- [ ] $1,000+ Monthly Recurring Revenue (MRR)
- [ ] 1,000+ guest records handled

### Business Triggers

- [ ] Public marketing launch planned
- [ ] Third-party integrations relying on Keepr
- [ ] Inbound interest from enterprise customers

### Technical Stability

- [ ] 99%+ uptime over 30-day period
- [ ] Core features (reservations, payments, check-in) stable for 60+ days
- [ ] No critical bugs open for 30+ days

## Pre-Exit Requirements

### Insurance

- [ ] Obtain cyber liability insurance
- [ ] Obtain errors & omissions (E&O) insurance
- [ ] Review coverage limits with broker

### Legal

- [ ] Legal review of ToS and Privacy Policy
- [ ] Update ToS to remove "Beta" language
- [ ] Update Privacy Policy to remove "Early Access Data Practices" section
- [ ] Consider GDPR/CCPA compliance audit

### Technical

- [ ] Remove beta badge from dashboard (`AdminTopBar.tsx`)
- [ ] Remove beta disclaimer from signup page (`signup/page.tsx`)
- [ ] Update welcome page messaging (`welcome/page.tsx`)
- [ ] Review all "Early Access" language in codebase
- [ ] Consider SOC 2 readiness assessment

### Marketing

- [ ] Update homepage messaging
- [ ] Update pricing page (remove "beta pricing" references)
- [ ] Prepare press/launch materials
- [ ] Plan customer communication strategy

### Pricing

- [ ] Define post-beta pricing tiers
- [ ] Grandfather existing early access customers
- [ ] Set up billing migration plan

## Files to Modify at Exit

| File                                                     | Action                                                                  |
| -------------------------------------------------------- | ----------------------------------------------------------------------- |
| `platform/apps/web/app/(public)/terms/page.tsx`          | Remove "Early Access Program" section, update "Limitation of Liability" |
| `platform/apps/web/app/(public)/privacy/page.tsx`        | Remove "Early Access Data Practices" section                            |
| `platform/apps/web/components/ui/layout/AdminTopBar.tsx` | Remove beta badge                                                       |
| `platform/apps/web/app/(public)/signup/page.tsx`         | Remove beta acknowledgment text                                         |
| `platform/apps/web/app/dashboard/welcome/page.tsx`       | Update "Help Shape Keepr" section                                       |

## Communication Plan

### Early Access Customers

1. Notify 30 days before beta exit
2. Confirm locked-in pricing for founding members
3. Provide timeline for any pricing changes

### Public Launch

1. Coordinate marketing campaign
2. Update all public-facing materials
3. Prepare support team for increased volume

## Post-Exit Monitoring

- Monitor support ticket volume
- Track customer satisfaction scores
- Review error rates and uptime
- Schedule quarterly legal/compliance reviews

---

**Last Updated:** January 2025
**Owner:** Founders
**Review Frequency:** Monthly until exit
