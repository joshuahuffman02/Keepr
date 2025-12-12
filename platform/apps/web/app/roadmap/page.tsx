"use client";

import { DashboardShell } from "../../components/ui/layout/DashboardShell";
import { Breadcrumbs } from "../../components/breadcrumbs";
import Link from "next/link";
import { useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useWhoami } from "@/hooks/use-whoami";
import {
    roadmapPhases,
    getPhaseProgress,
    getUpdatesForPhase,
    statusColors,
    statusLabels,
    publicThemes,
    type RoadmapPhase,
    type Milestone,
} from "../../lib/roadmap-data";

const planningSnapshot = [
    {
        title: "Phase 1: Revenue & Reliability",
        items: [
            "Dynamic pricing & seasonal rate plans",
            "Deposits/auto-collect",
            "Add-ons & bundled upsells",
            "Automated comms (email/SMS templates + event hooks)",
            "Audit logs & RBAC hardening",
        ],
    },
    {
        title: "Phase 2: Operations & Experience",
        items: [
            "Housekeeping/turnover + tasking",
            "Maintenance tickets with site-out-of-order",
            "Self-service check-in / express checkout",
            "Group/linked bookings & blocks",
        ],
    },
    {
        title: "Phase 3: Distribution & Sales",
        items: [
            "OTA/channel manager sync",
            "Memberships/discounts & promo codes",
            "Public website/SEO tools",
        ],
    },
    {
        title: "Phase 4: Monetization & Insights",
        items: [
            "Gift cards & store credit",
            "POS for on-site store/activities",
            "Reporting/analytics (ADR, revenue, channel mix)",
            "Waitlist with auto-offers",
        ],
    },
];

