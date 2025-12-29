# Autonomous Task Queue - UI/UX Comprehensive Audit

**Owner**: Josh
**Focus**: Complete UI/UX review of all pages, emotional design, navigation, settings pages
**Reference**: https://campreservweb-production.up.railway.app
**Created**: December 29, 2024

---

## Instructions for Claude

Use **ultrathink** for deep analysis on every task. Work through each task sequentially.

For each task:
1. Mark it `[IN PROGRESS]` when starting
2. Analyze thoroughly - look at code, understand patterns, compare to best practices
3. Log findings to the **Findings Log** section below
4. Propose specific improvements with code examples where helpful
5. Mark it `[DONE]` with summary when complete
6. Ask **"Continue to next task? (y/n)"** before proceeding

**For UI changes:**
- Describe the change and show a code snippet
- Wait for "ok" before implementing
- Reference the emotional-engagement and ui-development skills when relevant

**Key Reference Files:**
- Emotional design patterns: Check `.claude/skills/emotional-engagement.md`
- UI patterns: Check `.claude/skills/ui-development.md`
- Existing good example: `/dashboard/settings/central/property/profile` (KOA-inspired)

---

## PHASE 1: DESIGN SYSTEM AUDIT

Establish baseline understanding of current patterns before reviewing pages.

### 1.1 Current Design Tokens
- [ ] **Document color palette** - What colors are used? Are they consistent?
- [ ] **Typography scale** - Font sizes, weights, line heights in use
- [ ] **Spacing system** - Padding/margin patterns (4px, 8px, 16px grid?)
- [ ] **Component inventory** - What UI components exist? Button variants, cards, modals, etc.
- [ ] **Icon usage** - Lucide icons? Consistent sizing and styling?

### 1.2 Emotional Design Patterns (Existing)
- [ ] **Identify pages WITH emotional design** - Which pages have micro-interactions, celebrations, delight moments?
- [ ] **Document the patterns** - What specific techniques are used? (confetti, progress celebrations, helpful empty states, etc.)
- [ ] **Create checklist** - What should every page have for emotional engagement?

### 1.3 Layout Patterns
- [ ] **Page layout consistency** - Header, sidebar, content area patterns
- [ ] **Card layouts** - How are cards used across the app?
- [ ] **Table patterns** - Data tables, sorting, filtering, pagination
- [ ] **Form layouts** - Single column, two column, inline?

---

## PHASE 2: NAVIGATION & INFORMATION ARCHITECTURE

### 2.1 Primary Navigation
- [ ] **Sidebar structure** - Is grouping logical? Are labels clear?
- [ ] **Navigation depth** - How many clicks to common tasks?
- [ ] **Active states** - Is it clear where you are?
- [ ] **Mobile navigation** - Does it work on small screens?

### 2.2 User Flows - Critical Paths
- [ ] **New reservation flow** - From dashboard to confirmed booking
- [ ] **Check-in flow** - Finding guest, processing check-in
- [ ] **Payment collection flow** - Taking a payment at front desk
- [ ] **Settings flow** - Finding and changing a setting

### 2.3 Wayfinding
- [ ] **Breadcrumbs** - Are they used consistently?
- [ ] **Back buttons** - Can users always go back?
- [ ] **Contextual navigation** - Related actions visible where needed?
- [ ] **Search** - Global search? Page-level search?

---

## PHASE 3: SETTINGS PAGES DEEP DIVE

Josh mentioned the KOA-inspired settings page. Audit all settings for consistency.

### 3.1 Central Settings Hub
- [ ] **Review /dashboard/settings/central/property/profile** - Document what makes it good
- [ ] **Left-to-right flow** - How does the layout work? Can it be template?
- [ ] **Compare to other settings pages** - Are they as polished?

### 3.2 Settings Page Inventory
Audit each settings section for consistency with the KOA-inspired pattern:

- [ ] Property Profile settings
- [ ] Booking settings
- [ ] Payment settings
- [ ] Email/notification settings
- [ ] User/staff settings
- [ ] Integration settings
- [ ] Policies settings
- [ ] Tax settings
- [ ] Site class settings
- [ ] Pricing settings

### 3.3 Settings UX Patterns
- [ ] **Save behavior** - Auto-save vs explicit save button?
- [ ] **Validation feedback** - Inline errors? Toast notifications?
- [ ] **Destructive actions** - Confirmation dialogs?
- [ ] **Help text** - Contextual guidance for complex settings?

---

## PHASE 4: PAGE-BY-PAGE AUDIT

Review every major page for UI/UX quality.

### 4.1 Dashboard
- [ ] **First impression** - What do users see? Is it useful?
- [ ] **Data visualization** - Charts clear and meaningful?
- [ ] **Quick actions** - Can users do common tasks from here?
- [ ] **Empty state** - What does a new campground see?
- [ ] **Loading state** - Skeleton loaders? Spinners?

### 4.2 Calendar
- [ ] **Visual clarity** - Can you quickly see availability?
- [ ] **Interaction patterns** - Drag to book? Click behaviors?
- [ ] **Performance** - Does it feel fast with many reservations?
- [ ] **Mobile experience** - Usable on tablet/phone?

### 4.3 Reservations List
- [ ] **Table usability** - Columns useful? Sortable? Filterable?
- [ ] **Search/filter** - Easy to find specific reservations?
- [ ] **Bulk actions** - Can you act on multiple items?
- [ ] **Row actions** - Quick actions without opening detail?

### 4.4 Reservation Detail
- [ ] **Information hierarchy** - Most important info prominent?
- [ ] **Action visibility** - Can you find check-in, payment, etc.?
- [ ] **Edit flow** - Easy to modify reservation?
- [ ] **History/timeline** - Activity log visible?

