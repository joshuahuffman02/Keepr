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

export const onboardingSteps: { key: OnboardingStepKey; title: string; description: string }[] = [
  { key: "account_profile", title: "Account & profile", description: "Contact info, timezone, branding basics." },
  { key: "payment_gateway", title: "Payments", description: "Select gateway and payout destination." },
  { key: "taxes_and_fees", title: "Taxes & fees", description: "State/local rates and service fees." },
  { key: "inventory_sites", title: "Inventory & sites", description: "Site counts, types, and capacities." },
  { key: "rates_and_fees", title: "Rates", description: "Base rates, deposits, add-on fees." },
  { key: "policies", title: "Policies", description: "Check-in/out, cancellation, quiet hours." },
  { key: "communications_templates", title: "Comms", description: "Default emails/SMS and sender name." },
  { key: "pos_hardware", title: "POS hardware", description: "Terminals, kiosks, printers, networks." },
  { key: "imports", title: "Imports", description: "Legacy PMS exports and files to ingest." },
];

export const onboardingStepOrder = onboardingSteps.map((s) => s.key);
