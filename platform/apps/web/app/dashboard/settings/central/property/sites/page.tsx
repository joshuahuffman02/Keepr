"use client";

import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tent, ArrowRight, MapPin, Layers } from "lucide-react";

export default function SiteTypesPage() {
  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-slate-900">Site Types</h2>
        <p className="text-slate-500 mt-1">
          Manage your campground's site classes and individual sites
        </p>
      </div>

      <div className="grid gap-4">
        <Card className="hover:shadow-md transition-shadow">
          <CardContent className="pt-6">
            <div className="flex items-start justify-between">
              <div className="flex gap-4">
                <div className="p-3 rounded-lg bg-emerald-100">
                  <Layers className="h-6 w-6 text-emerald-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-slate-900">Site Classes</h3>
                  <p className="text-sm text-slate-500 mt-1">
                    Configure categories like Full Hookup, Partial Hookup, Tent Sites, and Cabins
                  </p>
                  <div className="flex gap-2 mt-3">
                    <Badge variant="outline">4 classes</Badge>
                  </div>
                </div>
              </div>
              <Button variant="ghost" size="icon" asChild>
                <Link href="/dashboard/settings/site-classes">
                  <ArrowRight className="h-5 w-5" />
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="hover:shadow-md transition-shadow">
          <CardContent className="pt-6">
            <div className="flex items-start justify-between">
              <div className="flex gap-4">
                <div className="p-3 rounded-lg bg-blue-100">
                  <MapPin className="h-6 w-6 text-blue-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-slate-900">Individual Sites</h3>
                  <p className="text-sm text-slate-500 mt-1">
                    Manage specific sites, their features, and availability
                  </p>
                  <div className="flex gap-2 mt-3">
                    <Badge variant="outline">68 sites</Badge>
                  </div>
                </div>
              </div>
              <Button variant="ghost" size="icon" asChild>
                <Link href="/dashboard/sites">
                  <ArrowRight className="h-5 w-5" />
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="hover:shadow-md transition-shadow">
          <CardContent className="pt-6">
            <div className="flex items-start justify-between">
              <div className="flex gap-4">
                <div className="p-3 rounded-lg bg-purple-100">
                  <Tent className="h-6 w-6 text-purple-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-slate-900">Site Attributes</h3>
                  <p className="text-sm text-slate-500 mt-1">
                    Define custom attributes for sites (waterfront, shaded, pet-friendly, etc.)
                  </p>
                  <div className="flex gap-2 mt-3">
                    <Badge variant="outline">8 attributes</Badge>
                  </div>
                </div>
              </div>
              <Button variant="ghost" size="icon" asChild>
                <Link href="/dashboard/settings/site-attributes">
                  <ArrowRight className="h-5 w-5" />
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
