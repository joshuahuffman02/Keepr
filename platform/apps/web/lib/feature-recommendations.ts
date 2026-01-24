/**
 * Feature Recommendations System
 *
 * This module defines:
 * 1. Setupable features - features that need configuration during onboarding
 * 2. Feature bundles - groups of related features triggered by quiz answers
 * 3. Dependency graph - which features should be set up before others
 * 4. Recommendation algorithm - maps quiz answers to feature recommendations
 */

import type { PageCategory } from "./page-registry";

// ============================================
// Quiz Types
// ============================================

export type ParkType =
  | "small_rv" // 1-30 sites
  | "medium_rv" // 31-100 sites
  | "large_rv" // 100+ sites
  | "tent" // Tent/primitive campground
  | "mixed" // RV + Cabins/Glamping
  | "cabin_glamping" // Cabins/Glamping only
  | "seasonal" // Seasonal/long-term community
  | "mobile"; // Mobile home/RV community

export type OperationType =
  | "reservations"
  | "seasonals"
  | "store"
  | "utilities"
  | "activities"
  | "housekeeping"
  | "groups"
  | "marketing";

export type TeamSize = "solo" | "small_team" | "medium_team" | "large_team";

export type AmenityType =
  | "recreation"
  | "camp_store"
  | "laundry"
  | "event_space"
  | "food_service"
  | "wifi"
  | "dump_station"
  | "water_access";

export type TechLevel = "tech_savvy" | "basic" | "mixed";

export interface QuizAnswers {
  parkType: ParkType;
  operations: OperationType[];
  teamSize: TeamSize;
  amenities: AmenityType[];
  techLevel?: TechLevel;
}

// ============================================
// Setupable Feature Definition
// ============================================

export interface SetupableFeature {
  key: string;
  label: string;
  description: string;
  category: PageCategory;
  estimatedMinutes: number;
  setupPath: string; // URL to navigate for setup
  icon: string;
  dependencies: string[]; // Feature keys that should be set up first
  // Criteria for when to recommend this feature
  recommendedFor?: {
    parkTypes?: ParkType[];
    operations?: OperationType[];
    teamSizeMin?: TeamSize;
    amenities?: AmenityType[];
    techLevels?: TechLevel[];
  };
}

// ============================================
// Setupable Features (50 key features)
// ============================================

