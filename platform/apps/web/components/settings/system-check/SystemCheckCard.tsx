"use client";

import { useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  AlertTriangle,
  CheckCircle2,
  Info,
  ChevronRight,
  Loader2,
  RefreshCw,
  XCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";

export interface SystemCheckIssue {
  id: string;
  severity: "error" | "warning" | "info";
  message: string;
  description?: string;
  actionLabel?: string;
  actionHref?: string;
  onFix?: () => Promise<void>;
}

interface SystemCheckCardProps {
  issues: SystemCheckIssue[];
  isLoading?: boolean;
  onRefresh?: () => void;
  compact?: boolean;
  className?: string;
}

const severityConfig = {
  error: {
    icon: XCircle,
    color: "text-status-error",
    bg: "bg-status-error-bg",
    border: "border-status-error-border",
    badge: "bg-status-error-bg text-status-error-text",
    label: "Error",
  },
  warning: {
    icon: AlertTriangle,
    color: "text-status-warning",
    bg: "bg-status-warning-bg",
    border: "border-status-warning-border",
    badge: "bg-status-warning-bg text-status-warning-text",
    label: "Warning",
  },
  info: {
    icon: Info,
    color: "text-status-info",
    bg: "bg-status-info-bg",
    border: "border-status-info-border",
    badge: "bg-status-info-bg text-status-info-text",
    label: "Info",
  },
};

export function SystemCheckCard({
  issues,
  isLoading,
  onRefresh,
  compact,
  className,
}: SystemCheckCardProps) {
  const [fixingId, setFixingId] = useState<string | null>(null);
  const [resolvedIds, setResolvedIds] = useState<Set<string>>(new Set());

  const actionableCount = issues.filter(
    (i) => i.severity !== "info" && !resolvedIds.has(i.id),
  ).length;

  const visibleIssues = issues.filter((i) => !resolvedIds.has(i.id));

  const handleFix = async (issue: SystemCheckIssue) => {
    if (!issue.onFix) return;
    setFixingId(issue.id);
    try {
      await issue.onFix();
      // Mark as resolved with animation
      setResolvedIds((prev) => new Set([...prev, issue.id]));
    } catch (error) {
      console.error("Failed to fix issue:", error);
    } finally {
      setFixingId(null);
    }
  };

  // All issues resolved
  if (visibleIssues.length === 0) {
    return (
      <Card className={cn("border-status-success-border bg-status-success-bg/50", className)}>
        <CardContent className="py-8 text-center">
          <div className="inline-flex items-center justify-center h-12 w-12 rounded-full bg-status-success-bg mb-3">
            <CheckCircle2 className="h-6 w-6 text-status-success" />
          </div>
          <h3 className="font-medium text-foreground">All systems go!</h3>
          <p className="text-sm text-muted-foreground mt-1">No configuration issues detected</p>
          {onRefresh && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onRefresh}
              disabled={isLoading}
              className="mt-4"
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <RefreshCw className="h-4 w-4 mr-2" />
              )}
              Check again
            </Button>
          )}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <AlertTriangle className="h-5 w-5 text-amber-500" aria-hidden="true" />
          System Check
        </CardTitle>
        <div className="flex items-center gap-2">
          {actionableCount > 0 && (
            <Badge className="bg-status-warning-bg text-status-warning-text hover:bg-status-warning-bg">
              {actionableCount} to review
            </Badge>
          )}
          {onRefresh && (
            <Button variant="ghost" size="sm" onClick={onRefresh} disabled={isLoading}>
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
              <span className="sr-only">Refresh</span>
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="divide-y">
          {visibleIssues.map((issue) => {
            const config = severityConfig[issue.severity];
            const Icon = config.icon;
            const isFixing = fixingId === issue.id;

            return (
              <div
                key={issue.id}
                className={cn(
                  "flex items-start gap-3 py-3 group transition-all duration-300",
                  compact ? "py-2" : "py-3",
                )}
              >
                <div className={cn("flex-shrink-0 p-1.5 rounded-lg", config.bg)}>
                  <Icon className={cn("h-4 w-4", config.color)} aria-hidden="true" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-foreground">{issue.message}</span>
                    <Badge
                      variant="secondary"
                      className={cn("text-[10px] px-1.5 py-0", config.badge)}
                    >
                      {config.label}
                    </Badge>
                  </div>
                  {issue.description && !compact && (
                    <p className="text-sm text-muted-foreground mt-0.5">{issue.description}</p>
                  )}
                </div>

                {/* Action button */}
                {(issue.actionHref || issue.onFix) && (
                  <div className="flex-shrink-0">
                    {issue.actionHref ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        asChild
                        className="opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <Link href={issue.actionHref}>
                          {issue.actionLabel || "Fix"}
                          <ChevronRight className="h-4 w-4 ml-1" />
                        </Link>
                      </Button>
                    ) : (
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={isFixing}
                        onClick={() => handleFix(issue)}
                        className="opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        {isFixing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                        {issue.actionLabel || "Fix now"}
                      </Button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
