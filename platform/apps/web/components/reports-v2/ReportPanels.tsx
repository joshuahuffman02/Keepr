import { ReactNode } from "react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export function ReportSection({
  title,
  description,
  actions,
  children,
  className
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Card className={cn("rounded-2xl border border-border bg-card shadow-sm", className)}>
      <div className="flex flex-col gap-2 border-b border-border px-5 py-4 md:flex-row md:items-start md:justify-between">
        <div>
          <div className="text-sm font-semibold text-foreground">{title}</div>
          {description && <div className="text-xs text-muted-foreground">{description}</div>}
        </div>
        {actions && <div className="flex items-center gap-2">{actions}</div>}
      </div>
      <div className="p-5">{children}</div>
    </Card>
  );
}

export function ReportStatGrid({
  stats,
  className
}: {
  stats: { label: string; value: ReactNode; helper?: string }[];
  className?: string;
}) {
  return (
    <div className={cn("grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4", className)}>
      {stats.map((stat) => (
        <div key={stat.label} className="rounded-2xl border border-border bg-card px-4 py-3 shadow-sm">
          <div className="text-xs font-medium text-muted-foreground">{stat.label}</div>
          <div className="mt-1 text-xl font-semibold text-foreground">{stat.value}</div>
          {stat.helper && <div className="text-xs text-muted-foreground">{stat.helper}</div>}
        </div>
      ))}
    </div>
  );
}

export function ReportEmptyState({
  title,
  description,
  helper
}: {
  title: string;
  description: string;
  helper?: string;
}) {
  return (
    <div className="rounded-2xl border border-dashed border-border bg-muted/40 px-6 py-10 text-center">
      <div className="text-sm font-semibold text-foreground">{title}</div>
      <div className="mt-1 text-sm text-muted-foreground">{description}</div>
      {helper && <div className="mt-2 text-xs text-muted-foreground">{helper}</div>}
    </div>
  );
}
