/**
 * Campreserv / Keepr - Positioning & Messaging Constants
 *
 * Central source of truth for all marketing messaging, pricing, and positioning.
 * Use these constants across landing pages, comparison pages, and marketing materials.
 */

// =============================================================================
// PRICING MODEL
// =============================================================================

export const PRICING = {
  // Standard pricing (after early access)
  standard: {
    monthlyBase: 100, // $100/month
    perBooking: 2.30, // $2.30 per booking
    aiCreditsIncluded: 5, // $5/month AI credits included
    aiOverageCostMultiplier: 2, // 2x cost for AI usage over included credits
    smsMarkup: 0.15, // 15% markup on SMS costs
  },

  // Expected revenue per customer size
  projectedRevenue: {
    small: { bookingsPerMonth: 150, estimatedMonthly: 445 },   // ~$445/mo
    medium: { bookingsPerMonth: 300, estimatedMonthly: 790 },  // ~$790/mo
    large: { bookingsPerMonth: 500, estimatedMonthly: 1250 },  // ~$1,250/mo
  },

  // Competitor pricing for comparison
  competitors: {
    campspot: {
      perBooking: 3.00,
      marketplaceCommission: 0.10, // 10%
      setupFee: "Unknown (often $$$)",
      hasHiddenFees: true,
    },
    newbook: {
      monthlyBase: 150, // Starting price
      setupFee: { min: 1000, max: 3000 },
      hasHiddenFees: false,
    },
    camplife: {
      pricing: "Undisclosed",
      requiresDemo: true,
    },
  },
} as const;

// =============================================================================
// BRAND POSITIONING
// =============================================================================

export const POSITIONING = {
  // Primary positioning: "The Modern Alternative"
  primary: {
    tagline: "The Modern Alternative to Legacy Campground Software",
    subtitle: "Built for parks that outgrew Campspot",
    targetAudience: "Parks frustrated with legacy software",
    keyMessage: "AI-powered, loyalty programs, staff scheduling included",
  },

  // Alternative positionings (for A/B testing or different contexts)
  allInOne: {
    tagline: "Stop Paying for 5 Different Tools",
    subtitle: "One platform for reservations + POS + payroll + marketing",
    targetAudience: "Parks using fragmented solutions",
    keyMessage: "Everything you need in one place",
  },

  builtForGrowth: {
    tagline: "The Only Software That Scales With You",
    subtitle: "From single park to portfolio management",
    targetAudience: "Parks planning expansion",
    keyMessage: "Multi-property, portfolio analytics, central rate management",
  },
} as const;

// =============================================================================
// HEADLINES & COPY
// =============================================================================

export const HEADLINES = {
  // Primary headlines
  primary: [
    "Everything Campspot has. Plus loyalty, AI, and staff scheduling.",
    "The campground software that pays for itself.",
    "Finally, software that works as hard as you do.",
    "Modern reservation software for modern campgrounds.",
  ],

  // Competitor-specific headlines
  vsCampspot: [
    "Tired of Campspot's 10% Marketplace Commission?",
    "Switch from Campspot. Keep Your Features. Lose the Fees.",
    "Everything Campspot Offers. None of the Hidden Costs.",
  ],

  vsNewbook: [
    "Newbook Features Without the $3,000 Setup Fee",
    "Complex Features. Simple Pricing. Zero Setup Costs.",
  ],

  // Feature-specific headlines
  ai: [
    "AI That Actually Reduces No-Shows",
    "Predict Demand. Optimize Pricing. Automatically.",
  ],

  loyalty: [
    "Turn One-Time Guests Into Lifetime Campers",
    "The Loyalty Program Your Competitors Don't Have",
  ],

  staffScheduling: [
    "Finally, Staff Scheduling That Syncs With Reservations",
    "Stop Using Spreadsheets for Staff Schedules",
  ],
} as const;

// =============================================================================
// KEY DIFFERENTIATORS
// =============================================================================

