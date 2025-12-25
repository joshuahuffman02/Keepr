/**
 * SEO Constants and Configuration
 */

export const SEO_CONFIG = {
  siteName: "Camp Everyday",
  siteUrl: process.env.NEXT_PUBLIC_APP_BASE || "https://campeveryday.com",
  defaultTitle: "Camp Everyday - Find your perfect camping adventure",
  defaultDescription: "Discover and book the best camping spots, RV parks, and glamping experiences. Modern campground management software for operators.",
  twitterHandle: "@campeveryday",
  locale: "en_US",
  themeColor: "#10b981", // emerald-500
  keywords: [
    "campground booking",
    "RV park reservations",
    "camping software",
    "campground management",
    "outdoor hospitality",
    "glamping",
    "cabin rentals",
    "campsite booking",
    "RV resort software",
    "campground POS",
  ],
} as const;

export const getBaseUrl = () => SEO_CONFIG.siteUrl.replace(/\/+$/, "");

/**
 * Static pages for sitemap generation
 */
export const STATIC_PAGES = [
  { path: "/", priority: 1.0, changeFrequency: "daily" as const },
  { path: "/browse", priority: 0.9, changeFrequency: "daily" as const },
  { path: "/developers", priority: 0.7, changeFrequency: "monthly" as const },
  { path: "/careers", priority: 0.6, changeFrequency: "weekly" as const },
  { path: "/case-studies", priority: 0.8, changeFrequency: "weekly" as const },
  { path: "/public-roadmap", priority: 0.5, changeFrequency: "weekly" as const },
  { path: "/signup", priority: 0.9, changeFrequency: "monthly" as const },
] as const;

/**
 * Page-specific SEO configurations
 */
export const PAGE_SEO: Record<string, { title: string; description: string; keywords?: string[] }> = {
  "/": {
    title: "Camp Everyday - Find your perfect camping adventure",
    description: "Search and book campgrounds, RV parks, and cabins. Start your outdoor adventure today with Camp Everyday.",
    keywords: ["camping", "campground booking", "RV parks", "outdoor adventure"],
  },
  "/developers": {
    title: "Developer API - Camp Everyday",
    description: "Integrate with Camp Everyday's REST API. Search campgrounds, manage reservations, and sync availability programmatically.",
    keywords: ["campground API", "reservation API", "developer integration", "REST API"],
  },
  "/careers": {
    title: "Careers - Join Camp Everyday",
    description: "Join our team building the operating system for outdoor hospitality. Remote-first roles in engineering, design, and customer success.",
    keywords: ["campground jobs", "remote jobs", "startup careers", "outdoor hospitality careers"],
  },
  "/case-studies": {
    title: "Case Studies - Camp Everyday Success Stories",
    description: "See how campgrounds use Camp Everyday to boost revenue, streamline operations, and delight guests with real results.",
    keywords: ["campground success stories", "RV park case studies", "hospitality software results"],
  },
  "/public-roadmap": {
    title: "Product Roadmap - Camp Everyday",
    description: "See what we're building next. Transparent product roadmap for Camp Everyday campground management platform.",
    keywords: ["product roadmap", "upcoming features", "campground software updates"],
  },
  "/signup": {
    title: "Get Started - Camp Everyday",
    description: "Start your free trial of Camp Everyday. Modern campground management software with reservations, POS, and guest portal.",
    keywords: ["campground software trial", "RV park management signup", "free campground software"],
  },
};
