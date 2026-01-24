# Accessibility Quick Reference Guide

Quick reference for developers implementing accessible components in the Campreserv application.

## Common Patterns

### 1. Icon-Only Buttons

```tsx
import { IconButton } from "@/components/ui/icon-button"
import { Plus } from "lucide-react"

// Good - has accessible label
<IconButton
  ariaLabel="Add new reservation"
  icon={<Plus className="h-4 w-4" />}
  onClick={handleAdd}
/>

// Also good - using regular button with aria-label
<Button size="icon" aria-label="Delete item">
  <Trash className="h-4 w-4" aria-hidden="true" />
</Button>
```

### 2. Status Badges

```tsx
import { Badge } from "@/components/ui/badge"

// Good - includes text, not just color
<Badge variant="success" srText="Reservation status: checked in">
  Checked In
</Badge>

// Also good - status visible to all users
<Badge variant="warning">
  Balance Due: $50
</Badge>
```

### 3. Form Fields

```tsx
import { FormField } from "@/components/ui/form-field";

// Good - proper label, error handling, helper text
<FormField
  label="Email Address"
  type="email"
  required
  error={errors.email}
  helperText="We'll never share your email"
  value={email}
  onChange={(e) => setEmail(e.target.value)}
/>;
```

### 4. Loading States

```tsx
import { LoadingSpinner } from "@/components/ui/loading-spinner"

// Good - announces loading state
<LoadingSpinner label="Loading reservations" />

// For buttons
<Button disabled={isLoading}>
  {isLoading ? <LoadingSpinner size="sm" /> : "Submit"}
  {isLoading && <VisuallyHidden>Saving...</VisuallyHidden>}
</Button>
```

### 5. Dialogs/Modals

```tsx
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";

// Good - has title and description
<Dialog open={open} onOpenChange={setOpen}>
  <DialogContent>
    <DialogHeader>
      <DialogTitle>Confirm Deletion</DialogTitle>
      <DialogDescription>This action cannot be undone. Are you sure?</DialogDescription>
    </DialogHeader>
    {/* Dialog content */}
  </DialogContent>
</Dialog>;
```

### 6. Dynamic Content Announcements

```tsx
import { useAccessibility } from "@/components/accessibility/AccessibilityProvider";

function MyComponent() {
  const { announceMessage } = useAccessibility();

  const handleSave = async () => {
    await saveData();
    // Announce to screen readers
    announceMessage("Changes saved successfully", "polite");
  };

  return <Button onClick={handleSave}>Save</Button>;
}
```

### 7. Links vs Buttons

```tsx
// Use Link for navigation
<Link href="/reservations" className="...">
  View Reservations
</Link>

// Use Button for actions
<Button onClick={handleSubmit}>
  Submit Form
</Button>

// Link styled as button (for navigation that looks like action)
<Link href="/booking" className="inline-flex items-center ... focus-visible:ring-4">
  New Booking
</Link>
```

### 8. Headings Hierarchy

```tsx
// Good - proper heading structure
<div>
  <h1>Dashboard</h1>

  <section>
    <h2>Today's Numbers</h2>
    {/* content */}
  </section>

  <section>
    <h2>Quick Actions</h2>
    {/* content */}
  </section>
</div>

// Bad - skipping levels or using divs
<div>
  <div className="text-3xl font-bold">Dashboard</div>
  <div className="text-xl font-semibold">Section</div>
</div>
```

### 9. Images and Icons

```tsx
// Decorative icons (no meaning)
<Calendar className="h-4 w-4" aria-hidden="true" />

// Meaningful icons (convey information)
<CheckCircle className="h-5 w-5" aria-label="Completed" />

// Images
<img src="/logo.png" alt="Campreserv Logo" />

// Decorative images
<img src="/pattern.svg" alt="" aria-hidden="true" />
```

### 10. Lists

```tsx
// Good - semantic HTML
<ul>
  {items.map((item) => (
    <li key={item.id}>
      <Link href={`/items/${item.id}`}>{item.name}</Link>
    </li>
  ))}
</ul>

// For description lists
<dl>
  <dt>Check-in:</dt>
  <dd>March 15, 2024</dd>
  <dt>Check-out:</dt>
  <dd>March 20, 2024</dd>
</dl>
```

## ARIA Attributes Cheat Sheet

### Common ARIA Attributes

