"use client";

/**
 * Example usage of AdvancedExportDialog
 * 
 * This file demonstrates how to integrate the AdvancedExportDialog component
 * into your pages or components.
 */

import { useState } from "react";
import { AdvancedExportDialog } from "./AdvancedExportDialog";
import { ExportColumn } from "@/lib/export-presets";
import { Button } from "@/components/ui/button";
import { FileSpreadsheet } from "lucide-react";

interface ReservationData {
  id: string;
  guestName: string;
  siteName: string;
  checkIn: string;
  checkOut: string;
  status: string;
  totalCents: number;
  balanceCents: number;
}

export function ExampleReservationsPage() {
  const [showExportDialog, setShowExportDialog] = useState(false);

  const sampleData: ReservationData[] = [
    {
      id: "res_001",
      guestName: "John Smith",
      siteName: "Site A-12",
      checkIn: "2026-01-15",
      checkOut: "2026-01-20",
      status: "confirmed",
      totalCents: 45000,
      balanceCents: 0,
    },
    {
      id: "res_002",
      guestName: "Jane Doe",
      siteName: "Cabin 5",
      checkIn: "2026-01-18",
      checkOut: "2026-01-22",
      status: "pending",
      totalCents: 78000,
      balanceCents: 78000,
    },
  ];

  const availableColumns: ExportColumn[] = [
    { key: "id", label: "Reservation ID", enabled: true },
    { key: "guestName", label: "Guest Name", enabled: true },
    { key: "siteName", label: "Site", enabled: true },
    { key: "checkIn", label: "Check-In Date", enabled: true },
    { key: "checkOut", label: "Check-Out Date", enabled: true },
    { key: "status", label: "Status", enabled: true },
    { key: "totalCents", label: "Total Amount", enabled: true },
    { key: "balanceCents", label: "Balance Due", enabled: false },
  ];

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Reservations</h1>
        <Button onClick={() => setShowExportDialog(true)}>
          <FileSpreadsheet className="h-4 w-4 mr-2" />
          Advanced Export
        </Button>
      </div>

      <AdvancedExportDialog
        open={showExportDialog}
        onOpenChange={setShowExportDialog}
        availableColumns={availableColumns}
        data={sampleData}
        reportName="Reservations Report"
        onExport={(format, columns, dateRange) => {
          console.log("Export requested:", { format, columns, dateRange });
        }}
      />
    </div>
  );
}
