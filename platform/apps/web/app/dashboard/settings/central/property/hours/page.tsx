"use client";

import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Clock, ExternalLink } from "lucide-react";

export default function HoursPage() {
  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground">Hours</h2>
        <p className="text-muted-foreground mt-1">Set check-in/check-out times and office hours</p>
      </div>

      <Card>
        <CardContent className="pt-6">
          <div className="flex items-start gap-4">
            <div className="p-3 rounded-lg bg-amber-100">
              <Clock className="h-6 w-6 text-amber-600" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-foreground">Operating Hours</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Configure check-in and check-out times, office hours, and store hours. These times
                are shown to guests during booking.
              </p>
              <div className="mt-4">
                <Button asChild>
                  <Link href="/dashboard/settings/store-hours">
                    Open Hours Settings
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