export const DIFFERENTIATORS = {
  // Features NO competitor has
  exclusive: [
    {
      feature: "Loyalty & Gamification",
      description: "XP system, leveling, rewards - drive repeat bookings",
      competitorStatus: "No competitor offers this",
    },
    {
      feature: "Staff Scheduling + Payroll",
      description: "Integrated with reservations and time tracking",
      competitorStatus: "No competitor offers this",
    },
    {
      feature: "AI Demand Forecasting",
      description: "Predict busy periods and optimize pricing automatically",
      competitorStatus: "No competitor offers this",
    },
    {
      feature: "AI No-Show Detection",
      description: "Identify high-risk reservations before they cancel",
      competitorStatus: "No competitor offers this",
    },
  ],

  // Better than competitors
  advantages: [
    {
      feature: "0% Marketplace Commission",
      us: "0%",
      campspot: "10%",
      impact: "Keep more revenue from every booking",
    },
    {
      feature: "Transparent Pricing",
      us: "$100/mo + $2.30/booking",
      campspot: "Varies + hidden fees",
      impact: "Know exactly what you'll pay",
    },
    {
      feature: "Setup Fee",
      us: "$0",
      newbook: "$1,000-$3,000",
      impact: "Start without upfront investment",
    },
    {
      feature: "Go Live Time",
      us: "48 hours",
      competitors: "Weeks to months",
      impact: "Start taking bookings immediately",
    },
  ],
} as const;

// =============================================================================
// PROOF POINTS & SOCIAL PROOF
// =============================================================================

export const PROOF_POINTS = {
  // Platform capabilities
  stats: {
    databaseModels: 550,
    apiServices: 170,
    frontendPages: 307,
    siteTypes: ["RV", "Tent", "Cabin", "Glamping", "Yurt", "Treehouse"],
  },

  // Trust elements
  trust: [
    "30-day money-back guarantee",
    "No contracts - cancel anytime",
    "Free data migration from any system",
    "Go live in 48 hours, not weeks",
  ],

  // Testimonial templates (for case studies once we have customers)
  testimonialTemplates: [
    {
      metric: "no-show reduction",
      template: "reduced no-shows by X% with AI predictions",
    },
    {
      metric: "time saved",
      template: "saved X hours/week with automation",
    },
    {
      metric: "revenue increase",
      template: "increased revenue X% with dynamic pricing",
    },
  ],
} as const;

// =============================================================================
// COMPETITOR PAIN POINTS
// =============================================================================

export const COMPETITOR_PAIN_POINTS = {
  campspot: [
    "10% marketplace commission eats into profits",
    "Slow/inconsistent support during peak seasons",
    "No workflow automation",
    "Unpredictable pricing - cost transparency issues",
    "Their branding forced on booking engine",
    "Fewer than 10 integrations",
    "No loyalty programs",
    "No recurring billing",
    "No 24/7 support",
    "Struggles with multi-location scaling",
  ],

  newbook: [
    "$1,000-$3,000 setup fee barrier",
    "Complex/unintuitive platform",
    "Longer onboarding required",
    "Only SiteMinder for channel management",
    "Steep learning curve",
  ],

  camplife: [
    "Lacks advanced features for larger operations",
    "Limited integrations",
    "No multi-property support",
    "Opaque pricing requires demo",
  ],
} as const;

// =============================================================================
// FEATURE COMPARISON DATA
// =============================================================================

