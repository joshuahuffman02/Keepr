"use client";

import Image, { ImageProps } from "next/image";
import { useState } from "react";
import { cn } from "@/lib/utils";

interface OptimizedImageProps extends Omit<ImageProps, "onLoad" | "onError"> {
  fallback?: React.ReactNode;
  aspectRatio?: "square" | "video" | "wide" | "portrait" | string;
  showSkeleton?: boolean;
}

/**
 * Optimized Image component with:
 * - Automatic lazy loading
 * - Blur placeholder
 * - Error fallback
 * - Loading skeleton
 * - Proper sizing for SEO/performance
 */
export function OptimizedImage({
  src,
  alt,
  className,
  fallback,
  aspectRatio,
  showSkeleton = true,
  fill,
  width,
  height,
  priority = false,
  ...props
}: OptimizedImageProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  // Aspect ratio classes
  const aspectClasses: Record<string, string> = {
    square: "aspect-square",
    video: "aspect-video",
    wide: "aspect-[21/9]",
    portrait: "aspect-[3/4]",
  };

  const aspectClass = aspectRatio ? aspectClasses[aspectRatio] || `aspect-[${aspectRatio}]` : "";

  if (hasError) {
    return (
      <div className={cn("flex items-center justify-center bg-muted", aspectClass, className)}>
        {fallback || <div className="text-muted-foreground text-sm">Image unavailable</div>}
      </div>
    );
  }

  return (
    <div className={cn("relative overflow-hidden", aspectClass, className)}>
      {/* Loading skeleton */}
      {showSkeleton && isLoading && <div className="absolute inset-0 bg-muted animate-pulse" />}

      <Image
        src={src}
        alt={alt}
        fill={fill}
        width={!fill ? width : undefined}
        height={!fill ? height : undefined}
        priority={priority}
        loading={priority ? "eager" : "lazy"}
        className={cn(
          "object-cover transition-opacity duration-300",
          isLoading ? "opacity-0" : "opacity-100",
        )}
        onLoad={() => setIsLoading(false)}
        onError={() => {
          setIsLoading(false);
          setHasError(true);
        }}
        sizes={props.sizes || "(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"}
        {...props}
      />
    </div>
  );
}

/**
 * Hero image component with optimized loading
 */
export function HeroImage({
  src,
  alt,
  className,
  overlayClassName,
  children,
}: {
  src: string;
  alt: string;
  className?: string;
  overlayClassName?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className={cn("relative", className)}>
      <OptimizedImage
        src={src}
        alt={alt}
        fill
        priority
        showSkeleton
        className="absolute inset-0"
        sizes="100vw"
      />
      {children && <div className={cn("relative z-10", overlayClassName)}>{children}</div>}
    </div>
  );
}

/**
 * Gallery image with lightbox support
 */
export function GalleryImage({
  src,
  alt,
  onClick,
  className,
}: {
  src: string;
  alt: string;
  onClick?: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn("relative overflow-hidden rounded-lg group cursor-pointer", className)}
    >
      <OptimizedImage
        src={src}
        alt={alt}
        fill
        aspectRatio="4/3"
        className="group-hover:scale-105 transition-transform duration-300"
      />
      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors" />
    </button>
  );
}

/**
 * Avatar image with fallback initials
 */
export function AvatarImage({
  src,
  alt,
  name,
  size = "md",
  className,
}: {
  src?: string | null;
  alt: string;
  name?: string;
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
}) {
  const sizeClasses = {
    sm: "h-8 w-8 text-xs",
    md: "h-10 w-10 text-sm",
    lg: "h-12 w-12 text-base",
    xl: "h-16 w-16 text-lg",
  };

  const initials = name
    ?.split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  if (!src) {
    return (
      <div
        className={cn(
          "rounded-full bg-status-success/15 text-status-success flex items-center justify-center font-semibold",
          sizeClasses[size],
          className,
        )}
      >
        {initials || "?"}
      </div>
    );
  }

  return (
    <div className={cn("relative rounded-full overflow-hidden", sizeClasses[size], className)}>
      <OptimizedImage
        src={src}
        alt={alt}
        fill
        showSkeleton
        fallback={
          <div className="h-full w-full bg-status-success/15 text-status-success flex items-center justify-center font-semibold">
            {initials || "?"}
          </div>
        }
      />
    </div>
  );
}
