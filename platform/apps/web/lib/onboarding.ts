export type OnboardingStepKey =
  | "park_profile"
  | "operational_hours"
  | "stripe_connect"
  | "inventory_choice"
  | "data_import"
  | "site_classes"
  | "sites_builder"
  | "rate_periods"
  | "rates_setup"
  | "fees_and_addons"
  | "tax_rules"
  | "booking_rules"
  | "deposit_policy"
  | "cancellation_rules"
  | "waivers_documents"
  | "park_rules"
  | "team_setup"
  | "communication_setup"
  | "integrations"
  | "menu_setup"
  | "feature_discovery"
  | "smart_quiz"
  | "feature_triage"
  | "guided_setup"
  | "review_launch";

export type OnboardingPhase =
  | "foundation"
  | "inventory"
  | "pricing"
  | "rules"
  | "features"
  | "launch";

type SiteType = "rv" | "tent" | "cabin" | "yurt";

type SiteClassTemplate = {
  id: string;
  name: string;
  siteType: SiteType;
  icon: string;
  description: string;
  defaults: {
    hookupsPower: boolean;
    hookupsWater: boolean;
    hookupsSewer: boolean;
    maxOccupancy: number;
    rigMaxLength?: number;
    petFriendly: boolean;
  };
};

export interface OnboardingStep {
  key: OnboardingStepKey;
  title: string;
  description: string;
  phase: OnboardingPhase;
  required: boolean;
  celebration?: {
    title: string;
    subtitle?: string;
  };
}

export const onboardingSteps: OnboardingStep[] = [
  // Phase 1: Foundation
  {
    key: "park_profile",
    title: "Your Campground",
    description: "Let's get the basics set up",
    phase: "foundation",
    required: true,
  },
  {
    key: "operational_hours",
    title: "Hours & Times",
    description: "Set check-in, check-out, and quiet hours",
    phase: "foundation",
    required: true,
  },
  {
    key: "stripe_connect",
    title: "Accept Payments",
    description: "Connect your Stripe account",
    phase: "foundation",
    required: true,
    celebration: {
      title: "Payments Ready!",
      subtitle: "You can now accept credit cards, ACH, and more",
    },
  },
  // Phase 2: Inventory
  {
    key: "inventory_choice",
    title: "Your Sites",
    description: "Import existing data or start fresh",
    phase: "inventory",
    required: true,
  },
  {
    key: "data_import",
    title: "Import Data",
    description: "Upload your sites from CSV or another system",
    phase: "inventory",
    required: false, // Only if they chose import path
  },
  {
    key: "site_classes",
    title: "Site Types",
    description: "Define your accommodation categories",
    phase: "inventory",
    required: false, // Only if they chose manual path
  },
  {
    key: "sites_builder",
    title: "Add Sites",
    description: "Create your bookable inventory",
    phase: "inventory",
    required: false, // Only if manual path
    celebration: {
      title: "Sites Ready!",
      subtitle: "Your inventory is set up and ready for bookings",
    },
  },
  // Phase 3: Pricing
  {
    key: "rate_periods",
    title: "Rate Periods",
    description: "Define seasonal pricing periods",
    phase: "pricing",
    required: false,
  },
  {
    key: "rates_setup",
    title: "Pricing",
    description: "Set rates for each site type",
    phase: "pricing",
    required: true,
  },
  {
    key: "fees_and_addons",
    title: "Fees & Add-ons",
    description: "Configure booking fees and purchasable items",
    phase: "pricing",
    required: false,
  },
  // Phase 4: Rules & Policies
  {
    key: "tax_rules",
    title: "Taxes",
    description: "Configure lodging and local taxes",
    phase: "rules",
    required: false,
  },
  {
    key: "booking_rules",
    title: "Booking Rules",
    description: "Set advance booking and stay limits",
    phase: "rules",
    required: true,
  },
  {
    key: "deposit_policy",
    title: "Deposits",
    description: "How much to collect upfront",
    phase: "rules",
    required: true,
  },
  {
    key: "cancellation_rules",
    title: "Cancellation Policy",
    description: "Set tiered refund rules",
    phase: "rules",
    required: false,
  },
  {
    key: "waivers_documents",
    title: "Waivers & Agreements",
    description: "Liability waivers guests must sign",
    phase: "rules",
    required: false,
  },
  {
    key: "park_rules",
    title: "Park Rules",
    description: "Policies guests must acknowledge",
    phase: "rules",
    required: false,
  },
  // Phase 5: Launch
  {
    key: "team_setup",
    title: "Team Setup",
    description: "Invite staff members",
    phase: "launch",
    required: false,
  },
  {
    key: "communication_setup",
    title: "Communications",
    description: "Set up email templates and automation",
    phase: "launch",
    required: false,
    celebration: {
      title: "Emails Configured!",
      subtitle: "Guests will receive beautiful, professional messages",
    },
  },
  {
    key: "integrations",
    title: "Integrations",
    description: "Connect your business tools",
    phase: "launch",
    required: false,
  },
  {
    key: "menu_setup",
    title: "Your Dashboard",
    description: "Customize your sidebar menu",
    phase: "launch",
    required: false,
    celebration: {
      title: "Dashboard Personalized!",
      subtitle: "Your menu is set up exactly how you like it",
    },
  },
  {
    key: "feature_discovery",
    title: "Explore Features",
    description: "Discover all the tools at your disposal",
    phase: "launch",
    required: false,
  },
  // Phase 6: Feature Selection (NEW)
  {
    key: "smart_quiz",
    title: "Tell Us About Your Park",
    description: "A few questions to personalize your setup",
    phase: "features",
    required: false,
  },
  {
    key: "feature_triage",
    title: "Choose Features",
    description: "Select which features to set up",
    phase: "features",
    required: false,
    celebration: {
      title: "Features Selected!",
      subtitle: "Your personalized setup is ready",
    },
  },
  {
    key: "guided_setup",
    title: "Feature Setup",
    description: "Configure your selected features",
    phase: "features",
    required: false,
  },
  // Phase 7: Launch
  {
    key: "review_launch",
    title: "Go Live",
    description: "Review everything and launch",
    phase: "launch",
    required: true,
    celebration: {
      title: "You're LIVE!",
      subtitle: "Your campground is ready to accept bookings",
    },
  },
];

