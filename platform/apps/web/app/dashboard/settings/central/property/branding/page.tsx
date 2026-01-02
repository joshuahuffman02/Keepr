"use client";

import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Palette, ExternalLink } from "lucide-react";

export default function BrandingPage() {
  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground">Branding</h2>
        <p className="text-muted-foreground mt-1">
          Customize your campground's visual identity
        </p>
      </div>

      <Card>
        <CardContent className="pt-6">
          <div className="flex items-start gap-4">
            <div className="p-3 rounded-lg bg-purple-100">
              <Palette className="h-6 w-6 text-purple-600" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-foreground">Brand Settings</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Customize your logo, colors, email headers, and receipt footers.
                Make your booking experience match your brand.
              </p>
              <div className="mt-4">
                <Button asChild>
                  <Link href="/dashboard/settings/branding">
                    Open Branding Settings
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
