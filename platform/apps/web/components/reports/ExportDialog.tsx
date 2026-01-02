"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { FileSpreadsheet, FileDown, Calendar, Info } from "lucide-react";
import { ExportFormat } from "@/lib/export-utils";

export interface ExportPreview {
  reportName: string;
  subReportName: string | null;
  dateRange: { start: string; end: string };
  rowCount: number;
  tabName: string;
}

interface ExportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  exportPreview: ExportPreview | null;
  onExport: (format: ExportFormat) => void;
}

export function ExportDialog({ open, onOpenChange, exportPreview, onExport }: ExportDialogProps) {
  const [selectedFormat, setSelectedFormat] = useState<ExportFormat>('csv');

  const handleExport = () => {
    onExport(selectedFormat);
    onOpenChange(false);
  };

  if (!exportPreview) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5 text-emerald-600" />
            Export Report
          </DialogTitle>
          <DialogDescription>
            Review and download your report data
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Report Details */}
          <div className="rounded-lg border border-border bg-muted p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Report</span>
              <span className="font-medium text-foreground">{exportPreview.reportName}</span>
            </div>
            {exportPreview.subReportName && (
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">View</span>
                <span className="font-medium text-foreground">{exportPreview.subReportName}</span>
              </div>
            )}
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground flex items-center gap-1">
                <Calendar className="h-3.5 w-3.5" /> Date Range
              </span>
              <span className="font-medium text-foreground">
                {new Date(exportPreview.dateRange.start).toLocaleDateString()} — {new Date(exportPreview.dateRange.end).toLocaleDateString()}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Rows</span>
              <span className="font-medium text-foreground">~{exportPreview.rowCount.toLocaleString()}</span>
            </div>
          </div>

          {/* Format Selection */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">Export Format</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setSelectedFormat('csv')}
                className={`flex items-center justify-center gap-2 px-4 py-3 rounded-lg border-2 transition-all ${
                  selectedFormat === 'csv'
                    ? 'border-emerald-500 bg-emerald-50 text-emerald-900'
                    : 'border-border bg-card text-foreground hover:border-border'
                }`}
              >
                <FileSpreadsheet className="h-4 w-4" />
                <div className="text-left">
                  <div className="font-medium text-sm">CSV</div>
                  <div className="text-xs opacity-75">Universal format</div>
                </div>
              </button>
              <button
                onClick={() => setSelectedFormat('xlsx')}
                className={`flex items-center justify-center gap-2 px-4 py-3 rounded-lg border-2 transition-all ${
                  selectedFormat === 'xlsx'
                    ? 'border-emerald-500 bg-emerald-50 text-emerald-900'
                    : 'border-border bg-card text-foreground hover:border-border'
                }`}
              >
                <FileSpreadsheet className="h-4 w-4" />
                <div className="text-left">
                  <div className="font-medium text-sm">Excel CSV</div>
                  <div className="text-xs opacity-75">For Excel</div>
                </div>
              </button>
            </div>
          </div>

          {/* Info Note */}
          <div className="flex items-start gap-2 text-xs text-muted-foreground bg-blue-50 border border-blue-100 rounded-lg p-3">
            <Info className="h-4 w-4 text-blue-500 mt-0.5 shrink-0" />
            <span>
              Reports are read-only views of your live data. To edit reservation or billing data,
              use the <a href="/reservations" className="text-blue-600 underline">Reservations</a> or <a href="/billing" className="text-blue-600 underline">Billing</a> pages.
            </span>
          </div>
        </div>

        <DialogFooter className="flex gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleExport}
            className="flex items-center gap-2"
          >
            <FileDown className="h-4 w-4" />
            Download {selectedFormat === 'xlsx' ? 'Excel CSV' : 'CSV'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
