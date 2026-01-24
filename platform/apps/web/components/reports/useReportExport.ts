/**
 * Custom hook for handling report exports
 */

import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { ExportFormat } from "@/lib/export-utils";
import {
  exportArrivalsReport,
  exportDeparturesReport,
  exportInHouseGuestsReport,
  exportReservationList,
  exportLedgerReport,
  exportCancellationsReport,
  exportGenericReport,
} from "@/lib/report-export";
import { useToast } from "@/components/ui/use-toast";

type Reservation = Awaited<ReturnType<typeof apiClient.getReservations>>[number];
type Site = Awaited<ReturnType<typeof apiClient.getSites>>[number];

export function useReportExport(
  campgroundId: string | null,
  dateRange: { start: string; end: string },
) {
  const { toast } = useToast();

  // Fetch all necessary data for exports
  const { data: reservations } = useQuery({
    queryKey: ["reservations", campgroundId],
    queryFn: () => apiClient.getReservations(campgroundId!),
    enabled: !!campgroundId,
  });

  const { data: sites } = useQuery({
    queryKey: ["sites", campgroundId],
    queryFn: () => apiClient.getSites(campgroundId!),
    enabled: !!campgroundId,
  });

  const { data: ledgerEntries } = useQuery({
    queryKey: ["ledger", campgroundId],
    queryFn: () => apiClient.getLedgerEntries(campgroundId!),
    enabled: !!campgroundId,
  });

  /**
   * Export a report based on tab and subtab
   */
  const exportReport = (tab: string, subTab: string | null, format: ExportFormat = "csv") => {
    if (!reservations || !sites) {
      toast({
        title: "Export failed",
        description: "Report data is not yet loaded. Please try again.",
        variant: "destructive",
      });
      return;
    }

    try {
      // Daily reports
      if (tab === "daily") {
        switch (subTab) {
          case "arrivals-list":
            exportArrivalsReport(reservations, sites, dateRange, format);
            break;
          case "departures-list":
            exportDeparturesReport(reservations, sites, dateRange, format);
            break;
          case "in-house-guests":
            exportInHouseGuestsReport(reservations, sites, dateRange, format);
            break;
          case "transaction-log":
            if (ledgerEntries) {
              exportLedgerReport(ledgerEntries, "transaction-log", format);
            }
            break;
          case "daily-summary":
            // Export summary data
            const dailyData = prepareDailySummaryData(reservations, sites, dateRange);
            exportGenericReport(dailyData, "daily-summary", format);
            break;
          default:
            // Generic reservation export
            exportReservationList(reservations, sites, `${tab}-${subTab || "report"}`, format);
        }
      }
      // Revenue reports
      else if (tab === "revenue") {
        switch (subTab) {
          case "revenue-by-source":
          case "revenue-by-site-type":
          case "payment-methods":
            exportReservationList(
              reservations.filter((r) => r.status !== "cancelled"),
              sites,
              `${subTab}`,
              format,
            );
            break;
          default:
            exportReservationList(reservations, sites, `${tab}-${subTab || "report"}`, format);
        }
      }
      // Performance reports
      else if (tab === "performance") {
        switch (subTab) {
          case "cancellations":
            exportCancellationsReport(reservations, sites, dateRange, format);
            break;
          case "occupancy":
          case "los-analysis":
            exportReservationList(
              reservations.filter((r) => r.status !== "cancelled"),
              sites,
              `${subTab}`,
              format,
            );
            break;
          default:
            exportReservationList(reservations, sites, `${tab}-${subTab || "report"}`, format);
        }
      }
      // Guest reports
      else if (tab === "guests") {
        switch (subTab) {
          case "guest-origins":
          case "repeat-guests":
          case "new-vs-returning":
          case "top-spenders":
            exportReservationList(
              reservations.filter((r) => r.status !== "cancelled"),
              sites,
              `${subTab}`,
              format,
            );
            break;
          default:
            exportReservationList(reservations, sites, `${tab}-${subTab || "report"}`, format);
        }
      }
      // Accounting reports
      else if (tab === "accounting") {
        switch (subTab) {
          case "ledger":
            if (ledgerEntries) {
              exportLedgerReport(ledgerEntries, "ledger-summary", format);
            }
            break;
          default:
            exportReservationList(reservations, sites, `${tab}-${subTab || "report"}`, format);
        }
      }
      // Default export
      else {
        exportReservationList(reservations, sites, `${tab}-${subTab || "report"}`, format);
      }

      // Show success toast
      toast({
        title: "Export successful",
        description: `Your ${format === "xlsx" ? "Excel CSV" : "CSV"} file has been downloaded.`,
      });
    } catch (error) {
      console.error("Export error:", error);
      toast({
        title: "Export failed",
        description:
          error instanceof Error ? error.message : "An error occurred while exporting the report.",
        variant: "destructive",
      });
    }
  };

  return { exportReport };
}

/**
 * Helper function to prepare daily summary data
 */
function prepareDailySummaryData(
  reservations: Reservation[],
  sites: Site[],
  dateRange: { start: string; end: string },
) {
  const start = new Date(dateRange.start);
  const end = new Date(dateRange.end);

  const arrivals = reservations.filter((r) => {
    const arrivalDate = new Date(r.arrivalDate);
    return arrivalDate >= start && arrivalDate <= end && r.status !== "cancelled";
  }).length;

  const departures = reservations.filter((r) => {
    const departureDate = new Date(r.departureDate);
    return departureDate >= start && departureDate <= end && r.status !== "cancelled";
  }).length;

  const inHouse = reservations.filter((r) => {
    if (r.status === "cancelled") return false;
    const arrivalDate = new Date(r.arrivalDate);
    const departureDate = new Date(r.departureDate);
    return arrivalDate <= end && departureDate > start;
  }).length;

  const occupancy = sites.length > 0 ? Math.round((inHouse / sites.length) * 100) : 0;

  return [
    {
      Metric: "Arrivals",
      Value: arrivals,
    },
    {
      Metric: "Departures",
      Value: departures,
    },
    {
      Metric: "In House",
      Value: inHouse,
    },
    {
      Metric: "Occupancy",
      Value: `${occupancy}%`,
    },
  ];
}
