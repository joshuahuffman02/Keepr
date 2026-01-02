"use client";

import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "../../../lib/api-client";
import { DashboardShell } from "../../../components/ui/layout/DashboardShell";
import { Clock, RefreshCw, Sparkles, PlusCircle } from "lucide-react";
import { Card } from "../../../components/ui/card";
import { Button } from "../../../components/ui/button";

export default function SocialPlannerWeekly() {
  const qc = useQueryClient();
  const { data: campgrounds = [] } = useQuery({
    queryKey: ["campgrounds"],
    queryFn: () => apiClient.getCampgrounds()
  });
  const campgroundId = campgrounds[0]?.id;

  const weeklyQuery = useQuery({
    queryKey: ["social-weekly", campgroundId],
    queryFn: () => apiClient.generateWeeklySocialIdeas(campgroundId!),
    enabled: !!campgroundId
  });

  const regenerate = useMutation({
    mutationFn: () => apiClient.generateWeeklySocialIdeas(campgroundId!),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["social-weekly", campgroundId] })
  });

  const addIdeaToCalendar = useMutation({
    mutationFn: (idea: any) =>
      apiClient.createSocialPost({
        campgroundId,
        title: idea.idea?.slice(0, 80) || "Weekly idea",
        platform: idea.platform || "facebook",
        status: "draft",
        category: idea.type || "promo",
        caption: idea.idea,
        ideaParkingLot: true
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["social-posts", campgroundId] })
  });

  const weekly = weeklyQuery.data;

  if (!campgroundId) {
    return (
      <DashboardShell>
        <div className="space-y-2">
          <Link href="/social-planner" className="text-sm text-emerald-700 hover:text-emerald-600">
            ← Back to Social Planner
          </Link>
          <p className="text-muted-foreground">Select a campground to view weekly ideas.</p>
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
          <p className="text-xs uppercase tracking-wide text-emerald-600 font-semibold">Weekly ideas</p>
          <h1 className="text-2xl font-bold text-foreground">Auto-generated Monday bundles</h1>
          <p className="text-muted-foreground">Three posts + cadence tailored to your park style without external AI.</p>
        </div>
        <Button
          variant="secondary"
          className="flex items-center"
          onClick={() => regenerate.mutate()}
          disabled={!campgroundId || regenerate.isPending}
        >
          <RefreshCw className="h-4 w-4 mr-1" /> Regenerate
        </Button>
      </div>

      {weekly ? (
        <div className="space-y-4">
          <Card className="p-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Sparkles className="h-4 w-4 text-emerald-600" />
              Generated for week of {new Date(weekly.generatedFor).toLocaleDateString()}
            </div>
            <div className="grid md:grid-cols-3 gap-3 mt-3">
              {weekly.ideas?.map((idea: any, idx: number) => (
                <div key={idx} className="p-3 rounded border border-border bg-muted space-y-2">
                  <p className="text-xs uppercase text-muted-foreground">{idea.type}</p>
                  <div className="text-sm font-semibold text-foreground">{idea.idea}</div>
                  <div className="text-xs text-muted-foreground">Platform: {idea.platform}</div>
                  <Button
                    variant="secondary"
                    className="w-full justify-center flex items-center text-emerald-700"
                    onClick={() => addIdeaToCalendar.mutate(idea)}
                    disabled={addIdeaToCalendar.isPending || !campgroundId}
                  >
                    <PlusCircle className="h-4 w-4 mr-1" /> Send to parking lot
                  </Button>
                </div>
              ))}
            </div>
          </Card>

          <Card className="p-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
              <Clock className="h-4 w-4 text-emerald-600" />
              Recommended cadence
            </div>
            <div className="grid md:grid-cols-3 gap-3">
              {weekly.cadence?.map((slot: any, idx: number) => (
                <div key={idx} className="p-3 rounded border border-emerald-100 bg-emerald-50">
                  <div className="text-sm font-semibold text-emerald-900">{slot.day}</div>
                  <div className="text-xs text-emerald-700">{slot.theme}</div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      ) : (
        <div className="text-sm text-muted-foreground">Generate a bundle to see this week's ideas.</div>
      )}
    </DashboardShell>
  );
}

