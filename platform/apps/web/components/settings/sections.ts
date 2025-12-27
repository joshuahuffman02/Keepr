import type { Section } from "./navigation/SectionTabs";

// Section configurations for each category
export const categorySections: Record<string, Section[]> = {
  property: [
    { id: "profile", label: "Profile", href: "/dashboard/settings/central/property/profile" },
    { id: "sites", label: "Site Types", href: "/dashboard/settings/central/property/sites" },
    { id: "equipment", label: "Equipment", href: "/dashboard/settings/central/property/equipment" },
    { id: "amenities", label: "Amenities", href: "/dashboard/settings/central/property/amenities" },
    { id: "photos", label: "Photos", href: "/dashboard/settings/photos" },
    { id: "branding", label: "Branding", href: "/dashboard/settings/branding" },
    { id: "localization", label: "Localization", href: "/dashboard/settings/localization" },
    { id: "hours", label: "Hours", href: "/dashboard/settings/store-hours" },
  ],

  pricing: [
    { id: "rate-groups", label: "Rate Groups", href: "/dashboard/settings/central/pricing/rate-groups" },
    { id: "seasonal", label: "Seasonal Rates", href: "/dashboard/settings/central/pricing/seasonal" },
    { id: "dynamic", label: "Dynamic Pricing", href: "/dashboard/settings/central/pricing/dynamic" },
    { id: "charge-codes", label: "Charge Codes", href: "/dashboard/settings/central/pricing/charge-codes" },
    { id: "taxes", label: "Tax Rules", href: "/dashboard/settings/central/pricing/taxes" },
    { id: "deposits", label: "Deposits", href: "/dashboard/settings/deposit-policies" },
  ],

  bookings: [
    { id: "policies", label: "Policies", href: "/dashboard/settings/central/bookings/policies" },
    { id: "stay-rules", label: "Stay Rules", href: "/dashboard/settings/central/bookings/stay-rules" },
    { id: "blackouts", label: "Blackouts", href: "/dashboard/settings/blackout-dates" },
    { id: "closures", label: "Site Closures", href: "/dashboard/settings/central/bookings/closures" },
    { id: "custom-fields", label: "Custom Fields", href: "/dashboard/settings/central/bookings/custom-fields" },
    { id: "lock-codes", label: "Lock Codes", href: "/dashboard/settings/central/bookings/lock-codes" },
    { id: "promotions", label: "Promotions", href: "/dashboard/settings/promotions" },
    { id: "optimization", label: "Optimization", href: "/dashboard/settings/central/bookings/optimization" },
  ],

  store: [
    { id: "departments", label: "Departments", href: "/dashboard/settings/central/store/departments" },
    { id: "products", label: "Products", href: "/dashboard/settings/central/store/products" },
    { id: "upsells", label: "Upsells", href: "/dashboard/settings/upsells" },
    { id: "discounts", label: "Discounts", href: "/dashboard/settings/central/store/discounts" },
    { id: "pos", label: "POS Integration", href: "/dashboard/settings/pos-integrations" },
  ],

  access: [
    { id: "users", label: "Users", href: "/dashboard/settings/central/access/users" },
    { id: "roles", label: "Roles", href: "/dashboard/settings/central/access/roles" },
    { id: "permissions", label: "Permissions", href: "/dashboard/settings/permissions" },
    { id: "security", label: "Security", href: "/dashboard/settings/security" },
    { id: "audit", label: "Audit Log", href: "/dashboard/settings/central/access/audit" },
    { id: "api", label: "API Keys", href: "/dashboard/settings/developers" },
  ],

  system: [
    { id: "check", label: "System Check", href: "/dashboard/settings/central/system/check" },
    { id: "integrations", label: "Integrations", href: "/dashboard/settings/central/system/integrations" },
    { id: "templates", label: "Email Templates", href: "/dashboard/settings/templates" },
    { id: "notifications", label: "Notifications", href: "/dashboard/settings/notification-triggers" },
    { id: "webhooks", label: "Webhooks", href: "/dashboard/settings/webhooks" },
    { id: "jobs", label: "Jobs", href: "/dashboard/settings/jobs" },
    { id: "import", label: "Import", href: "/dashboard/settings/import" },
  ],
};

// Get sections for a category
export function getSectionsForCategory(categoryId: string): Section[] {
  return categorySections[categoryId] || [];
}

// Get default section for a category
export function getDefaultSection(categoryId: string): Section | undefined {
  const sections = getSectionsForCategory(categoryId);
  return sections[0];
}
