# Accessibility Documentation

Welcome to the Campreserv accessibility documentation. This README serves as the central hub for all accessibility-related resources.

## Documentation Index

### For Developers

1. **[Quick Reference Guide](./ACCESSIBILITY_QUICK_REFERENCE.md)** - Start here!
   - Common patterns and examples
   - ARIA cheat sheet
   - Quick wins and best practices
   - Testing checklist

2. **[Migration Guide](./ACCESSIBILITY_MIGRATION_GUIDE.md)** - Updating existing code
   - Component-by-component migration examples
   - Before/after comparisons
   - Priority order for updates

3. **[Implementation Summary](./ACCESSIBILITY_IMPLEMENTATION_SUMMARY.md)** - What changed
   - Complete list of modified files
   - New components created
   - WCAG compliance status

### Detailed Documentation

4. **[Full Accessibility Improvements](./ACCESSIBILITY_IMPROVEMENTS.md)** - Deep dive
   - Detailed explanations of all changes
   - WCAG criteria mapping
   - Testing recommendations
   - Future enhancements

### Examples

5. **[Accessible Reservation Card Example](./components/examples/AccessibleReservationCard.example.tsx)**
   - Complete reference implementation
   - Inline documentation
   - Real-world patterns

## Quick Start

### 1. New Component Checklist

When creating a new component:

```tsx
import { Badge, Button, FormField, IconButton } from "@/components/ui";
import { useAccessibility } from "@/components/accessibility/AccessibilityProvider";

function MyComponent() {
  const { announceMessage } = useAccessibility();

  return (
    <article aria-labelledby="title">
      <h2 id="title">My Component</h2>
      {/* Use semantic HTML and accessible components */}
    </article>
  );
}
```

### 2. Required Components

Import these for accessible patterns:

```tsx
// Form inputs
import { FormField } from "@/components/ui/form-field";

// Icon buttons
import { IconButton } from "@/components/ui/icon-button";

// Loading states
import { LoadingSpinner } from "@/components/ui/loading-spinner";

// Screen reader only text
import { VisuallyHidden } from "@/components/ui/visually-hidden";

// Announcements
import { useAccessibility } from "@/components/accessibility/AccessibilityProvider";
```

### 3. Common Patterns

**Icon-only button:**

```tsx
<IconButton ariaLabel="Delete item" icon={<Trash className="h-4 w-4" />} onClick={handleDelete} />
```

**Status badge:**

```tsx
<Badge variant="success" srText="Status: Active">
  Active
</Badge>
```

**Form field:**

```tsx
<FormField
  label="Email"
  type="email"
  error={errors.email}
  helperText="We'll send confirmation here"
  required
/>
```

## WCAG 2.1 AA Compliance

### What We've Achieved

**Level A (Critical):**

- 1.3.1 Info and Relationships
- 1.4.1 Use of Color
- 2.1.1 Keyboard
- 2.1.2 No Keyboard Trap
- 2.4.1 Bypass Blocks
- 3.3.2 Labels or Instructions
- 4.1.2 Name, Role, Value

**Level AA (Important):**

- 1.4.3 Contrast (Minimum)
- 2.4.7 Focus Visible
- 3.3.3 Error Suggestion
- 4.1.3 Status Messages

## Testing

### Manual Testing

1. **Keyboard Navigation**
   - Press Tab to navigate
   - Verify skip link appears first
   - Check all interactive elements are reachable
   - Test Escape closes modals

2. **Screen Reader** (Mac: Cmd+F5 for VoiceOver)
   - Navigate with VO + Arrow keys
   - Verify announcements
   - Check form labels
   - Test error messages

3. **Visual**
   - Check focus rings are visible
   - Verify color contrast
   - Test reduced motion preference

### Automated Testing

```bash
# Using Lighthouse
lighthouse https://localhost:3000 --view

# Using axe DevTools
# 1. Install browser extension
# 2. Open DevTools > axe DevTools tab
# 3. Click "Scan All of My Page"
```

## New Components

### Accessibility Components

Located in `/components/accessibility/`:

- **AccessibilityProvider** - Global accessibility context
  - Provides `announceMessage()` for screen reader announcements
  - Detects `prefers-reduced-motion`

### UI Components

Located in `/components/ui/`:

- **SkipToContent** - Skip navigation link
- **IconButton** - Accessible icon-only buttons
- **LoadingSpinner** - Accessible loading indicator
- **VisuallyHidden** - Screen reader-only content
- **FormField** - Fully accessible form input (enhanced)

### Enhanced Components

