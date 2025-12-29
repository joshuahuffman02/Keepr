# Sync Status Indicators - Implementation Guide

## Overview

This implementation adds comprehensive offline sync status indicators throughout the Campreserv app, providing users with clear visibility into:
- Online/offline connection status
- Number of pending items waiting to sync
- Last successful sync time
- Active sync operations
- Sync errors and conflicts

## Architecture

### 1. SyncStatusContext (`/contexts/SyncStatusContext.tsx`)

Global state management for sync status across the entire application.

**Key Features:**
- Monitors 5 queue sources (guest messages, POS orders, kiosk check-ins, portal orders, activity bookings)
- Auto-refreshes every 5 seconds
- Listens to online/offline events
- Tracks sync state: `synced`, `syncing`, `pending`, `offline`, `error`
- Provides manual sync capability
- Manages conflict resolution

**Usage:**
```tsx
import { useSyncStatus } from "@/contexts/SyncStatusContext";

function MyComponent() {
  const { status, manualSync, retryConflict, discardConflict } = useSyncStatus();

  // Access sync state
  console.log(status.state); // "synced" | "syncing" | "pending" | "offline" | "error"
  console.log(status.totalPending); // Number of pending items
  console.log(status.isOnline); // Boolean
  console.log(status.queues); // Array of queue details
}
```

### 2. SyncStatus Component (`/components/sync/SyncStatus.tsx`)

Visual indicator component with three variants:

**Variants:**

1. **Badge** - Compact pill for headers
   ```tsx
   <SyncStatus variant="badge" onClick={() => openDetails()} />
   ```

2. **Compact** - Small card with icon and text
   ```tsx
   <SyncStatus variant="compact" showDetails={true} />
   ```

3. **Full** - Detailed card with all info
   ```tsx
   <SyncStatus variant="full" showDetails={true} />
   ```

**Visual States:**
- [OK] **Synced** (green) - All items synchronized
- [SYNC] **Syncing** (blue, animated) - Sync in progress
- [WARN] **Pending (X items)** (amber) - Items waiting to sync
- [ERR] **Offline** (red) - No internet connection
- [ERR] **Error** (red) - Sync conflicts need attention

### 3. SyncDetailsDrawer (`/components/sync/SyncDetailsDrawer.tsx`)

Slide-out panel showing detailed sync information and controls.

**Features:**
- Current sync status overview
- "Sync Now" manual trigger
- Queue breakdown by source
- Conflict resolution controls
- Next retry timing
- Error messages
- Help text

**Usage:**
```tsx
const [drawerOpen, setDrawerOpen] = useState(false);

<SyncDetailsDrawer open={drawerOpen} onOpenChange={setDrawerOpen} />
```

## Integration Points

### 1. DashboardShell (`/components/ui/layout/DashboardShell.tsx`)

**Location:** Fixed bottom-right corner (only when there are pending/error items)

**Implementation:**
- Shows compact sync status as floating indicator
- Only visible when: pending items > 0 OR conflicts > 0 OR offline
- Clicking opens SyncDetailsDrawer
- z-index: 50 (above content, below modals)

### 2. POS Page (`/app/pos/page.tsx`)

**Location:** Top-right header area

**Implementation:**
- Shows badge variant inline with other header buttons
- Always visible for immediate feedback during sales
- Critical for offline sales scenarios
- Clicking opens SyncDetailsDrawer

### 3. Portal Store Page (`/app/portal/store/page.tsx`)

**Location:** Top-right header area

**Implementation:**
- Shows badge variant next to cart icon
- Guest-facing visibility
- Important for offline guest purchases
- Clicking opens SyncDetailsDrawer

## Queue Sources

The system monitors these localStorage queues:

1. **Guest Messages** (`campreserv:pwa:queuedMessages`)
   - Guest chat messages sent while offline

2. **POS Orders** (`campreserv:pos:orderQueue`)
   - Point-of-sale transactions

3. **Kiosk Check-ins** (`campreserv:kiosk:checkinQueue`)
   - Self-service check-in operations

4. **Portal Orders** (`campreserv:portal:orderQueue`)
   - Guest store purchases from portal

5. **Activity Bookings** (`campreserv:portal:activityQueue`)
   - Activity reservations from guest portal

## Sync States

### Synced
- All queues empty
- Online connection available
- Last sync completed successfully
- **Visual:** Green checkmark

### Syncing
- `isSyncing` flag is true
- Active sync operation in progress
- **Visual:** Blue spinning icon

### Pending
- One or more items in queues
- Online connection available
- Waiting to sync or scheduled for retry
- **Visual:** Amber clock icon with count badge

### Offline
- No internet connection (`navigator.onLine === false`)
- Items may or may not be queued
- **Visual:** Red offline icon

### Error
- One or more conflicts detected
- Requires manual intervention
- Retry or discard actions needed
- **Visual:** Red error icon with conflict count

## Manual Sync

Users can trigger manual sync via:
1. SyncDetailsDrawer "Sync Now" button
2. Programmatic call: `manualSync()` from useSyncStatus hook

