"use client";

import { useState, useEffect, useMemo, useId } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import {
  FileSpreadsheet,
  FileDown,
  Calendar,
  Save,
  Trash2,
  Settings2,
  Database,
  X,
} from "lucide-react";
import {
  ExportColumn,
  DATE_RANGE_PRESETS,
  loadExportPresets,
  saveExportPreset,
  deleteExportPreset,
  formatDateForInput,
  parseDateFromInput,
  ExportPreset,
} from "@/lib/export-presets";
import { ExportFormat, convertToCSV, convertToExcelCSV, downloadCSV, downloadExcelCSV, generateExportFilename } from "@/lib/export-utils";

export interface AdvancedExportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  availableColumns: ExportColumn[];
  data: any[];
  reportName: string;
  onExport?: (format: ExportFormat, columns: string[], dateRange: { start: Date; end: Date }) => void;
}

type DateRangeType = 'today' | 'week' | 'month' | 'year' | 'custom';

export function AdvancedExportDialog({
  open,
  onOpenChange,
  availableColumns,
  data,
  reportName,
  onExport,
}: AdvancedExportDialogProps) {
  const [selectedColumns, setSelectedColumns] = useState<Set<string>>(
    new Set(availableColumns.filter((col) => col.enabled).map((col) => col.key))
  );
  const [format, setFormat] = useState<ExportFormat>('csv');
  const [dateRangeType, setDateRangeType] = useState<DateRangeType>('month');
  const [customStartDate, setCustomStartDate] = useState<string>(
    formatDateForInput(new Date())
  );
  const [customEndDate, setCustomEndDate] = useState<string>(
    formatDateForInput(new Date())
  );
  const [savedPresets, setSavedPresets] = useState<ExportPreset[]>([]);
  const [presetName, setPresetName] = useState<string>('');
  const [showSavePreset, setShowSavePreset] = useState<boolean>(false);

  const selectAllId = useId();
  const presetNameId = useId();

  useEffect(() => {
    if (open && typeof window !== 'undefined') {
      setSavedPresets(loadExportPresets());
    }
  }, [open]);

  useEffect(() => {
    const enabledColumns = availableColumns.filter((col) => col.enabled).map((col) => col.key);
    setSelectedColumns(new Set(enabledColumns));
  }, [availableColumns]);

  const currentDateRange = useMemo(() => {
    if (dateRangeType === 'custom') {
      return {
        start: parseDateFromInput(customStartDate),
        end: parseDateFromInput(customEndDate),
      };
    }

    const preset = DATE_RANGE_PRESETS.find((p) => {
      const label = p.label.toLowerCase().replace(/\s+/g, '');
      return label === dateRangeType || label.startsWith(dateRangeType);
    });

    if (preset) {
      return preset.getValue();
    }

    return DATE_RANGE_PRESETS.find((p) => p.label === 'This Month')!.getValue();
  }, [dateRangeType, customStartDate, customEndDate]);

  const selectedColumnsList = useMemo(() => {
    return availableColumns.filter((col) => selectedColumns.has(col.key));
  }, [availableColumns, selectedColumns]);

  const handleToggleColumn = (columnKey: string) => {
    const newSelected = new Set(selectedColumns);
    if (newSelected.has(columnKey)) {
      newSelected.delete(columnKey);
    } else {
      newSelected.add(columnKey);
    }
    setSelectedColumns(newSelected);
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedColumns(new Set(availableColumns.map((col) => col.key)));
    } else {
      setSelectedColumns(new Set());
    }
  };

  const handleExport = () => {
    if (selectedColumns.size === 0) {
      alert('Please select at least one column to export.');
      return;
    }

    if (onExport) {
      onExport(format, Array.from(selectedColumns), currentDateRange);
      onOpenChange(false);
      return;
    }

    const filteredData = data.map((row) => {
      const filtered: any = {};
      selectedColumnsList.forEach((col) => {
        filtered[col.label] = row[col.key];
      });
      return filtered;
    });

    const headers = selectedColumnsList.map((col) => col.label);

    let csvContent: string;
    if (format === 'xlsx') {
      csvContent = convertToExcelCSV(filteredData, headers);
      const filename = generateExportFilename(reportName, 'csv');
      downloadExcelCSV(csvContent, filename);
    } else {
      csvContent = convertToCSV(filteredData, headers);
      const filename = generateExportFilename(reportName, 'csv');
      downloadCSV(csvContent, filename);
    }

    onOpenChange(false);
  };

  const handleSavePreset = () => {
    if (!presetName.trim()) {
      alert('Please enter a name for this preset.');
      return;
    }

    const preset = saveExportPreset({
      name: presetName.trim(),
      columns: Array.from(selectedColumns),
      dateRangeType,
      customDateStart: dateRangeType === 'custom' ? customStartDate : undefined,
      customDateEnd: dateRangeType === 'custom' ? customEndDate : undefined,
      format,
    });

    setSavedPresets([...savedPresets, preset]);
    setPresetName('');
    setShowSavePreset(false);
  };

  const handleLoadPreset = (preset: ExportPreset) => {
    setSelectedColumns(new Set(preset.columns));
    setDateRangeType(preset.dateRangeType);
    if (preset.customDateStart) setCustomStartDate(preset.customDateStart);
    if (preset.customDateEnd) setCustomEndDate(preset.customDateEnd);
    setFormat(preset.format);
  };

  const handleDeletePreset = (presetId: string) => {
    deleteExportPreset(presetId);
    setSavedPresets(savedPresets.filter((p) => p.id !== presetId));
  };

  const allSelected = selectedColumns.size === availableColumns.length;
  const someSelected = selectedColumns.size > 0 && selectedColumns.size < availableColumns.length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings2 className="h-5 w-5 text-emerald-600" />
            Advanced Export
          </DialogTitle>
          <DialogDescription>
            Customize your export with column selection, date ranges, and saved presets
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-hidden">
          <ScrollArea className="h-full max-h-[calc(90vh-200px)] pr-4">
            <div className="space-y-6 py-4">
              {savedPresets.length > 0 && (
                <div className="space-y-3">
                  <Label className="text-sm font-semibold">Saved Presets</Label>
                  <div className="grid grid-cols-1 gap-2">
                    {savedPresets.map((preset) => (
                      <div
                        key={preset.id}
                        className="flex items-center justify-between rounded-lg border border-border bg-muted p-3 hover:bg-muted transition-colors"
                      >
                        <button
                          onClick={() => handleLoadPreset(preset)}
                          className="flex-1 text-left"
                        >
                          <div className="font-medium text-sm text-foreground">{preset.name}</div>
                          <div className="text-xs text-muted-foreground mt-1">
                            {preset.columns.length} columns • {preset.format.toUpperCase()} • {preset.dateRangeType}
                          </div>
                        </button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDeletePreset(preset.id)}
                          className="h-8 w-8 text-muted-foreground hover:text-red-600"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <Separator />

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-semibold">Columns to Export</Label>
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id={selectAllId}
                      checked={allSelected}
                      onCheckedChange={handleSelectAll}
                      aria-label="Select all columns"
                    />
                    <Label htmlFor={selectAllId} className="text-sm font-normal cursor-pointer">
                      Select All
                    </Label>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 rounded-lg border border-border bg-muted p-4">
                  {availableColumns.map((column) => (
                    <div key={column.key} className="flex items-center gap-2">
                      <Checkbox
                        id={'column-' + column.key}
                        checked={selectedColumns.has(column.key)}
                        onCheckedChange={() => handleToggleColumn(column.key)}
                      />
                      <Label htmlFor={'column-' + column.key} className="text-sm font-normal cursor-pointer">
                        {column.label}
                      </Label>
                    </div>
                  ))}
                </div>
              </div>

              <Separator />

              <div className="space-y-3">
                <Label className="text-sm font-semibold flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  Date Range
                </Label>
                <Select
                  value={dateRangeType}
                  onValueChange={(value) => setDateRangeType(value as DateRangeType)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="today">Today</SelectItem>
                    <SelectItem value="week">This Week</SelectItem>
                    <SelectItem value="month">This Month</SelectItem>
                    <SelectItem value="year">This Year</SelectItem>
                    <SelectItem value="custom">Custom Range</SelectItem>
                  </SelectContent>
                </Select>

                {dateRangeType === 'custom' && (
                  <div className="grid grid-cols-2 gap-3 mt-3">
                    <div className="space-y-2">
                      <Label htmlFor="startDate" className="text-sm">Start Date</Label>
                      <Input
                        id="startDate"
                        type="date"
                        value={customStartDate}
                        onChange={(e) => setCustomStartDate(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="endDate" className="text-sm">End Date</Label>
                      <Input
                        id="endDate"
                        type="date"
                        value={customEndDate}
                        onChange={(e) => setCustomEndDate(e.target.value)}
                      />
                    </div>
                  </div>
                )}

                <div className="text-xs text-muted-foreground bg-blue-50 border border-blue-100 rounded-lg p-2">
                  Selected range: {currentDateRange.start.toLocaleDateString()} to {currentDateRange.end.toLocaleDateString()}
                </div>
              </div>

              <Separator />

              <div className="space-y-3">
                <Label className="text-sm font-semibold">Export Format</Label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => setFormat('csv')}
                    className={'flex items-center justify-center gap-2 px-4 py-3 rounded-lg border-2 transition-all ' + (format === 'csv' ? 'border-emerald-500 bg-emerald-50 text-emerald-900' : 'border-border bg-card text-foreground hover:border-border')}
                  >
                    <FileSpreadsheet className="h-4 w-4" />
                    <div className="text-left">
                      <div className="font-medium text-sm">CSV</div>
                      <div className="text-xs opacity-75">Universal format</div>
                    </div>
                  </button>
                  <button
                    onClick={() => setFormat('xlsx')}
                    className={'flex items-center justify-center gap-2 px-4 py-3 rounded-lg border-2 transition-all ' + (format === 'xlsx' ? 'border-emerald-500 bg-emerald-50 text-emerald-900' : 'border-border bg-card text-foreground hover:border-border')}
                  >
                    <FileSpreadsheet className="h-4 w-4" />
                    <div className="text-left">
                      <div className="font-medium text-sm">Excel CSV</div>
                      <div className="text-xs opacity-75">For Excel</div>
                    </div>
                  </button>
                </div>
              </div>

              <Separator />

              <div className="rounded-lg border border-border bg-muted p-4 space-y-2">
                <div className="flex items-center gap-2">
                  <Database className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium text-foreground">Export Summary</span>
                </div>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Rows:</span>
                    <Badge variant="outline">{data.length.toLocaleString()}</Badge>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Columns:</span>
                    <Badge variant="outline">{selectedColumns.size} of {availableColumns.length}</Badge>
                  </div>
                </div>
              </div>

              {showSavePreset ? (
                <div className="space-y-3 rounded-lg border border-emerald-200 bg-emerald-50 p-4">
                  <div className="flex items-center justify-between">
                    <Label htmlFor={presetNameId} className="text-sm font-semibold">Save Current Configuration</Label>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setShowSavePreset(false)}
                      className="h-6 w-6"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                  <Input
                    id={presetNameId}
                    placeholder="Preset name (e.g., Monthly Financial Report)"
                    value={presetName}
                    onChange={(e) => setPresetName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleSavePreset();
                      }
                    }}
                  />
                  <Button onClick={handleSavePreset} className="w-full" size="sm">
                    <Save className="h-4 w-4 mr-2" />
                    Save Preset
                  </Button>
                </div>
              ) : (
                <Button
                  variant="outline"
                  onClick={() => setShowSavePreset(true)}
                  className="w-full"
                >
                  <Save className="h-4 w-4 mr-2" />
                  Save as Preset
                </Button>
              )}
            </div>
          </ScrollArea>
        </div>

        <DialogFooter className="flex gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleExport}
            disabled={selectedColumns.size === 0}
            className="flex items-center gap-2"
          >
            <FileDown className="h-4 w-4" />
            Export {selectedColumns.size > 0 ? selectedColumns.size + ' columns' : ''}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
