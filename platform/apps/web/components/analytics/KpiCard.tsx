"use client";

import { ArrowUpRight, ArrowDownRight, Minus } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface KpiCardProps {
  title: string;
  value: string | number;
  change?: number | null;
  changeLabel?: string;
  format?: "number" | "currency" | "percent" | "days";
  icon?: React.ReactNode;
  subtitle?: string;
  loading?: boolean;
}

export function KpiCard({
  title,
  value,
  change,
  changeLabel = "vs last period",
  format = "number",
  icon,
  subtitle,
  loading = false,
}: KpiCardProps) {
  const formatValue = (val: string | number) => {
    if (typeof val === "string") return val;

    switch (format) {
      case "currency":
        return new Intl.NumberFormat("en-US", {
          style: "currency",
          currency: "USD",
          minimumFractionDigits: 0,
          maximumFractionDigits: 0,
        }).format(val);
      case "percent":
        return `${val.toFixed(1)}%`;
      case "days":
        return `${val.toFixed(1)} days`;
      default:
        return new Intl.NumberFormat("en-US").format(val);
    }
  };

  const getChangeColor = (val: number | null | undefined) => {
    if (val === null || val === undefined) return "text-muted-foreground";
    if (val > 0) return "text-green-400";
    if (val < 0) return "text-red-400";
    return "text-muted-foreground";
  };

  const getChangeIcon = (val: number | null | undefined) => {
    if (val === null || val === undefined) return <Minus className="h-4 w-4" />;
    if (val > 0) return <ArrowUpRight className="h-4 w-4" />;
    if (val < 0) return <ArrowDownRight className="h-4 w-4" />;
    return <Minus className="h-4 w-4" />;
  };

  if (loading) {
    return (
      <Card className="bg-muted/50 border-border">
        <CardContent className="p-6">
          <div className="animate-pulse space-y-3">
            <div className="h-4 w-24 bg-muted rounded" />
            <div className="h-8 w-32 bg-muted rounded" />
            <div className="h-3 w-20 bg-muted rounded" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-muted/50 border-border hover:bg-muted/70 transition-colors">
      <CardContent className="p-6">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm text-muted-foreground font-medium">{title}</p>
            <p className="text-2xl font-bold text-white mt-1">{formatValue(value)}</p>
            {subtitle && <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>}
          </div>
          {icon && <div className="p-2 bg-muted/50 rounded-lg">{icon}</div>}
        </div>

        {change !== undefined && (
          <div className={cn("flex items-center gap-1 mt-3 text-sm", getChangeColor(change))}>
            {getChangeIcon(change)}
            <span>{change !== null ? `${Math.abs(change).toFixed(1)}%` : "N/A"}</span>
            <span className="text-muted-foreground ml-1">{changeLabel}</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
