# Help Tooltip System

A comprehensive contextual help system for the Campreserv application, providing inline tooltips and first-time user onboarding hints.

## Overview

The help tooltip system consists of three main components:

1. **HelpTooltip** - Small "?" icons that show contextual help on hover/click
2. **OnboardingHint** - First-time user hints that appear on key pages
3. **useOnboardingHints** - Hook for managing hint dismissal state

## Components

### HelpTooltip

A lightweight tooltip component that displays contextual help information.

**Features:**
- Mobile-friendly (tap to show, tap outside to dismiss)
- Desktop hover support
- Customizable positioning (top, right, bottom, left)
- Rich content support (text, lists, links)
- Keyboard accessible (Esc to close)
- Two variants: icon (standalone) and inline (next to labels)

**Basic Usage:**

```tsx
import { HelpTooltip } from "@/components/help/HelpTooltip";

// Standalone icon tooltip
<HelpTooltip
  title="Occupancy Rate"
  content={
    <div>
      Percentage of sites currently occupied. High occupancy (90%+) means you're nearly full!
    </div>
  }
  side="top"
  maxWidth={280}
/>

// Inline tooltip next to a label
<label className="flex items-center gap-2">
  Priority
  <HelpTooltip
    title="Priority Order"
    content={<div>Lower numbers run first...</div>}
    side="right"
  />
</label>
```

**Advanced Usage with Helper Components:**

```tsx
import {
  HelpTooltip,
  HelpTooltipContent,
  HelpTooltipSection,
  HelpTooltipList,
  HelpTooltipLink
} from "@/components/help/HelpTooltip";

<HelpTooltip
  title="Dynamic Pricing"
  content={
    <HelpTooltipContent>
      <HelpTooltipSection>
        Configure how pricing rules combine when multiple rules apply:
      </HelpTooltipSection>

      <HelpTooltipSection title="Stacking Modes">
        <HelpTooltipList items={[
          "Additive: Add adjustments together",
          "Max: Use the highest adjustment",
          "Override: Replace all other rules"
        ]} />
      </HelpTooltipSection>

      <HelpTooltipSection>
        <HelpTooltipLink href="/help/pricing-rules">
          Learn more about pricing rules
        </HelpTooltipLink>
      </HelpTooltipSection>
    </HelpTooltipContent>
  }
  side="right"
  maxWidth={360}
/>
```

**Props:**

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `content` | `ReactNode` | - | Tooltip content (required) |
| `title` | `string` | - | Optional tooltip title |
| `side` | `"top" \| "right" \| "bottom" \| "left"` | `"top"` | Tooltip position |
| `align` | `"start" \| "center" \| "end"` | `"center"` | Tooltip alignment |
| `maxWidth` | `number` | `320` | Maximum width in pixels |
| `variant` | `"icon" \| "inline"` | `"icon"` | Display variant |
| `className` | `string` | `""` | Additional CSS classes |

### OnboardingHint

Contextual hints that appear on first visit to help onboard new users.

**Features:**
- Shows only on first visit (stored in localStorage)
- Dismissible with "Got it!" button
- Optional action buttons
- Fade-in animation
- Two variants: positioned and page-level

**Basic Usage:**

```tsx
import { OnboardingHint } from "@/components/help/OnboardingHint";

// Positioned hint (appears near a specific element)
<div className="relative">
  <OnboardingHint
    id="calendar-drag-feature"
    title="Drag to Book"
    content={
      <div>
        Click and drag across empty cells to quickly create a reservation.
      </div>
    }
    placement="bottom"
  />
  <div>Your calendar grid here</div>
</div>
```

**Page-Level Hint:**

```tsx
import { PageOnboardingHint } from "@/components/help/OnboardingHint";

<PageOnboardingHint
  id="dashboard-overview"
  title="Welcome to your Dashboard!"
  content={
    <div>
      <p className="mb-2">This is your command center for managing your campground.</p>
      <ul className="list-disc list-inside space-y-1">
        <li>View today's arrivals and departures</li>
        <li>Monitor occupancy rates</li>
        <li>Track outstanding balances</li>
      </ul>
    </div>
  }
  actions={[
    {
      label: "Take a tour",
      onClick: () => startTour(),
      variant: "ghost"
    }
  ]}
/>
```

