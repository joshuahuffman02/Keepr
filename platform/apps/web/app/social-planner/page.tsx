"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { apiClient } from "../../lib/api-client";
import { DashboardShell } from "../../components/ui/layout/DashboardShell";
import { Calendar, Lightbulb, FileText, Images, BarChart3, Target, Sparkles } from "lucide-react";

const tiles = [
  { href: "/social-planner/calendar", title: "Content Calendar", description: "Month, week, list views with parking lot and slots", icon: Calendar },
  { href: "/social-planner/suggestions", title: "Suggestions & Alerts", description: "Rule-based ideas from occupancy, events, deals, seasonality", icon: Lightbulb },
  { href: "/social-planner/weekly", title: "Weekly Ideas", description: "Auto-generated Monday bundles and cadence", icon: Sparkles },
  { href: "/social-planner/templates", title: "Template Library", description: "Reusable fills with captions, hashtags, and styles", icon: FileText },
  { href: "/social-planner/content-bank", title: "Content Bank", description: "Photos, videos, logos, branded captions", icon: Images },
  { href: "/social-planner/reports", title: "Reports", description: "Suggested vs completed, template usage, best themes", icon: BarChart3 },
  { href: "/social-planner/strategy", title: "Strategy & Alerts", description: "Monthly plan, annual planner, opportunity alerts", icon: Target }
];

export default function SocialPlannerHome() {
  const { data: campgrounds = [] } = useQuery({
    queryKey: ["campgrounds"],
    queryFn: () => apiClient.getCampgrounds()
  });

  const campground = campgrounds[0];

  return (
    <DashboardShell>
      <div className="space-y-6">
        <div>
          <p className="text-xs uppercase tracking-wide text-emerald-600 font-semibold">Social Media Planner</p>
          <h1 className="text-3xl font-bold text-foreground">Keep every post organized</h1>
          <p className="text-muted-foreground mt-2">
            Plan across Facebook, Instagram, TikTok, email, and your blog without auto-posting. Light AI-free suggestions use your existing campground data.
          </p>
          {campground && (
            <p className="text-xs text-muted-foreground mt-1">Current campground: {campground.name}</p>
          )}
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {tiles.map(tile => (
            <Link key={tile.href} href={tile.href} className="card p-4 hover:shadow-lg transition-all border border-border hover:border-emerald-200">
              <div className="flex items-center gap-3 mb-3">
                <div className="p-2 bg-emerald-50 rounded-lg text-emerald-700">
                  <tile.icon className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-foreground">{tile.title}</h3>
                  <p className="text-sm text-muted-foreground">{tile.description}</p>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </DashboardShell>
  );
}

