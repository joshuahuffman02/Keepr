"use client";

import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Globe, ExternalLink } from "lucide-react";

export default function LocalizationPage() {
  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground">Localization</h2>
        <p className="text-muted-foreground mt-1">
          Configure timezone, currency, and regional settings
        </p>
      </div>

      <Card>
        <CardContent className="pt-6">
          <div className="flex items-start gap-4">
            <div className="p-3 rounded-lg bg-green-100">
              <Globe className="h-6 w-6 text-green-600" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-foreground">Regional Settings</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Set your campground's timezone, date format, and currency preferences.
                These settings affect how dates and prices are displayed.
              </p>
              <div className="mt-4">
                <Button asChild>
                  <Link href="/dashboard/settings/localization">
                    Open Localization Settings
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
