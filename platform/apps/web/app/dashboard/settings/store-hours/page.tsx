"use client";

import { useEffect, useState } from "react";
import { apiClient } from "@/lib/api-client";
import { DashboardShell } from "@/components/ui/layout/DashboardShell";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

export default function StoreHoursPage() {
  const { toast } = useToast();
  const [campgroundId, setCampgroundId] = useState<string | null>(null);
  const [openHour, setOpenHour] = useState<number | "">("");
  const [closeHour, setCloseHour] = useState<number | "">("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const stored = typeof window !== "undefined" ? localStorage.getItem("campreserv:selectedCampground") : null;
    if (stored) setCampgroundId(stored);
  }, []);

  useEffect(() => {
    const load = async () => {
      if (!campgroundId) return;
      setLoading(true);
      try {
        const cg = await apiClient.getCampground(campgroundId);
        setOpenHour(cg.storeOpenHour ?? "");
        setCloseHour(cg.storeCloseHour ?? "");
      } catch (err) {
        toast({ title: "Error", description: "Failed to load store hours", variant: "destructive" });
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [campgroundId, toast]);

  const save = async () => {
    if (!campgroundId) return;
    setSaving(true);
    try {
      await apiClient.updateStoreHours(campgroundId, {
        storeOpenHour: openHour === "" ? undefined : Number(openHour),
        storeCloseHour: closeHour === "" ? undefined : Number(closeHour)
      });
      toast({ title: "Saved", description: "Store hours updated." });
    } catch (err) {
      toast({ title: "Error", description: "Failed to save store hours", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <DashboardShell>
      <div className="space-y-6">
        <Breadcrumbs
          items={[
            { label: "Dashboard", href: "/dashboard" },
            { label: "Settings", href: "/dashboard/settings" },
            { label: "Store Hours" }
          ]}
        />
        <div className="max-w-2xl">
          <Card>
        <CardHeader>
          <CardTitle>Store Hours</CardTitle>
          <CardDescription>Set opening and closing hours (0-23 local time).</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading...</p>
          ) : !campgroundId ? (
            <p className="text-sm text-muted-foreground">Select a campground to edit store hours.</p>
          ) : (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm text-muted-foreground">Open Hour (0-23)</label>
                  <Input
                    type="number"
                    min={0}
                    max={23}
                    value={openHour}
                    onChange={(e) => setOpenHour(e.target.value === "" ? "" : Number(e.target.value))}
                  />
                </div>
                <div>
                  <label className="text-sm text-muted-foreground">Close Hour (0-23)</label>
                  <Input
                    type="number"
                    min={0}
                    max={23}
                    value={closeHour}
                    onChange={(e) => setCloseHour(e.target.value === "" ? "" : Number(e.target.value))}
                  />
                </div>
              </div>
              <Button onClick={save} disabled={saving}>
                {saving ? "Saving..." : "Save"}
              </Button>
            </>
          )}
        </CardContent>
          </Card>
        </div>
      </div>
    </DashboardShell>
  );
}

