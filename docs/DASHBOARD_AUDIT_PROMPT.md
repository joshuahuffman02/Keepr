# Dashboard UI/UX Audit Prompt

Copy this entire prompt into a new Claude Code terminal.

---

## The Prompt

You are conducting a comprehensive UI/UX audit of the Keepr campground management dashboard. This is the staff-facing interface used by campground owners, managers, and front desk employees.

### Phase 1: Discovery & Audit

First, discover ALL dashboard pages and audit each one systematically.

**Find all dashboard pages:**

```bash
find platform/apps/web/app -type f -name "page.tsx" | grep -v "\(public\)" | sort
```

**For EACH page, evaluate:**

1. **Design Consistency**
   - Does it use the standard page layout pattern? (header, content area, consistent spacing)
   - Are buttons styled consistently? (primary = keepr-evergreen, secondary = outline, destructive = red)
   - Are cards using consistent padding, borders, and shadows?
   - Is typography consistent? (headings, body text, labels)
   - Are icons from Lucide and used consistently?
   - Are colors from the design system? (keepr-evergreen, keepr-clay, etc.)

2. **Accessibility (WCAG 2.1 AA)**
   - Do all interactive elements have visible focus states?
   - Are form inputs properly labeled with `<label>` or `aria-label`?
   - Do buttons have accessible names?
   - Is color contrast sufficient (4.5:1 for text)?
   - Can the page be navigated with keyboard only?
   - Are error messages announced to screen readers (`role="alert"`)?
   - Do images have alt text?

3. **UX Patterns**
   - Are loading states shown? (skeletons or spinners)
   - Are empty states helpful? (not just "No data")
   - Are error states clear and actionable?
   - Is form validation inline and immediate?
   - Are destructive actions confirmed?
   - Is navigation intuitive?

4. **Responsive Design**
   - Does it work on tablet (768px)?
   - Are tables scrollable or stack on mobile?
   - Is touch target size adequate (44x44px minimum)?

5. **Code Quality**
   - Is "use client" only where needed?
   - Are components properly typed?
   - Is there dead code or unused imports?

### Phase 2: Document Findings

Create a comprehensive audit document at `docs/DASHBOARD_AUDIT_RESULTS.md` with:

```markdown
# Dashboard Audit Results

## Summary

- Total pages audited: X
- Critical issues: X
- Major issues: X
- Minor issues: X

## Page-by-Page Findings

### /dashboard

**Status:** [Good / Needs Work / Critical]
**Issues:**

- [ ] Issue 1 (severity: critical/major/minor)
- [ ] Issue 2

### /dashboard/reservations

...

## Common Patterns Needing Fix

1. Pattern A appears on X pages
2. Pattern B appears on Y pages

## Priority Fix Order

1. Critical accessibility issues
2. Broken functionality
3. Inconsistent patterns
4. Polish items
```

### Phase 3: Fix Issues

Work through fixes in priority order:

1. **Critical First** - Accessibility blockers, broken functionality
2. **High Impact** - Issues appearing on multiple pages (fix once, apply everywhere)
3. **Page by Page** - Remaining issues

**Fix Patterns:**

For consistency issues, check existing well-designed pages as reference:

- `platform/apps/web/app/dashboard/page.tsx` - Main dashboard
- `platform/apps/web/components/ui/` - UI primitives

For accessibility:

- Add `aria-label` to icon-only buttons
- Ensure all form fields have labels
- Add `role="alert"` to error messages
- Check focus states on interactive elements

**After each fix:**

- Run `pnpm build:web` to verify no errors
- Mark the issue as complete in your audit document

### Dashboard Pages to Audit

Based on the codebase structure, audit these areas:

```
/dashboard                    - Main dashboard/overview
/dashboard/reservations       - Reservation list & management
/dashboard/reservations/[id]  - Single reservation detail
/dashboard/guests             - Guest management
/dashboard/sites              - Site/unit management
/dashboard/site-classes       - Site class configuration
/dashboard/calendar           - Availability calendar
/dashboard/rates              - Rate management
/dashboard/reports            - Reporting
/dashboard/settings           - Campground settings
/dashboard/staff              - Staff management
/dashboard/pos                - Point of sale
/dashboard/store              - Store/inventory
/dashboard/housekeeping       - Housekeeping tasks
/dashboard/maintenance        - Maintenance tickets
/dashboard/payments           - Payment management
/dashboard/accounting         - Accounting/ledger
```

### Reference: Design System

**Colors:**

- Primary: `keepr-evergreen` (#1B4D3E)
- Accent: `keepr-clay` (#C67B5C)
- Background: `background` / `card` / `muted`
- Text: `foreground` / `muted-foreground`

**Spacing:**

- Page padding: `px-6 py-8` or `p-6`
- Card padding: `p-6`
- Stack spacing: `space-y-4` or `space-y-6`
- Grid gaps: `gap-4` or `gap-6`

**Typography:**

- Page titles: `text-2xl font-bold`
- Section headings: `text-lg font-semibold`
- Body: `text-sm` or `text-base`
- Muted: `text-muted-foreground`

**Components:**

- Buttons: Use `<Button>` from `@/components/ui/button`
- Cards: Use `<Card>` from `@/components/ui/card`
- Forms: Use `<Input>`, `<Select>`, `<Label>` from ui components
- Tables: Use `<Table>` components or consistent styling

### Success Criteria

The audit is complete when:

- [ ] All dashboard pages have been reviewed
- [ ] Findings are documented in `docs/DASHBOARD_AUDIT_RESULTS.md`
- [ ] Critical and major issues are fixed
- [ ] `pnpm build:web` passes
- [ ] Common patterns are consistent across pages

Start with Phase 1 now. Use the TodoWrite tool to track your progress through each page.