**Flow:**
1. Sets `isSyncing` flag
2. Posts message to service worker
3. Dispatches `campreserv:manual-sync` event
4. Waits 1 second
5. Refreshes status
6. Clears `isSyncing` flag

## Conflict Resolution

When a sync fails with conflict (409/412 status or conflict message):

**User Options:**
1. **Retry** - Marks item for immediate retry
2. **Discard** - Removes item from queue

**API:**
```tsx
const { retryConflict, discardConflict } = useSyncStatus();

// Retry a specific conflict
retryConflict("campreserv:pos:orderQueue", "item-id-123");

// Discard a conflict
discardConflict("campreserv:pos:orderQueue", "item-id-123");
```

## Automatic Behaviors

1. **Auto-refresh every 5 seconds**
   - Polls queue status
   - Updates UI reactively

2. **Online event listener**
   - Triggers refresh when connection restored
   - Attempts to flush queues

3. **Service worker messages**
   - Listens for SYNC_COMPLETE
   - Refreshes status on completion

4. **Background sync**
   - Registers sync tag when items queued
   - Service worker handles actual sync

## Styling

**Color Palette:**
- **Synced:** `emerald-600/50/200` (green)
- **Syncing:** `blue-600/50/200` (blue)
- **Pending:** `amber-700/50/200` (amber/yellow)
- **Offline/Error:** `red-700/50/200` (red)

**Animations:**
- Syncing icon: `animate-spin`
- Pending dot: `animate-pulse`

## Accessibility

- Semantic HTML elements
- ARIA labels on interactive elements
- Keyboard navigation support
- Screen reader friendly status updates
- Clear visual indicators beyond color alone

## Mobile Considerations

- Touch-friendly tap targets (min 44x44px)
- Responsive positioning
- Drawer slides from right on mobile
- Badge variant scales appropriately

## Performance

- Lightweight state management
- Debounced refresh (5s interval)
- Local storage only (no network calls for status)
- Memoized computations

## Testing Checklist

- [ ] Go offline and verify offline state shows
- [ ] Add item to cart while offline
- [ ] Verify pending badge shows with count
- [ ] Go online and verify auto-sync
- [ ] Trigger manual sync
- [ ] Create a conflict scenario
- [ ] Retry a conflict
- [ ] Discard a conflict
- [ ] Verify all queue sources
- [ ] Test on mobile viewport
- [ ] Test keyboard navigation
- [ ] Test screen reader announcements

## Future Enhancements

1. **Push notifications** when sync completes
2. **Estimated sync time** based on queue size
3. **Bandwidth detection** for slow connections
4. **Sync priority** for critical operations
5. **Partial sync** progress indicators
6. **Sync history** log viewer
7. **Network quality indicator**
8. **Offline mode toggle** for testing

## Troubleshooting

**Status not updating:**
- Check SyncStatusProvider is wrapping the app
- Verify client-root.tsx includes provider
- Check browser console for errors

**Queues not detected:**
- Verify localStorage keys match QUEUE_SOURCES
- Check queue item structure (needs `id`, `conflict`, etc.)
- Ensure items have `nextAttemptAt` timestamp

**Manual sync not working:**
- Check service worker is registered
- Verify navigator.serviceWorker.controller exists
- Check for error messages in console

**Conflicts not showing:**
- Ensure error responses include 409/412 status
- Verify conflict flag is set on queue items
- Check error message includes "conflict" text

## API Reference

### useSyncStatus Hook

```tsx
interface SyncStatusContextValue {
  status: SyncStatusData;
  refresh: () => void;
  manualSync: () => Promise<void>;
  clearQueue: (queueKey: string) => void;
  retryConflict: (queueKey: string, itemId: string) => void;
  discardConflict: (queueKey: string, itemId: string) => void;
}

interface SyncStatusData {
  state: "synced" | "syncing" | "pending" | "offline" | "error";
  isOnline: boolean;
  totalPending: number;
  totalConflicts: number;
  lastSyncTime: Date | null;
  isSyncing: boolean;
  queues: QueueInfo[];
  errors: string[];
}

interface QueueInfo {
  key: string;
  label: string;
  count: number;
  conflicts: number;
  nextRetry: number | null;
  lastError: string | null;
}
```

## File Structure

```
/contexts/
  SyncStatusContext.tsx       # Global state management

/components/sync/
  SyncStatus.tsx              # Visual indicator component
  SyncDetailsDrawer.tsx       # Detailed drawer panel

/app/
  client-root.tsx             # Provider wrapper

/components/ui/layout/
  DashboardShell.tsx          # Staff app integration

/app/pos/
  page.tsx                    # POS integration

/app/portal/store/
  page.tsx                    # Guest portal integration
```

## Related Files

- `/lib/offline-queue.ts` - Queue persistence utilities
- `/lib/sync-telemetry.ts` - Sync event logging
- `/public/sw.js` - Service worker (background sync)
