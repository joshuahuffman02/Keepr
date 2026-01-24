/**
 * ADA Accessibility Certification System
 * Based on U.S. Access Board ADA/ABA Accessibility Guidelines for camping facilities
 * Reference: https://www.access-board.gov/guidelines-and-standards/
 */

export type AdaCertificationLevel = "none" | "friendly" | "compliant" | "excellence";

export interface AdaChecklistItem {
  id: string;
  category: AdaCategory;
  label: string;
  description: string;
  required: boolean; // Required for "compliant" level
  points: number; // Points toward certification
}

export type AdaCategory =
  | "accessible_sites"
  | "routes_paths"
  | "restrooms"
  | "parking"
  | "site_features"
  | "communication";

export const ADA_CATEGORIES: Record<AdaCategory, { label: string; description: string }> = {
  accessible_sites: {
    label: "Accessible Camping Units",
    description: "Number and features of accessible camping sites",
  },
  routes_paths: {
    label: "Routes & Paths",
    description: "Accessible routes connecting sites to facilities",
  },
  restrooms: {
    label: "Restrooms & Showers",
    description: "Accessible restroom and shower facilities",
  },
  parking: {
    label: "Parking",
    description: "Accessible parking spaces and drop-off areas",
  },
  site_features: {
    label: "Site Features",
    description: "Accessible amenities at camping sites",
  },
  communication: {
    label: "Communication & Signage",
    description: "Accessible information and wayfinding",
  },
};

/**
 * Scoping table based on ADA/ABA guidelines
 * Number of accessible units required based on total units
 */
export const ADA_SCOPING_TABLE: { maxTotal: number; required: number }[] = [
  { maxTotal: 25, required: 2 },
  { maxTotal: 50, required: 3 },
  { maxTotal: 75, required: 4 },
  { maxTotal: 100, required: 5 },
  { maxTotal: 150, required: 7 },
  { maxTotal: 200, required: 8 },
  { maxTotal: 300, required: 10 },
  { maxTotal: 400, required: 12 },
  { maxTotal: 500, required: 14 },
  { maxTotal: 1000, required: 20 },
  { maxTotal: Infinity, required: 20 }, // 20 + 1 per 100 over 1000
];

/**
 * Calculate required accessible units based on total site count
 */
export function getRequiredAccessibleUnits(totalSites: number): number {
  if (totalSites <= 0) return 0;
  if (totalSites > 1000) {
    return 20 + Math.floor((totalSites - 1000) / 100);
  }
  const entry = ADA_SCOPING_TABLE.find((e) => totalSites <= e.maxTotal);
  return entry?.required ?? 2;
}

/**
 * ADA Checklist Items
 * Based on U.S. Access Board requirements for camping facilities
 */
