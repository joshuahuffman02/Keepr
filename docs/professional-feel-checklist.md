# Professional Feel Checklist (Marketing + Product UX)

Goal: Make Campreserv feel as polished and intuitive as top-tier hospitality platforms.
Scope: Brand, marketing pages, and in-app UX (not tied to any single feature).

Use this as a QA list before launch and as a guiding rubric for new UI work.

## 1) Visual system consistency
- [ ] A defined typography pairing (headline + body) with a documented type scale.
  - NOTE: Only body font is defined in `platform/apps/web/app/globals.css:145`; no documented type scale found.
- [ ] Color tokens for brand, neutrals, semantic states, and data viz.
  - NOTE: Core UI tokens exist, but no data viz palette found in `platform/apps/web/tailwind.config.ts:15`.
- [ ] Consistent spacing scale (4/8/12/16/24/32/48/64).
  - NOTE: Non-scale spacing is used (e.g., `p-5`) in `platform/apps/web/app/booking-lab/page.tsx:668`.
- [x] Grid and container widths defined per breakpoint.
- [ ] Buttons, inputs, tables, cards, modals, and alerts share a single design language.

**Container & Breakpoints:**
- Container: centered, 2rem padding, max-width 1400px at 2xl
- Breakpoints: sm (640px), md (768px), lg (1024px), xl (1280px), 2xl (1536px)

**Design Language Audit Findings:**
INCONSISTENCIES PREVENT COMPLETION - requires standardization:
- Border-radius: button/input use rounded-md (6px), card uses rounded-xl (12px), dialog/alert use rounded-lg (8px)
- Focus rings: button/input use ring-4, table rows use ring-2
- Shadows: card uses shadow, dialog uses shadow-lg, button/input/table/alert have none
- Border colors: mix of explicit border-slate-200 and implicit border

## 2) Navigation and information architecture
- [x] Primary nav groups match how operators think (Bookings, Ops, Guests, Revenue, Integrations).
- [ ] Each section has a clear landing page with a visible next step.
- [ ] Breadcrumbs or clear sub-nav for deep pages.
  - NOTE: Some deep pages lack breadcrumbs (e.g., `platform/apps/web/app/messages/page.tsx`), and multiple breadcrumb components are used (`platform/apps/web/app/finance/page.tsx:8`, `platform/apps/web/app/guests/page.tsx:5`).
- [x] Search is globally available (or obvious per major section).

## 3) Marketing page structure
- [ ] Each product page follows a consistent pattern: hero -> outcomes -> features -> proof -> FAQ -> CTA.
- [ ] Proof blocks (logos, stats, testimonials) appear above the fold or immediately after outcomes.
- [ ] One CTA per page section (no competing CTAs).
- [ ] Resources/FAQ provide just enough depth without burying the core story.

## 4) Copy system (tone, clarity, and intent)
- [ ] Headlines are benefit-first and plain-language.
- [ ] Every feature line answers "so what?" with a concrete operator outcome.
- [ ] Microcopy in forms is precise (what happens next, what is required, why).
- [x] Error messages are actionable (what broke and how to fix it).

## 5) Trust and credibility
- [ ] Visible claims are quantified (saves time, reduces no-shows, increases direct bookings).
- [ ] Security/compliance posture stated plainly (PCI, SOC, GDPR if applicable).
  - NOTE: /security page exists with good content, needs trust badges on marketing pages
- [ ] Partner and integration logos are real and current.
  - NOTE: Using Lucide icons, not real partner logos (Stripe, QuickBooks, etc.)
- [ ] Case studies show measurable results, not just quotes.
  - NOTE: Case studies are mock examples flagged as placeholders in `platform/apps/web/app/(public)/case-studies/CaseStudiesClient.tsx:5`.

## 6) Conversion UX polish
- [ ] All CTAs have a single, predictable flow (no dead ends).
  - NOTE: `/contact` and `/help/contact` links exist but routes are missing.
- [ ] Forms are short, progressive, and include validation feedback.
  - NOTE: Checkout forms excellent (ValidatedFormField), marketing forms need inline validation
- [ ] Live scheduling or demo request feels premium (no generic forms).
  - NOTE: Demo page is visually polished but lacks live calendar (Calendly/HubSpot)
- [ ] Lead capture is tracked end-to-end (GA4, GTM, CRM).
  - NOTE: GA4/Meta config UI exists but scripts not loaded; CRM stubbed

## 7) Product UX intuitiveness
- [x] Default views are useful without configuration.
  - DONE: Dashboard shows arrivals/departures/occupancy/balances immediately
- [ ] Empty states include suggested actions (first booking, import, setup).
  - NOTE: Some boards have suggestions, welcome page separate from dashboard
- [x] Tasks are guided by wizards when they are multi-step.
  - DONE: SessionScheduleWizard, BookingProgressIndicator/Bar are excellent
  - NOTE: Data Import flow could use step indicator
