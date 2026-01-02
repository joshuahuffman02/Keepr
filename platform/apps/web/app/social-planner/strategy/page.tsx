"use client";

import Link from "next/link";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "../../../lib/api-client";
import { DashboardShell } from "../../../components/ui/layout/DashboardShell";
import { Bell, CalendarRange, Target } from "lucide-react";

export default function SocialPlannerStrategy() {
  const qc = useQueryClient();
  const [month, setMonth] = useState("");
  const [hero, setHero] = useState("");
  const [topIdeas, setTopIdeas] = useState("");
  const [alertMessage, setAlertMessage] = useState("");
  const [alertCategory, setAlertCategory] = useState("occupancy");

  const { data: campgrounds = [] } = useQuery({
    queryKey: ["campgrounds"],
    queryFn: () => apiClient.getCampgrounds()
  });
  const campgroundId = campgrounds[0]?.id;

  const strategiesQuery = useQuery({
    queryKey: ["social-strategies", campgroundId],
    queryFn: () => apiClient.listSocialStrategies(campgroundId!),
    enabled: !!campgroundId
  });

  const alertsQuery = useQuery({
    queryKey: ["social-alerts", campgroundId],
    queryFn: () => apiClient.listSocialAlerts(campgroundId!),
    enabled: !!campgroundId
  });

  const createStrategy = useMutation({
    mutationFn: () =>
      apiClient.createSocialStrategy({
        campgroundId,
        month: month || new Date().toISOString(),
        plan: {
          hero,
          topIdeas: topIdeas
            .split(",")
            .map(i => i.trim())
            .filter(Boolean)
        }
      }),
    onSuccess: () => {
      setHero("");
      setTopIdeas("");
      qc.invalidateQueries({ queryKey: ["social-strategies", campgroundId] });
    }
  });

  const createAlert = useMutation({
    mutationFn: () =>
      apiClient.createSocialAlert({
        campgroundId,
        category: alertCategory,
        message: alertMessage
      }),
    onSuccess: () => {
      setAlertMessage("");
      qc.invalidateQueries({ queryKey: ["social-alerts", campgroundId] });
    }
  });

  const dismissAlert = useMutation({
    mutationFn: (id: string) => apiClient.dismissSocialAlert(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["social-alerts", campgroundId] })
  });

  if (!campgroundId) {
    return (
      <DashboardShell>
        <div className="space-y-2">
          <Link href="/social-planner" className="text-sm text-emerald-700 hover:text-emerald-600">
            ← Back to Social Planner
          </Link>
          <p className="text-muted-foreground">Select a campground to manage strategy and alerts.</p>
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
          <p className="text-xs uppercase tracking-wide text-emerald-600 font-semibold">Strategy & alerts</p>
          <h1 className="text-2xl font-bold text-foreground">Monthly plan, annual planner, and opportunity alerts</h1>
          <p className="text-muted-foreground">Top 10 ideas, cadence, promos/events to push, and smart triggers you can toggle.</p>
        </div>
      </div>

      <div className="card p-4 mb-4">
        <h3 className="text-lg font-semibold text-foreground mb-2">Monthly strategy</h3>
        <div className="grid md:grid-cols-3 gap-3">
          <input className="input" type="month" value={month} onChange={e => setMonth(e.target.value)} />
          <input className="input" placeholder="Hero content (e.g., summer kickoff)" value={hero} onChange={e => setHero(e.target.value)} />
          <input className="input" placeholder="Top ideas (comma separated)" value={topIdeas} onChange={e => setTopIdeas(e.target.value)} />
        </div>
        <button
          className="btn-primary mt-3"
          disabled={!campgroundId || createStrategy.isPending}
          onClick={() => createStrategy.mutate()}
        >
          Save strategy
        </button>
      </div>

      <div className="grid md:grid-cols-2 gap-3">
        <div className="card p-4">
          <div className="flex items-center gap-2 mb-2">
            <CalendarRange className="h-4 w-4 text-emerald-600" />
            <h3 className="text-lg font-semibold text-foreground">Monthly & annual plans</h3>
          </div>
          <div className="space-y-3">
            {strategiesQuery.data?.map((s: any) => (
              <div key={s.id} className="p-3 rounded border border-border bg-muted">
                <div className="text-sm font-semibold text-foreground">
                  {new Date(s.month).toLocaleDateString(undefined, { month: "long", year: "numeric" })}
                  {s.annual ? " (Annual)" : ""}
                </div>
                <div className="text-xs text-muted-foreground">Hero: {s.plan?.hero || s.plan?.heroContent || "TBD"}</div>
                {s.plan?.topIdeas?.length ? (
                  <div className="text-xs text-muted-foreground mt-1">Top ideas: {s.plan.topIdeas.join(", ")}</div>
                ) : null}
              </div>
            ))}
            {!strategiesQuery.data?.length && <div className="text-sm text-muted-foreground">No strategies yet.</div>}
          </div>
        </div>

        <div className="card p-4">
          <div className="flex items-center gap-2 mb-2">
            <Bell className="h-4 w-4 text-amber-600" />
            <h3 className="text-lg font-semibold text-foreground">Opportunity alerts</h3>
          </div>
          <div className="grid md:grid-cols-2 gap-2 mb-3">
            <select className="input" value={alertCategory} onChange={e => setAlertCategory(e.target.value)}>
              <option value="weather">Weather</option>
              <option value="occupancy">Occupancy</option>
              <option value="events">Events</option>
              <option value="deals">Deals</option>
              <option value="reviews">Reviews</option>
              <option value="inactivity">Inactivity</option>
              <option value="inventory">Inventory</option>
            </select>
            <input className="input" placeholder="Message" value={alertMessage} onChange={e => setAlertMessage(e.target.value)} />
          </div>
          <button
            className="btn-primary mb-3"
            onClick={() => createAlert.mutate()}
            disabled={!campgroundId || createAlert.isPending}
          >
            Add alert
          </button>

          <div className="space-y-2">
            {alertsQuery.data?.map((alert: any) => (
              <div key={alert.id} className="p-3 rounded border border-amber-100 bg-amber-50 flex items-center justify-between">
                <div>
                  <div className="text-sm font-semibold text-amber-900">{alert.message}</div>
                  <div className="text-xs text-amber-700 uppercase">{alert.category}</div>
                </div>
                {!alert.dismissed && (
                  <button className="btn-secondary text-xs" onClick={() => dismissAlert.mutate(alert.id)}>
                    Dismiss
                  </button>
                )}
              </div>
            ))}
            {!alertsQuery.data?.length && <div className="text-sm text-muted-foreground">No alerts configured.</div>}
          </div>
        </div>
      </div>
    </DashboardShell>
  );
}

