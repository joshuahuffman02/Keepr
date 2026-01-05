"use client";

import Link from "next/link";

export function HelpAnchor({ topicId, label }: { topicId: string; label?: string }) {
  return (
    <Link
      href={`/dashboard/help#${topicId}`}
      className="inline-flex items-center justify-center w-5 h-5 rounded-full border border-border text-muted-foreground hover:text-emerald-700 hover:border-emerald-400 transition"
      title={label ?? "View help"}
      aria-label={label ?? "View help"}
    >
      ?
    </Link>
  );
}