### 4.5 Guests
- [ ] **Guest list** - Searchable? Filterable?
- [ ] **Guest profile** - Complete view of guest history?
- [ ] **Communication history** - Emails sent visible?
- [ ] **Merge duplicates** - Can you combine duplicate guests?

### 4.6 Sites/Inventory
- [ ] **Site list** - Clear overview of all sites?
- [ ] **Site detail** - Amenities, photos, pricing visible?
- [ ] **Site map** - Visual layout of campground?
- [ ] **Bulk management** - Update multiple sites?

### 4.7 POS/Store
- [ ] **Product browsing** - Easy to find items?
- [ ] **Cart experience** - Clear, fast checkout?
- [ ] **Payment flow** - Smooth tender handling?
- [ ] **Receipts** - Professional looking?

### 4.8 Reports
- [ ] **Report discovery** - Can users find the report they need?
- [ ] **Date range selection** - Easy to set?
- [ ] **Export options** - CSV, PDF, print?
- [ ] **Visualization** - Charts where appropriate?

### 4.9 Operations (Housekeeping/Maintenance)
- [ ] **Task visibility** - Clear what needs to be done?
- [ ] **Status updates** - Easy to mark complete?
- [ ] **Mobile friendly** - Usable on phone while walking around?

### 4.10 Public Booking Page
- [ ] **First impression** - Professional? Trustworthy?
- [ ] **Search experience** - Easy to find available sites?
- [ ] **Booking flow** - Smooth? Clear pricing?
- [ ] **Mobile experience** - Works well on phone?
- [ ] **Confirmation** - Reassuring? Clear next steps?

---

## PHASE 5: EMOTIONAL DESIGN EXPANSION

Identify pages missing emotional design and propose additions.

### 5.1 Celebration Moments
- [ ] **Booking confirmed** - Confetti? Success animation?
- [ ] **Payment successful** - Positive feedback?
- [ ] **Check-in complete** - Welcoming message?
- [ ] **Task completed** - Small reward/feedback?
- [ ] **Goal achieved** - Full occupancy celebration?

### 5.2 Empty States
- [ ] **No reservations yet** - Encouraging, helpful?
- [ ] **No guests** - Guide to first booking?
- [ ] **No reports data** - Explain why, what to do?
- [ ] **Search no results** - Helpful suggestions?

### 5.3 Loading States
- [ ] **Skeleton loaders** - Better than spinners?
- [ ] **Progress indicators** - For long operations?
- [ ] **Optimistic updates** - Feel instant?

### 5.4 Error States
- [ ] **Form errors** - Helpful, not scary?
- [ ] **API errors** - User-friendly messages?
- [ ] **404 pages** - Helpful, on-brand?
- [ ] **Offline state** - Graceful degradation?

### 5.5 Micro-interactions
- [ ] **Button feedback** - Press states, loading?
- [ ] **Hover effects** - Subtle, helpful?
- [ ] **Transitions** - Smooth page/modal transitions?
- [ ] **Pull to refresh** - On mobile views?

---

## PHASE 6: ACCESSIBILITY & POLISH

### 6.1 Keyboard Navigation
- [ ] **Tab order** - Logical flow?
- [ ] **Focus indicators** - Visible on all interactive elements?
- [ ] **Keyboard shortcuts** - For power users?
- [ ] **Skip links** - For screen readers?

### 6.2 Color & Contrast
- [ ] **WCAG compliance** - 4.5:1 contrast ratio?
- [ ] **Color blindness** - Not relying on color alone?
- [ ] **Dark mode** - Supported? Consistent?

### 6.3 Responsive Design
- [ ] **Breakpoints** - Tablet, mobile handled?
- [ ] **Touch targets** - 44px minimum on mobile?
- [ ] **Text sizing** - Readable on all devices?

### 6.4 Performance Perception
- [ ] **Above the fold** - Key content loads first?
- [ ] **Image optimization** - Lazy loading? Proper sizes?
- [ ] **Animation performance** - Smooth 60fps?

---

## PHASE 7: RECOMMENDATIONS & PRIORITIES

### 7.1 Quick Wins
- [ ] **List 5-10 quick fixes** - High impact, low effort
- [ ] **Prioritize by user impact** - What affects daily use most?

### 7.2 Medium Effort Improvements
- [ ] **List improvements needing 1-2 days** - Worth doing before launch

### 7.3 Future Enhancements
- [ ] **Nice-to-haves** - Post-launch polish items
- [ ] **Design system evolution** - Long-term improvements

### 7.4 Create Action Plan
- [ ] **Prioritized list** - What to fix in what order
- [ ] **Estimate effort** - T-shirt sizing (S/M/L)
- [ ] **Dependencies** - What blocks what?

---

## Findings Log

| Date | Task | Finding | Impact | Recommendation |
|------|------|---------|--------|----------------|
| | | | | |

---

## Pages Missing Emotional Design

| Page | Current State | Suggested Additions |
|------|---------------|---------------------|
| | | |

---

## Settings Pages Consistency Matrix

| Settings Page | KOA Layout? | Auto-save? | Help Text? | Mobile OK? | Status |
|---------------|-------------|------------|------------|------------|--------|
| Property Profile | Yes | ? | ? | ? | Reference |
| | | | | | |

---

## Progress Log

| Date | Phase | Task | Summary |
|------|-------|------|---------|
| | | | |

---

## Session Notes

**How to Start:**
```
Read AUTONOMOUS_TASKS_UX.md and work through tasks in order.
Use ultrathink for deep analysis. Reference emotional-engagement and ui-development skills.
Ask y/n before each task. Propose changes before implementing.
```
