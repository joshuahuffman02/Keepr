"use client";

import { useCallback, useRef } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { Upload, X, Image as ImageIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface SiteClassPhotoUploadProps {
  photos: string[];
  onPhotosChange: (photos: string[]) => void;
  maxPhotos?: number;
  maxSizeMB?: number;
}

export function SiteClassPhotoUpload({
  photos,
  onPhotosChange,
  maxPhotos = 5,
  maxSizeMB = 10,
}: SiteClassPhotoUploadProps) {
  const prefersReducedMotion = useReducedMotion();
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFiles = useCallback(
    (files: FileList | null) => {
      if (!files) return;

      const newPhotos: string[] = [];
      const maxBytes = maxSizeMB * 1024 * 1024;

      Array.from(files).forEach((file) => {
        if (!file.type.startsWith("image/")) return;
        if (file.size > maxBytes) return;
        if (photos.length + newPhotos.length >= maxPhotos) return;

        // Create blob URL for preview
        const url = URL.createObjectURL(file);
        newPhotos.push(url);
      });

      if (newPhotos.length > 0) {
        onPhotosChange([...photos, ...newPhotos]);
      }
    },
    [photos, onPhotosChange, maxPhotos, maxSizeMB],
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      handleFiles(e.dataTransfer.files);
    },
    [handleFiles],
  );

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const removePhoto = (index: number) => {
    const photo = photos[index];
    // Revoke blob URL to free memory
    if (photo.startsWith("blob:")) {
      URL.revokeObjectURL(photo);
    }
    onPhotosChange(photos.filter((_, i) => i !== index));
  };

  const canAddMore = photos.length < maxPhotos;

  return (
    <div className="space-y-3">
      {/* Photo grid */}
      {photos.length > 0 && (
        <div className="grid grid-cols-3 gap-2">
          <AnimatePresence mode="popLayout">
            {photos.map((photo, index) => (
              <motion.div
                key={photo}
                initial={prefersReducedMotion ? {} : { opacity: 0, scale: 0.8 }}
                animate={prefersReducedMotion ? {} : { opacity: 1, scale: 1 }}
                exit={prefersReducedMotion ? {} : { opacity: 0, scale: 0.8 }}
                className="relative aspect-video rounded-lg overflow-hidden group"
              >
                <img
                  src={photo}
                  alt={`Site photo ${index + 1}`}
                  className="w-full h-full object-cover"
                />
                <button
                  type="button"
                  onClick={() => removePhoto(index)}
                  className="absolute top-1 right-1 p-1 rounded-full bg-black/60 text-white opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-500"
                >
                  <X className="w-3 h-3" />
                </button>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}

      {/* Upload zone */}
      {canAddMore && (
        <div
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onClick={() => inputRef.current?.click()}
          className={cn(
            "relative flex flex-col items-center justify-center gap-2 p-6 rounded-lg border-2 border-dashed transition-colors cursor-pointer",
            "border-border bg-muted/30 hover:border-border hover:bg-muted/50",
          )}
        >
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            multiple
            onChange={(e) => handleFiles(e.target.files)}
            className="hidden"
          />
          <div className="w-10 h-10 rounded-full bg-muted/50 flex items-center justify-center">
            {photos.length === 0 ? (
              <ImageIcon className="w-5 h-5 text-muted-foreground" />
            ) : (
              <Upload className="w-5 h-5 text-muted-foreground" />
            )}
          </div>
          <div className="text-center">
            <p className="text-sm text-muted-foreground">
              {photos.length === 0 ? "Drop photos here or click to upload" : "Add more photos"}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {photos.length}/{maxPhotos} photos • Max {maxSizeMB}MB each
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
