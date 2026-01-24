"use client";

import Link from "next/link";
import { publicThemes } from "../../../lib/roadmap-data";

export default function PublicRoadmapPage() {
  return (
    <main className="min-h-screen bg-keepr-off-white">
      <div className="max-w-5xl mx-auto px-4 py-10 space-y-8">
        <div className="text-center space-y-3">
          <p className="text-xs uppercase tracking-[0.2em] text-keepr-clay">Roadmap</p>
          <h1 className="text-3xl font-bold text-foreground">What we&apos;re building</h1>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            High-level themes for operators and guests. For detailed milestones and changelog, see
            the in-app Roadmap and Updates pages.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          {[
            {
              id: "now",
              label: "Now",
              description: "What we are shipping now",
              items: publicThemes.now,
            },
            {
              id: "next",
              label: "Next",
              description: "Up next in active planning",
              items: publicThemes.next,
            },
            {
              id: "later",
              label: "Later",
              description: "On the horizon",
              items: publicThemes.later,
            },
          ].map((block) => (
            <div
              key={block.id}
              className="bg-card border border-border rounded-2xl shadow-sm p-4 flex flex-col gap-3"
            >
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xs uppercase tracking-wide text-muted-foreground">
                    {block.label}
                  </div>
                  <div className="text-sm text-muted-foreground">{block.description}</div>
                </div>
              </div>
              <ul className="space-y-2 text-sm text-foreground">
                {block.items.map((item) => (
                  <li key={item} className="flex items-start gap-2">
                    <span className="mt-1 h-1.5 w-1.5 rounded-full bg-keepr-clay flex-shrink-0" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="text-center text-sm text-muted-foreground space-y-2">
          <p>Want more detail? Visit the in-app Roadmap for full phases and milestones.</p>
          <div className="flex justify-center gap-3">
            <Link
              href="/roadmap"
              className="text-keepr-evergreen hover:text-keepr-evergreen-light font-medium"
            >
              Admin Roadmap
            </Link>
            <span className="text-muted-foreground">•</span>
            <Link
              href="/roadmap/public"
              className="text-keepr-evergreen hover:text-keepr-evergreen-light font-medium"
            >
              Public roadmap doc
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}
