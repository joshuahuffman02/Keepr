"use client";

import { useRef, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

type HistoryPoint = { label: string; success: number; failed: number; conflicts: number };

type QueueTelemetry = {
  id: string;
  name: string;
  queued: number;
  lastSync: string;
  nextRetryAt: string;
  backoff: string;
  paused: boolean;
  history: HistoryPoint[];
};

const buildStubTelemetry = (): QueueTelemetry[] => {
  const now = Date.now();
  return [
    {
      id: "cg-1",
      name: "Pine Ridge",
      queued: 4,
      paused: false,
      backoff: "45s",
      lastSync: new Date(now - 3 * 60 * 1000).toISOString(),
      nextRetryAt: new Date(now + 45 * 1000).toISOString(),
      history: [
        { label: "Now", success: 12, failed: 1, conflicts: 0 },
        { label: "-5m", success: 15, failed: 0, conflicts: 1 },
        { label: "-15m", success: 14, failed: 2, conflicts: 0 },
      ],
    },
    {
      id: "cg-2",
      name: "Canyon Base",
      queued: 2,
      paused: false,
      backoff: "2m",
      lastSync: new Date(now - 7 * 60 * 1000).toISOString(),
      nextRetryAt: new Date(now + 2 * 60 * 1000).toISOString(),
      history: [
        { label: "Now", success: 9, failed: 0, conflicts: 0 },
        { label: "-5m", success: 11, failed: 1, conflicts: 0 },
        { label: "-15m", success: 10, failed: 1, conflicts: 1 },
      ],
    },
    {
      id: "cg-3",
      name: "Lakeview",
      queued: 6,
      paused: true,
      backoff: "4m",
      lastSync: new Date(now - 14 * 60 * 1000).toISOString(),
      nextRetryAt: new Date(now + 4 * 60 * 1000).toISOString(),
      history: [
        { label: "Now", success: 6, failed: 2, conflicts: 1 },
        { label: "-5m", success: 8, failed: 1, conflicts: 1 },
        { label: "-15m", success: 12, failed: 0, conflicts: 0 },
      ],
    },
  ];
};

const formatAgo = (isoDate: string) => {
  const diffMs = Math.max(0, Date.now() - new Date(isoDate).getTime());
  const minutes = Math.floor(diffMs / 60000);
  if (minutes <= 0) return "just now";
  if (minutes === 1) return "1m ago";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ago`;
};

const formatTime = (isoDate: string) => {
  return new Date(isoDate).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
};

type Tone = {
  card: string;
  header: string;
  title: string;
  sub: string;
  content: string;
  row: string;
  meta: string;
  name: string;
  bucketLabel: string;
  bucketStats: string;
  meterBg: string;
  notice: string;
  metaLabel: string;
  button: string | undefined;
};

export function OfflineTelemetryPanel({
  variant = "light",
  className,
}: {
  variant?: "light" | "dark";
  className?: string;
}) {
  const [rows, setRows] = useState<QueueTelemetry[]>(buildStubTelemetry);
  const [notice, setNotice] = useState<string | null>(null);
  const timerRef = useRef<number | null>(null);

  const tone: Tone =
    variant === "dark"
      ? {
          card: "pwa-card border-border bg-card text-foreground",
          header: "p-4 sm:p-5",
          title: "text-foreground",
          sub: "text-muted-foreground text-sm",
          content: "p-4 pt-0 sm:p-5 sm:pt-2",
          row: "border border-border bg-muted/60",
          meta: "text-xs text-muted-foreground",
          name: "text-sm font-semibold text-foreground",
          bucketLabel: "w-14 text-xs text-muted-foreground",
          bucketStats: "w-36 text-[11px] text-right text-muted-foreground",
          meterBg: "bg-muted/80",
          notice: "bg-muted text-foreground border border-border",
          metaLabel: "text-xs text-muted-foreground",
          button: "border-border bg-muted text-foreground hover:bg-muted",
        }
      : {
          card: "border-border bg-card",
          header: "p-4 sm:p-6",
          title: "text-foreground",
          sub: "text-muted-foreground text-sm",
          content: "p-4 pt-0 sm:p-6 sm:pt-2",
          row: "border border-border bg-muted",
          meta: "text-xs text-muted-foreground",
          name: "text-sm font-semibold text-foreground",
          bucketLabel: "w-14 text-xs text-muted-foreground",
          bucketStats: "w-40 text-[11px] text-right text-muted-foreground",
          meterBg: "bg-muted",
          notice: "",
          metaLabel: "text-xs text-muted-foreground",
          button: undefined,
        };

  const announce = (message: string) => {
    setNotice(message);
    if (timerRef.current) {
      window.clearTimeout(timerRef.current);
    }
    timerRef.current = window.setTimeout(() => setNotice(null), 2400);
  };

  const toggleDrain = (campId: string, paused: boolean) => {
    const target = rows.find((r) => r.id === campId);
    setRows((prev) => prev.map((entry) => (entry.id === campId ? { ...entry, paused } : entry)));
    if (target) {
      announce(`${paused ? "Paused" : "Resumed"} draining for ${target.name}`);
    }
  };

  const purgeQueue = (campId: string) => {
    const target = rows.find((r) => r.id === campId);
    announce(`Purge requested for ${target?.name ?? "queue"}`);
  };

  return (
    <Card className={cn(tone.card, className)}>
      <CardHeader className={tone.header}>
        <div className="space-y-1">
          <CardTitle className={tone.title}>Offline & sync telemetry</CardTitle>
          <p className={tone.sub}>
            Per-campground queue health over time, with retry/backoff insight and controls.
          </p>
        </div>
        {notice && (
          <Badge variant="secondary" className={tone.notice}>
            {notice}
          </Badge>
        )}
      </CardHeader>
      <CardContent className={tone.content}>
        <div className="space-y-3">
          {rows.map((row) => (
            <div key={row.id} className={cn("rounded-xl p-3 sm:p-4", tone.row)}>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={tone.name}>{row.name}</span>
                    <Badge variant={row.queued > 0 ? "secondary" : "outline"}>
                      {row.queued} queued
                    </Badge>
                    <Badge
                      variant={row.paused ? "outline" : "secondary"}
                      className={
                        row.paused ? "border-status-warning text-status-warning" : undefined
                      }
                    >
                      {row.paused ? "Paused" : "Draining"}
                    </Badge>
                  </div>
                  <div className={tone.meta}>
                    Last sync {formatAgo(row.lastSync)} • Backoff {row.backoff} (next{" "}
                    {formatTime(row.nextRetryAt)})
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2">
                    <span className={tone.metaLabel}>Drain</span>
                    <Switch
                      checked={!row.paused}
                      onCheckedChange={(checked) => toggleDrain(row.id, !checked)}
                    />
                  </div>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => purgeQueue(row.id)}
                    className={tone.button}
                  >
                    Purge stuck items
                  </Button>
                </div>
              </div>

              <div className="mt-3 space-y-2">
                <div className={tone.meta}>Queue health (success / fail / conflict)</div>
                {row.history.map((bucket) => {
                  const total = Math.max(1, bucket.success + bucket.failed + bucket.conflicts);
                  return (
                    <div key={bucket.label} className="flex items-center gap-3">
                      <span className={tone.bucketLabel}>{bucket.label}</span>
                      <div
                        className={cn("flex flex-1 h-2 overflow-hidden rounded-full", tone.meterBg)}
                      >
                        <div
                          className="h-full bg-emerald-500"
                          style={{ width: `${(bucket.success / total) * 100}%` }}
                        />
                        <div
                          className="h-full bg-amber-400"
                          style={{ width: `${(bucket.failed / total) * 100}%` }}
                        />
                        <div
                          className="h-full bg-orange-500"
                          style={{ width: `${(bucket.conflicts / total) * 100}%` }}
                        />
                      </div>
                      <div className={tone.bucketStats}>
                        {bucket.success} ok · {bucket.failed} fail · {bucket.conflicts} conflict
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
