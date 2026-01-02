"use client";

import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Calendar, Info, ArrowRight, Sun, Snowflake, Leaf } from "lucide-react";

const seasons = [
  {
    name: "Peak Season",
    dates: "Jun 15 - Aug 15",
    rateChange: "+25%",
    color: "bg-status-warning/15 border-status-warning/30 text-status-warning",
    icon: Sun,
  },
  {
    name: "Shoulder Season",
    dates: "May 1 - Jun 14, Aug 16 - Oct 15",
    rateChange: "+10%",
    color: "bg-status-warning/15 border-amber-300 text-status-warning",
    icon: Leaf,
  },
  {
    name: "Off Season",
    dates: "Oct 16 - Apr 30",
    rateChange: "Base Rate",
    color: "bg-status-info/15 border-status-info/30 text-status-info",
    icon: Snowflake,
  },
];

export default function SeasonalRatesPage() {
  return (
    <div className="max-w-4xl space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Seasonal Rates</h2>
          <p className="text-muted-foreground mt-1">
            Configure rate adjustments for different seasons
          </p>
        </div>
        <Button asChild>
          <Link href="/dashboard/settings/central/pricing/rate-groups">
            Manage Rate Groups
          </Link>
        </Button>
      </div>

      <Alert className="bg-blue-50 border-blue-200">
        <Info className="h-4 w-4 text-blue-500" />
        <AlertDescription className="text-blue-800">
          Seasonal rates are now managed through Rate Groups, which provide more flexible
          date-based pricing with color-coded calendar visualization.
        </AlertDescription>
      </Alert>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Calendar className="h-5 w-5 text-muted-foreground" />
            Current Season Overview
          </CardTitle>
          <CardDescription>
            These seasons are configured in your Rate Groups
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {seasons.map((season) => {
            const Icon = season.icon;
            return (
              <div
                key={season.name}
                className={`flex items-center justify-between p-4 rounded-lg border ${season.color}`}
              >
                <div className="flex items-center gap-3">
                  <Icon className="h-5 w-5" />
                  <div>
                    <p className="font-medium">{season.name}</p>
                    <p className="text-sm opacity-80">{season.dates}</p>
                  </div>
                </div>
                <Badge variant="outline" className="bg-card/50">
                  {season.rateChange}
                </Badge>
              </div>
            );
          })}
        </CardContent>
      </Card>

      <div className="flex justify-center">
        <Button variant="outline" asChild>
          <Link href="/dashboard/settings/central/pricing/rate-groups" className="flex items-center gap-2">
            Go to Rate Groups
            <ArrowRight className="h-4 w-4" />
          </Link>
        </Button>
      </div>
    </div>
  );
}
