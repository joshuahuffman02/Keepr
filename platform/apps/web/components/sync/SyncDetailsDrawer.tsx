"use client";

import { useSyncStatus } from "@/contexts/SyncStatusContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useState } from "react";
import { Check, RefreshCw, AlertTriangle, X } from "lucide-react";

interface SyncDetailsDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SyncDetailsDrawer({ open, onOpenChange }: SyncDetailsDrawerProps) {
  const { status, manualSync, clearQueue, retryConflict, discardConflict, refresh } =
    useSyncStatus();
  const [syncing, setSyncing] = useState(false);

  const handleManualSync = async () => {
    setSyncing(true);
    try {
      await manualSync();
    } catch (err: unknown) {
      console.error("Manual sync failed:", err);
    } finally {
      setSyncing(false);
    }
  };

  const stateConfig = {
    synced: {
      icon: <Check className="h-6 w-6" />,
      label: "All Synced",
      description: "All changes have been synchronized",
      color: "text-emerald-600 bg-emerald-50 border-emerald-200",
    },
    syncing: {
      icon: <RefreshCw className="h-6 w-6 animate-spin" />,
      label: "Syncing",
      description: "Synchronizing changes...",
      color: "text-blue-600 bg-blue-50 border-blue-200",
    },
    pending: {
      icon: <AlertTriangle className="h-6 w-6" />,
      label: `${status.totalPending} Pending`,
      description: "Changes waiting to sync",
      color: "text-amber-700 bg-amber-50 border-amber-200",
    },
    offline: {
      icon: <X className="h-6 w-6" />,
      label: "Offline",
      description: "No internet connection",
      color: "text-red-700 bg-red-50 border-red-200",
    },
    error: {
      icon: <X className="h-6 w-6" />,
      label: `${status.totalConflicts} Conflicts`,
      description: "Some items need attention",
      color: "text-red-700 bg-red-50 border-red-200",
    },
  };

  const config = stateConfig[status.state];

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Sync Status</SheetTitle>
          <SheetDescription>View and manage offline sync queue</SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          {/* Current Status */}
          <div className={cn("rounded-lg border p-4", config.color)}>
            <div className="flex items-start gap-3">
              <span>{config.icon}</span>
              <div className="flex-1">
                <div className="font-semibold text-base">{config.label}</div>
                <div className="text-sm opacity-80 mt-0.5">{config.description}</div>
                {status.lastSyncTime && (
                  <div className="text-xs opacity-70 mt-2">
                    Last sync: {formatDistanceToNow(status.lastSyncTime, { addSuffix: true })}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-2">
            <Button
              onClick={handleManualSync}
              disabled={!status.isOnline || syncing || status.isSyncing}
              className="flex-1"
            >
              {syncing || status.isSyncing ? (
                <>
                  <svg
                    className="h-4 w-4 mr-2 animate-spin"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <path
                      d="M21 12a9 9 0 1 1-6.219-8.56"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                  Syncing...
                </>
              ) : (
                "Sync Now"
              )}
            </Button>
            <Button onClick={refresh} variant="outline">
              Refresh
            </Button>
          </div>

          {/* Queue Details */}
          {status.queues.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-foreground">Pending Items by Queue</h3>
              {status.queues
                .filter((q) => q.count > 0)
                .map((queue) => (
                  <div
                    key={queue.key}
                    className="rounded-lg border border-border bg-muted p-3 space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-foreground">{queue.label}</span>
                        <Badge variant={queue.count > 0 ? "secondary" : "outline"}>
                          {queue.count} items
                        </Badge>
                        {queue.conflicts > 0 && (
                          <Badge variant="destructive">{queue.conflicts} conflicts</Badge>
                        )}
                      </div>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => clearQueue(queue.key)}
                        className="text-xs"
                      >
                        Clear
                      </Button>
                    </div>

                    {queue.nextRetry && (
                      <div className="text-xs text-muted-foreground">
                        Next retry: {new Date(queue.nextRetry).toLocaleTimeString()}
                      </div>
                    )}

                    {queue.lastError && (
                      <div className="text-xs text-red-600 bg-red-50 border border-red-200 rounded px-2 py-1">
                        {queue.lastError}
                      </div>
                    )}

                    {queue.conflicts > 0 && (
                      <div className="pt-2 border-t border-border">
                        <div className="text-xs font-medium text-foreground mb-2">
                          Conflicts require attention:
                        </div>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => {
                              // For now, we'll retry all conflicts in the queue
                              // In a real implementation, you'd need item IDs
                              window.dispatchEvent(
                                new CustomEvent("campreserv:retry-conflicts", {
                                  detail: { queueKey: queue.key },
                                }),
                              );
                            }}
                          >
                            Retry All
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => clearQueue(queue.key)}>
                            Discard All
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
            </div>
          )}

          {/* Empty State */}
          {status.queues.every((q) => q.count === 0) && status.state === "synced" && (
            <div className="text-center py-8">
              <div className="flex justify-center mb-2">
                <Check className="h-10 w-10 text-emerald-600" />
              </div>
              <div className="text-sm font-medium text-foreground">All caught up!</div>
              <div className="text-xs text-muted-foreground mt-1">No pending changes to sync</div>
            </div>
          )}

          {/* Offline Notice */}
          {!status.isOnline && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
              <div className="flex items-start gap-2">
                <svg
                  className="h-5 w-5 text-amber-600 flex-shrink-0"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path
                    d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <path d="M12 9v4M12 17h.01" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                <div className="text-sm text-amber-900">
                  <div className="font-medium">You're offline</div>
                  <div className="text-xs mt-0.5 opacity-90">
                    Changes will sync automatically when you reconnect
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Help Text */}
          <div className="rounded-lg border border-border bg-muted p-3 text-xs text-muted-foreground">
            <div className="font-medium text-foreground mb-1">How sync works</div>
            <ul className="space-y-1 list-disc list-inside">
              <li>Changes are saved locally when offline</li>
              <li>Automatic sync when connection returns</li>
              <li>Manual sync available anytime</li>
              <li>Conflicts require manual resolution</li>
            </ul>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
