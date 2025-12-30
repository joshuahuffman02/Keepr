"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { DashboardShell } from "@/components/ui/layout/DashboardShell";
import { Button } from "@/components/ui/button";
import { apiClient } from "@/lib/api-client";
import {
  CheckCircle2,
  Circle,
  ArrowRight,
  CreditCard,
  MapPin,
  DollarSign,
  MessageSquare,
  Calendar,
  ExternalLink,
  Sparkles,
  Crown,
  Rocket,
  Star
} from "lucide-react";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:4000/api";

interface SetupTask {
  id: string;
  title: string;
  description: string;
  href: string;
  icon: React.ReactNode;
  isComplete: boolean;
  priority: number;
}

export default function WelcomePage() {
  const [earlyAccessTier, setEarlyAccessTier] = useState<string | null>(null);

  const { data: campgrounds = [] } = useQuery({
    queryKey: ["campgrounds"],
    queryFn: () => apiClient.getCampgrounds()
  });

  const selectedCampground = campgrounds[0];
  const campgroundId = selectedCampground?.id;

  const { data: sites = [] } = useQuery({
    queryKey: ["sites", campgroundId],
    queryFn: () => apiClient.getSites(campgroundId ?? ""),
    enabled: !!campgroundId
  });

  const { data: siteClasses = [] } = useQuery({
    queryKey: ["site-classes", campgroundId],
    queryFn: () => apiClient.getSiteClasses(campgroundId ?? ""),
    enabled: !!campgroundId
  });

  // Check if Stripe is connected (simplified check)
  const stripeConnected = selectedCampground?.stripeAccountId != null;
  const hasSites = sites.length > 0;
  const hasSiteClasses = siteClasses.length > 0;
  const hasRates = siteClasses.some((sc: { defaultRate?: number }) => (sc.defaultRate ?? 0) > 0);

  // Fetch early access enrollment
  useEffect(() => {
    async function fetchEnrollment() {
      if (!selectedCampground?.organizationId) return;
      try {
        const res = await fetch(
          `${API_BASE}/early-access/enrollment/${selectedCampground.organizationId}`,
          { headers: { Authorization: `Bearer ${localStorage.getItem("campreserv:authToken")}` } }
        );
        if (res.ok) {
          const data = await res.json();
          setEarlyAccessTier(data?.tier || null);
        }
      } catch (err) {
        console.error("Failed to fetch enrollment:", err);
      }
    }
    fetchEnrollment();
  }, [selectedCampground?.organizationId]);

  const setupTasks: SetupTask[] = [
    {
      id: "stripe",
      title: "Connect Stripe",
      description: "Accept credit card payments from guests",
      href: "/dashboard/settings/payments",
      icon: <CreditCard className="h-5 w-5" />,
      isComplete: stripeConnected,
      priority: 1
    },
    {
      id: "sites",
      title: "Add your sites",
      description: "Set up RV sites, tent sites, cabins, etc.",
      href: "/campgrounds",
      icon: <MapPin className="h-5 w-5" />,
      isComplete: hasSites,
      priority: 2
    },
    {
      id: "rates",
      title: "Set your rates",
      description: "Configure pricing for each site type",
      href: "/dashboard/settings/pricing-rules",
      icon: <DollarSign className="h-5 w-5" />,
      isComplete: hasRates,
      priority: 3
    },
    {
      id: "communications",
      title: "Customize communications",
      description: "Set up booking confirmations and reminders",
      href: "/dashboard/settings/communications",
      icon: <MessageSquare className="h-5 w-5" />,
      isComplete: false, // Would need API check
      priority: 4
    }
  ];

  const completedTasks = setupTasks.filter((t) => t.isComplete).length;
  const progressPercent = Math.round((completedTasks / setupTasks.length) * 100);

  const tierDisplayNames: Record<string, { name: string; icon: React.ReactNode; color: string }> = {
    founders_circle: {
      name: "Founder's Circle",
      icon: <Crown className="h-5 w-5" />,
      color: "from-amber-500 to-orange-500"
    },
    pioneer: {
      name: "Pioneer",
      icon: <Rocket className="h-5 w-5" />,
      color: "from-emerald-500 to-teal-500"
    },
    trailblazer: {
      name: "Trailblazer",
      icon: <Star className="h-5 w-5" />,
      color: "from-violet-500 to-purple-500"
    }
  };

  const tierInfo = earlyAccessTier ? tierDisplayNames[earlyAccessTier] : null;

  return (
    <DashboardShell>
      <div className="max-w-4xl mx-auto space-y-8">
        {/* Welcome Header */}
        <div className="text-center space-y-4">
          <div className="mx-auto w-16 h-16 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-2xl flex items-center justify-center shadow-lg">
            <Sparkles className="h-8 w-8 text-white" />
          </div>

          <h1 className="text-3xl font-bold text-slate-900">
            Welcome to Camp Everyday!
          </h1>

          <p className="text-lg text-slate-600 max-w-xl mx-auto">
            {selectedCampground ? (
              <>
                Great job setting up <span className="font-semibold">{selectedCampground.name}</span>.
                Let's get you ready to accept bookings!
              </>
            ) : (
              "Let's get your campground ready to accept bookings!"
            )}
          </p>

          {/* Early Access Badge */}
          {tierInfo && (
            <div
              className={`inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r ${tierInfo.color} text-white rounded-full text-sm font-semibold shadow-md`}
            >
              {tierInfo.icon}
              Early Access: {tierInfo.name}
            </div>
          )}
        </div>

        {/* Progress Card */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-6 border-b border-slate-100">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">Setup Progress</h2>
                <p className="text-sm text-slate-600">
                  {completedTasks} of {setupTasks.length} tasks completed
                </p>
              </div>
              <div className="text-2xl font-bold text-emerald-600">{progressPercent}%</div>
            </div>

            {/* Progress Bar */}
            <div className="h-3 bg-slate-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-emerald-500 to-teal-500 transition-all duration-500"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>

          {/* Task List */}
          <div className="divide-y divide-slate-100">
            {setupTasks
              .sort((a, b) => a.priority - b.priority)
              .map((task) => (
                <Link
                  key={task.id}
                  href={task.href}
                  className="flex items-center gap-4 p-4 hover:bg-slate-50 transition-colors group"
                >
                  <div
                    className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center ${
                      task.isComplete
                        ? "bg-status-success/15 text-status-success"
                        : "bg-slate-100 text-slate-400 group-hover:bg-emerald-50 group-hover:text-emerald-500"
                    }`}
                  >
                    {task.isComplete ? (
                      <CheckCircle2 className="h-5 w-5" />
                    ) : (
                      task.icon
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3
                        className={`font-medium ${
                          task.isComplete ? "text-slate-500 line-through" : "text-slate-900"
                        }`}
                      >
                        {task.title}
                      </h3>
                      {task.isComplete && (
                        <span className="text-xs font-medium text-status-success bg-status-success/15 px-2 py-0.5 rounded-full">
                          Done
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-slate-500">{task.description}</p>
                  </div>

                  <ArrowRight
                    className={`h-5 w-5 flex-shrink-0 transition-transform group-hover:translate-x-1 ${
                      task.isComplete ? "text-slate-300" : "text-slate-400"
                    }`}
                  />
                </Link>
              ))}
          </div>
        </div>

        {/* Quick Start Actions */}
        <div className="grid md:grid-cols-2 gap-4">
          <div className="bg-gradient-to-br from-emerald-500 to-teal-600 rounded-2xl p-6 text-white">
            <Calendar className="h-8 w-8 mb-4 opacity-90" />
            <h3 className="text-xl font-semibold mb-2">View Your Calendar</h3>
            <p className="text-emerald-100 text-sm mb-4">
              See your availability at a glance and manage reservations.
            </p>
            <Button asChild variant="secondary" className="bg-white text-emerald-700 hover:bg-emerald-50">
              <Link href="/calendar">
                Open Calendar
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </div>

          <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-2xl p-6 text-white">
            <ExternalLink className="h-8 w-8 mb-4 opacity-90" />
            <h3 className="text-xl font-semibold mb-2">Share Your Booking Page</h3>
            <p className="text-slate-300 text-sm mb-4">
              Let guests book directly on your custom booking page.
            </p>
            <Button
              asChild
              variant="secondary"
              className="bg-white text-slate-800 hover:bg-slate-100"
            >
              <Link href={`/park/${selectedCampground?.slug || ""}`} target="_blank">
                Preview Booking Page
                <ExternalLink className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </div>
        </div>

        {/* Help Section */}
        <div className="bg-slate-50 rounded-2xl p-6 text-center">
          <h3 className="text-lg font-semibold text-slate-900 mb-2">Need Help?</h3>
          <p className="text-slate-600 mb-4">
            Our support team is here to help you get started.
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            <Button asChild variant="outline">
              <Link href="/help">
                Browse Help Center
              </Link>
            </Button>
            <Button asChild variant="outline">
              <a href="mailto:support@campeveryday.com">
                Contact Support
              </a>
            </Button>
          </div>
        </div>

        {/* Skip to Dashboard */}
        <div className="text-center">
          <Link
            href="/dashboard"
            className="text-sm text-slate-500 hover:text-slate-700 underline"
          >
            Skip to full dashboard
          </Link>
        </div>
      </div>
    </DashboardShell>
  );
}