export const SETUPABLE_FEATURES: SetupableFeature[] = [
  // ============================================
  // ESSENTIAL CORE (always recommended)
  // ============================================
  {
    key: "seasonal_rates",
    label: "Seasonal Rates",
    description: "Configure peak, off-peak, and holiday pricing periods",
    category: "settings",
    estimatedMinutes: 10,
    setupPath: "/dashboard/settings/seasonal-rates",
    icon: "calendar",
    dependencies: [],
    recommendedFor: {},
  },
  {
    key: "tax_rules",
    label: "Tax Rules",
    description: "Set up lodging taxes and local taxes",
    category: "settings",
    estimatedMinutes: 5,
    setupPath: "/dashboard/settings/taxes",
    icon: "percent",
    dependencies: [],
    recommendedFor: {},
  },
  {
    key: "cancellation_policy",
    label: "Cancellation Policy",
    description: "Define your refund and cancellation rules",
    category: "settings",
    estimatedMinutes: 5,
    setupPath: "/dashboard/settings/policies",
    icon: "policy",
    dependencies: [],
    recommendedFor: {},
  },
  {
    key: "deposit_policy",
    label: "Deposit Policy",
    description: "Configure payment collection rules",
    category: "settings",
    estimatedMinutes: 5,
    setupPath: "/dashboard/settings/deposits",
    icon: "payments",
    dependencies: [],
    recommendedFor: {},
  },

  // ============================================
  // TEAM & ACCESS
  // ============================================
  {
    key: "team_members",
    label: "Team Members",
    description: "Invite staff and assign roles",
    category: "settings",
    estimatedMinutes: 10,
    setupPath: "/dashboard/settings/users",
    icon: "users",
    dependencies: [],
    recommendedFor: {
      teamSizeMin: "small_team",
    },
  },
  {
    key: "staff_scheduling",
    label: "Staff Scheduling",
    description: "Create shifts and schedules for your team",
    category: "staff",
    estimatedMinutes: 15,
    setupPath: "/campgrounds/[campgroundId]/staff-scheduling",
    icon: "calendar",
    dependencies: ["team_members"],
    recommendedFor: {
      teamSizeMin: "medium_team",
    },
  },
  {
    key: "time_clock",
    label: "Time Clock",
    description: "Set up punch-in/out for staff",
    category: "staff",
    estimatedMinutes: 5,
    setupPath: "/campgrounds/[campgroundId]/staff/timeclock",
    icon: "clock",
    dependencies: ["team_members"],
    recommendedFor: {
      teamSizeMin: "medium_team",
    },
  },

  // ============================================
  // STORE & POS
  // ============================================
  {
    key: "store_products",
    label: "Store Products",
    description: "Add products to your camp store",
    category: "store",
    estimatedMinutes: 20,
    setupPath: "/store/inventory",
    icon: "shopping",
    dependencies: [],
    recommendedFor: {
      operations: ["store"],
      amenities: ["camp_store"],
    },
  },
  {
    key: "pos_setup",
    label: "Point of Sale Setup",
    description: "Configure your POS terminal and settings",
    category: "store",
    estimatedMinutes: 10,
    setupPath: "/dashboard/settings/pos-integrations",
    icon: "payments",
    dependencies: ["store_products"],
    recommendedFor: {
      operations: ["store"],
      amenities: ["camp_store"],
    },
  },
  {
    key: "store_categories",
    label: "Product Categories",
    description: "Organize products into categories",
    category: "store",
    estimatedMinutes: 5,
    setupPath: "/store/categories",
    icon: "folder",
    dependencies: [],
    recommendedFor: {
      operations: ["store"],
      amenities: ["camp_store"],
    },
  },

  // ============================================
  // HOUSEKEEPING
  // ============================================
  {
    key: "housekeeping",
    label: "Housekeeping",
    description: "Set up cleaning schedules and tasks",
    category: "operations",
    estimatedMinutes: 10,
    setupPath: "/campgrounds/[campgroundId]/housekeeping",
    icon: "sparkles",
    dependencies: [],
    recommendedFor: {
      parkTypes: ["cabin_glamping", "mixed", "large_rv"],
      operations: ["housekeeping"],
    },
  },
  {
    key: "cleaning_zones",
    label: "Cleaning Zones",
    description: "Define areas for housekeeping assignments",
    category: "operations",
    estimatedMinutes: 5,
    setupPath: "/campgrounds/[campgroundId]/housekeeping/zones",
    icon: "map",
    dependencies: ["housekeeping"],
    recommendedFor: {
      parkTypes: ["cabin_glamping", "mixed", "large_rv"],
      operations: ["housekeeping"],
    },
  },

  // ============================================
  // ACTIVITIES & EVENTS
  // ============================================
  {
    key: "activities",
    label: "Activities",
    description: "Set up park activities and amenity rentals",
    category: "operations",
    estimatedMinutes: 15,
    setupPath: "/activities",
    icon: "sparkles",
    dependencies: [],
    recommendedFor: {
      operations: ["activities"],
      amenities: ["recreation", "event_space", "water_access"],
    },
  },
  {
    key: "events",
    label: "Events",
    description: "Schedule recurring or one-time events",
    category: "operations",
    estimatedMinutes: 10,
    setupPath: "/events",
    icon: "calendar",
    dependencies: [],
    recommendedFor: {
      operations: ["activities"],
      amenities: ["event_space"],
    },
  },

  // ============================================
  // GROUPS
  // ============================================
  {
    key: "group_bookings",
    label: "Group Bookings",
    description: "Configure group reservation settings",
    category: "operations",
    estimatedMinutes: 10,
    setupPath: "/groups",
    icon: "users",
    dependencies: [],
    recommendedFor: {
      operations: ["groups"],
      parkTypes: ["medium_rv", "large_rv"],
    },
  },

  // ============================================
  // SEASONAL & LONG-TERM
  // ============================================
  {
    key: "seasonal_rates_cards",
    label: "Seasonal Rate Cards",
    description: "Set up monthly rates for long-term guests",
    category: "settings",
    estimatedMinutes: 15,
    setupPath: "/campgrounds/[campgroundId]/seasonals/rate-cards",
    icon: "pricing",
    dependencies: [],
    recommendedFor: {
      parkTypes: ["seasonal", "mobile"],
      operations: ["seasonals"],
    },
  },
  {
    key: "utilities_billing",
    label: "Utilities Billing",
    description: "Configure metered utility billing",
    category: "finance",
    estimatedMinutes: 15,
    setupPath: "/campgrounds/[campgroundId]/utilities-billing",
    icon: "pricing",
    dependencies: [],
    recommendedFor: {
      parkTypes: ["seasonal", "mobile"],
      operations: ["utilities"],
    },
  },
  {
    key: "repeat_charges",
    label: "Repeat Charges",
    description: "Set up recurring billing for seasonals",
    category: "finance",
    estimatedMinutes: 10,
    setupPath: "/billing/repeat-charges",
    icon: "clock",
    dependencies: [],
    recommendedFor: {
      parkTypes: ["seasonal", "mobile"],
      operations: ["seasonals"],
    },
  },

  // ============================================
  // MARKETING
  // ============================================
  {
    key: "promotions",
    label: "Promotions & Discounts",
    description: "Create coupon codes and special offers",
    category: "marketing",
    estimatedMinutes: 10,
    setupPath: "/dashboard/settings/promotions",
    icon: "tag",
    dependencies: ["seasonal_rates"],
    recommendedFor: {
      operations: ["marketing"],
    },
  },
  {
    key: "email_templates",
    label: "Email Templates",
    description: "Customize confirmation and reminder emails",
    category: "settings",
    estimatedMinutes: 15,
    setupPath: "/dashboard/settings/communications",
    icon: "message",
    dependencies: [],
    recommendedFor: {},
  },
  {
    key: "email_campaigns",
    label: "Email Campaigns",
    description: "Set up marketing email campaigns",
    category: "marketing",
    estimatedMinutes: 15,
    setupPath: "/dashboard/settings/campaigns",
    icon: "message",
    dependencies: ["email_templates"],
    recommendedFor: {
      operations: ["marketing"],
      teamSizeMin: "small_team",
    },
  },
  {
    key: "social_planner",
    label: "Social Media Planner",
    description: "Schedule and manage social media posts",
    category: "marketing",
    estimatedMinutes: 10,
    setupPath: "/social-planner",
    icon: "social",
    dependencies: [],
    recommendedFor: {
      operations: ["marketing"],
      techLevels: ["tech_savvy", "mixed"],
    },
  },
  {
    key: "referrals",
    label: "Referral Program",
    description: "Set up guest referral rewards",
    category: "marketing",
    estimatedMinutes: 10,
    setupPath: "/campgrounds/[campgroundId]/marketing/referrals",
    icon: "users",
    dependencies: [],
    recommendedFor: {
      operations: ["marketing"],
      parkTypes: ["medium_rv", "large_rv"],
    },
  },

  // ============================================
  // GUEST EXPERIENCE
  // ============================================
  {
    key: "waivers",
    label: "Digital Waivers",
    description: "Set up liability waivers for guests to sign",
    category: "settings",
    estimatedMinutes: 10,
    setupPath: "/campgrounds/[campgroundId]/waivers",
    icon: "document",
    dependencies: [],
    recommendedFor: {
      operations: ["activities"],
      amenities: ["recreation", "water_access"],
    },
  },
  {
    key: "park_rules",
    label: "Park Rules",
    description: "Define and publish your park policies",
    category: "settings",
    estimatedMinutes: 10,
    setupPath: "/dashboard/settings/policies",
    icon: "policy",
    dependencies: [],
    recommendedFor: {},
  },
  {
    key: "guest_portal",
    label: "Guest Portal",
    description: "Configure the guest self-service portal",
    category: "guests",
    estimatedMinutes: 10,
    setupPath: "/guests/portal-settings",
    icon: "guest",
    dependencies: [],
    recommendedFor: {
      techLevels: ["tech_savvy", "mixed"],
    },
  },
  {
    key: "online_booking",
    label: "Online Booking Page",
    description: "Customize your public booking page",
    category: "settings",
    estimatedMinutes: 10,
    setupPath: "/dashboard/settings/booking-page",
    icon: "globe",
    dependencies: [],
    recommendedFor: {},
  },
  {
    key: "faqs",
    label: "FAQs",
    description: "Add frequently asked questions to your page",
    category: "settings",
    estimatedMinutes: 10,
    setupPath: "/dashboard/settings/faqs",
    icon: "info",
    dependencies: [],
    recommendedFor: {},
  },

  // ============================================
  // COMMUNICATIONS
  // ============================================
  {
    key: "sms_setup",
    label: "SMS Notifications",
    description: "Enable text message notifications",
    category: "settings",
    estimatedMinutes: 10,
    setupPath: "/dashboard/settings/communications",
    icon: "message",
    dependencies: [],
    recommendedFor: {
      techLevels: ["tech_savvy", "mixed"],
    },
  },
  {
    key: "notification_triggers",
    label: "Notification Triggers",
    description: "Configure automated notifications",
    category: "settings",
    estimatedMinutes: 15,
    setupPath: "/dashboard/settings/notification-triggers",
    icon: "bell",
    dependencies: ["email_templates"],
    recommendedFor: {
      teamSizeMin: "small_team",
    },
  },

  // ============================================
  // INTEGRATIONS
  // ============================================
  {
    key: "integrations",
    label: "Integrations",
    description: "Connect third-party tools and services",
    category: "settings",
    estimatedMinutes: 15,
    setupPath: "/dashboard/settings/integrations",
    icon: "link",
    dependencies: [],
    recommendedFor: {
      techLevels: ["tech_savvy"],
      teamSizeMin: "small_team",
    },
  },
  {
    key: "ota_channels",
    label: "OTA Channels",
    description: "Connect to Airbnb, Booking.com, etc.",
    category: "settings",
    estimatedMinutes: 20,
    setupPath: "/dashboard/settings/ota",
    icon: "globe",
    dependencies: [],
    recommendedFor: {
      parkTypes: ["cabin_glamping", "mixed"],
      techLevels: ["tech_savvy"],
    },
  },

  // ============================================
  // AI FEATURES
  // ============================================
  {
    key: "ai_setup",
    label: "AI Features",
    description: "Enable AI-powered assistance",
    category: "settings",
    estimatedMinutes: 5,
    setupPath: "/ai",
    icon: "sparkles",
    dependencies: [],
    recommendedFor: {
      techLevels: ["tech_savvy"],
      parkTypes: ["medium_rv", "large_rv"],
    },
  },
  {
    key: "dynamic_pricing",
    label: "Dynamic Pricing",
    description: "Set up AI-powered demand-based pricing",
    category: "settings",
    estimatedMinutes: 15,
    setupPath: "/campgrounds/[campgroundId]/dynamic-pricing",
    icon: "pricing",
    dependencies: ["ai_setup", "seasonal_rates"],
    recommendedFor: {
      techLevels: ["tech_savvy"],
      parkTypes: ["medium_rv", "large_rv"],
    },
  },

  // ============================================
  // REPORTS & ANALYTICS
  // ============================================
  {
    key: "reports_setup",
    label: "Reports Setup",
    description: "Configure your reporting preferences",
    category: "reports",
    estimatedMinutes: 5,
    setupPath: "/reports",
    icon: "reports",
    dependencies: [],
    recommendedFor: {
      teamSizeMin: "small_team",
    },
  },
  {
    key: "gamification",
    label: "Staff Gamification",
    description: "Set up XP, badges, and leaderboards for staff",
    category: "staff",
    estimatedMinutes: 10,
    setupPath: "/gamification",
    icon: "trophy",
    dependencies: ["team_members"],
    recommendedFor: {
      teamSizeMin: "medium_team",
    },
  },

  // ============================================
  // BRANDING
  // ============================================
  {
    key: "branding",
    label: "Branding",
    description: "Customize colors, logo, and fonts",
    category: "settings",
    estimatedMinutes: 10,
    setupPath: "/dashboard/settings/branding",
    icon: "palette",
    dependencies: [],
    recommendedFor: {},
  },
  {
    key: "photos",
    label: "Park Photos",
    description: "Upload photos of your campground",
    category: "settings",
    estimatedMinutes: 15,
    setupPath: "/dashboard/settings/photos",
    icon: "camera",
    dependencies: [],
    recommendedFor: {},
  },

  // ============================================
  // UPSELLS & ADD-ONS
  // ============================================
  {
    key: "upsells",
    label: "Upsells & Add-ons",
    description: "Configure booking add-ons and extras",
    category: "settings",
    estimatedMinutes: 15,
    setupPath: "/dashboard/settings/upsells",
    icon: "plus",
    dependencies: [],
    recommendedFor: {},
  },
  {
    key: "fees_setup",
    label: "Booking Fees",
    description: "Set up pet fees, extra guest fees, etc.",
    category: "settings",
    estimatedMinutes: 10,
    setupPath: "/dashboard/settings/fees",
    icon: "pricing",
    dependencies: [],
    recommendedFor: {},
  },

  // ============================================
  // FINANCE EXTRAS
  // ============================================
  {
    key: "gift_cards",
    label: "Gift Cards",
    description: "Set up gift card sales and redemption",
    category: "finance",
    estimatedMinutes: 10,
    setupPath: "/gift-cards",
    icon: "tag",
    dependencies: [],
    recommendedFor: {
      operations: ["store"],
    },
  },
  {
    key: "charity_roundup",
    label: "Charity Round-Up",
    description: "Enable donation round-up at checkout",
    category: "finance",
    estimatedMinutes: 5,
    setupPath: "/dashboard/settings/charity",
    icon: "heart",
    dependencies: [],
    recommendedFor: {},
  },
];

