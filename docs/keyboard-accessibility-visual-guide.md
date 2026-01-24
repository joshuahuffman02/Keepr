# Keyboard Accessibility - Visual Guide

## Focus Ring Improvements

### Before vs After

#### Input Fields

**Before**:

```
Ring: 2px solid
Opacity: 100%
Color: slate-950
```

Visual: Thin, harsh line that could be jarring

**After**:

```
Ring: 4px solid
Opacity: 30%
Color: slate-950
Transition: smooth shadow
```

Visual: Soft, glowing halo that's prominent but not jarring

#### Buttons

**Before**:

```
Primary: ring-action-primary/50 (2px)
```

Visual: Barely visible on colored backgrounds

**After**:

```
Primary: ring-action-primary/60 (4px)
Ghost/Outline: ring-slate-950/30 (4px)
```

Visual: Clear indication on all backgrounds

## Component-by-Component Guide

### 1. Text Inputs

```tsx
<Input placeholder="Search sites..." />
```

**Keyboard Behavior**:

- Tab: Focus input (4px blue-ish ring appears)
- Type: Enter text
- Enter: Submit form (if in form)
- Tab: Move to next field

**Visual Feedback**:

- Unfocused: 1px gray border
- Focused: 4px ring + 2px offset, smooth transition
- Error: Red ring instead of blue

### 2. Buttons

```tsx
<Button>Save Changes</Button>
```

**Keyboard Behavior**:

- Tab: Focus button (4px ring appears)
- Enter/Space: Click button
- Tab: Move to next element

**Visual Feedback**:

- Primary: Emerald ring
- Ghost: Gray ring
- Destructive: Red ring

### 3. Checkboxes

```tsx
<Checkbox />
```

**Keyboard Behavior**:

- Tab: Focus checkbox (4px ring appears)
- Space: Toggle checked state
- Tab: Move to next element

**Visual Feedback**:

- Ring appears around checkbox
- Checkmark animates in/out

### 4. Select Dropdowns

```tsx
<Select>
  <SelectTrigger>
    <SelectValue />
  </SelectTrigger>
  <SelectContent>
    <SelectItem value="1">Option 1</SelectItem>
  </SelectContent>
</Select>
```

**Keyboard Behavior**:

- Tab: Focus trigger
- Enter/Space: Open dropdown
- Arrow Down/Up: Navigate options
- Enter/Space: Select option
- Escape: Close without selecting

**Visual Feedback**:

- Trigger: 4px ring when focused
- Items: Background highlight on keyboard navigation

### 5. Dropdown Menus

```tsx
<DropdownMenu>
  <DropdownMenuTrigger>Options</DropdownMenuTrigger>
  <DropdownMenuContent>
    <DropdownMenuItem>Edit</DropdownMenuItem>
    <DropdownMenuItem>Delete</DropdownMenuItem>
  </DropdownMenuContent>
</DropdownMenu>
```

**Keyboard Behavior**:

- Tab: Focus trigger
- Enter/Space: Open menu, first item auto-focused
- Arrow Down: Next item (wraps to top)
- Arrow Up: Previous item (wraps to bottom)
- Enter/Space: Select item
- Escape: Close menu, return focus to trigger

**Visual Feedback**:

- Menu items: 2px ring on keyboard focus
- Background highlight on hover/focus

### 6. Tables (Simple)

```tsx
<Table>
  <TableBody>
    <TableRow interactive onActivate={() => alert("clicked")}>
      <TableCell>Content</TableCell>
    </TableRow>
  </TableBody>
</Table>
```

**Keyboard Behavior**:

- Tab: Focus row (2px ring appears)
- Enter/Space: Activate row
- Tab: Next row or next element

**Visual Feedback**:

- Focused row: 2px ring + background highlight
- Cursor: pointer on hover

### 7. Tables (Advanced)

```tsx
<KeyboardNavigableTable>
  <tbody>
    <KeyboardTableRow onActivate={() => {}}>
      <td>Content</td>
    </KeyboardTableRow>
  </tbody>
</KeyboardNavigableTable>
```

**Keyboard Behavior**:

- Tab: Focus table
- Arrow Down: Next row
- Arrow Up: Previous row
- Home: First row
- End: Last row
- Enter/Space: Activate current row
- Escape: Clear focus
- Tab: Exit table

**Visual Feedback**:

- Current row: 2px ring + background highlight
- Smooth transitions between rows

### 8. Dialogs/Modals

```tsx
<Dialog open={open} onOpenChange={setOpen}>
  <DialogContent>
    <DialogHeader>
      <DialogTitle>Confirm Action</DialogTitle>
    </DialogHeader>
    <Button>Confirm</Button>
  </DialogContent>
</Dialog>
```