| Attribute          | Usage                             | Example                                       |
| ------------------ | --------------------------------- | --------------------------------------------- |
| `aria-label`       | Provides label when none visible  | `<button aria-label="Close">×</button>`       |
| `aria-labelledby`  | References ID of labeling element | `<div role="dialog" aria-labelledby="title">` |
| `aria-describedby` | References ID of description      | `<input aria-describedby="help-text">`        |
| `aria-hidden`      | Hides from screen readers         | `<span aria-hidden="true">→</span>`           |
| `aria-live`        | Announces dynamic changes         | `<div aria-live="polite">`                    |
| `aria-current`     | Indicates current item            | `<a aria-current="page">Home</a>`             |
| `aria-expanded`    | For collapsible content           | `<button aria-expanded={open}>`               |
| `aria-invalid`     | For form validation               | `<input aria-invalid={!!error}>`              |
| `aria-required`    | For required fields               | `<input aria-required={true}>`                |
| `aria-modal`       | For modal dialogs                 | `<div role="dialog" aria-modal="true">`       |

### ARIA Roles

| Role         | Usage                             | Example                                        |
| ------------ | --------------------------------- | ---------------------------------------------- |
| `alert`      | Important, time-sensitive message | `<div role="alert">`                           |
| `status`     | Advisory information              | `<div role="status">`                          |
| `navigation` | Navigation landmark               | `<nav role="navigation">`                      |
| `search`     | Search landmark                   | `<form role="search">`                         |
| `dialog`     | Dialog window                     | `<div role="dialog">`                          |
| `button`     | Button element                    | `<div role="button">` (use `<button>` instead) |

## Keyboard Navigation

### Required Key Support

- **Tab**: Move to next focusable element
- **Shift+Tab**: Move to previous focusable element
- **Enter**: Activate button/link
- **Space**: Activate button, toggle checkbox
- **Escape**: Close dialog/dropdown
- **Arrow keys**: Navigate within composite widgets (menus, tabs)

### Focus Management

```tsx
// Auto-focus first field in form
useEffect(() => {
  if (isOpen) {
    firstInputRef.current?.focus();
  }
}, [isOpen]);

// Return focus after modal closes
const previousFocus = useRef<HTMLElement>();

useEffect(() => {
  if (isOpen) {
    previousFocus.current = document.activeElement as HTMLElement;
  } else {
    previousFocus.current?.focus();
  }
}, [isOpen]);
```

## Color Contrast Requirements

### WCAG AA Requirements

- **Normal text** (< 18pt): 4.5:1 contrast ratio
- **Large text** (≥ 18pt or ≥ 14pt bold): 3:1 contrast ratio
- **UI components** (borders, icons): 3:1 contrast ratio
- **Focus indicators**: 3:1 against background

### Testing Tools

```bash
# Install Chrome DevTools Lighthouse
# Run accessibility audit
lighthouse https://localhost:3000 --view

# Install axe DevTools
# Browser extension for Chrome/Firefox
```

## Common Mistakes to Avoid

### Don't

```tsx
// Using divs instead of buttons
<div onClick={handleClick}>Click me</div>

// Missing alt text
<img src="/photo.jpg" />

// Color-only status
<span className="text-red-500">●</span>

// Unlabeled icon button
<button><Trash /></button>

// Breaking heading hierarchy
<h1>Title</h1>
<h3>Subtitle</h3> {/* Skipped h2 */}

// Missing form labels
<input type="text" placeholder="Name" />
```

### Do

```tsx
// Semantic button
<button onClick={handleClick}>Click me</button>

// Descriptive alt text
<img src="/photo.jpg" alt="Beach sunset with palm trees" />

// Text + color status
<Badge variant="error" srText="Status: error">
  Error
</Badge>

// Labeled icon button
<IconButton ariaLabel="Delete item" icon={<Trash />} />

// Proper heading hierarchy
<h1>Title</h1>
<h2>Subtitle</h2>

// Proper form labels
<FormField label="Name" type="text" />
```

## Testing Checklist

- [ ] Can navigate entire page with keyboard only
- [ ] Skip link appears on first Tab press
- [ ] All interactive elements have visible focus indicator
- [ ] All images have appropriate alt text
- [ ] All form inputs have labels
- [ ] Color is not the only way information is conveyed
- [ ] Headings follow proper hierarchy (h1 → h2 → h3)
- [ ] Dynamic content is announced to screen readers
- [ ] Dialogs trap focus and restore on close
- [ ] Error messages are associated with form fields

## Resources

- [WCAG 2.1 Quick Reference](https://www.w3.org/WAI/WCAG21/quickref/)
- [MDN Accessibility](https://developer.mozilla.org/en-US/docs/Web/Accessibility)
- [WebAIM](https://webaim.org/)
- [The A11Y Project](https://www.a11yproject.com/)
- [Inclusive Components](https://inclusive-components.design/)
