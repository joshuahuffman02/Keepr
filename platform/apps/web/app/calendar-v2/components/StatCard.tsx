"use client";

import React, { memo, type ReactNode } from "react";
import { Card } from "../../../components/ui/card";

interface StatCardProps {
  label: string;
  value: string;
  sub: string;
  icon: ReactNode;
}

export const StatCard = memo(function StatCard({ label, value, sub, icon }: StatCardProps) {
  return (
    <Card className="p-4 border-border shadow-sm flex items-center gap-3">
      <div className="h-10 w-10 rounded-xl bg-muted text-foreground flex items-center justify-center">
        {icon}
      </div>
      <div>
        <div className="text-xs font-medium text-muted-foreground">{label}</div>
        <div className="text-lg font-semibold text-foreground">{value}</div>
        <div className="text-xs text-muted-foreground">{sub}</div>
      </div>
    </Card>
  );
});
