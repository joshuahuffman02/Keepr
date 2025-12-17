# Design Tokens - Color System

This document explains the standardized color token system for the Campreserv platform.

## Overview

We use semantic color tokens to ensure consistent color usage across the application. These tokens are defined as CSS variables in `app/globals.css` and exposed through Tailwind's color system in `tailwind.config.ts`.

## Why Use Design Tokens?

- **Consistency**: Same colors used for the same purposes throughout the app
- **Maintainability**: Change colors in one place, updates everywhere
- **Dark mode support**: Built-in support for light and dark themes
- **Semantic meaning**: Colors communicate purpose, not just aesthetics
- **Developer experience**: Clear naming makes it obvious which color to use

## Color Token Categories

### 1. Action Tokens

Use these for interactive elements like buttons, links, and CTAs.

| Token | Usage | Tailwind Classes | Color Value |
|-------|-------|-----------------|-------------|
| `action-primary` | Main CTA buttons, primary actions | `bg-action-primary`, `text-action-primary` | emerald-600 |
| `action-primary-foreground` | Text on primary action backgrounds | `text-action-primary-foreground` | white |
| `action-primary-hover` | Hover state for primary actions | `hover:bg-action-primary-hover` | emerald-700 |
| `action-secondary` | Secondary buttons, less prominent actions | `bg-action-secondary` | slate-100 |
| `action-secondary-foreground` | Text on secondary action backgrounds | `text-action-secondary-foreground` | slate-900 |
| `action-secondary-hover` | Hover state for secondary actions | `hover:bg-action-secondary-hover` | slate-200 |

**Examples:**
```tsx
// Primary button
<button className="bg-action-primary text-action-primary-foreground hover:bg-action-primary-hover">
  Create Reservation
</button>

// Primary link
<a href="/reservations" className="text-action-primary hover:text-action-primary-hover">
  View all
</a>

// Secondary button
<button className="bg-action-secondary text-action-secondary-foreground hover:bg-action-secondary-hover">
  Cancel
</button>
```

### 2. Status Tokens

Use these for status indicators, alerts, badges, and feedback messages.

#### Success Status
For successful operations, confirmed states, positive indicators.

| Token | Usage | Tailwind Classes | Color Value |
|-------|-------|-----------------|-------------|
| `status-success` | Success indicators, positive states | `bg-status-success`, `text-status-success` | emerald-600 |
| `status-success-foreground` | Text on success backgrounds | `text-status-success-foreground` | white |
| `status-success-bg` | Light background for success messages | `bg-status-success-bg` | emerald-50 |
| `status-success-border` | Borders for success elements | `border-status-success-border` | emerald-200 |

**Example:**
```tsx
// Success message
<div className="bg-status-success-bg border border-status-success-border text-status-success p-4 rounded">
  Reservation confirmed successfully!
</div>

// Success badge
<span className="bg-status-success text-status-success-foreground px-2 py-1 rounded">
  Paid
</span>
```

#### Warning Status
For warnings, items needing attention, balance due, caution states.

| Token | Usage | Tailwind Classes | Color Value |
|-------|-------|-----------------|-------------|
| `status-warning` | Warning indicators, attention needed | `bg-status-warning`, `text-status-warning` | amber-500 |
| `status-warning-foreground` | Text on warning backgrounds | `text-status-warning-foreground` | amber-950 |
| `status-warning-bg` | Light background for warning messages | `bg-status-warning-bg` | amber-50 |
| `status-warning-border` | Borders for warning elements | `border-status-warning-border` | amber-200 |

**Example:**
```tsx
// Balance due warning
<div className="bg-status-warning-bg border border-status-warning-border text-status-warning-foreground p-4 rounded">
  <strong className="text-status-warning">Balance Due:</strong> ${amount}
</div>

// Warning badge
<span className="bg-status-warning-bg text-status-warning border border-status-warning-border px-2 py-1 rounded">
  Attention Needed
</span>
```

#### Error Status
For errors, destructive actions, critical alerts, failed states.

| Token | Usage | Tailwind Classes | Color Value |
|-------|-------|-----------------|-------------|
| `status-error` | Error indicators, destructive actions | `bg-status-error`, `text-status-error` | red-500 |
| `status-error-foreground` | Text on error backgrounds | `text-status-error-foreground` | white |
| `status-error-bg` | Light background for error messages | `bg-status-error-bg` | red-50 |
| `status-error-border` | Borders for error elements | `border-status-error-border` | red-200 |

