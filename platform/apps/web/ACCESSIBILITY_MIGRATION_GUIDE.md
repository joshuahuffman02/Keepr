# Accessibility Migration Guide

This guide helps you migrate existing components to use the new accessible patterns and components.

## Quick Wins - Apply These Everywhere

### 1. Update Icon-Only Buttons

**Before:**

```tsx
<button onClick={handleDelete}>
  <Trash className="h-4 w-4" />
</button>
```

**After (Option 1 - Using IconButton):**

```tsx
import { IconButton } from "@/components/ui/icon-button";

<IconButton
  ariaLabel="Delete reservation"
  icon={<Trash className="h-4 w-4" />}
  onClick={handleDelete}
/>;
```

**After (Option 2 - Manual):**

```tsx
<button onClick={handleDelete} aria-label="Delete reservation">
  <Trash className="h-4 w-4" aria-hidden="true" />
</button>
```

### 2. Add aria-hidden to Decorative Icons

**Before:**

```tsx
<Calendar className="h-4 w-4" />
Today's Schedule
```

**After:**

```tsx
<Calendar className="h-4 w-4" aria-hidden="true" />
Today's Schedule
```

### 3. Enhance Status Badges

**Before:**

```tsx
<Badge variant="success">Active</Badge>
```

**After:**

```tsx
<Badge variant="success" srText="Status: Active and available">
  Active
</Badge>
```

### 4. Update Form Inputs

**Before:**

```tsx
<div>
  <label htmlFor="email">Email</label>
  <input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
  {error && <p className="text-red-500">{error}</p>}
</div>
```

**After:**

```tsx
import { FormField } from "@/components/ui/form-field";

<FormField
  label="Email"
  type="email"
  value={email}
  onChange={(e) => setEmail(e.target.value)}
  error={error}
  helperText="We'll never share your email"
  required
/>;
```

### 5. Update Loading States

**Before:**

```tsx
{
  isLoading && <div className="spinner" />;
}
```

**After:**

```tsx
import { LoadingSpinner } from "@/components/ui/loading-spinner";

{
  isLoading && <LoadingSpinner label="Loading reservations" />;
}
```

## Component-by-Component Migration

### Migrating a Card Component

**Before:**

```tsx
function ReservationCard({ reservation }) {
  return (
    <div className="card">
      <div className="card-header">
        <div className="text-lg font-bold">{reservation.guestName}</div>
        <span className={cn("badge", reservation.status === "confirmed" && "bg-green-500")}>
          {reservation.status}
        </span>
      </div>
      <div className="card-body">
        <Calendar className="h-4 w-4" />
        {reservation.checkIn} - {reservation.checkOut}
      </div>
      <button onClick={handleDelete}>
        <Trash className="h-4 w-4" />
      </button>
    </div>
  );
}
```

**After:**

```tsx
import { Badge } from "@/components/ui/badge";
import { IconButton } from "@/components/ui/icon-button";
import { VisuallyHidden } from "@/components/ui/visually-hidden";

function ReservationCard({ reservation }) {
  return (
    <article className="card" aria-labelledby={`reservation-${reservation.id}-title`}>
      <header className="card-header">
        <h2 id={`reservation-${reservation.id}-title`} className="text-lg font-bold">
          {reservation.guestName}
          <VisuallyHidden>, reservation details</VisuallyHidden>
        </h2>
        <Badge
          variant={reservation.status === "confirmed" ? "success" : "warning"}
          srText={`Reservation status: ${reservation.status}`}
        >
          {reservation.status}
        </Badge>
      </header>

      <div className="card-body">
        <div className="flex items-center gap-2">
          <Calendar className="h-4 w-4" aria-hidden="true" />
          <time dateTime={reservation.checkIn}>{formatDate(reservation.checkIn)}</time>
          {" - "}
          <time dateTime={reservation.checkOut}>{formatDate(reservation.checkOut)}</time>
        </div>
      </div>

      <IconButton
        ariaLabel={`Delete reservation for ${reservation.guestName}`}
        icon={<Trash className="h-4 w-4" />}
        onClick={handleDelete}
      />
    </article>
  );
}
```

