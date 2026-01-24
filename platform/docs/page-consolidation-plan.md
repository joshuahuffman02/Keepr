# Page Consolidation Plan

## Summary

After auditing all pages at `/all-pages`, I found several categories of issues:

1. **True duplicates** - Pages with overlapping functionality that should be merged
2. **Broken pages** - Pages that exist but have runtime errors
3. **Demo/redirect pages** - Pages that should be real features, not demos

---

## Priority 1: Critical Fixes

### 1.1 `/dashboard/settings/gamification` - BROKEN

**Current State:**

- Page exists (730 lines) with full gamification settings UI
- Flashes on screen then crashes with error
- Imports from `@/lib/gamification/stub-data` and `@/lib/gamification/confetti`

**Problem:** Runtime error causing crash. Need to check browser console for specific error.

**Action:**

```
1. Check browser console for the actual error
2. Likely fix: missing dependency or type error in stub-data.ts
3. Test locally after fix
```

### 1.2 `/ai` - Should be a Real Page, Not a Redirect

**Current State:**

- `/ai` (45 lines) - Just redirects to `/campgrounds/[id]/ai`
- User wants an actual AI assistant page here

**Problem:** No standalone AI page. Just a redirect.

**Action:**

```
1. Create real AI assistant page at /ai
2. Features to include:
   - Chat interface with AI
   - Quick actions (draft replies, pricing suggestions, etc.)
   - Context: current campground, recent activity
3. Keep /campgrounds/[id]/ai for campground-specific AI settings
```

### 1.3 `/campguide` - Demo Page, Not Production-Ready

**Current State:**

- `/campguide` (15KB) - Demo page with mock API calls
- Shows "Demo-safe (mock data)" badge
- Not a real feature, just for showing capability

**Problem:** Listed as a real page but is just a demo.

**Action:**

```
Option A: Remove from navigation/registry until real
Option B: Convert to real AI page (merge with /ai work above)
```

---

## Priority 2: Merge Duplicates

### 2.1 `/help/contact` → Merge into `/tickets`

**Current State:**

- `/help/contact` (237 lines) - Simple form that generates fake ticket ID
- `/tickets` (812 lines) - Full ticket management with voting, status, responses

**Problem:** `/help/contact` creates tickets that go nowhere. Users expect to track them.

**Action:**

```
1. Delete: apps/web/app/help/contact/page.tsx
2. Redirect: /help/contact → /tickets?new=true
3. Add "New Ticket" modal/tab to /tickets page
```

### 2.2 `/events` → Merge into `/activities`

**Current State:**

- `/events` (124 lines) - Basic calendar view with react-big-calendar
- `/activities` (527+ lines) - Full CRUD with capacity, waitlist, sessions

**Problem:** Both manage bookable activities. `/events` is less complete.

**Action:**

```
1. Add calendar view toggle to /activities page
2. Move react-big-calendar code from /events into /activities as a view option
3. Delete: apps/web/app/events/page.tsx
4. Update page-registry.ts: /events → /activities?view=calendar
```

---

## Priority 3: Inventory Consolidation

### 3.1 `/inventory` → Move under `/store`

**Current State:**

- `/inventory` (179 lines) - Standalone inventory page
- `/store/inventory/movements` - Inventory movements log
- `/store/locations/[id]/inventory` - Location-specific inventory

**Problem:** Inventory is split between root-level page and store subsection.

**Action:**

```
1. Rename /inventory → /store/inventory (move file)
2. Update navigation/links
3. Consider making /store/inventory the hub with tabs for:
   - Stock levels (current /inventory content)
   - Movements (/store/inventory/movements)
   - Transfers (/store/transfers)
```

---

## Priority 4: Low Priority / Nice to Have

### 4.1 `/features` + `/all-pages` Overlap

**Current State:**

- `/features` (446 lines) - Track which features you've explored (progress tracking)
- `/all-pages` (417 lines) - Browse and pin pages (navigation)

**Problem:** Similar browsing UI, different data models. Not critical.

**Recommendation:** Keep separate for now. Could merge in future as "Feature Explorer" with:

- Browse mode (current all-pages)
- Progress mode (current features)
- Pinning capability

### 4.2 `/updates` vs `/help/changelog`

**Current State:**

- `/updates` - Product updates timeline
- `/help/changelog` - What's new section

**Problem:** Slight overlap but different contexts. Updates is marketing, changelog is help.

**Recommendation:** Keep both. They serve different user mental models.

---

## Implementation Order

### Phase 1: Quick Wins (1-2 hours)

1. Remove broken registry entries (`/gamification`, `/ai`, `/campguide`)
2. Add redirects from `/help/contact` → `/tickets`

### Phase 2: Merge Events into Activities (2-3 hours)

1. Add view toggle to `/activities`
2. Port calendar from `/events`
3. Delete `/events/page.tsx`

### Phase 3: Inventory Restructure (1-2 hours)

1. Move `/inventory` → `/store/inventory`
2. Update all links

### Phase 4: Feature Explorer (Future)

1. Merge `/features` + `/all-pages` into unified explorer

---

## Files to Modify

### Delete

- `apps/web/app/help/contact/page.tsx` (merge into tickets)
- `apps/web/app/events/page.tsx` (merge into activities)

### Move

- `apps/web/app/inventory/page.tsx` → `apps/web/app/store/inventory/page.tsx`

### Edit

- `apps/web/lib/page-registry.ts` - Remove broken entries
- `apps/web/app/activities/page.tsx` - Add calendar view
- `apps/web/app/tickets/page.tsx` - Add new ticket modal

### Add Redirects

- `/help/contact` → `/tickets?new=true`
- `/events` → `/activities?view=calendar`
- `/inventory` → `/store/inventory`

---

## Notes

- The social-planner/\* pages (9 total) are well-organized and serve distinct purposes
- The portal/\* pages (10 total) are correctly separated for guest-facing vs admin
- The help/\* pages (5 total) are distinct except for /help/contact
- `/tech` page is actually useful (shows system metrics) - keep it