**Example:**
```tsx
// Error message
<div className="bg-status-error-bg border border-status-error-border text-status-error p-4 rounded">
  Failed to process payment
</div>

// Destructive button
<button className="bg-status-error text-status-error-foreground hover:bg-red-700">
  Delete Reservation
</button>
```

#### Info Status
For informational messages, neutral states, help text.

| Token | Usage | Tailwind Classes | Color Value |
|-------|-------|-----------------|-------------|
| `status-info` | Informational indicators | `bg-status-info`, `text-status-info` | blue-500 |
| `status-info-foreground` | Text on info backgrounds | `text-status-info-foreground` | white |
| `status-info-bg` | Light background for info messages | `bg-status-info-bg` | blue-50 |
| `status-info-border` | Borders for info elements | `border-status-info-border` | blue-200 |

**Example:**
```tsx
// Info message
<div className="bg-status-info-bg border border-status-info-border text-status-info p-4 rounded">
  Check-in starts at 3 PM
</div>
```

## Migration Guide

### When to Use Which Token

**Use `action-primary` for:**
- Main CTA buttons ("New Reservation", "Save", "Submit")
- Primary action links
- Confirmation buttons

**Use `status-success` for:**
- Paid badges
- Confirmed reservations
- Success messages
- Positive indicators (high occupancy is good)

**Use `status-warning` for:**
- Balance due indicators
- Items needing attention
- Pending states
- Caution messages

**Use `status-error` for:**
- Error messages
- Failed states
- Destructive actions (delete, cancel)
- Critical alerts

**Use `status-info` for:**
- Helpful information
- Neutral badges
- Explanatory text
- General notices

### Replacing Old Color Classes

| Old Class | New Class | Use Case |
|-----------|-----------|----------|
| `bg-emerald-600` | `bg-action-primary` | Primary buttons |
| `text-emerald-600` | `text-action-primary` | Primary links |
| `hover:bg-emerald-700` | `hover:bg-action-primary-hover` | Button hover states |
| `bg-amber-50` | `bg-status-warning-bg` | Warning backgrounds |
| `text-amber-700` | `text-status-warning` | Warning text |
| `border-amber-200` | `border-status-warning-border` | Warning borders |
| `bg-blue-500` | `bg-status-info` | Info badges |
| `bg-red-600` | `bg-status-error` | Error states |

## Examples from Dashboard

### Primary Button
**Before:**
```tsx
<button className="bg-emerald-600 text-white hover:bg-emerald-700">
  New Reservation
</button>
```

**After:**
```tsx
<button className="bg-action-primary text-action-primary-foreground hover:bg-action-primary-hover">
  New Reservation
</button>
```

### Warning Section
**Before:**
```tsx
<div className="bg-amber-50 border-amber-200 text-amber-800">
  <span className="text-amber-700">${balance}</span>
</div>
```

**After:**
```tsx
<div className="bg-status-warning-bg border-status-warning-border text-status-warning-foreground">
  <span className="text-status-warning">${balance}</span>
</div>
```

### Status Badge
**Before:**
```tsx
<span className="bg-amber-100 text-amber-800 border-amber-200">
  {count} open
</span>
```

**After:**
```tsx
<span className="bg-status-warning-bg text-status-warning-foreground border-status-warning-border">
  {count} open
</span>
```

## Best Practices

1. **Always use semantic tokens** instead of direct color utilities (emerald-600, amber-500, etc.)
2. **Use the full token set** - if you use `bg-status-warning-bg`, also use `text-status-warning-foreground` and `border-status-warning-border` for consistency
3. **Think about meaning first** - ask "what does this element communicate?" before choosing a color
4. **Test in dark mode** - tokens automatically support dark mode
5. **Be consistent** - same status = same color across the app

## Component Updates

The following components have been updated to use design tokens:

- `/components/ui/button.tsx` - All button variants use semantic tokens
- `/app/dashboard/page.tsx` - Dashboard uses tokens for status badges, CTAs, and warnings

## Technical Details

### CSS Variables Location
Color tokens are defined in `/app/globals.css` using CSS custom properties with HSL values.

### Tailwind Configuration
Tokens are exposed through Tailwind in `/tailwind.config.ts` as color extensions.

### Dark Mode
Dark mode variants are automatically applied when the `.dark` class is present on a parent element.

---

**Questions?** Reach out to the platform team or open a discussion in #design-system.
