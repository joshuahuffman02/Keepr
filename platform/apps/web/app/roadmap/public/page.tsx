"use client";

import Link from "next/link";
import * as LucideIcons from "lucide-react";
import {
  roadmapPhases,
  getPhaseProgress,
  getUpdatesForPhase,
  statusColors,
  statusLabels,
} from "../../../lib/roadmap-data";

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

export default function PublicRoadmapPage() {
  const sortedPhases = [...roadmapPhases].sort((a, b) => a.order - b.order);

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-200">
        <div className="max-w-5xl mx-auto px-6 py-5 flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-emerald-600">Product roadmap</p>
            <h1 className="text-2xl font-bold text-slate-900">Keepr</h1>
            <p className="text-sm text-slate-600">What we're building next</p>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href="/"
              className="px-3 py-2 text-sm font-semibold text-slate-700 border border-slate-200 rounded-lg hover:bg-slate-100"
            >
              Back to home
            </Link>
            <Link
              href="/auth/signin?callbackUrl=/roadmap"
              className="px-4 py-2 text-sm font-semibold text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 shadow-sm"
            >
              Staff sign in
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-8 space-y-6">
        <div className="grid gap-4 md:grid-cols-2">
          {sortedPhases.map((phase, idx) => {
            const { completed, total, percentage } = getPhaseProgress(phase);
            const relatedUpdates = getUpdatesForPhase(phase.id);
            const colors = statusColors[phase.status];
            return (
              <div key={phase.id} className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="h-1.5" style={{ background: `linear-gradient(90deg, ${colors.bg.replace('bg-', '').replace('-', '')})` }} />
                <div className="p-5 space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <PhaseIcon name={phase.icon} className="h-5 w-5 text-slate-600 mt-1" />
                      <div>
                        <div className="text-xs font-semibold text-slate-500">Phase {idx + 1}</div>
                        <h3 className="text-lg font-semibold text-slate-900">{phase.name}</h3>
                        <p className="text-sm text-slate-600">{phase.description}</p>
                      </div>
                    </div>
                    <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${colors.bg} ${colors.text}`}>
                      {statusLabels[phase.status]}
                    </span>
                  </div>

                  <div>
                    <div className="flex items-center justify-between text-sm mb-1">
                      <span className="text-slate-600">
                        {completed} of {total} milestones
                      </span>
                      <span className="font-semibold text-slate-900">{percentage}%</span>
                    </div>
                    <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                      <div className="h-full rounded-full bg-emerald-500" style={{ width: `${percentage}%` }} />
                    </div>
                  </div>

                  <div className="space-y-1">
                    {phase.milestones.slice(0, 4).map((m) => (
                      <div key={m.id} className="flex items-start gap-2">
                        <span className="mt-1 h-2 w-2 rounded-full bg-slate-300" />
                        <div className="text-sm text-slate-700">{m.name}</div>
                      </div>
                    ))}
                    {phase.milestones.length > 4 && (
                      <div className="text-xs text-slate-500">+ {phase.milestones.length - 4} more</div>
                    )}
                  </div>

                  {relatedUpdates.length > 0 && (
                    <Link
                      href={`/updates?phase=${phase.id}`}
                      className="inline-flex items-center gap-1 text-sm font-semibold text-emerald-600 hover:text-emerald-700"
                    >
                      View related updates
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </Link>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </main>
    </div>
  );
}
