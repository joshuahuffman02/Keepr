"use client";

import { Suspense, useState } from "react";
import { DashboardShell } from "../../components/ui/layout/DashboardShell";
import { Breadcrumbs } from "@/components/breadcrumbs";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import * as LucideIcons from "lucide-react";
import { Sparkles, Wrench, Bug, Building2, Calendar, Users, Target, ImageIcon, Video } from "lucide-react";
import {
  updates,
  getPhaseById,
  categoryColors,
  typeColors,
  typeLabels,
  type Update,
  type UpdateCategory,
  type UpdateType,
} from "../../lib/roadmap-data";

// Helper to render a lucide icon from its name (kebab-case)
function PhaseIcon({ name, className = "h-5 w-5" }: { name: string; className?: string }) {
  const iconName = name
    .split('-')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join('') as keyof typeof LucideIcons;

  const IconComponent = LucideIcons[iconName] as React.ComponentType<{ className?: string }>;

  if (!IconComponent) {
    return <LucideIcons.Circle className={className} />;
  }

  return <IconComponent className={className} />;
}

function TypeBadge({ type }: { type: UpdateType }) {
  const colors = typeColors[type];
  const label = typeLabels[type];

  return (
    <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold border ${colors.bg} ${colors.text} ${colors.border}`}>
      {label}
    </span>
  );
}

function CategoryBadge({ category }: { category: UpdateCategory }) {
  const colors = categoryColors[category];
  const labels: Record<UpdateCategory, string> = {
    feature: "Feature",
    improvement: "Improvement",
    bugfix: "Bug Fix",
    infrastructure: "Infrastructure",
    enhancement: "Enhancement",
  };
  const icons: Record<UpdateCategory, React.ReactNode> = {
    feature: <Sparkles className="h-3.5 w-3.5" />,
    improvement: <Wrench className="h-3.5 w-3.5" />,
    bugfix: <Bug className="h-3.5 w-3.5" />,
    infrastructure: <Building2 className="h-3.5 w-3.5" />,
    enhancement: <Wrench className="h-3.5 w-3.5" />,
  };
  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium border ${colors.bg} ${colors.text} ${colors.border}`}>
      {icons[category]}
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
      <div className={`absolute left-0 top-1.5 w-6 h-6 rounded-full border-2 flex items-center justify-center ${
        isFirst
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
        <div className="p-5 border-b border-slate-100">
          <div className="flex items-start justify-between gap-3 mb-3">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                {update.type && <TypeBadge type={update.type} />}
                {update.version && (
                  <span className="text-xs font-mono text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                    v{update.version}
                  </span>
                )}
              </div>
              <h3 className="text-lg font-semibold text-slate-900">{update.title}</h3>
            </div>
            <div className="flex items-center gap-1.5 text-sm text-slate-500 whitespace-nowrap">
              <Calendar className="h-4 w-4" />
              <time>{formatted}</time>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <CategoryBadge category={update.category} />
            {update.tags.map((tag) => (
              <Tag key={tag} tag={tag} />
            ))}
          </div>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4">
          <p className="text-sm text-slate-700 leading-relaxed">{update.body}</p>

          {/* Enhanced sections */}
          {(update.whatChanged || update.whyItMatters || update.whoItHelps) && (
            <div className="grid gap-3 pt-2">
              {update.whatChanged && (
                <div className="flex gap-3">
                  <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center">
                    <Wrench className="h-4 w-4 text-blue-600" />
                  </div>
                  <div className="flex-1">
                    <div className="text-xs font-semibold text-slate-900 uppercase tracking-wide mb-1">
                      What Changed
                    </div>
                    <p className="text-sm text-slate-600 leading-relaxed">{update.whatChanged}</p>
                  </div>
                </div>
              )}

              {update.whyItMatters && (
                <div className="flex gap-3">
                  <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center">
                    <Target className="h-4 w-4 text-emerald-600" />
                  </div>
                  <div className="flex-1">
                    <div className="text-xs font-semibold text-slate-900 uppercase tracking-wide mb-1">
                      Why It Matters
                    </div>
                    <p className="text-sm text-slate-600 leading-relaxed">{update.whyItMatters}</p>
                  </div>
                </div>
              )}

              {update.whoItHelps && (
                <div className="flex gap-3">
                  <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-violet-50 flex items-center justify-center">
                    <Users className="h-4 w-4 text-violet-600" />
                  </div>
                  <div className="flex-1">
                    <div className="text-xs font-semibold text-slate-900 uppercase tracking-wide mb-1">
                      Who It Helps
                    </div>
                    <p className="text-sm text-slate-600 leading-relaxed">{update.whoItHelps}</p>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Screenshot/Video */}
          {(update.screenshot || update.videoUrl) && (
            <div className="pt-2 space-y-2">
              {update.screenshot && (
                <div className="rounded-lg border border-slate-200 overflow-hidden bg-slate-50">
                  <img
                    src={update.screenshot}
                    alt={`Screenshot for ${update.title}`}
                    className="w-full h-auto"
                  />
                </div>
              )}
              {update.videoUrl && (
                <a
                  href={update.videoUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-sm font-medium text-slate-700 transition-colors"
                >
                  <Video className="h-4 w-4" />
                  Watch demo video
                </a>
              )}
            </div>
          )}
        </div>

        {/* Footer with roadmap link */}
        {phase && (
          <div className="px-5 py-3 bg-slate-50 border-t border-slate-100">
            <Link
              href={`/roadmap#${phase.id}`}
              className="inline-flex items-center gap-2 text-sm text-blue-600 hover:text-blue-700 font-medium group/link"
            >
              <PhaseIcon name={phase.icon} className="h-5 w-5" />
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
      className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
        active
          ? "bg-slate-900 text-white"
          : "bg-slate-100 text-slate-600 hover:bg-slate-200"
      }`}
    >
      {children}
    </button>
  );
}

// Group updates by month
function groupUpdatesByMonth(updates: Update[]): Map<string, Update[]> {
  const grouped = new Map<string, Update[]>();

  updates.forEach(update => {
    const date = new Date(update.date);
    const monthKey = date.toLocaleDateString("en-US", {
      month: "long",
      year: "numeric"
    });

    if (!grouped.has(monthKey)) {
      grouped.set(monthKey, []);
    }
    grouped.get(monthKey)!.push(update);
  });

  return grouped;
}

function UpdatesPageInner() {
  const searchParams = useSearchParams();
  const phaseFilter = searchParams.get("phase");
  const [selectedType, setSelectedType] = useState<UpdateType | 'all'>('all');

  // Sort by date, newest first
  const sortedUpdates = [...updates].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  );

  // Filter by phase if specified
  let filteredUpdates = phaseFilter
    ? sortedUpdates.filter((u) => u.phaseId === phaseFilter)
    : sortedUpdates;

  // Filter by type
  if (selectedType !== 'all') {
    filteredUpdates = filteredUpdates.filter((u) => u.type === selectedType);
  }

  const currentPhase = phaseFilter ? getPhaseById(phaseFilter) : null;

  // Group by month
  const groupedUpdates = groupUpdatesByMonth(filteredUpdates);

  // Stats
  const featureCount = updates.filter((u) => u.category === "feature").length;
  const improvementCount = updates.filter((u) => u.category === "improvement").length;
  const infraCount = updates.filter((u) => u.category === "infrastructure").length;
  const totalUpdates = updates.length;

  return (
    <DashboardShell>
      <div className="max-w-4xl mx-auto space-y-6">
        <Breadcrumbs
          items={[
            { label: "Roadmap", href: "/roadmap" },
            { label: "Updates" },
          ]}
        />

        {/* Header */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h1 className="text-3xl font-bold text-slate-900">Release Notes</h1>
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
          <p className="text-slate-600 text-lg">
            Track what&apos;s new, improved, and fixed in Campreserv. We ship updates regularly to make campground management better.
          </p>
        </div>

        {/* Stats bar */}
        <div className="grid grid-cols-4 gap-4">
          <div className="bg-gradient-to-br from-slate-50 to-slate-100 border border-slate-200 rounded-lg p-4 text-center">
            <div className="text-2xl font-bold text-slate-900">{totalUpdates}</div>
            <div className="text-sm text-slate-600">Total Updates</div>
          </div>
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

        {/* Type filters */}
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="text-sm font-medium text-slate-700">Filter by type:</div>
            <div className="flex items-center gap-2 flex-wrap">
              <FilterButton
                active={selectedType === 'all'}
                onClick={() => setSelectedType('all')}
              >
                All
              </FilterButton>
              <FilterButton
                active={selectedType === 'new'}
                onClick={() => setSelectedType('new')}
              >
                New
              </FilterButton>
              <FilterButton
                active={selectedType === 'update'}
                onClick={() => setSelectedType('update')}
              >
                Update
              </FilterButton>
              <FilterButton
                active={selectedType === 'enhancement'}
                onClick={() => setSelectedType('enhancement')}
              >
                Enhancement
              </FilterButton>
              <FilterButton
                active={selectedType === 'fix'}
                onClick={() => setSelectedType('fix')}
              >
                Fix
              </FilterButton>
            </div>
          </div>
        </div>

        {/* Phase filter indicator */}
        {currentPhase && (
          <div className="flex items-center justify-between bg-blue-50 border border-blue-100 rounded-lg p-3">
            <div className="flex items-center gap-2 text-sm text-blue-700">
              <PhaseIcon name={currentPhase.icon} className="h-5 w-5" />
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

        {/* Updates timeline grouped by month */}
        <div className="pt-4">
          {filteredUpdates.length === 0 ? (
            <div className="text-center py-12 text-slate-500">
              <p className="text-lg font-medium">No updates found</p>
              <p className="text-sm mt-1">Try adjusting your filters</p>
            </div>
          ) : (
            <div className="space-y-8">
              {Array.from(groupedUpdates.entries()).map(([month, monthUpdates], monthIndex) => (
                <div key={month}>
                  {/* Month header */}
                  <div className="flex items-center gap-3 mb-6">
                    <div className="flex-1 h-px bg-gradient-to-r from-slate-300 to-transparent" />
                    <h2 className="text-xl font-bold text-slate-900">{month}</h2>
                    <div className="flex-1 h-px bg-gradient-to-l from-slate-300 to-transparent" />
                  </div>

                  {/* Updates for this month */}
                  {monthUpdates.map((update, index) => (
                    <UpdateCard
                      key={update.id}
                      update={update}
                      isFirst={monthIndex === 0 && index === 0}
                    />
                  ))}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Subscribe CTA */}
        <div className="bg-gradient-to-r from-slate-800 to-slate-900 rounded-xl p-6 text-center text-white">
          <h3 className="text-lg font-semibold mb-2">Stay informed</h3>
          <p className="text-slate-300 text-sm mb-4">
            Get notified when we ship new features and improvements.
          </p>
          <div className="flex justify-center gap-3">
            <input
              type="email"
              placeholder="hello@keeprstay.com"
              className="px-4 py-2 rounded-lg bg-white/10 border border-white/20 text-white placeholder:text-slate-400 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-64"
            />
            <button className="px-4 py-2 rounded-lg bg-white text-slate-900 font-medium text-sm hover:bg-slate-100 transition-colors">
              Subscribe
            </button>
          </div>
          <p className="text-xs text-slate-400 mt-3">
            No spam, just updates when we ship something great.
          </p>
        </div>
      </div>
    </DashboardShell>
  );
}

export default function UpdatesPage() {
  return (
    <Suspense fallback={<div className="p-6 text-sm text-slate-600">Loading updates...</div>}>
      <UpdatesPageInner />
    </Suspense>
  );
}
