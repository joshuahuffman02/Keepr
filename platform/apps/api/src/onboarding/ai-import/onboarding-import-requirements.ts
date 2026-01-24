import type { TargetEntity } from "./document-classifier.service";

export type OnboardingImportSystemKey =
  | "campspot"
  | "newbook"
  | "rms_cloud"
  | "campground_master"
  | "resnexus"
  | "other";

export type CoverageGroupKey = "sites" | "reservations" | "rates" | "accounting";

export type CoverageStatus = "complete" | "partial" | "missing";

export type CoverageFieldRequirement = {
  key: string;
  label: string;
  aliases: string[];
};

export type CoverageGroupRequirement = {
  key: CoverageGroupKey;
  label: string;
  description: string;
  required: boolean;
  fields: CoverageFieldRequirement[];
  entities: TargetEntity[];
};

export type ImportFormDefinition = {
  key: string;
  label: string;
  description: string;
  covers: CoverageGroupKey[];
  fileTypes: string[];
};

export type ImportSystemDefinition = {
  key: OnboardingImportSystemKey;
  label: string;
  forms: ImportFormDefinition[];
};

const coverGroups = (...keys: CoverageGroupKey[]): CoverageGroupKey[] => keys;

const BASE_FORMS = {
  sites: {
    key: "sites_export",
    label: "Sites / Inventory Export",
    description: "Site list with numbers, types, hookups, and capacity.",
    covers: coverGroups("sites"),
    fileTypes: ["csv", "xlsx", "xls"],
  },
  reservations: {
    key: "reservations_export",
    label: "Reservations Export",
    description: "Arrivals, departures, guest info, totals, payments, and taxes.",
    covers: coverGroups("reservations", "accounting"),
    fileTypes: ["csv", "xlsx", "xls"],
  },
  rates: {
    key: "rates_export",
    label: "Rates / Seasons Export",
    description: "Nightly, weekly, or monthly rates by site class.",
    covers: coverGroups("rates"),
    fileTypes: ["csv", "xlsx", "xls"],
  },
  taxes: {
    key: "taxes_fees_export",
    label: "Taxes / Fees Export",
    description: "Tax rates, fee schedules, and charge codes for accounting checks.",
    covers: coverGroups("accounting"),
    fileTypes: ["csv", "xlsx", "xls", "pdf"],
  },
};

export const IMPORT_SYSTEMS: ImportSystemDefinition[] = [
  {
    key: "campspot",
    label: "Campspot",
    forms: [
      {
        ...BASE_FORMS.sites,
        description:
          "Look for a Campspot export labeled Sites, Inventory, or Space Types (CSV/Excel).",
      },
      {
        ...BASE_FORMS.reservations,
        description: "Campspot Reservations/Booking List export with totals, payments, and taxes.",
      },
      {
        ...BASE_FORMS.rates,
        description: "Campspot Rate Table or Seasonal Rates export (Pricing or Rates report).",
      },
      {
        ...BASE_FORMS.taxes,
        description: "Campspot Taxes/Fees report or Transactions export with tax totals.",
      },
    ],
  },
  {
    key: "newbook",
    label: "Newbook",
    forms: [
      { ...BASE_FORMS.sites, description: "Newbook Sites or Units export (Inventory/Asset list)." },
      {
        ...BASE_FORMS.reservations,
        description: "Newbook Reservations or Booking List report export with payments.",
      },
      {
        ...BASE_FORMS.rates,
        description: "Newbook Rates/Seasons export (Rate Plans or Pricing table).",
      },
      { ...BASE_FORMS.taxes, description: "Newbook Charges/Taxes or Transaction ledger export." },
    ],
  },
  {
    key: "rms_cloud",
    label: "RMS Cloud",
    forms: [
      {
        ...BASE_FORMS.sites,
        description: "RMS Areas/Rooms/Inventory export (often called Asset list).",
      },
      {
        ...BASE_FORMS.reservations,
        description: "RMS Reservations/Booking List report export with charges.",
      },
      { ...BASE_FORMS.rates, description: "RMS Rate Table or Rate Lookup export." },
      { ...BASE_FORMS.taxes, description: "RMS Tax/Charge ledger or Revenue summary export." },
    ],
  },
  {
    key: "campground_master",
    label: "Campground Master",
    forms: [
      { ...BASE_FORMS.sites, description: "Campground Master Sites list export (Setup > Sites)." },
      {
        ...BASE_FORMS.reservations,
        description: "Campground Master Reservation list or Arrivals/Departures report export.",
      },
      { ...BASE_FORMS.rates, description: "Campground Master Rate Table or Seasonal Rate export." },
      {
        ...BASE_FORMS.taxes,
        description: "Campground Master Tax/Charge report or Transaction summary export.",
      },
    ],
  },
  {
    key: "resnexus",
    label: "ResNexus",
    forms: [
      { ...BASE_FORMS.sites, description: "ResNexus Units/Rooms export (Inventory list)." },
      {
        ...BASE_FORMS.reservations,
        description: "ResNexus Reservations/Booking List report export with payments.",
      },
      { ...BASE_FORMS.rates, description: "ResNexus Rate/Season export or Pricing table." },
      {
        ...BASE_FORMS.taxes,
        description: "ResNexus Taxes/Fees report or Payments/Transactions export.",
      },
    ],
  },
  {
    key: "other",
    label: "Other / Not Sure",
    forms: [BASE_FORMS.sites, BASE_FORMS.reservations, BASE_FORMS.rates, BASE_FORMS.taxes],
  },
];

