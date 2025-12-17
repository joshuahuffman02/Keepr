# Global Keyboard Shortcuts System

A comprehensive keyboard shortcuts system for power users has been implemented across the application.

## Implementation Overview

### Files Created/Modified

1. **`/contexts/KeyboardShortcutsContext.tsx`** - Main provider with global keyboard listener
2. **`/components/ui/keyboard-shortcuts-dialog.tsx`** - Reference panel component
3. **`/components/ui/layout/AdminTopBar.tsx`** - Updated to integrate with new system
4. **`/app/providers.tsx`** - Added KeyboardShortcutsProvider
5. **`/app/help/shortcuts/page.tsx`** - Updated documentation page

## Features

### Global Shortcuts (Work Even in Input Fields)
- **Cmd/Ctrl + K**: Open global search
- **Cmd/Ctrl + /**: Open help panel
- **Escape**: Close any open modal/dialog
- **?**: Show keyboard shortcuts reference panel

### Navigation (Sequential Shortcuts - Press One After Another)
- **G then D**: Go to Dashboard
- **G then C**: Go to Calendar
- **G then R**: Go to Reservations
- **G then G**: Go to Guests
- **G then P**: Go to POS
- **G then M**: Go to Messages
- **G then S**: Go to Settings

### Quick Actions
- **Cmd/Ctrl + N**: New booking

## How It Works

### 1. KeyboardShortcutsProvider
The provider manages all keyboard shortcuts globally:
- Listens to `keydown` events on the document
- Tracks input focus state to avoid conflicts when typing
- Handles sequential shortcuts with a 1-second timeout
- Provides a context for components to register/unregister shortcuts

### 2. Sequential Shortcuts
For shortcuts like "G then D":
1. User presses **G** (primes the system)
2. System waits up to 1 second for the next key
3. User presses **D** (executes the shortcut)
4. If timeout expires, the sequence is reset

### 3. Input Field Protection
The system automatically detects when the user is typing in:
- `<input>` elements
- `<textarea>` elements
- `<select>` elements
- Content-editable elements

For non-global shortcuts, they are disabled when typing to prevent conflicts.

### 4. Callbacks System
Components can register callbacks for global actions:
```typescript
useEffect(() => {
  if (typeof window !== "undefined" && window.__keyboardShortcuts) {
    window.__keyboardShortcuts.onSearch(() => {
      // Handle search open
    });
  }
}, []);
```

## UI Indicators

### 1. Keyboard Button in Top Bar
A new keyboard icon button in the AdminTopBar opens the shortcuts reference panel.

### 2. Keyboard Hints
The search button in the top bar shows "⌘K" as a hint.

### 3. Shortcuts Reference Dialog
Pressing **?** anywhere opens a beautiful modal showing:
- All available shortcuts grouped by category
- Platform-specific key names (⌘ on Mac, Ctrl on Windows/Linux)
- Pro tips for power users
- Link to full documentation

## Usage Examples

### For End Users
1. Press **?** to see all shortcuts
2. Press **Cmd+K** to quickly search
3. Press **G then D** to navigate to Dashboard
4. Press **ESC** to close any modal

### For Developers - Adding Custom Shortcuts

```typescript
import { useKeyboardShortcuts } from '@/contexts/KeyboardShortcutsContext';

function MyComponent() {
  const { registerShortcut, unregisterShortcut } = useKeyboardShortcuts();

  useEffect(() => {
    const shortcut = {
      id: 'my-custom-shortcut',
      keys: ['cmd', 'shift', 'x'],
      description: 'Do something custom',
      action: () => {
        console.log('Custom action!');
      },
      category: 'actions' as const,
      enabled: true,
    };

    registerShortcut(shortcut);

    return () => unregisterShortcut('my-custom-shortcut');
  }, []);

  return <div>My Component</div>;
}
```

## Benefits

1. **Improved Productivity**: Power users can navigate and perform actions much faster
2. **Better UX**: Consistent keyboard shortcuts across the entire application
3. **Discoverability**: Built-in reference panel (press ?) makes shortcuts easy to learn
4. **Extensible**: Easy for developers to add custom shortcuts
5. **Smart**: Automatically disabled when typing to prevent conflicts

## Platform Compatibility

- **Mac**: Uses ⌘ (Command) key
- **Windows/Linux**: Uses Ctrl key
- Auto-detects platform and shows appropriate key labels

## Accessibility

- All shortcuts have clear descriptions
- Visual indicators in the UI
- ESC key always closes modals for keyboard navigation
- Works alongside mouse/touch interactions

## Future Enhancements

Possible additions:
- User-customizable shortcuts
- Shortcut recording/macro system
- Per-page context shortcuts
- Shortcut conflicts detection
- Analytics on most-used shortcuts