export const onboardingStepOrder = onboardingSteps.map((s) => s.key);

export const phaseLabels: Record<OnboardingPhase, string> = {
  foundation: "Getting Started",
  inventory: "Your Sites",
  pricing: "Pricing",
  rules: "Rules & Policies",
  features: "Features",
  launch: "Go Live",
};

// Site class templates for quick setup
export const siteClassTemplates: SiteClassTemplate[] = [
  {
    id: "full_hookup_rv",
    name: "Full Hookup RV",
    siteType: "rv",
    icon: "Truck",
    description: "RV sites with power, water, and sewer",
    defaults: {
      hookupsPower: true,
      hookupsWater: true,
      hookupsSewer: true,
      maxOccupancy: 6,
      rigMaxLength: 45,
      petFriendly: true,
    },
  },
  {
    id: "backin_rv",
    name: "Back-in RV",
    siteType: "rv",
    icon: "Truck",
    description: "Standard RV sites with electric and water",
    defaults: {
      hookupsPower: true,
      hookupsWater: true,
      hookupsSewer: false,
      maxOccupancy: 6,
      rigMaxLength: 35,
      petFriendly: true,
    },
  },
  {
    id: "tent",
    name: "Tent Site",
    siteType: "tent",
    icon: "Tent",
    description: "Primitive sites for tent camping",
    defaults: {
      hookupsPower: false,
      hookupsWater: false,
      hookupsSewer: false,
      maxOccupancy: 4,
      petFriendly: true,
    },
  },
  {
    id: "cabin",
    name: "Cabin",
    siteType: "cabin",
    icon: "Home",
    description: "Rustic cabins with beds and amenities",
    defaults: {
      hookupsPower: true,
      hookupsWater: true,
      hookupsSewer: true,
      maxOccupancy: 4,
      petFriendly: false,
    },
  },
  {
    id: "glamping",
    name: "Glamping",
    siteType: "yurt",
    icon: "Sparkles",
    description: "Yurts, safari tents, or unique stays",
    defaults: {
      hookupsPower: true,
      hookupsWater: false,
      hookupsSewer: false,
      maxOccupancy: 4,
      petFriendly: false,
    },
  },
];

// US Timezones for dropdown
type TimezoneOption = { value: string; label: string };

export const US_TIMEZONES: readonly TimezoneOption[] = [
  { value: "America/New_York", label: "Eastern (ET)" },
  { value: "America/Chicago", label: "Central (CT)" },
  { value: "America/Denver", label: "Mountain (MT)" },
  { value: "America/Phoenix", label: "Arizona (no DST)" },
  { value: "America/Los_Angeles", label: "Pacific (PT)" },
  { value: "America/Anchorage", label: "Alaska (AKT)" },
  { value: "Pacific/Honolulu", label: "Hawaii (HST)" },
];
