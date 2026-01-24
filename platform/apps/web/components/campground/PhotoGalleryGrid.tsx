"use client";

import { useState, useCallback } from "react";
import Image from "next/image";
import { motion, useReducedMotion } from "framer-motion";
import { Images } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { PhotoLightbox } from "./PhotoLightbox";

interface PhotoGalleryGridProps {
  photos: string[];
  campgroundName: string;
  isExternal?: boolean;
  className?: string;
}

export function PhotoGalleryGrid({
  photos,
  campgroundName,
  isExternal = false,
  className,
}: PhotoGalleryGridProps) {
  const prefersReducedMotion = useReducedMotion();
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);

  const openLightbox = useCallback((index: number) => {
    setLightboxIndex(index);
    setLightboxOpen(true);
  }, []);

  // If no photos, show placeholder gradient with helpful message
  if (!photos || photos.length === 0) {
    return (
      <div
        className={cn(
          "relative h-[50vh] md:h-[60vh] w-full bg-gradient-to-br from-emerald-500 via-teal-500 to-cyan-600",
          className,
        )}
        aria-label="No photos available"
      >
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-center text-white/90">
            <Images className="h-16 w-16 mx-auto mb-4 opacity-60" />
            <p className="text-xl font-semibold mb-2">{campgroundName}</p>
            <p className="text-sm text-white/70">No photos available yet</p>
          </div>
        </div>
      </div>
    );
  }

  // Single photo layout
  if (photos.length === 1) {
    return (
      <>
        <div className={cn("relative h-[50vh] md:h-[60vh] w-full", className)}>
          <button
            onClick={() => openLightbox(0)}
            className="w-full h-full focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 rounded-b-2xl overflow-hidden"
            aria-label={`View photo of ${campgroundName}`}
          >
            {isExternal ? (
              <img src={photos[0]} alt={campgroundName} className="w-full h-full object-cover" />
            ) : (
              <Image src={photos[0]} alt={campgroundName} fill className="object-cover" priority />
            )}
          </button>
        </div>
        <PhotoLightbox
          photos={photos}
          campgroundName={campgroundName}
          isExternal={isExternal}
          isOpen={lightboxOpen}
          initialIndex={lightboxIndex}
          onClose={() => setLightboxOpen(false)}
        />
      </>
    );
  }

  // 2 photos layout
  if (photos.length === 2) {
    return (
      <>
        <div className={cn("relative h-[50vh] md:h-[60vh] w-full", className)}>
          <div className="absolute inset-0 grid grid-cols-2 gap-2 p-0 md:p-0">
            {photos.map((photo, index) => (
              <motion.button
                key={photo + index}
                onClick={() => openLightbox(index)}
                className={cn(
                  "relative overflow-hidden focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-inset",
                  index === 0 ? "rounded-bl-2xl" : "rounded-br-2xl",
                )}
                whileHover={prefersReducedMotion ? {} : { scale: 1.02 }}
                transition={{ duration: 0.2 }}
                aria-label={`View photo ${index + 1} of ${photos.length}`}
              >
                {isExternal ? (
                  <img
                    src={photo}
                    alt={`${campgroundName} - photo ${index + 1}`}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <Image
                    src={photo}
                    alt={`${campgroundName} - photo ${index + 1}`}
                    fill
                    className="object-cover"
                    priority={index === 0}
                  />
                )}
              </motion.button>
            ))}
          </div>
        </div>
        <PhotoLightbox
          photos={photos}
          campgroundName={campgroundName}
          isExternal={isExternal}
          isOpen={lightboxOpen}
          initialIndex={lightboxIndex}
          onClose={() => setLightboxOpen(false)}
        />
      </>
    );
  }

  // 3-4 photos layout
  if (photos.length <= 4) {
    return (
      <>
        <div className={cn("relative h-[50vh] md:h-[60vh] w-full", className)}>
          <div className="absolute inset-0 grid grid-cols-2 gap-2">
            {/* Main large photo */}
            <motion.button
              onClick={() => openLightbox(0)}
              className="relative row-span-2 overflow-hidden rounded-bl-2xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-inset"
              whileHover={prefersReducedMotion ? {} : { scale: 1.01 }}
              transition={{ duration: 0.2 }}
              aria-label="View main photo"
            >
              {isExternal ? (
                <img src={photos[0]} alt={campgroundName} className="w-full h-full object-cover" />
              ) : (
                <Image
                  src={photos[0]}
                  alt={campgroundName}
                  fill
                  className="object-cover"
                  priority
                />
              )}
            </motion.button>

            {/* Right side photos */}
            <div className="grid grid-rows-2 gap-2">
              {photos.slice(1, 3).map((photo, index) => (
                <motion.button
                  key={photo + index}
                  onClick={() => openLightbox(index + 1)}
                  className={cn(
                    "relative overflow-hidden focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-inset",
                    index === 0 && photos.length === 2 ? "rounded-br-2xl" : "",
                    index === 1 || (index === 0 && photos.length === 3) ? "rounded-br-2xl" : "",
                  )}
                  whileHover={prefersReducedMotion ? {} : { scale: 1.02 }}
                  transition={{ duration: 0.2 }}
                  aria-label={`View photo ${index + 2} of ${photos.length}`}
                >
                  {isExternal ? (
                    <img
                      src={photo}
                      alt={`${campgroundName} - photo ${index + 2}`}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <Image
                      src={photo}
                      alt={`${campgroundName} - photo ${index + 2}`}
                      fill
                      className="object-cover"
                    />
                  )}
                </motion.button>
              ))}
            </div>
          </div>

          {/* Show all photos button */}
          {photos.length > 3 && (
            <Button
              onClick={() => openLightbox(0)}
              variant="secondary"
              size="sm"
              className="absolute bottom-4 right-4 bg-card/95 hover:bg-card shadow-lg"
            >
              <Images className="h-4 w-4 mr-2" />
              Show all {photos.length} photos
            </Button>
          )}
        </div>
        <PhotoLightbox
          photos={photos}
          campgroundName={campgroundName}
          isExternal={isExternal}
          isOpen={lightboxOpen}
          initialIndex={lightboxIndex}
          onClose={() => setLightboxOpen(false)}
        />
      </>
    );
  }

  // 5+ photos - Airbnb-style grid
  return (
    <>
      <div className={cn("relative h-[50vh] md:h-[60vh] w-full", className)}>
        {/* Desktop: 5-image grid */}
        <div className="hidden md:grid absolute inset-0 grid-cols-4 grid-rows-2 gap-2">
          {/* Main large photo - spans 2 cols and 2 rows */}
          <motion.button
            onClick={() => openLightbox(0)}
            className="relative col-span-2 row-span-2 overflow-hidden rounded-l-2xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-inset"
            whileHover={prefersReducedMotion ? {} : { scale: 1.005 }}
            transition={{ duration: 0.3 }}
            aria-label="View main photo"
          >
            {isExternal ? (
              <img
                src={photos[0]}
                alt={campgroundName}
                className="w-full h-full object-cover transition-transform duration-500"
              />
            ) : (
              <Image
                src={photos[0]}
                alt={campgroundName}
                fill
                className="object-cover transition-transform duration-500"
                priority
              />
            )}
            <div className="absolute inset-0 bg-black/0 hover:bg-black/10 transition-colors" />
          </motion.button>

          {/* Top right photos */}
          <motion.button
            onClick={() => openLightbox(1)}
            className="relative overflow-hidden focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-inset"
            whileHover={prefersReducedMotion ? {} : { scale: 1.02 }}
            transition={{ duration: 0.2 }}
            aria-label="View photo 2"
          >
            {isExternal ? (
              <img
                src={photos[1]}
                alt={`${campgroundName} - photo 2`}
                className="w-full h-full object-cover"
              />
            ) : (
              <Image
                src={photos[1]}
                alt={`${campgroundName} - photo 2`}
                fill
                className="object-cover"
              />
            )}
            <div className="absolute inset-0 bg-black/0 hover:bg-black/10 transition-colors" />
          </motion.button>

          <motion.button
            onClick={() => openLightbox(2)}
            className="relative overflow-hidden rounded-tr-2xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-inset"
            whileHover={prefersReducedMotion ? {} : { scale: 1.02 }}
            transition={{ duration: 0.2 }}
            aria-label="View photo 3"
          >
            {isExternal ? (
              <img
                src={photos[2]}
                alt={`${campgroundName} - photo 3`}
                className="w-full h-full object-cover"
              />
            ) : (
              <Image
                src={photos[2]}
                alt={`${campgroundName} - photo 3`}
                fill
                className="object-cover"
              />
            )}
            <div className="absolute inset-0 bg-black/0 hover:bg-black/10 transition-colors" />
          </motion.button>

          {/* Bottom right photos */}
          <motion.button
            onClick={() => openLightbox(3)}
            className="relative overflow-hidden focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-inset"
            whileHover={prefersReducedMotion ? {} : { scale: 1.02 }}
            transition={{ duration: 0.2 }}
            aria-label="View photo 4"
          >
            {isExternal ? (
              <img
                src={photos[3]}
                alt={`${campgroundName} - photo 4`}
                className="w-full h-full object-cover"
              />
            ) : (
              <Image
                src={photos[3]}
                alt={`${campgroundName} - photo 4`}
                fill
                className="object-cover"
              />
            )}
            <div className="absolute inset-0 bg-black/0 hover:bg-black/10 transition-colors" />
          </motion.button>

          <motion.button
            onClick={() => openLightbox(4)}
            className="relative overflow-hidden rounded-br-2xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-inset"
            whileHover={prefersReducedMotion ? {} : { scale: 1.02 }}
            transition={{ duration: 0.2 }}
            aria-label="View photo 5"
          >
            {isExternal ? (
              <img
                src={photos[4]}
                alt={`${campgroundName} - photo 5`}
                className="w-full h-full object-cover"
              />
            ) : (
              <Image
                src={photos[4]}
                alt={`${campgroundName} - photo 5`}
                fill
                className="object-cover"
              />
            )}
            <div className="absolute inset-0 bg-black/0 hover:bg-black/10 transition-colors" />
          </motion.button>
        </div>

        {/* Mobile: Single hero image with thumbnail strip */}
        <div className="md:hidden absolute inset-0">
          <button
            onClick={() => openLightbox(0)}
            className="w-full h-full focus:outline-none"
            aria-label="View photos"
          >
            {isExternal ? (
              <img src={photos[0]} alt={campgroundName} className="w-full h-full object-cover" />
            ) : (
              <Image src={photos[0]} alt={campgroundName} fill className="object-cover" priority />
            )}
          </button>

          {/* Mobile thumbnail strip */}
          <div className="absolute bottom-4 left-4 right-4 flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
            {photos.slice(0, 5).map((photo, index) => (
              <button
                key={photo + index}
                onClick={() => openLightbox(index)}
                className={cn(
                  "relative flex-shrink-0 w-16 h-16 rounded-lg overflow-hidden",
                  "ring-2 ring-offset-2 ring-offset-transparent",
                  index === 0 ? "ring-white" : "ring-white/50",
                )}
                aria-label={`View photo ${index + 1}`}
              >
                {isExternal ? (
                  <img src={photo} alt="" className="w-full h-full object-cover" />
                ) : (
                  <Image src={photo} alt="" fill className="object-cover" sizes="64px" />
                )}
              </button>
            ))}
            {photos.length > 5 && (
              <button
                onClick={() => openLightbox(5)}
                className="flex-shrink-0 w-16 h-16 rounded-lg bg-black/60 text-white text-sm font-medium flex items-center justify-center"
                aria-label={`View all ${photos.length} photos`}
              >
                +{photos.length - 5}
              </button>
            )}
          </div>
        </div>

        {/* Show all photos button (desktop) */}
        <Button
          onClick={() => openLightbox(0)}
          variant="secondary"
          size="sm"
          className="absolute bottom-4 right-4 bg-card/95 hover:bg-card shadow-lg hidden md:flex"
        >
          <Images className="h-4 w-4 mr-2" />
          Show all {photos.length} photos
        </Button>
      </div>

      <PhotoLightbox
        photos={photos}
        campgroundName={campgroundName}
        isExternal={isExternal}
        isOpen={lightboxOpen}
        initialIndex={lightboxIndex}
        onClose={() => setLightboxOpen(false)}
      />
    </>
  );
}