export const ADA_CHECKLIST: AdaChecklistItem[] = [
  // Accessible Sites
  {
    id: "sites_meet_scoping",
    category: "accessible_sites",
    label: "Meet accessible unit scoping requirements",
    description: "Have the required number of accessible camping units based on total site count",
    required: true,
    points: 20,
  },
  {
    id: "sites_dispersed",
    category: "accessible_sites",
    label: "Accessible sites are dispersed",
    description: "Accessible sites offer variety in location, terrain, and amenities",
    required: true,
    points: 10,
  },
  {
    id: "sites_clear_ground",
    category: "accessible_sites",
    label: '60" x 60" clear ground space at sites',
    description: 'Each accessible site has minimum 60" x 60" firm, level ground space',
    required: true,
    points: 15,
  },
  {
    id: "sites_surface",
    category: "accessible_sites",
    label: "Firm, stable, slip-resistant surfaces",
    description: "Ground surfaces are firm, stable, and slip-resistant when wet",
    required: true,
    points: 10,
  },
  {
    id: "sites_slopes",
    category: "accessible_sites",
    label: "Maximum 2% slope in all directions",
    description: "Clear ground space has maximum 2% slope in all directions",
    required: true,
    points: 10,
  },

  // Routes & Paths
  {
    id: "routes_to_sites",
    category: "routes_paths",
    label: "Accessible routes to camping units",
    description:
      "At least one accessible route connects accessible sites to parking and facilities",
    required: true,
    points: 15,
  },
  {
    id: "routes_36_width",
    category: "routes_paths",
    label: '36" minimum clear width',
    description: 'Accessible routes have 36" minimum clear width',
    required: true,
    points: 10,
  },
  {
    id: "routes_running_slope",
    category: "routes_paths",
    label: "Maximum 5% running slope",
    description: "Accessible routes do not exceed 5% running slope (1:20)",
    required: true,
    points: 10,
  },
  {
    id: "routes_cross_slope",
    category: "routes_paths",
    label: "Maximum 2% cross slope",
    description: "Accessible routes do not exceed 2% cross slope",
    required: true,
    points: 5,
  },
  {
    id: "routes_surface",
    category: "routes_paths",
    label: "Route surfaces are stable",
    description: "Route surfaces are firm, stable, and slip-resistant",
    required: true,
    points: 5,
  },

  // Restrooms & Showers
  {
    id: "restrooms_accessible",
    category: "restrooms",
    label: "Accessible restroom facilities",
    description: "At least one restroom building is fully accessible",
    required: true,
    points: 15,
  },
  {
    id: "restrooms_route",
    category: "restrooms",
    label: "Accessible route to restrooms",
    description: "Accessible route connects accessible sites to accessible restrooms",
    required: true,
    points: 10,
  },
  {
    id: "showers_accessible",
    category: "restrooms",
    label: "Accessible shower facilities",
    description: "At least one shower facility is accessible with roll-in or transfer shower",
    required: false,
    points: 10,
  },
  {
    id: "showers_bench",
    category: "restrooms",
    label: "Shower benches provided",
    description: "Accessible showers have folding or permanent shower bench",
    required: false,
    points: 5,
  },

  // Parking
  {
    id: "parking_accessible",
    category: "parking",
    label: "Accessible parking spaces",
    description: "Accessible parking spaces are provided near accessible sites",
    required: true,
    points: 10,
  },
  {
    id: "parking_van",
    category: "parking",
    label: "Van-accessible spaces",
    description: "At least one van-accessible space with 8' minimum aisle",
    required: false,
    points: 5,
  },
  {
    id: "parking_signage",
    category: "parking",
    label: "Parking signage",
    description: "Accessible spaces have proper signage including ISA symbol",
    required: true,
    points: 5,
  },

  // Site Features
  {
    id: "features_table",
    category: "site_features",
    label: "Accessible picnic tables",
    description: "Accessible sites have tables with knee clearance and at accessible height",
    required: true,
    points: 10,
  },
  {
    id: "features_grill",
    category: "site_features",
    label: "Accessible grills/fire rings",
    description: 'Grills and fire rings at accessible sites are at usable height (15"-34")',
    required: false,
    points: 5,
  },
  {
    id: "features_utilities",
    category: "site_features",
    label: "Accessible utility hookups",
    description: 'Utility hookups are reachable from accessible route (15"-48" height)',
    required: false,
    points: 5,
  },
  {
    id: "features_trash",
    category: "site_features",
    label: "Accessible trash receptacles",
    description: "Trash receptacles at accessible sites have accessible openings",
    required: false,
    points: 3,
  },

  // Communication
  {
    id: "comm_signage",
    category: "communication",
    label: "Accessible information signage",
    description: "Information signs use high contrast and readable fonts",
    required: false,
    points: 5,
  },
  {
    id: "comm_wayfinding",
    category: "communication",
    label: "Accessible wayfinding",
    description: "Maps and directional signs are provided at accessible height",
    required: false,
    points: 5,
  },
  {
    id: "comm_reservation",
    category: "communication",
    label: "Accessible reservation system",
    description: "Online reservation system meets WCAG accessibility standards",
    required: false,
    points: 5,
  },
  {
    id: "comm_tty",
    category: "communication",
    label: "TTY/TDD phone service",
    description: "TTY/TDD service or video relay available for reservations",
    required: false,
    points: 3,
  },
];

