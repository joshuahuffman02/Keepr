"use client";

import { useState, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { useCampground } from "@/contexts/CampgroundContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  CheckCircle2,
  AlertTriangle,
  Info,
  XCircle,
  RefreshCw,
  Loader2,
  Settings,
  DollarSign,
  Calendar,
  Users,
  ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import Link from "next/link";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:4000/api";

interface SystemCheckIssue {
  id: string;
  severity: "error" | "warning" | "info";
  category: "pricing" | "bookings" | "access" | "property" | "system";
  message: string;
  description: string;
  actionLabel: string;
  actionHref: string;
}

async function fetchSystemIssues(campgroundId: string): Promise<SystemCheckIssue[]> {
  const response = await fetch(`${API_BASE}/campgrounds/${campgroundId}/system-check`, {
    credentials: "include",
  });
  if (!response.ok) {
    throw new Error("Failed to fetch system check");
  }
  return response.json();
}

const categoryConfig = {
  pricing: { icon: DollarSign, label: "Pricing" },
  bookings: { icon: Calendar, label: "Bookings" },
  access: { icon: Users, label: "Access" },
  property: { icon: Settings, label: "Property" },
  system: { icon: Settings, label: "System" },
};

const severityConfig = {
  error: {
    icon: XCircle,
    color: "text-status-error",
    bg: "bg-status-error/15",
    border: "border-status-error/30",
    badge: "bg-status-error/15 text-status-error border-status-error/30",
    label: "Error",
    priority: 1,
  },
  warning: {
    icon: AlertTriangle,
    color: "text-status-warning",
    bg: "bg-status-warning/15",
    border: "border-status-warning/30",
    badge: "bg-status-warning/15 text-status-warning border-status-warning/30",
    label: "Warning",
    priority: 2,
  },
  info: {
    icon: Info,
    color: "text-status-info",
    bg: "bg-status-info/15",
    border: "border-status-info/30",
    badge: "bg-status-info/15 text-status-info border-status-info/30",
    label: "Suggestion",
    priority: 3,
  },
};

type FilterValue = "all" | "actionable" | "info";

export default function SystemCheckPage() {
  const { selectedCampground, isHydrated } = useCampground();
  const [filter, setFilter] = useState<FilterValue>("actionable");

  const { data: issues = [], isLoading, refetch } = useQuery({
    queryKey: ["system-check", selectedCampground?.id],
    queryFn: () => fetchSystemIssues(selectedCampground!.id),
    enabled: isHydrated && !!selectedCampground?.id,
  });

  const handleRefresh = useCallback(async () => {
    await refetch();
  }, [refetch]);

  if (!isHydrated || !selectedCampground) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Sort by severity priority
  const sortedIssues = [...issues].sort(
    (a, b) => severityConfig[a.severity].priority - severityConfig[b.severity].priority
  );

  // Filter issues
  const filteredIssues = sortedIssues.filter((issue) => {
    if (filter === "all") return true;
    if (filter === "actionable") return issue.severity !== "info";
    if (filter === "info") return issue.severity === "info";
    return true;
  });

  // Count by severity
  const errorCount = issues.filter((i) => i.severity === "error").length;
  const warningCount = issues.filter((i) => i.severity === "warning").length;
  const infoCount = issues.filter((i) => i.severity === "info").length;
  const actionableCount = errorCount + warningCount;

  return (
    <div className="max-w-4xl space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground">System Check</h2>
          <p className="text-muted-foreground mt-1">
            Review configuration issues and recommendations
          </p>
        </div>
        <Button onClick={handleRefresh} disabled={isLoading} variant="outline">
          {isLoading ? (
            <Loader2 className="h-4 w-4 animate-spin mr-2" />
          ) : (
            <RefreshCw className="h-4 w-4 mr-2" />
          )}
          Refresh
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Errors */}
        <Card className={cn(errorCount > 0 ? "border-status-error/30 bg-status-error/15" : "")}>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className={cn(
                "h-10 w-10 rounded-lg flex items-center justify-center",
                errorCount > 0 ? "bg-status-error/15" : "bg-muted"
              )}>
                <XCircle className={cn(
                  "h-5 w-5",
                  errorCount > 0 ? "text-status-error" : "text-muted-foreground"
                )} />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{errorCount}</p>
                <p className="text-sm text-muted-foreground">Errors</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Warnings */}
        <Card className={cn(warningCount > 0 ? "border-status-warning/30 bg-status-warning/15" : "")}>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className={cn(
                "h-10 w-10 rounded-lg flex items-center justify-center",
                warningCount > 0 ? "bg-status-warning/15" : "bg-muted"
              )}>
                <AlertTriangle className={cn(
                  "h-5 w-5",
                  warningCount > 0 ? "text-status-warning" : "text-muted-foreground"
                )} />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{warningCount}</p>
                <p className="text-sm text-muted-foreground">Warnings</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Suggestions */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg flex items-center justify-center bg-status-info/15">
                <Info className="h-5 w-5 text-status-info" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{infoCount}</p>
                <p className="text-sm text-muted-foreground">Suggestions</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 border-b pb-4">
        <Button
          variant={filter === "actionable" ? "default" : "ghost"}
          size="sm"
          onClick={() => setFilter("actionable")}
          className={filter === "actionable" ? "" : "text-muted-foreground"}
        >
          Actionable
          {actionableCount > 0 && (
            <Badge variant="secondary" className="ml-2 bg-card/20">
              {actionableCount}
            </Badge>
          )}
        </Button>
        <Button
          variant={filter === "info" ? "default" : "ghost"}
          size="sm"
          onClick={() => setFilter("info")}
          className={filter === "info" ? "" : "text-muted-foreground"}
        >
          Suggestions
          {infoCount > 0 && (
            <Badge variant="secondary" className="ml-2">
              {infoCount}
            </Badge>
          )}
        </Button>
        <Button
          variant={filter === "all" ? "default" : "ghost"}
          size="sm"
          onClick={() => setFilter("all")}
          className={filter === "all" ? "" : "text-muted-foreground"}
        >
          All
        </Button>
      </div>

      {/* Issues List */}
      {filteredIssues.length === 0 ? (
        <Card className="border-green-200 bg-green-50/50">
          <CardContent className="py-12 text-center">
            <div className="inline-flex items-center justify-center h-16 w-16 rounded-full bg-status-success/15 mb-4">
              <CheckCircle2 className="h-8 w-8 text-status-success" />
            </div>
            <h3 className="text-lg font-medium text-foreground">All clear!</h3>
            <p className="text-muted-foreground mt-1 max-w-sm mx-auto">
              {filter === "actionable"
                ? "No errors or warnings to address."
                : filter === "info"
                ? "No additional suggestions at this time."
                : "Your system configuration looks great."}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filteredIssues.map((issue) => {
            const severity = severityConfig[issue.severity];
            const category = categoryConfig[issue.category];
            const SeverityIcon = severity.icon;
            const CategoryIcon = category.icon;

            return (
              <Card
                key={issue.id}
                className={cn(
                  "transition-all duration-200 hover:shadow-md group",
                  severity.border
                )}
              >
                <CardContent className="py-4">
                  <div className="flex items-start gap-4">
                    {/* Severity Icon */}
                    <div className={cn("p-2 rounded-lg flex-shrink-0", severity.bg)}>
                      <SeverityIcon className={cn("h-5 w-5", severity.color)} />
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="font-medium text-foreground">
                          {issue.message}
                        </h4>
                        <Badge variant="outline" className={cn("text-xs", severity.badge)}>
                          {severity.label}
                        </Badge>
                        <Badge variant="outline" className="text-xs text-muted-foreground">
                          <CategoryIcon className="h-3 w-3 mr-1" />
                          {category.label}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground mt-1">
                        {issue.description}
                      </p>
                    </div>

                    {/* Action */}
                    <Button
                      variant="ghost"
                      size="sm"
                      asChild
                      className="flex-shrink-0 opacity-70 group-hover:opacity-100 transition-opacity"
                    >
                      <Link href={issue.actionHref}>
                        {issue.actionLabel}
                        <ChevronRight className="h-4 w-4 ml-1" />
                      </Link>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