function StatusBadge({ status }: { status: RoadmapPhase["status"] }) {
    const colors = statusColors[status];
    return (
        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${colors.bg} ${colors.text}`}>
            {statusLabels[status]}
        </span>
    );
}

function MilestoneIcon({ status }: { status: Milestone["status"] }) {
    if (status === "completed") {
        return (
            <span className="flex-shrink-0 w-5 h-5 flex items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
                <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
            </span>
        );
    }
    if (status === "in_progress") {
        return (
            <span className="flex-shrink-0 w-5 h-5 flex items-center justify-center rounded-full bg-blue-100 text-blue-600">
                <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
            </span>
        );
    }
    return (
        <span className="flex-shrink-0 w-5 h-5 flex items-center justify-center rounded-full bg-slate-100 text-slate-400">
            <span className="w-2 h-2 rounded-full bg-current" />
        </span>
    );
}

function ProgressBar({ percentage }: { percentage: number }) {
    return (
        <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
            <div
                className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-emerald-600 transition-all duration-500"
                style={{ width: `${percentage}%` }}
            />
        </div>
    );
}

function PhaseCard({ phase, index }: { phase: RoadmapPhase; index: number }) {
    const { completed, total, percentage } = getPhaseProgress(phase);
    const relatedUpdates = getUpdatesForPhase(phase.id);

    const colorGradients: Record<string, string> = {
        emerald: "from-emerald-500 to-teal-600",
        blue: "from-blue-500 to-indigo-600",
        violet: "from-violet-500 to-purple-600",
        amber: "from-amber-500 to-orange-600",
        rose: "from-rose-500 to-pink-600",
        orange: "from-orange-500 to-amber-600",
        pink: "from-pink-500 to-rose-600",
        cyan: "from-cyan-500 to-blue-600",
    };

    return (
        <div className="group relative pl-10">
            {/* Phase number indicator */}
            <div
                className={`absolute left-0 top-6 w-8 h-8 rounded-full shadow-lg flex items-center justify-center text-white font-bold text-sm z-10 bg-gradient-to-br ${colorGradients[phase.color]}`}
            >
                {index + 1}
            </div>

            {/* Card */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow overflow-hidden">
                {/* Header with gradient accent */}
                <div className={`h-1.5 bg-gradient-to-r ${colorGradients[phase.color]}`} />

                <div className="p-5">
                    {/* Title row */}
                    <div className="flex items-start justify-between gap-4 mb-3">
                        <div className="flex items-center gap-3">
                            <span className="text-2xl">{phase.icon}</span>
                            <div>
                                <h3 className="text-lg font-semibold text-slate-900">{phase.name}</h3>
                                <p className="text-sm text-slate-500 mt-0.5">{phase.description}</p>
                            </div>
                        </div>
                        <StatusBadge status={phase.status} />
                    </div>

                    {/* Progress */}
                    <div className="mb-4">
                        <div className="flex items-center justify-between text-sm mb-1.5">
                            <span className="text-slate-600">{completed} of {total} milestones complete</span>
                            <span className="font-medium text-slate-900">{percentage}%</span>
                        </div>
                        <ProgressBar percentage={percentage} />
                    </div>

                    {/* Milestones */}
                    <div className="space-y-2">
                        {phase.milestones.map((milestone) => (
                            <div key={milestone.id} className="flex items-start gap-3 py-1.5">
                                <MilestoneIcon status={milestone.status} />
                                <div className="flex-1 min-w-0">
                                    <div className={`text-sm font-medium ${milestone.status === 'completed' ? 'text-slate-600' : 'text-slate-900'}`}>
                                        {milestone.name}
                                    </div>
                                    <div className="text-xs text-slate-500 truncate">{milestone.description}</div>
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Related updates link */}
                    {relatedUpdates.length > 0 && (
                        <div className="mt-4 pt-3 border-t border-slate-100">
                            <Link
                                href={`/updates?phase=${phase.id}`}
                                className="inline-flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-700 font-medium"
                            >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                </svg>
                                {relatedUpdates.length} related update{relatedUpdates.length !== 1 ? 's' : ''}
                            </Link>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

export default function RoadmapPage() {
    const { status } = useSession();
    const router = useRouter();
    const { data: whoami, isLoading: whoamiLoading } = useWhoami();

    const isStaff =
        !!(whoami?.user as any)?.platformRole ||
        (whoami?.user?.memberships && whoami.user.memberships.length > 0);

    useEffect(() => {
        if (status === "unauthenticated") {
            router.replace("/roadmap/public");
        }
    }, [status, router]);

    useEffect(() => {
        if (status === "authenticated" && !whoamiLoading && !isStaff) {
            router.replace("/roadmap/public");
        }
    }, [status, whoamiLoading, isStaff, router]);

    if (status === "loading" || whoamiLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="flex flex-col items-center gap-3 text-slate-600">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600" />
                    <span className="text-sm">Loading roadmap…</span>
                </div>
            </div>
        );
    }

    if (status === "unauthenticated" || !isStaff) {
        return null;
    }

    const sortedPhases = [...roadmapPhases].sort((a, b) => a.order - b.order);

    const totalMilestones = sortedPhases.reduce((acc, p) => acc + p.milestones.length, 0);
    const completedMilestones = sortedPhases.reduce(
        (acc, p) => acc + p.milestones.filter(m => m.status === 'completed').length,
        0
    );
    const overallPercentage = totalMilestones === 0 ? 0 : Math.round((completedMilestones / totalMilestones) * 100);
    const formattedCompleted = completedMilestones.toLocaleString();
    const formattedTotal = totalMilestones.toLocaleString();

    return (
        <DashboardShell>
            <div className="max-w-4xl mx-auto space-y-6">
                <Breadcrumbs items={[{ label: "Roadmap" }]} />

                {/* Header */}
                <div className="text-center space-y-2">
                    <h1 className="text-3xl font-bold text-slate-900">Product Roadmap</h1>
                    <p className="text-slate-600 max-w-2xl mx-auto">
                        Our living roadmap showing what we&apos;ve built, what we&apos;re building, and what&apos;s coming next.
                    </p>
                </div>

                {/* Top-level progress snapshot */}
                <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                            <div className="text-sm font-semibold text-slate-900">Overall progress</div>
                            <p className="text-sm text-slate-600">
                                {formattedCompleted} of {formattedTotal} tasks finished
                            </p>
                        </div>
                        <div className="text-3xl font-bold text-emerald-600">{overallPercentage}%</div>
                    </div>
                    <div className="mt-3">
                        <ProgressBar percentage={overallPercentage} />
                    </div>
                    <div className="mt-2 flex flex-wrap items-center justify-between text-xs text-slate-500 gap-2">
                        <span>Stay oriented as you scroll the timeline below.</span>
                        <Link href="/updates" className="text-blue-600 hover:text-blue-700 font-medium">
                            View all updates →
                        </Link>
                    </div>
                </div>

                {/* Planning snapshot */}
                <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
                    <div className="flex items-center justify-between">
                        <div>
                            <div className="text-sm font-semibold text-slate-900">Latest planning snapshot</div>
                            <p className="text-sm text-slate-600">Sequenced phases from the Dec 09, 2025 roadmap refresh.</p>
                        </div>
                        <span className="text-xs text-slate-500">Dec 09, 2025</span>
                    </div>
                    <div className="mt-4 grid gap-3 md:grid-cols-2">
                        {planningSnapshot.map((phase) => (
                            <div key={phase.title} className="rounded-lg border border-slate-100 bg-slate-50/60 p-3">
                                <div className="text-sm font-semibold text-slate-900">{phase.title}</div>
                                <ul className="mt-2 space-y-1 text-sm text-slate-700">
                                    {phase.items.map((item) => (
                                        <li key={item} className="flex items-start gap-2">
                                            <span className="mt-1 h-1.5 w-1.5 rounded-full bg-emerald-500 flex-shrink-0" />
                                            <span>{item}</span>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Docs + public themes */}
                <div className="grid gap-4 md:grid-cols-2">
                    <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
                        <div className="flex items-start justify-between gap-2">
                            <div>
                                <div className="text-sm font-semibold text-slate-900">Roadmap docs</div>
                                <p className="text-sm text-slate-600">Full detail lives in the repo docs.</p>
                            </div>
                            <span className="text-xs text-slate-500">Updated Dec 09, 2025</span>
                        </div>
                        <div className="mt-3 space-y-2 text-sm">
                            <Link
                                className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-700 font-medium"
                                href="/roadmap/public"
                            >
                                Public roadmap doc
                            </Link>
                            <br />
                            <Link
                                className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-700 font-medium"
                                href="/roadmap/internal"
                            >
                                Internal roadmap doc
                            </Link>
                            <p className="text-xs text-slate-500">
                                Docs are sourced from <code className="text-[11px] bg-slate-100 px-1 py-0.5 rounded">docs/roadmap-public.md</code> and <code className="text-[11px] bg-slate-100 px-1 py-0.5 rounded">docs/roadmap-internal.md</code>.
                            </p>
                        </div>
                    </div>

                    <div className="bg-slate-900 text-white rounded-xl p-4 shadow-sm">
                        <div className="flex items-center justify-between">
                            <div>
                                <div className="text-sm font-semibold">Public themes</div>
                                <p className="text-sm text-slate-300">Now / Next / Later at a glance.</p>
                            </div>
                            <div className="text-xs text-slate-400">From docs/roadmap-public.md</div>
                        </div>
                        <div className="mt-3 grid gap-3 sm:grid-cols-3">
                            {[
                                { label: "Now", items: publicThemes.now },
                                { label: "Next", items: publicThemes.next },
                                { label: "Later", items: publicThemes.later },
                            ].map((block) => (
                                <div key={block.label} className="bg-white/5 rounded-lg p-3 border border-white/10">
                                    <div className="text-xs uppercase tracking-wide text-slate-300">{block.label}</div>
                                    <ul className="mt-2 space-y-1 text-xs text-slate-200">
                                        {block.items.map(item => (
                                            <li key={item} className="flex items-start gap-1">
                                                <span className="mt-1 h-1.5 w-1.5 rounded-full bg-emerald-300 flex-shrink-0" />
                                                <span>{item}</span>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Phase timeline */}
                <div className="relative">
                    {/* Vertical line */}
                    <div className="absolute left-1 top-4 bottom-4 w-px bg-gradient-to-b from-emerald-300 via-blue-300 to-violet-300" />

                    {/* Phase cards */}
                    <div className="space-y-6">
                        {sortedPhases.map((phase, index) => (
                            <PhaseCard key={phase.id} phase={phase} index={index} />
                        ))}
                    </div>
                </div>

                {/* Legend */}
                <div className="bg-slate-50 rounded-lg p-4 text-sm">
                    <div className="font-medium text-slate-700 mb-2">Legend</div>
                    <div className="flex flex-wrap gap-4">
                        <div className="flex items-center gap-2">
                            <MilestoneIcon status="completed" />
                            <span className="text-slate-600">Completed</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <MilestoneIcon status="in_progress" />
                            <span className="text-slate-600">In Progress</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <MilestoneIcon status="planned" />
                            <span className="text-slate-600">Planned</span>
                        </div>
                    </div>
                </div>
            </div>
        </DashboardShell>
    );
}
