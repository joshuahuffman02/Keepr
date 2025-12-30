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

export type OnboardingPhase = "foundation" | "inventory" | "pricing" | "rules" | "features" | "launch";

export interface OnboardingStep {
  key: OnboardingStepKey;
  title: string;
  description: string;
  phase: OnboardingPhase;
  required: boolean;
}

export const ONBOARDING_STEPS: OnboardingStep[] = [
  // Phase 1: Foundation
  { key: "park_profile", title: "Your Campground", description: "Basic info and location", phase: "foundation", required: true },
  { key: "operational_hours", title: "Hours & Times", description: "Check-in, check-out, quiet hours", phase: "foundation", required: true },
  { key: "stripe_connect", title: "Accept Payments", description: "Connect Stripe account", phase: "foundation", required: true },
  // Phase 2: Inventory
  { key: "inventory_choice", title: "Your Sites", description: "Import or build manually", phase: "inventory", required: true },
  { key: "data_import", title: "Import Data", description: "Upload from CSV", phase: "inventory", required: false },
  { key: "site_classes", title: "Site Types", description: "Define accommodation types", phase: "inventory", required: false },
  { key: "sites_builder", title: "Add Sites", description: "Create bookable inventory", phase: "inventory", required: false },
  // Phase 3: Pricing
  { key: "rate_periods", title: "Rate Periods", description: "Define pricing seasons", phase: "pricing", required: false },
  { key: "rates_setup", title: "Pricing", description: "Set rates per site type", phase: "pricing", required: true },
  { key: "fees_and_addons", title: "Fees & Add-ons", description: "Booking fees and extras", phase: "pricing", required: false },
  // Phase 4: Rules & Policies
  { key: "tax_rules", title: "Taxes", description: "Configure tax rules", phase: "rules", required: false },
  { key: "booking_rules", title: "Booking Rules", description: "Advance booking and stay limits", phase: "rules", required: true },
  { key: "deposit_policy", title: "Deposits", description: "Payment collection rules", phase: "rules", required: true },
  { key: "cancellation_rules", title: "Cancellation", description: "Cancellation policies", phase: "rules", required: false },
  { key: "waivers_documents", title: "Waivers", description: "Liability and guest agreements", phase: "rules", required: false },
  { key: "park_rules", title: "Park Rules", description: "Guest policies", phase: "rules", required: false },
  // Phase 5: Team
  { key: "team_setup", title: "Team Setup", description: "Invite staff members", phase: "rules", required: false },
  { key: "communication_setup", title: "Communications", description: "Email templates and automation", phase: "rules", required: false },
  { key: "integrations", title: "Integrations", description: "Connect business tools", phase: "rules", required: false },
  // Phase 6: Feature Selection
  { key: "menu_setup", title: "Sidebar Menu", description: "Customize your navigation", phase: "features", required: false },
  { key: "feature_discovery", title: "Feature Discovery", description: "Explore available features", phase: "features", required: false },
  { key: "smart_quiz", title: "Tell Us About Your Park", description: "Personalize your setup", phase: "features", required: false },
  { key: "feature_triage", title: "Choose Features", description: "Select what to set up", phase: "features", required: false },
  { key: "guided_setup", title: "Feature Setup", description: "Configure selected features", phase: "features", required: false },
  // Phase 7: Launch
  { key: "review_launch", title: "Go Live", description: "Review and launch", phase: "launch", required: true },
];

export const ONBOARDING_STEP_ORDER = ONBOARDING_STEPS.map((s) => s.key);

export const ONBOARDING_TOTAL_STEPS = ONBOARDING_STEP_ORDER.length;

// Map old step keys to new ones for backwards compatibility
export const LEGACY_STEP_MAPPING: Record<string, OnboardingStepKey> = {
  account_profile: "park_profile",
  payment_gateway: "stripe_connect",
  inventory_sites: "inventory_choice",
  rates_and_fees: "rates_setup",
  taxes_and_fees: "tax_rules",
  policies: "deposit_policy",
  communications_templates: "park_rules",
  pos_hardware: "park_rules",
  imports: "data_import",
};