### Migrating a Form

**Before:**

```tsx
function BookingForm({ onSubmit }) {
  const [formData, setFormData] = useState({ name: "", email: "", phone: "" });
  const [errors, setErrors] = useState({});

  return (
    <form onSubmit={onSubmit}>
      <div>
        <label>Guest Name</label>
        <input
          type="text"
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
        />
        {errors.name && <span className="error">{errors.name}</span>}
      </div>

      <div>
        <label>Email</label>
        <input
          type="email"
          value={formData.email}
          onChange={(e) => setFormData({ ...formData, email: e.target.value })}
        />
        {errors.email && <span className="error">{errors.email}</span>}
      </div>

      <button type="submit">Book Now</button>
    </form>
  );
}
```

**After:**

```tsx
import { FormField } from "@/components/ui/form-field";
import { Button } from "@/components/ui/button";

function BookingForm({ onSubmit }) {
  const [formData, setFormData] = useState({ name: "", email: "", phone: "" });
  const [errors, setErrors] = useState({});

  return (
    <form onSubmit={onSubmit} aria-labelledby="booking-form-title">
      <h2 id="booking-form-title" className="sr-only">
        Guest Information
      </h2>

      <div className="space-y-4">
        <FormField
          label="Guest Name"
          type="text"
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          error={errors.name}
          required
        />

        <FormField
          label="Email Address"
          type="email"
          value={formData.email}
          onChange={(e) => setFormData({ ...formData, email: e.target.value })}
          error={errors.email}
          helperText="We'll send your confirmation here"
          required
        />

        <FormField
          label="Phone Number"
          type="tel"
          value={formData.phone}
          onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
          error={errors.phone}
          helperText="Optional, for text message updates"
        />
      </div>

      <Button type="submit" className="mt-6">
        Book Now
      </Button>
    </form>
  );
}
```

### Migrating a Modal/Dialog

**Before:**

```tsx
function DeleteModal({ isOpen, onClose, onConfirm }) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h3>Confirm Deletion</h3>
        <p>Are you sure you want to delete this reservation?</p>
        <button onClick={onClose}>Cancel</button>
        <button onClick={onConfirm}>Delete</button>
      </div>
    </div>
  );
}
```

**After:**

```tsx
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

function DeleteModal({ isOpen, onClose, onConfirm }) {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Confirm Deletion</DialogTitle>
          <DialogDescription>
            Are you sure you want to delete this reservation? This action cannot be undone.
          </DialogDescription>
        </DialogHeader>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={onConfirm}>
            Delete
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

### Migrating a Data Table

**Before:**

```tsx
function ReservationsTable({ reservations }) {
  return (
    <div className="table-container">
      <div className="table-header">
        <div>Guest</div>
        <div>Check-in</div>
        <div>Status</div>
      </div>
      {reservations.map((r) => (
        <div key={r.id} className="table-row">
          <div>{r.guestName}</div>
          <div>{r.checkIn}</div>
          <div className={`status-${r.status}`}>{r.status}</div>
        </div>
      ))}
    </div>
  );
}
```

**After:**

```tsx
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

