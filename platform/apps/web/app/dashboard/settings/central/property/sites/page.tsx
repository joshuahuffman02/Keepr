"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Tent,
  ArrowRight,
  MapPin,
  Layers,
  Loader2,
  AlertCircle,
  Plus,
  ExternalLink,
  Info,
  Zap,
  Droplets,
  MoreHorizontal,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { apiClient } from "@/lib/api-client";

interface SiteClass {
  id: string;
  name: string;
  description: string | null;
  basePrice: number;
  maxOccupancy: number | null;
  amenities: string[];
  siteCount?: number;
}

interface Site {
  id: string;
  name: string;
  siteClassId: string;
  status: string;
  siteClass?: SiteClass;
}

type ApiSiteClass = Awaited<ReturnType<typeof apiClient.getSiteClasses>>[number];
type ApiSite = Awaited<ReturnType<typeof apiClient.getSites>>[number];

export default function SiteTypesPage() {
  const [campgroundId, setCampgroundId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [siteClasses, setSiteClasses] = useState<SiteClass[]>([]);
  const [sites, setSites] = useState<Site[]>([]);

  useEffect(() => {
    const id = localStorage.getItem("campreserv:selectedCampground");
    setCampgroundId(id);

    if (!id) {
      setLoading(false);
      return;
    }

    const emptyClasses: ApiSiteClass[] = [];
    const emptySites: ApiSite[] = [];
    const classesPromise: Promise<ApiSiteClass[]> = apiClient.getSiteClasses(id).catch(() => emptyClasses);
    const sitesPromise: Promise<ApiSite[]> = apiClient.getSites(id).catch(() => emptySites);
    Promise.all([classesPromise, sitesPromise]).then(([classesArray, sitesArray]) => {

      // Count sites per class
      const classCounts: Record<string, number> = {};
      sitesArray.forEach((s) => {
        if (s.siteClassId) {
          classCounts[s.siteClassId] = (classCounts[s.siteClassId] || 0) + 1;
        }
      });

      const classesWithCounts: SiteClass[] = classesArray.map((c) => ({
        id: c.id,
        name: c.name,
        description: c.description ?? null,
        basePrice: c.defaultRate,
        maxOccupancy: c.maxOccupancy ?? null,
        amenities: c.amenityTags ?? [],
        siteCount: classCounts[c.id] || 0,
      }));

      const mappedSites: Site[] = sitesArray.map((site) => ({
        id: site.id,
        name: site.name,
        siteClassId: site.siteClassId ?? "",
        status: site.status ?? "unknown",
      }));

      setSiteClasses(classesWithCounts);
      setSites(mappedSites);
      setLoading(false);
    });
  }, []);

  const formatPrice = (cents: number) => `$${(cents / 100).toFixed(2)}`;

  if (loading) {
    return (
      <div className="max-w-5xl space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Site Types</h2>
          <p className="text-muted-foreground mt-1">
            Manage your campground's site classes and individual sites
          </p>
        </div>
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  if (!campgroundId) {
    return (
      <div className="max-w-5xl space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Site Types</h2>
          <p className="text-muted-foreground mt-1">
            Manage your campground's site classes and individual sites
          </p>
        </div>
        <Card>
          <CardContent className="py-8 text-center">
            <AlertCircle className="h-8 w-8 text-amber-500 mx-auto mb-3" />
            <p className="text-muted-foreground">Please select a campground first.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-5xl space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Site Types</h2>
          <p className="text-muted-foreground mt-1">
            Manage your campground's site classes and individual sites
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" asChild>
            <Link href={`/campgrounds/${campgroundId}/map`}>
              <MapPin className="h-4 w-4 mr-2" />
              View Map
            </Link>
          </Button>
          <Button asChild>
            <Link href={`/campgrounds/${campgroundId}/classes`}>
              <Plus className="h-4 w-4 mr-2" />
              Add Class
            </Link>
          </Button>
        </div>
      </div>

      {/* Info */}
      <Alert className="bg-emerald-50 border-emerald-200">
        <Tent className="h-4 w-4 text-emerald-500" />
        <AlertDescription className="text-emerald-800">
          Site Classes group similar sites together (e.g., Full Hookup RV, Tent Sites, Cabins).
          Each class has its own base pricing, amenities, and booking rules.
        </AlertDescription>
      </Alert>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-emerald-100">
                <Layers className="h-5 w-5 text-emerald-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{siteClasses.length}</p>
                <p className="text-sm text-muted-foreground">Site Classes</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-100">
                <MapPin className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{sites.length}</p>
                <p className="text-sm text-muted-foreground">Total Sites</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-purple-100">
                <Tent className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">
                  {sites.filter((s) => s.status === "available").length}
                </p>
                <p className="text-sm text-muted-foreground">Available</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Site Classes List */}
      {siteClasses.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-12 text-center">
            <Layers className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold text-foreground mb-2">
              No site classes yet
            </h3>
            <p className="text-muted-foreground mb-4 max-w-md mx-auto">
              Create site classes to organize your camping spots by type,
              amenities, and pricing.
            </p>
            <Button asChild>
              <Link href={`/campgrounds/${campgroundId}/classes`}>
                <Plus className="h-4 w-4 mr-2" />
                Create Your First Site Class
              </Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader className="py-3 px-4 bg-muted border-b flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-medium">
              Site Classes ({siteClasses.length})
            </CardTitle>
            <Button variant="ghost" size="sm" asChild>
              <Link href={`/campgrounds/${campgroundId}/classes`}>
                Manage All
                <ArrowRight className="h-4 w-4 ml-1" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent className="p-0 divide-y">
            {siteClasses.map((siteClass) => (
              <div
                key={siteClass.id}
                className="flex items-center justify-between px-4 py-3 hover:bg-muted transition-colors group"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-emerald-100">
                    <Tent className="h-5 w-5 text-emerald-600" />
                  </div>
                  <div>
                    <p className="font-medium text-foreground">{siteClass.name}</p>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <span>{formatPrice(siteClass.basePrice)}/night</span>
                      {siteClass.maxOccupancy && (
                        <span>• Max {siteClass.maxOccupancy} guests</span>
                      )}
                    </div>
                    {siteClass.amenities && siteClass.amenities.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1">
                        {siteClass.amenities.slice(0, 4).map((amenity) => (
                          <Badge key={amenity} variant="outline" className="text-xs">
                            {amenity}
                          </Badge>
                        ))}
                        {siteClass.amenities.length > 4 && (
                          <Badge variant="outline" className="text-xs">
                            +{siteClass.amenities.length - 4} more
                          </Badge>
                        )}
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Badge variant="secondary">
                    {siteClass.siteCount} site{siteClass.siteCount !== 1 ? "s" : ""}
                  </Badge>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label="More options"
                        className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem>
                        <Link href={`/campgrounds/${campgroundId}/classes`} className="w-full">
                          Edit Class
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuItem>
                        <Link href={`/campgrounds/${campgroundId}/sites`} className="w-full">
                          View Sites
                        </Link>
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Quick Links */}
      <div className="grid grid-cols-2 gap-4">
        <Card className="hover:shadow-md transition-shadow">
          <CardContent className="pt-6">
            <Link
              href={`/campgrounds/${campgroundId}/sites`}
              className="flex items-start justify-between"
            >
              <div className="flex gap-4">
                <div className="p-3 rounded-lg bg-blue-100">
                  <MapPin className="h-6 w-6 text-blue-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-foreground">Individual Sites</h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    Manage specific sites, status, and features
                  </p>
                  <Badge variant="outline" className="mt-2">
                    {sites.length} sites
                  </Badge>
                </div>
              </div>
              <ArrowRight className="h-5 w-5 text-muted-foreground" />
            </Link>
          </CardContent>
        </Card>

        <Card className="hover:shadow-md transition-shadow">
          <CardContent className="pt-6">
            <Link
              href={`/campgrounds/${campgroundId}/map`}
              className="flex items-start justify-between"
            >
              <div className="flex gap-4">
                <div className="p-3 rounded-lg bg-purple-100">
                  <Tent className="h-6 w-6 text-purple-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-foreground">Site Map</h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    View interactive campground layout
                  </p>
                  <Badge variant="outline" className="mt-2">
                    Visual layout
                  </Badge>
                </div>
              </div>
              <ArrowRight className="h-5 w-5 text-muted-foreground" />
            </Link>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
