"use client";

import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ShoppingCart, ExternalLink, Monitor } from "lucide-react";

export default function POSPage() {
  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground">POS Settings</h2>
        <p className="text-muted-foreground mt-1">
          Configure point-of-sale system settings
        </p>
      </div>

      <div className="grid gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-start gap-4">
              <div className="p-3 rounded-lg bg-blue-100">
                <ShoppingCart className="h-6 w-6 text-blue-600" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-foreground">Open POS</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Launch the point-of-sale system to process sales and manage transactions.
                </p>
                <div className="mt-4">
                  <Button asChild>
                    <Link href="/pos">
                      Launch POS
                      <ExternalLink className="h-4 w-4 ml-2" />
                    </Link>
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-start gap-4">
              <div className="p-3 rounded-lg bg-muted">
                <Monitor className="h-6 w-6 text-muted-foreground" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-foreground">POS Terminals</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Manage POS terminals, payment readers, and receipt printers.
                </p>
                <div className="mt-4">
                  <Button variant="outline" asChild>
                    <Link href="/dashboard/settings/pos-integrations">
                      Configure Terminals
                      <ExternalLink className="h-4 w-4 ml-2" />
                    </Link>
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
