"use client";

import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Upload, ExternalLink } from "lucide-react";

export default function ImportPage() {
  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground">Import</h2>
        <p className="text-muted-foreground mt-1">
          Import data from other systems
        </p>
      </div>

      <Card>
        <CardContent className="pt-6">
          <div className="flex items-start gap-4">
            <div className="p-3 rounded-lg bg-green-100">
              <Upload className="h-6 w-6 text-green-600" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-foreground">Data Import</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Import reservations, guests, and other data from CSV files
                or migrate from other campground management systems.
              </p>
              <div className="mt-4">
                <Button asChild>
                  <Link href="/dashboard/settings/import">
                    Start Import
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
