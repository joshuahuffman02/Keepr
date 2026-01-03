"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { OfflineTelemetryPanel } from "@/components/pwa/OfflineTelemetryPanel";

type QueueStat = { key: string; label: string; count: number; conflicts: number; nextRetry?: number | null; lastError?: string | null };

const queueSources = [
  { key: "campreserv:pwa:queuedMessages", label: "Guest messages" },
  { key: "campreserv:pos:orderQueue", label: "POS orders" },
  { key: "campreserv:kiosk:checkinQueue", label: "Kiosk check-ins" },
  { key: "campreserv:portal:orderQueue", label: "Portal orders" },
  { key: "campreserv:portal:activityQueue", label: "Activity bookings" },
];

function loadQueue(key: string) {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(key);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export default function SyncSummaryPage() {
  const [queueStats, setQueueStats] = useState<QueueStat[]>([]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const stats: QueueStat[] = queueSources.map((q) => {
      const list = loadQueue(q.key);
      const conflicts = list.filter((i: any) => i?.conflict).length;
      const nextRetry =
        list
          .map((i: any) => i?.nextAttemptAt)
          .filter((n: any) => typeof n === "number")
          .sort((a: number, b: number) => a - b)[0] ?? null;
      const lastError = list.map((i: any) => i?.lastError).find((e: any) => e) ?? null;
      return {
        key: q.key,
        label: q.label,
        count: Array.isArray(list) ? list.length : 0,
        conflicts,
        nextRetry,
        lastError,
      };
    });
    setQueueStats(stats);
  }, []);

  return (
    <div>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-foreground">Sync Summary</h1>
            <p className="text-muted-foreground text-sm">Queue health across offline flows.</p>
          </div>
          <Link href="/pwa/sync-log" className="text-sm text-blue-400 hover:underline">
            View detailed sync log
          </Link>
        </div>

        <OfflineTelemetryPanel />

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {queueStats.map((q) => (
            <Card key={q.key}>
              <CardHeader>
                <CardTitle className="text-foreground text-base flex items-center gap-2">
                  {q.label}
                  <Badge variant={q.count > 0 ? "secondary" : "outline"}>{q.count} queued</Badge>
                  {q.conflicts > 0 && <Badge variant="destructive">{q.conflicts} conflicts</Badge>}
                </CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground space-y-1">
                <div>Next retry: {q.nextRetry ? new Date(q.nextRetry).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "—"}</div>
                <div>Last error: {q.lastError || "—"}</div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}

