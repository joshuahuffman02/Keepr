"use client";

import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CalendarOff, ExternalLink } from "lucide-react";

export default function BlackoutsPage() {
  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground">Blackout Dates</h2>
        <p className="text-muted-foreground mt-1">Block dates from online booking</p>
      </div>

      <Card>
        <CardContent className="pt-6">
          <div className="flex items-start gap-4">
            <div className="p-3 rounded-lg bg-red-100">
              <CalendarOff className="h-6 w-6 text-red-600" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-foreground">Blackout Dates Manager</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Block specific dates from online booking. Useful for private events, maintenance
                periods, or staff-only booking windows.
              </p>
              <div className="mt-4">
                <Button asChild>
                  <Link href="/dashboard/settings/blackout-dates">
                    Manage Blackout Dates
                    <ExternalLink className="h-4 w-4 ml-2" />
                  </Link>
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