- **Badge** - Now supports `srText` and `statusText`
- **Button** - Enhanced focus rings
- **Dialog** - Focus trap and ARIA attributes
- **Toast** - Live region announcements

## Styling Utilities

New CSS utilities in `globals.css`:

```css
/* Screen reader only */
.sr-only

/* Remove sr-only on focus (for skip links) */
.focus:not-sr-only

/* Respects reduced motion preference */
@media (prefers-reduced-motion: reduce)

/* Enhanced focus ring helper */
.focus-ring-enhanced
```

## Configuration

### Provider Setup

Already configured in `app/providers.tsx`:

```tsx
<AccessibilityProvider>
  <YourApp />
</AccessibilityProvider>
```

### Skip Link

Already added to `app/client-root.tsx`:

```tsx
<SkipToContent />
```

### Main Content Target

Add to your main content area:

```tsx
<main id="main-content">{/* Your content */}</main>
```

## Learning Path

### For New Developers

1. Read [Quick Reference Guide](./ACCESSIBILITY_QUICK_REFERENCE.md)
2. Review [Accessible Reservation Card Example](./components/examples/AccessibleReservationCard.example.tsx)
3. Practice with small components
4. Use automated testing tools

### For Existing Codebase

1. Read [Implementation Summary](./ACCESSIBILITY_IMPLEMENTATION_SUMMARY.md)
2. Follow [Migration Guide](./ACCESSIBILITY_MIGRATION_GUIDE.md)
3. Migrate components by priority
4. Test thoroughly

### For Deep Understanding

1. Read [Full Accessibility Improvements](./ACCESSIBILITY_IMPROVEMENTS.md)
2. Review WCAG 2.1 guidelines
3. Practice with screen readers
4. Learn keyboard navigation patterns

## Resources

### Internal

- [Quick Reference](./ACCESSIBILITY_QUICK_REFERENCE.md) - Patterns and examples
- [Migration Guide](./ACCESSIBILITY_MIGRATION_GUIDE.md) - How to update code
- [Implementation Summary](./ACCESSIBILITY_IMPLEMENTATION_SUMMARY.md) - What changed
- [Full Documentation](./ACCESSIBILITY_IMPROVEMENTS.md) - Complete details
- [Example Component](./components/examples/AccessibleReservationCard.example.tsx) - Reference

### External

- [WCAG 2.1 Guidelines](https://www.w3.org/WAI/WCAG21/quickref/)
- [MDN Accessibility](https://developer.mozilla.org/en-US/docs/Web/Accessibility)
- [WebAIM](https://webaim.org/)
- [The A11Y Project](https://www.a11yproject.com/)
- [Inclusive Components](https://inclusive-components.design/)

## Key Principles

### 1. Semantic HTML First

Use the right HTML element for the job.

### 2. Keyboard Navigation

All functionality must work with keyboard only.

### 3. Screen Reader Support

Provide context and announcements.

### 4. Visual Clarity

Sufficient contrast and visible focus indicators.

### 5. Progressive Enhancement

Build accessible, then enhance.

## Contributing

When adding new features:

1. Use semantic HTML
2. Import accessible components
3. Add proper ARIA attributes
4. Test with keyboard and screen reader
5. Run automated tests
6. Document any new patterns

## Common Questions

**Q: Do I need to use all these components?**
A: Use them where appropriate. FormField for forms, IconButton for icon buttons, etc.

**Q: What if I need a custom component?**
A: Follow the patterns in the example component and use proper ARIA attributes.

**Q: How do I test accessibility?**
A: Use keyboard navigation, screen readers, and automated tools like axe DevTools.

**Q: What about existing components?**
A: Follow the Migration Guide to update them incrementally.

**Q: Is this required for all new code?**
A: Yes, all new components should follow these patterns.

## Support

For accessibility questions:

1. Check the Quick Reference Guide
2. Review the example component
3. Read the relevant documentation
4. Test with automated tools
5. Ask the team for guidance

## Success Stories

Before implementing these changes:

- Keyboard users couldn't navigate efficiently
- Screen readers missed important context
- Status indicators relied on color alone
- Forms lacked proper error announcements

After implementing these changes:

- [OK] Skip link for efficient keyboard navigation
- [OK] Comprehensive screen reader support
- [OK] Text-based status indicators
- [OK] Accessible form validation
- [OK] Enhanced focus indicators
- [OK] WCAG 2.1 AA compliant

---

**Remember:** Accessibility benefits everyone, not just users with disabilities. It improves usability, SEO, and overall user experience.

**Last Updated:** December 2024
**WCAG Version:** 2.1 Level AA
**Status:** Core improvements complete
