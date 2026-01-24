"use client";

import Image from "next/image";
import { cn } from "@/lib/utils";

interface TentLoaderProps {
  message?: string;
  className?: string;
}

const messages = [
  "Setting up camp...",
  "Pitching the tent...",
  "Finding the perfect spot...",
  "Gathering firewood...",
  "Preparing your adventure...",
];

export function TentLoader({ message, className }: TentLoaderProps) {
  // Use provided message or pick a random one
  const displayMessage = message || messages[0];

  return (
    <div className={cn("flex flex-col items-center justify-center gap-4", className)}>
      <div className="relative w-16 h-16">
        {/* Tent with bounce animation */}
        <div className="animate-tent-bounce">
          <Image
            src="/images/icons/bouncing-tent.png"
            alt="Loading"
            fill
            className="object-contain"
            sizes="64px"
          />
        </div>

        {/* Shadow that scales with bounce */}
        <div
          className="absolute bottom-0 left-1/2 -translate-x-1/2 w-10 h-2 bg-black/10 rounded-full animate-tent-bounce"
          style={{
            animationDelay: "0.1s",
            filter: "blur(2px)",
          }}
        />
      </div>

      <p className="text-sm text-muted-foreground animate-pulse">{displayMessage}</p>
    </div>
  );
}

// Full page version with centered content
export function TentLoaderFullPage({ message }: { message?: string }) {
  return (
    <div className="fixed inset-0 flex items-center justify-center bg-background/80 backdrop-blur-sm z-50">
      <TentLoader message={message} />
    </div>
  );
}
