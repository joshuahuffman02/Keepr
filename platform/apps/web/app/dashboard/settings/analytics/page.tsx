"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";

export default function AnalyticsSettingsPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [campgroundId, setCampgroundId] = useState<string>("");
  const [gaId, setGaId] = useState("");
  const [pixelId, setPixelId] = useState("");

  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = localStorage.getItem("campreserv:selectedCampground");
    if (stored) setCampgroundId(stored);
  }, []);

  const { data, isLoading } = useQuery({
    queryKey: ["campground-analytics", campgroundId],
    queryFn: () => apiClient.getCampground(campgroundId),
    enabled: !!campgroundId
  });

  useEffect(() => {
    if (!data) return;
    setGaId(data.gaMeasurementId || "");
    setPixelId(data.metaPixelId || "");
  }, [data]);

  const mutation = useMutation({
    mutationFn: () =>
      apiClient.updateCampgroundAnalytics(campgroundId, {
        gaMeasurementId: gaId || null,
        metaPixelId: pixelId || null
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["campground-analytics", campgroundId] });
      toast({ title: "Saved", description: "Analytics settings updated." });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  });

  const handleSave = () => {
    mutation.mutate();
  };

  return (
    <div>
      <div className="max-w-3xl space-y-4">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Analytics & Tracking</h1>
          <p className="text-slate-600 text-sm">
            Set per-campground tracking IDs for Google Analytics (GA4) and Meta Pixel. These load on public park pages only.
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Tracking IDs</CardTitle>
            <CardDescription>Campground-scoped analytics identifiers.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {isLoading && <div className="text-sm text-slate-500">Loading...</div>}
            {!isLoading && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="ga">GA4 Measurement ID</Label>
                  <Input
                    id="ga"
                    placeholder="G-XXXXXXXXXX"
                    value={gaId}
                    onChange={(e) => setGaId(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="pixel">Meta Pixel ID</Label>
                  <Input
                    id="pixel"
                    placeholder="123456789012345"
                    value={pixelId}
                    onChange={(e) => setPixelId(e.target.value)}
                  />
                </div>
                <div className="flex gap-3">
                  <Button onClick={handleSave} disabled={!campgroundId || mutation.isPending}>
                    Save
                  </Button>
                  <div className="text-xs text-slate-500 self-center">
                    Tracking loads on public pages only; leave blank to disable.
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

