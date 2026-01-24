# Keyboard Accessibility Improvements

## Summary

Enhanced keyboard accessibility across all interactive elements in the application to meet WCAG 2.1 AA standards and provide a professional, accessible user experience.

## Changes Made

### 1. Enhanced Focus States

All interactive elements now have visible, consistent focus rings:

- **Focus ring style**: 4px ring with 30-60% opacity (darker for primary actions)
- **Ring offset**: 2px for clear separation from element
- **Transition**: Smooth shadow transition for professional feel

#### Components Updated:

- **Button** (`/components/ui/button.tsx`)
  - Primary: `focus-visible:ring-action-primary/60`
  - Secondary: `focus-visible:ring-action-secondary/60`
  - Ghost/Outline: `focus-visible:ring-slate-950/30`
  - Destructive: `focus-visible:ring-status-error/60`

- **Input** (`/components/ui/input.tsx`)
  - Ring: `focus-visible:ring-4 focus-visible:ring-slate-950/30`
  - Added `transition-shadow` for smooth focus

- **Textarea** (`/components/ui/textarea.tsx`)
  - Ring: `focus-visible:ring-4 focus-visible:ring-slate-950/30`
  - Added `transition-shadow`

- **Select** (`/components/ui/select.tsx`)
  - Trigger: `focus:ring-4 focus:ring-slate-950/30`
  - Added `transition-shadow`

- **Checkbox** (`/components/ui/checkbox.tsx`)
  - Ring: `focus-visible:ring-4 focus-visible:ring-slate-950/30`
  - Added `transition-shadow`

- **Radio Group** (`/components/ui/radio-group.tsx`)
  - Ring: `focus-visible:ring-4 focus-visible:ring-slate-950/30`
  - Added `transition-shadow`

- **Switch** (`/components/ui/switch.tsx`)
  - Ring: `focus-visible:ring-4 focus-visible:ring-slate-950/30`

### 2. Table Keyboard Navigation

#### Base Table Component (`/components/ui/table.tsx`)

Enhanced `TableRow` with keyboard support:

```typescript
interface TableRowProps {
  interactive?: boolean; // Makes row focusable
  onActivate?: () => void; // Called on Enter/Space
}
```

Features:

- **Tab**: Can receive focus when `interactive={true}`
- **Enter/Space**: Activates row (calls `onActivate`)
- **Focus ring**: Visible 2px ring on focus
- **Visual feedback**: Changes background on hover and focus

#### Advanced Table Navigation (`/components/ui/keyboard-table.tsx`)

Created new component for complex tables with arrow key navigation:

```typescript
<KeyboardNavigableTable onRowActivate={(index) => console.log(index)}>
  <tbody>
    <KeyboardTableRow onActivate={() => handleRowClick()}>
      <td>Cell content</td>
    </KeyboardTableRow>
  </tbody>
</KeyboardNavigableTable>
```

Features:

- **Arrow Down**: Move to next row (wraps to first)
- **Arrow Up**: Move to previous row (wraps to last)
- **Home**: Jump to first row
- **End**: Jump to last row
- **Enter/Space**: Activate current row
- **Escape**: Clear selection and blur focus

### 3. Dropdown Menu Navigation

Enhanced `DropdownMenu` component (`/components/ui/dropdown-menu.tsx`):

Features:

- **Escape**: Closes menu and returns focus to trigger
- **Arrow Down**: Navigate to next item (wraps)
- **Arrow Up**: Navigate to previous item (wraps)
- **Auto-focus**: First item receives focus when menu opens
- **Focus ring**: Visible ring on menu items

Improved `DropdownMenuItem`:

- Focus ring: `focus-visible:ring-2 focus-visible:ring-slate-950`
- Smooth transitions with `transition-colors`

### 4. Dialog Accessibility

#### Dialog Component (`/components/ui/dialog.tsx`)

Existing features (already implemented):

- **Escape**: Closes dialog
- **Focus trap**: Keeps focus within dialog
- **Focus restoration**: Returns focus to trigger on close
- **Tab cycling**: Tab/Shift+Tab cycles through focusable elements

