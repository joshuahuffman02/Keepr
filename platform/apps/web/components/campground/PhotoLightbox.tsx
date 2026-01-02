"use client";

import { useCallback, useEffect, useState } from "react";
import Image from "next/image";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { X, ChevronLeft, ChevronRight, Download, Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface PhotoLightboxProps {
  photos: string[];
  campgroundName: string;
  isExternal?: boolean;
  isOpen: boolean;
  initialIndex?: number;
  onClose: () => void;
}

export function PhotoLightbox({
  photos,
  campgroundName,
  isExternal = false,
  isOpen,
  initialIndex = 0,
  onClose,
}: PhotoLightboxProps) {
  const prefersReducedMotion = useReducedMotion();
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [touchEnd, setTouchEnd] = useState<number | null>(null);

  // Reset index when opening
  useEffect(() => {
    if (isOpen) {
      setCurrentIndex(initialIndex);
    }
  }, [isOpen, initialIndex]);

  // Keyboard navigation
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case "Escape":
          onClose();
          break;
        case "ArrowLeft":
          setCurrentIndex((prev) => (prev > 0 ? prev - 1 : photos.length - 1));
          break;
        case "ArrowRight":
          setCurrentIndex((prev) => (prev < photos.length - 1 ? prev + 1 : 0));
          break;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, photos.length, onClose]);

  // Prevent body scroll when open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  // Touch swipe handling
  const minSwipeDistance = 50;

  const onTouchStart = (e: React.TouchEvent) => {
    setTouchEnd(null);
    setTouchStart(e.targetTouches[0].clientX);
  };

  const onTouchMove = (e: React.TouchEvent) => {
    setTouchEnd(e.targetTouches[0].clientX);
  };

  const onTouchEnd = () => {
    if (!touchStart || !touchEnd) return;

    const distance = touchStart - touchEnd;
    const isLeftSwipe = distance > minSwipeDistance;
    const isRightSwipe = distance < -minSwipeDistance;

    if (isLeftSwipe) {
      setCurrentIndex((prev) => (prev < photos.length - 1 ? prev + 1 : 0));
    }
    if (isRightSwipe) {
      setCurrentIndex((prev) => (prev > 0 ? prev - 1 : photos.length - 1));
    }
  };

  const goToNext = useCallback(() => {
    setCurrentIndex((prev) => (prev < photos.length - 1 ? prev + 1 : 0));
  }, [photos.length]);

  const goToPrev = useCallback(() => {
    setCurrentIndex((prev) => (prev > 0 ? prev - 1 : photos.length - 1));
  }, [photos.length]);

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: campgroundName,
          text: `Check out ${campgroundName}!`,
          url: window.location.href,
        });
      } catch (err) {
        // User cancelled or error
      }
    }
  };

  if (!photos || photos.length === 0) return null;

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="fixed inset-0 z-50 bg-black"
          initial={prefersReducedMotion ? { opacity: 1 } : { opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0 }}
          transition={{ duration: 0.2 }}
        >
          {/* Header */}
          <div className="absolute top-0 left-0 right-0 z-10 flex items-center justify-between p-4 bg-gradient-to-b from-black/60 to-transparent">
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                size="icon"
                onClick={onClose}
                className="text-foreground hover:bg-card/20"
                aria-label="Close gallery"
              >
                <X className="h-6 w-6" />
              </Button>
              <span className="text-white font-medium">
                {currentIndex + 1} / {photos.length}
              </span>
            </div>
            <div className="flex items-center gap-2">
              {typeof navigator !== "undefined" && typeof navigator.share === "function" && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleShare}
                  className="text-foreground hover:bg-card/20"
                  aria-label="Share"
                >
                  <Share2 className="h-5 w-5" />
                </Button>
              )}
            </div>
          </div>

          {/* Main image area */}
          <div
            className="absolute inset-0 flex items-center justify-center"
            onTouchStart={onTouchStart}
            onTouchMove={onTouchMove}
            onTouchEnd={onTouchEnd}
          >
            <AnimatePresence mode="wait">
              <motion.div
                key={currentIndex}
                className="relative w-full h-full flex items-center justify-center p-4 md:p-16"
                initial={
                  prefersReducedMotion ? {} : { opacity: 0, x: 50 }
                }
                animate={{ opacity: 1, x: 0 }}
                exit={prefersReducedMotion ? {} : { opacity: 0, x: -50 }}
                transition={{ duration: 0.2 }}
              >
                {isExternal ? (
                  <img
                    src={photos[currentIndex]}
                    alt={`${campgroundName} - photo ${currentIndex + 1}`}
                    className="max-w-full max-h-full object-contain"
                  />
                ) : (
                  <div className="relative w-full h-full">
                    <Image
                      src={photos[currentIndex]}
                      alt={`${campgroundName} - photo ${currentIndex + 1}`}
                      fill
                      className="object-contain"
                      priority
                      sizes="100vw"
                    />
                  </div>
                )}
              </motion.div>
            </AnimatePresence>

            {/* Navigation arrows */}
            {photos.length > 1 && (
              <>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={goToPrev}
                  className="absolute left-4 top-1/2 -translate-y-1/2 h-12 w-12 rounded-full bg-card/10 hover:bg-card/20 text-foreground backdrop-blur-sm hidden md:flex"
                  aria-label="Previous photo"
                >
                  <ChevronLeft className="h-8 w-8" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={goToNext}
                  className="absolute right-4 top-1/2 -translate-y-1/2 h-12 w-12 rounded-full bg-card/10 hover:bg-card/20 text-foreground backdrop-blur-sm hidden md:flex"
                  aria-label="Next photo"
                >
                  <ChevronRight className="h-8 w-8" />
                </Button>
              </>
            )}
          </div>

          {/* Thumbnail strip */}
          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-4">
            <div className="flex justify-center gap-2 overflow-x-auto pb-2 scrollbar-hide">
              {photos.map((photo, index) => (
                <button
                  key={photo + index}
                  onClick={() => setCurrentIndex(index)}
                  className={cn(
                    "relative flex-shrink-0 w-16 h-16 md:w-20 md:h-20 rounded-lg overflow-hidden transition-all",
                    "focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 focus:ring-offset-black",
                    index === currentIndex
                      ? "ring-2 ring-white scale-110"
                      : "opacity-50 hover:opacity-80"
                  )}
                  aria-label={`View photo ${index + 1}`}
                  aria-current={index === currentIndex ? "true" : undefined}
                >
                  {isExternal ? (
                    <img
                      src={photo}
                      alt=""
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <Image
                      src={photo}
                      alt=""
                      fill
                      className="object-cover"
                      sizes="80px"
                    />
                  )}
                </button>
              ))}
            </div>

            {/* Mobile swipe hint */}
            <p className="text-center text-white/60 text-xs mt-2 md:hidden">
              Swipe to navigate
            </p>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
