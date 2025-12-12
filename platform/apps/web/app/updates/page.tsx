"use client";

import { Suspense } from "react";
import { DashboardShell } from "../../components/ui/layout/DashboardShell";
import { Breadcrumbs } from "../../components/breadcrumbs";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  updates,
  getPhaseById,
  categoryColors,
  type Update,
  type UpdateCategory,
} from "../../lib/roadmap-data";

function CategoryBadge({ category }: { category: UpdateCategory }) {
  const colors = categoryColors[category];
  const labels: Record<UpdateCategory, string> = {
    feature: "Feature",
    improvement: "Improvement",
    bugfix: "Bug Fix",
    infrastructure: "Infrastructure",
  };
  const icons: Record<UpdateCategory, string> = {
    feature: "✨",
    improvement: "🔧",
    bugfix: "🐛",
    infrastructure: "🏗️",
  };
  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium border ${colors.bg} ${colors.text} ${colors.border}`}>
      <span>{icons[category]}</span>
      {labels[category]}
    </span>
  );
}

function Tag({ tag }: { tag: string }) {
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-600 hover:bg-slate-200 transition-colors">
      #{tag}
    </span>
  );
}

function UpdateCard({ update, isFirst }: { update: Update; isFirst: boolean }) {
  const phase = getPhaseById(update.phaseId);
  const date = new Date(update.date);
  const formatted = date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  return (
    <div className="relative pl-8 pb-8 group">
      {/* Timeline connector */}
      <div className="absolute left-3 top-0 bottom-0 w-px bg-gradient-to-b from-blue-200 to-slate-200 group-last:hidden" />

      {/* Timeline dot */}
      <div className={`absolute left-0 top-1.5 w-6 h-6 rounded-full border-2 flex items-center justify-center ${isFirst
          ? "bg-blue-500 border-blue-500 text-white"
          : "bg-white border-slate-300"
        }`}>
        {isFirst && (
          <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
        )}
      </div>

      {/* Card */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-all overflow-hidden">
        {/* Header */}
        <div className="p-4 border-b border-slate-100">
          <div className="flex items-start justify-between gap-3 mb-2">
            <h3 className="text-lg font-semibold text-slate-900">{update.title}</h3>
            <time className="text-sm text-slate-500 whitespace-nowrap">{formatted}</time>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <CategoryBadge category={update.category} />
            {update.tags.map((tag) => (
              <Tag key={tag} tag={tag} />
            ))}
          </div>
        </div>

        {/* Body */}
        <div className="p-4">
          <p className="text-sm text-slate-700 leading-relaxed">{update.body}</p>
        </div>

        {/* Footer with roadmap link */}
        {phase && (
          <div className="px-4 py-3 bg-slate-50 border-t border-slate-100">
            <Link
              href={`/roadmap#${phase.id}`}
              className="inline-flex items-center gap-2 text-sm text-blue-600 hover:text-blue-700 font-medium group/link"
            >
              <span className="text-lg">{phase.icon}</span>
              <span>Related to: {phase.name}</span>
              <svg className="w-4 h-4 transform group-hover/link:translate-x-0.5 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}

function FilterButton({
  active,
  onClick,
  children
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${active
          ? "bg-slate-900 text-white"
          : "bg-slate-100 text-slate-600 hover:bg-slate-200"
        }`}
    >
      {children}
    </button>
  );
}

function UpdatesPageInner() {
  const searchParams = useSearchParams();
  const phaseFilter = searchParams.get("phase");

  // Sort by date, newest first
  const sortedUpdates = [...updates].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  );

  // Filter by phase if specified
  const filteredUpdates = phaseFilter
    ? sortedUpdates.filter((u) => u.phaseId === phaseFilter)
    : sortedUpdates;

  const currentPhase = phaseFilter ? getPhaseById(phaseFilter) : null;

  // Stats
  const featureCount = updates.filter((u) => u.category === "feature").length;
  const improvementCount = updates.filter((u) => u.category === "improvement").length;
  const infraCount = updates.filter((u) => u.category === "infrastructure").length;

  return (
    <DashboardShell>
      <div className="max-w-3xl mx-auto space-y-6">
        <Breadcrumbs
          items={[
            { label: "Roadmap", href: "/roadmap" },
            { label: "Updates" },
          ]}
        />

        {/* Header */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h1 className="text-3xl font-bold text-slate-900">Updates</h1>
            <Link
              href="/roadmap"
              className="inline-flex items-center gap-2 text-sm text-blue-600 hover:text-blue-700 font-medium"
            >
              View Roadmap
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </Link>
          </div>
          <p className="text-slate-600">
            A changelog of what&apos;s new, improved, and fixed in Campreserv.
          </p>
          <p className="text-xs text-slate-500">Last updated: Dec 11, 2025 (alerts/idempotency/POS/stored value/report export/comms hardening)</p>
        </div>

        {/* Stats bar */}
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-gradient-to-br from-emerald-50 to-teal-50 border border-emerald-100 rounded-lg p-4 text-center">
            <div className="text-2xl font-bold text-emerald-700">{featureCount}</div>
            <div className="text-sm text-emerald-600">Features</div>
          </div>
          <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-100 rounded-lg p-4 text-center">
            <div className="text-2xl font-bold text-blue-700">{improvementCount}</div>
            <div className="text-sm text-blue-600">Improvements</div>
          </div>
          <div className="bg-gradient-to-br from-violet-50 to-purple-50 border border-violet-100 rounded-lg p-4 text-center">
            <div className="text-2xl font-bold text-violet-700">{infraCount}</div>
            <div className="text-sm text-violet-600">Infrastructure</div>
          </div>
        </div>

        {/* Phase filter indicator */}
        {currentPhase && (
          <div className="flex items-center justify-between bg-blue-50 border border-blue-100 rounded-lg p-3">
            <div className="flex items-center gap-2 text-sm text-blue-700">
              <span className="text-lg">{currentPhase.icon}</span>
              <span>Showing updates for: <strong>{currentPhase.name}</strong></span>
            </div>
            <Link
              href="/updates"
              className="text-sm text-blue-600 hover:text-blue-700 font-medium"
            >
              Clear filter
            </Link>
          </div>
        )}

        {/* Updates timeline */}
        <div className="pt-4">
          {filteredUpdates.length === 0 ? (
            <div className="text-center py-12 text-slate-500">
              No updates found for this phase yet.
            </div>
          ) : (
            filteredUpdates.map((update, index) => (
              <UpdateCard key={update.id} update={update} isFirst={index === 0} />
            ))
          )}
        </div>

        {/* Subscribe CTA */}
        <div className="bg-gradient-to-r from-slate-800 to-slate-900 rounded-xl p-6 text-center text-white">
          <h3 className="text-lg font-semibold mb-2">Stay in the loop</h3>
          <p className="text-slate-300 text-sm mb-4">
            Get notified when we ship new features and improvements.
          </p>
          <div className="flex justify-center gap-3">
            <input
              type="email"
              placeholder="your@email.com"
              className="px-4 py-2 rounded-lg bg-white/10 border border-white/20 text-white placeholder:text-slate-400 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-64"
            />
            <button className="px-4 py-2 rounded-lg bg-white text-slate-900 font-medium text-sm hover:bg-slate-100 transition-colors">
              Subscribe
            </button>
          </div>
        </div>
      </div>
    </DashboardShell>
  );
}

export default function UpdatesPage() {
  return (
    <Suspense fallback={<div className="p-6 text-sm text-slate-600">Loading updates…</div>}>
      <UpdatesPageInner />
    </Suspense>
  );
}
