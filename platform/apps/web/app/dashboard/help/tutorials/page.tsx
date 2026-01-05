"use client";

import { useState } from "react";
import { DashboardShell } from "@/components/ui/layout/DashboardShell";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { Play, Clock, Users } from "lucide-react";
import Link from "next/link";

interface VideoTutorial {
  id: string;
  title: string;
  description: string;
  duration: string;
  category: string;
  difficulty: "Beginner" | "Intermediate" | "Advanced";
  roles: string[];
  thumbnailUrl?: string;
  videoUrl?: string;
}

const tutorials: VideoTutorial[] = [
  {
    id: "getting-started",
    title: "Getting Started with Keepr",
    description: "Complete overview of the system, navigation, and key features",
    duration: "8:30",
    category: "Getting Started",
    difficulty: "Beginner",
    roles: ["owner", "manager", "frontdesk"],
    videoUrl: "https://www.youtube.com/embed/ysz5S6PUM-U"
  },
  {
    id: "checkin-process",
    title: "Processing Guest Check-Ins",
    description: "Step-by-step guide to checking in guests efficiently",
    duration: "5:15",
    category: "Front Desk",
    difficulty: "Beginner",
    roles: ["frontdesk", "manager"],
    videoUrl: "https://www.youtube.com/embed/aqz-KE-bpKQ"
  },
  {
    id: "new-reservation",
    title: "Creating Walk-In Reservations",
    description: "Handle walk-in guests and create immediate bookings",
    duration: "4:45",
    category: "Front Desk",
    difficulty: "Beginner",
    roles: ["frontdesk"]
  },
  {
    id: "payment-processing",
    title: "Processing Payments & Refunds",
    description: "Accept payments, issue refunds, and manage balances",
    duration: "6:20",
    category: "Front Desk",
    difficulty: "Intermediate",
    roles: ["frontdesk", "finance"]
  },
  {
    id: "reports-overview",
    title: "Understanding Your Reports Dashboard",
    description: "Navigate the 100+ reports and export data",
    duration: "12:00",
    category: "Reports & Analytics",
    difficulty: "Intermediate",
    roles: ["owner", "manager"],
    videoUrl: "https://www.youtube.com/embed/aqz-KE-bpKQ"
  },
  {
    id: "revenue-reports",
    title: "Financial Reports Deep Dive",
    description: "Master revenue tracking, forecasting, and financial analysis",
    duration: "10:30",
    category: "Reports & Analytics",
    difficulty: "Advanced",
    roles: ["owner", "finance"],
    videoUrl: "https://www.youtube.com/embed/ysz5S6PUM-U"
  },
  {
    id: "site-management",
    title: "Managing Sites & Assignments",
    description: "Configure sites, set rates, and handle reassignments",
    duration: "7:45",
    category: "Setup & Configuration",
    difficulty: "Intermediate",
    roles: ["owner", "manager"]
  },
  {
    id: "group-bookings",
    title: "Handling Group Reservations",
    description: "Manage rallies, events, and large group bookings",
    duration: "9:15",
    category: "Advanced Features",
    difficulty: "Advanced",
    roles: ["frontdesk", "manager"]
  },
  {
    id: "seasonal-opening",
    title: "Seasonal Opening & Closing Playbook",
    description: "Winterization, spring opening checklist, and staffing best practices",
    duration: "7:10",
    category: "Seasonal Operations",
    difficulty: "Intermediate",
    roles: ["owner", "manager", "maintenance"],
    videoUrl: "https://www.youtube.com/embed/ysz5S6PUM-U"
  },
  {
    id: "troubleshooting-payments",
    title: "Troubleshooting Payment Failures",
    description: "Resolve failed authorizations, hardware issues, and reconcile transactions",
    duration: "6:05",
    category: "Troubleshooting",
    difficulty: "Intermediate",
    roles: ["frontdesk", "finance", "manager"],
    videoUrl: "https://www.youtube.com/embed/aqz-KE-bpKQ"
  },
  {
    id: "inventory-retail",
    title: "Inventory & Retail Setup",
    description: "Configure supplies, retail SKUs, and add-ons for upsells",
    duration: "5:50",
    category: "Operations",
    difficulty: "Beginner",
    roles: ["manager", "maintenance"]
  },
  {
    id: "wifi-support",
    title: "WiFi & Guest Tech Support",
    description: "Network basics, common guest fixes, and when to escalate to ISP",
    duration: "4:35",
    category: "Technology",
    difficulty: "Beginner",
    roles: ["frontdesk", "maintenance"],
    videoUrl: "https://www.youtube.com/embed/aqz-KE-bpKQ"
  },
  {
    id: "integrations-setup",
    title: "Integrations & Channel Manager Setup",
    description: "Connect booking engines, POS, and accounting safely",
    duration: "8:05",
    category: "Integrations",
    difficulty: "Intermediate",
    roles: ["owner", "manager", "admin"]
  }
];

