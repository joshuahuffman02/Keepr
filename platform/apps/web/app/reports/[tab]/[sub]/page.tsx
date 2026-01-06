"use client";

import { Suspense, useEffect } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import ReportsPage from "@/app/reports/page";
import { normalizeReportSelection } from "@/lib/report-links";

export default function ReportSubTabPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const rawTab = typeof params?.tab === "string" ? params.tab : "";
  const rawSub = typeof params?.sub === "string" ? params.sub : null;
  const normalized = normalizeReportSelection(rawTab, rawSub) || { tab: "overview", subTab: null };

  useEffect(() => {
    const nextParams = new URLSearchParams(searchParams.toString());
    const currentTab = nextParams.get("tab");
    const currentSub = nextParams.get("sub");
    let changed = false;

    if (currentTab !== normalized.tab) {
      nextParams.set("tab", normalized.tab);
      changed = true;
    }

    if (normalized.subTab) {
      if (currentSub !== normalized.subTab) {
        nextParams.set("sub", normalized.subTab);
        changed = true;
      }
    } else if (currentSub) {
      nextParams.delete("sub");
      changed = true;
    }

    if (changed) {
      router.replace(`?${nextParams.toString()}`);
    }
  }, [normalized.tab, normalized.subTab, router, searchParams]);

  return (
    <Suspense fallback={<div className="p-6 text-sm text-muted-foreground">Loading report…</div>}>
      <ReportsPage />
    </Suspense>
  );
}