- [ ] Filters are visible, persistent, and show active filter pills.
  - NOTE: FilterChip component exists; pages show counts but not individual removable pills
- [ ] Export is flexible (column pickers, saved presets, CSV/XLSX).
  - NOTE: Exports are CSV/JSON only (e.g., `platform/apps/web/app/campgrounds/[campgroundId]/reservations/page.tsx:1644`).
- [x] Inline help exists for complex forms (tooltips or "Learn more").

## 8) Data clarity and reporting
- [ ] Dashboards answer the top 3 operator questions without drilling.
  - NOTE: Arrivals/departures/balances visible (2.5/3); Revenue metric missing from dashboard
- [ ] Charts have clear labels, units, and date ranges.
  - NOTE: Good formatters for units, but Y-axis labels missing (e.g., "Revenue ($)")
- [x] Reports can be exported without manual copy/paste.
- [x] Audit trails exist for sensitive actions (rates, refunds, policies).
  - DONE: 20 services use audit logging; PaymentAuditLog tracks refunds
  - NOTE: Gaps in permission changes and seasonal rates

## 9) Performance and accessibility
- [ ] Core Web Vitals are in the green for public pages.
  - NOTE: web-vitals.ts monitoring exists but analytics endpoint incomplete (TODO)
- [x] Inputs and tables are keyboard friendly.
- [ ] Contrast and focus states are consistent and visible.
  - NOTE: Focus ring styles vary (ring-4 vs ring-2) between inputs and tables (`platform/apps/web/components/ui/input.tsx:14`, `platform/apps/web/components/ui/table.tsx:74`).
- [x] Motion is purposeful and minimal (avoid gratuitous animation).
  - DONE: 53+ motion-safe: instances, proper reduced motion support throughout

## 10) Release notes and product cadence
- [x] Release notes have "New", "Update", "Enhancement" tags with dates.
- [ ] Each update includes: What changed, Why it matters, Who it helps.
  - NOTE: Only a few updates have these fields; most update entries omit them (e.g., `platform/apps/web/lib/roadmap-data.ts:610`).
- [ ] Major updates include short demo videos or screenshots.
  - NOTE: Updates UI supports media (`platform/apps/web/app/updates/page.tsx:186`), but no `screenshot` or `videoUrl` fields exist in update data (`platform/apps/web/lib/roadmap-data.ts:610`).
- [x] Public roadmap or changelog makes the product feel actively maintained.

## 11) Design QA before shipping
- [ ] Cross-browser check (Chrome, Safari, Firefox).
- [ ] Mobile layout reviewed for every major page.
- [ ] All primary flows tested with real data.
- [ ] No placeholder lorem text or missing images.
  - NOTE: No lorem ipsum found; 5 "coming soon" placeholders remain (Link payment, photos, reviews)

---

## Professional-feel signals from Cloudbeds updates (patterns to emulate)

These update themes create a "serious, mature product" feel:

- Explainable AI (rate recommendations include plain-language rationale and visual drivers).
- Consolidated performance dashboards (ads results merged across channels).
- Reporting upgrades (new data fields, improved export wizard, smarter filters).
- Policy automation (deposits, cancellation fees, auto-collection).
- Ops workflow improvements (document upload to group events).
- Broader integrations (auto-processing payments for more channels).
- Compliance controls (guest requirement enforcement by touchpoint).
- Channel sync controls (availability, rates, restrictions toggles).
- Google listing enhancements (images, rates, policies in listings).
- Review reminders (timely prompts for Airbnb and OTA reviews).

Use these as a checklist for "product maturity signals" in Campreserv.

---

## Color Token System

Campreserv has a well-defined core UI token system built on shadcn/ui with semantic extensions, but still needs a data viz palette.

### Architecture

All color tokens use HSL values with CSS custom properties (--token-name) and are mapped through Tailwind config. This enables:
- Dark mode support (automatic theme switching)
- Consistent color usage across components
- Single source of truth for all UI colors
- Semantic naming that reflects intent, not appearance

### Token Categories

#### 1. Brand Colors

**Primary (Blue)**
- `primary` - hsl(217 91% 60%) - Blue-500 base
- `primary-foreground` - White text on primary background
- Used for: Main brand elements, primary navigation, key CTAs

**Accent (Emerald/Teal)**
- `action-primary` - hsl(158 64% 52%) - Emerald-600
- `action-primary-hover` - hsl(158 64% 42%) - Emerald-700
- Used for: Primary action buttons, main CTAs, success states
- Includes gradient utilities: `gradient-emerald` (emerald to teal)

#### 2. Neutrals

**Backgrounds**
- `background` - hsl(210 40% 98%) - Slate-50 (light) / Slate-900 (dark)
- `foreground` - hsl(222 47% 11%) - Slate-900 (light) / Slate-50 (dark)
- `card` - White (light) / Slate-800 (dark)
- `popover` - White (light) / Slate-800 (dark)

