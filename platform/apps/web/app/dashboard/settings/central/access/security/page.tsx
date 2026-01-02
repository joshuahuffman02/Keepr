"use client";

import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Lock, ExternalLink } from "lucide-react";

export default function SecurityPage() {
  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground">Security</h2>
        <p className="text-muted-foreground mt-1">
          Configure security and privacy settings
        </p>
      </div>

      <Card>
        <CardContent className="pt-6">
          <div className="flex items-start gap-4">
            <div className="p-3 rounded-lg bg-red-100">
              <Lock className="h-6 w-6 text-red-600" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-foreground">Security Settings</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Configure PCI compliance, data retention, session timeouts,
                and other security options.
              </p>
              <div className="mt-4">
                <Button asChild>
                  <Link href="/dashboard/settings/security">
                    Open Security Settings
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
