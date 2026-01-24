# Release Notes Guide

## Overview

The Campreserv release notes system provides a professional, structured way to communicate product updates to users. The system is designed to match industry standards set by platforms like Cloudbeds while being tailored for campground management software.

**Live Page:** `/updates`

## Key Features

### 1. Professional Categorization

Each update can be tagged with a **type** badge:

- **New** - Brand new features or capabilities
- **Update** - Modifications to existing features
- **Enhancement** - Improvements to existing functionality
- **Fix** - Bug fixes and corrections

These appear as prominent badges at the top of each update card.

### 2. Rich Content Structure

Updates support detailed information sections:

- **What Changed** - Technical details of the change
- **Why It Matters** - Business impact and value
- **Who It Helps** - Target user roles (managers, front desk, maintenance, etc.)

### 3. Visual Support

- **Screenshots** - Include images to show UI changes
- **Demo Videos** - Link to video demonstrations of major features

### 4. Smart Organization

- **Monthly Grouping** - Updates automatically group by month with visual separators
- **Timeline View** - Chronological display with connecting lines
- **Type Filtering** - Filter by New, Update, Enhancement, or Fix
- **Phase Linking** - Each update links to its roadmap phase

### 5. Metadata

- Version numbers (e.g., v1.2.0)
- Clear dates with calendar icon
- Category badges (Feature, Improvement, Bug Fix, Infrastructure)
- Searchable tags

## How to Add a Release Note

### Location

Edit: `/Users/josh/Documents/GitHub/Campreserv (broken) copy/platform/apps/web/lib/roadmap-data.ts`

### Basic Structure

```typescript
{
    id: 'update-2026-01-15-feature-name',
    title: 'Feature Title',
    date: '2026-01-15',
    version: '1.3.0', // Optional
    type: 'new', // 'new' | 'update' | 'enhancement' | 'fix'
    body: 'Brief overview of the update.',
    tags: ['tag1', 'tag2'],
    category: 'feature', // 'feature' | 'improvement' | 'bugfix' | 'infrastructure'
    phaseId: 'foundation', // Roadmap phase ID
    milestoneIds: [], // Related milestone IDs
}
```

### Enhanced Structure (Recommended)

```typescript
{
    id: 'update-2026-01-15-dynamic-pricing-enhancements',
    title: 'Enhanced Dynamic Pricing Rules',
    date: '2026-01-15',
    version: '1.3.0',
    type: 'enhancement',
    body: 'Introduced advanced pricing rules with weather-based adjustments and event-driven pricing.',
    whatChanged: 'Added support for weather API integration, local event calendar sync, and competitor price monitoring. Pricing rules can now automatically adjust based on forecasted weather and nearby events.',
    whyItMatters: 'Maximize revenue during high-demand periods without manual intervention. Weather-based pricing can increase occupancy on sunny weekends by 15-20% according to industry data.',
    whoItHelps: 'Campground owners and revenue managers who want to optimize pricing strategy without constant monitoring.',
    screenshot: '/images/updates/dynamic-pricing-1.3.0.png', // Optional
    videoUrl: 'https://youtu.be/example', // Optional
    tags: ['pricing', 'revenue', 'automation', 'ai'],
    category: 'feature',
    phaseId: 'reservations',
    milestoneIds: ['dynamic-pricing'],
}
```

## Best Practices

### Writing Update Titles

- Be specific and action-oriented
- Include the feature name
- Keep under 80 characters

**Good:** "Real-time Pricing in Booking Sidebar"
**Bad:** "Updates to pricing"

### Writing Body Content

- Start with what shipped
- Use active voice
- Include concrete details (numbers, capabilities)

### What Changed Section

- Focus on the technical change
- List specific capabilities added
- Mention removed or changed behavior

### Why It Matters Section

- Explain business value
- Include metrics if available
- Connect to user pain points

### Who It Helps Section

- Be specific about user roles
- Mention workflows or tasks affected
- Consider both direct and indirect beneficiaries

**Examples:**

- "Front desk staff making reservations and guests using the booking engine."
- "Maintenance staff and managers tracking facility issues."
- "Owners and revenue managers optimizing pricing strategies."

## Update Types Guide

### New (type: 'new')

Use for:

- Brand new features never before available
- Major capabilities that unlock new workflows
- New integrations or modules

**Example:** First-time launch of a public API, charity round-up at checkout, QR code check-in

