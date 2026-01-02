---
name: accessibility
description: Web accessibility (a11y) guidelines and WCAG compliance. Use when building forms, interactive components, or ensuring the application is usable by people with disabilities.
allowed-tools: Read, Write, Edit, Glob, Grep
---

# Accessibility for Campreserv

## WCAG 2.1 Level AA Compliance

### Core Principles (POUR)
1. **Perceivable** - Users can perceive the content
2. **Operable** - Users can navigate and interact
3. **Understandable** - Content is clear and predictable
4. **Robust** - Works with assistive technologies

## Color Contrast

### Minimum Ratios
- **Normal text**: 4.5:1
- **Large text (18px+ bold or 24px+)**: 3:1
- **UI components**: 3:1

### Testing
```tsx
// Tailwind classes with good contrast
<p className="text-slate-900">High contrast text</p>  // Good
<p className="text-slate-500">Muted text</p>          // Check this
<p className="text-slate-300">Low contrast</p>        // Likely fails

// Primary button
<button className="bg-emerald-600 text-white">       // Good contrast
```

### Never Rely on Color Alone
```tsx
// BAD - Color only
<span className="text-red-500">Error</span>

// GOOD - Color + icon + text
<span className="text-red-500 flex items-center gap-1">
  <AlertCircle className="h-4 w-4" />
  Error: Invalid email
</span>
```

## Keyboard Navigation

### Focus Management
```tsx
// Always visible focus indicators
<button className="focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2">

// Skip to main content link
<a href="#main-content" className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4">
  Skip to main content
</a>
```

### Tab Order
```tsx
// Natural tab order (no tabIndex needed usually)
<form>
  <input type="text" />      {/* Tab 1 */}
  <input type="email" />     {/* Tab 2 */}
  <button type="submit" />   {/* Tab 3 */}
</form>

// Remove from tab order when hidden
<div hidden tabIndex={-1}>Not tabbable</div>
```

### Keyboard Shortcuts
```tsx
// Escape to close modals
useEffect(() => {
  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Escape") onClose();
  };
  window.addEventListener("keydown", handleKeyDown);
  return () => window.removeEventListener("keydown", handleKeyDown);
}, [onClose]);
```

## Screen Readers

### Semantic HTML
```tsx
// Use proper elements
<nav>...</nav>           // Navigation
<main>...</main>         // Main content
<article>...</article>   // Self-contained content
<aside>...</aside>       // Sidebar
<header>...</header>     // Page/section header
<footer>...</footer>     // Page/section footer
```

### ARIA Labels
```tsx
// Label for icon-only buttons
<button aria-label="Close dialog">
  <X className="h-4 w-4" />
</button>

// Describe current state
<button aria-pressed={isActive}>Toggle</button>
<div aria-expanded={isOpen}>Expandable section</div>

// Live regions for dynamic content
<div role="status" aria-live="polite">
  {message}  {/* Announced when changes */}
</div>

// Alert for important messages
<div role="alert">
  Error: Form submission failed
</div>
```

### Form Accessibility
```tsx
<div>
  <label htmlFor="email" id="email-label">
    Email address
    <span className="text-red-500" aria-hidden="true">*</span>
  </label>
  <input
    id="email"
    type="email"
    aria-labelledby="email-label"
    aria-describedby="email-hint email-error"
    aria-required="true"
    aria-invalid={!!error}
  />
  <p id="email-hint" className="text-sm text-slate-500">
    We'll never share your email
  </p>
  {error && (
    <p id="email-error" className="text-sm text-red-500" role="alert">
      {error}
    </p>
  )}
</div>
```

## Images and Media

```tsx
// Informative images - describe content
<img src="site-map.jpg" alt="Map showing campsite A-12 near the lake" />

// Decorative images - empty alt
<img src="decorative-border.png" alt="" />

// Complex images - long description
<figure>
  <img src="revenue-chart.png" alt="Revenue chart" aria-describedby="chart-desc" />
  <figcaption id="chart-desc">
    Revenue increased 25% from January to March 2024...
  </figcaption>
</figure>
```

## Interactive Components

### Buttons vs Links
```tsx
// Button - performs action
<button onClick={handleSubmit}>Submit</button>

// Link - navigates
<Link href="/reservations">View reservations</Link>

// NEVER do this
<div onClick={handleClick}>Fake button</div>  // Not accessible!
```

### Modal Dialogs
```tsx
<div
  role="dialog"
  aria-modal="true"
  aria-labelledby="dialog-title"
  aria-describedby="dialog-description"
>
  <h2 id="dialog-title">Confirm Cancellation</h2>
  <p id="dialog-description">
    Are you sure you want to cancel this reservation?
  </p>
  {/* Focus trap inside modal */}
</div>
```

## Testing Checklist

- [ ] Tab through entire page - logical order?
- [ ] All interactive elements have visible focus state?
- [ ] Screen reader announces content correctly?
- [ ] Color contrast passes (use browser dev tools)?
- [ ] Works without mouse?
- [ ] Error messages are clear and associated with fields?
- [ ] Dynamic content announced to screen readers?
- [ ] Images have appropriate alt text?