// ============================================
// Feature Bundles (triggered by quiz answers)
// ============================================

export interface FeatureBundle {
  id: string;
  name: string;
  description: string;
  features: string[]; // Feature keys
  triggers: {
    parkTypes?: ParkType[];
    operations?: OperationType[];
    teamSizeMin?: TeamSize;
    amenities?: AmenityType[];
    techLevels?: TechLevel[];
  };
  priority: "essential" | "recommended" | "optional";
}

const TEAM_SIZE_ORDER: TeamSize[] = ["solo", "small_team", "medium_team", "large_team"];

function teamSizeGte(current: TeamSize, min: TeamSize): boolean {
  return TEAM_SIZE_ORDER.indexOf(current) >= TEAM_SIZE_ORDER.indexOf(min);
}

export const FEATURE_BUNDLES: FeatureBundle[] = [
  // Essential bundles (almost always recommended)
  {
    id: "core_settings",
    name: "Core Settings",
    description: "Essential settings every park needs",
    features: [
      "seasonal_rates",
      "tax_rules",
      "cancellation_policy",
      "deposit_policy",
      "email_templates",
      "park_rules",
      "branding",
      "online_booking",
    ],
    triggers: {},
    priority: "essential",
  },

  // Operation-based bundles
  {
    id: "store_pos",
    name: "Store & POS",
    description: "Camp store and point of sale features",
    features: ["store_products", "store_categories", "pos_setup", "gift_cards"],
    triggers: {
      operations: ["store"],
      amenities: ["camp_store"],
    },
    priority: "recommended",
  },
  {
    id: "housekeeping_ops",
    name: "Housekeeping",
    description: "Cleaning and turnover management",
    features: ["housekeeping", "cleaning_zones"],
    triggers: {
      operations: ["housekeeping"],
      parkTypes: ["cabin_glamping", "mixed"],
    },
    priority: "recommended",
  },
  {
    id: "activities_events",
    name: "Activities & Events",
    description: "Park activities and event management",
    features: ["activities", "events", "waivers"],
    triggers: {
      operations: ["activities"],
      amenities: ["recreation", "event_space", "water_access"],
    },
    priority: "recommended",
  },
  {
    id: "groups",
    name: "Group Bookings",
    description: "Manage rallies and group reservations",
    features: ["group_bookings"],
    triggers: {
      operations: ["groups"],
    },
    priority: "recommended",
  },
  {
    id: "seasonal_longterm",
    name: "Seasonal & Long-term",
    description: "Monthly guests and utilities billing",
    features: ["seasonal_rates_cards", "utilities_billing", "repeat_charges"],
    triggers: {
      operations: ["seasonals", "utilities"],
      parkTypes: ["seasonal", "mobile"],
    },
    priority: "recommended",
  },
  {
    id: "marketing_suite",
    name: "Marketing",
    description: "Promotions, campaigns, and social media",
    features: ["promotions", "email_campaigns", "social_planner", "referrals"],
    triggers: {
      operations: ["marketing"],
    },
    priority: "recommended",
  },

  // Team-based bundles
  {
    id: "team_management",
    name: "Team Management",
    description: "Staff scheduling and management",
    features: ["team_members", "staff_scheduling", "time_clock", "gamification"],
    triggers: {
      teamSizeMin: "medium_team",
    },
    priority: "recommended",
  },
  {
    id: "basic_team",
    name: "Basic Team Setup",
    description: "Essential team features for small teams",
    features: ["team_members"],
    triggers: {
      teamSizeMin: "small_team",
    },
    priority: "essential",
  },

  // Tech-savvy bundles
  {
    id: "ai_features",
    name: "AI Features",
    description: "AI-powered assistance and pricing",
    features: ["ai_setup", "dynamic_pricing"],
    triggers: {
      techLevels: ["tech_savvy"],
      parkTypes: ["medium_rv", "large_rv"],
    },
    priority: "optional",
  },
  {
    id: "integrations_advanced",
    name: "Integrations",
    description: "Third-party connections and OTAs",
    features: ["integrations", "ota_channels"],
    triggers: {
      techLevels: ["tech_savvy"],
    },
    priority: "optional",
  },

  // Guest experience bundles
  {
    id: "guest_experience",
    name: "Guest Experience",
    description: "Enhance the guest journey",
    features: ["guest_portal", "sms_setup", "faqs", "photos"],
    triggers: {},
    priority: "recommended",
  },

  // Finance extras
  {
    id: "upsells_extras",
    name: "Upsells & Add-ons",
    description: "Increase revenue with extras",
    features: ["upsells", "fees_setup"],
    triggers: {},
    priority: "recommended",
  },

  // Automation
  {
    id: "automation",
    name: "Automation",
    description: "Automated notifications and triggers",
    features: ["notification_triggers"],
    triggers: {
      teamSizeMin: "small_team",
    },
    priority: "optional",
  },

  // Reports
  {
    id: "reports_analytics",
    name: "Reports & Analytics",
    description: "Business insights and reporting",
    features: ["reports_setup"],
    triggers: {
      teamSizeMin: "small_team",
    },
    priority: "recommended",
  },
];

