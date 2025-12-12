export type OnboardingStepKey =
  | "account_profile"
  | "payment_gateway"
  | "taxes_and_fees"
  | "inventory_sites"
  | "rates_and_fees"
  | "policies"
  | "communications_templates"
  | "pos_hardware"
  | "imports";

export const ONBOARDING_STEPS: { key: OnboardingStepKey; title: string; description: string }[] = [
  { key: "account_profile", title: "Account & profile", description: "Contact info, timezone, and branding basics." },
  { key: "payment_gateway", title: "Payments", description: "Choose your gateway and payout details." },
  { key: "taxes_and_fees", title: "Taxes & fees", description: "Set tax rates, service and platform fees." },
  { key: "inventory_sites", title: "Inventory & sites", description: "Add sites, classes, and capacity." },
  { key: "rates_and_fees", title: "Rates", description: "Base rates, deposits, and adjustments." },
  { key: "policies", title: "Policies", description: "Check-in/out, cancellations, quiet hours." },
  { key: "communications_templates", title: "Communications", description: "Default emails/SMS, sender identity." },
  { key: "pos_hardware", title: "POS hardware", description: "Card readers, kiosks, printers, networks." },
  { key: "imports", title: "Imports", description: "Legacy data, PMS exports, docs to import." },
];

export const ONBOARDING_STEP_ORDER = ONBOARDING_STEPS.map((s) => s.key);

export const ONBOARDING_TOTAL_STEPS = ONBOARDING_STEP_ORDER.length;