**Keyboard Behavior**:

- Auto-focus first element (usually close button)
- Tab: Next focusable element
- Shift+Tab: Previous element (wraps within dialog)
- Escape: Close dialog, return focus to trigger
- Enter: Submit if in form

**Visual Feedback**:

- Focus trapped within dialog
- Elements show 4px rings as usual
- Background dimmed

### 9. Switches

```tsx
<Switch />
```

**Keyboard Behavior**:

- Tab: Focus switch (4px ring appears)
- Space: Toggle on/off
- Tab: Move to next element

**Visual Feedback**:

- Ring around entire switch track
- Smooth thumb animation

### 10. Radio Groups

```tsx
<RadioGroup>
  <RadioGroupItem value="a" />
  <RadioGroupItem value="b" />
</RadioGroup>
```

**Keyboard Behavior**:

- Tab: Focus first/checked item
- Arrow Down/Right: Next item
- Arrow Up/Left: Previous item
- Tab: Exit group

**Visual Feedback**:

- 4px ring around focused radio
- Center dot fills on selection

## Accessibility Patterns

### Focus Order

Logical tab order:

1. Skip links (if present)
2. Main navigation
3. Page header
4. Main content (forms, tables, etc.)
5. Sidebar
6. Footer

### Focus Trap (Modals)

When modal opens:

1. Background becomes inert
2. Focus moves to first element in modal
3. Tab cycles only within modal
4. Escape closes modal
5. Focus returns to trigger element

### Focus Visibility

All interactive elements have:

- Minimum 3:1 contrast ratio for focus indicator
- 2px offset to separate from element border
- Smooth transitions to avoid jarring changes
- Consistent ring style across components

## Testing Checklist

Use this checklist when testing keyboard accessibility:

### Basic Navigation

- [ ] Tab reaches all interactive elements
- [ ] Tab order is logical (top to bottom, left to right)
- [ ] Shift+Tab moves backwards correctly
- [ ] No keyboard traps (can always move focus away)
- [ ] Skip links work (if implemented)

### Visual Indicators

- [ ] Focus rings visible on all elements
- [ ] Focus rings have sufficient contrast
- [ ] Focus state different from hover state
- [ ] Smooth transitions, not jarring
- [ ] Consistent appearance across components

### Forms

- [ ] Tab moves through fields in order
- [ ] Enter submits form
- [ ] Space toggles checkboxes/radios
- [ ] Labels properly associated with inputs
- [ ] Error messages announced and visible

### Menus & Dropdowns

- [ ] Arrow keys navigate items
- [ ] Enter/Space selects item
- [ ] Escape closes menu
- [ ] Focus returns to trigger on close
- [ ] First item auto-focused on open

### Tables

- [ ] Rows focusable (if interactive)
- [ ] Arrow keys navigate rows (if enabled)
- [ ] Enter/Space activates row
- [ ] Escape clears selection
- [ ] Column headers properly marked

### Dialogs

- [ ] Auto-focus first element
- [ ] Tab cycles only within dialog
- [ ] Escape closes dialog
- [ ] Focus returns to trigger
- [ ] Background not interactable

## Common Issues & Fixes

### Issue: Focus ring not visible

**Problem**: Custom styling removes outline

```tsx
className = "outline-none";
```

**Fix**: Use focus-visible instead

```tsx
className = "focus-visible:outline-none focus-visible:ring-4";
```

### Issue: Can't tab to element

**Problem**: Not keyboard accessible

```tsx
<div onClick={handleClick}>Click me</div>
```

**Fix**: Use button or add tabIndex

```tsx
<button onClick={handleClick}>Click me</button>
// OR
<div tabIndex={0} onClick={handleClick} onKeyDown={handleKeyDown}>Click me</div>
```

### Issue: Custom component not accessible

**Problem**: Missing ARIA attributes

```tsx
<CustomDropdown>...</CustomDropdown>
```

**Fix**: Add proper ARIA

```tsx
<button aria-haspopup="menu" aria-expanded={open}>
  Toggle
</button>
<div role="menu">
  <button role="menuitem">Item 1</button>
</div>
```

## Resources

- [WCAG 2.1 Guidelines](https://www.w3.org/WAI/WCAG21/quickref/)
- [ARIA Authoring Practices Guide](https://www.w3.org/WAI/ARIA/apg/)
- [Radix UI Documentation](https://www.radix-ui.com/docs/primitives/overview/accessibility)
- [WebAIM Keyboard Accessibility](https://webaim.org/articles/keyboard/)

---

**Last Updated**: January 2026
**Status**: Current
**Applies To**: All Campreserv UI components
