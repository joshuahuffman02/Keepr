"use client";

import Image from "next/image";
import { Sunrise, Sun, Sunset, Moon } from "lucide-react";
import { SearchBar } from "./SearchBar";
import { TrustBadgesDark } from "./TrustBadges";
import { SocialProofInline } from "./SocialProofStrip";
import { useTemporalContext } from "../../hooks/use-temporal-context";
import { getGreeting } from "../../lib/temporal/greetings";
import { SeasonalParticles } from "../effects/SeasonalParticles";

interface HeroBannerProps {
  onSearch: (query: string, filters: {
    location: string;
    dates: { checkIn: string; checkOut: string };
    guests: number;
  } | null) => void;
}

// Time-appropriate icon component
function TimeIcon({ timeOfDay }: { timeOfDay: string }) {
  const iconClass = "w-7 h-7 md:w-9 md:h-9 text-white/80";

  switch (timeOfDay) {
    case "morning":
      return <Sunrise className={iconClass} />;
    case "afternoon":
      return <Sun className={iconClass} />;
    case "evening":
      return <Sunset className={iconClass} />;
    case "night":
      return <Moon className={iconClass} />;
    default:
      return <Sun className={iconClass} />;
  }
}

export function HeroBanner({ onSearch }: HeroBannerProps) {
  const { timeOfDay, isReducedMotion } = useTemporalContext();
  const greeting = getGreeting(timeOfDay);

  // Dynamic gradient classes based on time of day
  const gradientClass = `${greeting.gradientFrom} ${greeting.gradientVia} ${greeting.gradientTo}`;

  return (
    <section className="relative overflow-hidden">
      {/* Background gradient - changes with time of day */}
      <div className={`absolute inset-0 bg-gradient-to-br ${gradientClass} transition-colors duration-1000`} />

      {/* Decorative elements - simplified */}
      <div className="absolute inset-0 overflow-hidden">
        {/* Seasonal particles - leaves, snow, petals, or fireflies */}
        {!isReducedMotion && <SeasonalParticles />}

        {/* Ambient glow spots */}
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-card/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-card/10 rounded-full blur-3xl" />

        {/* Floating clay decorations - reduced to 4 key elements */}
        <div className="hidden md:block">
          {/* Left side - tree and tent */}
          <div className="absolute top-20 left-[5%] w-16 h-16 opacity-60 animate-float-slow">
            <Image src="/images/icons/hero/pine-tree.png" alt="" fill className="object-contain" sizes="64px" />
          </div>
          <div className="absolute bottom-32 left-[10%] w-14 h-14 opacity-55 animate-float-medium">
            <Image src="/images/icons/hero/tent.png" alt="" fill className="object-contain" sizes="56px" />
          </div>

          {/* Right side - sun and campfire */}
          <div className="absolute top-16 right-[8%] w-14 h-14 opacity-70 animate-float-medium">
            <Image src="/images/icons/hero/sun.png" alt="" fill className="object-contain" sizes="56px" />
          </div>
          <div className="absolute bottom-36 right-[6%] w-14 h-14 opacity-55 animate-float-fast">
            <Image src="/images/icons/hero/campfire.png" alt="" fill className="object-contain" sizes="56px" />
          </div>
        </div>

        {/* Mountain silhouette */}
        <svg
          className="absolute bottom-0 left-0 right-0 text-white/5"
          viewBox="0 0 1440 320"
          preserveAspectRatio="none"
        >
          <path
            fill="currentColor"
            d="M0,192L48,197.3C96,203,192,213,288,229.3C384,245,480,267,576,250.7C672,235,768,181,864,181.3C960,181,1056,235,1152,234.7C1248,235,1344,181,1392,154.7L1440,128L1440,320L1392,320C1344,320,1248,320,1152,320C1056,320,960,320,864,320C768,320,672,320,576,320C480,320,384,320,288,320C192,320,96,320,48,320L0,320Z"
          />
        </svg>
      </div>

      {/* Content */}
      <div className="relative max-w-7xl mx-auto px-6 py-20 md:py-28">
        {/* Main headline - BIGGER with shimmer effect */}
        <div className="text-center mb-10 md:mb-12">
          {/* Time indicator */}
          <div className="flex items-center justify-center gap-2 mb-5">
            <TimeIcon timeOfDay={timeOfDay} />
          </div>

          <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold text-white mb-4 md:mb-6 leading-tight">
            {greeting.headline.split(",")[0]}
            {greeting.headline.includes(",") && (
              <span className={`block relative bg-gradient-to-r ${greeting.accentFrom} ${greeting.accentTo} bg-clip-text text-transparent`}>
                {greeting.headline.split(",")[1]?.trim() || "Top-Rated Campgrounds"}
                {/* Shimmer effect overlay */}
                {!isReducedMotion && (
                  <span
                    className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent bg-[length:200%_100%] animate-shimmer"
                    style={{ mixBlendMode: "overlay" }}
                  />
                )}
              </span>
            )}
            {!greeting.headline.includes(",") && (
              <span className={`block relative bg-gradient-to-r ${greeting.accentFrom} ${greeting.accentTo} bg-clip-text text-transparent`}>
                Find Your Perfect Campsite
                {/* Shimmer effect overlay */}
                {!isReducedMotion && (
                  <span
                    className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent bg-[length:200%_100%] animate-shimmer"
                    style={{ mixBlendMode: "overlay" }}
                  />
                )}
              </span>
            )}
          </h1>
          <p className="text-lg md:text-xl lg:text-2xl text-white/85 max-w-2xl mx-auto font-light">
            {greeting.subheadline}
          </p>
        </div>

        {/* Search bar - the star of the show */}
        <div className="max-w-4xl mx-auto">
          <SearchBar onSearch={onSearch} />
        </div>

        {/* Trust badges - now below search bar for cleaner focus */}
        <div className="mt-8 md:mt-10">
          <TrustBadgesDark className="justify-center" />
        </div>

        {/* Social proof stats */}
        <div className="mt-8 md:mt-12">
          <SocialProofInline />
        </div>
      </div>

      {/* CSS for shimmer animation */}
      <style jsx>{`
        @keyframes shimmer {
          0% {
            background-position: 200% 0;
          }
          100% {
            background-position: -200% 0;
          }
        }
        .animate-shimmer {
          animation: shimmer 3s ease-in-out infinite;
        }
      `}</style>
    </section>
  );
}
