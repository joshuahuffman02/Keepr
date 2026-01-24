# Help Components

Contextual help tooltip system for the Campreserv application.

## Quick Start

```tsx
import { HelpTooltip, PageOnboardingHint } from "@/components/help";

// Add a tooltip
<HelpTooltip
  content={<div>Helpful explanation here</div>}
  side="top"
/>

// Add a page hint
<PageOnboardingHint
  id="page-feature-id"
  title="Welcome!"
  content={<div>First-time user guidance</div>}
/>
```

## Components

### HelpTooltip

Small "?" icon that shows contextual help on hover/click.

**Features:**

- Desktop hover + mobile tap
- Rich content support
- Customizable positioning
- Keyboard accessible

**Example:**

```tsx
<div className="flex items-center gap-2">
  <label>Occupancy Rate</label>
  <HelpTooltip
    title="What is Occupancy?"
    content={
      <div>
        <p>Percentage of sites currently occupied.</p>
        <p className="text-xs text-slate-600 mt-1">Formula: (occupied sites / total sites) × 100</p>
      </div>
    }
    side="top"
    maxWidth={280}
  />
</div>
```

### OnboardingHint

First-time user hints that appear on key pages.

**Features:**

- Shows once (localStorage)
- Dismissible
- Optional action buttons
- Positioned or page-level

**Example:**

```tsx
<PageOnboardingHint
  id="dashboard-welcome"
  title="Welcome to your Dashboard!"
  content={
    <div>
      <p>This is your command center. Here you'll find:</p>
      <ul className="list-disc list-inside space-y-1 text-sm">
        <li>Today's arrivals and departures</li>
        <li>Current occupancy rates</li>
        <li>Outstanding balances</li>
      </ul>
    </div>
  }
  actions={[
    {
      label: "View Tutorial",
      onClick: () => navigate("/help"),
      variant: "ghost",
    },
  ]}
/>
```

### Helper Components

**HelpTooltipContent** - Wrapper for structured content

```tsx
<HelpTooltipContent>
  <HelpTooltipSection>Introduction</HelpTooltipSection>
  <HelpTooltipSection title="Details">Explanation</HelpTooltipSection>
</HelpTooltipContent>
```

**HelpTooltipList** - Bulleted lists

```tsx
<HelpTooltipList items={["First point", "Second point", "Third point"]} />
```

**HelpTooltipLink** - External links

```tsx
<HelpTooltipLink href="/help/topic">Learn more</HelpTooltipLink>
```

## Props

### HelpTooltip

| Prop     | Type                                   | Default | Description                |
| -------- | -------------------------------------- | ------- | -------------------------- |
| content  | ReactNode                              | -       | Tooltip content (required) |
| title    | string                                 | -       | Optional title             |
| side     | "top" \| "right" \| "bottom" \| "left" | "top"   | Position                   |
| maxWidth | number                                 | 320     | Max width in px            |
| variant  | "icon" \| "inline"                     | "icon"  | Display style              |

### PageOnboardingHint

| Prop    | Type      | Default | Description             |
| ------- | --------- | ------- | ----------------------- |
| id      | string    | -       | Unique ID (required)    |
| title   | string    | -       | Hint title (required)   |
| content | ReactNode | -       | Hint content (required) |
| actions | Array     | []      | Action buttons          |

## Hooks

### useOnboardingHints()

Manage multiple hints programmatically.

```tsx
const { isDismissed, dismissHint, resetAllHints } = useOnboardingHints();

if (!isDismissed("feature-intro")) {
  // Show intro
}
```

### useOnboardingHint(id)

Manage a single hint.

```tsx
const { isVisible, dismiss } = useOnboardingHint("my-hint");

if (isVisible) {
  return <CustomHint onDismiss={dismiss} />;
}
```

## Implementation Examples

### Dashboard Metrics

```tsx
<div className="card p-3">
  <div className="flex items-center gap-1 text-xs text-slate-600 mb-1">
    Occupancy
    <HelpTooltip
      content={
        <div>
          <p>Percentage of sites currently occupied.</p>
          <p className="text-xs text-slate-600">High occupancy (90%+) means you're nearly full!</p>
        </div>
      }
      side="top"
    />
  </div>
  <div className="text-2xl font-bold">{occupancyRate}%</div>
</div>
```

### Settings Form

```tsx
<div>
  <div className="flex items-center gap-2 mb-1">
    <label className="text-sm font-medium">Priority</label>
    <HelpTooltip
      title="Priority Order"
      content={
        <div>
          <p>Lower numbers run first.</p>
          <p className="text-xs text-slate-600 mt-1">
            Example: Priority 1 runs before priority 10.
          </p>
        </div>
      }
      side="right"
    />
  </div>
  <input type="number" {...register("priority")} />
</div>
```

### Page Welcome

```tsx
export default function MyPage() {
  return (
    <div>
      <PageOnboardingHint
        id="my-page-intro"
        title="Welcome to [Feature]!"
        content={
          <div>
            <p>Brief introduction to this page.</p>
            <ul className="list-disc list-inside space-y-1 text-sm">
              <li>Key feature 1</li>
              <li>Key feature 2</li>
              <li>Key feature 3</li>
            </ul>
          </div>
        }
      />
      {/* Page content */}
    </div>
  );
}
```

## Best Practices

### Do's

- Keep tooltips concise (1-3 sentences)
- Provide specific examples
- Use formatting (lists, sections)
- Test on mobile and desktop
- Position appropriately

### Don'ts

- Don't write long paragraphs
- Don't use for critical information
- Don't nest tooltips
- Don't forget about mobile users
- Don't explain obvious things

## Current Implementations

The help system is currently implemented on:

- **Dashboard** - 5 tooltips + 1 onboarding hint
- **Calendar** - 4 tooltips + 1 onboarding hint
- **Pricing Rules** - 5 tooltips + 1 onboarding hint

## Documentation

- **Full Guide**: `/HELP_TOOLTIP_SYSTEM.md`
- **Examples**: `./USAGE_EXAMPLES.md`
- **Quick Ref**: `./QUICK_REFERENCE.md`
- **Summary**: `/CONTEXTUAL_HELP_SUMMARY.md`

## Browser Support

- Chrome/Edge 90+
- Firefox 88+
- Safari 14+
- Mobile browsers (iOS 14+, Android 5+)

## Accessibility

- Keyboard navigation (Esc to close)
- ARIA labels for screen readers
- High-contrast styling
- Focus management
- Motion-safe animations

## Storage

Hints use localStorage to remember dismissals:

```
campreserv:onboarding:hint:{id}
campreserv:onboarding:page-hint:{id}
```

## Testing

To reset all hints during development:

```js
localStorage.clear();
// or
localStorage.removeItem("campreserv:onboarding:hint:hint-id");
```

## License

Part of the Campreserv application.