// ============================================
// Recommendation Algorithm
// ============================================

export interface FeatureRecommendations {
  setupNow: string[]; // Feature keys to setup during onboarding
  setupLater: string[]; // Feature keys to add to queue
  skipped: string[]; // Feature keys not recommended
}

/**
 * Calculate feature recommendations based on quiz answers
 */
export function getRecommendedFeatures(answers: QuizAnswers): FeatureRecommendations {
  const setupNow = new Set<string>();
  const setupLater = new Set<string>();

  // Score each bundle
  for (const bundle of FEATURE_BUNDLES) {
    const score = calculateBundleScore(bundle, answers);

    if (score >= 0.5) {
      // Good match
      const targetSet = bundle.priority === "essential" ? setupNow : setupLater;

      for (const featureKey of bundle.features) {
        // Essential bundles with high scores go to "now"
        // Recommended bundles with high scores go to "later" by default
        if (bundle.priority === "essential" || score >= 0.8) {
          setupNow.add(featureKey);
        } else {
          targetSet.add(featureKey);
        }
      }
    } else if (score >= 0.3 && bundle.priority !== "optional") {
      // Partial match - suggest for later
      for (const featureKey of bundle.features) {
        setupLater.add(featureKey);
      }
    }
  }

  // Remove duplicates (setupNow takes precedence)
  for (const key of setupNow) {
    setupLater.delete(key);
  }

  // Get all feature keys
  const allFeatureKeys = new Set(SETUPABLE_FEATURES.map((f) => f.key));
  const categorized = new Set([...setupNow, ...setupLater]);
  const skipped = [...allFeatureKeys].filter((key) => !categorized.has(key));

  return {
    setupNow: [...setupNow],
    setupLater: [...setupLater],
    skipped,
  };
}

