# Guide: Adding Export to New Report Components

## Quick Start

If you create a new report component and want to add export functionality, follow these steps:

## Option 1: Add to useReportExport Hook (Recommended)

The easiest way is to add your report to the `useReportExport` hook.

### Step 1: Identify your report's tab and subtab
From the registry, find your report's `tab` and `subTab` values.

Example: `tab: 'performance'`, `subTab: 'site-utilization'`

### Step 2: Add export case to useReportExport.ts

Open `/components/reports/useReportExport.ts` and add a case for your report:

```typescript
// Performance reports
else if (tab === 'performance') {
  switch (subTab) {
    case 'cancellations':
      exportCancellationsReport(reservations, sites, dateRange, format);
      break;
    case 'site-utilization': // Your new report
      exportSiteUtilizationReport(reservations, sites, dateRange, format);
      break;
    // ... other cases
  }
}
```

### Step 3: Create your export function

Add a new export function to `/lib/report-export.ts`:

```typescript
export function exportSiteUtilizationReport(
  reservations: ReservationData[],
  sites: SiteData[],
  dateRange: { start: string; end: string },
  format: ExportFormat = 'csv'
) {
  // 1. Filter/transform your data
  const utilizationData = calculateSiteUtilization(reservations, sites, dateRange);

  // 2. Map to export format
  const exportData = utilizationData.map((item) => ({
    'Site': item.siteName,
    'Total Nights Available': item.totalNights,
    'Nights Booked': item.bookedNights,
    'Utilization %': (item.bookedNights / item.totalNights * 100).toFixed(1),
    'Revenue': formatCurrencyForExport(item.revenue),
    'RevPAN': formatCurrencyForExport(item.revPAN),
  }));

  // 3. Generate CSV and download
  const csv = convertToCSV(exportData);
  const filename = generateExportFilename('site-utilization-report', format);

  if (format === 'xlsx') {
    downloadExcelCSV(csv, filename);
  } else {
    downloadCSV(csv, filename);
  }
}
```

### Step 4: Test
Navigate to your report and click Export. Your report should now download!

## Option 2: Use Generic Export

If your report has straightforward tabular data, use the generic export:

```typescript
else if (tab === 'performance') {
  switch (subTab) {
    case 'simple-report':
      // Just export the reservation list directly
      exportReservationList(reservations, sites, 'simple-report', format);
      break;
  }
}
```

## Option 3: Custom Export in Report Component

For reports with unique export needs, you can add export directly to the component:

```typescript
import { convertToCSV, downloadCSV, formatCurrencyForExport } from '@/lib/export-utils';

export function CustomReport() {
  const handleExport = () => {
    // 1. Get your data
    const data = computeReportData();

    // 2. Transform to export format
    const exportData = data.map(row => ({
      'Column 1': row.value1,
      'Column 2': formatCurrencyForExport(row.amount),
      'Column 3': row.value3,
    }));

    // 3. Export
    const csv = convertToCSV(exportData);
    downloadCSV(csv, 'my-custom-report.csv');
  };

  return (
    <div>
      <Button onClick={handleExport}>Export This Report</Button>
      {/* ... report content */}
    </div>
  );
}
```

## Common Patterns

### Currency Values
Always use `formatCurrencyForExport()` for monetary values:
```typescript
'Revenue': formatCurrencyForExport(amountInCents)
```

### Dates
Use `formatDateForExport()` for consistent date formatting:
```typescript
'Date': formatDateForExport(dateString)
```

### Percentages
Format as string with % symbol:
```typescript
'Occupancy': `${occupancyRate.toFixed(1)}%`
```

### Guest Names
Handle missing data gracefully:
```typescript
'Guest': `${guest?.firstName || ''} ${guest?.lastName || ''}`.trim()
```

### Site Names
Use a lookup helper:
```typescript
const getSiteName = (siteId: string) =>
  sites.find(s => s.id === siteId)?.name ?? 'Unknown';
```

## Multi-Section Exports

For reports with multiple data sections:

```typescript
import { convertToCSVWithSections } from '@/lib/export-utils';

const sections = [
  {
    title: 'Summary Statistics',
    data: summaryData,
  },
  {
    title: 'Detailed Breakdown',
    data: detailData,
  },
  {
    title: 'Top Performers',
    data: topPerformers,
  }
];

const csv = convertToCSVWithSections(sections);
downloadCSV(csv, 'multi-section-report.csv');
```

## Custom Headers

Specify custom column headers:

```typescript
const headers = ['Site ID', 'Site Name', 'Revenue', 'Occupancy %'];
const data = sites.map(s => ({
  'Site ID': s.id,
  'Site Name': s.name,
  'Revenue': formatCurrencyForExport(s.revenue),
  'Occupancy %': s.occupancy,
}));

const csv = convertToCSV(data, headers);
```

## Handling Special Characters

The export utilities automatically handle:
- Commas in text fields
- Quotes in text fields
- Newlines in text fields

Just pass the raw values - escaping is automatic:

```typescript
{
  'Guest Notes': 'Has "special" requests, needs late check-in',
  // Will export as: "Has ""special"" requests, needs late check-in"
}
```

## Error Handling

Always wrap exports in try/catch:

```typescript
try {
  exportMyReport(data, sites, dateRange, format);
  toast({
    title: "Export successful",
    description: "Your report has been downloaded.",
  });
} catch (error) {
  console.error('Export error:', error);
  toast({
    title: "Export failed",
    description: error.message,
    variant: "destructive",
  });
}
```

## Best Practices

1. **Column Names**: Use clear, descriptive column headers
2. **Formatting**: Format numbers consistently (2 decimals for currency, 1 for percentages)
3. **Empty Values**: Use empty string or "—" for null/undefined
4. **Sorting**: Sort data logically before export (by date, by revenue, alphabetically)
5. **Filtering**: Respect the report's current filters in the export
6. **Date Range**: Use the current date range from the report UI
7. **Large Data**: Test with 1000+ rows to ensure performance
8. **Filenames**: Use descriptive, timestamped filenames

## Testing Checklist

- [ ] Export button appears and is clickable
- [ ] File downloads to browser's download folder
- [ ] Filename includes report name and date
- [ ] CSV opens correctly in Excel
- [ ] CSV opens correctly in Google Sheets
- [ ] Special characters display correctly
- [ ] Currency values formatted properly (2 decimals)
- [ ] Dates formatted as YYYY-MM-DD
- [ ] Column headers are clear and descriptive
- [ ] All visible data is included in export
- [ ] Empty/null values handled gracefully
- [ ] Toast notification appears on success
- [ ] Error handling works (test with empty data)

## Troubleshooting

### File doesn't download
- Check browser console for errors
- Verify data is not empty
- Check that `Blob` API is supported

### Special characters broken in Excel
- Use Excel CSV format instead of standard CSV
- Ensure UTF-8 BOM is included (use `downloadExcelCSV()`)

### Column headers missing
- Make sure you're using `convertToCSV()` correctly
- Headers are auto-generated from object keys

### Numbers formatted as text in Excel
- This is normal for CSV - Excel treats everything as text
- For true numeric columns, would need XLSX format

### Export very slow
- Consider limiting rows (first 10,000)
- Add loading indicator
- Process data in chunks for very large datasets