**Props:**

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `id` | `string` | - | Unique identifier (required) |
| `title` | `string` | - | Hint title (required) |
| `content` | `ReactNode` | - | Hint content (required) |
| `placement` | `"top" \| "right" \| "bottom" \| "left"` | `"bottom"` | Hint position (OnboardingHint only) |
| `showOnce` | `boolean` | `true` | Show only once |
| `trigger` | `"immediate" \| "delay"` | `"immediate"` | When to show |
| `delayMs` | `number` | `1000` | Delay in milliseconds |
| `actions` | `Array<{label, onClick, variant?}>` | `[]` | Action buttons |

### useOnboardingHints Hook

Programmatic control over onboarding hints.

**Usage:**

```tsx
import { useOnboardingHints } from "@/hooks/use-onboarding-hints";

function MyComponent() {
  const { isDismissed, dismissHint, resetHint, resetAllHints } = useOnboardingHints();

  // Check if a hint has been dismissed
  if (isDismissed("calendar-drag-feature")) {
    // Show advanced features
  }

  // Manually dismiss a hint
  const handleComplete = () => {
    dismissHint("onboarding-step-1");
  };

  // Reset all hints (e.g., for testing or user preference)
  const handleResetOnboarding = () => {
    resetAllHints();
  };

  return <div>...</div>;
}
```

**Or use the simpler single-hint hook:**

```tsx
import { useOnboardingHint } from "@/hooks/use-onboarding-hints";

function MyComponent() {
  const { isVisible, isDismissed, dismiss, reset } = useOnboardingHint("my-hint-id");

  if (isVisible) {
    return <CustomHint onDismiss={dismiss} />;
  }

  return null;
}
```

## Implementation Examples

### Example 1: Dashboard Metrics

```tsx
// Dashboard with tooltips explaining each metric
<div className="grid grid-cols-4 gap-3">
  <div className="card p-3">
    <div className="flex items-center gap-1 text-xs text-slate-600 mb-1">
      Occupancy
      <HelpTooltip
        content={
          <div className="space-y-1">
            <p>Percentage of sites currently occupied.</p>
            <p className="text-xs text-slate-600">
              Formula: (occupied sites / total sites) × 100
            </p>
          </div>
        }
        side="top"
        maxWidth={260}
      />
    </div>
    <div className="text-2xl font-bold">{occupancyRate}%</div>
  </div>
  {/* More metrics... */}
</div>
```

### Example 2: Settings Form with Multiple Tooltips

```tsx
// Pricing rules form with helpful tooltips
<form>
  <div>
    <div className="flex items-center gap-2 mb-1">
      <label className="text-sm font-medium">Priority</label>
      <HelpTooltip
        title="Priority Order"
        content={
          <HelpTooltipContent>
            <HelpTooltipSection>
              Rules run in priority order, with lower numbers first.
            </HelpTooltipSection>
            <HelpTooltipSection title="Tip">
              Use priorities like 10, 20, 30 to leave room for future rules.
            </HelpTooltipSection>
          </HelpTooltipContent>
        }
        side="top"
      />
    </div>
    <input type="number" {...register("priority")} />
  </div>

  <div>
    <div className="flex items-center gap-2 mb-1">
      <label className="text-sm font-medium">Stacking Mode</label>
      <HelpTooltip
        title="How Rules Combine"
        content={
          <HelpTooltipContent>
            <HelpTooltipSection title="Additive">
              Add this adjustment to other rules.
            </HelpTooltipSection>
            <HelpTooltipSection title="Max">
              Use the highest adjustment.
            </HelpTooltipSection>
            <HelpTooltipSection title="Override">
              Ignore all other rules.
            </HelpTooltipSection>
          </HelpTooltipContent>
        }
        side="right"
        maxWidth={360}
      />
    </div>
    <select {...register("stackMode")}>
      <option value="additive">Additive</option>
      <option value="max">Max</option>
      <option value="override">Override</option>
    </select>
  </div>
</form>
```

### Example 3: First-Time User Experience

```tsx
// Dashboard with onboarding hint
export default function Dashboard() {
  return (
    <DashboardShell>
      <PageOnboardingHint
        id="dashboard-first-visit"
        title="Welcome to your Dashboard!"
        content={
          <div>
            <p className="mb-2">
              This is your command center. Here you'll find:
            </p>
            <ul className="list-disc list-inside space-y-1 text-sm">
              <li>Today's arrivals and departures</li>
              <li>Current occupancy rates</li>
              <li>Outstanding balances</li>
              <li>Quick action buttons</li>
            </ul>
          </div>
        }
        actions={[
          {
            label: "View Calendar",
            onClick: () => (window.location.href = "/calendar"),
            variant: "ghost"
          }
        ]}
      />

      {/* Dashboard content */}
    </DashboardShell>
  );
}
```

