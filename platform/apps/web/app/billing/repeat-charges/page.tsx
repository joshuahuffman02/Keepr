"use client";

import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { DashboardShell } from "@/components/ui/layout/DashboardShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, CheckCircle, XCircle, CreditCard } from "lucide-react";
import { format } from "date-fns";
import { useToast } from "@/components/ui/use-toast";

export default function RepeatChargesPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [processingId, setProcessingId] = useState<string | null>(null);

  // Get campground ID from localStorage
  const [campgroundId, setCampgroundId] = useState<string>("");

  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = localStorage.getItem("campreserv:selectedCampground");
    if (stored) setCampgroundId(stored);
  }, []);

  const {
    data: charges,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["repeat-charges", campgroundId],
    queryFn: () => apiClient.getRepeatChargesByCampground(campgroundId),
    enabled: !!campgroundId,
  });

  const handleProcess = async (id: string) => {
    setProcessingId(id);
    try {
      await apiClient.processRepeatCharge(id, campgroundId);
      toast({
        title: "Charge Processed",
        description: "The payment has been successfully processed.",
      });
      queryClient.invalidateQueries({ queryKey: ["repeat-charges", campgroundId] });
    } catch (err) {
      toast({
        title: "Processing Failed",
        description: "Failed to process the charge. Please try again.",
        variant: "destructive",
      });
    } finally {
      setProcessingId(null);
    }
  };

  return (
    <DashboardShell>
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Scheduled Charges</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border">
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr className="border-b">
                    <th className="h-12 px-4 text-left font-medium">Due Date</th>
                    <th className="h-12 px-4 text-left font-medium">Guest</th>
                    <th className="h-12 px-4 text-left font-medium">Site</th>
                    <th className="h-12 px-4 text-left font-medium">Amount</th>
                    <th className="h-12 px-4 text-left font-medium">Status</th>
                    <th className="h-12 px-4 text-right font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {isLoading ? (
                    <tr>
                      <td colSpan={6} className="p-4">
                        <div className="space-y-3">
                          {[...Array(3)].map((_, i) => (
                            <div key={i} className="animate-pulse flex items-center gap-4 p-3">
                              <div className="flex-1 space-y-2">
                                <div className="h-4 bg-slate-200 rounded w-24" />
                                <div className="h-3 bg-slate-200 rounded w-32" />
                              </div>
                              <div className="h-4 bg-slate-200 rounded w-32" />
                              <div className="h-4 bg-slate-200 rounded w-16" />
                              <div className="h-8 w-20 bg-slate-200 rounded" />
                            </div>
                          ))}
                        </div>
                      </td>
                    </tr>
                  ) : error ? (
                    <tr>
                      <td colSpan={6} className="h-24 text-center text-red-600">
                        Failed to load charges. Please try refreshing.
                      </td>
                    </tr>
                  ) : !charges || charges.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="h-24 text-center">
                        <div className="flex flex-col items-center gap-3">
                          <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center">
                            <CreditCard className="w-6 h-6 text-slate-400" />
                          </div>
                          <div>
                            <p className="text-sm font-medium text-slate-900">
                              No scheduled charges
                            </p>
                            <p className="text-xs text-slate-500">
                              All balances are paid or no recurring charges set up
                            </p>
                          </div>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    charges.map((charge) => (
                      <tr key={charge.id} className="border-b last:border-0 hover:bg-muted/50">
                        <td className="p-4">{format(new Date(charge.dueDate), "MMM d, yyyy")}</td>
                        <td className="p-4">
                          {charge.reservation?.guest ? (
                            <div className="font-medium">
                              {charge.reservation.guest.primaryFirstName}{" "}
                              {charge.reservation.guest.primaryLastName}
                            </div>
                          ) : (
                            <span className="text-muted-foreground">Unknown Guest</span>
                          )}
                          <div className="text-xs text-muted-foreground">
                            Res #{charge.reservation?.id.slice(-6)}
                          </div>
                        </td>
                        <td className="p-4">{charge.reservation?.site?.siteNumber || "N/A"}</td>
                        <td className="p-4 font-medium">${(charge.amount / 100).toFixed(2)}</td>
                        <td className="p-4">
                          <Badge
                            variant={
                              charge.status === "paid"
                                ? "default"
                                : charge.status === "failed"
                                  ? "destructive"
                                  : "secondary"
                            }
                          >
                            {charge.status}
                          </Badge>
                        </td>
                        <td className="p-4 text-right">
                          {charge.status === "pending" && (
                            <Button
                              size="sm"
                              onClick={() => handleProcess(charge.id)}
                              disabled={processingId === charge.id}
                            >
                              {processingId === charge.id ? (
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              ) : (
                                <CreditCard className="mr-2 h-4 w-4" />
                              )}
                              Process
                            </Button>
                          )}
                          {charge.status === "paid" && (
                            <div className="flex items-center justify-end text-green-600">
                              <CheckCircle className="mr-2 h-4 w-4" />
                              Paid
                            </div>
                          )}
                          {charge.status === "failed" && (
                            <div className="flex items-center justify-end text-red-600">
                              <XCircle className="mr-2 h-4 w-4" />
                              Failed
                            </div>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardShell>
  );
}
