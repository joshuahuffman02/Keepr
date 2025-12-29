# Help Tooltip Quick Reference

## Import Statements

```tsx
// Basic tooltip
import { HelpTooltip } from "@/components/help/HelpTooltip";

// Advanced tooltip components
import {
  HelpTooltip,
  HelpTooltipContent,
  HelpTooltipSection,
  HelpTooltipList,
  HelpTooltipLink
} from "@/components/help/HelpTooltip";

// Onboarding hints
import { OnboardingHint, PageOnboardingHint } from "@/components/help/OnboardingHint";

// Hooks
import { useOnboardingHints, useOnboardingHint } from "@/hooks/use-onboarding-hints";
```

## Common Patterns

### 1. Simple Tooltip
```tsx
<HelpTooltip content={<div>Helpful text here</div>} />
```

### 2. Tooltip with Title
```tsx
<HelpTooltip
  title="Feature Name"
  content={<div>Explanation here</div>}
  side="top"
/>
```

### 3. Inline Label Tooltip
```tsx
<div className="flex items-center gap-2">
  <label>Field Name</label>
  <HelpTooltip content={<div>What this field does</div>} />
</div>
```

### 4. Multi-Section Tooltip
```tsx
<HelpTooltip
  title="Advanced Feature"
  content={
    <HelpTooltipContent>
      <HelpTooltipSection>
        Main explanation
      </HelpTooltipSection>
      <HelpTooltipSection title="Example">
        Specific example
      </HelpTooltipSection>
    </HelpTooltipContent>
  }
  side="right"
  maxWidth={360}
/>
```

### 5. Page Onboarding Hint
```tsx
<PageOnboardingHint
  id="page-feature-id"
  title="Welcome!"
  content={<div>Page explanation with tips</div>}
/>
```

### 6. Hint with Actions
```tsx
<PageOnboardingHint
  id="dashboard-intro"
  title="Welcome!"
  content={<div>...</div>}
  actions={[
    {
      label: "View Tutorial",
      onClick: () => navigate("/help"),
      variant: "ghost"
    }
  ]}
/>
```

## Props Cheatsheet

### HelpTooltip Props
| Prop | Type | Default | Options |
|------|------|---------|---------|
| `content` | ReactNode | - | Required |
| `title` | string | - | Optional |
| `side` | string | "top" | top, right, bottom, left |
| `align` | string | "center" | start, center, end |
| `maxWidth` | number | 320 | Any pixel value |
| `variant` | string | "icon" | icon, inline |

### OnboardingHint Props
| Prop | Type | Default | Options |
|------|------|---------|---------|
| `id` | string | - | Required (unique) |
| `title` | string | - | Required |
| `content` | ReactNode | - | Required |
| `placement` | string | "bottom" | top, right, bottom, left |
| `showOnce` | boolean | true | - |
| `trigger` | string | "immediate" | immediate, delay |
| `delayMs` | number | 1000 | Any milliseconds |
| `actions` | Array | [] | {label, onClick, variant?}[] |

## Positioning Guide

```tsx
// Top (good for bottom sections)
<HelpTooltip content="..." side="top" />

// Right (good for left labels)
<HelpTooltip content="..." side="right" />

// Bottom (good for headers)
<HelpTooltip content="..." side="bottom" />

// Left (good for right labels)
<HelpTooltip content="..." side="left" />
```

## Max Width Guide

```tsx
// Short (1-2 sentences)
maxWidth={200}

// Medium (multiple points)
maxWidth={300}

// Large (detailed with examples)
maxWidth={400}
```

## Common Use Cases

### Metric Cards
```tsx
<div className="card p-3">
  <div className="flex items-center gap-1 text-xs text-slate-600 mb-1">
    Metric Name
    <HelpTooltip
      content={<div>What this metric measures</div>}
      side="top"
      maxWidth={220}
    />
  </div>
  <div className="text-2xl font-bold">{value}</div>
</div>
```

### Form Fields
```tsx
<div>
  <div className="flex items-center gap-2 mb-1">
    <label className="text-sm font-medium">Field Label</label>
    <HelpTooltip
      title="Field Purpose"
      content={<div>Explanation and examples</div>}
      side="right"
    />
  </div>
  <input type="text" className="..." />
</div>
```

