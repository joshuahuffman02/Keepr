import type { TimeOfDay } from "../../hooks/use-temporal-context";

export interface GreetingConfig {
  headline: string;
  subheadline: string;
  gradientFrom: string;
  gradientVia: string;
  gradientTo: string;
  accentFrom: string;
  accentTo: string;
}

export const greetings: Record<TimeOfDay, GreetingConfig> = {
  morning: {
    headline: "Rise and Shine, Camper!",
    subheadline: "Start your day with adventure. Find the perfect campsite for your next escape.",
    gradientFrom: "from-amber-500",
    gradientVia: "via-orange-500",
    gradientTo: "to-yellow-500",
    accentFrom: "from-amber-300",
    accentTo: "to-yellow-300",
  },
  afternoon: {
    headline: "Perfect Day for Adventure",
    subheadline: "The sun is high and the trails are calling. Book your outdoor escape today.",
    gradientFrom: "from-emerald-600",
    gradientVia: "via-teal-600",
    gradientTo: "to-cyan-700",
    accentFrom: "from-amber-300",
    accentTo: "to-orange-300",
  },
  evening: {
    headline: "Golden Hour Awaits",
    subheadline: "Chase the sunset to your next campground. The best views come at dusk.",
    gradientFrom: "from-orange-500",
    gradientVia: "via-rose-500",
    gradientTo: "to-purple-600",
    accentFrom: "from-amber-200",
    accentTo: "to-rose-300",
  },
  night: {
    headline: "Plan Tomorrow's Adventure",
    subheadline:
      "Dream under the stars tonight. Book your perfect campsite while the world sleeps.",
    gradientFrom: "from-indigo-700",
    gradientVia: "via-purple-700",
    gradientTo: "to-slate-800",
    accentFrom: "from-blue-300",
    accentTo: "to-purple-300",
  },
};

// Get a greeting with fallback
export function getGreeting(timeOfDay: TimeOfDay): GreetingConfig {
  return greetings[timeOfDay] || greetings.afternoon;
}

// Alternative headlines for variety (can be used for A/B testing or randomization)
export const alternativeHeadlines: Record<TimeOfDay, string[]> = {
  morning: ["Wake Up to Adventure", "Early Bird Gets the Campsite", "Start Fresh, Camp Happy"],
  afternoon: [
    "Sunshine and Campfires Await",
    "Your Next Adventure Starts Now",
    "Find Your Happy Place Outdoors",
  ],
  evening: [
    "Campfire Stories Begin at Dusk",
    "Where Will Tonight Take You?",
    "The Magic Happens at Sunset",
  ],
  night: [
    "Counting Stars, Planning Adventures",
    "Midnight Inspiration Strikes",
    "While You Dream, We Plan",
  ],
};
