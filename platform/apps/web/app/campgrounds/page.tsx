"use client";

import { Suspense, useEffect } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "../../lib/api-client";
import { Button } from "../../components/ui/button";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { DashboardShell } from "../../components/ui/layout/DashboardShell";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../components/ui/select";
import { CampgroundSchema } from "@keepr/shared";
import type { z } from "zod";

function CampgroundsPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const skipRedirect = searchParams.get("all") === "true";
  const goto = searchParams.get("goto"); // Support redirect to specific sub-page

  const { data, isLoading, error } = useQuery({
    queryKey: ["campgrounds"],
    queryFn: () => apiClient.getCampgrounds()
  });
  const qc = useQueryClient();

  // Auto-redirect to single campground for better UX
  useEffect(() => {
    if (!isLoading && !skipRedirect && data?.length === 1) {
      const subPage = goto || "sites";
      router.replace(`/campgrounds/${data[0].id}/${subPage}`);
    }
  }, [data, isLoading, skipRedirect, router, goto]);
  const depositMutation = useMutation({
    mutationFn: ({ id, rule }: { id: string; rule: z.infer<typeof CampgroundSchema>["depositRule"] }) =>
      apiClient.updateCampgroundDeposit(id, rule),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["campgrounds"] })
  });

  return (
    <DashboardShell>
      <div className="space-y-4">
        <Breadcrumbs items={[{ label: "Campgrounds" }]} />
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold text-foreground">Campgrounds</h2>
          <div className="text-xs text-muted-foreground">Creation is admin-only</div>
        </div>
        {isLoading && (
          <div className="grid gap-3">
            {[...Array(2)].map((_, i) => (
              <div key={i} className="card p-4 animate-pulse">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex-1 space-y-2">
                    <div className="h-6 bg-muted rounded w-48" />
                    <div className="h-4 bg-muted rounded w-32" />
                  </div>
                  <div className="flex gap-2">
                    <div className="h-9 w-16 bg-muted rounded" />
                    <div className="h-9 w-20 bg-muted rounded" />
                    <div className="h-9 w-24 bg-muted rounded" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
        {error && <p className="text-red-600">Error loading campgrounds</p>}
        <div className="grid gap-3">
          {data?.map((cg) => (
            <div key={cg.id} className="card p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-lg font-semibold text-foreground">{cg.name}</div>
                  <div className="text-sm text-muted-foreground">
                    {cg.city || "-"}, {cg.state || ""} {cg.country || ""}
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button variant="secondary" asChild>
                    <Link href={`/campgrounds/${cg.id}/sites`}>Sites</Link>
                  </Button>
                  <Button variant="ghost" asChild>
                    <Link href={`/campgrounds/${cg.id}/classes`}>Classes</Link>
                  </Button>
                  <Button asChild>
                    <Link href={`/campgrounds/${cg.id}/reservations`}>Reservations</Link>
                  </Button>
                </div>
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-3 text-sm text-foreground">
                <div className="text-xs uppercase tracking-wide text-muted-foreground">Deposit rule</div>
                <Select
                  value={cg.depositRule || "none"}
                  onValueChange={(value) =>
                    depositMutation.mutate({ id: cg.id, rule: value as z.infer<typeof CampgroundSchema>["depositRule"] })
                  }
                >
                  <SelectTrigger
                    className="w-[180px] text-sm"
                    disabled={depositMutation.isPending}
                    aria-label="Deposit rule"
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    <SelectItem value="full">Full (100%)</SelectItem>
                    <SelectItem value="half">Half (50%)</SelectItem>
                    <SelectItem value="first_night">First night</SelectItem>
                    <SelectItem value="first_night_fees">First night + fees</SelectItem>
                  </SelectContent>
                </Select>
                {depositMutation.isPending && <span className="text-xs text-muted-foreground">Saving…</span>}
                {depositMutation.isError && <span className="text-xs text-rose-600">Failed to save</span>}
              </div>
            </div>
          ))}
          {!isLoading && !data?.length && (
            <div className="rounded-lg border-2 border-dashed border-border bg-muted p-8 text-center">
              <div className="mx-auto w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-4">
                <svg className="w-6 h-6 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                </svg>
              </div>
              <p className="text-sm font-medium text-foreground mb-1">No campgrounds yet</p>
              <p className="text-xs text-muted-foreground">Contact your administrator to set up your first campground</p>
            </div>
          )}
        </div>
      </div>
    </DashboardShell>
  );
}

export default function CampgroundsPage() {
  return (
    <Suspense fallback={
      <DashboardShell>
        <div className="space-y-4">
          <Breadcrumbs items={[{ label: "Campgrounds" }]} />
          <div className="flex items-center justify-between">
            <div className="h-7 w-40 bg-muted rounded animate-pulse" />
          </div>
          <div className="grid gap-3">
            {[...Array(2)].map((_, i) => (
              <div key={i} className="card p-4 animate-pulse">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex-1 space-y-2">
                    <div className="h-6 bg-muted rounded w-48" />
                    <div className="h-4 bg-muted rounded w-32" />
                  </div>
                  <div className="flex gap-2">
                    <div className="h-9 w-16 bg-muted rounded" />
                    <div className="h-9 w-20 bg-muted rounded" />
                    <div className="h-9 w-24 bg-muted rounded" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </DashboardShell>
    }>
      <CampgroundsPageContent />
    </Suspense>
  );
}