### Page Sections
```tsx
<div className="space-y-3">
  <div className="flex items-center gap-2">
    <h3 className="text-lg font-semibold">Section Title</h3>
    <HelpTooltip
      content={<div>What this section is for</div>}
      side="right"
    />
  </div>
  {/* Section content */}
</div>
```

## Hook Usage

### Check Multiple Hints
```tsx
const { isDismissed, dismissHint, resetAllHints } = useOnboardingHints();

if (!isDismissed("feature-intro")) {
  // Show intro
}
```

### Manage Single Hint
```tsx
const { isVisible, dismiss } = useOnboardingHint("my-hint-id");

if (isVisible) {
  return <CustomHint onDismiss={dismiss} />;
}
```

## Content Formatting

### With List
```tsx
<HelpTooltipList items={[
  "First point",
  "Second point",
  "Third point"
]} />
```

### With Link
```tsx
<HelpTooltipLink href="/help/topic">
  Learn more
</HelpTooltipLink>
```

### With Sections
```tsx
<HelpTooltipContent>
  <HelpTooltipSection>
    Introduction text
  </HelpTooltipSection>

  <HelpTooltipSection title="Details">
    Detailed explanation
  </HelpTooltipSection>

  <HelpTooltipSection title="Example">
    Specific example
  </HelpTooltipSection>
</HelpTooltipContent>
```

## Best Practices

### Do's
- Keep content concise (1-3 sentences)
- Provide specific examples
- Use formatting (lists, sections)
- Position appropriately for screen
- Test on mobile and desktop
- Include formulas for calculations

### Don'ts
- Don't write paragraphs
- Don't use for critical info
- Don't nest tooltips
- Don't make content too wide
- Don't forget mobile users
- Don't explain obvious things

## Keyboard Shortcuts

- `Esc` - Close tooltip
- `Tab` - Navigate to next focusable element
- `Shift + Tab` - Navigate to previous element
- `Enter` or `Space` - Activate tooltip button

## LocalStorage Keys

```
campreserv:onboarding:hint:{id}
campreserv:onboarding:page-hint:{id}
campreserv:onboarding:hints
```

## Testing Checklist

- [ ] Tooltip shows on hover (desktop)
- [ ] Tooltip shows on tap (mobile)
- [ ] Tooltip closes on Esc
- [ ] Tooltip closes on outside click
- [ ] Content is readable
- [ ] Links work
- [ ] No overflow on small screens
- [ ] Hints dismiss properly
- [ ] localStorage persists

## Common Issues

**Tooltip not showing?**
- Check if parent has `position: relative` or `position: absolute`
- Verify content prop is not empty
- Check z-index conflicts

**Tooltip cut off on mobile?**
- Use smaller `maxWidth` (200-280)
- Try different `side` prop
- Use `align` prop to adjust position

**Hint showing every time?**
- Check if `id` is unique
- Verify `showOnce={true}` is set
- Clear localStorage to test: `localStorage.clear()`

## Quick Copy-Paste Templates

### Basic Tooltip
```tsx
<HelpTooltip
  content={<div>EXPLANATION_HERE</div>}
  side="top"
  maxWidth={280}
/>
```

### Form Field Tooltip
```tsx
<div className="flex items-center gap-2 mb-1">
  <label className="text-sm font-medium">LABEL_HERE</label>
  <HelpTooltip
    title="TITLE_HERE"
    content={<div>EXPLANATION_HERE</div>}
    side="right"
    maxWidth={300}
  />
</div>
```

### Page Hint
```tsx
<PageOnboardingHint
  id="UNIQUE_ID_HERE"
  title="TITLE_HERE"
  content={
    <div>
      <p className="mb-2">INTRO_TEXT_HERE</p>
      <ul className="list-disc list-inside space-y-1 text-sm">
        <li>POINT_1</li>
        <li>POINT_2</li>
        <li>POINT_3</li>
      </ul>
    </div>
  }
/>
```

## Resources

- Full Guide: `/HELP_TOOLTIP_SYSTEM.md`
- Examples: `/components/help/USAGE_EXAMPLES.md`
- Implementation: `/HELP_SYSTEM_IMPLEMENTATION.md`
