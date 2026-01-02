"use client";

import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ShieldCheck, ExternalLink } from "lucide-react";

export default function PermissionsPage() {
  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground">Permissions</h2>
        <p className="text-muted-foreground mt-1">
          Configure granular access permissions
        </p>
      </div>

      <Card>
        <CardContent className="pt-6">
          <div className="flex items-start gap-4">
            <div className="p-3 rounded-lg bg-indigo-100">
              <ShieldCheck className="h-6 w-6 text-indigo-600" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-foreground">Permission Settings</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Fine-tune which actions each role can perform. Control access to
                reservations, payments, settings, and more.
              </p>
              <div className="mt-4">
                <Button asChild>
                  <Link href="/dashboard/settings/permissions">
                    Manage Permissions
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
