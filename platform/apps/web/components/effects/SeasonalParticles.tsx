"use client";

import { useMemo } from "react";
import { useTemporalContext } from "../../hooks/use-temporal-context";
import { getSeasonalConfig, shouldShowParticles } from "../../lib/particles/seasonal-configs";

interface ParticleProps {
  index: number;
  color: string;
  size: number;
  left: number;
  delay: number;
  duration: number;
  glow?: boolean;
  animationClass: string;
}

function Particle({ color, size, left, delay, duration, glow, animationClass }: ParticleProps) {
  return (
    <div
      className={`absolute top-0 ${color} ${animationClass} pointer-events-none`}
      style={{
        left: `${left}%`,
        animationDelay: `${delay}s`,
        animationDuration: `${duration}s`,
        width: `${size}px`,
        height: `${size}px`,
        filter: glow ? "blur(1px) drop-shadow(0 0 4px currentColor)" : undefined,
      }}
    >
      {/* Simple circle/dot for the particle */}
      <div
        className="w-full h-full rounded-full bg-current opacity-80"
        style={{
          boxShadow: glow ? "0 0 8px currentColor" : undefined,
        }}
      />
    </div>
  );
}

// Leaf-shaped particle for fall
function LeafParticle({
  color,
  size,
  left,
  delay,
  duration,
  animationClass,
}: Omit<ParticleProps, "glow">) {
  return (
    <div
      className={`absolute top-0 ${color} ${animationClass} pointer-events-none`}
      style={{
        left: `${left}%`,
        animationDelay: `${delay}s`,
        animationDuration: `${duration}s`,
        width: `${size}px`,
        height: `${size}px`,
      }}
    >
      <svg viewBox="0 0 24 24" fill="currentColor" className="w-full h-full opacity-70">
        <path d="M12 2L9 9L2 9L7 14L5 21L12 17L19 21L17 14L22 9L15 9L12 2Z" />
      </svg>
    </div>
  );
}

// Snowflake particle for winter
function SnowflakeParticle({
  color,
  size,
  left,
  delay,
  duration,
  animationClass,
}: Omit<ParticleProps, "glow">) {
  return (
    <div
      className={`absolute top-0 ${color} ${animationClass} pointer-events-none`}
      style={{
        left: `${left}%`,
        animationDelay: `${delay}s`,
        animationDuration: `${duration}s`,
        width: `${size}px`,
        height: `${size}px`,
        filter: "blur(0.5px) drop-shadow(0 0 2px currentColor)",
      }}
    >
      <svg
        viewBox="0 0 24 24"
        stroke="currentColor"
        fill="none"
        strokeWidth="2"
        className="w-full h-full opacity-80"
      >
        <line x1="12" y1="2" x2="12" y2="22" />
        <line x1="2" y1="12" x2="22" y2="12" />
        <line x1="5" y1="5" x2="19" y2="19" />
        <line x1="19" y1="5" x2="5" y2="19" />
      </svg>
    </div>
  );
}

// Petal particle for spring
function PetalParticle({
  color,
  size,
  left,
  delay,
  duration,
  animationClass,
}: Omit<ParticleProps, "glow">) {
  return (
    <div
      className={`absolute top-0 ${color} ${animationClass} pointer-events-none`}
      style={{
        left: `${left}%`,
        animationDelay: `${delay}s`,
        animationDuration: `${duration}s`,
        width: `${size}px`,
        height: `${size}px`,
      }}
    >
      <svg viewBox="0 0 24 24" fill="currentColor" className="w-full h-full opacity-70">
        <ellipse cx="12" cy="12" rx="6" ry="10" />
      </svg>
    </div>
  );
}

interface SeasonalParticlesProps {
  className?: string;
  /** Override the particle count */
  count?: number;
  /** Force a specific season (for testing) */
  forceSeason?: "spring" | "summer" | "fall" | "winter";
}

export function SeasonalParticles({ className = "", count, forceSeason }: SeasonalParticlesProps) {
  const { season, timeOfDay, isReducedMotion } = useTemporalContext();

  const activeSeason = forceSeason || season;
  const config = getSeasonalConfig(activeSeason);

  // Generate particles with random positions and timings
  const particles = useMemo(() => {
    if (isReducedMotion) return [];

    const particleCount = count ?? config.count;
    const result = [];

    for (let i = 0; i < particleCount; i++) {
      const color = config.colors[Math.floor(Math.random() * config.colors.length)];
      const size =
        config.sizeRange[0] + Math.random() * (config.sizeRange[1] - config.sizeRange[0]);
      const left = Math.random() * 100;
      const delay = Math.random() * config.durationRange[1];
      const duration =
        config.durationRange[0] +
        Math.random() * (config.durationRange[1] - config.durationRange[0]);

      result.push({
        index: i,
        color,
        size,
        left,
        delay,
        duration,
        glow: config.glow,
        animationClass: config.animationClass,
      });
    }

    return result;
  }, [activeSeason, count, isReducedMotion, config]);

  // Don't render if reduced motion or not the right time
  if (isReducedMotion || !shouldShowParticles(config, timeOfDay)) {
    return null;
  }

  // Render appropriate particle type based on season
  const renderParticle = (particle: (typeof particles)[0]) => {
    switch (activeSeason) {
      case "fall":
        return <LeafParticle key={particle.index} {...particle} />;
      case "winter":
        return <SnowflakeParticle key={particle.index} {...particle} />;
      case "spring":
        return <PetalParticle key={particle.index} {...particle} />;
      case "summer":
        return <Particle key={particle.index} {...particle} />;
      default:
        return <Particle key={particle.index} {...particle} />;
    }
  };

  return (
    <div
      className={`absolute inset-0 overflow-hidden pointer-events-none ${className}`}
      aria-hidden="true"
    >
      {particles.map(renderParticle)}
    </div>
  );
}