**UI Elements**
- `border` - hsl(214 32% 91%) - Slate-200
- `input` - hsl(214 32% 91%) - Slate-200
- `muted` - hsl(210 40% 96%) - Slate-100
- `muted-foreground` - hsl(215 16% 47%) - Slate-600

**Secondary/Tertiary Actions**
- `secondary` - hsl(210 40% 96%) - Slate-100
- `secondary-foreground` - hsl(222 47% 11%) - Slate-900
- `action-secondary` - Lighter gray for secondary buttons
- `action-secondary-hover` - Slate-200

#### 3. Semantic Status States

Each status has 5 variants for maximum flexibility:
- DEFAULT - Main color
- foreground - Text on colored background
- bg - Light background for badges/pills
- border - Border color for outlined states
- text - Text color on light backgrounds

**Success (Green)**
- `status-success` - hsl(158 64% 52%) - Emerald-600
- `status-success-bg` - hsl(152 57% 96%) - Emerald-50
- `status-success-border` - hsl(149 61% 86%) - Emerald-200
- `status-success-text` - hsl(160 84% 29%) - Emerald-700
- Used for: Confirmed bookings, completed payments, successful operations

**Warning (Amber)**
- `status-warning` - hsl(38 92% 50%) - Amber-500
- `status-warning-bg` - hsl(48 100% 96%) - Amber-50
- `status-warning-border` - hsl(48 96% 76%) - Amber-200
- `status-warning-text` - hsl(26 90% 37%) - Amber-700
- Used for: Balance due, pending actions, attention needed

**Error (Red)**
- `status-error` - hsl(0 84% 60%) - Red-500
- `status-error-bg` - hsl(0 86% 97%) - Red-50
- `status-error-border` - hsl(0 72% 91%) - Red-200
- `status-error-text` - hsl(0 72% 43%) - Red-700
- `destructive` - Same as status-error (legacy shadcn name)
- Used for: Cancellations, failed payments, errors, destructive actions

**Info (Blue)**
- `status-info` - hsl(217 91% 60%) - Blue-500
- `status-info-bg` - hsl(214 100% 97%) - Blue-50
- `status-info-border` - hsl(213 97% 87%) - Blue-200
- `status-info-text` - hsl(221 83% 45%) - Blue-700
- Used for: Informational messages, neutral states, system notifications

#### 4. Data Visualization Colors

Currently using the semantic status palette (success/warning/error/info).

**INCOMPLETE - Needs Expansion:**
- Chart series colors (6-8 distinct, accessible colors)
- Heatmap gradients (low to high)
- Category colors for different data types
- Contrast-tested combinations for overlays

**Recommendation for future expansion:**
- Add Violet, Cyan, Orange, Pink, Indigo for multi-series charts
- Sequential palettes for metrics over time
- Diverging palettes for positive/negative comparisons

### Usage Patterns

**In Tailwind Classes:**
```tsx
<button className="bg-action-primary text-action-primary-foreground hover:bg-action-primary-hover">
  Book Now
</button>

<div className="bg-status-success-bg border border-status-success-border text-status-success-text">
  Confirmed
</div>
```

**In Custom CSS:**
```css
.custom-component {
  background: hsl(var(--status-warning-bg));
  color: hsl(var(--status-warning-text));
}
```

### Special Effects

**Glassmorphism** (matching onboarding UI):
- `.glass` - Semi-transparent white/dark background with backdrop blur
- `.glass-strong` - Stronger blur variant
- `.glass-card` - Complete glass card with border and shadow

**Glow Effects:**
- `.glow-emerald` - Emerald shadow for focus states
- `.hover-glow` - Subtle emerald shadow on hover
- `.focus-glow` - Focus state with emerald glow

### Dark Mode Support

All tokens automatically adjust for dark mode using the `.dark` class. Dark mode values are carefully chosen to maintain:
- WCAG AAA contrast ratios where possible
- Visual hierarchy consistency
- Reduced eye strain (darker backgrounds, adjusted saturation)

### Accessibility

- All color combinations meet WCAG 2.1 AA standards minimum (4.5:1 for normal text)
- Focus states use `ring` token with 2px offset for visibility
- `focus-ring-enhanced` utility provides 4px ring with offset for critical actions
- Semantic colors are consistent: green = success, amber = warning, red = error

### Files

- Token definitions: `/platform/apps/web/app/globals.css` (lines 8-137)
- Tailwind mapping: `/platform/apps/web/tailwind.config.ts` (lines 19-92)

### Gaps to Address

1. **Data visualization palette** - Need dedicated chart colors beyond status states
2. **Brand secondary colors** - Consider adding brand accent variations
3. **Documentation** - Add Storybook or design system site showing all tokens with examples
4. **Validation** - Automated contrast testing in CI/CD
