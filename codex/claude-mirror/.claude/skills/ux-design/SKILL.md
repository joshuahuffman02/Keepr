---
name: ux-design
description: User experience design principles for campground management software. Use when designing user flows, improving usability, or considering the end-user perspective for guests, staff, or admins.
allowed-tools: Read, Glob, Grep
---

# UX Design for Campreserv

## User Types

### 1. Guests (Public)

- **Goals**: Find and book camping spots quickly
- **Context**: Often on mobile, may be in areas with poor connectivity
- **Key flows**: Search → View availability → Book → Pay → Manage reservation

### 2. Front Desk Staff

- **Goals**: Process check-ins/outs fast, handle walk-ins, process payments
- **Context**: High-volume, time-sensitive, often interruption-driven
- **Key flows**: Check-in → Assign site → Collect payment → Print receipt

### 3. Managers/Owners

- **Goals**: Monitor performance, configure settings, run reports
- **Context**: Less frequent usage, needs comprehensive data views
- **Key flows**: View dashboard → Run reports → Adjust settings

## Core UX Principles

### 1. Speed Over Polish

Staff operations must be FAST. Every extra click costs time during busy check-in periods.

- Minimize clicks for common tasks
- Provide keyboard shortcuts
- Auto-focus important fields
- Use smart defaults

### 2. Error Prevention

- Validate inputs before submission
- Confirm destructive actions
- Show clear error messages with recovery steps
- Prevent invalid states (e.g., can't book occupied site)

### 3. Progressive Disclosure

- Show essential info first
- Hide advanced options behind "More" or expandable sections
- Use modals sparingly—only for focused tasks

### 4. Consistent Feedback

- Loading spinners for async operations
- Success toasts for completed actions
- Inline validation for forms
- Clear empty states with calls-to-action

## Key Interaction Patterns

### Calendar/Grid Booking

- Click-and-drag for date range selection
- Visual differentiation: available (green), occupied (red), blocked (gray)
- Hover tooltips with quick info
- Quick-book modal on click

### Forms

- Logical grouping with clear headers
- Required fields marked with asterisk
- Tab order follows visual flow
- Auto-save for long forms
- Show progress for multi-step flows

### Tables/Lists

- Sortable columns
- Search/filter prominently placed
- Bulk actions for multi-select
- Pagination with page size options
- Row click opens detail view

### Notifications

- Non-blocking toasts for success
- Modal alerts for critical decisions
- Badge counts for unread items
- Sound/vibration for urgent alerts (optional)

## Mobile Considerations

- Touch targets minimum 44x44px
- Bottom navigation for primary actions
- Swipe gestures where intuitive
- Simplified views (not just responsive)
- Offline capability for essential features

## Accessibility Baseline

- Keyboard navigable
- Screen reader labels
- Sufficient color contrast (4.5:1 minimum)
- Focus indicators visible
- No information by color alone

## Common Anti-patterns to Avoid

1. **Hidden primary actions** - Keep main CTAs visible
2. **Confirmation fatigue** - Don't confirm routine actions
3. **Mystery icons** - Add labels or tooltips
4. **Infinite scroll for data** - Use pagination for large datasets
5. **Form reset on error** - Preserve user input
6. **Loading without feedback** - Always show progress
