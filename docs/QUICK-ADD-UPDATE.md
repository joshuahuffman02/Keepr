# Quick Reference: Adding a Release Note

## 1. Open the Data File

```bash
platform/apps/web/lib/roadmap-data.ts
```

## 2. Add to the Top of `updates` Array

```typescript
export const updates: Update[] = [
  {
    // YOUR NEW UPDATE HERE
  },
  // ... existing updates below
];
```

## 3. Copy This Template

```typescript
{
    id: 'update-YYYY-MM-DD-short-name',
    title: 'Feature Name or Change Description',
    date: 'YYYY-MM-DD',
    version: '1.2.3', // OPTIONAL
    type: 'new', // 'new' | 'update' | 'enhancement' | 'fix'
    body: 'One sentence summary of what shipped.',
    whatChanged: 'Technical details of the change.', // OPTIONAL but recommended
    whyItMatters: 'Business value and impact.', // OPTIONAL but recommended
    whoItHelps: 'User roles affected.', // OPTIONAL but recommended
    screenshot: '/images/updates/filename.png', // OPTIONAL
    videoUrl: 'https://youtu.be/...', // OPTIONAL
    tags: ['tag1', 'tag2', 'tag3'],
    category: 'feature', // 'feature' | 'improvement' | 'bugfix' | 'infrastructure'
    phaseId: 'foundation', // See roadmap phases
    milestoneIds: [], // Related milestone IDs
}
```

## 4. Field Reference

### Required Fields

| Field          | Type     | Description        | Example                                |
| -------------- | -------- | ------------------ | -------------------------------------- |
| `id`           | string   | Unique identifier  | `'update-2026-01-15-pricing'`          |
| `title`        | string   | Update headline    | `'Dynamic Pricing Enhancements'`       |
| `date`         | string   | ISO date           | `'2026-01-15'`                         |
| `body`         | string   | Summary            | `'Added weather-based pricing rules.'` |
| `tags`         | string[] | Search tags        | `['pricing', 'automation']`            |
| `category`     | enum     | Update category    | `'feature'`                            |
| `phaseId`      | string   | Roadmap phase      | `'reservations'`                       |
| `milestoneIds` | string[] | Related milestones | `['dynamic-pricing']`                  |

### Optional Fields

| Field          | Description       | When to Use                         |
| -------------- | ----------------- | ----------------------------------- |
| `version`      | Semantic version  | For versioned releases              |
| `type`         | Badge type        | Always (New/Update/Enhancement/Fix) |
| `whatChanged`  | Technical details | For significant changes             |
| `whyItMatters` | Business value    | For significant changes             |
| `whoItHelps`   | Target users      | For significant changes             |
| `screenshot`   | Image path        | For UI changes                      |
| `videoUrl`     | Demo video        | For complex features                |

## 5. Choose the Right Type

| Type            | Use When                  | Example                             |
| --------------- | ------------------------- | ----------------------------------- |
| `'new'`         | Brand new feature         | First-time API launch, new module   |
| `'update'`      | Changed existing feature  | Replaced pricing calc with API      |
| `'enhancement'` | Improved existing feature | Added quick action buttons          |
| `'fix'`         | Bug fix                   | Fixed 403 error, corrected rounding |

## 6. Choose the Right Category

| Category           | Use When                   | Example                          |
| ------------------ | -------------------------- | -------------------------------- |
| `'feature'`        | New user-facing capability | Charity donations, QR codes      |
| `'improvement'`    | UX/workflow enhancement    | Faster reports, better mobile UI |
| `'bugfix'`         | Correction or security fix | Fixed auth error, patched XSS    |
| `'infrastructure'` | Backend/platform work      | Database migration, API perf     |

## 7. Valid Phase IDs

```typescript
"foundation";
"reservations";
"guest-experience";
"payments";
"operational";
"reporting";
"marketing";
"integrations";
"depth";
"advanced";
"ship-readiness";
"stabilize";
"platform-scale";
"charity-roundup";
```

## 8. Example: Simple Update

```typescript
{
    id: 'update-2026-01-20-mobile-calendar',
    title: 'Improved Mobile Calendar View',
    date: '2026-01-20',
    type: 'enhancement',
    body: 'Calendar now responsive on mobile devices with touch gestures.',
    tags: ['mobile', 'calendar', 'ux'],
    category: 'improvement',
    phaseId: 'reservations',
    milestoneIds: ['calendar-view'],
}
```

## 9. Example: Rich Update

```typescript
{
    id: 'update-2026-01-20-guest-portal-v2',
    title: 'Guest Portal 2.0 with Self Check-in',
    date: '2026-01-20',
    version: '2.0.0',
    type: 'new',
    body: 'Completely redesigned guest portal with self-service check-in and mobile key access.',
    whatChanged: 'Rebuilt portal with QR code check-in, digital key generation, and mobile-first design. Supports offline mode and push notifications.',
    whyItMatters: 'Reduces front desk workload by 40% during peak check-in times. Guests can check in from parking lot and go straight to their site.',
    whoItHelps: 'Front desk staff managing arrivals and guests arriving outside office hours.',
    screenshot: '/images/updates/guest-portal-2.0.0.png',
    videoUrl: 'https://youtu.be/abc123',
    tags: ['guest-portal', 'check-in', 'mobile', 'automation'],
    category: 'feature',
    phaseId: 'guest-experience',
    milestoneIds: ['guest-portal', 'self-checkin'],
}
```

## 10. Checklist Before Committing

- [ ] Date is today or recent past (YYYY-MM-DD format)
- [ ] ID is unique (check existing updates)
- [ ] Type badge selected (new/update/enhancement/fix)
- [ ] Category is appropriate
- [ ] Title is clear and under 80 chars
- [ ] Body is one concise sentence
- [ ] If major update: Added whatChanged, whyItMatters, whoItHelps
- [ ] Tags are lowercase and relevant (3-6 tags)
- [ ] PhaseId matches a real roadmap phase
- [ ] Screenshot optimized if included (< 500KB)
- [ ] Video is accessible if included
- [ ] No typos or grammar issues

## 11. Deploy

```bash
# From project root
pnpm build
git add .
git commit -m "Add release note: [title]"
git push
```

Updates appear immediately on `/updates` after deployment.

---

**Need help?** See `/docs/release-notes-guide.md` for full documentation.
