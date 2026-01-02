"use client";

import { useState } from "react";
import {
  Sparkles,
  ChevronDown,
  ChevronUp,
  Lightbulb,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  RefreshCw,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

interface Insight {
  type: "positive" | "negative" | "neutral" | "warning";
  title: string;
  description: string;
  metric?: {
    label: string;
    value: string | number;
    change?: number;
  };
}

interface AiInsightCardProps {
  title?: string;
  summary: string;
  insights: Insight[];
  recommendations?: string[];
  isLoading?: boolean;
  onRefresh?: () => void;
  collapsible?: boolean;
  defaultExpanded?: boolean;
}

export function AiInsightCard({
  title = "AI Analysis",
  summary,
  insights,
  recommendations = [],
  isLoading = false,
  onRefresh,
  collapsible = true,
  defaultExpanded = true,
}: AiInsightCardProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);

  const getInsightIcon = (type: Insight["type"]) => {
    switch (type) {
      case "positive":
        return <TrendingUp className="h-4 w-4 text-status-success" />;
      case "negative":
        return <TrendingDown className="h-4 w-4 text-status-error" />;
      case "warning":
        return <AlertTriangle className="h-4 w-4 text-status-warning" />;
      default:
        return <Lightbulb className="h-4 w-4 text-status-info" />;
    }
  };

  const getInsightBg = (type: Insight["type"]) => {
    switch (type) {
      case "positive":
        return "bg-status-success/10 border-status-success/20";
      case "negative":
        return "bg-status-error/10 border-status-error/20";
      case "warning":
        return "bg-status-warning/10 border-status-warning/20";
      default:
        return "bg-status-info/10 border-status-info/20";
    }
  };

  return (
    <Card className="bg-card border-border">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-action-primary/10 rounded-lg">
              <Sparkles className="h-4 w-4 text-action-primary" />
            </div>
            <CardTitle className="text-base text-foreground">{title}</CardTitle>
            <Badge className="bg-status-info-bg text-status-info-text border border-status-info-border text-xs">
              AI-Powered
            </Badge>
          </div>
          <div className="flex items-center gap-2">
            {onRefresh && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onRefresh}
                disabled={isLoading}
                className="h-8 w-8 p-0"
              >
                <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
              </Button>
            )}
            {collapsible && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setExpanded(!expanded)}
                className="h-8 w-8 p-0"
              >
                {expanded ? (
                  <ChevronUp className="h-4 w-4" />
                ) : (
                  <ChevronDown className="h-4 w-4" />
                )}
              </Button>
            )}
          </div>
        </div>
      </CardHeader>

      {expanded && (
        <CardContent className="space-y-4">
          {/* Summary */}
          <p className="text-sm text-muted-foreground leading-relaxed">{summary}</p>

          {/* Key Insights */}
          {insights.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Key Insights
              </p>
              <div className="grid gap-2">
                {insights.map((insight, idx) => (
                  <div
                    key={idx}
                    className={`p-3 rounded-lg border ${getInsightBg(insight.type)}`}
                  >
                    <div className="flex items-start gap-2">
                      {getInsightIcon(insight.type)}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground">
                          {insight.title}
                        </p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {insight.description}
                        </p>
                        {insight.metric && (
                          <div className="flex items-center gap-2 mt-2">
                            <span className="text-xs text-muted-foreground">
                              {insight.metric.label}:
                            </span>
                            <span className="text-sm font-medium text-foreground">
                              {insight.metric.value}
                            </span>
                            {insight.metric.change !== undefined && (
                              <span
                                className={`text-xs ${
                                  insight.metric.change >= 0
                                    ? "text-status-success"
                                    : "text-status-error"
                                }`}
                              >
                                {insight.metric.change >= 0 ? "+" : ""}
                                {insight.metric.change}%
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Recommendations */}
          {recommendations.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Recommendations
              </p>
              <ul className="space-y-1.5">
                {recommendations.map((rec, idx) => (
                  <li
                    key={idx}
                    className="flex items-start gap-2 text-sm text-muted-foreground"
                  >
                    <span className="text-action-primary mt-1">→</span>
                    {rec}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
}

/**
 * Loading skeleton for AI Insight Card
 */
export function AiInsightCardSkeleton() {
  return (
    <Card className="bg-card border-border">
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-action-primary/10 rounded-lg animate-pulse">
            <Sparkles className="h-4 w-4 text-action-primary" />
          </div>
          <div className="h-5 w-24 bg-muted rounded animate-pulse" />
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <div className="h-4 w-full bg-muted rounded animate-pulse" />
          <div className="h-4 w-3/4 bg-muted rounded animate-pulse" />
        </div>
        <div className="space-y-2">
          <div className="h-16 w-full bg-muted/50 rounded animate-pulse" />
          <div className="h-16 w-full bg-muted/50 rounded animate-pulse" />
        </div>
      </CardContent>
    </Card>
  );
}