function ReservationsTable({ reservations }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Guest</TableHead>
          <TableHead>Check-in</TableHead>
          <TableHead>Status</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {reservations.map((r) => (
          <TableRow key={r.id}>
            <TableCell className="font-medium">{r.guestName}</TableCell>
            <TableCell>
              <time dateTime={r.checkIn}>{formatDate(r.checkIn)}</time>
            </TableCell>
            <TableCell>
              <Badge
                variant={r.status === "confirmed" ? "success" : "warning"}
                srText={`Reservation status: ${r.status}`}
              >
                {r.status}
              </Badge>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
```

## Common Patterns

### Pattern 1: Lists of Items

**Before:**

```tsx
<div className="grid gap-4">
  {items.map((item) => (
    <div key={item.id}>...</div>
  ))}
</div>
```

**After:**

```tsx
<ul className="grid gap-4" role="list">
  {items.map((item) => (
    <li key={item.id}>
      <article aria-labelledby={`item-${item.id}-title`}>
        <h3 id={`item-${item.id}-title`}>{item.name}</h3>
        ...
      </article>
    </li>
  ))}
</ul>
```

### Pattern 2: Action Menus

**Before:**

```tsx
<div className="menu">
  <button onClick={handleEdit}>Edit</button>
  <button onClick={handleDelete}>Delete</button>
</div>
```

**After:**

```tsx
<nav aria-label="Reservation actions">
  <ul role="menu">
    <li role="none">
      <button role="menuitem" onClick={handleEdit}>
        Edit Reservation
      </button>
    </li>
    <li role="none">
      <button role="menuitem" onClick={handleDelete}>
        Delete Reservation
      </button>
    </li>
  </ul>
</nav>
```

### Pattern 3: Collapsible Sections

**Before:**

```tsx
const [isOpen, setIsOpen] = useState(false)

<div>
  <button onClick={() => setIsOpen(!isOpen)}>
    Details {isOpen ? "▼" : "▶"}
  </button>
  {isOpen && <div>Content...</div>}
</div>
```

**After:**

```tsx
const [isOpen, setIsOpen] = useState(false)

<div>
  <button
    onClick={() => setIsOpen(!isOpen)}
    aria-expanded={isOpen}
    aria-controls="details-content"
  >
    Details
    <span aria-hidden="true">{isOpen ? "▼" : "▶"}</span>
  </button>
  {isOpen && (
    <div id="details-content" role="region">
      Content...
    </div>
  )}
</div>
```

## Testing Your Migrations

After migrating a component, test it with:

1. **Keyboard navigation**

   ```
   - Tab through all interactive elements
   - Verify focus is visible
   - Test Enter/Space on buttons
   - Test Escape on modals
   ```

2. **Screen reader** (VoiceOver on Mac: Cmd+F5)

   ```
   - Navigate with VO+arrow keys
   - Verify all content is announced
   - Check form labels are read
   - Test error announcements
   ```

3. **Visual inspection**

   ```
   - Check focus rings are visible
   - Verify color contrast
   - Test with high contrast mode
   - Check reduced motion works
   ```

4. **Automated tools**
   ```bash
   # Install axe DevTools browser extension
   # Right-click > Inspect > axe DevTools tab
   # Click "Scan All of My Page"
   ```

## Checklist for Each Component

- [ ] Replace divs with semantic HTML (article, section, nav, etc.)
- [ ] Add proper heading hierarchy (h1 → h2 → h3)
- [ ] Add aria-hidden to decorative icons
- [ ] Add aria-labels to icon-only buttons
- [ ] Use FormField for all form inputs
- [ ] Add status text to badges, not just color
- [ ] Add aria-live to dynamic content
- [ ] Add focus indicators to custom components
- [ ] Use semantic lists (ul, ol) where appropriate
- [ ] Add time elements with datetime for dates
- [ ] Test with keyboard only
- [ ] Test with screen reader

## Priority Order for Migration

1. **Critical** - User-facing forms (booking, check-in, settings)
2. **High** - Main navigation and dashboard
3. **Medium** - Data tables and lists
4. **Low** - Admin-only pages and reports

## Getting Help

- Review `ACCESSIBILITY_QUICK_REFERENCE.md` for patterns
- Check `AccessibleReservationCard.example.tsx` for complete example
- See `ACCESSIBILITY_IMPROVEMENTS.md` for detailed explanations
- Test with automated tools (axe DevTools, Lighthouse)

---

Remember: Accessibility is not a one-time fix, but an ongoing commitment to inclusive design. Every new component should follow these patterns from the start.
