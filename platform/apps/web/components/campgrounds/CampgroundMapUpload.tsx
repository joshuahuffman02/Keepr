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
  onUploaded,
}: {
  campgroundId: string;
  initialUrl?: string | null;
  onUploaded?: (url: string) => void;
}) {
  const { toast } = useToast();
  const MAX_FILE_SIZE = 18 * 1024 * 1024;
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

  const readAsDataUrl = (input: File) =>
    new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result;
        if (typeof result === "string") {
          resolve(result);
          return;
        }
        reject(new Error("Failed to read file"));
      };
      reader.onerror = () => reject(new Error("Failed to read file"));
      reader.readAsDataURL(input);
    });

  const handleUpload = async () => {
    if (!file) return;
    if (file.size > MAX_FILE_SIZE) {
      toast({
        title: "Upload failed",
        description: "File is too large. Max 18MB.",
        variant: "destructive",
      });
      return;
    }
    setIsUploading(true);
    try {
      const dataUrl = await readAsDataUrl(file);
      const res = await apiClient.uploadCampgroundMap(campgroundId, {
        dataUrl,
        contentType: file.type || "application/octet-stream",
        filename: file.name,
      });
      setPreview(res.url);
      toast({ title: "Map uploaded" });
      onUploaded?.(res.url);
    } catch (e) {
      const message =
        e instanceof Error ? e.message : "Uploads may be disabled. Check storage settings.";
      toast({ title: "Upload failed", description: message, variant: "destructive" });
    } finally {
      setIsUploading(false);
    }
  };

  const isPdf =
    file?.type === "application/pdf" ||
    (!file && !!preview && preview.toLowerCase().endsWith(".pdf"));

  return (
    <div className="space-y-3">
      <div className="space-y-1">
        <Label htmlFor="map-upload">Campground map (image or PDF)</Label>
        <Input
          id="map-upload"
          type="file"
          accept="image/*,application/pdf"
          onChange={(e) => setFile(e.target.files?.[0] || null)}
        />
        <p className="text-xs text-muted-foreground">Used on the public page map section.</p>
      </div>
      {preview && (
        <div className="relative h-48 w-full overflow-hidden rounded-lg border border-border bg-muted">
          {isPdf ? (
            <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
              PDF uploaded
            </div>
          ) : (
            <Image
              src={preview}
              alt="Campground map preview"
              fill
              className="object-contain"
              unoptimized
            />
          )}
        </div>
      )}
      <div className="flex gap-2">
        <Button onClick={handleUpload} disabled={!file || isUploading}>
          {isUploading ? "Uploading..." : "Upload"}
        </Button>
        {preview && !isUploading && (
          <span className="text-xs text-muted-foreground">Saved preview shown above.</span>
        )}
      </div>
    </div>
  );
}
