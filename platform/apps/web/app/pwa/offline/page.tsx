"use client";

import { Button } from "@/components/ui/button";
import Link from "next/link";

export default function OfflinePage() {
  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
      <div className="max-w-md w-full rounded-2xl border border-slate-200 bg-white shadow-sm p-6 space-y-4 text-center">
        <div className="text-lg font-semibold text-slate-900">You&apos;re offline</div>
        <p className="text-sm text-slate-600">
          We couldn&apos;t reach the server. You can keep viewing any cached screens; new actions
          will retry when you&apos;re back online.
        </p>
        <div className="space-y-2 text-sm text-left text-slate-600 bg-slate-50 border border-slate-200 rounded-lg p-3">
          <div className="font-medium text-slate-800">What still works:</div>
          <ul className="list-disc pl-4 space-y-1">
            <li>Cached arrivals/tasks and guest stay details</li>
            <li>Queued actions will auto-retry when online</li>
          </ul>
        </div>
        <div className="flex items-center justify-center gap-3">
          <Button asChild variant="outline">
            <Link href="/">Back to home</Link>
          </Button>
          <Button onClick={() => window.location.reload()}>Retry</Button>
        </div>
      </div>
    </div>
  );
}