/**
 * Certification level thresholds
 */
export const CERTIFICATION_THRESHOLDS = {
  friendly: {
    minPoints: 50,
    requiredItemsRatio: 0.3, // 30% of required items
    label: "ADA Friendly",
    description: "This campground has made efforts toward accessibility",
  },
  compliant: {
    minPoints: 120,
    requiredItemsRatio: 0.8, // 80% of required items
    label: "ADA Compliant",
    description: "This campground meets ADA accessibility requirements",
  },
  excellence: {
    minPoints: 180,
    requiredItemsRatio: 1.0, // 100% of required items
    label: "ADA Excellence",
    description: "This campground exceeds ADA requirements with outstanding accessibility",
  },
};

export interface AdaAssessmentData {
  completedItems: string[]; // Array of checklist item IDs
  accessibleSiteCount: number;
  totalSiteCount: number;
  notes?: string;
  lastUpdated?: string;
}

/**
 * Calculate certification level based on assessment data
 */
export function calculateCertificationLevel(assessment: AdaAssessmentData): AdaCertificationLevel {
  const completedSet = new Set(assessment.completedItems);

  // Calculate points
  const totalPoints = ADA_CHECKLIST.filter((item) => completedSet.has(item.id)).reduce(
    (sum, item) => sum + item.points,
    0,
  );

  // Calculate required items completion ratio
  const requiredItems = ADA_CHECKLIST.filter((item) => item.required);
  const completedRequired = requiredItems.filter((item) => completedSet.has(item.id));
  const requiredRatio =
    requiredItems.length > 0 ? completedRequired.length / requiredItems.length : 0;

  // Check scoping requirement
  const requiredAccessibleUnits = getRequiredAccessibleUnits(assessment.totalSiteCount);
  const meetsScoping = assessment.accessibleSiteCount >= requiredAccessibleUnits;

  // Determine level
  if (
    totalPoints >= CERTIFICATION_THRESHOLDS.excellence.minPoints &&
    requiredRatio >= CERTIFICATION_THRESHOLDS.excellence.requiredItemsRatio &&
    meetsScoping
  ) {
    return "excellence";
  }

  if (
    totalPoints >= CERTIFICATION_THRESHOLDS.compliant.minPoints &&
    requiredRatio >= CERTIFICATION_THRESHOLDS.compliant.requiredItemsRatio &&
    meetsScoping
  ) {
    return "compliant";
  }

  if (
    totalPoints >= CERTIFICATION_THRESHOLDS.friendly.minPoints ||
    requiredRatio >= CERTIFICATION_THRESHOLDS.friendly.requiredItemsRatio
  ) {
    return "friendly";
  }

  return "none";
}

/**
 * Get badge display info for a certification level
 */
export function getAdaBadgeInfo(level: AdaCertificationLevel): {
  label: string;
  description: string;
  gradient: string;
  icon: string;
} | null {
  switch (level) {
    case "friendly":
      return {
        label: "ADA Friendly",
        description: CERTIFICATION_THRESHOLDS.friendly.description,
        gradient: "from-blue-500 to-blue-600",
        icon: "accessibility",
      };
    case "compliant":
      return {
        label: "ADA Compliant",
        description: CERTIFICATION_THRESHOLDS.compliant.description,
        gradient: "from-emerald-500 to-teal-500",
        icon: "accessibility",
      };
    case "excellence":
      return {
        label: "ADA Excellence",
        description: CERTIFICATION_THRESHOLDS.excellence.description,
        gradient: "from-amber-400 to-amber-500",
        icon: "accessibility",
      };
    default:
      return null;
  }
}
