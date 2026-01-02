"use client";

import { useParams } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { apiClient } from "@/lib/api-client";
import { DashboardShell } from "@/components/ui/layout/DashboardShell";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { CampgroundMapUpload } from "@/components/campgrounds/CampgroundMapUpload";
import { SiteLayoutEditor, LayoutData, LayoutSite } from "@/components/maps/SiteLayoutEditor";
import { useToast } from "@/components/ui/use-toast";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Map,
  HelpCircle,
  Keyboard,
  Loader2
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export default function CampgroundMapPage() {
  const params = useParams();
  const campgroundId = params?.campgroundId as string;
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  const campgroundQuery = useQuery({
    queryKey: ["campground", campgroundId],
    queryFn: () => apiClient.getCampground(campgroundId),
    enabled: !!campgroundId
  });

  const mapQuery = useQuery({
    queryKey: ["campground-map", campgroundId],
    queryFn: () => apiClient.getCampgroundMap(campgroundId, {}),
    enabled: !!campgroundId
  });

  const sitesQuery = useQuery({
    queryKey: ["campground-sites", campgroundId],
    queryFn: () => apiClient.getSites(campgroundId),
    enabled: !!campgroundId
  });

  const siteClassesQuery = useQuery({
    queryKey: ["site-classes", campgroundId],
    queryFn: () => apiClient.getSiteClasses(campgroundId),
    enabled: !!campgroundId
  });

  interface MapLayers {
    baseImageUrl?: string;
    baseImage?: { url?: string };
    background?: { url?: string };
    image?: string;
  }

  const mapBaseImageUrl = useMemo(() => {
    const layers = mapQuery.data?.config?.layers as MapLayers | undefined;
    if (!layers || typeof layers !== "object") return null;
    if (typeof layers.baseImageUrl === "string") return layers.baseImageUrl;
    if (typeof layers.baseImage?.url === "string") return layers.baseImage.url;
    if (typeof layers.background?.url === "string") return layers.background.url;
    if (typeof layers.image === "string") return layers.image;
    return null;
  }, [mapQuery.data?.config?.layers]);

  // Convert existing site data to LayoutSite format
  const initialLayoutData = useMemo(() => {
    // Check if layout exists in layers (stored as layers.layout)
    const layers = mapQuery.data?.config?.layers as any;
    const existingLayout = layers?.layout as LayoutData | undefined;
    if (existingLayout?.sites?.length) {
      return existingLayout;
    }

    // Convert sites to layout format if no layout exists
    const sites: LayoutSite[] = (sitesQuery.data || []).map((site: any, index: number) => ({
      id: site.id,
      x: 100 + (index % 8) * 80,
      y: 100 + Math.floor(index / 8) * 60,
      width: 60,
      height: 40,
      rotation: 0,
      siteNumber: site.siteNumber || site.name || `Site ${index + 1}`,
      siteType: (site.siteType?.toLowerCase() || "rv") as "rv" | "tent" | "cabin" | "glamping" | "group",
      siteClassId: site.siteClassId,
      color: getSiteColor(site.siteType),
    }));

    return {
      sites,
      elements: [],
      gridSize: 20,
      canvasWidth: 1200,
      canvasHeight: 800,
      backgroundImage: mapBaseImageUrl || undefined,
    };
  }, [mapQuery.data?.config?.layers, sitesQuery.data, mapBaseImageUrl]);

  // Get site classes for the editor
  const siteClasses = useMemo(() => {
    return (siteClassesQuery.data || []).map((sc: any) => ({
      id: sc.id,
      name: sc.name,
      color: getSiteColor(sc.type || sc.name),
    }));
  }, [siteClassesQuery.data]);

  const saveMutation = useMutation({
    mutationFn: async (layoutData: LayoutData) => {
      // Save the layout data to the campground map config (stored in layers.layout)
      const existingLayers = (mapQuery.data?.config?.layers as any) || {};
      const config = {
        ...mapQuery.data?.config,
        layers: {
          ...existingLayers,
          layout: layoutData,
          baseImageUrl: layoutData.backgroundImage,
        },
      };
      return apiClient.upsertCampgroundMap(campgroundId, { config });
    },
    onSuccess: () => {
      toast({
        title: "Layout saved",
        description: "Your site layout has been saved successfully.",
      });
      setHasUnsavedChanges(false);
      queryClient.invalidateQueries({ queryKey: ["campground-map", campgroundId] });
    },
    onError: (error: any) => {
      toast({
        title: "Save failed",
        description: error.message || "Could not save the layout. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleSave = (data: LayoutData) => {
    saveMutation.mutate(data);
  };

  const handleBackgroundImageChange = (imageUrl: string) => {
    // This will be handled by the save function including the background image
    setHasUnsavedChanges(true);
  };

  const campgroundName = campgroundQuery.data?.name ?? "Campground";
  const isLoading = mapQuery.isLoading || sitesQuery.isLoading || siteClassesQuery.isLoading;

  return (
    <DashboardShell>
      <div className="space-y-6">
        <Breadcrumbs
          items={[
            { label: "Campgrounds", href: "/campgrounds?all=true" },
            { label: campgroundName, href: `/campgrounds/${campgroundId}` },
            { label: "Site Layout" }
          ]}
        />

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Map className="h-8 w-8 text-emerald-600" />
            <div>
              <h1 className="text-2xl font-bold text-foreground">Site Layout Editor</h1>
              <p className="text-sm text-muted-foreground">
                Design your campground layout visually - place sites, roads, and amenities.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {hasUnsavedChanges && (
              <Badge variant="outline" className="text-amber-600 border-amber-300 bg-amber-50">
                Unsaved changes
              </Badge>
            )}

            <Dialog>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm">
                  <Keyboard className="h-4 w-4 mr-1" />
                  Shortcuts
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Keyboard Shortcuts</DialogTitle>
                  <DialogDescription>Quick actions for the layout editor</DialogDescription>
                </DialogHeader>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span>Select tool</span>
                    <kbd className="px-2 py-1 bg-muted rounded text-xs">V</kbd>
                  </div>
                  <div className="flex justify-between">
                    <span>Add site tool</span>
                    <kbd className="px-2 py-1 bg-muted rounded text-xs">S</kbd>
                  </div>
                  <div className="flex justify-between">
                    <span>Delete selected</span>
                    <kbd className="px-2 py-1 bg-muted rounded text-xs">Delete</kbd>
                  </div>
                  <div className="flex justify-between">
                    <span>Duplicate selected</span>
                    <kbd className="px-2 py-1 bg-muted rounded text-xs">Cmd/Ctrl + D</kbd>
                  </div>
                  <div className="flex justify-between">
                    <span>Undo</span>
                    <kbd className="px-2 py-1 bg-muted rounded text-xs">Cmd/Ctrl + Z</kbd>
                  </div>
                  <div className="flex justify-between">
                    <span>Redo</span>
                    <kbd className="px-2 py-1 bg-muted rounded text-xs">Cmd/Ctrl + Shift + Z</kbd>
                  </div>
                  <div className="flex justify-between">
                    <span>Deselect</span>
                    <kbd className="px-2 py-1 bg-muted rounded text-xs">Escape</kbd>
                  </div>
                  <div className="flex justify-between">
                    <span>Zoom in/out</span>
                    <kbd className="px-2 py-1 bg-muted rounded text-xs">Scroll wheel</kbd>
                  </div>
                </div>
              </DialogContent>
            </Dialog>

            <Dialog>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm">
                  <HelpCircle className="h-4 w-4 mr-1" />
                  Help
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-lg">
                <DialogHeader>
                  <DialogTitle>How to use the Site Layout Editor</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 text-sm text-muted-foreground">
                  <div>
                    <h4 className="font-medium text-foreground">Import a Background Map</h4>
                    <p>Click "Map Image" in the toolbar to upload a satellite image or site plan as your background reference.</p>
                  </div>
                  <div>
                    <h4 className="font-medium text-foreground">Adding Sites</h4>
                    <p>Select the site tool (tent icon), choose a site type, then click on the canvas to place sites.</p>
                  </div>
                  <div>
                    <h4 className="font-medium text-foreground">Moving Sites</h4>
                    <p>Use the select tool (arrow), click a site, and drag to move. Sites snap to the grid.</p>
                  </div>
                  <div>
                    <h4 className="font-medium text-foreground">Editing Properties</h4>
                    <p>Select a site to see its properties on the right. Change site number, type, size, and rotation.</p>
                  </div>
                  <div>
                    <h4 className="font-medium text-foreground">Saving</h4>
                    <p>Click "Save Layout" to store your changes. Use "Export" to download as JSON for backup.</p>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Quick Map Upload */}
        <div className="rounded-lg border border-border bg-card p-4">
          <div className="mb-3">
            <h2 className="text-sm font-semibold text-foreground">Quick Map Upload</h2>
            <p className="text-xs text-muted-foreground">
              Upload a satellite image or site plan to use as your background reference.
            </p>
          </div>
          <CampgroundMapUpload
            campgroundId={campgroundId}
            initialUrl={mapBaseImageUrl}
            onUploaded={(url) => {
              mapQuery.refetch();
              setHasUnsavedChanges(true);
            }}
          />
        </div>

        {/* Site Layout Editor */}
        {isLoading ? (
          <div className="flex items-center justify-center h-96 bg-muted rounded-xl border">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
              <span>Loading layout...</span>
            </div>
          </div>
        ) : (
          <SiteLayoutEditor
            initialData={initialLayoutData}
            siteClasses={siteClasses}
            backgroundImageUrl={mapBaseImageUrl}
            onSave={handleSave}
            onBackgroundImageChange={handleBackgroundImageChange}
            height="calc(100vh - 380px)"
          />
        )}
      </div>
    </DashboardShell>
  );
}

// Helper to get site color based on type
function getSiteColor(siteType: string | null | undefined): string {
  const type = (siteType || "").toLowerCase();
  const colors: Record<string, string> = {
    rv: "#3b82f6",
    tent: "#22c55e",
    cabin: "#f59e0b",
    glamping: "#a855f7",
    group: "#ec4899",
  };
  return colors[type] || "#6b7280";
}