export const FEATURE_COMPARISON = {
  categories: [
    {
      name: "Reservations",
      features: [
        { name: "Online booking engine", us: true, campspot: true, newbook: true, camplife: true },
        { name: "Group bookings", us: true, campspot: true, newbook: true, camplife: "Limited" },
        { name: "Waitlist management", us: true, campspot: false, newbook: false, camplife: false },
        { name: "Reservation segments", us: true, campspot: false, newbook: "Limited", camplife: false },
      ],
    },
    {
      name: "Payments",
      features: [
        { name: "Stripe integration", us: true, campspot: true, newbook: true, camplife: true },
        { name: "Gift cards", us: true, campspot: true, newbook: false, camplife: false },
        { name: "Stored value/wallets", us: true, campspot: false, newbook: false, camplife: false },
        { name: "Double-entry ledger", us: true, campspot: false, newbook: false, camplife: false },
        { name: "Charity round-up", us: true, campspot: false, newbook: false, camplife: false },
      ],
    },
    {
      name: "AI & Analytics",
      features: [
        { name: "AI demand forecasting", us: true, campspot: false, newbook: false, camplife: false },
        { name: "AI pricing recommendations", us: true, campspot: false, newbook: false, camplife: false },
        { name: "AI no-show detection", us: true, campspot: false, newbook: false, camplife: false },
        { name: "A/B testing framework", us: true, campspot: false, newbook: false, camplife: false },
        { name: "Anomaly detection", us: true, campspot: false, newbook: false, camplife: false },
      ],
    },
    {
      name: "Operations",
      features: [
        { name: "Staff scheduling", us: true, campspot: false, newbook: false, camplife: false },
        { name: "Payroll integration", us: true, campspot: false, newbook: false, camplife: false },
        { name: "Time tracking", us: true, campspot: false, newbook: false, camplife: false },
        { name: "Housekeeping management", us: true, campspot: true, newbook: true, camplife: true },
        { name: "Maintenance tickets", us: true, campspot: true, newbook: true, camplife: true },
      ],
    },
    {
      name: "Guest Experience",
      features: [
        { name: "Loyalty/gamification", us: true, campspot: false, newbook: false, camplife: false },
        { name: "XP/leveling system", us: true, campspot: false, newbook: false, camplife: false },
        { name: "Guest portal (self-serve)", us: true, campspot: "Limited", newbook: true, camplife: "Limited" },
        { name: "2-way SMS", us: true, campspot: false, newbook: true, camplife: false },
        { name: "Push notifications", us: true, campspot: false, newbook: false, camplife: false },
      ],
    },
  ],
} as const;

// =============================================================================
// SEO KEYWORDS
// =============================================================================

export const SEO_KEYWORDS = {
  primary: [
    "campground management software",
    "rv park reservation system",
    "campground booking software",
    "campground reservation software",
  ],

  comparison: [
    "campspot alternative",
    "campspot vs",
    "newbook alternative",
    "camplife alternative",
    "best campground software",
  ],

  longTail: [
    "campground software with loyalty program",
    "rv park software with staff scheduling",
    "campground software with ai pricing",
    "modern campground management system",
  ],
} as const;

// =============================================================================
// CTA COPY
// =============================================================================

export const CTA_COPY = {
  primary: {
    button: "Start Free Trial",
    subtext: "No credit card required. Go live in 48 hours.",
  },

  demo: {
    button: "Try Live Demo",
    subtext: "Explore with real data. No signup needed.",
  },

  comparison: {
    button: "See Full Comparison",
    subtext: "Feature-by-feature breakdown vs competitors.",
  },

  urgent: {
    button: "Claim Your Spot",
    subtext: "Early access pricing ends soon.",
  },

  switch: {
    button: "Switch in 48 Hours",
    subtext: "Free migration from Campspot, Newbook, or any system.",
  },
} as const;

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Calculate estimated monthly revenue for a park based on bookings
 */
export function calculateMonthlyRevenue(bookingsPerMonth: number): number {
  return PRICING.standard.monthlyBase + (bookingsPerMonth * PRICING.standard.perBooking);
}

/**
 * Format price for display
 */
export function formatPrice(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

/**
 * Get competitor pain points for a specific competitor
 */
export function getCompetitorPainPoints(competitor: keyof typeof COMPETITOR_PAIN_POINTS): readonly string[] {
  return COMPETITOR_PAIN_POINTS[competitor];
}
