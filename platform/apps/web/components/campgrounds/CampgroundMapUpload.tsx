"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiClient } from "@/lib/api-client";
import { useToast } from "@/components/ui/use-toast";

export function CampgroundMapUpload({
  campgroundId,
  initialUrl,
  onUploaded
}: {
  campgroundId: string;
  initialUrl?: string | null;
  onUploaded?: (url: string) => void;
}) {
  const { toast } = useToast();
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(initialUrl || null);
  const [isUploading, setIsUploading] = useState(false);

  useEffect(() => {
    if (!file) return;
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  useEffect(() => {
    if (!file) {
      setPreview(initialUrl || null);
    }
  }, [initialUrl, file]);

  const handleUpload = async () => {
    if (!file) return;
    setIsUploading(true);
    try {
      const contentType = file.type || "application/octet-stream";
      const signed = await apiClient.signUpload({ filename: file.name, contentType });
      const uploadRes = await fetch(signed.uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": contentType },
        body: file
      });
      if (!uploadRes.ok) {
        throw new Error("Upload failed");
      }
      const res = await apiClient.uploadCampgroundMap(campgroundId, { url: signed.publicUrl });
      setPreview(res.url);
      toast({ title: "Map uploaded" });
      onUploaded?.(res.url);
    } catch (e) {
      toast({ title: "Upload failed", description: "Uploads may be disabled. Check storage settings.", variant: "destructive" });
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="space-y-1">
        <Label htmlFor="map-upload">Campground map (image or PDF)</Label>
        <Input id="map-upload" type="file" accept="image/*,application/pdf" onChange={(e) => setFile(e.target.files?.[0] || null)} />
        <p className="text-xs text-slate-500">Used on the public page map section.</p>
      </div>
      {preview && (
        <div className="relative h-48 w-full overflow-hidden rounded-lg border border-slate-200 bg-slate-50">
          {preview.endsWith(".pdf") ? (
            <div className="flex h-full items-center justify-center text-sm text-slate-600">PDF uploaded</div>
          ) : (
            <Image src={preview} alt="Campground map preview" fill className="object-contain" />
          )}
        </div>
      )}
      <div className="flex gap-2">
        <Button onClick={handleUpload} disabled={!file || isUploading}>
          {isUploading ? "Uploading..." : "Upload"}
        </Button>
        {preview && !isUploading && <span className="text-xs text-slate-500">Saved preview shown above.</span>}
      </div>
    </div>
  );
}
