"use client";

import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Code, ExternalLink } from "lucide-react";

export default function APIPage() {
  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground">API Keys</h2>
        <p className="text-muted-foreground mt-1">Manage API access for developers</p>
      </div>

      <Card>
        <CardContent className="pt-6">
          <div className="flex items-start gap-4">
            <div className="p-3 rounded-lg bg-muted">
              <Code className="h-6 w-6 text-muted-foreground" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-foreground">Developer Settings</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Generate API keys, configure webhooks, and access developer documentation for
                integrating with external systems.
              </p>
              <div className="mt-4">
                <Button asChild>
                  <Link href="/dashboard/settings/developers">
                    Open Developer Settings
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
