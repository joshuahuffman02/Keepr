"use client";

import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "../../../lib/api-client";
import { DashboardShell } from "../../../components/ui/layout/DashboardShell";
import { AlertTriangle, CheckCircle2, RefreshCw, PlusCircle } from "lucide-react";
import { useToast } from "../../../hooks/use-toast";
import { useState } from "react";

type Campground = Awaited<ReturnType<typeof apiClient.getCampgrounds>>[number];
type SocialSuggestion = Awaited<ReturnType<typeof apiClient.listSocialSuggestions>>[number];
type SocialSuggestionRow = SocialSuggestion & { createdAt?: string | null };
type StatusFilter = "" | "new" | "accepted" | "dismissed";

const STATUS_FILTERS: StatusFilter[] = ["new", "accepted", "dismissed", ""];

const getErrorMessage = (error: unknown) =>
  error instanceof Error ? error.message : "Please try again.";

const isStatusFilter = (value: string): value is StatusFilter =>
  STATUS_FILTERS.some((filter) => filter === value);

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

export default function SocialPlannerSuggestions() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("new");
  const { data: campgrounds = [] } = useQuery<Campground[]>({
    queryKey: ["campgrounds"],
    queryFn: () => apiClient.getCampgrounds(),
  });
  const campgroundId = campgrounds[0]?.id;

  const suggestionsQuery = useQuery<SocialSuggestionRow[]>({
    queryKey: ["social-suggestions", campgroundId, statusFilter],
    queryFn: async () => {
      if (!campgroundId) {
        throw new Error("Campground is required");
      }
      return apiClient.listSocialSuggestions(campgroundId, statusFilter);
    },
    enabled: !!campgroundId,
  });

  const refresh = useMutation({
    mutationFn: async () => {
      if (!campgroundId) {
        throw new Error("Campground is required");
      }
      return apiClient.refreshSocialSuggestions(campgroundId);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["social-suggestions", campgroundId] });
      toast({
        title: "Suggestions refreshed",
        description: "New ideas fetched without duplicates.",
      });
    },
    onError: (error) => {
      toast({
        variant: "destructive",
        title: "Refresh failed",
        description: getErrorMessage(error),
      });
    },
  });

  const accept = useMutation({
    mutationFn: (id: string) => apiClient.updateSocialSuggestionStatus(id, { status: "accepted" }),
    onSuccess: (_data, id) => {
      qc.setQueryData<SocialSuggestion[]>(["social-suggestions", campgroundId], (prev) => {
        if (!prev) return prev;
        return prev.filter((suggestion) => suggestion.id !== id);
      });
      toast({ title: "Accepted", description: "Suggestion accepted." });
    },
    onError: (error) => {
      toast({
        variant: "destructive",
        title: "Accept failed",
        description: getErrorMessage(error),
      });
    },
  });

  const dismiss = useMutation({
    mutationFn: (id: string) => apiClient.updateSocialSuggestionStatus(id, { status: "dismissed" }),
    onSuccess: (_data, id) => {
      qc.setQueryData<SocialSuggestion[]>(["social-suggestions", campgroundId], (prev) => {
        if (!prev) return prev;
        return prev.filter((suggestion) => suggestion.id !== id);
      });
      toast({ title: "Dismissed", description: "Suggestion dismissed." });
    },
    onError: (error) => {
      toast({
        variant: "destructive",
        title: "Dismiss failed",
        description: getErrorMessage(error),
      });
    },
  });

  const addToCalendar = useMutation({
    mutationFn: (suggestion: SocialSuggestionRow) => {
      const cgId = suggestion.campgroundId || campgroundId;
      if (!cgId) throw new Error("No campground available for this suggestion");
      return apiClient.createSocialPost({
        campgroundId: cgId,
        title: suggestion.message.slice(0, 80),
        platform: suggestion.platform || "facebook",
        status: "scheduled",
        category: suggestion.category || "promo",
        scheduledFor: suggestion.proposedDate || new Date().toISOString(),
        suggestionId: suggestion.id,
        caption: suggestion.message,
        ideaParkingLot: false,
      });
    },
    onSuccess: (_data, suggestion) => {
      qc.invalidateQueries({ queryKey: ["social-posts", campgroundId] });
      qc.setQueryData<SocialSuggestion[]>(["social-suggestions", campgroundId], (prev) => {
        if (!prev) return prev;
        return prev.filter((item) => item.id !== suggestion.id);
      });
      toast({
        title: "Added to calendar",
        description: "Scheduled post created; suggestion marked scheduled.",
      });
    },
    onError: (error) => {
      toast({
        variant: "destructive",
        title: "Add to calendar failed",
        description: getErrorMessage(error),
      });
    },
  });

  if (!campgroundId) {
    return (
      <DashboardShell>
        <div className="space-y-2">
          <Link href="/social-planner" className="text-sm text-emerald-700 hover:text-emerald-600">
            ← Back to Social Planner
          </Link>
          <p className="text-muted-foreground">Select a campground to view suggestions.</p>
        </div>
      </DashboardShell>
    );
  }

  return (
    <DashboardShell>
      <Link
        href="/social-planner"
        className="text-sm text-emerald-700 hover:text-emerald-600 inline-block mb-2"
      >
        ← Back to Social Planner
      </Link>
      <div className="flex items-center justify-between mb-4">
        <div>
          <p className="text-xs uppercase tracking-wide text-emerald-600 font-semibold">
            Suggestions
          </p>
          <h1 className="text-2xl font-bold text-foreground">Rule-based ideas & alerts</h1>
          <p className="text-muted-foreground">
            Occupancy, events, deals, seasonal, and historical heuristics. No external AI required.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <select
            className="input"
            value={statusFilter}
            onChange={(event) => {
              const next = event.target.value;
              setStatusFilter(isStatusFilter(next) ? next : "new");
            }}
          >
            <option value="new">New</option>
            <option value="accepted">Accepted</option>
            <option value="dismissed">Dismissed</option>
            <option value="">All</option>
          </select>
          <button
            className="btn-secondary flex items-center"
            onClick={() => refresh.mutate()}
            disabled={!campgroundId || refresh.isPending}
          >
            <RefreshCw className="h-4 w-4 mr-1" /> Refresh ideas
          </button>
        </div>
      </div>

      <div className="grid gap-3">
        {suggestionsQuery.data?.map((suggestion) => {
          const reasonEntries = isRecord(suggestion.reason)
            ? Object.entries(suggestion.reason)
            : [];

          return (
            <div key={suggestion.id} className="card p-4">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs uppercase text-muted-foreground">{suggestion.type}</p>
                  <h3 className="text-lg font-semibold text-foreground">{suggestion.message}</h3>
                  <div className="text-xs text-muted-foreground mt-1">
                    Generated: {new Date(suggestion.createdAt || Date.now()).toLocaleString()}
                  </div>
                  <div className="text-xs text-muted-foreground flex gap-2 mt-2">
                    {suggestion.category && <span className="badge">{suggestion.category}</span>}
                    {suggestion.platform && (
                      <span className="badge bg-status-success/15 text-status-success">
                        {suggestion.platform}
                      </span>
                    )}
                    {suggestion.proposedDate && (
                      <span className="badge bg-status-info/15 text-status-info">
                        Target {new Date(suggestion.proposedDate).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    className="btn-secondary flex items-center text-emerald-700"
                    onClick={() => accept.mutate(suggestion.id)}
                    disabled={accept.isPending || suggestion.status !== "new"}
                  >
                    <CheckCircle2 className="h-4 w-4 mr-1" /> Accept
                  </button>
                  <button
                    className="btn-secondary flex items-center text-amber-700"
                    onClick={() => dismiss.mutate(suggestion.id)}
                    disabled={dismiss.isPending || suggestion.status !== "new"}
                  >
                    <AlertTriangle className="h-4 w-4 mr-1" /> Dismiss
                  </button>
                  {suggestion.status && suggestion.status !== "new" && (
                    <span className="text-xs text-muted-foreground">
                      Status: {suggestion.status}
                    </span>
                  )}
                </div>
              </div>
              {reasonEntries.length > 0 && (
                <div className="mt-2 text-xs text-muted-foreground bg-muted p-2 rounded border border-border flex flex-wrap gap-2">
                  {reasonEntries.map(([key, val]) => {
                    const label = key.replace(/([A-Z])/g, " $1").toLowerCase();
                    const display =
                      key.toLowerCase().includes("ratio") && typeof val === "number"
                        ? `${Math.round(val * 100)}%`
                        : String(val);
                    return (
                      <span
                        key={`${suggestion.id}-${key}`}
                        className="badge bg-card text-foreground border border-border"
                      >
                        {label}: {display}
                      </span>
                    );
                  })}
                </div>
              )}
              <div className="flex gap-2 mt-3">
                <button
                  className="btn-primary flex items-center text-white"
                  onClick={() => addToCalendar.mutate(suggestion)}
                  disabled={!(campgroundId || suggestion.campgroundId) || addToCalendar.isPending}
                >
                  <PlusCircle className="h-4 w-4 mr-1" /> Add to calendar
                </button>
              </div>
            </div>
          );
        })}
        {!suggestionsQuery.data?.length && (
          <div className="text-sm text-muted-foreground">
            No suggestions yet. Refresh to generate ideas from your data.
          </div>
        )}
      </div>
    </DashboardShell>
  );
}
