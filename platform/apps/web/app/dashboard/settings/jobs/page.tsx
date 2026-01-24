"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatDistanceToNow } from "date-fns";
import { Button } from "@/components/ui/button";

export default function JobsPage() {
  const qc = useQueryClient();
  const { data: campgrounds = [] } = useQuery({
    queryKey: ["campgrounds"],
    queryFn: () => apiClient.getCampgrounds(),
  });
  const [selectedCampgroundId, setSelectedCampgroundId] = useState<string | null>(null);

  // Mirror the global campground selector (stored in localStorage by the header)
  useEffect(() => {
    if (campgrounds.length === 0) return;
    let stored: string | null = null;
    if (typeof window !== "undefined") {
      stored = localStorage.getItem("campreserv:selectedCampground");
    }
    const storedValid = stored && campgrounds.some((cg) => cg.id === stored);
    const currentValid =
      selectedCampgroundId && campgrounds.some((cg) => cg.id === selectedCampgroundId);

    if (!currentValid && storedValid && stored) {
      setSelectedCampgroundId(stored);
      return;
    }
    if (!currentValid && campgrounds.length > 0) {
      setSelectedCampgroundId(campgrounds[0].id);
    }
  }, [campgrounds, selectedCampgroundId]);

  useEffect(() => {
    // react to global selector changes (other tabs/routes)
    const onStorage = (e: StorageEvent) => {
      if (e.key === "campreserv:selectedCampground" && e.newValue) {
        setSelectedCampgroundId(e.newValue);
      }
    };
    if (typeof window !== "undefined") {
      window.addEventListener("storage", onStorage);
      return () => window.removeEventListener("storage", onStorage);
    }
  }, []);

  const campground = campgrounds.find((cg) => cg.id === selectedCampgroundId) || campgrounds[0];

  const jobsQuery = useQuery({
    queryKey: ["playbook-jobs", campground?.id],
    queryFn: () => apiClient.listPlaybookJobs(campground!.id, undefined),
    enabled: !!campground?.id,
    refetchInterval: 15000,
  });

  const retryMutation = useMutation({
    mutationFn: (jobId: string) => apiClient.retryPlaybookJob(jobId, campground?.id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["playbook-jobs", campground?.id] });
    },
  });

  const jobs = jobsQuery.data || [];

  const statusColor = (status: string) => {
    if (status === "sent") return "bg-status-success-bg text-status-success-text";
    if (status === "failed") return "bg-status-error-bg text-status-error-text";
    if (status === "pending") return "bg-status-warning-bg text-status-warning-text";
    if (status === "processing") return "bg-status-info-bg text-status-info-text";
    return "bg-muted text-muted-foreground";
  };

  return (
    <div>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Playbook Jobs</h1>
            <p className="text-sm text-muted-foreground">
              Campground: {campground?.name || "Use the global selector in the header"}
            </p>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Jobs</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {jobsQuery.isLoading && <div className="text-sm text-muted-foreground">Loading…</div>}
            {!jobsQuery.isLoading && jobs.length === 0 && (
              <div className="text-sm text-muted-foreground">No jobs found.</div>
            )}
            {jobs.map((j) => (
              <div
                key={j.id}
                className="border border-border rounded p-3 flex items-center justify-between gap-3"
              >
                <div className="flex-1">
                  <div className="text-sm font-semibold text-foreground">{j.playbookId}</div>
                  <div className="text-xs text-muted-foreground">
                    Scheduled {formatDistanceToNow(new Date(j.scheduledAt), { addSuffix: true })} •
                    Attempts {j.attempts}
                    {j.lastError ? ` • Error: ${j.lastError}` : ""}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge className={statusColor(j.status)}>{j.status}</Badge>
                  {j.status === "failed" && (
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={retryMutation.isPending}
                      onClick={() => retryMutation.mutate(j.id)}
                    >
                      {retryMutation.isPending ? "Retrying…" : "Retry"}
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
