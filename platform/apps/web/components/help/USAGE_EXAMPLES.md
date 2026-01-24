# Help Tooltip Usage Examples

This document provides real-world examples of how to implement the help tooltip system in your components.

## Table of Contents

- [Simple Tooltips](#simple-tooltips)
- [Advanced Tooltips](#advanced-tooltips)
- [Form Field Tooltips](#form-field-tooltips)
- [Onboarding Hints](#onboarding-hints)
- [Dashboard Examples](#dashboard-examples)
- [Calendar Examples](#calendar-examples)
- [Settings Examples](#settings-examples)

## Simple Tooltips

### Basic Icon Tooltip

```tsx
import { HelpTooltip } from "@/components/help/HelpTooltip";

<div className="flex items-center gap-2">
  <span>Occupancy Rate</span>
  <HelpTooltip content={<div>Percentage of sites currently occupied</div>} />
</div>;
```

### Tooltip with Title

```tsx
<HelpTooltip
  title="What is ADR?"
  content={
    <div>Average Daily Rate (ADR) is the average revenue earned per occupied site per night.</div>
  }
  side="top"
  maxWidth={280}
/>
```

### Inline Label Tooltip

```tsx
<label className="flex items-center gap-1">
  <span className="text-sm font-medium">Dynamic Pricing</span>
  <HelpTooltip
    content={<div>Automatically adjust rates based on demand and seasonality</div>}
    variant="inline"
  >
    {/* Label text can also be passed as children */}
  </HelpTooltip>
</label>
```

## Advanced Tooltips

### Multi-Section Tooltip

```tsx
import { HelpTooltip, HelpTooltipContent, HelpTooltipSection } from "@/components/help/HelpTooltip";

<HelpTooltip
  title="Pricing Rules"
  content={
    <HelpTooltipContent>
      <HelpTooltipSection>
        Configure how pricing rules combine when multiple rules apply to the same date.
      </HelpTooltipSection>

      <HelpTooltipSection title="Stacking Modes">
        Choose how adjustments combine: • Additive: Add all adjustments together • Max: Use the
        highest adjustment • Override: Use only this rule
      </HelpTooltipSection>

      <HelpTooltipSection title="Priority">
        Lower priority numbers run first (e.g., priority 1 runs before priority 10).
      </HelpTooltipSection>
    </HelpTooltipContent>
  }
  side="right"
  maxWidth={360}
/>;
```

### Tooltip with List

```tsx
import { HelpTooltip, HelpTooltipList } from "@/components/help/HelpTooltip";

<HelpTooltip
  title="Quick Actions Available"
  content={
    <div className="space-y-2">
      <p>Use these shortcuts to speed up common tasks:</p>
      <HelpTooltipList
        items={[
          "Cmd/Ctrl + N: New booking",
          "Cmd/Ctrl + S: Save changes",
          "Cmd/Ctrl + F: Search reservations",
          "Esc: Close dialogs",
        ]}
      />
    </div>
  }
  side="bottom"
/>;
```

### Tooltip with Links

```tsx
import {
  HelpTooltip,
  HelpTooltipContent,
  HelpTooltipSection,
  HelpTooltipLink,
} from "@/components/help/HelpTooltip";

<HelpTooltip
  title="Need More Help?"
  content={
    <HelpTooltipContent>
      <HelpTooltipSection>Check out these resources:</HelpTooltipSection>

      <HelpTooltipSection>
        <HelpTooltipLink href="/help/pricing-rules">Pricing Rules Guide</HelpTooltipLink>
      </HelpTooltipSection>

      <HelpTooltipSection>
        <HelpTooltipLink href="/help/getting-started">Getting Started Tutorial</HelpTooltipLink>
      </HelpTooltipSection>
    </HelpTooltipContent>
  }
/>;
```

## Form Field Tooltips

### Text Input with Tooltip

```tsx
<div className="space-y-1">
  <div className="flex items-center gap-2">
    <label className="text-sm font-medium text-slate-700">Site Name</label>
    <HelpTooltip
      content={
        <div>
          Give your site a memorable name. Examples: "Lakeview A1", "Riverside Premium", "Cabin 42"
        </div>
      }
      side="right"
      maxWidth={260}
    />
  </div>
  <input
    type="text"
    placeholder="e.g., Lakeview A1"
    className="w-full rounded-lg border px-3 py-2"
  />
</div>
```

### Number Input with Formula Explanation

```tsx
<div className="space-y-1">
  <div className="flex items-center gap-2">
    <label className="text-sm font-medium text-slate-700">Deposit Percentage</label>
    <HelpTooltip
      title="How Deposits Work"
      content={
        <HelpTooltipContent>
          <HelpTooltipSection>
            The percentage of the total booking amount due as a deposit.
          </HelpTooltipSection>

          <HelpTooltipSection title="Example">
            For a $200 booking with 25% deposit:
            <br />
            Deposit = $200 × 0.25 = $50
          </HelpTooltipSection>

          <HelpTooltipSection>
            <span className="text-xs text-slate-600">
              Range: 0-100%. Common values: 25%, 50%, 100%
            </span>
          </HelpTooltipSection>
        </HelpTooltipContent>
      }
      side="right"
      maxWidth={300}
    />
  </div>
  <input
    type="number"
    min="0"
    max="100"
    placeholder="25"
    className="w-full rounded-lg border px-3 py-2"
  />
</div>
```

### Select Dropdown with Options Explained

```tsx
<div className="space-y-1">
  <div className="flex items-center gap-2">
    <label className="text-sm font-medium text-slate-700">Payment Method</label>
    <HelpTooltip
      title="Payment Options"
      content={
        <HelpTooltipContent>
          <HelpTooltipSection title="Credit Card">
            Processed immediately via Stripe. Funds available in 2-7 days.
          </HelpTooltipSection>

          <HelpTooltipSection title="Cash">
            Recorded as received. Update cash register at end of shift.
          </HelpTooltipSection>

          <HelpTooltipSection title="Check">
            Verify check before accepting. Wait for clearance (3-5 days).
          </HelpTooltipSection>
        </HelpTooltipContent>
      }
      side="right"
      maxWidth={320}
    />
  </div>
  <select className="w-full rounded-lg border px-3 py-2">
    <option value="card">Credit Card</option>
    <option value="cash">Cash</option>
    <option value="check">Check</option>
  </select>
</div>
```

## Onboarding Hints

### Page-Level Welcome Hint

```tsx
import { PageOnboardingHint } from "@/components/help/OnboardingHint";

export default function DashboardPage() {
  return (
    <div className="space-y-6">
      <PageOnboardingHint
        id="dashboard-welcome"
        title="Welcome to Keepr Host!"
        content={
          <div>
            <p className="mb-2">You're all set! Here's what you can do from your dashboard:</p>
            <ul className="list-disc list-inside space-y-1 text-sm">
              <li>View today's check-ins and check-outs</li>
              <li>Monitor your occupancy rates</li>
              <li>Track outstanding balances</li>
              <li>Create new bookings with one click</li>
            </ul>
            <p className="mt-2 text-sm text-slate-600">
              Pro tip: Use keyboard shortcuts (press ? to view) to work faster!
            </p>
          </div>
        }
        actions={[
          {
            label: "View Calendar",
            onClick: () => router.push("/calendar"),
            variant: "ghost",
          },
          {
            label: "Watch Tutorial",
            onClick: () => window.open("/help/tutorial", "_blank"),
            variant: "ghost",
          },
        ]}
      />

      {/* Dashboard content */}
    </div>
  );
}
```

### Feature Introduction Hint

```tsx
<PageOnboardingHint
  id="calendar-drag-booking"
  title="New Feature: Drag-to-Book!"
  content={
    <div>
      <p className="mb-2">You can now create bookings by dragging on the calendar:</p>
      <ol className="list-decimal list-inside space-y-1 text-sm ml-2">
        <li>Click on an empty cell for your desired site</li>
        <li>Drag across the dates you want to book</li>
        <li>Release to see an instant quote</li>
        <li>Click "Book Now" to create the reservation</li>
      </ol>
      <div className="mt-3 p-2 bg-blue-50 border border-blue-200 rounded text-xs text-blue-800">
        Tip: Hold Shift while dragging to extend an existing booking
      </div>
    </div>
  }
/>
```

### Positioned Feature Hint

```tsx
import { OnboardingHint } from "@/components/help/OnboardingHint";

<div className="relative">
  {/* Existing calendar toolbar */}
  <div className="flex items-center justify-between">
    <div>Calendar Controls</div>
  </div>

  {/* Hint appears below the toolbar */}
  <OnboardingHint
    id="calendar-filters-tip"
    title="Filter Your View"
    content={
      <div>
        Use the filters above to show only specific site types, amenities, or availability. This
        makes it easier to find the perfect site for your guests!
      </div>
    }
    placement="bottom"
    trigger="delay"
    delayMs={2000}
  />
</div>;
```

## Dashboard Examples

### Metric Cards with Tooltips

```tsx
<div className="grid grid-cols-4 gap-4">
  <div className="card p-4">
    <div className="flex items-center gap-1 text-xs text-slate-600 mb-2">
      Arrivals Today
      <HelpTooltip
        content={
          <div>
            Number of guests checking in today. Click to view the full check-in list and mark
            arrivals as complete.
          </div>
        }
        side="top"
        maxWidth={220}
      />
    </div>
    <div className="text-3xl font-bold text-emerald-600">{arrivalsCount}</div>
    <Link href="/check-in-out" className="text-sm text-emerald-600 hover:underline">
      View list →
    </Link>
  </div>

  {/* Similar pattern for other metrics */}
</div>
```

### Action Buttons Section

```tsx
<div className="space-y-3">
  <div className="flex items-center gap-2">
    <h3 className="text-lg font-semibold">Quick Actions</h3>
    <HelpTooltip
      content={
        <div>
          These buttons let you perform common tasks without navigating through menus. Most actions
          also have keyboard shortcuts - press ? to view them.
        </div>
      }
      side="right"
      maxWidth={280}
    />
  </div>

  <div className="grid grid-cols-5 gap-3">
    <button className="...">New Booking</button>
    <button className="...">POS Order</button>
    {/* More buttons */}
  </div>
</div>
```

## Calendar Examples

### Statistics Row

```tsx
<div className="grid grid-cols-4 gap-3">
  <div className="card p-3">
    <div className="flex items-center gap-1 text-xs text-slate-600 mb-1">
      Occupancy
      <HelpTooltip
        content={
          <div className="space-y-2">
            <p>Average occupancy rate across the visible date range.</p>
            <div className="text-xs text-slate-600 bg-slate-50 p-2 rounded">
              <strong>Formula:</strong>
              <br />
              (Occupied site-nights ÷ Total available site-nights) × 100
            </div>
            <p className="text-xs text-slate-600">
              Industry benchmark: 70-85% is excellent for most campgrounds
            </p>
          </div>
        }
        side="top"
        maxWidth={300}
      />
    </div>
    <div className="text-2xl font-bold text-blue-600">{occupancyRate.toFixed(1)}%</div>
  </div>
</div>
```

## Settings Examples

### Complex Form with Multiple Tooltips

```tsx
export default function PricingRulesForm() {
  return (
    <form className="space-y-6">
      {/* Rule Name */}
      <div>
        <div className="flex items-center gap-2 mb-1">
          <label className="text-sm font-medium">Rule Name</label>
          <HelpTooltip
            content={
              <div>
                Give this rule a descriptive name. Examples: "Summer Peak Season", "Weekend
                Premium", "Holiday Markup"
              </div>
            }
            side="right"
            maxWidth={240}
          />
        </div>
        <input type="text" className="w-full..." />
      </div>

      {/* Priority */}
      <div>
        <div className="flex items-center gap-2 mb-1">
          <label className="text-sm font-medium">Priority</label>
          <HelpTooltip
            title="Execution Order"
            content={
              <HelpTooltipContent>
                <HelpTooltipSection>
                  Rules execute in priority order, with lower numbers running first.
                </HelpTooltipSection>

                <HelpTooltipSection title="Example">
                  If you have a "Summer" rule (priority 10) and a "Weekend" rule (priority 20),
                  summer pricing applies first, then weekend pricing.
                </HelpTooltipSection>

                <HelpTooltipSection title="Best Practice">
                  Use increments of 10 (10, 20, 30) to leave room for inserting new rules between
                  existing ones.
                </HelpTooltipSection>
              </HelpTooltipContent>
            }
            side="top"
            maxWidth={340}
          />
        </div>
        <input type="number" min="0" className="w-full..." />
      </div>

      {/* Stacking Mode */}
      <div>
        <div className="flex items-center gap-2 mb-1">
          <label className="text-sm font-medium">Stacking Mode</label>
          <HelpTooltip
            title="How Rules Combine"
            content={
              <HelpTooltipContent>
                <HelpTooltipSection>
                  Controls how this rule combines with others when multiple rules apply to the same
                  date:
                </HelpTooltipSection>

                <HelpTooltipSection title="Additive">
                  Adds this adjustment to the base rate and other additive rules. Perfect for
                  combining seasonal + weekend pricing.
                </HelpTooltipSection>

                <HelpTooltipSection title="Max">
                  Uses the highest adjustment among all overlapping rules. Prevents over-pricing
                  from stacking too many increases.
                </HelpTooltipSection>

                <HelpTooltipSection title="Override">
                  Ignores all other rules and uses only this adjustment. Great for special events
                  with fixed pricing.
                </HelpTooltipSection>
              </HelpTooltipContent>
            }
            side="right"
            maxWidth={380}
          />
        </div>
        <select className="w-full...">
          <option value="additive">Add to other adjustments</option>
          <option value="max">Use highest adjustment</option>
          <option value="override">Replace all adjustments</option>
        </select>
      </div>

      {/* Rate Caps */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <label className="text-sm font-medium">Min Rate Cap</label>
            <HelpTooltip
              content={
                <div className="space-y-2">
                  <p>Prevent rates from going too low.</p>
                  <div className="text-xs bg-slate-50 p-2 rounded">
                    <strong>Example:</strong> Base rate $50, -30% discount
                    <br />
                    Without cap: $35
                    <br />
                    With $40 cap: $40 (prevented from going lower)
                  </div>
                </div>
              }
              side="top"
              maxWidth={280}
            />
          </div>
          <input type="number" step="0.01" className="w-full..." />
        </div>

        <div>
          <div className="flex items-center gap-2 mb-1">
            <label className="text-sm font-medium">Max Rate Cap</label>
            <HelpTooltip
              content={
                <div className="space-y-2">
                  <p>Prevent rates from going too high.</p>
                  <div className="text-xs bg-slate-50 p-2 rounded">
                    <strong>Example:</strong> Base rate $50, +50% markup
                    <br />
                    Without cap: $75
                    <br />
                    With $70 cap: $70 (prevented from going higher)
                  </div>
                </div>
              }
              side="top"
              maxWidth={280}
            />
          </div>
          <input type="number" step="0.01" className="w-full..." />
        </div>
      </div>
    </form>
  );
}
```

## Tips and Best Practices

### Positioning

```tsx
// Top - Good for fields in the middle/bottom of forms
<HelpTooltip content="..." side="top" />

// Right - Good for labels on the left side
<HelpTooltip content="..." side="right" />

// Bottom - Good for page headers or top sections
<HelpTooltip content="..." side="bottom" />

// Left - Good for labels on the right side
<HelpTooltip content="..." side="left" />
```

### Max Width

```tsx
// Short tooltips (1-2 sentences)
<HelpTooltip content="..." maxWidth={200} />

// Medium tooltips (multiple sections)
<HelpTooltip content="..." maxWidth={300} />

// Detailed tooltips (with examples and lists)
<HelpTooltip content="..." maxWidth={400} />
```

### Mobile Considerations

```tsx
// Mobile-friendly: Tap to open, tap outside to close
// No special code needed - built into HelpTooltip

// For very small screens, position tooltips at bottom
// to avoid going off-screen
<HelpTooltip
  content="..."
  side="bottom"
  className="sm:side-right" // Right on desktop, bottom on mobile
/>
```

### Accessibility

```tsx
// Always provide meaningful tooltip content
// Screen readers will announce the tooltip when focused

// Good
<HelpTooltip
  content="Average revenue earned per occupied site per night"
  title="Average Daily Rate"
/>

// Bad
<HelpTooltip content="More info" /> // Not descriptive enough
```
