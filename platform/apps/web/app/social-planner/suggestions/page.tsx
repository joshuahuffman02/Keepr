"use client";

import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "../../../lib/api-client";
import { DashboardShell } from "../../../components/ui/layout/DashboardShell";
import { AlertTriangle, CheckCircle2, RefreshCw, PlusCircle } from "lucide-react";
import { useToast } from "../../../hooks/use-toast";
import { useState } from "react";

export default function SocialPlannerSuggestions() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [statusFilter, setStatusFilter] = useState("new");
  const { data: campgrounds = [] } = useQuery({
    queryKey: ["campgrounds"],
    queryFn: () => apiClient.getCampgrounds()
  });
  const campgroundId = campgrounds[0]?.id;

  const suggestionsQuery = useQuery({
    queryKey: ["social-suggestions", campgroundId, statusFilter],
    queryFn: () => apiClient.listSocialSuggestions(campgroundId!, statusFilter),
    enabled: !!campgroundId
  });

  const refresh = useMutation({
    mutationFn: () => apiClient.refreshSocialSuggestions(campgroundId!),
    onSuccess: (_data, suggestion) => {
      qc.invalidateQueries({ queryKey: ["social-suggestions", campgroundId] });
      toast({ title: "Suggestions refreshed", description: "New ideas fetched without duplicates." });
    },
    onError: (err: any) => {
      toast({ variant: "destructive", title: "Refresh failed", description: err?.message || "Please try again." });
    }
  });

  const accept = useMutation({
    mutationFn: (id: string) => apiClient.updateSocialSuggestionStatus(id, { status: "accepted" }),
    onSuccess: (_data, id) => {
      qc.setQueryData(["social-suggestions", campgroundId], (prev: any) => {
        if (!Array.isArray(prev)) return prev;
        return prev.filter((s: any) => s.id !== id);
      });
      toast({ title: "Accepted", description: "Suggestion accepted." });
    },
    onError: (err: any) => {
      toast({ variant: "destructive", title: "Accept failed", description: err?.message || "Please try again." });
    }
  });

  const dismiss = useMutation({
    mutationFn: (id: string) => apiClient.updateSocialSuggestionStatus(id, { status: "dismissed" }),
    onSuccess: (_data, id) => {
      qc.setQueryData(["social-suggestions", campgroundId], (prev: any) => {
        if (!Array.isArray(prev)) return prev;
        return prev.filter((s: any) => s.id !== id);
      });
      toast({ title: "Dismissed", description: "Suggestion dismissed." });
    },
    onError: (err: any) => {
      toast({ variant: "destructive", title: "Dismiss failed", description: err?.message || "Please try again." });
    }
  });

  const addToCalendar = useMutation({
    mutationFn: (suggestion: any) => {
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
        ideaParkingLot: false
      });
    },
    onSuccess: (_data, suggestion: any) => {
      qc.invalidateQueries({ queryKey: ["social-posts", campgroundId] });
      qc.setQueryData(["social-suggestions", campgroundId], (prev: any) => {
        if (!Array.isArray(prev)) return prev;
        return prev.filter((s: any) => s.id !== suggestion.id);
      });
      toast({ title: "Added to calendar", description: "Scheduled post created; suggestion marked scheduled." });
    },
    onError: (err: any) => {
      toast({ variant: "destructive", title: "Add to calendar failed", description: err?.message || "Please try again." });
    }
  });

  if (!campgroundId) {
    return (
      <DashboardShell>
        <div className="space-y-2">
          <Link href="/social-planner" className="text-sm text-emerald-700 hover:text-emerald-600">
            ← Back to Social Planner
          </Link>
          <p className="text-slate-600">Select a campground to view suggestions.</p>
        </div>
      </DashboardShell>
    );
  }

  return (
    <DashboardShell>
      <Link href="/social-planner" className="text-sm text-emerald-700 hover:text-emerald-600 inline-block mb-2">
        ← Back to Social Planner
      </Link>
      <div className="flex items-center justify-between mb-4">
        <div>
          <p className="text-xs uppercase tracking-wide text-emerald-600 font-semibold">Suggestions</p>
          <h1 className="text-2xl font-bold text-slate-900">Rule-based ideas & alerts</h1>
          <p className="text-slate-600">Occupancy, events, deals, seasonal, and historical heuristics. No external AI required.</p>
        </div>
        <div className="flex items-center gap-2">
          <select
            className="input"
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
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
        {suggestionsQuery.data?.map((s: any) => (
          <div key={s.id} className="card p-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs uppercase text-slate-500">{s.type}</p>
                <h3 className="text-lg font-semibold text-slate-900">{s.message}</h3>
                    <div className="text-xs text-slate-500 mt-1">Generated: {new Date(s.createdAt || Date.now()).toLocaleString()}</div>
                <div className="text-xs text-slate-500 flex gap-2 mt-2">
                  {s.category && <span className="badge">{s.category}</span>}
                  {s.platform && <span className="badge bg-status-success/15 text-status-success">{s.platform}</span>}
                  {s.proposedDate && <span className="badge bg-status-info/15 text-status-info">Target {new Date(s.proposedDate).toLocaleDateString()}</span>}
                </div>
              </div>
                  <div className="flex items-center gap-2">
                    <button
                      className="btn-secondary flex items-center text-emerald-700"
                      onClick={() => accept.mutate(s.id)}
                      disabled={accept.isPending || s.status !== "new"}
                    >
                      <CheckCircle2 className="h-4 w-4 mr-1" /> Accept
                    </button>
                    <button
                      className="btn-secondary flex items-center text-amber-700"
                      onClick={() => dismiss.mutate(s.id)}
                      disabled={dismiss.isPending || s.status !== "new"}
                    >
                      <AlertTriangle className="h-4 w-4 mr-1" /> Dismiss
                    </button>
                    {s.status && s.status !== "new" && (
                      <span className="text-xs text-slate-500">Status: {s.status}</span>
                    )}
                  </div>
            </div>
            {s.reason && (
              <div className="mt-2 text-xs text-slate-600 bg-slate-50 p-2 rounded border border-slate-100 flex flex-wrap gap-2">
                {Object.entries(s.reason).map(([key, val]) => {
                  const label = key.replace(/([A-Z])/g, ' $1').toLowerCase();
                  const display =
                    key.toLowerCase().includes("ratio") && typeof val === "number"
                      ? `${Math.round(val * 100)}%`
                      : String(val);
                  return (
                    <span key={`${s.id}-${key}`} className="badge bg-white text-slate-700 border border-slate-200">
                      {label}: {display}
                    </span>
                  );
                })}
              </div>
            )}
              <div className="flex gap-2 mt-3">
                <button
                  className="btn-primary flex items-center text-white"
                  onClick={() => addToCalendar.mutate(s)}
                  disabled={!(campgroundId || s.campgroundId) || addToCalendar.isPending}
                >
                  <PlusCircle className="h-4 w-4 mr-1" /> Add to calendar
                </button>
              </div>
          </div>
        ))}
        {!suggestionsQuery.data?.length && (
          <div className="text-sm text-slate-500">No suggestions yet. Refresh to generate ideas from your data.</div>
        )}
      </div>
    </DashboardShell>
  );
}

