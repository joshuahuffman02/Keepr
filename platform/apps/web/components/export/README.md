# Advanced Export Dialog

A comprehensive, flexible export dialog component for exporting tabular data with advanced features.

## Features

### 1. Column Picker
- Checkbox list to select which columns to export
- Select All / Deselect All functionality
- Visual indication of selected columns
- Preserves column order from original data

### 2. Format Options
- CSV format (universal compatibility)
- Excel CSV format (with UTF-8 BOM for Excel)
- Visual format selection buttons

### 3. Date Range Selection
- **Presets:**
  - Today
  - This Week
  - This Month
  - Last Month
  - This Year
  - Last Year
- **Custom Range:** Date picker inputs for start and end dates
- Visual preview of selected date range

### 4. Saved Presets
- Save current export configuration as a named preset
- Load saved presets with one click
- Delete unwanted presets
- Stored in localStorage (persists across sessions)
- Shows column count, format, and date range for each preset

### 5. Export Summary
- Real-time row count display
- Column count (selected / total)
- Visual badges for quick reference

### 6. File Generation
- Automatic filename generation with timestamp
- Proper CSV escaping for special characters
- Excel-compatible CSV with BOM
- Browser download trigger

## File Structure

```
platform/apps/web/
├── components/export/
│   ├── AdvancedExportDialog.tsx        # Main component
│   ├── AdvancedExportDialog.example.tsx # Usage example
│   └── README.md                       # This file
└── lib/
    ├── export-presets.ts               # Preset management utilities
    └── export-utils.ts                 # CSV export utilities (existing)
```

## Usage

### Basic Example

```typescript
import { useState } from "react";
import { AdvancedExportDialog } from "@/components/export/AdvancedExportDialog";
import { ExportColumn } from "@/lib/export-presets";

function MyComponent() {
  const [showExport, setShowExport] = useState(false);

  const columns: ExportColumn[] = [
    { key: "id", label: "ID", enabled: true },
    { key: "name", label: "Name", enabled: true },
    { key: "email", label: "Email", enabled: true },
    { key: "phone", label: "Phone", enabled: false },
  ];

  const data = [
    { id: "1", name: "John", email: "hello@keeprstay.com", phone: "555-0100" },
    { id: "2", name: "Jane", email: "hello@keeprstay.com", phone: "555-0101" },
  ];

  return (
    <>
      <button onClick={() => setShowExport(true)}>Export</button>
      
      <AdvancedExportDialog
        open={showExport}
        onOpenChange={setShowExport}
        availableColumns={columns}
        data={data}
        reportName="User Report"
      />
    </>
  );
}
```

### With Custom Export Handler

```typescript
<AdvancedExportDialog
  open={showExport}
  onOpenChange={setShowExport}
  availableColumns={columns}
  data={data}
  reportName="Custom Report"
  onExport={(format, selectedColumns, dateRange) => {
    console.log("Format:", format);
    console.log("Columns:", selectedColumns);
    console.log("Date Range:", dateRange);
    
    // Implement custom export logic here
    // e.g., API call to generate server-side export
  }}
/>
```

## Props

### AdvancedExportDialogProps

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `open` | `boolean` | Yes | Controls dialog visibility |
| `onOpenChange` | `(open: boolean) => void` | Yes | Callback when dialog open state changes |
| `availableColumns` | `ExportColumn[]` | Yes | Array of available columns with metadata |
| `data` | `any[]` | Yes | Array of data objects to export |
| `reportName` | `string` | Yes | Name used for generated filename |
| `onExport` | `(format, columns, dateRange) => void` | No | Custom export handler (overrides default) |

### ExportColumn Interface

```typescript
interface ExportColumn {
  key: string;      // Property key in data object
  label: string;    // Display label for column header
  enabled: boolean; // Whether selected by default
}
```

## API Reference

### export-presets.ts

#### Types

```typescript
interface ExportPreset {
  id: string;
  name: string;
  columns: string[];
  dateRangeType: 'today' | 'week' | 'month' | 'year' | 'custom';
  customDateStart?: string;
  customDateEnd?: string;
  format: 'csv' | 'xlsx';
  createdAt: string;
}

interface DateRangePreset {
  label: string;
  getValue: () => { start: Date; end: Date };
}
```

#### Functions

- `loadExportPresets(): ExportPreset[]` - Load all saved presets from localStorage
- `saveExportPreset(preset): ExportPreset` - Save a new preset
- `deleteExportPreset(id): void` - Delete a preset by ID
- `loadPresetById(id): ExportPreset | null` - Load specific preset
- `updateExportPreset(id, updates): ExportPreset | null` - Update existing preset
- `formatDateForInput(date): string` - Format Date for input[type="date"]
- `parseDateFromInput(dateString): Date` - Parse date from input value

#### Constants

- `DATE_RANGE_PRESETS: DateRangePreset[]` - Predefined date range presets

## Design Patterns Used

### 1. Controlled Component Pattern
Dialog state is managed by parent component for maximum flexibility.

### 2. Hydration Safety
All localStorage operations check `typeof window !== 'undefined'` to prevent SSR errors.

### 3. Accessibility
- Semantic HTML with proper labels
- ARIA attributes where needed
- Keyboard navigation support
- Focus trap within dialog
- Screen reader friendly

### 4. React Best Practices
- Uses `useId()` for generating unique IDs
- `useMemo` for expensive computations
- `useEffect` for side effects
- Proper TypeScript types throughout

### 5. Separation of Concerns
- UI logic in component
- Business logic in utilities
- Data persistence abstracted to export-presets.ts

## Styling

Uses existing UI component library:
- Dialog (custom implementation)
- Button (class-variance-authority)
- Checkbox (Radix UI)
- Select (Radix UI)
- Input (native with Tailwind)
- ScrollArea (custom)
- Separator (custom)
- Badge (custom)

All styling uses Tailwind CSS classes matching the existing design system.

## Browser Compatibility

- Modern browsers (Chrome, Firefox, Safari, Edge)
- Requires localStorage support
- Requires ES6+ features (arrow functions, template literals, destructuring)

## Future Enhancements

Potential improvements:
- [ ] Drag-and-drop column reordering
- [ ] Column grouping
- [ ] Preview before export
- [ ] Multiple file format support (JSON, XLSX with sheets)
- [ ] Email export option
- [ ] Scheduled/recurring exports
- [ ] Cloud storage integration (Google Drive, Dropbox)
- [ ] Export templates per report type
- [ ] Column filtering/search
- [ ] Bulk preset management

## Testing Recommendations

1. **Unit Tests:**
   - export-presets utility functions
   - Date range preset calculations
   - CSV generation with special characters

2. **Integration Tests:**
   - Preset save/load/delete flow
   - Column selection persistence
   - Date range selection behavior

3. **E2E Tests:**
   - Complete export workflow
   - File download verification
   - Multi-session preset persistence

## Troubleshooting

### Preset not saving
- Check browser localStorage quota
- Verify browser allows localStorage
- Check console for errors

### CSV not downloading
- Verify browser allows downloads
- Check popup blocker settings
- Test with smaller dataset

### Date range incorrect
- Check timezone handling
- Verify date input format (YYYY-MM-DD)
- Test edge cases (month boundaries, leap years)

## Related Components

- `ExportDialog` - Simple export dialog (existing)
- `export-utils.ts` - Core CSV utilities (existing)

## License

Internal use only - Campreserv platform.