### Example 4: Calendar with Drag-to-Book Hint

```tsx
// Calendar with positioned onboarding hint
export default function CalendarPage() {
  return (
    <DashboardShell>
      <PageOnboardingHint
        id="calendar-drag-to-book"
        title="Drag to Book - Quick Reservations"
        content={
          <div>
            <p className="mb-2">Create reservations by dragging:</p>
            <ul className="list-disc list-inside space-y-1 text-sm">
              <li>Click and drag across empty cells</li>
              <li>Release to see quote preview</li>
              <li>Click "Book Now" to create reservation</li>
            </ul>
            <p className="mt-2 text-xs text-slate-600">
              Tip: Hold Shift to extend, Ctrl/Cmd to move
            </p>
          </div>
        }
      />

      {/* Calendar grid */}
    </DashboardShell>
  );
}
```

## Best Practices

### When to Use Tooltips

**Good Use Cases:**
- Explaining metrics or calculations
- Clarifying form field requirements
- Providing examples or tips
- Explaining complex features
- Showing keyboard shortcuts

**Avoid Using For:**
- Basic labels that are self-explanatory
- Content that should be visible by default
- Critical information users must see
- Long-form documentation (use help pages instead)

### Tooltip Content Guidelines

1. **Keep it concise** - Aim for 1-3 short sentences
2. **Be specific** - Give concrete examples
3. **Use formatting** - Break up text with lists and sections
4. **Include formulas** - Show how calculations work
5. **Link to more** - Add links to detailed help pages if needed

### Onboarding Hint Guidelines

1. **Show on first visit** - Don't overwhelm returning users
2. **Focus on key features** - Highlight the most important capabilities
3. **Make dismissible** - Always provide a clear way to close
4. **Add actions** - Link to tours or related pages
5. **Use sparingly** - 1-2 hints per page maximum

### Accessibility

- Tooltips are keyboard accessible (Esc to close)
- ARIA labels provided for screen readers
- Mobile-friendly tap interactions
- High-contrast borders and backgrounds

## Locations with Help Tooltips

The following pages currently have help tooltips implemented:

### Dashboard (`/app/dashboard/page.tsx`)
- [OK] Page onboarding hint (first visit)
- [OK] Today's Numbers section explanation
- [OK] Individual metric tooltips (Arrivals, Departures, In-house, Occupancy, Balance due)
- [OK] Quick Actions section tooltip
- [OK] Needs Attention section tooltip

### Calendar (`/app/calendar/page.tsx`)
- [OK] Page onboarding hint (drag-to-book feature)
- [OK] Statistics tooltips (Reservations, Revenue, Occupancy, Avg Daily Rate)

### Pricing Rules (`/app/settings/pricing-rules/page.tsx`)
- [OK] Page onboarding hint (dynamic pricing intro)
- [OK] Priority field tooltip
- [OK] Stacking mode tooltip
- [OK] Min/Max rate cap tooltips

## Adding Tooltips to New Pages

1. **Import the components:**
   ```tsx
   import { HelpTooltip } from "@/components/help/HelpTooltip";
   import { PageOnboardingHint } from "@/components/help/OnboardingHint";
   ```

2. **Add page-level onboarding hint:**
   ```tsx
   <PageOnboardingHint
     id="unique-page-id"
     title="Welcome to [Feature]!"
     content={<div>Explanation...</div>}
   />
   ```

3. **Add tooltips to complex fields:**
   ```tsx
   <label className="flex items-center gap-2">
     Field Name
     <HelpTooltip
       content={<div>What this field does...</div>}
       side="right"
     />
   </label>
   ```

4. **Test on mobile and desktop** to ensure proper positioning and interaction.

## Storage Keys

The system uses the following localStorage keys:

- `campreserv:onboarding:hint:{id}` - Individual hint dismissal state
- `campreserv:onboarding:hints` - Global hint state (when using useOnboardingHints hook)
- `campreserv:onboarding:page-hint:{id}` - Page-level hint dismissal

## Future Enhancements

Potential improvements to consider:

- [ ] Tooltip analytics (track which tooltips are most helpful)
- [ ] User feedback on tooltips (helpful/not helpful)
- [ ] Guided tours using multiple sequential hints
- [ ] Admin panel to manage tooltip content
- [ ] Multi-language support
- [ ] Video/GIF support in tooltips
- [ ] Tooltip search functionality
- [ ] Context-aware smart suggestions
