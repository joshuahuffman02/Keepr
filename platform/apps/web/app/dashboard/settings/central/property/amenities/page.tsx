"use client";

import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowRight, Waves, ShowerHead, Wifi, Utensils, Trees } from "lucide-react";

const amenityCategories = [
  {
    icon: Waves,
    name: "Pool & Recreation",
    description: "Swimming pools, hot tubs, playgrounds, sports courts",
    count: 4,
    color: "bg-status-info/15 text-status-info",
  },
  {
    icon: ShowerHead,
    name: "Facilities",
    description: "Restrooms, showers, laundry, dump station",
    count: 6,
    color: "bg-purple-100 text-purple-600",
  },
  {
    icon: Wifi,
    name: "Connectivity",
    description: "WiFi, cable TV, cell signal",
    count: 2,
    color: "bg-status-success/15 text-status-success",
  },
  {
    icon: Utensils,
    name: "Dining & Shopping",
    description: "Camp store, restaurant, snack bar, ice",
    count: 3,
    color: "bg-status-warning/15 text-status-warning",
  },
  {
    icon: Trees,
    name: "Nature & Activities",
    description: "Hiking trails, fishing, boat launch, fire pits",
    count: 5,
    color: "bg-status-success/15 text-status-success",
  },
];

export default function AmenitiesPage() {
  return (
    <div className="max-w-4xl space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Amenities</h2>
          <p className="text-slate-500 mt-1">
            Manage your campground's features and amenities
          </p>
        </div>
        <Button asChild>
          <Link href="/dashboard/settings/amenities">
            Manage Amenities
          </Link>
        </Button>
      </div>

      <div className="grid gap-4">
        {amenityCategories.map((category) => {
          const Icon = category.icon;
          return (
            <Card key={category.name} className="hover:shadow-md transition-shadow">
              <CardContent className="pt-6">
                <div className="flex items-start justify-between">
                  <div className="flex gap-4">
                    <div className={`p-3 rounded-lg ${category.color.split(" ")[0]}`}>
                      <Icon className={`h-6 w-6 ${category.color.split(" ")[1]}`} />
                    </div>
                    <div>
                      <h3 className="font-semibold text-slate-900">{category.name}</h3>
                      <p className="text-sm text-slate-500 mt-1">
                        {category.description}
                      </p>
                      <div className="flex gap-2 mt-3">
                        <Badge variant="outline">{category.count} amenities</Badge>
                      </div>
                    </div>
                  </div>
                  <Button variant="ghost" size="icon" asChild>
                    <Link href="/dashboard/settings/amenities">
                      <ArrowRight className="h-5 w-5" />
                    </Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