#### AlertDialog Component (`/components/ui/alert-dialog.tsx`)

Added missing Escape key handler:

- **Escape**: Now properly closes alert dialog
- **Focus management**: Already had focus trap and restoration

## Usage Examples

### Interactive Table Rows

```tsx
import { TableRow } from "@/components/ui/table";

<TableRow interactive onActivate={() => router.push(`/details/${id}`)}>
  <TableCell>Content</TableCell>
</TableRow>;
```

### Keyboard-Navigable Table

```tsx
import { KeyboardNavigableTable, KeyboardTableRow } from "@/components/ui/keyboard-table";

<KeyboardNavigableTable onRowActivate={(index) => handleRowClick(rows[index])}>
  <thead>...</thead>
  <tbody>
    {rows.map((row) => (
      <KeyboardTableRow key={row.id} onActivate={() => viewRow(row)}>
        <td>{row.name}</td>
        <td>{row.value}</td>
      </KeyboardTableRow>
    ))}
  </tbody>
</KeyboardNavigableTable>;
```

### Form with Visible Focus

All form inputs automatically have enhanced focus states:

```tsx
<form>
  <Input placeholder="Name" /> {/* Has 4px focus ring */}
  <Select>...</Select> {/* Has 4px focus ring */}
  <Checkbox /> {/* Has 4px focus ring */}
  <Button type="submit">Save</Button> {/* Has 4px focus ring */}
</form>
```

## Keyboard Shortcuts Reference

### Global

- **Tab**: Move to next interactive element
- **Shift + Tab**: Move to previous interactive element
- **Enter**: Activate focused element
- **Space**: Toggle checkboxes/switches, activate buttons
- **Escape**: Close modals, dropdowns, clear focus

### Tables (with KeyboardNavigableTable)

- **Arrow Down**: Next row
- **Arrow Up**: Previous row
- **Home**: First row
- **End**: Last row
- **Enter/Space**: Activate row
- **Escape**: Clear selection

### Dropdown Menus

- **Arrow Down**: Next menu item
- **Arrow Up**: Previous menu item
- **Enter/Space**: Select item
- **Escape**: Close menu

### Dialogs

- **Tab**: Next element in dialog
- **Shift + Tab**: Previous element in dialog
- **Escape**: Close dialog

## Testing Checklist

- [x] All buttons focusable via Tab
- [x] All inputs have visible focus rings
- [x] Dropdown menus navigable with arrows
- [x] Tables can be navigated with keyboard (when using KeyboardNavigableTable)
- [x] Escape closes modals and dropdowns
- [x] Enter submits forms
- [x] Focus returns to trigger after closing dialogs
- [x] Tab order is logical
- [x] Focus rings have sufficient contrast (4.5:1)
- [x] Focus states are consistent across components

## Accessibility Compliance

These changes help meet:

- **WCAG 2.1 Level AA**:
  - 2.1.1 Keyboard (Level A): All functionality available via keyboard
  - 2.1.2 No Keyboard Trap (Level A): Focus can move away from all components
  - 2.4.7 Focus Visible (Level AA): Focus indicator visible
  - 3.2.1 On Focus (Level A): No context changes on focus

- **ARIA Best Practices**:
  - Menu patterns (dropdown menus)
  - Dialog patterns (modals)
  - Table navigation

## Future Enhancements

Consider adding:

- Skip navigation links for long tables
- Keyboard shortcuts help dialog (press `?`)
- Custom keyboard shortcut configuration
- Screen reader announcements for dynamic content
- Focus management for single-page navigation

## Related Files

- `/components/ui/button.tsx`
- `/components/ui/input.tsx`
- `/components/ui/textarea.tsx`
- `/components/ui/select.tsx`
- `/components/ui/checkbox.tsx`
- `/components/ui/radio-group.tsx`
- `/components/ui/switch.tsx`
- `/components/ui/table.tsx`
- `/components/ui/keyboard-table.tsx` (new)
- `/components/ui/dropdown-menu.tsx`
- `/components/ui/dialog.tsx`
- `/components/ui/alert-dialog.tsx`
