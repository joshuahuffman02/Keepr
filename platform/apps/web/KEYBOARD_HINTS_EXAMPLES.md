# Adding Keyboard Hints to UI Elements

This guide shows how to add visual keyboard hints to buttons and UI elements throughout the app.

## Using the KeyboardHint Component

### Import
```typescript
import { KeyboardHint } from '@/components/ui/keyboard-hint';
```

### Example 1: Search Button with Hint
```tsx
<button className="flex items-center gap-2 px-4 py-2 bg-slate-100 rounded-lg">
  <SearchIcon />
  <span>Search</span>
  <KeyboardHint keys={["cmd", "k"]} className="ml-auto" />
</button>
```

Result: `[Search Icon] Search [⌘][K]`

### Example 2: New Booking Button
```tsx
<button className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg">
  <PlusIcon />
  <span>New Booking</span>
  <KeyboardHint keys={["cmd", "n"]} size="md" />
</button>
```

### Example 3: Navigation Menu Items
```tsx
<Link href="/dashboard" className="flex items-center justify-between px-3 py-2">
  <div className="flex items-center gap-2">
    <DashboardIcon />
    <span>Dashboard</span>
  </div>
  <KeyboardHint keys={["g", "d"]} className="opacity-70" />
</Link>
```

### Example 4: Modal Close Button
```tsx
<div className="modal-footer">
  <button className="btn-secondary">
    <span>Close</span>
    <KeyboardHint keys={["escape"]} size="sm" className="ml-2" />
  </button>
</div>
```

## Specific UI Locations to Add Hints

### 1. AdminTopBar Search Button (Already Done)
Location: `/components/ui/layout/AdminTopBar.tsx`
```tsx
<button className="...">
  <SearchIcon />
  <span>Search guests, sites, reservations...</span>
  <kbd className="ml-auto px-2 py-0.5 bg-white rounded text-xs">⌘K</kbd>
</button>
```

### 2. Sidebar Navigation Items
Location: `/components/ui/layout/DashboardShell.tsx`

Update navigation items to show hints:
```tsx
const navigationWithHints = [
  { label: "Dashboard", href: "/dashboard", icon: "dashboard", keys: ["g", "d"] },
  { label: "Calendar", href: "/calendar", icon: "calendar", keys: ["g", "c"] },
  { label: "Reservations", href: "/reservations", icon: "reservation", keys: ["g", "r"] },
  { label: "Guests", href: "/guests", icon: "guest", keys: ["g", "g"] },
  { label: "POS", href: "/pos", icon: "payments", keys: ["g", "p"] },
  { label: "Messages", href: "/messages", icon: "message", keys: ["g", "m"] },
  { label: "Settings", href: "/settings", icon: "wrench", keys: ["g", "s"] },
];
```

Then in the render:
```tsx
<Link href={item.href} className="flex items-center justify-between">
  <span className="flex items-center gap-2">
    <Icon name={item.icon} />
    {item.label}
  </span>
  {!collapsed && item.keys && (
    <KeyboardHint keys={item.keys} className="opacity-0 group-hover:opacity-70 transition-opacity" />
  )}
</Link>
```

### 3. New Booking Button
Location: Anywhere the "New Booking" button appears

```tsx
<button
  onClick={() => router.push('/booking')}
  className="btn-primary flex items-center gap-2"
>
  <PlusIcon className="h-4 w-4" />
  <span>New Booking</span>
  <KeyboardHint keys={["cmd", "n"]} className="ml-2 opacity-70" />
</button>
```

### 4. Help Button
Location: `/components/ui/layout/AdminTopBar.tsx`

```tsx
<button
  onClick={() => setIsHelpPanelOpen(true)}
  title="Help & Support"
  className="relative group"
>
  <HelpIcon />
  <span className="sr-only">Help</span>
  <div className="absolute bottom-full mb-2 hidden group-hover:block">
    <KeyboardHint keys={["cmd", "/"]} />
  </div>
</button>
```

### 5. Search Results
When showing search results, you can add hints:

```tsx
<div className="search-result">
  <div className="result-content">
    <h3>John Doe</h3>
    <p>Guest #1234</p>
  </div>
  <div className="result-actions">
    <span className="text-xs text-slate-500">Press</span>
    <KeyboardHint keys={["enter"]} size="sm" className="ml-1" />
    <span className="text-xs text-slate-500 ml-1">to open</span>
  </div>
</div>
```

## Best Practices

### 1. Don't Overuse
Only show hints for:
- Primary actions (search, new booking, etc.)
- Navigation shortcuts
- Modal/dialog actions (close, submit)

### 2. Hide on Mobile
```tsx
<KeyboardHint keys={["cmd", "k"]} className="hidden md:inline-flex" />
```

### 3. Show on Hover for Secondary Actions
```tsx
<button className="group">
  <span>Action</span>
  <KeyboardHint
    keys={["cmd", "shift", "x"]}
    className="opacity-0 group-hover:opacity-100 transition-opacity"
  />
</button>
```

### 4. Tooltip Alternative
For buttons with just an icon, use a tooltip:
```tsx
<button
  title="New Booking (⌘N)"
  className="p-2 rounded-lg hover:bg-slate-100"
>
  <PlusIcon />
</button>
```

## Sizes

- `size="sm"` - For compact areas, dropdowns (10px text)
- `size="md"` - Default for most buttons (12px text)
- `size="lg"` - For prominent actions, hero sections (14px text)

## Styling Tips

### Subtle Hints
```tsx
<KeyboardHint
  keys={["cmd", "k"]}
  className="opacity-60 hover:opacity-100 transition-opacity"
/>
```

### Colored Backgrounds
```tsx
<KeyboardHint
  keys={["escape"]}
  className="bg-red-50 border-red-200 text-red-700"
/>
```

### Dark Mode
```tsx
<KeyboardHint
  keys={["g", "d"]}
  className="dark:bg-slate-800 dark:border-slate-600 dark:text-slate-200"
/>
```

## Example: Complete Button with All Features

```tsx
import { KeyboardHint } from '@/components/ui/keyboard-hint';
import { Plus } from 'lucide-react';

function NewBookingButton() {
  const router = useRouter();

  return (
    <button
      onClick={() => router.push('/booking')}
      className="group relative inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-colors shadow-sm"
      aria-label="Create new booking (Cmd+N)"
    >
      <Plus className="h-4 w-4" />
      <span className="font-medium">New Booking</span>
      <KeyboardHint
        keys={["cmd", "n"]}
        size="md"
        className="hidden md:inline-flex ml-2 opacity-80 group-hover:opacity-100 transition-opacity"
      />
    </button>
  );
}
```

This creates a button that:
- Has an icon
- Shows clear text
- Displays keyboard hint on desktop only
- Hint becomes more visible on hover
- Has proper ARIA labels
- Responds to both click and keyboard shortcut
