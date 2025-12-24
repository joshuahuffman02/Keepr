export type OnboardingStepKey =
  | "park_profile"
  | "stripe_connect"
  | "inventory_choice"
  | "data_import"
  | "site_classes"
  | "sites_builder"
  | "rate_periods"
  | "rates_setup"
  | "fees_and_addons"
  | "tax_rules"
  | "deposit_policy"
  | "cancellation_rules"
  | "park_rules"
  | "review_launch";

export type OnboardingPhase = "foundation" | "inventory" | "pricing" | "rules" | "launch";

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
  { key: "deposit_policy", title: "Deposits", description: "Payment collection rules", phase: "rules", required: true },
  { key: "cancellation_rules", title: "Cancellation", description: "Cancellation policies", phase: "rules", required: false },
  { key: "park_rules", title: "Park Rules", description: "Guest policies", phase: "rules", required: false },
  // Phase 5: Launch
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