/**
 * Calculate how well a bundle matches the quiz answers (0-1)
 */
function calculateBundleScore(bundle: FeatureBundle, answers: QuizAnswers): number {
  const { triggers } = bundle;
  let totalCriteria = 0;
  let matchedCriteria = 0;

  // Check park type match
  if (triggers.parkTypes && triggers.parkTypes.length > 0) {
    totalCriteria++;
    if (triggers.parkTypes.includes(answers.parkType)) {
      matchedCriteria++;
    }
  }

  // Check operations match (any match counts)
  if (triggers.operations && triggers.operations.length > 0) {
    totalCriteria++;
    const hasMatch = triggers.operations.some((op) => answers.operations.includes(op));
    if (hasMatch) {
      matchedCriteria++;
    }
  }

  // Check team size (must meet minimum)
  if (triggers.teamSizeMin) {
    totalCriteria++;
    if (teamSizeGte(answers.teamSize, triggers.teamSizeMin)) {
      matchedCriteria++;
    }
  }

  // Check amenities match (any match counts)
  if (triggers.amenities && triggers.amenities.length > 0) {
    totalCriteria++;
    const hasMatch = triggers.amenities.some((am) => answers.amenities.includes(am));
    if (hasMatch) {
      matchedCriteria++;
    }
  }

  // Check tech level match
  if (triggers.techLevels && triggers.techLevels.length > 0 && answers.techLevel) {
    totalCriteria++;
    if (triggers.techLevels.includes(answers.techLevel)) {
      matchedCriteria++;
    }
  }

  // No criteria = essential bundle, always matches
  if (totalCriteria === 0) {
    return 1;
  }

  return matchedCriteria / totalCriteria;
}

