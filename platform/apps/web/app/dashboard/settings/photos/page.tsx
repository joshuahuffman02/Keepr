"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/use-toast";
import { apiClient } from "@/lib/api-client";

export default function PhotosPage() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [campgroundId, setCampgroundId] = useState<string | null>(null);
  const [photos, setPhotos] = useState<string[]>([]);
  const [hero, setHero] = useState<string | null>(null);
  const [newPhoto, setNewPhoto] = useState("");

  useEffect(() => {
    const cg = typeof window !== "undefined" ? localStorage.getItem("campreserv:selectedCampground") : null;
    setCampgroundId(cg);
  }, []);

  const campgroundQuery = useQuery({
    queryKey: ["campground", campgroundId],
    queryFn: () => apiClient.getCampground(campgroundId!),
    enabled: !!campgroundId,
  });

  useEffect(() => {
    const cg = campgroundQuery.data;
    if (!cg) return;
    const list = Array.isArray(cg.photos) ? cg.photos.filter(Boolean) : [];
    setPhotos(list);
    setHero(cg.heroImageUrl || null);
  }, [campgroundQuery.data]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!campgroundId) throw new Error("Select a campground");
      const unique = Array.from(new Set(photos.filter(Boolean)));
      if (unique.length === 0) throw new Error("Add at least one photo URL");
      await apiClient.updateCampgroundPhotos(campgroundId, { photos: unique, heroImageUrl: hero || null });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["campground", campgroundId] });
      toast({ title: "Photos updated" });
    },
    onError: (err: any) => toast({ title: err?.message || "Failed to update photos", variant: "destructive" }),
  });

  const move = (idx: number, dir: -1 | 1) => {
    setPhotos((list) => {
      const next = [...list];
      const target = idx + dir;
      if (target < 0 || target >= next.length) return list;
      [next[idx], next[target]] = [next[target], next[idx]];
      return next;
    });
  };

  const remove = (idx: number) => {
    setPhotos((list) => {
      const next = list.filter((_, i) => i !== idx);
      if (hero && !next.includes(hero)) {
        setHero(next[0] || null);
      }
      return next;
    });
  };

  const add = () => {
    const url = newPhoto.trim();
    if (!url) return;
    setPhotos((list) => Array.from(new Set([...list, url])));
    if (!hero) setHero(url);
    setNewPhoto("");
  };

  const isDirty = useMemo(() => {
    const cg = campgroundQuery.data;
    if (!cg) return false;
    const orig = (Array.isArray(cg.photos) ? cg.photos.filter(Boolean) : []).join("|");
    const next = photos.join("|");
    const heroOrig = cg.heroImageUrl || "";
    const heroNext = hero || "";
    return orig !== next || heroOrig !== heroNext;
  }, [campgroundQuery.data, photos, hero]);

  return (
    <div>
      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>Photos & Order</CardTitle>
            <CardDescription>Reorder gallery photos and pick a hero image.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* How It Works Section */}
            <div className="bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-lg p-4 mb-4">
              <div className="flex items-start gap-3">
                <div className="text-2xl">📷</div>
                <div className="space-y-2">
                  <h4 className="font-semibold text-amber-900">How Photos Work</h4>
                  <div className="text-sm text-slate-700 space-y-1">
                    <p><strong>Media Pool:</strong> This is your campground's central photo library. All photos added here can be used across your listing.</p>
                    <p><strong>Hero Image:</strong> Select one photo (using the radio button) to be your primary display image on the homepage and search results.</p>
                    <p><strong>Order Matters:</strong> Use the ↑↓ buttons to reorder photos. The order here determines how they appear in your public gallery.</p>
                    <p><strong>Sites & Classes:</strong> To link photos to specific sites or site classes, edit them in Setup → Sites or Setup → Site Classes. Photos from this pool will be available for selection.</p>
                  </div>
                </div>
              </div>
            </div>
            {!campgroundId && <div className="text-sm text-slate-500">Select a campground to edit photos.</div>}
            {campgroundQuery.isLoading && <div className="text-sm text-slate-500">Loading…</div>}

            {campgroundId && !campgroundQuery.isLoading && (
              <div className="space-y-4">
                <div className="flex gap-2">
                  <Input
                    value={newPhoto}
                    onChange={(e) => setNewPhoto(e.target.value)}
                    placeholder="Add photo URL"
                  />
                  <Button variant="outline" onClick={add} disabled={!newPhoto.trim()}>
                    Add
                  </Button>
                </div>

                <div className="space-y-2">
                  {photos.length === 0 && <div className="text-sm text-slate-500">No photos yet.</div>}
                  {photos.map((url, idx) => (
                    <div key={url} className="flex items-center gap-3 border border-slate-200 rounded-lg p-3">
                      <input
                        type="radio"
                        name="hero"
                        checked={hero === url}
                        onChange={() => setHero(url)}
                        title="Set as hero"
                      />
                      <div className="flex-1 truncate text-sm">{url}</div>
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm" onClick={() => move(idx, -1)} disabled={idx === 0}>
                          ↑
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => move(idx, 1)} disabled={idx === photos.length - 1}>
                          ↓
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => remove(idx)}>
                          Remove
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => campgroundQuery.refetch()} disabled={campgroundQuery.isFetching}>
                    Reset
                  </Button>
                  <Button onClick={() => saveMutation.mutate()} disabled={!isDirty || saveMutation.isPending}>
                    {saveMutation.isPending ? "Saving..." : "Save order"}
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

