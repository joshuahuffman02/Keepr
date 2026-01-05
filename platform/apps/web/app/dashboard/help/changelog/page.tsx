"use client";

import { DashboardShell } from "@/components/ui/layout/DashboardShell";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { BadgeCheck, Calendar, MessageSquare } from "lucide-react";
import Link from "next/link";

interface ReleaseNote {
  version: string;
  date: string;
  highlights: string[];
  focus: string;
}

const releases: ReleaseNote[] = [
  {
    version: "2024.09.2",
    date: "Sept 12, 2024",
    focus: "Front desk speed & payments",
    highlights: [
      "Faster walk-in creation with auto site suggestions",
      "Payment retries now surface gateway error codes inline",
      "Added keyboard shortcuts overlay to Reservations",
      "Bugfix: CSV export now honors date filters in Reports"
    ]
  },
  {
    version: "2024.09.1",
    date: "Sept 3, 2024",
    focus: "Reporting & exports",
    highlights: [
      "New Revenue by Site Class report with YOY comparison",
      "Scheduled exports to S3/FTP for accounting partners",
      "Added RevPAR, ADR, and pace tiles to Dashboard",
      "Changelog linked from Help for quick updates"
    ]
  },
  {
    version: "2024.08.3",
    date: "Aug 22, 2024",
    focus: "Guest communication",
    highlights: [
      "SMS templates for pre-arrival and late checkout",
      "Message history now visible on reservation timeline",
      "Improved email deliverability for confirmation emails",
      "Bugfix: Group invoices now show deposits correctly"
    ]
  }
];

export default function ChangelogPage() {
  return (
    <DashboardShell>
      <div className="space-y-6">
        <Breadcrumbs
          items={[
            { label: "Help", href: "/dashboard/help" },
            { label: "What's New" }
          ]}
        />

        <div className="card p-6">
          <div className="flex items-start justify-between mb-2">
            <div>
              <h1 className="text-2xl font-bold text-slate-900 mb-1">What's New</h1>
              <p className="text-slate-600">Product updates, fixes, and improvements for campground teams.</p>
            </div>
            <div className="px-3 py-1.5 bg-emerald-50 border border-emerald-200 rounded-lg text-sm text-emerald-700 font-semibold">
              Updated weekly
            </div>
          </div>
          <p className="text-sm text-slate-600">
            Looking for a feature? Drop it in the Feature Request option on the contact form.
          </p>
        </div>

        <div className="space-y-4">
          {releases.map((release) => (
            <div key={release.version} className="card p-5">
              <div className="flex items-center justify-between mb-2">
                <div>
                  <div className="text-xs font-semibold text-slate-500 uppercase">Version {release.version}</div>
                  <h2 className="text-lg font-semibold text-slate-900">{release.focus}</h2>
                </div>
                <div className="flex items-center gap-2 text-sm text-slate-500">
                  <Calendar className="h-4 w-4" />
                  {release.date}
                </div>
              </div>
              <ul className="space-y-1 text-sm text-slate-700 mb-3">
                {release.highlights.map((item, idx) => (
                  <li key={idx} className="flex items-start gap-2">
                    <BadgeCheck className="h-4 w-4 text-emerald-600 mt-0.5" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
              <div className="flex items-center gap-3 text-sm text-emerald-700 font-semibold">
                <Link href="/dashboard/help/contact" className="inline-flex items-center gap-2 hover:text-emerald-800">
                  <MessageSquare className="h-4 w-4" />
                  Send feedback on this release
                </Link>
                <Link href="/dashboard/help" className="text-slate-600 hover:text-slate-900 text-sm font-medium">
                  View documentation →
                </Link>
              </div>
            </div>
          ))}
        </div>
      </div>
    </DashboardShell>
  );
}
