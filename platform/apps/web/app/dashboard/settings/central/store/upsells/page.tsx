"use client";

import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Gift, ExternalLink } from "lucide-react";

export default function UpsellsPage() {
  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground">Upsells</h2>
        <p className="text-muted-foreground mt-1">Configure add-ons offered during booking</p>
      </div>

      <Card>
        <CardContent className="pt-6">
          <div className="flex items-start gap-4">
            <div className="p-3 rounded-lg bg-pink-100">
              <Gift className="h-6 w-6 text-pink-600" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-foreground">Add-ons & Extras</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Create add-on items that guests can purchase during booking. Firewood bundles,
                equipment rentals, early check-in, and more.
              </p>
              <div className="mt-4">
                <Button asChild>
                  <Link href="/dashboard/settings/upsells">
                    Manage Upsells
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