// ============================================
// Dependency Ordering (Topological Sort)
// ============================================

/**
 * Order features by dependencies (topological sort)
 * Features with no dependencies come first
 */
export function getOrderedFeatures(selectedKeys: string[]): SetupableFeature[] {
  const features = SETUPABLE_FEATURES.filter((f) => selectedKeys.includes(f.key));
  const ordered: SetupableFeature[] = [];
  const visited = new Set<string>();
  const visiting = new Set<string>(); // For cycle detection

  function visit(feature: SetupableFeature): void {
    if (visited.has(feature.key)) return;
    if (visiting.has(feature.key)) {
      // Cycle detected - just skip (shouldn't happen with well-defined deps)
      return;
    }

    visiting.add(feature.key);

    // Visit dependencies first
    for (const depKey of feature.dependencies) {
      const dep = features.find((f) => f.key === depKey);
      if (dep) {
        visit(dep);
      }
    }

    visiting.delete(feature.key);
    visited.add(feature.key);
    ordered.push(feature);
  }

  // Visit all features
  for (const feature of features) {
    visit(feature);
  }

  return ordered;
}

/**
 * Get a single feature by key
 */
export function getFeatureByKey(key: string): SetupableFeature | undefined {
  return SETUPABLE_FEATURES.find((f) => f.key === key);
}

/**
 * Get all features in a category
 */
export function getFeaturesByCategory(category: PageCategory): SetupableFeature[] {
  return SETUPABLE_FEATURES.filter((f) => f.category === category);
}

/**
 * Calculate total estimated time for a set of features
 */
export function getTotalEstimatedMinutes(featureKeys: string[]): number {
  return featureKeys.reduce((total, key) => {
    const feature = getFeatureByKey(key);
    return total + (feature?.estimatedMinutes || 0);
  }, 0);
}
