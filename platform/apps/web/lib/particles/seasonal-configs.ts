import type { Season } from "../../hooks/use-temporal-context";

export interface ParticleConfig {
  /** Name of the effect */
  name: string;
  /** Number of particles */
  count: number;
  /** CSS animation class */
  animationClass: string;
  /** Particle colors (Tailwind classes) */
  colors: string[];
  /** Size range [min, max] in pixels */
  sizeRange: [number, number];
  /** Only show at certain times (empty = always) */
  timeOfDay?: ("morning" | "afternoon" | "evening" | "night")[];
  /** Duration range for animations [min, max] in seconds */
  durationRange: [number, number];
  /** Whether particles have glow effect */
  glow?: boolean;
  /** Custom shapes (SVG paths or emoji-like characters) */
  shapes?: string[];
}

type TimeOfDay = NonNullable<ParticleConfig["timeOfDay"]>[number];
const timeOfDayOptions: TimeOfDay[] = ["morning", "afternoon", "evening", "night"];
const isTimeOfDay = (value: string): value is TimeOfDay =>
  timeOfDayOptions.some((option) => option === value);

export const seasonalConfigs: Record<Season, ParticleConfig> = {
  fall: {
    name: "Falling Leaves",
    count: 15,
    animationClass: "animate-fall-leaf",
    colors: [
      "text-orange-400",
      "text-amber-500",
      "text-red-400",
      "text-yellow-500",
      "text-orange-600",
    ],
    sizeRange: [12, 24],
    durationRange: [6, 12],
    shapes: [
      // Maple leaf
      "M12 2L9 9L2 9L7 14L5 21L12 17L19 21L17 14L22 9L15 9L12 2Z",
      // Oak leaf
      "M12 2C9 5 7 8 7 11C7 14 9 16 12 18C15 16 17 14 17 11C17 8 15 5 12 2Z",
    ],
  },
  winter: {
    name: "Snowfall",
    count: 25,
    animationClass: "animate-snowfall",
    colors: ["text-white", "text-blue-100", "text-slate-100"],
    sizeRange: [4, 12],
    durationRange: [8, 15],
    glow: true,
    shapes: [
      // Simple snowflake
      "M12 0L12 24M0 12L24 12M3 3L21 21M21 3L3 21",
    ],
  },
  spring: {
    name: "Cherry Blossoms",
    count: 12,
    animationClass: "animate-petal-fall",
    colors: ["text-pink-300", "text-pink-200", "text-rose-200", "text-white"],
    sizeRange: [8, 16],
    durationRange: [10, 18],
    shapes: [
      // Petal
      "M12 2C8 2 4 6 4 12C4 18 8 22 12 22C16 22 20 18 20 12C20 6 16 2 12 2Z",
    ],
  },
  summer: {
    name: "Fireflies",
    count: 8,
    animationClass: "animate-firefly",
    colors: ["text-yellow-300", "text-amber-300", "text-lime-300"],
    sizeRange: [4, 8],
    timeOfDay: ["evening", "night"],
    durationRange: [3, 6],
    glow: true,
  },
};

// Get the particle config for a season
export function getSeasonalConfig(season: Season): ParticleConfig {
  return seasonalConfigs[season];
}

// Check if particles should be shown based on time
export function shouldShowParticles(config: ParticleConfig, timeOfDay: string): boolean {
  if (!config.timeOfDay || config.timeOfDay.length === 0) {
    return true;
  }
  if (!isTimeOfDay(timeOfDay)) {
    return false;
  }
  return config.timeOfDay.includes(timeOfDay);
}