### Update (type: 'update')

Use for:

- Changes to existing features
- Functionality replacements
- API or data model changes

**Example:** Switched from placeholder pricing to real API calls, updated payment flow

### Enhancement (type: 'enhancement')

Use for:

- Improvements to existing features
- UX polish and usability gains
- Performance optimizations

**Example:** Added quick action buttons, improved mobile layout, faster report generation

### Fix (type: 'fix')

Use for:

- Bug fixes
- Security patches
- Data correction issues

**Example:** Fixed 403 error on renewal buttons, corrected tax calculation rounding

## Category Guide

### Feature (category: 'feature')

Major product capabilities, typically user-facing.

### Improvement (category: 'improvement')

Enhancements to existing features, UX polish, workflow optimizations.

### Bug Fix (category: 'bugfix')

Corrections to defects, unexpected behavior, or security issues.

### Infrastructure (category: 'infrastructure')

Backend improvements, performance, scaling, reliability, build/deploy changes.

## Adding Screenshots

### Recommended Size

- Width: 1200-1600px
- Format: PNG or JPG
- Optimize for web (use tools like TinyPNG)

### Location

Store in: `/public/images/updates/`

### Naming Convention

`feature-name-version.png`

Example: `dynamic-pricing-1.3.0.png`

### In Update Object

```typescript
screenshot: "/images/updates/dynamic-pricing-1.3.0.png";
```

## Adding Demo Videos

### Recommended Platforms

- YouTube (unlisted or public)
- Loom
- Vimeo

### Best Practices

- Keep under 2 minutes
- Show before/after if relevant
- Include voiceover or captions
- Focus on the "why" not just "how"

### In Update Object

```typescript
videoUrl: "https://youtu.be/abc123xyz";
```

## Timeline and Versioning

### Version Numbers

Use semantic versioning:

- Major: Breaking changes (2.0.0)
- Minor: New features (1.3.0)
- Patch: Bug fixes (1.2.1)

### Update Frequency

Aim for:

- Weekly for small improvements and fixes
- Bi-weekly for feature releases
- Monthly for major platform updates

### Communication Rhythm

- Updates appear on `/updates` immediately
- Monthly summary email to subscribers
- Quarterly "What's New" highlight in login screen

## SEO and Discoverability

### Tags Strategy

Use 3-6 tags per update:

- Feature area (booking, pricing, maintenance)
- User role (manager, staff, guest)
- Technology (api, mobile, ai)
- Initiative (automation, ux, compliance)

### Link to Roadmap

Always link updates to roadmap phases using `phaseId`. This creates a narrative from planning to delivery.

## Maintenance

### Keep It Current

- Add updates within 24 hours of shipping
- Don't batch updates (ship as you go)
- Archive updates older than 2 years to a separate page

### Update Existing Entries

If a feature ships in phases, add follow-up updates rather than editing the original.

**Example:**

- Dec 10: "Charity Round-Up - Planning"
- Dec 17: "Charity Round-Up - Complete"

## Examples from Cloudbeds

Campreserv's release notes structure is inspired by Cloudbeds product updates. Key patterns:

- **Explainability:** "See the reasoning behind the rates in Revenue Intelligence"
- **Impact:** "Boost your advertising performance!"
- **Specificity:** "Cloudbeds Payments Thailand customers can now receive daily payouts"
- **Integration depth:** "Process payments automatically for even more channels"

See `/docs/cloudbeds-product-updates-audit.md` for the full analysis.

## Checklist Before Publishing

- [ ] Title is clear and specific
- [ ] Date is correct (YYYY-MM-DD format)
- [ ] Type badge is appropriate (new/update/enhancement/fix)
- [ ] Category is correct
- [ ] All three sections filled (What Changed, Why It Matters, Who It Helps)
- [ ] Tags are relevant and concise
- [ ] Links to correct roadmap phase
- [ ] Screenshot is optimized (if included)
- [ ] Video is accessible and short (if included)
- [ ] Proofread for typos and clarity

## Future Enhancements

Planned improvements to the release notes system:

- [ ] Email subscription integration (capture + send)
- [ ] RSS feed for updates
- [ ] In-app notification on new updates
- [ ] Search/filter by tag
- [ ] "Mark as read" functionality for logged-in users
- [ ] Related updates suggestions
- [ ] Changelog export to PDF/Markdown

---

**Questions?** Contact the product team or open an issue in the repo.