export default function TutorialsPage() {
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [selectedDifficulty, setSelectedDifficulty] = useState<string>("all");

  const categories = Array.from(new Set(tutorials.map(t => t.category)));
  const difficulties = Array.from(new Set(tutorials.map(t => t.difficulty)));
  const featuredTutorial = tutorials.find(t => t.videoUrl) ?? tutorials[0];

  const filteredTutorials = tutorials.filter(t => {
    const matchesCategory = selectedCategory === "all" || t.category === selectedCategory;
    const matchesDifficulty = selectedDifficulty === "all" || t.difficulty === selectedDifficulty;
    return matchesCategory && matchesDifficulty;
  });

  return (
    <DashboardShell>
      <div className="space-y-6">
        <Breadcrumbs
          items={[
            { label: "Help", href: "/dashboard/help" },
            { label: "Video Tutorials" }
          ]}
        />

        {/* Header */}
        <div className="card p-6">
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-2xl font-bold text-slate-900 mb-2">Video Tutorials</h1>
              <p className="text-slate-600">
                Step-by-step video guides to master Keepr features
              </p>
            </div>
            <div className="px-3 py-1.5 bg-emerald-50 border border-emerald-200 rounded-lg text-sm font-medium text-emerald-700">
              {filteredTutorials.length} video{filteredTutorials.length === 1 ? "" : "s"}
            </div>
          </div>

          {/* Category Filter */}
          <div className="flex items-center gap-2 flex-wrap mt-4">
            <button
              onClick={() => setSelectedCategory("all")}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${selectedCategory === "all"
                  ? "bg-status-success/15 text-status-success"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
            >
              All Videos ({tutorials.length})
            </button>
            {categories.map(cat => {
              const count = tutorials.filter(t => t.category === cat).length;
              return (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${selectedCategory === cat
                      ? "bg-status-success/15 text-status-success"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                    }`}
                >
                  {cat} ({count})
                </button>
              );
            })}
          </div>

          <div className="flex items-center gap-2 flex-wrap mt-3">
            <span className="text-xs font-semibold text-slate-700 uppercase">Difficulty</span>
            <button
              onClick={() => setSelectedDifficulty("all")}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${selectedDifficulty === "all"
                  ? "bg-status-info/15 text-status-info"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
            >
              All
            </button>
            {difficulties.map(level => (
              <button
                key={level}
                onClick={() => setSelectedDifficulty(level)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${selectedDifficulty === level
                    ? "bg-status-info/15 text-status-info"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  }`}
              >
                {level}
              </button>
            ))}
          </div>
        </div>

        {/* Featured */}
        {featuredTutorial && (
          <div className="card overflow-hidden">
            <div className="grid md:grid-cols-3">
              <div className="md:col-span-2 bg-slate-950">
                <div className="aspect-video">
                  <iframe
                    title={featuredTutorial.title}
                    src={featuredTutorial.videoUrl ?? ""}
                    className="w-full h-full"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                  />
                </div>
              </div>
              <div className="p-5 space-y-3">
                <div className="flex items-center gap-2 text-xs text-slate-500">
                  <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 font-semibold">{featuredTutorial.category}</span>
                  <span className={`px-2 py-0.5 rounded ${featuredTutorial.difficulty === "Beginner" ? "bg-status-info/15 text-status-info" :
                      featuredTutorial.difficulty === "Intermediate" ? "bg-status-warning/15 text-status-warning" :
                        "bg-status-error/15 text-status-error"
                    }`}>
                    {featuredTutorial.difficulty}
                  </span>
                </div>
                <h3 className="text-lg font-semibold text-slate-900">{featuredTutorial.title}</h3>
                <p className="text-sm text-slate-600">{featuredTutorial.description}</p>
                <div className="flex items-center gap-3 text-xs text-slate-500">
                  <Clock className="h-4 w-4" />
                  {featuredTutorial.duration}
                </div>
                <div className="flex flex-wrap gap-2 pt-2">
                  <a
                    href={featuredTutorial.videoUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-700 transition-colors"
                  >
                    <Play className="h-4 w-4" />
                    Watch now
                  </a>
                  <Link
                    href="/dashboard/help/contact"
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-slate-200 text-sm text-slate-700 hover:bg-slate-50 transition-colors"
                  >
                    Request a video
                  </Link>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Video Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredTutorials.map((video) => (
            <div key={video.id} className="card overflow-hidden hover:shadow-lg transition-shadow">
              {/* Thumbnail */}
              <div className="relative bg-gradient-to-br from-emerald-500 to-emerald-600 aspect-video flex items-center justify-center">
                <div className="absolute inset-0 bg-black/20" />
                {video.videoUrl ? (
                  <a
                    href={video.videoUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="relative z-10 w-16 h-16 bg-white rounded-full flex items-center justify-center hover:scale-110 transition-transform"
                  >
                    <Play className="h-8 w-8 text-emerald-600 ml-1" />
                  </a>
                ) : (
                  <div className="relative z-10 w-16 h-16 bg-white/70 rounded-full flex items-center justify-center">
                    <Play className="h-8 w-8 text-emerald-400 ml-1" />
                  </div>
                )}
                <div className="absolute bottom-2 right-2 px-2 py-1 bg-black/70 rounded text-xs text-white font-medium">
                  {video.duration}
                </div>
              </div>

              {/* Content */}
              <div className="p-4">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xs font-medium text-emerald-600">{video.category}</span>
                  <span className={`text-xs px-2 py-0.5 rounded ${video.difficulty === "Beginner" ? "bg-status-info/15 text-status-info" :
                      video.difficulty === "Intermediate" ? "bg-status-warning/15 text-status-warning" :
                        "bg-status-error/15 text-status-error"
                    }`}>
                    {video.difficulty}
                  </span>
                </div>

                <h3 className="font-semibold text-slate-900 mb-2 line-clamp-2">{video.title}</h3>
                <p className="text-sm text-slate-600 mb-4 line-clamp-2">{video.description}</p>

                <div className="flex items-center gap-4 text-xs text-slate-500 mb-3">
                  <div className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {video.duration}
                  </div>
                  <div className="flex items-center gap-1">
                    <Users className="h-3 w-3" />
                    {video.roles.length} role{video.roles.length > 1 ? 's' : ''}
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <div className="text-xs text-slate-500 line-clamp-1">
                    Roles: {video.roles.join(", ")}
                  </div>
                  {video.videoUrl ? (
                    <a
                      href={video.videoUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-sm text-emerald-600 hover:text-emerald-700 font-semibold"
                    >
                      <Play className="h-4 w-4" />
                      Watch
                    </a>
                  ) : (
                    <span className="text-xs text-slate-400">Recording soon</span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Coming Soon Banner */}
        <div className="card p-8 text-center bg-gradient-to-br from-emerald-50 to-blue-50 border-2 border-emerald-200">
          <h3 className="text-lg font-semibold text-slate-900 mb-2">More Videos Coming Soon!</h3>
          <p className="text-slate-600 mb-4">
            We're constantly adding new tutorials. Have a topic request?
          </p>
          <Link
            href="/dashboard/help/contact"
            className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors"
          >
            Request a Tutorial
          </Link>
        </div>
      </div>
    </DashboardShell>
  );
}
