# CSV Export Implementation for Reports

## Overview
This implementation adds fully functional CSV/Excel export capabilities to the reports system. Previously, the export dialog only showed a preview but didn't actually download anything. Now it supports actual file downloads with proper CSV formatting and Excel compatibility.

## Files Created

### 1. `/lib/export-utils.ts`
Core utility functions for CSV export:
- `escapeCSVField()` - Properly escapes CSV special characters (commas, quotes, newlines)
- `convertToCSV()` - Converts array of objects to CSV format
- `convertToCSVWithSections()` - Handles multi-section CSV exports
- `downloadFile()` - Triggers browser file download
- `downloadCSV()` - Downloads standard CSV
- `downloadExcelCSV()` - Downloads Excel-compatible CSV with BOM
- `formatCurrencyForExport()` - Formats currency values (cents to dollars)
- `formatDateForExport()` - Formats dates consistently
- `generateExportFilename()` - Creates timestamped filenames

### 2. `/lib/report-export.ts`
Report-specific export logic:
- `exportArrivalsReport()` - Exports arrivals with guest details, dates, and balance
- `exportDeparturesReport()` - Exports departures with similar details
- `exportInHouseGuestsReport()` - Exports current in-house guests with nights remaining
- `exportReservationList()` - Generic reservation export with all key fields
- `exportLedgerReport()` - Exports transaction/ledger data
- `exportRevenueSummary()` - Exports revenue summaries
- `exportCancellationsReport()` - Exports cancelled reservations with lost revenue
- `exportGenericReport()` - Fallback for any data array

### 3. `/components/reports/ExportDialog.tsx`
Enhanced export dialog component:
- Format selection (CSV vs Excel CSV)
- Visual format picker with icons and descriptions
- Shows report details (name, date range, row count)
- Cleaner UI with proper button states
- Success/error handling

### 4. `/components/reports/useReportExport.ts`
Custom React hook for export logic:
- Manages data fetching for exports
- Routes different report types to appropriate export functions
- Handles all major report categories (Daily, Revenue, Performance, Guests, Accounting)
- Shows toast notifications for success/failure
- Includes helper functions for data preparation

## Files Modified

### `/app/reports/page.tsx`
- Added imports for new export components and utilities
- Integrated `useReportExport` hook
- Replaced old export dialog with new `ExportDialog` component (2 instances)
- Connected export button to new export logic with format selection

## Features

### 1. Proper CSV Formatting
- Escapes special characters (commas, quotes, newlines)
- Double-quotes fields containing special characters
- Handles null/undefined values gracefully

### 2. Excel Compatibility
- Option to export "Excel CSV" with UTF-8 BOM
- Ensures Excel correctly interprets CSV data
- Proper encoding for special characters

### 3. Format Selection
Users can choose between:
- **CSV**: Universal format, works with all spreadsheet apps
- **Excel CSV**: Optimized for Microsoft Excel with BOM encoding

### 4. Report Type Support
Currently handles:
- **Daily Reports**: Arrivals, Departures, In-House Guests, Transaction Log, Daily Summary
- **Revenue Reports**: Revenue by Source, by Site Type, Payment Methods
- **Performance Reports**: Cancellations, Occupancy, Length of Stay
- **Guest Reports**: Guest Origins, Repeat Guests, Top Spenders
- **Accounting Reports**: Ledger Summary
- **Generic**: Any other report with tabular data

### 5. Data Included in Exports

#### Arrivals/Departures Export
- Guest Name
- Site Number
- Arrival Date
- Departure Date
- Adults/Children count
- Total Amount
- Paid Amount
- Balance
- Status

#### In-House Guests Export
- All fields from Arrivals/Departures
- Plus: Nights Remaining

#### Generic Reservation Export
- Reservation ID
- Guest Name
- Site
- Arrival/Departure Dates
- Number of Nights
- Adults/Children
- Total/Paid/Balance amounts
- Status

### 6. Toast Notifications
- Success message on export completion
- Error message if export fails
- Shows which format was exported

## Usage

1. Navigate to any report in the Reports section
2. Click the "Export [Report Name]" button
3. Review the export preview dialog
4. Select format (CSV or Excel CSV)
5. Click "Download" button
6. File downloads automatically to browser's download folder

## File Naming Convention
Files are named: `{report-name}-{YYYY-MM-DD}.{format}`

Examples:
- `arrivals-report-2025-12-16.csv`
- `in-house-guests-report-2025-12-16.csv`
- `revenue-by-source-2025-12-16.csv`

## Technical Details

### CSV Escaping Rules
1. Fields containing commas, quotes, or newlines are wrapped in double quotes
2. Double quotes within fields are escaped by doubling them (`"` becomes `""`)
3. Null/undefined values export as empty strings
4. Numbers are formatted consistently (currency to 2 decimals, dates as YYYY-MM-DD)

### Excel BOM
Excel CSV exports include a UTF-8 Byte Order Mark (BOM) at the start of the file. This ensures Excel correctly interprets the encoding and displays special characters properly.

### Type Safety
All export functions are fully typed with TypeScript interfaces:
- `ReservationData`
- `SiteData`
- `LedgerEntry`
- `ExportFormat`
- `ExportPreview`

## Future Enhancements

Potential improvements:
1. Add true XLSX export (using a library like `xlsx` or `exceljs`)
2. Add PDF export option
3. Include charts/visualizations in exports
4. Email export option
5. Scheduled exports
6. Custom column selection
7. Export templates
8. Batch export multiple reports

## Testing

To test the implementation:
1. Verify CSV downloads actually occur (check browser downloads)
2. Open CSV in Excel/Google Sheets - check formatting
3. Verify special characters (names with commas, quotes) export correctly
4. Test with empty/null data
5. Try different report types (Daily, Revenue, Performance, etc.)
6. Test both CSV and Excel CSV formats
7. Verify toast notifications appear
8. Check filename includes correct date

## Browser Compatibility
Uses standard browser APIs:
- `Blob` API for file creation
- `URL.createObjectURL()` for download links
- `<a>` element download attribute

Compatible with all modern browsers (Chrome, Firefox, Safari, Edge).