export const DEFAULT_SYSTEM_KEY: OnboardingImportSystemKey = "campspot";

export const COVERAGE_REQUIREMENTS: CoverageGroupRequirement[] = [
  {
    key: "sites",
    label: "Sites and inventory",
    description: "Site numbers, types, and capacity.",
    required: true,
    entities: ["sites"],
    fields: [
      {
        key: "siteNumber",
        label: "Site number",
        aliases: ["site_number", "site_num", "site_id", "site", "spot", "space", "lot", "unit"],
      },
      {
        key: "siteType",
        label: "Site type",
        aliases: ["site_type", "type", "category", "site_category", "class"],
      },
    ],
  },
  {
    key: "reservations",
    label: "Reservations and guest stays",
    description: "Arrivals, departures, and guest/site assignments.",
    required: true,
    entities: ["reservations", "guests"],
    fields: [
      {
        key: "arrivalDate",
        label: "Arrival date",
        aliases: ["arrival", "arrival_date", "check_in", "checkin", "start_date"],
      },
      {
        key: "departureDate",
        label: "Departure date",
        aliases: ["departure", "departure_date", "check_out", "checkout", "end_date"],
      },
      {
        key: "guestName",
        label: "Guest name",
        aliases: ["first_name", "last_name", "guest_name", "primary_guest", "name"],
      },
      {
        key: "siteAssignment",
        label: "Site assignment",
        aliases: ["site", "site_number", "spot", "space", "site_name", "unit"],
      },
    ],
  },
  {
    key: "rates",
    label: "Rates and seasons",
    description: "Nightly pricing tied to site classes.",
    required: true,
    entities: ["rates"],
    fields: [
      {
        key: "siteClassName",
        label: "Site class or category",
        aliases: ["site_class", "class", "category", "site_type", "type"],
      },
      {
        key: "nightlyRate",
        label: "Nightly rate",
        aliases: ["nightly_rate", "nightly", "daily_rate", "rate", "price"],
      },
    ],
  },
  {
    key: "accounting",
    label: "Accounting totals and taxes",
    description: "Totals, payments, and tax fields for reconciliation.",
    required: true,
    entities: ["reservations", "rates"],
    fields: [
      {
        key: "totalAmount",
        label: "Total amount",
        aliases: ["total", "total_amount", "amount", "grand_total", "reservation_total"],
      },
      {
        key: "paidAmount",
        label: "Paid amount",
        aliases: ["paid", "paid_amount", "amount_paid", "payments", "deposit"],
      },
      {
        key: "taxAmount",
        label: "Tax amount or rate",
        aliases: ["tax", "tax_amount", "tax_total", "sales_tax", "tax_rate"],
      },
    ],
  },
];

export const resolveImportSystem = (key?: string): ImportSystemDefinition => {
  if (!key) {
    return IMPORT_SYSTEMS.find((system) => system.key === DEFAULT_SYSTEM_KEY) ?? IMPORT_SYSTEMS[0];
  }
  const normalized = key.toLowerCase();
  return (
    IMPORT_SYSTEMS.find((system) => system.key === normalized) ??
    IMPORT_SYSTEMS.find((system) => system.key === DEFAULT_SYSTEM_KEY) ??
    IMPORT_SYSTEMS[0]
  );
};
