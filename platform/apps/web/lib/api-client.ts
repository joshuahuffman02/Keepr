import {
  CampgroundSchema,
  GuestSchema,
  ReservationSchema,
  CreateReservationSchema,
  SiteSchema,
  SiteClassSchema,
  MaintenanceSchema,
  CreateMaintenanceSchema,
  PricingRuleSchema,
  CreatePricingRuleSchema,
  QuoteSchema,
  LedgerEntrySchema,
  PaymentSchema,
  EventSchema,
  CreateEventSchema,
  ProductCategorySchema,
  CreateProductCategorySchema,
  ProductSchema,
  CreateProductSchema,
  AddOnSchema,
  CreateAddOnSchema,
  StoreLocationSchema,
  CreateStoreLocationSchema,
  LocationInventorySchema,
  LocationPriceOverrideSchema,
  InventoryMovementSchema,
  InventoryTransferSchema,
  CreateInventoryTransferSchema,
  BlackoutDateSchema,
  CreateBlackoutDateSchema,
  WaitlistEntrySchema,
  CreateWaitlistEntrySchema,
  CommunicationSchema,
  CreateCommunicationSchema,
  CommunicationTemplateSchema,
  CommunicationPlaybookSchema,
  CommunicationPlaybookJobSchema,
  NpsSurveySchema,
  NpsInviteSchema,
  NpsResponseSchema,
  NpsMetricsSchema,
  ReviewSchema,
  ReviewRequestSchema,
  ReviewModerationSchema,
  ReviewReplySchema,
  FormTemplateSchema,
  FormSubmissionSchema,
} from "@keepr/shared";
import { z } from "zod";

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const numberish = <T extends z.ZodTypeAny>(schema: T) =>
  z.preprocess((val) => {
    if (val === null || val === undefined) return val;
    if (typeof val === "string") {
      const trimmed = val.trim();
      if (!trimmed) return val;
      const parsed = Number(trimmed);
      return Number.isNaN(parsed) ? val : parsed;
    }
    if (typeof val === "number") return val;
    if (
      typeof val === "object" &&
      val !== null &&
      "toString" in val &&
      typeof val.toString === "function"
    ) {
      const str = val.toString();
      const parsed = Number(str);
      return Number.isNaN(parsed) ? val : parsed;
    }
    return val;
  }, schema);

const CampgroundWithAnalyticsSchema = CampgroundSchema.extend({
  gaMeasurementId: z.string().nullable().optional(),
  metaPixelId: z.string().nullable().optional(),
  aiSuggestionsEnabled: z.boolean().optional().default(false),
  siteSelectionFeeCents: z.number().int().nonnegative().optional(),
  // Override website to allow non-URL strings (user may enter "example.com" without https://)
  website: z.string().nullish(),
  facebookUrl: z.string().nullish(),
  instagramUrl: z.string().nullish(),
  externalUrl: z.string().nullish(),
  heroImageUrl: z.string().nullish(),
}).passthrough();
const CampgroundArray = z.array(CampgroundWithAnalyticsSchema);
const SiteArray = z.array(SiteSchema);
const ReservationWithGroupSchema = ReservationSchema.extend({
  groupId: z.string().nullish(),
  groupRole: z.enum(["primary", "member"]).nullish(),
});
const ReservationArray = z.array(ReservationWithGroupSchema);
const AvailabilitySiteArray = z.array(
  z.object({
    id: z.string(),
    campgroundId: z.string(),
    siteClassId: z.string().nullable().optional(),
    name: z.string(),
    siteNumber: z.string(),
    siteType: z.string(),
    maxOccupancy: numberish(z.number().int().nonnegative()),
    rigMaxLength: numberish(z.number().int().nonnegative().nullable()).optional(),
    isActive: z.boolean().optional().default(true),
    siteClass: z
      .object({
        name: z.string(),
        rigMaxLength: numberish(z.number().int().nonnegative().nullable()).optional(),
        defaultRate: numberish(z.number().int().nonnegative()),
        maxOccupancy: numberish(z.number().int().nonnegative()).optional(),
      })
      .nullable()
      .optional(),
  }),
);
const GuestArray = z.array(GuestSchema);
const SiteClassArray = z.array(SiteClassSchema);
const MaintenanceArray = z.array(MaintenanceSchema);
const OverlapCheckSchema = z.object({
  conflict: z.boolean(),
  reasons: z.array(z.string()).optional().default([]),
});
const OverlapListSchema = z.array(
  z.object({
    siteId: z.string(),
    reservationA: z.string(),
    reservationB: z.string(),
    arrivalA: z.string(),
    departureA: z.string(),
    arrivalB: z.string(),
    departureB: z.string(),
  }),
);

// Removed duplicate definitions from here
const VehicleSchema = z.object({
  id: z.string(),
  campgroundId: z.string(),
  reservationId: z.string().nullable().optional(),
  plate: z.string().nullable().optional(),
  state: z.string().nullable().optional(),
  rigType: z.string().nullable().optional(),
  rigLength: z.number().int().nonnegative().nullable().optional(),
  description: z.string().nullable().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
const AccessGrantSchema = z.object({
  id: z.string(),
  campgroundId: z.string(),
  reservationId: z.string(),
  provider: z.string(),
  status: z.string(),
  providerAccessId: z.string().nullable().optional(),
  startsAt: z.string().nullable().optional(),
  endsAt: z.string().nullable().optional(),
  blockedReason: z.string().nullable().optional(),
  createdAt: z.string(),
  updatedAt: z.string().optional().nullable(),
});
const AccessStatusSchema = z.object({
  vehicle: VehicleSchema.nullable().optional(),
  grants: z.array(AccessGrantSchema),
});

const AccessIntegrationSchema = z.object({
  id: z.string(),
  campgroundId: z.string(),
  provider: z.string(),
  displayName: z.string().nullable().optional(),
  status: z.string().nullable().optional(),
  credentials: z.unknown(),
  webhookSecret: z.string().nullable().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
const AbandonedCartSchema = z.object({
  id: z.string(),
  campgroundId: z.string(),
  email: z.string().nullable().optional(),
  phone: z.string().nullable().optional(),
  channel: z.enum(["email", "sms", "unknown"]),
  abandonedAt: z.string(),
  lastActivityAt: z.string(),
  status: z.enum(["queued", "contacted"]),
  notes: z.string().nullable().optional(),
});

const ActivityCapacitySchema = z.object({
  activityId: z.string(),
  capacity: z.number(),
  booked: z.number(),
  remaining: z.number(),
  waitlistEnabled: z.boolean(),
  waitlistCount: z.number(),
  overage: z.boolean(),
  overageAmount: z.number(),
  lastUpdated: z.string(),
});

const ActivityWaitlistEntrySchema = z.object({
  id: z.string(),
  guestName: z.string(),
  partySize: z.number(),
  contact: z.string().nullable().optional(),
  addedAt: z.string(),
});
const DashboardSummarySchema = z.object({
  campground: z.object({ id: z.string(), name: z.string() }),
  sites: z.number(),
  futureReservations: z.number(),
  occupancy: z.number(),
  adr: z.number(),
  revpar: z.number(),
  revenue: z.number(),
  overdueBalance: z.number(),
  maintenanceOpen: z.number().optional().default(0),
  maintenanceOverdue: z.number().optional().default(0),
});

const StoredValueCodeSchema = z.object({
  id: z.string(),
  code: z.string(),
  active: z.boolean(),
  createdAt: z.string().optional(),
});

const StoredValueScopeSchema = z.enum(["campground", "organization", "global"]);

// Additional response types for API methods
const StayReasonReportSchema = z.unknown(); // Generic report data structure
const DailyScheduleSchema = z.object({
  summary: z
    .object({
      checkouts: z.number().optional(),
      checkins: z.number().optional(),
      turnovers: z.number().optional(),
      priorityCount: z.number().optional(),
      stayoverCount: z.number().optional(),
    })
    .optional(),
  expectedCheckouts: z
    .array(
      z.object({
        id: z.string(),
        siteName: z.string().optional(),
        guestName: z.string().optional(),
        time: z.string().optional(),
      }),
    )
    .optional(),
  expectedCheckins: z
    .array(
      z.object({
        id: z.string(),
        siteName: z.string().optional(),
        guestName: z.string().optional(),
        time: z.string().optional(),
        isVIP: z.boolean().optional(),
        isEarlyArrival: z.boolean().optional(),
      }),
    )
    .optional(),
  expectedTurnovers: z
    .array(
      z.object({
        id: z.string(),
        siteName: z.string().optional(),
        arrivalTime: z.string().optional(),
        departureTime: z.string().optional(),
      }),
    )
    .optional(),
  stayovers: z
    .array(
      z.object({
        id: z.string(),
        siteName: z.string().optional(),
        guestName: z.string().optional(),
      }),
    )
    .optional(),
  prioritySites: z
    .array(
      z.object({
        id: z.string(),
        siteName: z.string().optional(),
        priority: z.string().optional(),
        reason: z.string().optional(),
      }),
    )
    .optional(),
  priorityUnits: z.array(z.string()).optional(),
});
const FlexCheckPolicySchema = z.unknown(); // Flex check policy structure
const GroupBookingSchema = z.unknown(); // Group booking structure

const StoredValueAccountSchema = z.object({
  id: z.string(),
  campgroundId: z.string(),
  scopeType: StoredValueScopeSchema.optional().default("campground"),
  scopeId: z.string().nullable().optional(),
  type: z.enum(["gift", "credit"]),
  currency: z.string(),
  status: z.enum(["active", "frozen", "expired"]),
  issuedAt: z.string(),
  expiresAt: z.string().nullable().optional(),
  metadata: z.record(z.unknown()).nullable().optional(),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
  campground: z
    .object({
      id: z.string(),
      name: z.string(),
    })
    .optional(),
  codes: z.array(StoredValueCodeSchema).optional().default([]),
  balanceCents: z.number(),
  issuedCents: z.number(),
});

const StoredValueLedgerSchema = z.object({
  id: z.string(),
  accountId: z.string(),
  campgroundId: z.string(),
  issuerCampgroundId: z.string().nullable().optional(),
  scopeType: StoredValueScopeSchema.optional(),
  scopeId: z.string().nullable().optional(),
  direction: z.string(),
  amountCents: z.number(),
  currency: z.string(),
  beforeBalanceCents: z.number().optional(),
  afterBalanceCents: z.number().optional(),
  referenceType: z.string().optional(),
  referenceId: z.string().optional(),
  channel: z.string().nullable().optional(),
  reason: z.string().nullable().optional(),
  createdAt: z.string(),
});

const StoredValueIssueResponseSchema = z
  .object({
    accountId: z.string(),
    balanceCents: z.number(),
    expiresAt: z.string().nullable().optional(),
    code: z.string().optional(),
    pinRequired: z.boolean().optional(),
    pin: z.string().optional(),
  })
  .passthrough();

const StoredValueRedeemResponseSchema = z
  .object({
    accountId: z.string(),
    balanceCents: z.number().optional(),
    availableCents: z.number().optional(),
    holdId: z.string().optional(),
  })
  .passthrough();

const StoredValueAdjustResponseSchema = z
  .object({
    accountId: z.string(),
    balanceCents: z.number(),
  })
  .passthrough();

const OnboardingStepEnum = z.enum([
  // New step keys
  "park_profile",
  "operational_hours",
  "stripe_connect",
  "inventory_choice",
  "data_import",
  "site_classes",
  "sites_builder",
  "rate_periods",
  "rates_setup",
  "fees_and_addons",
  "tax_rules",
  "booking_rules",
  "deposit_policy",
  "cancellation_rules",
  "waivers_documents",
  "park_rules",
  "team_setup",
  "communication_setup",
  "integrations",
  "menu_setup",
  "feature_discovery",
  "smart_quiz",
  "feature_triage",
  "guided_setup",
  "review_launch",
  // Legacy step keys (for backwards compatibility)
  "account_profile",
  "payment_gateway",
  "taxes_and_fees",
  "inventory_sites",
  "rates_and_fees",
  "policies",
  "communications_templates",
  "pos_hardware",
  "imports",
]);

const OnboardingStatusEnum = z.enum([
  "pending",
  "in_progress",
  "completed",
  "expired",
  "cancelled",
]);

const OnboardingProgressSchema = z.object({
  currentStep: OnboardingStepEnum,
  nextStep: OnboardingStepEnum.nullable(),
  completedSteps: z.array(OnboardingStepEnum),
  remainingSteps: z.array(OnboardingStepEnum),
  percentage: z.number().min(0).max(100),
});

const OnboardingSessionSchema = z
  .object({
    id: z.string(),
    inviteId: z.string(),
    organizationId: z.string().nullable().optional(),
    campgroundId: z.string().nullable().optional(),
    campgroundSlug: z.string().nullable().optional(),
    status: OnboardingStatusEnum,
    currentStep: OnboardingStepEnum,
    completedSteps: z.array(OnboardingStepEnum).default([]),
    data: z.record(z.unknown()).nullable().optional(),
    progress: OnboardingProgressSchema.nullable().optional(),
    expiresAt: z.string().nullable().optional(),
    createdAt: z.string().optional(),
    updatedAt: z.string().optional(),
  })
  .passthrough();

const OnboardingSessionResponseSchema = z.object({
  session: OnboardingSessionSchema,
  progress: OnboardingProgressSchema,
});

const OnboardingInviteResponseSchema = z.object({
  inviteId: z.string(),
  token: z.string(),
  expiresAt: z.string(),
});

// Product schemas are imported from @keepr/shared

const FulfillmentStatusSchema = z.enum([
  "unassigned",
  "assigned",
  "preparing",
  "ready",
  "completed",
]);

const StoreOrderItemSchema = z.object({
  id: z.string(),
  name: z.string(),
  qty: z.number(),
  unitCents: z.number().optional(),
  totalCents: z.number().optional(),
  productId: z.string().nullable().optional(),
  addOnId: z.string().nullable().optional(),
});

const StoreOrderAdjustmentSchema = z.object({
  id: z.string(),
  type: z.enum(["refund", "exchange"]),
  amountCents: z.number(),
  note: z.string().nullable().optional(),
  createdAt: z.string(),
  createdBy: z
    .object({ id: z.string().optional(), name: z.string().nullable().optional() })
    .nullable()
    .optional(),
  items: z
    .array(
      z.object({
        itemId: z.string().optional(),
        name: z.string().optional(),
        qty: z.number().optional(),
        amountCents: z.number().optional(),
      }),
    )
    .default([]),
});

const StoreOrderSchema = z.object({
  id: z.string(),
  campgroundId: z.string(),
  reservationId: z.string().nullable().optional(),
  guestId: z.string().nullable().optional(),
  totalCents: z.number(),
  status: z.string(),
  paymentMethod: z.string().optional(),
  channel: z.enum(["pos", "online", "kiosk", "portal", "internal"]).optional(),
  fulfillmentType: z
    .enum(["pickup", "curbside", "delivery", "table_service"])
    .nullable()
    .optional(),
  fulfillmentStatus: FulfillmentStatusSchema.default("unassigned"),
  fulfillmentLocationId: z.string().nullable().default(null),
  assignedAt: z.string().nullable().default(null),
  deliveryInstructions: z.string().nullable().optional(),
  promisedAt: z.string().nullable().optional(),
  prepTimeMinutes: z.number().int().nullable().optional(),
  siteNumber: z.string().nullable().optional(),
  createdAt: z.string().optional(),
  items: z.array(StoreOrderItemSchema).default([]),
  adjustments: z.array(StoreOrderAdjustmentSchema).default([]),
});

// Public campground schemas
const PublicCampgroundListSchema = z.array(
  z.object({
    id: z.string(),
    name: z.string(),
    slug: z.string(),
    city: z.string().nullable(),
    state: z.string().nullable(),
    country: z.string().nullable().optional(),
    tagline: z.string().nullable().optional(),
    heroImageUrl: z.string().nullable(),
    amenities: z.array(z.string()),
    photos: z.array(z.string()).optional().default([]),
    isExternal: z.boolean().optional().default(false),
    isBookable: z.boolean().optional().default(true),
    externalUrl: z.string().nullable().optional(),
    reviewScore: z
      .preprocess(
        (val) => (val === null || val === undefined ? null : Number(val)),
        z.number().nullable(),
      )
      .optional(),
    reviewCount: z.number().optional(),
    amenitySummary: z.record(z.unknown()).nullable().optional(),
    // NPS fields
    npsScore: z.number().nullable().optional(),
    npsResponseCount: z.number().optional().default(0),
    npsRank: z.number().nullable().optional(),
    npsPercentile: z.number().nullable().optional(),
    isWorldClassNps: z.boolean().optional().default(false),
    isTopCampground: z.boolean().optional().default(false),
    isTop1PercentNps: z.boolean().optional().default(false),
    isTop5PercentNps: z.boolean().optional().default(false),
    isTop10PercentNps: z.boolean().optional().default(false),
    // Rising Star - most improved NPS
    isRisingStar: z.boolean().optional().default(false),
    npsImprovement: z.number().nullable().optional(),
    // Past Campground of the Year awards
    pastCampgroundOfYearAwards: z.array(z.number()).optional().default([]),
    // ADA Accessibility Certification
    adaCertificationLevel: z.string().nullable().optional(),
  }),
);

const PromotionSchema = z.object({
  id: z.string(),
  code: z.string(),
  type: z.enum(["percentage", "fixed_amount"]).optional().default("percentage"),
  value: z.number(),
  description: z.string().nullable(),
  validFrom: z.string().nullable(),
  validTo: z.string().nullable(),
});
const ReferralProgramSchema = z.object({
  id: z.string(),
  campgroundId: z.string(),
  code: z.string(),
  linkSlug: z.string().nullable(),
  source: z.string().nullable(),
  channel: z.string().nullable(),
  incentiveType: z.string(),
  incentiveValue: z.number().int(),
  isActive: z.boolean(),
  notes: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
const FormTemplateArray = z.array(FormTemplateSchema);
const FormSubmissionArray = z.array(FormSubmissionSchema);

// Use lenient parsing for public campground - API may return extra fields
const PublicCampgroundDetailSchema = CampgroundWithAnalyticsSchema.extend({
  siteClasses: z.array(SiteClassSchema.partial().passthrough()).default([]),
  events: z.array(z.record(z.unknown())),
  promotions: z.array(PromotionSchema).optional().default([]),
  showPublicMap: z.boolean().optional().default(false),
  isPreview: z.boolean().optional(),
}).passthrough();

export const CreatePublicWaitlistSchema = z.object({
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  email: z.string().email("Invalid email address"),
  phone: z.string().optional(),
  campgroundId: z.string(),
  arrivalDate: z.string(),
  departureDate: z.string(),
  siteId: z.string().optional(),
  siteClassId: z.string().optional(),
});
export type CreatePublicWaitlistDto = z.infer<typeof CreatePublicWaitlistSchema>;

const LoyaltyProfileSchema = z.object({
  id: z.string(),
  guestId: z.string(),
  pointsBalance: z.number(),
  tier: z.string(),
  transactions: z.array(
    z.object({
      id: z.string(),
      amount: z.number(),
      reason: z.string(),
      createdAt: z.string(),
    }),
  ),
});

const GuestEquipmentSchema = z.object({
  id: z.string(),
  guestId: z.string(),
  type: z.string(),
  make: z.string().nullable(),
  model: z.string().nullable(),
  length: z.number().nullable(),
  plateNumber: z.string().nullable(),
  plateState: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

const CampaignSchema = z.object({
  id: z.string(),
  campgroundId: z.string(),
  name: z.string(),
  subject: z.string(),
  fromEmail: z.string(),
  fromName: z.string().nullable(),
  html: z.string(),
  textBody: z.string().nullable(),
  channel: z.enum(["email", "sms", "both"]),
  status: z.enum(["draft", "scheduled", "sending", "sent", "cancelled"]),
  scheduledAt: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

const CampaignTemplateSchema = z.object({
  id: z.string(),
  campgroundId: z.string(),
  name: z.string(),
  channel: z.enum(["email", "sms", "both"]),
  category: z.string().nullable(),
  subject: z.string().nullable(),
  html: z.string().nullable(),
  textBody: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

const CommunicationListSchema = z.object({
  items: z.array(CommunicationSchema),
  nextCursor: z.string().nullable(),
});

const OtaChannelSchema = z
  .object({
    id: z.string(),
    campgroundId: z.string(),
    name: z.string(),
    provider: z.string(),
    status: z.string(),
    rateMultiplier: z.number().optional().default(1),
    defaultStatus: z.string().optional().default("confirmed"),
    sendEmailNotifications: z.boolean().optional().default(false),
    ignoreSiteRestrictions: z.boolean().optional().default(false),
    ignoreCategoryRestrictions: z.boolean().optional().default(false),
    feeMode: z.string().optional().default("absorb"),
    webhookSecret: z.string().nullable().optional(),
    lastSyncAt: z
      .union([z.string(), z.date()])
      .nullable()
      .optional()
      .transform((v) => (v instanceof Date ? v.toISOString() : v)),
    createdAt: z
      .union([z.string(), z.date()])
      .optional()
      .transform((v) => (v instanceof Date ? v.toISOString() : v)),
    updatedAt: z
      .union([z.string(), z.date()])
      .optional()
      .transform((v) => (v instanceof Date ? v.toISOString() : v)),
    mappings: z.array(z.unknown()).optional(),
  })
  .passthrough();

const OtaMappingSchema = z
  .object({
    id: z.string(),
    channelId: z.string(),
    siteId: z.string().nullable().optional(),
    siteClassId: z.string().nullable().optional(),
    externalId: z.string(),
    status: z.string().optional().default("mapped"),
    lastSyncAt: z
      .union([z.string(), z.date()])
      .nullable()
      .optional()
      .transform((v) => (v instanceof Date ? v.toISOString() : v)),
    lastError: z.string().nullable().optional(),
    icalToken: z.string().nullable().optional(),
    icalUrl: z.string().nullable().optional(),
    createdAt: z
      .union([z.string(), z.date()])
      .optional()
      .transform((v) => (v instanceof Date ? v.toISOString() : v)),
    updatedAt: z
      .union([z.string(), z.date()])
      .optional()
      .transform((v) => (v instanceof Date ? v.toISOString() : v)),
    site: z.object({ id: z.string(), name: z.string() }).nullable().optional(),
    siteClass: z.object({ id: z.string(), name: z.string() }).nullable().optional(),
  })
  .passthrough();

const OtaImportSchema = z
  .object({
    id: z.string(),
    channelId: z.string(),
    externalReservationId: z.string(),
    reservationId: z.string().nullable().optional(),
    status: z.string().optional().default("pending"),
    message: z.string().nullable().optional(),
    createdAt: z
      .union([z.string(), z.date()])
      .nullable()
      .optional()
      .transform((v) => (v instanceof Date ? v.toISOString() : v)),
    updatedAt: z
      .union([z.string(), z.date()])
      .nullable()
      .optional()
      .transform((v) => (v instanceof Date ? v.toISOString() : v)),
  })
  .passthrough();

const OtaConfigSchema = z.object({
  campgroundId: z.string(),
  provider: z.string(),
  externalAccountId: z.string().nullable().optional(),
  propertyId: z.string().nullable().optional(),
  apiKey: z.string().nullable().optional(),
  channelId: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  lastSyncStatus: z.enum(["not_started", "stubbed", "ok", "error"]).optional(),
  lastSyncAt: z.string().nullable().optional(),
  lastSyncMessage: z.string().nullable().optional(),
  lastUpdatedAt: z.string().nullable().optional(),
  pendingSyncs: z.number().optional(),
});

const OtaSyncStatusSchema = z.object({
  campgroundId: z.string(),
  lastSyncStatus: z.string(),
  lastSyncAt: z.string().nullable().optional(),
  lastSyncMessage: z.string().nullable().optional(),
  pendingSyncs: z.number().optional(),
});

const OtaLogSchema = z
  .object({
    id: z.string(),
    channelId: z.string(),
    direction: z.string().optional().default("pull"),
    eventType: z.string().optional().default("unknown"),
    status: z.string().optional().default("pending"),
    message: z.string().nullable().optional(),
    payload: z.unknown().nullable().optional(),
    createdAt: z
      .union([z.string(), z.date()])
      .nullable()
      .optional()
      .transform((v) => (v instanceof Date ? v.toISOString() : v)),
  })
  .passthrough();

export type OtaChannel = z.infer<typeof OtaChannelSchema>;
export type OtaMapping = z.infer<typeof OtaMappingSchema>;
export type OtaImport = z.infer<typeof OtaImportSchema>;
export type OtaConfig = z.infer<typeof OtaConfigSchema>;
export type OtaSyncStatus = z.infer<typeof OtaSyncStatusSchema>;
export type OtaLog = z.infer<typeof OtaLogSchema>;

function resolveApiBase() {
  // NEXT_PUBLIC_API_BASE can override for specific environments
  if (process.env.NEXT_PUBLIC_API_BASE) return process.env.NEXT_PUBLIC_API_BASE;
  // Use relative /api path - Next.js rewrites will proxy to the backend
  return "/api";
}

const API_BASE = resolveApiBase();
const UnknownSchema = z.unknown();
const UnknownArraySchema = z.array(z.unknown());
const UnknownRecordSchema = z.record(z.unknown());

function createRequestId() {
  if (typeof globalThis !== "undefined") {
    const cryptoObj = globalThis.crypto;
    if (cryptoObj && "randomUUID" in cryptoObj && typeof cryptoObj.randomUUID === "function") {
      return `req_${cryptoObj.randomUUID()}`;
    }
  }
  return `req_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

function scopedHeaders(extra?: Record<string, string>) {
  const headers: Record<string, string> = extra ? { ...extra } : {};
  const requestId = headers["x-request-id"] || headers["X-Request-Id"];
  if (!requestId) {
    headers["x-request-id"] = createRequestId();
  } else if (requestId) {
    headers["x-request-id"] = requestId;
    delete headers["X-Request-Id"];
  }
  const traceparent = headers["traceparent"] || headers["Traceparent"];
  if (traceparent) {
    headers["traceparent"] = traceparent;
    delete headers["Traceparent"];
  }
  const tracestate = headers["tracestate"] || headers["Tracestate"];
  if (tracestate) {
    headers["tracestate"] = tracestate;
    delete headers["Tracestate"];
  }
  if (typeof window !== "undefined") {
    const cg = localStorage.getItem("campreserv:selectedCampground");
    const org = localStorage.getItem("campreserv:selectedOrg");
    const portfolio = localStorage.getItem("campreserv:selectedPortfolio");
    const park = localStorage.getItem("campreserv:selectedPark");
    const locale = localStorage.getItem("campreserv:locale");
    const currency = localStorage.getItem("campreserv:currency");
    const token = localStorage.getItem("campreserv:authToken");
    if (cg) headers["x-campground-id"] = cg;
    if (org) headers["x-organization-id"] = org;
    if (portfolio) headers["x-portfolio-id"] = portfolio;
    if (park) headers["x-park-id"] = park;
    if (locale) headers["x-locale"] = locale;
    if (currency) headers["x-currency"] = currency;
    if (!headers["Authorization"] && token) headers["Authorization"] = `Bearer ${token}`;
    headers["x-client"] = "pwa";
  }
  return headers;
}

function resolveCampgroundId(preferred?: string) {
  if (preferred) return preferred;
  if (typeof window !== "undefined") {
    try {
      const stored = localStorage.getItem("campreserv:selectedCampground");
      if (stored) return stored;
    } catch {
      // ignore storage access errors
    }
  }
  return undefined;
}

function withCampgroundId(path: string, campgroundId?: string) {
  const resolved = resolveCampgroundId(campgroundId);
  if (!resolved) return path;
  const separator = path.includes("?") ? "&" : "?";
  return `${path}${separator}campgroundId=${encodeURIComponent(resolved)}`;
}

async function fetchJSON<T>(path: string, schema: z.ZodType<T>, headers?: Record<string, string>) {
  const res = await fetch(`${API_BASE}${path}`, {
    next: { revalidate: 0 },
    headers: scopedHeaders(headers),
  });
  return parseResponse(res, schema);
}

function fetchJSONUnknown(path: string, headers?: Record<string, string>) {
  return fetchJSON(path, UnknownSchema, headers);
}

async function parseResponse<T>(res: Response, schema: z.ZodType<T>): Promise<T> {
  const text = await res.text();
  if (res.ok) {
    const data = text ? JSON.parse(text) : undefined;
    return schema.parse(data);
  }
  let message = `Request failed: ${res.status}`;
  try {
    const body = text ? JSON.parse(text) : undefined;
    if (isRecord(body)) {
      const bodyMessage = body.message;
      if (typeof bodyMessage === "string") {
        message = bodyMessage;
      } else if (
        Array.isArray(bodyMessage) &&
        bodyMessage.every((entry) => typeof entry === "string")
      ) {
        message = bodyMessage.join(", ");
      }
    }
  } catch {
    // ignore parse errors
  }
  throw Object.assign(new Error(message), { status: res.status });
}

const LeadStatusEnum = z.enum(["new", "contacted", "qualified"]);
const LeadRecordSchema = z.object({
  id: z.string(),
  campgroundId: z.string(),
  campgroundName: z.string().nullable().optional(),
  name: z.string(),
  email: z.string(),
  interest: z.string(),
  status: LeadStatusEnum,
  source: z.string().optional(),
  createdAt: z.string(),
  lastSyncedAt: z.string().nullable().optional(),
});

export type LeadStatus = z.infer<typeof LeadStatusEnum>;
export type LeadRecord = z.infer<typeof LeadRecordSchema>;

const leadStorageKey = "campreserv:leads";
let inMemoryLeads: LeadRecord[] = [];

const seededLeads: LeadRecord[] = [
  {
    id: "lead-demo-1",
    campgroundId: "public-site",
    campgroundName: "Keepr demo",
    name: "Taylor Routes",
    email: "hello@keeprstay.com",
    interest: "Improve booking conversions from ads and track referral performance.",
    status: "new",
    source: "landing",
    createdAt: "2025-12-07T10:00:00.000Z",
    lastSyncedAt: null,
  },
  {
    id: "lead-demo-2",
    campgroundId: "public-site",
    campgroundName: "Keepr demo",
    name: "Jordan Creek",
    email: "hello@keeprstay.com",
    interest: "Marketing automation for abandoned carts and promo reporting.",
    status: "contacted",
    source: "admin-import",
    createdAt: "2025-12-06T16:30:00.000Z",
    lastSyncedAt: "2025-12-07T13:15:00.000Z",
  },
  {
    id: "lead-demo-3",
    campgroundId: "pine-lake",
    campgroundName: "Pine Lake",
    name: "Sam Rivers",
    email: "hello@keeprstay.com",
    interest: "Want guest messaging + promo codes before next holiday weekend.",
    status: "qualified",
    source: "referral",
    createdAt: "2025-12-05T09:20:00.000Z",
    lastSyncedAt: null,
  },
];

function getCurrentCampgroundId(preferredId?: string) {
  if (preferredId) return preferredId;
  if (typeof window !== "undefined") {
    const stored = localStorage.getItem("campreserv:selectedCampground");
    if (stored) return stored;
  }
  return "public-site";
}

function readLeadStore(): LeadRecord[] {
  if (typeof window === "undefined") return inMemoryLeads.length ? inMemoryLeads : seededLeads;
  try {
    const raw = localStorage.getItem(leadStorageKey);
    if (!raw) {
      if (inMemoryLeads.length === 0) {
        return persistLeadStore(seededLeads);
      }
      return inMemoryLeads;
    }
    const parsed = LeadRecordSchema.array().safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : inMemoryLeads;
  } catch {
    return inMemoryLeads.length ? inMemoryLeads : seededLeads;
  }
}

function persistLeadStore(leads: LeadRecord[]) {
  inMemoryLeads = leads;
  if (typeof window !== "undefined") {
    try {
      localStorage.setItem(leadStorageKey, JSON.stringify(leads));
    } catch {
      // Swallow storage failures; this stays stubbed client-side.
    }
  }
  return leads;
}

function generateLeadId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `lead-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function upsertLead(record: LeadRecord) {
  const leads = readLeadStore();
  const next = [record, ...leads.filter((lead) => lead.id !== record.id)];
  persistLeadStore(next);
  return record;
}

function updateLead(id: string, updater: (lead: LeadRecord) => LeadRecord) {
  const leads = readLeadStore();
  let updated: LeadRecord | null = null;
  const next = leads.map((lead) => {
    if (lead.id === id) {
      updated = updater(lead);
      return updated;
    }
    return lead;
  });
  persistLeadStore(next);
  return updated;
}

const StaffRoleEnum = z.enum([
  "owner",
  "manager",
  "front_desk",
  "maintenance",
  "finance",
  "marketing",
  "readonly",
]);
const GamificationCategoryEnum = z.enum([
  "task",
  "maintenance",
  "check_in",
  "reservation_quality",
  "checklist",
  "review_mention",
  "on_time_assignment",
  "assist",
  "manual",
  "other",
  "payment_collection",
]);

const GamificationSettingSchema = z.object({
  id: z.string().nullable().optional(),
  campgroundId: z.string(),
  enabled: z.boolean().default(false),
  enabledRoles: z.array(StaffRoleEnum).default([]),
  createdAt: z.string().nullable().optional(),
  updatedAt: z.string().nullable().optional(),
});

const GamificationRuleSchema = z.object({
  id: z.string(),
  campgroundId: z.string(),
  category: GamificationCategoryEnum,
  minXp: z.number(),
  maxXp: z.number(),
  defaultXp: z.number(),
  isActive: z.boolean(),
  createdById: z.string().nullable().optional(),
  createdAt: z.string().nullable().optional(),
  updatedAt: z.string().nullable().optional(),
});

const GamificationLevelSchema = z.object({
  id: z.string(),
  level: z.number(),
  name: z.string(),
  minXp: z.number(),
  perks: z.unknown().nullable().optional(),
  createdAt: z.string().nullable().optional(),
});

const GamificationEventSchema = z.object({
  id: z.string(),
  campgroundId: z.string(),
  userId: z.string(),
  membershipId: z.string().nullable(),
  category: GamificationCategoryEnum,
  xp: z.number(),
  reason: z.string().nullable(),
  sourceType: z.string().nullable(),
  sourceId: z.string().nullable(),
  eventKey: z.string().nullable(),
  metadata: z.unknown().nullable().optional(),
  occurredAt: z.string(),
  createdAt: z.string(),
});

const GamificationBalanceSchema = z.object({
  id: z.string().nullable(),
  campgroundId: z.string(),
  userId: z.string(),
  totalXp: z.number(),
  currentLevel: z.number(),
  lastEventAt: z.string().nullable(),
  createdAt: z.string().nullable(),
  updatedAt: z.string().nullable(),
});

const GamificationLevelProgressSchema = z.object({
  level: z.number(),
  name: z.string().nullable().optional(),
  minXp: z.number(),
  nextLevel: z.number().nullable().optional(),
  nextMinXp: z.number().nullable().optional(),
  progressToNext: z.number(),
});

const GamificationAwardResultSchema = z.object({
  skipped: z.boolean().optional(),
  reason: z.string().nullable().optional(),
  event: GamificationEventSchema.nullable().optional(),
  balance: GamificationBalanceSchema.nullable().optional(),
  level: GamificationLevelProgressSchema.nullable().optional(),
});

const GamificationDashboardSchema = z.object({
  enabled: z.boolean(),
  allowed: z.boolean(),
  membershipRole: StaffRoleEnum.nullable(),
  setting: GamificationSettingSchema,
  balance: GamificationBalanceSchema.nullable().optional(),
  level: GamificationLevelProgressSchema.nullable().optional(),
  recentEvents: z.array(GamificationEventSchema).default([]),
});

const GamificationLeaderboardSchema = z.object({
  leaderboard: z.array(
    z.object({
      userId: z.string(),
      rank: z.number(),
      xp: z.number(),
      name: z.string(),
      role: StaffRoleEnum.nullable(),
    }),
  ),
  viewer: z
    .object({
      userId: z.string(),
      rank: z.number().nullable(),
      xp: z.number(),
      name: z.string(),
      role: StaffRoleEnum.nullable(),
    })
    .nullable()
    .optional(),
  since: z.string(),
});

const GamificationStatsSchema = z.object({
  categories: z.array(
    z.object({
      category: GamificationCategoryEnum,
      xp: z.number(),
    }),
  ),
  since: z.string(),
});

// Social planner schemas
const SocialPostSchema = z.object({
  id: z.string(),
  campgroundId: z.string(),
  title: z.string(),
  platform: z.string(),
  status: z.string(),
  category: z.string().nullable().optional(),
  scheduledFor: z.string().nullable().optional(),
  publishedFor: z.string().nullable().optional(),
  caption: z.string().nullable().optional(),
  hashtags: z.array(z.string()).default([]),
  imagePrompt: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  templateId: z.string().nullable().optional(),
  assetUrls: z.array(z.string()).default([]),
  tags: z.array(z.string()).default([]),
  ideaParkingLot: z.boolean().default(false),
  suggestionId: z.string().nullable().optional(),
});

const SocialTemplateSchemaLocal = z.object({
  id: z.string(),
  campgroundId: z.string(),
  name: z.string(),
  summary: z.string().nullable().optional(),
  category: z.string().nullable().optional(),
  style: z.string().nullable().optional(),
  defaultCaption: z.string().nullable().optional(),
  captionFillIns: z.string().nullable().optional(),
  imageGuidance: z.string().nullable().optional(),
  hashtagSet: z.array(z.string()).default([]),
  bestTime: z.string().nullable().optional(),
});

const SocialAssetSchema = z.object({
  id: z.string(),
  campgroundId: z.string(),
  title: z.string(),
  type: z.string(),
  url: z.string(),
  tags: z.array(z.string()).default([]),
  notes: z.string().nullable().optional(),
});

const SocialSuggestionSchema = z.object({
  id: z.string(),
  campgroundId: z.string(),
  type: z.string(),
  status: z.string(),
  message: z.string(),
  category: z.string().nullable().optional(),
  platform: z.string().nullable().optional(),
  proposedDate: z.string().nullable().optional(),
  opportunityAt: z.string().nullable().optional(),
  postId: z.string().nullable().optional(),
  reason: z.unknown().nullable().optional(),
});

const SocialWeeklyIdeaSchema = z.object({
  id: z.string(),
  campgroundId: z.string(),
  generatedFor: z.string(),
  ideas: z.array(z.object({ type: z.string(), idea: z.string(), platform: z.string() })).optional(),
  cadence: z.array(z.object({ day: z.string(), theme: z.string() })).optional(),
});

const SocialStrategySchema = z.object({
  id: z.string(),
  campgroundId: z.string(),
  month: z.string(),
  annual: z.boolean(),
  plan: z.unknown(),
});

const SocialAlertSchema = z.object({
  id: z.string(),
  campgroundId: z.string(),
  category: z.string(),
  message: z.string(),
  startsAt: z.string().nullable().optional(),
  endsAt: z.string().nullable().optional(),
  dismissed: z.boolean().optional(),
});

const SocialReportSchema = z.object({
  posts: z.number(),
  templates: z.number(),
  openSuggestions: z.number(),
  performance: z
    .object({
      likes: z.number().optional().default(0),
      reach: z.number().optional().default(0),
      comments: z.number().optional().default(0),
      shares: z.number().optional().default(0),
      saves: z.number().optional().default(0),
    })
    .default({
      likes: 0,
      reach: 0,
      comments: 0,
      shares: 0,
      saves: 0,
    }),
});

const IntegrationConnectionSchema = z.object({
  id: z.string(),
  campgroundId: z.string().nullable().optional(),
  organizationId: z.string().nullable().optional(),
  type: z.string(),
  provider: z.string(),
  status: z.string(),
  authType: z.string().nullable().optional(),
  credentials: z.unknown().nullable().optional(),
  settings: z.unknown().nullable().optional(),
  webhookSecret: z.string().nullable().optional(),
  lastSyncAt: z.string().nullable().optional(),
  lastSyncStatus: z.string().nullable().optional(),
  lastError: z.string().nullable().optional(),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
  logs: z
    .array(
      z.object({
        id: z.string(),
        status: z.string(),
        message: z.string().nullable().optional(),
        scope: z.string().nullable().optional(),
        direction: z.string().nullable().optional(),
        occurredAt: z.string().optional(),
      }),
    )
    .optional(),
});

const IntegrationLogPageSchema = z.object({
  items: z.array(
    z.object({
      id: z.string(),
      connectionId: z.string(),
      direction: z.string(),
      scope: z.string(),
      status: z.string(),
      message: z.string().nullable().optional(),
      payload: z.unknown().nullable().optional(),
      occurredAt: z.string().optional(),
    }),
  ),
  nextCursor: z.string().nullable(),
});

const IntegrationWebhookPageSchema = z.object({
  items: z.array(
    z.object({
      id: z.string(),
      connectionId: z.string().nullable().optional(),
      provider: z.string(),
      eventType: z.string().nullable().optional(),
      status: z.string(),
      signatureValid: z.boolean().nullable().optional(),
      message: z.string().nullable().optional(),
      payload: z.unknown().nullable().optional(),
      receivedAt: z.string().optional(),
    }),
  ),
  nextCursor: z.string().nullable(),
});

const WebhookEndpointSchema = z.object({
  id: z.string(),
  campgroundId: z.string().nullish(),
  url: z.string(),
  eventTypes: z.array(z.string()).default([]),
  isActive: z.boolean(),
  description: z.string().nullable(),
  createdAt: z.string(),
});

const WebhookDeliverySchema = z.object({
  id: z.string(),
  eventType: z.string(),
  status: z.string(),
  responseStatus: z.string().nullable().optional(),
  webhookEndpoint: z.object({ url: z.string() }).nullable().optional(),
  createdAt: z.string(),
});

const IntegrationExportJobSchema = z.object({
  id: z.string(),
  connectionId: z.string().nullable().optional(),
  campgroundId: z.string().nullable().optional(),
  type: z.string(),
  resource: z.string().nullable().optional(),
  status: z.string(),
  location: z.string().nullable().optional(),
  requestedById: z.string().nullable().optional(),
  startedAt: z.string().nullable().optional(),
  completedAt: z.string().nullable().optional(),
  lastError: z.string().nullable().optional(),
  filters: z.unknown().nullable().optional(),
  downloadUrl: z.string().nullable().optional(),
  summary: z.unknown().nullable().optional(),
  createdAt: z.string().optional(),
});

const AiRecommendationSchema = z.object({
  type: z.string(),
  title: z.string(),
  reason: z.string(),
  cta: z.string().optional(),
  targetId: z.string().optional(),
});

const AiRecommendationResponseSchema = z.object({
  campgroundId: z.string(),
  guestId: z.string().nullable(),
  intent: z.string(),
  items: z.array(AiRecommendationSchema),
  generatedAt: z.string(),
});

const AiPricingSuggestionSchema = z.object({
  campgroundId: z.string(),
  siteClassId: z.string().nullable(),
  window: z.object({
    arrivalDate: z.string().nullable(),
    departureDate: z.string().nullable(),
  }),
  baseRateCents: z.number(),
  suggestedRateCents: z.number(),
  currency: z.string(),
  demandIndex: z.number(),
  factors: z.array(z.object({ label: z.string(), value: z.string(), weight: z.number() })),
  comparableSites: z.array(
    z.object({ name: z.string(), rateCents: z.number(), distanceMiles: z.number() }),
  ),
  notes: z.string(),
  generatedAt: z.string(),
});

const AiSemanticSearchResponseSchema = z.object({
  campgroundId: z.string().nullable(),
  query: z.string(),
  results: z.array(
    z.object({
      type: z.string(),
      id: z.string(),
      title: z.string(),
      snippet: z.string(),
      score: z.number(),
    }),
  ),
  generatedAt: z.string(),
});

const AiCopilotResponseSchema = z.object({
  action: z.string(),
  generatedAt: z.string(),
  mode: z.string().optional(),
  // Response content (varies by action)
  preview: z.string().optional(),
  message: z.string().optional(),
  error: z.string().optional(),
  // Action response data
  steps: z.array(z.string()).optional(),
  impact: z.string().optional(),
  tone: z.string().optional(),
  // Help action
  availableActions: z
    .array(
      z.object({
        action: z.string(),
        description: z.string(),
        params: z.array(z.string()).optional(),
      }),
    )
    .optional(),
  // Pricing actions
  recommendations: z.array(z.unknown()).optional(),
  summary: z.unknown().optional(),
  result: z.unknown().optional(),
  // Revenue actions
  insights: z.array(z.unknown()).optional(),
  // Weather actions
  weather: z.unknown().optional(),
  forecast: z.array(z.unknown()).optional(),
  alerts: z.array(z.unknown()).optional(),
  activeAlerts: z.array(z.unknown()).optional(),
  newAlerts: z.array(z.unknown()).optional(),
  // Dashboard actions
  metrics: z.unknown().optional(),
  quickStats: z.unknown().optional(),
  activity: z.array(z.unknown()).optional(),
});

type JsonRenderDynamicValue = string | number | boolean | null | { path: string };

type JsonRenderDynamicNumberValue = number | { path: string };

type JsonRenderLogicExpression =
  | { and: JsonRenderLogicExpression[] }
  | { or: JsonRenderLogicExpression[] }
  | { not: JsonRenderLogicExpression }
  | { path: string }
  | { eq: [JsonRenderDynamicValue, JsonRenderDynamicValue] }
  | { neq: [JsonRenderDynamicValue, JsonRenderDynamicValue] }
  | { gt: [JsonRenderDynamicNumberValue, JsonRenderDynamicNumberValue] }
  | { gte: [JsonRenderDynamicNumberValue, JsonRenderDynamicNumberValue] }
  | { lt: [JsonRenderDynamicNumberValue, JsonRenderDynamicNumberValue] }
  | { lte: [JsonRenderDynamicNumberValue, JsonRenderDynamicNumberValue] };

type JsonRenderVisibilityCondition =
  | boolean
  | { path: string }
  | { auth: "signedIn" | "signedOut" }
  | JsonRenderLogicExpression;

type JsonRenderElement = {
  key: string;
  type: string;
  props: Record<string, unknown>;
  children?: string[];
  parentKey?: string | null;
  visible?: JsonRenderVisibilityCondition;
};

type JsonRenderTree = {
  root: string;
  elements: Record<string, JsonRenderElement>;
};

const JsonRenderDynamicValueSchema = z.union([
  z.string(),
  z.number(),
  z.boolean(),
  z.null(),
  z.object({ path: z.string() }),
]);

const JsonRenderDynamicNumberValueSchema = z.union([z.number(), z.object({ path: z.string() })]);

const JsonRenderLogicExpressionSchema: z.ZodType<JsonRenderLogicExpression> = z.lazy(() =>
  z.union([
    z.object({ and: z.array(JsonRenderLogicExpressionSchema) }),
    z.object({ or: z.array(JsonRenderLogicExpressionSchema) }),
    z.object({ not: JsonRenderLogicExpressionSchema }),
    z.object({ path: z.string() }),
    z.object({ eq: z.tuple([JsonRenderDynamicValueSchema, JsonRenderDynamicValueSchema]) }),
    z.object({ neq: z.tuple([JsonRenderDynamicValueSchema, JsonRenderDynamicValueSchema]) }),
    z.object({
      gt: z.tuple([JsonRenderDynamicNumberValueSchema, JsonRenderDynamicNumberValueSchema]),
    }),
    z.object({
      gte: z.tuple([JsonRenderDynamicNumberValueSchema, JsonRenderDynamicNumberValueSchema]),
    }),
    z.object({
      lt: z.tuple([JsonRenderDynamicNumberValueSchema, JsonRenderDynamicNumberValueSchema]),
    }),
    z.object({
      lte: z.tuple([JsonRenderDynamicNumberValueSchema, JsonRenderDynamicNumberValueSchema]),
    }),
  ]),
);

const JsonRenderVisibilityConditionSchema: z.ZodType<JsonRenderVisibilityCondition> = z.union([
  z.boolean(),
  z.object({ path: z.string() }),
  z.object({ auth: z.enum(["signedIn", "signedOut"]) }),
  JsonRenderLogicExpressionSchema,
]);

const AiUiElementSchema: z.ZodType<JsonRenderElement> = z.object({
  key: z.string(),
  type: z.string(),
  props: z.record(z.unknown()),
  children: z.array(z.string()).optional(),
  parentKey: z.string().nullable().optional(),
  visible: JsonRenderVisibilityConditionSchema.optional(),
});

const AiUiTreeSchema: z.ZodType<JsonRenderTree> = z.object({
  root: z.string(),
  elements: z.record(AiUiElementSchema),
});

const AiUiBuilderResponseSchema = z.object({
  tree: AiUiTreeSchema,
  warnings: z.array(z.string()).optional(),
});

export type AiUiBuilderTree = JsonRenderTree;

// ---------------------------------------------------------------------------
// Enterprise scale & internationalization schemas
// ---------------------------------------------------------------------------
const PortfolioParkSchema = z.object({
  id: z.string(),
  name: z.string(),
  region: z.string(),
  currency: z.string(),
  occupancy: z.number(),
  adr: z.number(),
  revpar: z.number(),
  mtdRevenue: z.number(),
  fxToHome: z.number().optional(),
  taxSummary: z.string().optional(),
  timezone: z.string().optional(),
  routing: z
    .object({
      adminHost: z.string().nullable().optional(),
      guestHost: z.string().nullable().optional(),
      path: z.string().nullable().optional(),
    })
    .optional(),
});

const PortfolioSummarySchema = z.object({
  id: z.string(),
  name: z.string(),
  homeCurrency: z.string(),
  parks: z.array(PortfolioParkSchema),
});

const PortfolioListSchema = z.object({
  portfolios: z.array(PortfolioSummarySchema),
  activePortfolioId: z.string().nullable(),
  activeParkId: z.string().nullable(),
});

const PortfolioReportSchema = z.object({
  portfolioId: z.string(),
  homeCurrency: z.string().optional(),
  asOf: z.string(),
  metrics: z.array(
    z.object({
      parkId: z.string(),
      name: z.string(),
      region: z.string(),
      currency: z.string(),
      occupancy: z.number(),
      adr: z.number(),
      revpar: z.number(),
      revenue: z.number(),
      revenueHome: z.number(),
      fxToHome: z.number().optional(),
      taxSummary: z.string().optional(),
    }),
  ),
  rollup: z.object({
    currency: z.string(),
    revenueHome: z.number(),
    occupancy: z.number(),
    adr: z.number(),
    revpar: z.number(),
  }),
  routing: z
    .array(
      z.object({
        parkId: z.string(),
        adminHost: z.string().nullable().optional(),
        guestHost: z.string().nullable().optional(),
        path: z.string().nullable().optional(),
      }),
    )
    .optional(),
  recommendations: z
    .array(
      z.object({
        id: z.string(),
        title: z.string(),
        impact: z.string(),
        area: z.string(),
      }),
    )
    .optional(),
});

const LocaleOptionSchema = z.object({
  code: z.string(),
  label: z.string(),
  currency: z.string(),
  timezone: z.string(),
  dateFormat: z.string(),
  numberFormat: z.string(),
});

const LocalizationSettingsSchema = z.object({
  locale: z.string(),
  currency: z.string(),
  timezone: z.string(),
  updatedAt: z.string(),
  orgLocale: z.string().nullable().optional(),
  orgCurrency: z.string().nullable().optional(),
});

const LocalizationPreviewSchema = z.object({
  sampleDate: z.string(),
  formattedDate: z.string(),
  formattedNumber: z.string(),
  formattedCurrency: z.string(),
  translatedPhrases: z.record(z.string()),
});

const FxRateSchema = z.object({
  base: z.string(),
  quote: z.string(),
  rate: z.number(),
  asOf: z.string(),
});

const TaxProfileSchema = z.object({
  id: z.string(),
  name: z.string(),
  region: z.string(),
  type: z.enum(["vat", "gst", "sales"]),
  rate: z.number(),
  inclusive: z.boolean(),
  notes: z.string().optional(),
});

const CurrencyTaxConfigSchema = z.object({
  baseCurrency: z.string(),
  reportingCurrency: z.string(),
  fxProvider: z.string(),
  fxRates: z.array(FxRateSchema),
  taxProfiles: z.array(TaxProfileSchema),
  parkCurrencies: z.array(
    z.object({
      parkId: z.string(),
      currency: z.string(),
      taxProfileId: z.string(),
    }),
  ),
  updatedAt: z.string(),
});

const ConversionResultSchema = z.object({
  amount: z.number(),
  from: z.string(),
  to: z.string(),
  rate: z.number(),
  converted: z.number(),
  asOf: z.string(),
});

const ApprovalRequestSchema = z.object({
  id: z.string(),
  type: z.enum(["refund", "payout", "config_change"]),
  amount: z.number(),
  currency: z.string(),
  status: z.enum(["pending", "pending_second", "approved", "rejected"]),
  reason: z.string(),
  requester: z.string(),
  approvals: z.array(z.object({ approver: z.string(), at: z.string() })),
  requiredApprovals: z.number(),
  metadata: z.record(z.unknown()).optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
  policyId: z.string(),
});

const ApprovalPolicySchema = z.object({
  id: z.string(),
  name: z.string(),
  appliesTo: z.array(z.string()),
  thresholdCents: z.number().nullable().optional(),
  currency: z.string().nullable().optional(),
  approversNeeded: z.number(),
  description: z.string().nullable().optional(),
  isActive: z.boolean().optional(),
  approverRoles: z.array(z.string()).optional(),
  campgroundId: z.string().nullable().optional(),
});

const ApprovalListSchema = z.object({
  requests: z.array(ApprovalRequestSchema),
  policies: z.array(ApprovalPolicySchema),
});

const RestoreSimulationSchema = z.object({
  status: z.enum(["idle", "running", "ok", "error"]),
  lastRunAt: z.string().nullable(),
  message: z.string().nullable().optional(),
});

const BackupStatusSchema = z.object({
  campgroundId: z.string(),
  lastBackupAt: z.string(),
  lastBackupLocation: z.string(),
  retentionDays: z.number(),
  restoreSimulation: RestoreSimulationSchema,
});

const IncidentTaskSchema = z.object({
  id: z.string(),
  incidentId: z.string(),
  title: z.string(),
  status: z.string(),
  dueAt: z.string().nullable().optional(),
  reminderAt: z.string().nullable().optional(),
  assignedTo: z.string().nullable().optional(),
  completedAt: z.string().nullable().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

const IncidentEvidenceSchema = z.object({
  id: z.string(),
  incidentId: z.string(),
  type: z.string(),
  url: z.string().nullable().optional(),
  storageKey: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
  uploadedBy: z.string().nullable().optional(),
  uploadedAt: z.string(),
});

const CertificateOfInsuranceSchema = z.object({
  id: z.string(),
  campgroundId: z.string(),
  incidentId: z.string().nullable().optional(),
  reservationId: z.string().nullable().optional(),
  guestId: z.string().nullable().optional(),
  fileUrl: z.string(),
  provider: z.string().nullable().optional(),
  policyNumber: z.string().nullable().optional(),
  coverageType: z.string().nullable().optional(),
  effectiveDate: z.string().nullable().optional(),
  expiresAt: z.string().nullable().optional(),
  uploadedBy: z.string().nullable().optional(),
  uploadedAt: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

const IncidentSchema = z.object({
  id: z.string(),
  campgroundId: z.string(),
  reservationId: z.string().nullable().optional(),
  guestId: z.string().nullable().optional(),
  type: z.string(),
  status: z.string(),
  severity: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  photos: z.unknown().nullable().optional(),
  witnesses: z.unknown().nullable().optional(),
  occurredAt: z.string().nullable().optional(),
  closedAt: z.string().nullable().optional(),
  claimId: z.string().nullable().optional(),
  reminderAt: z.string().nullable().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
  tasks: z.array(IncidentTaskSchema).optional(),
  evidence: z.array(IncidentEvidenceSchema).optional(),
  cois: z.array(CertificateOfInsuranceSchema).optional(),
});

const IncidentReportSchema = z.object({
  byStatus: z.array(z.object({ status: z.string(), _count: z.object({ _all: z.number() }) })),
  byType: z.array(z.object({ type: z.string(), _count: z.object({ _all: z.number() }) })),
  openTasks: z.number(),
  generatedAt: z.string(),
});

export const UtilityMeterSchema = z.object({
  id: z.string(),
  campgroundId: z.string(),
  siteId: z.string(),
  type: z.string(),
  serialNumber: z.string().nullable().optional(),
  model: z.string().nullable().optional(),
  status: z.string().optional().default("active"),
  ratePlanId: z.string().nullable().optional(),
  billingMode: z.string().nullable().optional(),
  billTo: z.string().nullable().optional(),
  multiplier: z.number().nullable().optional(),
  autoEmail: z.boolean().nullable().optional(),
  lastBilledReadAt: z.string().nullable().optional(),
  active: z.boolean().optional(),
  metadata: z.record(z.unknown()).nullable().optional(),
  reads: z
    .array(
      z.object({
        readingValue: numberish(z.number()),
        readAt: z.string().or(z.date()),
      }),
    )
    .optional(),
});

export const SmartLockSchema = z.object({
  id: z.string(),
  campgroundId: z.string(),
  siteId: z.string().nullable().optional(),
  name: z.string().nullable().optional(),
  vendor: z.string(),
  status: z.string(),
  batteryLevel: numberish(z.number().nullable().optional()),
  metadata: z.record(z.unknown()).nullable().optional(),
});

const UtilityMeterReadSchema = z.object({
  id: z.string(),
  meterId: z.string(),
  readingValue: z.number(),
  readAt: z.string(),
  source: z.string().nullable().optional(),
  note: z.string().nullable().optional(),
  readBy: z.string().nullable().optional(),
});

const UtilityRatePlanSchema = z.object({
  id: z.string(),
  campgroundId: z.string(),
  type: z.string(),
  pricingMode: z.string(),
  baseRateCents: z.number().int(),
  tiers: z.unknown().nullable().optional(),
  demandFeeCents: z.number().int().nullable().optional(),
  minimumCents: z.number().int().nullable().optional(),
  effectiveFrom: z.string(),
  effectiveTo: z.string().nullable().optional(),
});

const InvoiceLineSchema = z.object({
  id: z.string(),
  invoiceId: z.string(),
  type: z.string(),
  description: z.string(),
  quantity: z.number(),
  unitCents: z.number(),
  amountCents: z.number(),
  meta: z.unknown().nullable().optional(),
});

const InvoiceSchema = z.object({
  id: z.string(),
  number: z.string(),
  status: z.string(),
  dueDate: z.string(),
  subtotalCents: z.number(),
  totalCents: z.number(),
  balanceCents: z.number(),
  lines: z.array(InvoiceLineSchema).nullable().optional(),
});

const MapConflictSchema = z.object({
  type: z.string(),
  id: z.string(),
  start: z.string().nullable().optional(),
  end: z.string().nullable().optional(),
  status: z.string().nullable().optional(),
  reason: z.string().nullable().optional(),
});

const MapSiteSchema = z.object({
  siteId: z.string(),
  shapeId: z.string().nullable().optional(),
  name: z.string(),
  siteNumber: z.string(),
  geometry: z.unknown(),
  centroid: z.unknown().nullable().optional(),
  label: z.string().nullable().optional(),
  rotation: z.number().nullable().optional(),
  ada: z.boolean().optional(),
  amenityTags: z.array(z.string()).default([]),
  rigConstraints: z
    .object({
      length: z.number().nullable().optional(),
      width: z.number().nullable().optional(),
      height: z.number().nullable().optional(),
      pullThrough: z.boolean().optional(),
    })
    .partial(),
  hookups: z.object({
    power: z.boolean().default(false),
    powerAmps: z.array(z.number()).default([]),
    water: z.boolean().default(false),
    sewer: z.boolean().default(false),
  }),
  status: z.string().nullable().optional(),
  conflicts: z.array(MapConflictSchema).default([]),
});

const MapShapeSchema = z.object({
  id: z.string(),
  name: z.string().nullable().optional(),
  geometry: z.unknown(),
  centroid: z.unknown().nullable().optional(),
  metadata: z.unknown().nullable().optional(),
  assignedSiteId: z.string().nullable().optional(),
});

const MapConfigSchema = z.object({
  bounds: z.unknown().nullable().optional(),
  defaultCenter: z.unknown().nullable().optional(),
  defaultZoom: z.number().nullable().optional(),
  layers: z.unknown().nullable().optional(),
  legend: z.unknown().nullable().optional(),
});

const CampgroundMapSchema = z.object({
  config: MapConfigSchema.nullable().optional(),
  sites: z.array(MapSiteSchema),
  shapes: z.array(MapShapeSchema).optional(),
});

const PreviewAssignmentSchema = z.object({
  siteId: z.string(),
  reasons: z.array(z.string()).default([]),
  conflicts: z.array(MapConflictSchema).default([]),
});

const PreviewAssignmentsResultSchema = z.object({
  eligible: z.array(PreviewAssignmentSchema),
  ineligible: z.array(PreviewAssignmentSchema),
});

const PrivacySettingsSchema = z.object({
  redactPII: z.boolean(),
  consentRequired: z.boolean(),
  backupRetentionDays: z.number(),
  keyRotationDays: z.number(),
});

const ConsentSchema = z.object({
  id: z.string(),
  consentType: z.string(),
  subject: z.string(),
  grantedBy: z.string(),
  grantedAt: z.string(),
  purpose: z.string().optional(),
  method: z.string().optional(),
  expiresAt: z.string().optional(),
  revokedAt: z.string().optional(),
});

const IdSchema = z.object({ id: z.string() });
const SuccessSchema = z.object({ success: z.boolean() });
const CountSchema = z.object({ count: z.number() });

const AiPartnerEvidenceLinkSchema = z.object({
  label: z.string(),
  url: z.string(),
});

const AiPartnerImpactSchema = z.object({
  level: z.enum(["low", "medium", "high"]),
  summary: z.string(),
  warnings: z.array(z.string()).optional(),
  saferAlternative: z.string().optional(),
});

const AiPartnerActionDraftSchema = z.object({
  id: z.string(),
  actionType: z.string(),
  resource: z.string(),
  action: z.enum(["read", "write"]),
  parameters: z.record(z.unknown()).optional(),
  status: z.enum(["draft", "executed", "denied"]),
  requiresConfirmation: z.boolean().optional(),
  sensitivity: z.enum(["low", "medium", "high"]).optional(),
  impact: AiPartnerImpactSchema.optional(),
  evidenceLinks: z.array(AiPartnerEvidenceLinkSchema).optional(),
  result: z.record(z.unknown()).optional(),
});

const AiPartnerConfirmationSchema = z.object({
  id: z.string(),
  prompt: z.string(),
});

const AiPartnerDenialSchema = z.object({
  reason: z.string(),
  guidance: z.string().optional(),
});

const AiPartnerChatResponseSchema = z
  .object({
    message: z.string().optional(),
    actionDrafts: z.array(AiPartnerActionDraftSchema).optional(),
    confirmations: z.array(AiPartnerConfirmationSchema).optional(),
    denials: z.array(AiPartnerDenialSchema).optional(),
    questions: z.array(z.string()).optional(),
    evidenceLinks: z.array(AiPartnerEvidenceLinkSchema).optional(),
  })
  .passthrough();

export const apiClient = {
  // Public sites (QR)
  async getPublicSite(slug: string, code: string) {
    const data = await fetchJSONUnknown(`/public/campgrounds/${slug}/sites/${code}`);
    return z
      .object({
        site: SiteSchema.extend({ siteClass: SiteClassSchema.nullable().optional() }),
        status: z.string(),
        currentReservation: z
          .object({
            id: z.string(),
            status: z.string(),
            arrivalDate: z.string(),
            departureDate: z.string(),
            guestId: z.string(),
          })
          .nullable(),
      })
      .parse(data);
  },

  async signUpload(payload: { filename: string; contentType: string }) {
    const res = await fetch(`${API_BASE}/uploads/sign`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...scopedHeaders() },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      throw new Error("Uploads disabled or failed to sign");
    }
    return parseResponse(
      res,
      z.object({
        uploadUrl: z.string(),
        publicUrl: z.string(),
        key: z.string(),
        error: z.string().optional(),
      }),
    );
  },
  async getCampgrounds() {
    // Use scopedHeaders to include auth token
    const res = await fetch(`${API_BASE}/campgrounds`, {
      next: { revalidate: 0 },
      headers: scopedHeaders(),
    });
    const data = await parseResponse(res, UnknownSchema);
    return CampgroundArray.parse(data);
  },
  async getCampgroundReservations(campgroundId?: string) {
    const id =
      campgroundId ||
      (typeof window !== "undefined" ? localStorage.getItem("campreserv:selectedCampground") : "");
    const res = await fetch(`${API_BASE}/reservations${id ? `?campgroundId=${id}` : ""}`, {
      headers: scopedHeaders(),
    });
    const data = await parseResponse(res, UnknownSchema);
    return ReservationArray.parse(data);
  },
  async getReservationImportSchema(campgroundId: string) {
    const res = await fetch(`${API_BASE}/campgrounds/${campgroundId}/reservations/import/schema`, {
      headers: scopedHeaders(),
    });
    return parseResponse(res, UnknownSchema);
  },
  async importReservations(
    campgroundId: string,
    payload: {
      format: "csv" | "json";
      payload: unknown;
      dryRun?: boolean;
      idempotencyKey?: string;
      filename?: string;
    },
  ) {
    const res = await fetch(`${API_BASE}/campgrounds/${campgroundId}/reservations/import`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...scopedHeaders(),
        ...(payload.idempotencyKey ? { "Idempotency-Key": payload.idempotencyKey } : {}),
      },
      body: JSON.stringify(payload),
    });
    return parseResponse(res, UnknownSchema);
  },
  async getReservationImportStatus(campgroundId: string, jobId: string) {
    const res = await fetch(
      `${API_BASE}/campgrounds/${campgroundId}/reservations/import/${jobId}`,
      {
        headers: scopedHeaders(),
      },
    );
    return parseResponse(res, UnknownSchema);
  },
  async exportReservationsPage(
    campgroundId: string,
    params?: {
      format?: "json" | "csv";
      pageSize?: number;
      paginationToken?: string | null;
      includePII?: boolean;
      status?: string;
      source?: string;
    },
  ) {
    const qs = new URLSearchParams();
    if (params?.format) qs.set("format", params.format);
    if (params?.pageSize) qs.set("pageSize", String(params.pageSize));
    if (params?.paginationToken) qs.set("paginationToken", params.paginationToken);
    if (params?.includePII) qs.set("includePII", "true");
    if (params?.status) qs.set("status", params.status);
    if (params?.source) qs.set("source", params.source);
    const res = await fetch(
      `${API_BASE}/campgrounds/${campgroundId}/reservations/export${qs.toString() ? `?${qs.toString()}` : ""}`,
      {
        headers: scopedHeaders(),
      },
    );
    return parseResponse(res, UnknownSchema);
  },
  async listReservationExportJobs(campgroundId: string, limit = 10) {
    const res = await fetch(
      `${API_BASE}/campgrounds/${campgroundId}/reservations/export/jobs?limit=${limit}`,
      {
        headers: scopedHeaders(),
      },
    );
    return parseResponse(res, UnknownSchema);
  },
  async queueReservationExportJob(
    campgroundId: string,
    payload: { format?: "json" | "csv"; filters?: Record<string, unknown> },
  ) {
    const res = await fetch(`${API_BASE}/campgrounds/${campgroundId}/reservations/export/jobs`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...scopedHeaders() },
      body: JSON.stringify(payload ?? {}),
    });
    return parseResponse(res, UnknownSchema);
  },
  async getMaintenance() {
    const res = await fetch(`${API_BASE}/maintenance`, { headers: scopedHeaders() });
    const data = await parseResponse(res, UnknownSchema);
    return z.array(z.unknown()).parse(data);
  },
  async getOtaConfig(campgroundId: string) {
    const data = await fetchJSONUnknown(`/ota/campgrounds/${campgroundId}/config`);
    return OtaConfigSchema.parse(data);
  },
  async saveOtaConfig(
    campgroundId: string,
    payload: Partial<{
      provider: string;
      externalAccountId: string;
      propertyId: string;
      apiKey: string;
      channelId: string;
      notes: string;
    }>,
  ) {
    const res = await fetch(`${API_BASE}/ota/campgrounds/${campgroundId}/config`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...scopedHeaders() },
      body: JSON.stringify(payload),
    });
    const data = await parseResponse(res, UnknownSchema);
    return OtaConfigSchema.parse(data);
  },
  async getOtaSyncStatus(campgroundId: string) {
    const data = await fetchJSONUnknown(`/ota/campgrounds/${campgroundId}/sync-status`);
    return OtaSyncStatusSchema.parse(data);
  },
  async listOtaChannels(campgroundId: string) {
    const data = await fetchJSONUnknown(`/ota/campgrounds/${campgroundId}/channels`);
    return z.array(OtaChannelSchema).parse(data);
  },
  async createOtaChannel(
    campgroundId: string,
    payload: {
      name: string;
      provider: string;
      status?: string;
      rateMultiplier?: number;
      defaultStatus?: string;
      sendEmailNotifications?: boolean;
      ignoreSiteRestrictions?: boolean;
      ignoreCategoryRestrictions?: boolean;
      feeMode?: string;
      webhookSecret?: string;
    },
  ) {
    const res = await fetch(`${API_BASE}/ota/campgrounds/${campgroundId}/channels`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...scopedHeaders() },
      body: JSON.stringify(payload),
    });
    const data = await parseResponse(res, UnknownSchema);
    return OtaChannelSchema.parse(data);
  },
  async updateOtaChannel(
    id: string,
    payload: Partial<{
      name: string;
      provider: string;
      status: string;
      rateMultiplier: number;
      defaultStatus: string;
      sendEmailNotifications: boolean;
      ignoreSiteRestrictions: boolean;
      ignoreCategoryRestrictions: boolean;
      feeMode: string;
      webhookSecret: string;
    }>,
    campgroundId?: string,
  ) {
    const path = withCampgroundId(`/ota/channels/${id}`, campgroundId);
    const res = await fetch(`${API_BASE}${path}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", ...scopedHeaders() },
      body: JSON.stringify(payload),
    });
    const data = await parseResponse(res, UnknownSchema);
    return OtaChannelSchema.parse(data);
  },
  async listOtaMappings(channelId: string, campgroundId?: string) {
    const data = await fetchJSONUnknown(
      withCampgroundId(`/ota/channels/${channelId}/mappings`, campgroundId),
    );
    return z.array(OtaMappingSchema).parse(data);
  },
  async listOtaImports(channelId: string, campgroundId?: string) {
    const data = await fetchJSONUnknown(
      withCampgroundId(`/ota/channels/${channelId}/imports`, campgroundId),
    );
    return z.array(OtaImportSchema).parse(data);
  },
  async listOtaLogs(channelId: string, campgroundId?: string) {
    const data = await fetchJSONUnknown(
      withCampgroundId(`/ota/channels/${channelId}/logs`, campgroundId),
    );
    return z.array(OtaLogSchema).parse(data);
  },
  async listIntegrationConnections(campgroundId: string) {
    const data = await fetchJSONUnknown(`/integrations/connections?campgroundId=${campgroundId}`);
    return z.array(IntegrationConnectionSchema).parse(data);
  },
  async upsertIntegrationConnection(payload: {
    campgroundId: string;
    organizationId?: string;
    type: "accounting" | "access_control" | "crm" | "export";
    provider: string;
    status?: string;
    authType?: string;
    credentials?: Record<string, unknown>;
    settings?: Record<string, unknown>;
    webhookSecret?: string;
  }) {
    const res = await fetch(`${API_BASE}/integrations/connections`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...scopedHeaders() },
      body: JSON.stringify(payload),
    });
    const data = await parseResponse(res, UnknownSchema);
    return IntegrationConnectionSchema.parse(data);
  },
  async updateIntegrationConnection(
    id: string,
    payload: Partial<{
      organizationId: string;
      status: string;
      authType: string;
      credentials: Record<string, unknown>;
      settings: Record<string, unknown>;
      webhookSecret: string;
    }>,
  ) {
    const res = await fetch(`${API_BASE}/integrations/connections/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", ...scopedHeaders() },
      body: JSON.stringify(payload),
    });
    const data = await parseResponse(res, UnknownSchema);
    return IntegrationConnectionSchema.parse(data);
  },
  async triggerIntegrationSync(
    id: string,
    payload: { direction?: string; scope?: string; note?: string } = {},
  ) {
    const res = await fetch(`${API_BASE}/integrations/connections/${id}/sync`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...scopedHeaders() },
      body: JSON.stringify(payload),
    });
    return parseResponse(
      res,
      z.object({
        ok: z.boolean(),
        status: z.string(),
        connectionId: z.string(),
      }),
    );
  },
  async deleteIntegrationConnection(id: string) {
    const res = await fetch(`${API_BASE}/integrations/connections/${id}`, {
      method: "DELETE",
      headers: scopedHeaders(),
    });
    return parseResponse(
      res,
      z.object({
        ok: z.boolean(),
        deleted: z.string(),
      }),
    );
  },
  async getIntegrationOAuthUrl(provider: string, campgroundId: string, redirectUri?: string) {
    const params = new URLSearchParams({ campgroundId });
    if (redirectUri) params.set("redirectUri", redirectUri);
    const data = await fetchJSONUnknown(
      `/integrations/oauth/${provider}/authorize?${params.toString()}`,
    );
    return z
      .object({
        provider: z.string(),
        authorizationUrl: z.string().optional(),
        state: z.string().optional(),
        requiresManualSetup: z.boolean().optional(),
        instructions: z.string().optional(),
        webhookUrl: z.string().optional(),
        error: z.string().optional(),
        message: z.string().optional(),
      })
      .parse(data);
  },
  async listIntegrationLogs(id: string, params: { limit?: number; cursor?: string } = {}) {
    const query = new URLSearchParams();
    if (params.limit) query.set("limit", String(params.limit));
    if (params.cursor) query.set("cursor", params.cursor);
    const data = await fetchJSONUnknown(
      `/integrations/connections/${id}/logs${query.toString() ? `?${query.toString()}` : ""}`,
    );
    return IntegrationLogPageSchema.parse(data);
  },
  async listIntegrationWebhooks(id: string, params: { limit?: number; cursor?: string } = {}) {
    const query = new URLSearchParams();
    if (params.limit) query.set("limit", String(params.limit));
    if (params.cursor) query.set("cursor", params.cursor);
    const data = await fetchJSONUnknown(
      `/integrations/connections/${id}/webhooks${query.toString() ? `?${query.toString()}` : ""}`,
    );
    return IntegrationWebhookPageSchema.parse(data);
  },
  async queueIntegrationExport(payload: {
    type: "api" | "sftp";
    connectionId?: string;
    campgroundId?: string;
    resource?: string;
    location?: string;
    requestedById?: string;
  }) {
    const res = await fetch(`${API_BASE}/integrations/exports`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...scopedHeaders() },
      body: JSON.stringify(payload),
    });
    const data = await parseResponse(res, UnknownSchema);
    return IntegrationExportJobSchema.parse(data);
  },
  async pushOtaAvailability(channelId: string, campgroundId?: string) {
    const path = withCampgroundId(`/ota/channels/${channelId}/push`, campgroundId);
    const res = await fetch(`${API_BASE}${path}`, {
      method: "POST",
      headers: scopedHeaders(),
    });
    return parseResponse(
      res,
      z.object({
        ok: z.boolean(),
        mappingCount: z.number().optional(),
      }),
    );
  },
  async getAiRecommendations(payload: { campgroundId: string; guestId?: string; intent?: string }) {
    const res = await fetch(`${API_BASE}/ai/recommendations`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...scopedHeaders() },
      body: JSON.stringify(payload),
    });
    const data = await parseResponse(res, UnknownSchema);
    return AiRecommendationResponseSchema.parse(data);
  },
  async getAiPricingSuggestions(payload: {
    campgroundId: string;
    siteClassId?: string;
    arrivalDate?: string;
    departureDate?: string;
    demandIndex?: number;
  }) {
    const res = await fetch(`${API_BASE}/ai/pricing-suggestions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...scopedHeaders() },
      body: JSON.stringify(payload),
    });
    const data = await parseResponse(res, UnknownSchema);
    return AiPricingSuggestionSchema.parse(data);
  },
  async searchSemantic(payload: { query: string; campgroundId?: string }) {
    const res = await fetch(`${API_BASE}/ai/semantic-search`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...scopedHeaders() },
      body: JSON.stringify(payload),
    });
    const data = await parseResponse(res, UnknownSchema);
    return AiSemanticSearchResponseSchema.parse(data);
  },
  async runCopilot(payload: {
    campgroundId: string;
    action: string;
    prompt?: string;
    payload?: Record<string, unknown>;
  }) {
    const res = await fetch(`${API_BASE}/ai/copilot`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...scopedHeaders() },
      body: JSON.stringify(payload),
    });
    const data = await parseResponse(res, UnknownSchema);
    return AiCopilotResponseSchema.parse(data);
  },
  async generateAiUiTree(payload: {
    campgroundId: string;
    builder: "dashboard" | "report" | "workflow";
    prompt: string;
  }) {
    const res = await fetch(`${API_BASE}/ai/campgrounds/${payload.campgroundId}/ui-builder`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...scopedHeaders() },
      body: JSON.stringify({ builder: payload.builder, prompt: payload.prompt }),
    });
    const data = await parseResponse(res, UnknownSchema);
    return AiUiBuilderResponseSchema.parse(data);
  },
  async upsertOtaMapping(
    channelId: string,
    payload: {
      externalId: string;
      siteId?: string;
      siteClassId?: string;
      status?: string;
    },
    campgroundId?: string,
  ) {
    const path = withCampgroundId(`/ota/channels/${channelId}/mappings`, campgroundId);
    const res = await fetch(`${API_BASE}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...scopedHeaders() },
      body: JSON.stringify(payload),
    });
    const data = await parseResponse(res, UnknownSchema);
    return OtaMappingSchema.parse(data);
  },
  async ensureOtaIcalToken(mappingId: string, campgroundId?: string) {
    const path = withCampgroundId(`/ota/mappings/${mappingId}/ical/token`, campgroundId);
    const res = await fetch(`${API_BASE}${path}`, {
      method: "POST",
      headers: scopedHeaders(),
    });
    const token = await parseResponse(res, z.string());
    return token;
  },
  async setOtaIcalUrl(mappingId: string, url: string, campgroundId?: string) {
    const path = withCampgroundId(`/ota/mappings/${mappingId}/ical/url`, campgroundId);
    const res = await fetch(`${API_BASE}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...scopedHeaders() },
      body: JSON.stringify({ url }),
    });
    return parseResponse(res, z.object({ ok: z.boolean() }));
  },
  async importOtaIcal(mappingId: string, campgroundId?: string) {
    const path = withCampgroundId(`/ota/mappings/${mappingId}/ical/import`, campgroundId);
    const res = await fetch(`${API_BASE}${path}`, {
      method: "POST",
      headers: scopedHeaders(),
    });
    return parseResponse(
      res,
      z.object({
        ok: z.boolean(),
        imported: z.number(),
      }),
    );
  },
  async acceptInvite(payload: {
    token: string;
    password: string;
    firstName: string;
    lastName: string;
  }) {
    const res = await fetch(`${API_BASE}/auth/invitations/accept`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await parseResponse(res, UnknownSchema);
    return z
      .object({
        id: z.string(),
        email: z.string(),
        firstName: z.string(),
        lastName: z.string(),
        token: z.string(),
      })
      .parse(data);
  },
  async createOnboardingInvite(payload: {
    email: string;
    organizationId?: string;
    campgroundId?: string;
    campgroundName?: string;
    expiresInHours?: number;
  }) {
    const res = await fetch(`${API_BASE}/onboarding/invitations`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...scopedHeaders() },
      body: JSON.stringify(payload),
    });
    const data = await parseResponse(res, UnknownSchema);
    return OnboardingInviteResponseSchema.parse(data);
  },
  async resendOnboardingInvite(inviteId: string) {
    const res = await fetch(`${API_BASE}/onboarding/invitations/${inviteId}/resend`, {
      method: "POST",
      headers: scopedHeaders(),
    });
    const data = await parseResponse(res, UnknownSchema);
    return OnboardingInviteResponseSchema.parse(data);
  },
  async startOnboardingSession(token: string) {
    const res = await fetch(`${API_BASE}/onboarding/session/start`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    });
    const data = await parseResponse(res, UnknownSchema);
    return OnboardingSessionResponseSchema.parse(data);
  },
  async getOnboardingSession(sessionId: string, token: string) {
    const res = await fetch(
      `${API_BASE}/onboarding/session/${sessionId}?token=${encodeURIComponent(token)}`,
      {
        headers: { "x-onboarding-token": token },
      },
    );
    const data = await parseResponse(res, UnknownSchema);
    return OnboardingSessionResponseSchema.parse(data);
  },
  async saveOnboardingStep(
    sessionId: string,
    token: string,
    step: z.infer<typeof OnboardingStepEnum>,
    payload: Record<string, unknown>,
    idempotencyKey?: string,
  ) {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "x-onboarding-token": token,
    };
    if (idempotencyKey) headers["idempotency-key"] = idempotencyKey;
    const res = await fetch(`${API_BASE}/onboarding/session/${sessionId}/step`, {
      method: "PATCH",
      headers,
      body: JSON.stringify({ step, payload, token }),
    });
    const data = await parseResponse(res, UnknownSchema);
    return OnboardingSessionResponseSchema.parse(data);
  },
  async getDashboardSummary(campgroundId: string) {
    const data = await fetchJSONUnknown(`/dashboard/campgrounds/${campgroundId}/summary`);
    return DashboardSummarySchema.parse(data);
  },
  async listReportExports(campgroundId: string, limit = 10) {
    const query = new URLSearchParams();
    if (limit) query.set("limit", String(limit));
    const data = await fetchJSONUnknown(
      `/campgrounds/${campgroundId}/reports/exports${query.toString() ? `?${query.toString()}` : ""}`,
    );
    return z.array(IntegrationExportJobSchema).parse(data);
  },
  async queueReportExport(
    campgroundId: string,
    payload: { filters?: Record<string, unknown>; format?: string; emailTo?: string[] } = {},
  ) {
    const res = await fetch(`${API_BASE}/campgrounds/${campgroundId}/reports/exports`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...scopedHeaders() },
      body: JSON.stringify(payload),
    });
    const data = await parseResponse(res, UnknownSchema);
    return IntegrationExportJobSchema.parse(data);
  },
  async getReportExport(campgroundId: string, exportId: string) {
    const data = await fetchJSONUnknown(`/campgrounds/${campgroundId}/reports/exports/${exportId}`);
    return IntegrationExportJobSchema.parse(data);
  },
  async rerunReportExport(campgroundId: string, exportId: string) {
    const res = await fetch(
      `${API_BASE}/campgrounds/${campgroundId}/reports/exports/${exportId}/rerun`,
      {
        method: "POST",
        headers: scopedHeaders(),
      },
    );
    const data = await parseResponse(res, UnknownSchema);
    return IntegrationExportJobSchema.parse(data);
  },
  async listReportCatalog(
    campgroundId: string,
    params: { category?: string; search?: string; includeHeavy?: boolean } = {},
  ) {
    const query = new URLSearchParams();
    if (params.category) query.set("category", params.category);
    if (params.search) query.set("search", params.search);
    if (params.includeHeavy) query.set("includeHeavy", "true");
    const data = await fetchJSONUnknown(
      `/campgrounds/${campgroundId}/reports/catalog${query.toString() ? `?${query.toString()}` : ""}`,
    );
    return z
      .object({
        size: z.number(),
        total: z.number(),
        catalog: z.array(
          z.object({
            id: z.string(),
            name: z.string(),
            category: z.string(),
            dimensions: z.array(z.object({ id: z.string(), label: z.string() })),
            metrics: z.array(z.object({ id: z.string(), label: z.string() })),
            chartTypes: z.array(z.string()),
          }),
        ),
      })
      .parse(data);
  },
  async runReport(
    campgroundId: string,
    payload: {
      reportId: string;
      dimensions?: string[];
      filters?: Record<string, unknown>;
      timeRange?: Record<string, unknown>;
      limit?: number;
      offset?: number;
      sample?: boolean;
    },
  ) {
    const res = await fetch(`${API_BASE}/campgrounds/${campgroundId}/reports/run`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...scopedHeaders() },
      body: JSON.stringify(payload),
    });
    return parseResponse(res, UnknownSchema);
  },
  async getCampgroundMap(
    campgroundId: string,
    params: { startDate?: string; endDate?: string } = {},
  ) {
    const query = new URLSearchParams();
    if (params.startDate) query.set("startDate", params.startDate);
    if (params.endDate) query.set("endDate", params.endDate);
    const suffix = query.toString() ? `?${query.toString()}` : "";
    const data = await fetchJSONUnknown(`/campgrounds/${campgroundId}/map${suffix}`);
    return CampgroundMapSchema.parse(data);
  },
  async upsertCampgroundMap(
    campgroundId: string,
    payload: {
      config?: z.infer<typeof MapConfigSchema> | null;
      sites?: Array<Partial<z.infer<typeof MapSiteSchema>>>;
    },
  ) {
    const res = await fetch(`${API_BASE}/campgrounds/${campgroundId}/map`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", ...scopedHeaders() },
      body: JSON.stringify(payload),
    });
    const data = await parseResponse(res, UnknownSchema);
    return CampgroundMapSchema.parse(data);
  },
  async upsertCampgroundMapShapes(
    campgroundId: string,
    payload: {
      shapes: Array<{
        id?: string;
        name?: string | null;
        geometry: unknown;
        centroid?: unknown;
        metadata?: unknown;
      }>;
    },
  ) {
    const res = await fetch(`${API_BASE}/campgrounds/${campgroundId}/map/shapes`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", ...scopedHeaders() },
      body: JSON.stringify(payload),
    });
    const data = await parseResponse(res, UnknownSchema);
    return CampgroundMapSchema.parse(data);
  },
  async deleteCampgroundMapShape(campgroundId: string, shapeId: string) {
    const res = await fetch(`${API_BASE}/campgrounds/${campgroundId}/map/shapes/${shapeId}`, {
      method: "DELETE",
      headers: { ...scopedHeaders() },
    });
    const data = await parseResponse(res, UnknownSchema);
    return CampgroundMapSchema.parse(data);
  },
  async upsertCampgroundMapAssignments(
    campgroundId: string,
    payload: {
      assignments: Array<{
        siteId: string;
        shapeId: string;
        label?: string | null;
        rotation?: number | null;
        metadata?: unknown;
      }>;
    },
  ) {
    const res = await fetch(`${API_BASE}/campgrounds/${campgroundId}/map/assignments`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", ...scopedHeaders() },
      body: JSON.stringify(payload),
    });
    const data = await parseResponse(res, UnknownSchema);
    return CampgroundMapSchema.parse(data);
  },
  async unassignCampgroundMapSite(campgroundId: string, siteId: string) {
    const res = await fetch(`${API_BASE}/campgrounds/${campgroundId}/map/assignments/${siteId}`, {
      method: "DELETE",
      headers: { ...scopedHeaders() },
    });
    const data = await parseResponse(res, UnknownSchema);
    return CampgroundMapSchema.parse(data);
  },
  async previewAssignments(
    campgroundId: string,
    payload: {
      startDate: string;
      endDate: string;
      rig?: { length?: number; width?: number; height?: number; type?: string };
      needsADA?: boolean;
      requiredAmenities?: string[];
      partySize?: number;
      siteIds?: string[];
    },
  ) {
    const res = await fetch(`${API_BASE}/campgrounds/${campgroundId}/assignments/preview`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...scopedHeaders() },
      body: JSON.stringify(payload),
    });
    const data = await parseResponse(res, UnknownSchema);
    return PreviewAssignmentsResultSchema.parse(data);
  },
  async checkAssignment(
    campgroundId: string,
    payload: {
      siteId: string;
      startDate: string;
      endDate: string;
      rig?: { length?: number; width?: number; height?: number; type?: string };
      needsADA?: boolean;
      requiredAmenities?: string[];
      partySize?: number;
    },
  ) {
    const res = await fetch(`${API_BASE}/campgrounds/${campgroundId}/assignments/check`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...scopedHeaders() },
      body: JSON.stringify(payload),
    });
    return PreviewAssignmentSchema.parse(await parseResponse(res, UnknownSchema));
  },
  async getCampground(id: string) {
    const data = await fetchJSONUnknown(`/campgrounds/${id}`);
    return CampgroundWithAnalyticsSchema.parse(data);
  },
  async getCampgroundMembers(campgroundId: string) {
    const RoleEnum = z.enum([
      "owner",
      "manager",
      "front_desk",
      "maintenance",
      "finance",
      "marketing",
      "readonly",
    ]);
    const data = await fetchJSONUnknown(`/campgrounds/${campgroundId}/members`);
    return z
      .array(
        z.object({
          id: z.string(),
          role: RoleEnum,
          createdAt: z.string(),
          user: z.object({
            id: z.string(),
            firstName: z.string().nullable(),
            lastName: z.string().nullable(),
            email: z.string(),
            isActive: z.boolean().optional(),
          }),
          lastInviteSentAt: z.string().nullable(),
          lastInviteRedeemedAt: z.string().nullable(),
          inviteExpiresAt: z.string().nullable(),
        }),
      )
      .parse(data);
  },
  async addCampgroundMember(
    campgroundId: string,
    payload: {
      email: string;
      firstName?: string;
      lastName?: string;
      role:
        | "owner"
        | "manager"
        | "front_desk"
        | "maintenance"
        | "finance"
        | "marketing"
        | "readonly";
    },
  ) {
    const res = await fetch(`${API_BASE}/campgrounds/${campgroundId}/members`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...scopedHeaders() },
      body: JSON.stringify({ campgroundId, ...payload }),
    });
    return parseResponse(res, UnknownSchema);
  },
  async updateCampgroundMemberRole(
    campgroundId: string,
    membershipId: string,
    role: "owner" | "manager" | "front_desk" | "maintenance" | "finance" | "marketing" | "readonly",
  ) {
    const res = await fetch(`${API_BASE}/campgrounds/${campgroundId}/members/${membershipId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", ...scopedHeaders() },
      body: JSON.stringify({ role }),
    });
    return parseResponse(res, UnknownSchema);
  },
  async removeCampgroundMember(campgroundId: string, membershipId: string) {
    const res = await fetch(`${API_BASE}/campgrounds/${campgroundId}/members/${membershipId}`, {
      method: "DELETE",
      headers: scopedHeaders(),
    });
    if (!res.ok) throw new Error("Failed to remove member");
    return true;
  },
  async resendCampgroundInvite(campgroundId: string, membershipId: string) {
    const res = await fetch(
      `${API_BASE}/campgrounds/${campgroundId}/members/${membershipId}/resend-invite`,
      {
        method: "POST",
        headers: scopedHeaders(),
      },
    );
    if (!res.ok) throw new Error("Failed to resend invite");
    return true;
  },
  async getAuditLogs(
    campgroundId: string,
    params?: { action?: string; actorId?: string; limit?: number; start?: string; end?: string },
  ) {
    const q = new URLSearchParams();
    if (params?.action) q.set("action", params.action);
    if (params?.actorId) q.set("actorId", params.actorId);
    if (params?.start) q.set("start", params.start);
    if (params?.end) q.set("end", params.end);
    if (params?.limit) q.set("limit", String(params.limit));
    const suffix = q.toString() ? `?${q.toString()}` : "";
    const data = await fetchJSONUnknown(`/campgrounds/${campgroundId}/audit${suffix}`);
    return z
      .array(
        z.object({
          id: z.string(),
          campgroundId: z.string(),
          actorId: z.string().nullable(),
          action: z.string(),
          entity: z.string(),
          entityId: z.string(),
          before: z.unknown().nullable(),
          after: z.unknown().nullable(),
          createdAt: z.string(),
          ip: z.string().nullable(),
          userAgent: z.string().nullable(),
          actor: z
            .object({
              id: z.string(),
              email: z.string(),
              firstName: z.string().nullable(),
              lastName: z.string().nullable(),
            })
            .nullable(),
        }),
      )
      .parse(data);
  },
  async getSecurityQuickAudit(campgroundId: string) {
    const data = await fetchJSONUnknown(`/campgrounds/${campgroundId}/audit/quick`);
    const AuditLogSchema = z.object({
      id: z.string(),
      campgroundId: z.string(),
      actorId: z.string().nullable(),
      action: z.string(),
      entity: z.string(),
      entityId: z.string().nullable(),
      before: z.unknown().nullable(),
      after: z.unknown().nullable(),
      createdAt: z.string(),
      ip: z.string().nullable(),
      userAgent: z.string().nullable(),
      actor: z
        .object({
          id: z.string(),
          email: z.string(),
          firstName: z.string().nullable(),
          lastName: z.string().nullable(),
        })
        .nullable(),
    });
    const PiiTagSchema = z.object({
      resource: z.string(),
      field: z.string(),
      classification: z.string(),
      redactionMode: z.string().nullable().optional(),
    });
    return z
      .object({
        privacyDefaults: z.object({
          redactPII: z.boolean(),
          consentRequired: z.boolean(),
          backupRetentionDays: z.number(),
          keyRotationDays: z.number(),
        }),
        piiTagCount: z.number(),
        piiTagsPreview: z.array(PiiTagSchema).default([]),
        auditEvents: z.array(AuditLogSchema),
      })
      .parse(data);
  },
  async getBackupStatus(campgroundId: string) {
    const data = await fetchJSONUnknown(`/campgrounds/${campgroundId}/backup/status`);
    return BackupStatusSchema.parse(data);
  },
  async simulateRestore(campgroundId: string) {
    const res = await fetch(`${API_BASE}/campgrounds/${campgroundId}/backup/restore-sim`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...scopedHeaders() },
    });
    const data = await parseResponse(res, UnknownSchema);
    return BackupStatusSchema.extend({
      startedAt: z.string().optional(),
      completedAt: z.string().optional(),
    }).parse(data);
  },
  async updateCampgroundDeposit(
    id: string,
    depositRule: z.infer<typeof CampgroundSchema>["depositRule"],
    depositPercentage?: number | null,
    depositConfig?: unknown,
  ) {
    const res = await fetch(`${API_BASE}/campgrounds/${id}/deposit`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", ...scopedHeaders() },
      body: JSON.stringify({ depositRule, depositPercentage, depositConfig }),
    });
    if (!res.ok) throw new Error("Failed to update deposit rule");
    const data = await res.json();
    return CampgroundSchema.parse(data);
  },
  async updateStoreHours(id: string, payload: { storeOpenHour?: number; storeCloseHour?: number }) {
    const res = await fetch(`${API_BASE}/campgrounds/${id}/store-hours`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", ...scopedHeaders() },
      body: JSON.stringify(payload),
    });
    const data = await parseResponse(res, UnknownSchema);
    return CampgroundWithAnalyticsSchema.parse(data);
  },
  async createCampground(
    organizationId: string,
    payload: Omit<z.input<typeof CampgroundSchema>, "organizationId" | "id">,
  ) {
    const res = await fetch(`${API_BASE}/organizations/${organizationId}/campgrounds`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...scopedHeaders() },
      body: JSON.stringify(payload),
    });
    const data = await parseResponse(res, UnknownSchema);
    return CampgroundWithAnalyticsSchema.parse(data);
  },
  async updateCampgroundAnalytics(
    campgroundId: string,
    payload: { gaMeasurementId?: string | null; metaPixelId?: string | null },
  ) {
    const res = await fetch(`${API_BASE}/campgrounds/${campgroundId}/analytics`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", ...scopedHeaders() },
      body: JSON.stringify(payload),
    });
    const data = await parseResponse(res, UnknownSchema);
    return CampgroundWithAnalyticsSchema.parse(data);
  },
  async updateCampgroundNps(
    campgroundId: string,
    payload: {
      npsAutoSendEnabled?: boolean;
      npsSendHour?: number | null;
      npsTemplateId?: string | null;
      npsSchedule?: unknown;
    },
  ) {
    const res = await fetch(`${API_BASE}/campgrounds/${campgroundId}/nps`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", ...scopedHeaders() },
      body: JSON.stringify(payload),
    });
    const data = await parseResponse(res, UnknownSchema);
    return CampgroundWithAnalyticsSchema.parse(data);
  },
  async getSmsSettings(campgroundId: string) {
    const res = await fetch(`${API_BASE}/campgrounds/${campgroundId}/sms-settings`, {
      headers: scopedHeaders(),
    });
    return parseResponse(
      res,
      z.object({
        id: z.string(),
        smsEnabled: z.boolean(),
        twilioAccountSid: z.string().nullable(),
        twilioFromNumber: z.string().nullable(),
        smsWelcomeMessage: z.string().nullable(),
        twilioAuthTokenSet: z.boolean(),
      }),
    );
  },
  async updateSmsSettings(
    campgroundId: string,
    payload: {
      smsEnabled?: boolean;
      twilioAccountSid?: string | null;
      twilioAuthToken?: string | null;
      twilioFromNumber?: string | null;
      smsWelcomeMessage?: string | null;
    },
  ) {
    const res = await fetch(`${API_BASE}/campgrounds/${campgroundId}/sms-settings`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", ...scopedHeaders() },
      body: JSON.stringify(payload),
    });
    return parseResponse(
      res,
      z.object({
        id: z.string(),
        smsEnabled: z.boolean(),
        twilioAccountSid: z.string().nullable(),
        twilioFromNumber: z.string().nullable(),
        smsWelcomeMessage: z.string().nullable(),
      }),
    );
  },
  async updateCampgroundBranding(
    campgroundId: string,
    payload: {
      logoUrl?: string | null;
      primaryColor?: string | null;
      accentColor?: string | null;
      secondaryColor?: string | null;
      buttonColor?: string | null;
      brandFont?: string | null;
      emailHeader?: string | null;
      receiptFooter?: string | null;
      brandingNote?: string | null;
    },
  ) {
    const res = await fetch(`${API_BASE}/campgrounds/${campgroundId}/branding`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", ...scopedHeaders() },
      body: JSON.stringify(payload),
    });
    const data = await parseResponse(res, UnknownSchema);
    return CampgroundWithAnalyticsSchema.parse(data);
  },
  async updateCampgroundProfile(
    campgroundId: string,
    payload: Partial<{
      name: string;
      slug: string;
      phone: string | null;
      email: string | null;
      website: string | null;
      facebookUrl: string | null;
      instagramUrl: string | null;
      address1: string | null;
      address2: string | null;
      city: string | null;
      state: string | null;
      country: string | null;
      postalCode: string | null;
      latitude: number | null;
      longitude: number | null;
      description: string | null;
      tagline: string | null;
      heroImageUrl: string | null;
      isPublished: boolean;
      seasonStart: string | null;
      seasonEnd: string | null;
      checkInTime: string | null;
      checkOutTime: string | null;
      timezone: string | null;
    }>,
  ) {
    const res = await fetch(`${API_BASE}/campgrounds/${campgroundId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", ...scopedHeaders() },
      body: JSON.stringify(payload),
    });
    const data = await parseResponse(res, UnknownSchema);
    return CampgroundWithAnalyticsSchema.parse(data);
  },
  async updateCampgroundSla(campgroundId: string, slaMinutes: number) {
    const res = await fetch(`${API_BASE}/campgrounds/${campgroundId}/sla`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", ...scopedHeaders() },
      body: JSON.stringify({ slaMinutes }),
    });
    const data = await parseResponse(res, UnknownSchema);
    return CampgroundWithAnalyticsSchema.parse(data);
  },
  async updateCampgroundSenderDomain(campgroundId: string, domain: string) {
    const res = await fetch(`${API_BASE}/campgrounds/${campgroundId}/sender-domain`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", ...scopedHeaders() },
      body: JSON.stringify({ domain }),
    });
    const data = await parseResponse(res, UnknownSchema);
    return CampgroundWithAnalyticsSchema.parse(data);
  },
  async updateCampgroundOps(
    id: string,
    data: {
      quietHoursStart?: string | null;
      quietHoursEnd?: string | null;
      routingAssigneeId?: string | null;
      officeClosesAt?: string | null;
    },
  ) {
    const res = await fetch(`${API_BASE}/campgrounds/${id}/ops`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", ...scopedHeaders() },
      body: JSON.stringify(data),
    });
    const result = await parseResponse(res, UnknownSchema);
    return CampgroundWithAnalyticsSchema.parse(result);
  },

  async updateCampgroundFinancials(
    id: string,
    data: {
      currency?: string | null;
      taxId?: string | null;
      taxIdName?: string | null;
      taxState?: number | null;
      taxLocal?: number | null;
    },
  ) {
    const res = await fetch(`${API_BASE}/campgrounds/${id}/financials`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", ...scopedHeaders() },
      body: JSON.stringify(data),
    });
    const result = await parseResponse(res, UnknownSchema);
    return CampgroundWithAnalyticsSchema.parse(result);
  },
  async updateAccessibilitySettings(
    campgroundId: string,
    data: {
      adaAssessment?: unknown;
      adaCertificationLevel?: string;
      adaAccessibleSiteCount?: number;
      adaTotalSiteCount?: number;
      adaAssessmentUpdatedAt?: string;
      adaVerified?: boolean;
      adaVerifiedAt?: string | null;
      adaVerifiedBy?: string | null;
    },
  ) {
    const res = await fetch(`${API_BASE}/campgrounds/${campgroundId}/accessibility`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", ...scopedHeaders() },
      body: JSON.stringify(data),
    });
    const result = await parseResponse(res, UnknownSchema);
    return CampgroundWithAnalyticsSchema.parse(result);
  },
  async updateSecuritySettings(
    campgroundId: string,
    data: {
      securityAssessment?: unknown;
      securityCertificationLevel?: string;
      securityAssessmentUpdatedAt?: string;
      securityVerified?: boolean;
      securityVerifiedAt?: string | null;
      securityVerifiedBy?: string | null;
      securityAuditorEmail?: string | null;
      securityAuditorOrg?: string | null;
    },
  ) {
    const res = await fetch(`${API_BASE}/campgrounds/${campgroundId}/security`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", ...scopedHeaders() },
      body: JSON.stringify(data),
    });
    const result = await parseResponse(res, UnknownSchema);
    return CampgroundWithAnalyticsSchema.parse(result);
  },
  async listTemplates(campgroundId: string, status?: string) {
    const params = new URLSearchParams();
    if (campgroundId) params.set("campgroundId", campgroundId);
    if (status) params.set("status", status);
    const data = await fetchJSONUnknown(`/communications/templates?${params.toString()}`);
    return z.array(CommunicationTemplateSchema).parse(data);
  },
  async createTemplate(payload: {
    campgroundId: string;
    name: string;
    subject?: string;
    bodyHtml?: string;
  }) {
    const res = await fetch(`${API_BASE}/communications/templates`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...scopedHeaders() },
      body: JSON.stringify(payload),
    });
    const data = await parseResponse(res, UnknownSchema);
    return CommunicationTemplateSchema.parse(data);
  },
  async updateTemplate(
    id: string,
    payload: {
      campgroundId?: string;
      name?: string;
      subject?: string;
      bodyHtml?: string;
      status?: string;
    },
  ) {
    const params = new URLSearchParams();
    if (payload.campgroundId) params.set("campgroundId", payload.campgroundId);
    const res = await fetch(`${API_BASE}/communications/templates/${id}?${params.toString()}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", ...scopedHeaders() },
      body: JSON.stringify(payload),
    });
    const data = await parseResponse(res, UnknownSchema);
    return CommunicationTemplateSchema.parse(data);
  },
  async approveTemplate(
    id: string,
    payload: { reason?: string; campgroundId?: string; actorId?: string },
  ) {
    const params = new URLSearchParams();
    if (payload.campgroundId) params.set("campgroundId", payload.campgroundId);
    if (payload.actorId) params.set("actorId", payload.actorId);
    const res = await fetch(
      `${API_BASE}/communications/templates/${id}/approve?${params.toString()}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", ...scopedHeaders() },
        body: JSON.stringify({ reason: payload.reason }),
      },
    );
    const data = await parseResponse(res, UnknownSchema);
    return CommunicationTemplateSchema.parse(data);
  },
  async rejectTemplate(
    id: string,
    payload: { reason?: string; campgroundId?: string; actorId?: string },
  ) {
    const params = new URLSearchParams();
    if (payload.campgroundId) params.set("campgroundId", payload.campgroundId);
    if (payload.actorId) params.set("actorId", payload.actorId);
    const res = await fetch(
      `${API_BASE}/communications/templates/${id}/reject?${params.toString()}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", ...scopedHeaders() },
        body: JSON.stringify({ reason: payload.reason }),
      },
    );
    const data = await parseResponse(res, UnknownSchema);
    return CommunicationTemplateSchema.parse(data);
  },
  async listPlaybooks(campgroundId: string) {
    const params = new URLSearchParams();
    params.set("campgroundId", campgroundId);
    const data = await fetchJSONUnknown(`/communications/playbooks?${params.toString()}`);
    return z.array(CommunicationPlaybookSchema).parse(data);
  },
  async createPlaybook(payload: {
    campgroundId: string;
    type: "arrival" | "unpaid" | "upsell" | "abandoned_cart";
    enabled?: boolean;
    templateId?: string;
    channel?: "email" | "sms";
    offsetMinutes?: number;
    quietHoursStart?: string;
    quietHoursEnd?: string;
    throttlePerMinute?: number;
    routingAssigneeId?: string;
  }) {
    const res = await fetch(`${API_BASE}/communications/playbooks`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...scopedHeaders() },
      body: JSON.stringify(payload),
    });
    const data = await parseResponse(res, UnknownSchema);
    return CommunicationPlaybookSchema.parse(data);
  },
  async updatePlaybook(
    id: string,
    payload: Partial<{
      campgroundId: string;
      enabled: boolean;
      templateId: string | null;
      channel: "email" | "sms" | null;
      offsetMinutes: number | null;
      quietHoursStart: string | null;
      quietHoursEnd: string | null;
      throttlePerMinute: number | null;
      routingAssigneeId: string | null;
    }>,
  ) {
    const params = new URLSearchParams();
    if (payload.campgroundId) params.set("campgroundId", payload.campgroundId);
    const res = await fetch(`${API_BASE}/communications/playbooks/${id}?${params.toString()}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", ...scopedHeaders() },
      body: JSON.stringify(payload),
    });
    const data = await parseResponse(res, UnknownSchema);
    return CommunicationPlaybookSchema.parse(data);
  },
  async listPlaybookJobs(campgroundId: string, status?: string) {
    const params = new URLSearchParams();
    params.set("campgroundId", campgroundId);
    if (status) params.set("status", status);
    const data = await fetchJSONUnknown(`/communications/playbooks/jobs?${params.toString()}`);
    return z.array(CommunicationPlaybookJobSchema).parse(data);
  },
  async retryPlaybookJob(jobId: string, campgroundId?: string) {
    const params = new URLSearchParams();
    if (campgroundId) params.set("campgroundId", campgroundId);
    const res = await fetch(
      `${API_BASE}/communications/playbooks/jobs/${jobId}/retry?${params.toString()}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", ...scopedHeaders() },
      },
    );
    const data = await parseResponse(res, UnknownSchema);
    return CommunicationPlaybookJobSchema.parse(data);
  },
  async updateCampgroundPolicies(
    campgroundId: string,
    payload: {
      cancellationPolicyType?: string | null;
      cancellationWindowHours?: number | null;
      cancellationFeeType?: string | null;
      cancellationFeeFlatCents?: number | null;
      cancellationFeePercent?: number | null;
      cancellationNotes?: string | null;
    },
  ) {
    const res = await fetch(`${API_BASE}/campgrounds/${campgroundId}/policies`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", ...scopedHeaders() },
      body: JSON.stringify(payload),
    });
    const data = await parseResponse(res, UnknownSchema);
    return CampgroundWithAnalyticsSchema.parse(data);
  },
  async getPolicyTemplates(campgroundId: string) {
    const data = await fetchJSONUnknown(`/campgrounds/${campgroundId}/policy-templates`);
    const PolicyTemplateSchema = z.object({
      id: z.string(),
      campgroundId: z.string(),
      name: z.string(),
      description: z.string().nullable().optional(),
      content: z.string().optional().default(""),
      type: z.string(),
      version: z.number().int(),
      policyConfig: z.record(z.unknown()).nullable().optional(),
      isActive: z.boolean(),
      autoSend: z.boolean(),
      siteClassId: z.string().nullable().optional(),
      siteId: z.string().nullable().optional(),
      createdAt: z.string().or(z.date()).optional(),
      updatedAt: z.string().or(z.date()).optional(),
    });
    return z.array(PolicyTemplateSchema).parse(data);
  },
  async createPolicyTemplate(
    campgroundId: string,
    payload: {
      name: string;
      description?: string | null;
      content?: string;
      type?: string;
      version?: number;
      isActive?: boolean;
      autoSend?: boolean;
      siteClassId?: string | null;
      siteId?: string | null;
      policyConfig?: Record<string, unknown> | null;
    },
  ) {
    const res = await fetch(`${API_BASE}/campgrounds/${campgroundId}/policy-templates`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...scopedHeaders() },
      body: JSON.stringify(payload),
    });
    const data = await parseResponse(res, UnknownSchema);
    return data;
  },
  async updatePolicyTemplate(
    id: string,
    payload: {
      name?: string;
      description?: string | null;
      content?: string;
      type?: string;
      version?: number;
      isActive?: boolean;
      autoSend?: boolean;
      siteClassId?: string | null;
      siteId?: string | null;
      policyConfig?: Record<string, unknown> | null;
    },
    campgroundId?: string,
  ) {
    const path = withCampgroundId(`/policy-templates/${id}`, campgroundId);
    const res = await fetch(`${API_BASE}${path}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", ...scopedHeaders() },
      body: JSON.stringify(payload),
    });
    return parseResponse(res, UnknownSchema);
  },
  async deletePolicyTemplate(id: string, campgroundId?: string) {
    const path = withCampgroundId(`/policy-templates/${id}`, campgroundId);
    const res = await fetch(`${API_BASE}${path}`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json", ...scopedHeaders() },
    });
    return parseResponse(res, UnknownSchema);
  },
  async getSites(campgroundId: string) {
    const data = await fetchJSONUnknown(`/campgrounds/${campgroundId}/sites`);
    return SiteArray.parse(data);
  },
  async getLedgerEntries(campgroundId: string) {
    // Note: This endpoint might return a large dataset.
    // In production, we'd want server-side filtering by date range.
    // For now, we'll fetch all and filter client-side to match other reports.
    const data = await fetchJSONUnknown(`/campgrounds/${campgroundId}/ledger`);
    return z.array(LedgerEntrySchema).parse(data);
  },
  async getPayments(campgroundId: string) {
    const data = await fetchJSONUnknown(`/campgrounds/${campgroundId}/payments`);
    // Define schema locally or use z.unknown() if we want to be loose for now,
    // but ideally we define PaymentSchema. For now let's use a simple array checks.
    // Actually, let's define PaymentSchema momentarily or just return unknown and cast in component?
    // Better: Define schema.
    return z
      .array(
        z.object({
          id: z.string(),
          amountCents: z.number(),
          method: z.string(),
          direction: z.string().optional(),
          createdAt: z.string().or(z.date()),
          formattedAmount: z.string().optional(), // In case server sends it
        }),
      )
      .parse(data);
  },
  async getSite(id: string) {
    const data = await fetchJSONUnknown(`/sites/${id}`);
    return SiteSchema.parse(data);
  },
  async deleteCampground(id: string) {
    const res = await fetch(`${API_BASE}/campgrounds/${id}`, {
      method: "DELETE",
      headers: scopedHeaders(),
    });
    if (!res.ok) throw new Error("Failed to delete campground");
    return true;
  },
  async createSite(
    campgroundId: string,
    payload: Omit<z.input<typeof SiteSchema>, "id" | "campgroundId">,
  ) {
    const res = await fetch(`${API_BASE}/campgrounds/${campgroundId}/sites`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...scopedHeaders() },
      body: JSON.stringify(payload),
    });
    const data = await parseResponse(res, UnknownSchema);
    return SiteSchema.parse(data);
  },
  async updateSite(id: string, payload: Partial<z.input<typeof SiteSchema>>) {
    const res = await fetch(`${API_BASE}/sites/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", ...scopedHeaders() },
      body: JSON.stringify(payload),
    });
    const data = await parseResponse(res, UnknownSchema);
    return SiteSchema.parse(data);
  },
  async deleteSite(id: string) {
    const res = await fetch(`${API_BASE}/sites/${id}`, {
      method: "DELETE",
      headers: scopedHeaders(),
    });
    if (!res.ok) throw new Error("Failed to delete site");
    return true;
  },
  async getReservations(campgroundId: string) {
    const data = await fetchJSONUnknown(`/campgrounds/${campgroundId}/reservations`);
    return ReservationArray.parse(data);
  },
  async searchReservations(campgroundId: string, query: string, activeOnly = true) {
    const params = new URLSearchParams({ q: query });
    if (!activeOnly) params.set("activeOnly", "false");
    const data = await fetchJSONUnknown(
      `/campgrounds/${campgroundId}/reservations/search?${params}`,
    );
    return z
      .array(
        z.object({
          id: z.string(),
          confirmationCode: z.string(),
          status: z.string(),
          arrivalDate: z.string(),
          departureDate: z.string(),
          totalAmount: z.number(),
          paidAmount: z.number(),
          balanceAmount: z.number(),
          guest: z
            .object({
              id: z.string(),
              firstName: z.string(),
              lastName: z.string(),
              email: z.string(),
              phone: z.string(),
            })
            .nullable(),
          site: z
            .object({
              id: z.string(),
              number: z.string(),
              name: z.string().nullable(),
              siteClass: z.object({ id: z.string(), name: z.string() }).nullable(),
            })
            .nullable(),
          displayLabel: z.string(),
        }),
      )
      .parse(data);
  },
  async getReservation(id: string) {
    const data = await fetchJSONUnknown(`/reservations/${id}`);
    return ReservationWithGroupSchema.parse(data);
  },
  async checkInReservation(id: string) {
    const res = await fetch(`${API_BASE}/reservations/${id}/check-in`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...scopedHeaders() },
    });
    const data = await parseResponse(res, UnknownSchema);
    return ReservationWithGroupSchema.parse(data);
  },
  async checkOutReservation(id: string, options?: { force?: boolean }) {
    const res = await fetch(`${API_BASE}/reservations/${id}/check-out`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...scopedHeaders() },
      body: JSON.stringify({ force: options?.force ?? true }), // Default to force=true since UI handles payment flow
    });
    const data = await parseResponse(res, UnknownSchema);
    return ReservationWithGroupSchema.parse(data);
  },
  async cancelReservation(id: string) {
    const res = await fetch(`${API_BASE}/reservations/${id}/cancel`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...scopedHeaders() },
    });
    const data = await parseResponse(res, UnknownSchema);
    return ReservationWithGroupSchema.parse(data);
  },
  async getAccessStatus(reservationId: string, campgroundId?: string) {
    const data = await fetchJSONUnknown(
      withCampgroundId(`/reservations/${reservationId}/access`, campgroundId),
    );
    return AccessStatusSchema.parse(data);
  },
  async upsertVehicle(
    reservationId: string,
    payload: {
      plate?: string;
      state?: string;
      rigType?: string;
      rigLength?: number;
      description?: string;
    },
    campgroundId?: string,
  ) {
    const path = withCampgroundId(`/reservations/${reservationId}/access/vehicle`, campgroundId);
    const res = await fetch(`${API_BASE}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...scopedHeaders() },
      body: JSON.stringify(payload),
    });
    const data = await parseResponse(res, UnknownSchema);
    return VehicleSchema.parse(data);
  },
  async grantAccess(
    reservationId: string,
    payload: {
      provider: string;
      credentialType?: string;
      credentialValue?: string;
      startsAt?: string;
      endsAt?: string;
      idempotencyKey?: string;
      vehicleId?: string;
    },
    campgroundId?: string,
  ) {
    const path = withCampgroundId(`/reservations/${reservationId}/access/grant`, campgroundId);
    const res = await fetch(`${API_BASE}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...scopedHeaders() },
      body: JSON.stringify(payload),
    });
    const data = await parseResponse(res, UnknownSchema);
    const grant = isRecord(data) && "grant" in data ? data.grant : data;
    return AccessGrantSchema.parse(grant);
  },
  async revokeAccess(
    reservationId: string,
    payload: {
      provider: string;
      providerAccessId?: string;
      idempotencyKey?: string;
      reason?: string;
    },
    campgroundId?: string,
  ) {
    const path = withCampgroundId(`/reservations/${reservationId}/access/revoke`, campgroundId);
    const res = await fetch(`${API_BASE}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...scopedHeaders() },
      body: JSON.stringify(payload),
    });
    const data = await parseResponse(res, UnknownSchema);
    const grant = isRecord(data) && "grant" in data ? data.grant : data;
    return AccessGrantSchema.parse(grant);
  },
  async listAccessProviders(campgroundId: string) {
    const data = await fetchJSONUnknown(`/access/providers?campgroundId=${campgroundId}`);
    return z.array(AccessIntegrationSchema).parse(data);
  },
  async upsertAccessProvider(
    campgroundId: string,
    provider: string,
    payload: {
      displayName?: string;
      status?: string;
      credentials: Record<string, unknown>;
      webhookSecret?: string;
    },
  ) {
    const res = await fetch(`${API_BASE}/access/providers/${provider}/config`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...scopedHeaders(),
        "X-Campground-Id": campgroundId,
      },
      body: JSON.stringify(payload),
    });
    const data = await parseResponse(res, UnknownSchema);
    return AccessIntegrationSchema.parse(data);
  },
  async getSiteClasses(campgroundId: string) {
    const data = await fetchJSONUnknown(`/campgrounds/${campgroundId}/site-classes`);
    return SiteClassArray.parse(data);
  },

  async getSiteClass(id: string, campgroundId?: string) {
    const path = withCampgroundId(`/site-classes/${id}`, campgroundId);
    const data = await fetchJSONUnknown(path);
    return SiteClassSchema.parse(data);
  },
  async createSiteClass(
    campgroundId: string,
    payload: Omit<z.input<typeof SiteClassSchema>, "id" | "campgroundId">,
  ) {
    const res = await fetch(`${API_BASE}/campgrounds/${campgroundId}/site-classes`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...scopedHeaders() },
      body: JSON.stringify(payload),
    });
    const data = await parseResponse(res, UnknownSchema);
    return SiteClassSchema.parse(data);
  },
  async updateSiteClass(
    id: string,
    payload: Partial<z.input<typeof SiteClassSchema>>,
    campgroundId?: string,
  ) {
    const path = withCampgroundId(`/site-classes/${id}`, campgroundId);
    const res = await fetch(`${API_BASE}${path}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", ...scopedHeaders() },
      body: JSON.stringify(payload),
    });
    const data = await parseResponse(res, UnknownSchema);
    return SiteClassSchema.parse(data);
  },
  async deleteSiteClass(id: string, campgroundId?: string) {
    const path = withCampgroundId(`/site-classes/${id}`, campgroundId);
    const res = await fetch(`${API_BASE}${path}`, { method: "DELETE", headers: scopedHeaders() });
    if (!res.ok) throw new Error("Failed to delete site class");
    return true;
  },
  async getGuests(campgroundId?: string, options?: { search?: string; limit?: number }) {
    let resolvedCampgroundId = campgroundId;
    if (!resolvedCampgroundId && typeof window !== "undefined") {
      try {
        resolvedCampgroundId = localStorage.getItem("campreserv:selectedCampground") || undefined;
      } catch {
        resolvedCampgroundId = undefined;
      }
    }
    const params = new URLSearchParams();
    if (resolvedCampgroundId) params.set("campgroundId", resolvedCampgroundId);
    if (options?.search) params.set("search", options.search);
    if (options?.limit) params.set("limit", String(options.limit));
    const query = params.toString() ? `?${params.toString()}` : "";
    const data = await fetchJSONUnknown(`/guests${query}`);
    return GuestArray.parse(data);
  },
  async getGuest(id: string) {
    const data = await fetchJSONUnknown(`/guests/${id}`);
    return GuestSchema.parse(data);
  },
  async listCommunications(params: {
    campgroundId: string;
    reservationId?: string;
    guestId?: string;
    type?: string;
    direction?: string;
    cursor?: string;
    limit?: number;
  }) {
    const search = new URLSearchParams();
    search.set("campgroundId", params.campgroundId);
    if (params.reservationId) search.set("reservationId", params.reservationId);
    if (params.guestId) search.set("guestId", params.guestId);
    if (params.type) search.set("type", params.type);
    if (params.direction) search.set("direction", params.direction);
    if (params.cursor) search.set("cursor", params.cursor);
    if (params.limit) search.set("limit", params.limit.toString());
    const data = await fetchJSONUnknown(`/communications?${search.toString()}`);
    return CommunicationListSchema.parse(data);
  },
  async createCommunication(payload: z.infer<typeof CreateCommunicationSchema>) {
    const res = await fetch(`${API_BASE}/communications`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...scopedHeaders() },
      body: JSON.stringify(payload),
    });
    const data = await parseResponse(res, UnknownSchema);
    return CommunicationSchema.parse(data);
  },
  async sendCommunication(payload: {
    campgroundId: string;
    organizationId?: string;
    guestId?: string;
    reservationId?: string;
    type: "email" | "sms" | "note" | "call";
    direction: "outbound";
    subject?: string;
    body?: string;
    toAddress?: string;
    fromAddress?: string;
  }) {
    const res = await fetch(`${API_BASE}/communications/send`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...scopedHeaders() },
      body: JSON.stringify(payload),
    });
    const data = await parseResponse(res, UnknownSchema);
    return CommunicationSchema.parse(data);
  },
  async createGuest(payload: Omit<z.input<typeof GuestSchema>, "id">, campgroundId?: string) {
    const params = new URLSearchParams();
    if (campgroundId) params.set("campgroundId", campgroundId);
    const query = params.toString() ? `?${params.toString()}` : "";
    const res = await fetch(`${API_BASE}/guests${query}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...scopedHeaders() },
      body: JSON.stringify(payload),
    });
    const data = await parseResponse(res, UnknownSchema);
    return GuestSchema.parse(data);
  },
  async createReservation(payload: z.input<typeof CreateReservationSchema>) {
    const res = await fetch(`${API_BASE}/reservations`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...scopedHeaders() },
      body: JSON.stringify(payload),
    });
    const data = await parseResponse(res, UnknownSchema);
    return ReservationWithGroupSchema.parse(data);
  },
  async deleteReservation(id: string) {
    const res = await fetch(`${API_BASE}/reservations/${id}`, {
      method: "DELETE",
      headers: scopedHeaders(),
    });
    if (!res.ok) throw new Error("Failed to delete reservation");
    return true;
  },
  async updateReservation(id: string, payload: Partial<z.input<typeof ReservationSchema>>) {
    const res = await fetch(`${API_BASE}/reservations/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", ...scopedHeaders() },
      body: JSON.stringify(payload),
    });
    const data = await parseResponse(res, UnknownSchema);
    return ReservationWithGroupSchema.parse(data);
  },
  async recordReservationPayment(
    id: string,
    amountCents: number,
    tenders?: { method: "card" | "cash" | "check" | "folio"; amountCents: number; note?: string }[],
  ) {
    const body = tenders && tenders.length > 0 ? { amountCents, tenders } : { amountCents };
    const res = await fetch(`${API_BASE}/reservations/${id}/payments`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...scopedHeaders() },
      body: JSON.stringify(body),
    });
    const data = await parseResponse(res, UnknownSchema);
    return ReservationWithGroupSchema.parse(data);
  },

  async emailPaymentReceipt(
    campgroundId: string,
    reservationId: string,
    payload: {
      email: string;
      payments: Array<{ method: string; amountCents: number; reference?: string }>;
      totalPaidCents: number;
    },
  ) {
    const res = await fetch(
      `${API_BASE}/campgrounds/${campgroundId}/reservations/${reservationId}/receipt`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", ...scopedHeaders() },
        body: JSON.stringify(payload),
      },
    );
    return parseResponse(res, z.object({ success: z.boolean() }));
  },

  async splitReservation(
    id: string,
    payload: {
      segments: Array<{ siteId: string; startDate: string; endDate: string }>;
      sendNotification?: boolean;
    },
  ) {
    const res = await fetch(`${API_BASE}/reservations/${id}/split`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...scopedHeaders() },
      body: JSON.stringify(payload),
    });
    const data = await parseResponse(res, UnknownSchema);
    return data;
  },

  async getReservationSegments(id: string) {
    const res = await fetch(`${API_BASE}/reservations/${id}/segments`, {
      headers: scopedHeaders(),
    });
    const data = await parseResponse(res, UnknownSchema);
    return z
      .array(
        z.object({
          id: z.string(),
          siteId: z.string(),
          startDate: z.string(),
          endDate: z.string(),
          subtotalCents: z.number(),
          site: z.object({ name: z.string().nullable().optional() }).nullable().optional(),
        }),
      )
      .parse(data);
  },

  async refreshPaymentCapabilities(campgroundId: string) {
    const res = await fetch(
      `${API_BASE}/campgrounds/${campgroundId}/payments/capabilities/refresh`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", ...scopedHeaders() },
      },
    );
    const data = await parseResponse(res, UnknownSchema);
    return z
      .object({
        stripeAccountId: z.string().nullable().optional(),
        applicationFeeFlatCents: z.number().nullable().optional(),
        perBookingFeeCents: z.number().nullable().optional(),
        monthlyFeeCents: z.number().nullable().optional(),
        billingPlan: z.enum(["ota_only", "standard", "enterprise"]).nullable().optional(),
        feeMode: z.enum(["absorb", "pass_through"]).nullable().optional(),
        stripeCapabilities: z.record(z.string(), z.string()).nullable().optional(),
        stripeCapabilitiesFetchedAt: z.string().nullable().optional(),
        connected: z.boolean().optional(),
      })
      .parse(data);
  },

  async getPublicReservation(id: string, token?: string) {
    const url = token
      ? `/public/reservations/${id}?token=${encodeURIComponent(token)}`
      : `/public/reservations/${id}`;
    const data = await fetchJSONUnknown(url);
    return ReservationSchema.extend({
      guest: GuestSchema.pick({ primaryFirstName: true, primaryLastName: true }),
      campground: CampgroundSchema.pick({
        name: true,
        slug: true,
        city: true,
        state: true,
        timezone: true,
      }),
      site: SiteSchema.extend({
        siteClass: SiteClassSchema.pick({ name: true, photos: true }).optional().nullable(),
      }),
    }).parse(data);
  },

  async kioskCheckIn(id: string, upsellTotalCents: number, kioskToken?: string) {
    const res = await fetch(`${API_BASE}/public/reservations/${id}/kiosk-checkin`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(kioskToken ? { "x-kiosk-token": kioskToken } : {}),
      },
      body: JSON.stringify({ upsellTotalCents }),
    });
    return parseResponse(res, UnknownSchema);
  },
  async refundReservationPayment(
    id: string,
    amountCents: number,
    options?: { destination?: "card" | "wallet"; reason?: string },
  ) {
    const res = await fetch(`${API_BASE}/reservations/${id}/refunds`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...scopedHeaders() },
      body: JSON.stringify({
        amountCents,
        destination: options?.destination,
        reason: options?.reason,
      }),
    });
    const data = await parseResponse(res, UnknownSchema);
    return ReservationWithGroupSchema.parse(data);
  },
  /**
   * @deprecated Use updateStoreStock(campgroundId, id, { delta }) instead.
   * This method uses an incorrect endpoint path missing the campgroundId.
   */
  async adjustStock(id: string, adjustment: number) {
    console.warn(
      "adjustStock is deprecated. Use updateStoreStock(campgroundId, id, { delta }) instead.",
    );
    const res = await fetch(`${API_BASE}/store/products/${id}/stock`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", ...scopedHeaders() },
      body: JSON.stringify({ adjustment }),
    });
    const data = await parseResponse(res, UnknownSchema);
    return ProductSchema.parse(data);
  },
  async getLowStockProducts(campgroundId: string) {
    const data = await fetchJSONUnknown(`/campgrounds/${campgroundId}/store/products/low-stock`);
    return z.array(ProductSchema.extend({ category: ProductCategorySchema.nullish() })).parse(data);
  },
  async updateGuest(id: string, payload: Partial<Omit<z.input<typeof GuestSchema>, "id">>) {
    const res = await fetch(`${API_BASE}/guests/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", ...scopedHeaders() },
      body: JSON.stringify(payload),
    });
    const data = await parseResponse(res, UnknownSchema);
    return GuestSchema.parse(data);
  },
  async deleteGuest(id: string) {
    const res = await fetch(`${API_BASE}/guests/${id}`, {
      method: "DELETE",
      headers: scopedHeaders(),
    });
    if (!res.ok) throw new Error("Failed to delete guest");
    return true;
  },
  async mergeGuests(primaryId: string, secondaryId: string) {
    const res = await fetch(`${API_BASE}/guests/merge`, {
      method: "POST",
      headers: scopedHeaders(),
      body: JSON.stringify({ primaryId, secondaryId }),
    });
    const data = await parseResponse(res, UnknownSchema);
    return GuestSchema.parse(data);
  },
  async getAvailability(
    campgroundId: string,
    payload: {
      arrivalDate: string;
      departureDate: string;
      rigType?: string;
      rigLength?: string | number;
    },
  ) {
    const params = new URLSearchParams();
    params.set("arrivalDate", payload.arrivalDate);
    params.set("departureDate", payload.departureDate);
    if (payload.rigType) params.set("rigType", payload.rigType);
    if (
      payload.rigLength !== undefined &&
      payload.rigLength !== null &&
      `${payload.rigLength}` !== ""
    ) {
      params.set("rigLength", String(payload.rigLength));
    }
    const data = await fetchJSONUnknown(
      `/campgrounds/${campgroundId}/availability?${params.toString()}`,
    );
    return AvailabilitySiteArray.parse(data);
  },
  async getSitesWithStatus(
    campgroundId: string,
    payload?: { arrivalDate?: string; departureDate?: string },
  ) {
    const params = new URLSearchParams();
    if (payload?.arrivalDate) params.set("arrivalDate", payload.arrivalDate);
    if (payload?.departureDate) params.set("departureDate", payload.departureDate);
    const qs = params.toString();
    const data = await fetchJSONUnknown(
      `/campgrounds/${campgroundId}/sites/status${qs ? `?${qs}` : ""}`,
    );
    return z
      .array(
        z.object({
          id: z.string(),
          campgroundId: z.string(),
          name: z.string(),
          siteNumber: z.string(),
          siteType: z.string(),
          siteClassId: z.string().nullable(),
          siteClassName: z.string().nullable(),
          maxOccupancy: z.number(),
          latitude: z.number().nullable().optional(),
          longitude: z.number().nullable().optional(),
          defaultRate: z.number().nullable().optional(),
          status: z.enum(["available", "occupied", "maintenance"]),
          statusDetail: z.string().nullable(),
        }),
      )
      .parse(data);
  },
  async getMatchedSites(campgroundId: string, guestId: string) {
    const data = await fetchJSONUnknown(`/campgrounds/${campgroundId}/matches?guestId=${guestId}`);
    return z
      .array(
        z.object({
          site: SiteSchema.extend({
            siteClass: SiteClassSchema.optional().nullable(),
          }),
          score: z.number(),
          reasons: z.array(z.string()),
        }),
      )
      .parse(data);
  },

  // Holds
  async createHold(payload: {
    campgroundId: string;
    siteId: string;
    arrivalDate: string;
    departureDate: string;
    holdMinutes?: number;
  }) {
    const res = await fetch(`${API_BASE}/holds`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...scopedHeaders() },
      body: JSON.stringify(payload),
    });
    return parseResponse(res, UnknownSchema);
  },
  async releaseHold(id: string) {
    const res = await fetch(`${API_BASE}/holds/${id}`, {
      method: "DELETE",
      headers: scopedHeaders(),
    });
    if (!res.ok) throw new Error("Failed to release hold");
    return true;
  },
  async listHolds(campgroundId: string) {
    const data = await fetchJSONUnknown(`/holds/campgrounds/${campgroundId}`);
    return z
      .array(
        z.object({
          id: z.string(),
          campgroundId: z.string(),
          siteId: z.string(),
          arrivalDate: z.string(),
          departureDate: z.string(),
          expiresAt: z.string().nullable(),
          status: z.string(),
          site: z
            .object({
              id: z.string(),
              name: z.string().optional(),
              siteNumber: z.string().optional(),
            })
            .optional(),
        }),
      )
      .parse(data);
  },
  async checkOverlap(
    campgroundId: string,
    payload: { siteId: string; arrivalDate: string; departureDate: string; ignoreId?: string },
  ) {
    const params = new URLSearchParams();
    params.set("siteId", payload.siteId);
    params.set("arrivalDate", payload.arrivalDate);
    params.set("departureDate", payload.departureDate);
    if (payload.ignoreId) params.set("ignoreId", payload.ignoreId);
    const data = await fetchJSONUnknown(
      `/campgrounds/${campgroundId}/reservations/overlap-check?${params.toString()}`,
    );
    return OverlapCheckSchema.parse(data);
  },
  async listOverlaps(campgroundId: string) {
    const data = await fetchJSONUnknown(`/campgrounds/${campgroundId}/reservations/overlaps`);
    return OverlapListSchema.parse(data);
  },
  async getMaintenanceTickets(status?: string, campgroundId?: string) {
    const params = new URLSearchParams();
    if (status) params.set("status", status);
    if (campgroundId) params.set("campgroundId", campgroundId);

    // If we are in browser, we might have campgroundId in headers, but controller expects query param for filtering
    // However, the controller uses @Query('campgroundId').
    // Let's try to get it from localStorage if not provided, or rely on headers if controller supports it?
    // My controller explicitly asks for @Query('campgroundId').
    if (!campgroundId && typeof window !== "undefined") {
      const stored = localStorage.getItem("campreserv:selectedCampground");
      if (stored) params.set("campgroundId", stored);
    }

    const qs = params.toString();
    const data = await fetchJSONUnknown(`/maintenance${qs ? `?${qs}` : ""}`);
    return MaintenanceArray.parse(data);
  },
  async createMaintenanceTicket(payload: z.input<typeof CreateMaintenanceSchema>) {
    const res = await fetch(`${API_BASE}/maintenance`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...scopedHeaders() },
      body: JSON.stringify(payload),
    });
    const data = await parseResponse(res, UnknownSchema);
    return MaintenanceSchema.parse(data);
  },
  async updateMaintenance(id: string, payload: Partial<z.input<typeof CreateMaintenanceSchema>>) {
    const res = await fetch(`${API_BASE}/maintenance/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", ...scopedHeaders() },
      body: JSON.stringify(payload),
    });
    const data = await parseResponse(res, UnknownSchema);
    return MaintenanceSchema.parse(data);
  },

  // Operations / Housekeeping
  async listTasks(
    campgroundId: string,
    payload?: { type?: string; state?: string; slaStatus?: string },
  ) {
    const params = new URLSearchParams({ campgroundId });
    if (payload?.type) params.set("type", payload.type);
    if (payload?.state) params.set("state", payload.state);
    if (payload?.slaStatus) params.set("slaStatus", payload.slaStatus);
    const data = await fetchJSONUnknown(`/operations/tasks?${params.toString()}`);
    const taskStates: ["pending", "in_progress", "blocked", "done", "failed", "expired"] = [
      "pending",
      "in_progress",
      "blocked",
      "done",
      "failed",
      "expired",
    ];
    const slaStatuses: ["on_track", "at_risk", "breached"] = ["on_track", "at_risk", "breached"];
    const TaskStateSchema = z.enum(taskStates);
    const SlaStatusSchema = z.enum(slaStatuses);
    return z
      .array(
        z.object({
          id: z.string(),
          campgroundId: z.string(),
          title: z.string(),
          description: z.string().nullable(),
          type: z.string(),
          state: TaskStateSchema,
          priority: z.string().nullable().default("medium"),
          assignedTo: z.string().nullable(),
          assignedToUserId: z.string().nullable().optional(),
          assignedToTeamId: z.string().nullable().optional(),
          slaDueAt: z.string().nullable().optional(),
          slaStatus: SlaStatusSchema.nullable().optional(),
          dueDate: z.string().nullable(),
          completedAt: z.string().nullable(),
          siteId: z.string().nullable(),
          site: z
            .object({
              id: z.string(),
              name: z.string().optional(),
              siteNumber: z.string().optional(),
            })
            .nullable(),
        }),
      )
      .parse(data);
  },

  // Events
  async getEvents(campgroundId: string, start?: string, end?: string) {
    const params = new URLSearchParams({ campgroundId });
    if (start) params.set("start", start);
    if (end) params.set("end", end);
    const data = await fetchJSONUnknown(`/events?${params.toString()}`);
    return z.array(EventSchema).parse(data);
  },
  async getPublicEvents(token: string, campgroundId: string, start?: string, end?: string) {
    const params = new URLSearchParams({ campgroundId });
    if (start) params.set("start", start);
    if (end) params.set("end", end);
    const res = await fetch(`${API_BASE}/events/public/list?${params.toString()}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await parseResponse(res, UnknownSchema);
    return z.array(EventSchema).parse(data);
  },

  // Portal store (guest token)
  async getPortalProducts(token: string, campgroundId: string, categoryId?: string) {
    const params = new URLSearchParams({ campgroundId });
    if (categoryId) params.set("categoryId", categoryId);
    const res = await fetch(`${API_BASE}/portal/store/products?${params.toString()}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await parseResponse(res, UnknownSchema);
    return z.array(ProductSchema).parse(data);
  },
  async getPortalAddOns(token: string, campgroundId: string) {
    const params = new URLSearchParams({ campgroundId });
    const res = await fetch(`${API_BASE}/portal/store/addons?${params.toString()}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await parseResponse(res, UnknownSchema);
    return z.array(AddOnSchema).parse(data);
  },
  async createPortalOrder(
    token: string,
    payload: {
      reservationId: string;
      items: { productId?: string; addOnId?: string; qty: number }[];
      notes?: string;
    },
  ) {
    const res = await fetch(`${API_BASE}/portal/store/orders`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify(payload),
    });
    const data = await parseResponse(res, UnknownSchema);
    return StoreOrderSchema.parse(data);
  },

  // Staff store orders
  async getStoreOrders(campgroundId: string, params?: { status?: string }) {
    const qs = new URLSearchParams();
    if (params?.status) qs.set("status", params.status);
    const data = await fetchJSONUnknown(
      `/campgrounds/${campgroundId}/store/orders${qs.toString() ? `?${qs.toString()}` : ""}`,
    );
    return z.array(StoreOrderSchema).parse(data);
  },
  async getStoreOrderSummary(campgroundId: string, params?: { start?: string; end?: string }) {
    const qs = new URLSearchParams();
    if (params?.start) qs.set("start", params.start);
    if (params?.end) qs.set("end", params.end);
    const data = await fetchJSONUnknown(
      `/campgrounds/${campgroundId}/store/orders/summary${qs.toString() ? `?${qs.toString()}` : ""}`,
    );
    return z
      .object({
        byChannel: z.array(
          z.object({
            channel: z.string().nullable().optional(),
            _count: z.object({ _all: z.number() }),
            _sum: z.object({ totalCents: z.number().nullable().optional() }),
          }),
        ),
        byFulfillment: z.array(
          z.object({
            fulfillmentType: z.string().nullable().optional(),
            _count: z.object({ _all: z.number() }),
            _sum: z.object({ totalCents: z.number().nullable().optional() }),
          }),
        ),
        byStatus: z.array(
          z.object({
            status: z.string().nullable().optional(),
            _count: z.object({ _all: z.number() }),
            _sum: z.object({ totalCents: z.number().nullable().optional() }),
          }),
        ),
        averages: z.object({
          prepMinutesPlanned: z.number().nullable().optional(),
          prepMinutesActual: z.number().nullable().optional(),
        }),
        averagesByFulfillment: z
          .array(
            z.object({
              fulfillmentType: z.string().nullable().optional(),
              prepMinutesPlanned: z.number().nullable().optional(),
              prepMinutesActual: z.number().nullable().optional(),
            }),
          )
          .default([]),
      })
      .parse(data);
  },
  async getStoreUnseen(campgroundId: string) {
    const data = await fetchJSONUnknown(`/campgrounds/${campgroundId}/store/orders/unseen`);
    return z
      .array(
        z.object({
          id: z.string(),
          createdAt: z.string(),
          reservationId: z.string().nullable(),
          siteNumber: z.string().nullable(),
        }),
      )
      .parse(data);
  },
  async markStoreOrderSeen(id: string, campgroundId?: string) {
    const path = withCampgroundId(`/store/orders/${id}/seen`, campgroundId);
    const res = await fetch(`${API_BASE}${path}`, {
      method: "PATCH",
      headers: scopedHeaders(),
    });
    return parseResponse(res, UnknownSchema);
  },
  async completeStoreOrder(id: string, campgroundId?: string) {
    const path = withCampgroundId(`/store/orders/${id}/complete`, campgroundId);
    const res = await fetch(`${API_BASE}${path}`, {
      method: "PATCH",
      headers: scopedHeaders(),
    });
    return parseResponse(res, UnknownSchema);
  },
  async updateStoreOrderStatus(
    id: string,
    status: "pending" | "ready" | "delivered" | "completed" | "cancelled" | "refunded",
    campgroundId?: string,
  ) {
    const path = withCampgroundId(`/store/orders/${id}/status`, campgroundId);
    const res = await fetch(`${API_BASE}${path}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", ...scopedHeaders() },
      body: JSON.stringify({ status }),
    });
    return parseResponse(res, UnknownSchema);
  },
  async getStoreOrderHistory(id: string, campgroundId?: string) {
    const data = await fetchJSONUnknown(
      withCampgroundId(`/store/orders/${id}/history`, campgroundId),
    );
    return z.array(StoreOrderAdjustmentSchema).parse(data);
  },
  async createStoreOrderAdjustment(
    id: string,
    payload: {
      type?: "refund" | "exchange";
      items?: Array<{ itemId?: string; qty?: number; amountCents?: number }>;
      amountCents?: number;
      note?: string | null;
    },
    campgroundId?: string,
  ) {
    const path = withCampgroundId(`/store/orders/${id}/refunds`, campgroundId);
    const res = await fetch(`${API_BASE}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...scopedHeaders() },
      body: JSON.stringify(payload),
    });
    const data = await parseResponse(res, UnknownSchema);
    return StoreOrderAdjustmentSchema.parse(data);
  },
  async createEvent(payload: z.input<typeof CreateEventSchema>) {
    const res = await fetch(`${API_BASE}/events`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...scopedHeaders() },
      body: JSON.stringify(payload),
    });
    const data = await parseResponse(res, UnknownSchema);
    return EventSchema.parse(data);
  },
  async updateEvent(id: string, payload: Partial<z.input<typeof CreateEventSchema>>) {
    const res = await fetch(`${API_BASE}/events/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", ...scopedHeaders() },
      body: JSON.stringify(payload),
    });
    const data = await parseResponse(res, UnknownSchema);
    return EventSchema.parse(data);
  },
  async deleteEvent(id: string) {
    const res = await fetch(`${API_BASE}/events/${id}`, {
      method: "DELETE",
      headers: scopedHeaders(),
    });
    if (!res.ok) throw new Error("Failed to delete event");
    return true;
  },
  async getPricingRules(campgroundId: string) {
    const data = await fetchJSONUnknown(`/campgrounds/${campgroundId}/pricing-rules`);
    return z.array(PricingRuleSchema).parse(data);
  },
  async createPricingRule(campgroundId: string, payload: z.input<typeof CreatePricingRuleSchema>) {
    const res = await fetch(`${API_BASE}/campgrounds/${campgroundId}/pricing-rules`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...scopedHeaders() },
      body: JSON.stringify(payload),
    });
    const data = await parseResponse(res, UnknownSchema);
    return PricingRuleSchema.parse(data);
  },
  async updatePricingRule(
    id: string,
    payload: Partial<z.input<typeof PricingRuleSchema>>,
    campgroundId?: string,
  ) {
    const path = withCampgroundId(`/pricing-rules/${id}`, campgroundId);
    const res = await fetch(`${API_BASE}${path}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", ...scopedHeaders() },
      body: JSON.stringify(payload),
    });
    const data = await parseResponse(res, UnknownSchema);
    return PricingRuleSchema.parse(data);
  },
  async deletePricingRule(id: string, campgroundId?: string) {
    const path = withCampgroundId(`/pricing-rules/${id}`, campgroundId);
    const res = await fetch(`${API_BASE}${path}`, { method: "DELETE", headers: scopedHeaders() });
    if (!res.ok) throw new Error("Failed to delete pricing rule");
    return true;
  },
  async getPrivacySettings(campgroundId: string) {
    const res = await fetch(`${API_BASE}/campgrounds/${campgroundId}/privacy`, {
      headers: scopedHeaders(),
    });
    const data = await parseResponse(res, UnknownSchema);
    return PrivacySettingsSchema.parse(data);
  },
  async updatePrivacySettings(
    campgroundId: string,
    payload: Partial<{
      redactPII: boolean;
      consentRequired: boolean;
      backupRetentionDays: number;
      keyRotationDays: number;
    }>,
  ) {
    const res = await fetch(`${API_BASE}/campgrounds/${campgroundId}/privacy`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...scopedHeaders() },
      body: JSON.stringify(payload),
    });
    const data = await parseResponse(res, UnknownSchema);
    return PrivacySettingsSchema.parse(data);
  },
  async recordConsent(
    campgroundId: string,
    payload: {
      subject: string;
      consentType: string;
      grantedBy: string;
      method?: string;
      purpose?: string;
      expiresAt?: string;
      metadata?: Record<string, unknown>;
    },
  ) {
    const res = await fetch(`${API_BASE}/campgrounds/${campgroundId}/privacy/consents`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...scopedHeaders() },
      body: JSON.stringify(payload),
    });
    const data = await parseResponse(res, UnknownSchema);
    return ConsentSchema.parse(data);
  },
  async listConsents(campgroundId: string) {
    const res = await fetch(`${API_BASE}/campgrounds/${campgroundId}/privacy/consents`, {
      headers: scopedHeaders(),
    });
    const data = await parseResponse(res, UnknownSchema);
    return z.array(ConsentSchema).parse(data);
  },
  async listPiiTags(campgroundId: string) {
    const res = await fetch(`${API_BASE}/campgrounds/${campgroundId}/privacy/pii-tags`, {
      headers: scopedHeaders(),
    });
    return parseResponse(res, UnknownSchema);
  },
  async upsertPiiTag(
    campgroundId: string,
    payload: {
      resource: string;
      field: string;
      classification: string;
      redactionMode?: string;
      createdById?: string;
    },
  ) {
    const res = await fetch(`${API_BASE}/campgrounds/${campgroundId}/privacy/pii-tags`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...scopedHeaders() },
      body: JSON.stringify(payload),
    });
    return parseResponse(res, UnknownSchema);
  },
  async listRecentRedactions(campgroundId: string) {
    const res = await fetch(`${API_BASE}/campgrounds/${campgroundId}/privacy/redactions/recent`, {
      headers: scopedHeaders(),
    });
    return parseResponse(res, UnknownSchema);
  },
  async previewRedaction(campgroundId: string, payload: { resource?: string; sample: unknown }) {
    const res = await fetch(`${API_BASE}/campgrounds/${campgroundId}/privacy/preview`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...scopedHeaders() },
      body: JSON.stringify(payload),
    });
    return parseResponse(res, UnknownSchema);
  },
  async exportPrivacyBundle(campgroundId: string, format: "json" | "csv" = "json") {
    const qs = format ? `?format=${format}` : "";
    const res = await fetch(`${API_BASE}/campgrounds/${campgroundId}/privacy/export${qs}`, {
      headers: scopedHeaders(),
    });
    if (!res.ok) throw new Error("Failed to export privacy bundle");
    if (format === "csv") {
      return {
        format,
        content: await res.text(),
        contentType: res.headers.get("content-type") ?? "text/csv",
      };
    }
    return z
      .object({
        exportVersion: z.string(),
        campgroundId: z.string(),
        generatedAt: z.string(),
        settings: UnknownRecordSchema,
        consents: UnknownArraySchema,
        piiTags: UnknownArraySchema,
      })
      .parse(await res.json());
  },
  async getPermissionPolicies(campgroundId?: string) {
    const qs = campgroundId ? `?campgroundId=${campgroundId}` : "";
    const res = await fetch(`${API_BASE}/permissions/policies${qs}`, { headers: scopedHeaders() });
    return parseResponse(res, UnknownSchema);
  },
  async upsertPermissionRule(payload: {
    campgroundId?: string;
    role: string;
    resource: string;
    action: string;
    fields?: string[];
    effect?: string;
    createdById?: string;
  }) {
    const res = await fetch(`${API_BASE}/permissions/rules`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...scopedHeaders() },
      body: JSON.stringify(payload),
    });
    return parseResponse(res, UnknownSchema);
  },
  async submitApproval(payload: {
    action: string;
    requestedBy: string;
    campgroundId?: string;
    resource?: string;
    targetId?: string;
    justification?: string;
    payload?: Record<string, unknown>;
  }) {
    const res = await fetch(`${API_BASE}/permissions/approvals`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...scopedHeaders() },
      body: JSON.stringify(payload),
    });
    return parseResponse(res, UnknownSchema);
  },
  async decideApproval(id: string, payload: { approve: boolean; actorId: string }) {
    const res = await fetch(`${API_BASE}/permissions/approvals/${id}/decision`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...scopedHeaders() },
      body: JSON.stringify(payload),
    });
    return parseResponse(res, UnknownSchema);
  },
  async getQuote(
    campgroundId: string,
    payload: { siteId: string; arrivalDate: string; departureDate: string },
  ) {
    const res = await fetch(`${API_BASE}/campgrounds/${campgroundId}/quote`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...scopedHeaders() },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error("Failed to quote reservation");
    const data = await res.json();
    return QuoteSchema.parse(data);
  },
  async getLedger(campgroundId: string, opts?: { start?: string; end?: string; glCode?: string }) {
    const params = new URLSearchParams();
    if (opts?.start) params.set("start", opts.start);
    if (opts?.end) params.set("end", opts.end);
    if (opts?.glCode) params.set("glCode", opts.glCode);
    const qs = params.toString();
    const data = await fetchJSONUnknown(`/campgrounds/${campgroundId}/ledger${qs ? `?${qs}` : ""}`);
    return z.array(LedgerEntrySchema).parse(data);
  },
  async getLedgerByReservation(reservationId: string, campgroundId?: string) {
    const data = await fetchJSONUnknown(
      withCampgroundId(`/reservations/${reservationId}/ledger`, campgroundId),
    );
    return z.array(LedgerEntrySchema).parse(data);
  },
  async getLedgerSummary(campgroundId: string, opts?: { start?: string; end?: string }) {
    const params = new URLSearchParams();
    if (opts?.start) params.set("start", opts.start);
    if (opts?.end) params.set("end", opts.end);
    const qs = params.toString();
    const data = await fetchJSONUnknown(
      `/campgrounds/${campgroundId}/ledger/summary${qs ? `?${qs}` : ""}`,
    );
    return z
      .array(
        z.object({
          glCode: z.string(),
          netCents: z.number(),
        }),
      )
      .parse(data);
  },
  async getAging(campgroundId: string) {
    const data = await fetchJSONUnknown(`/campgrounds/${campgroundId}/aging`);
    return z
      .object({
        current: z.number(),
        "31_60": z.number(),
        "61_90": z.number(),
        "90_plus": z.number(),
      })
      .parse(data);
  },
  async getBookingSources(
    campgroundId: string,
    payload?: { startDate?: string; endDate?: string },
  ) {
    const params = new URLSearchParams();
    if (payload?.startDate) params.set("startDate", payload.startDate);
    if (payload?.endDate) params.set("endDate", payload.endDate);
    const qs = params.toString();
    const data = await fetchJSONUnknown(
      `/campgrounds/${campgroundId}/reports/booking-sources${qs ? `?${qs}` : ""}`,
    );
    return UnknownRecordSchema.parse(data);
  },
  async getGuestOrigins(campgroundId: string, payload?: { startDate?: string; endDate?: string }) {
    const params = new URLSearchParams();
    if (payload?.startDate) params.set("startDate", payload.startDate);
    if (payload?.endDate) params.set("endDate", payload.endDate);
    const qs = params.toString();
    const data = await fetchJSONUnknown(
      `/campgrounds/${campgroundId}/reports/guest-origins${qs ? `?${qs}` : ""}`,
    );
    return UnknownRecordSchema.parse(data);
  },
  async getReferralPerformance(
    campgroundId: string,
    payload?: { startDate?: string; endDate?: string },
  ) {
    const params = new URLSearchParams();
    if (payload?.startDate) params.set("startDate", payload.startDate);
    if (payload?.endDate) params.set("endDate", payload.endDate);
    const qs = params.toString();
    const data = await fetchJSONUnknown(
      `/campgrounds/${campgroundId}/reports/referrals${qs ? `?${qs}` : ""}`,
    );
    return UnknownRecordSchema.parse(data);
  },
  async getStayReasonBreakdown(
    campgroundId: string,
    payload?: { startDate?: string; endDate?: string },
  ) {
    const params = new URLSearchParams();
    if (payload?.startDate) params.set("startDate", payload.startDate);
    if (payload?.endDate) params.set("endDate", payload.endDate);
    const qs = params.toString();
    const data = await fetchJSONUnknown(
      `/campgrounds/${campgroundId}/reports/stay-reasons${qs ? `?${qs}` : ""}`,
    );
    return StayReasonReportSchema.parse(data);
  },
  async listReferralPrograms(campgroundId: string) {
    const data = await fetchJSONUnknown(`/campgrounds/${campgroundId}/referral-programs`);
    return z.array(ReferralProgramSchema).parse(data);
  },
  async createReferralProgram(
    campgroundId: string,
    payload: {
      code: string;
      linkSlug?: string;
      source?: string;
      channel?: string;
      incentiveType: string;
      incentiveValue: number;
      isActive?: boolean;
      notes?: string;
    },
  ) {
    const res = await fetch(`${API_BASE}/campgrounds/${campgroundId}/referral-programs`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...scopedHeaders() },
      body: JSON.stringify(payload),
    });
    const data = await parseResponse(res, UnknownSchema);
    return ReferralProgramSchema.parse(data);
  },
  async updateReferralProgram(
    campgroundId: string,
    id: string,
    payload: Partial<{
      code: string;
      linkSlug?: string;
      source?: string;
      channel?: string;
      incentiveType: string;
      incentiveValue: number;
      isActive?: boolean;
      notes?: string;
    }>,
  ) {
    const res = await fetch(`${API_BASE}/campgrounds/${campgroundId}/referral-programs/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", ...scopedHeaders() },
      body: JSON.stringify(payload),
    });
    const data = await parseResponse(res, UnknownSchema);
    return ReferralProgramSchema.parse(data);
  },
  async getProducts(campgroundId: string) {
    const data = await fetchJSONUnknown(`/campgrounds/${campgroundId}/store/products`);
    return z.array(ProductSchema).parse(data);
  },
  async getProductCategories(campgroundId: string) {
    const data = await fetchJSONUnknown(`/campgrounds/${campgroundId}/store/categories`);
    return z.array(ProductCategorySchema).parse(data);
  },
  async createStoreOrder(
    campgroundId: string,
    payload: Record<string, unknown>,
    headers?: Record<string, string>,
  ) {
    const res = await fetch(`${API_BASE}/campgrounds/${campgroundId}/store/orders`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...scopedHeaders(), ...(headers ?? {}) },
      body: JSON.stringify(payload),
    });
    const data = await parseResponse(res, UnknownSchema);
    return StoreOrderSchema.parse(data);
  },
  async createPaymentIntent(
    amountCents: number,
    currency: string,
    reservationId: string,
    autoCapture: boolean = true,
  ) {
    const res = await fetch(`${API_BASE}/payments/intents`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...scopedHeaders() },
      body: JSON.stringify({ amountCents, currency, reservationId, autoCapture }),
    });
    const data = await parseResponse(res, UnknownSchema);
    return z
      .object({
        id: z.string(),
        clientSecret: z.string(),
        amountCents: z.number(),
        currency: z.string(),
        reservationId: z.string(),
        status: z.string(),
      })
      .parse(data);
  },

  /**
   * Create a payment intent for public/guest checkout (no auth required)
   * Note: The server computes amountCents from the reservation balance - clients should not specify it
   */
  async createPublicPaymentIntent(params: {
    reservationId: string;
    currency?: string;
    guestEmail?: string;
    captureMethod?: "automatic" | "manual";
    idempotencyKey?: string;
  }) {
    const { idempotencyKey, ...payload } = params;
    const fallbackKey = `public:${params.reservationId}`;
    const res = await fetch(`${API_BASE}/public/payments/intents`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Idempotency-Key": idempotencyKey || fallbackKey,
      },
      body: JSON.stringify(payload),
    });
    const data = await parseResponse(res, UnknownSchema);
    return z
      .object({
        id: z.string(),
        clientSecret: z.string(),
        amountCents: z.number(),
        currency: z.string(),
        status: z.string(),
      })
      .parse(data);
  },

  /**
   * Confirm a payment intent after Stripe payment succeeds (public/guest checkout)
   * This records the payment in our database and updates the reservation status
   */
  async confirmPublicPaymentIntent(paymentIntentId: string, reservationId: string) {
    const res = await fetch(`${API_BASE}/public/payments/intents/${paymentIntentId}/confirm`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reservationId }),
    });
    const data = await parseResponse(res, UnknownSchema);
    return z
      .object({
        success: z.boolean(),
        status: z.string(),
        paymentId: z.string().optional(),
        reservationId: z.string(),
      })
      .parse(data);
  },

  /**
   * Get the status of a payment intent (staff only)
   */
  async getPaymentIntentStatus(paymentIntentId: string) {
    const data = await fetchJSONUnknown(`/payments/intents/${paymentIntentId}`);
    return z
      .object({
        id: z.string(),
        status: z.string(),
        amountCents: z.number(),
        amountReceivedCents: z.number(),
        currency: z.string(),
        metadata: z.record(z.string()).optional(),
        captureMethod: z.string(),
        createdAt: z.string(),
      })
      .parse(data);
  },

  /**
   * Capture an authorized payment (staff only, for deposit flows)
   */
  async capturePaymentIntent(paymentIntentId: string, amountCents?: number) {
    const res = await fetch(`${API_BASE}/payments/intents/${paymentIntentId}/capture`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...scopedHeaders() },
      body: JSON.stringify({ amountCents }),
    });
    const data = await parseResponse(res, UnknownSchema);
    return z
      .object({
        id: z.string(),
        status: z.string(),
        amountCents: z.number(),
        amountReceivedCents: z.number(),
        currency: z.string(),
      })
      .parse(data);
  },

  /**
   * Issue a refund for a payment intent (staff only)
   */
  async refundPaymentIntent(
    paymentIntentId: string,
    params?: {
      amountCents?: number;
      reason?: "duplicate" | "fraudulent" | "requested_by_customer";
    },
  ) {
    const res = await fetch(`${API_BASE}/payments/intents/${paymentIntentId}/refund`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...scopedHeaders() },
      body: JSON.stringify(params || {}),
    });
    const data = await parseResponse(res, UnknownSchema);
    return z
      .object({
        id: z.string(),
        status: z.string(),
        amountCents: z.number().nullable(),
        paymentIntentId: z.string(),
        reason: z.string().nullable(),
      })
      .parse(data);
  },

  async getCampgroundPaymentSettings(campgroundId: string) {
    const data = await fetchJSONUnknown(`/campgrounds/${campgroundId}`);
    const parsed = z
      .object({
        id: z.string(),
        name: z.string(),
        stripeAccountId: z.string().nullable().optional(),
        applicationFeeFlatCents: z.number().nullable().optional(),
        perBookingFeeCents: z.number().nullable().optional(),
        monthlyFeeCents: z.number().nullable().optional(),
        billingPlan: z.enum(["ota_only", "standard", "enterprise"]).nullable().optional(),
        feeMode: z.enum(["absorb", "pass_through"]).nullable().optional(),
        stripeCapabilities: z.record(z.string(), z.string()).nullable().optional(),
        stripeCapabilitiesFetchedAt: z.string().nullable().optional(),
      })
      .safeParse(data);
    if (!parsed.success)
      return {
        stripeAccountId: null,
        applicationFeeFlatCents: null,
        stripeCapabilities: null,
        stripeCapabilitiesFetchedAt: null,
      };
    return {
      stripeAccountId: parsed.data.stripeAccountId ?? null,
      applicationFeeFlatCents: parsed.data.applicationFeeFlatCents ?? null,
      perBookingFeeCents: parsed.data.perBookingFeeCents ?? null,
      monthlyFeeCents: parsed.data.monthlyFeeCents ?? null,
      billingPlan: parsed.data.billingPlan ?? "ota_only",
      feeMode: parsed.data.feeMode ?? "absorb",
      name: parsed.data.name,
      stripeCapabilities: parsed.data.stripeCapabilities ?? null,
      stripeCapabilitiesFetchedAt: parsed.data.stripeCapabilitiesFetchedAt ?? null,
    };
  },

  async getPaymentGatewayConfig(campgroundId: string) {
    const data = await fetchJSONUnknown(`/campgrounds/${campgroundId}/payment-gateway`);
    const parsed = z
      .object({
        id: z.string(),
        campgroundId: z.string(),
        gateway: z.enum(["stripe", "adyen", "authorize_net", "other"]),
        mode: z.enum(["test", "prod"]),
        feeMode: z.enum(["absorb", "pass_through"]),
        feePercentBasisPoints: z.number().nullable().optional(),
        feeFlatCents: z.number().nullable().optional(),
        feePresetId: z.string().nullable().optional(),
        feePresetLabel: z.string().nullable().optional(),
        effectiveFee: z.object({
          percentBasisPoints: z.number(),
          flatFeeCents: z.number(),
        }),
        credentials: z.object({
          publishableKeySecretId: z.string().nullable(),
          secretKeySecretId: z.string().nullable(),
          merchantAccountIdSecretId: z.string().nullable(),
          webhookSecretId: z.string().nullable(),
        }),
        hasProductionCredentials: z.boolean(),
        additionalConfig: z.record(z.unknown()).nullable().optional(),
      })
      .parse(data);
    return parsed;
  },

  async upsertPaymentGatewayConfig(
    campgroundId: string,
    payload: {
      gateway: "stripe" | "adyen" | "authorize_net" | "other";
      mode: "test" | "prod";
      feeMode: "absorb" | "pass_through";
      feePercentBasisPoints?: number | null;
      feeFlatCents?: number | null;
      feePresetId?: string | null;
      publishableKeySecretId?: string | null;
      secretKeySecretId?: string | null;
      merchantAccountIdSecretId?: string | null;
      webhookSecretId?: string | null;
      additionalConfig?: Record<string, unknown> | null;
    },
  ) {
    const res = await fetch(`${API_BASE}/campgrounds/${campgroundId}/payment-gateway`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", ...scopedHeaders() },
      body: JSON.stringify(payload),
    });
    const data = await parseResponse(res, UnknownSchema);
    return z
      .object({
        id: z.string(),
        campgroundId: z.string(),
        gateway: z.enum(["stripe", "adyen", "authorize_net", "other"]),
        mode: z.enum(["test", "prod"]),
        feeMode: z.enum(["absorb", "pass_through"]),
        effectiveFee: z.object({
          percentBasisPoints: z.number(),
          flatFeeCents: z.number(),
        }),
        feePercentBasisPoints: z.number().nullable().optional(),
        feeFlatCents: z.number().nullable().optional(),
        feePresetId: z.string().nullable().optional(),
        feePresetLabel: z.string().nullable().optional(),
        credentials: z.object({
          publishableKeySecretId: z.string().nullable(),
          secretKeySecretId: z.string().nullable(),
          merchantAccountIdSecretId: z.string().nullable(),
          webhookSecretId: z.string().nullable(),
        }),
        hasProductionCredentials: z.boolean(),
        additionalConfig: z.record(z.unknown()).nullable().optional(),
      })
      .parse(data);
  },

  async connectCampgroundPayments(campgroundId: string) {
    const res = await fetch(`${API_BASE}/campgrounds/${campgroundId}/payments/connect`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...scopedHeaders() },
    });
    const data = await parseResponse(res, UnknownSchema);
    return z
      .object({
        accountId: z.string(),
        onboardingUrl: z.string(),
      })
      .parse(data);
  },

  async updateCampgroundPaymentSettings(
    campgroundId: string,
    payload: {
      applicationFeeFlatCents?: number;
      perBookingFeeCents?: number;
      monthlyFeeCents?: number;
      billingPlan?: "ota_only" | "standard" | "enterprise";
      feeMode?: "absorb" | "pass_through";
    },
  ) {
    const res = await fetch(`${API_BASE}/campgrounds/${campgroundId}/payments/settings`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...scopedHeaders() },
      body: JSON.stringify(payload),
    });
    const data = await parseResponse(res, UnknownSchema);
    return z
      .object({
        stripeAccountId: z.string().nullable().optional(),
        applicationFeeFlatCents: z.number().nullable().optional(),
        perBookingFeeCents: z.number().nullable().optional(),
        monthlyFeeCents: z.number().nullable().optional(),
        billingPlan: z.enum(["ota_only", "standard", "enterprise"]).nullable().optional(),
        feeMode: z.enum(["absorb", "pass_through"]).nullable().optional(),
      })
      .parse(data);
  },

  async listPayouts(
    campgroundId: string,
    status?: "pending" | "in_transit" | "paid" | "failed" | "canceled",
  ) {
    const qs = new URLSearchParams();
    if (status) qs.set("status", status);
    const data = await fetchJSONUnknown(
      `/campgrounds/${campgroundId}/payouts${qs.toString() ? `?${qs.toString()}` : ""}`,
    );
    const PayoutSchema = z.object({
      id: z.string(),
      stripePayoutId: z.string(),
      stripeAccountId: z.string(),
      amountCents: z.number(),
      feeCents: z.number().nullable().optional(),
      currency: z.string(),
      status: z.string(),
      stripeCapabilities: z.record(z.string(), z.string()).nullable().optional(),
      stripeCapabilitiesFetchedAt: z.string().nullable().optional(),
      arrivalDate: z.string().nullable().optional(),
      paidAt: z.string().nullable().optional(),
      statementDescriptor: z.string().nullable().optional(),
      createdAt: z.string().optional(),
      lines: z
        .array(
          z.object({
            id: z.string(),
            type: z.string(),
            amountCents: z.number(),
            currency: z.string(),
            description: z.string().nullable().optional(),
            reservationId: z.string().nullable().optional(),
            paymentIntentId: z.string().nullable().optional(),
            chargeId: z.string().nullable().optional(),
            balanceTransactionId: z.string().nullable().optional(),
            createdAt: z.string().optional(),
          }),
        )
        .optional(),
    });
    return z.array(PayoutSchema).parse(data);
  },

  async getPayout(campgroundId: string, payoutId: string) {
    const data = await fetchJSONUnknown(`/campgrounds/${campgroundId}/payouts/${payoutId}`);
    const PayoutSchema = z.object({
      id: z.string(),
      stripePayoutId: z.string(),
      stripeAccountId: z.string(),
      amountCents: z.number(),
      feeCents: z.number().nullable().optional(),
      currency: z.string(),
      status: z.string(),
      arrivalDate: z.string().nullable().optional(),
      paidAt: z.string().nullable().optional(),
      statementDescriptor: z.string().nullable().optional(),
      createdAt: z.string().optional(),
      lines: z
        .array(
          z.object({
            id: z.string(),
            type: z.string(),
            amountCents: z.number(),
            currency: z.string(),
            description: z.string().nullable().optional(),
            reservationId: z.string().nullable().optional(),
            paymentIntentId: z.string().nullable().optional(),
            chargeId: z.string().nullable().optional(),
            balanceTransactionId: z.string().nullable().optional(),
            createdAt: z.string().optional(),
          }),
        )
        .optional(),
    });
    return PayoutSchema.parse(data);
  },

  async getPayoutRecon(campgroundId: string, payoutId: string) {
    const data = await fetchJSONUnknown(`/campgrounds/${campgroundId}/payouts/${payoutId}/recon`);
    return z
      .object({
        payoutId: z.string(),
        campgroundId: z.string(),
        payoutAmountCents: z.number(),
        payoutFeeCents: z.number(),
        payoutNetCents: z.number(),
        lineSumCents: z.number(),
        ledgerNetCents: z.number(),
        driftVsLinesCents: z.number(),
        driftVsLedgerCents: z.number(),
      })
      .parse(data);
  },

  async exportPayoutCsv(campgroundId: string, payoutId: string) {
    const res = await fetch(`${API_BASE}/campgrounds/${campgroundId}/payouts/${payoutId}/export`, {
      method: "GET",
      headers: { ...scopedHeaders() },
    });
    if (!res.ok) {
      throw new Error(`Failed to export payout: ${res.statusText}`);
    }
    const blob = await res.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `payout-${payoutId}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  },

  async exportPayoutLedgerCsv(campgroundId: string, payoutId: string) {
    const res = await fetch(
      `${API_BASE}/campgrounds/${campgroundId}/payouts/${payoutId}/ledger-export`,
      {
        method: "GET",
        headers: { ...scopedHeaders() },
      },
    );
    if (!res.ok) {
      throw new Error(`Failed to export payout ledger: ${res.statusText}`);
    }
    const blob = await res.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `payout-ledger-${payoutId}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  },

  async exportDisputesCsv(campgroundId: string, status?: string) {
    const qs = new URLSearchParams();
    if (status) qs.set("status", status);
    const res = await fetch(
      `${API_BASE}/campgrounds/${campgroundId}/disputes/export${qs.toString() ? `?${qs.toString()}` : ""}`,
      {
        method: "GET",
        headers: { ...scopedHeaders() },
      },
    );
    if (!res.ok) throw new Error(`Failed to export disputes: ${res.statusText}`);
    const blob = await res.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `disputes-${campgroundId}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  },

  async listDisputeTemplates(campgroundId: string) {
    const data = await fetchJSONUnknown(`/campgrounds/${campgroundId}/disputes/templates`);
    return z.array(z.object({ id: z.string(), label: z.string() })).parse(data);
  },

  async getDispute(campgroundId: string, disputeId: string) {
    const data = await fetchJSONUnknown(`/campgrounds/${campgroundId}/disputes/${disputeId}`);
    const DisputeSchema = z.object({
      id: z.string(),
      stripeDisputeId: z.string(),
      stripeChargeId: z.string().nullable().optional(),
      stripePaymentIntentId: z.string().nullable().optional(),
      campgroundId: z.string(),
      reservationId: z.string().nullable().optional(),
      payoutId: z.string().nullable().optional(),
      amountCents: z.number(),
      currency: z.string(),
      reason: z.string().nullable().optional(),
      status: z.string(),
      evidenceDueBy: z.string().nullable().optional(),
      createdAt: z.string().optional(),
      updatedAt: z.string().optional(),
      notes: z.string().nullable().optional(),
    });
    return DisputeSchema.parse(data);
  },

  async listDisputes(campgroundId: string, status?: string) {
    const qs = new URLSearchParams();
    if (status) qs.set("status", status);
    const data = await fetchJSONUnknown(
      `/campgrounds/${campgroundId}/disputes${qs.toString() ? `?${qs.toString()}` : ""}`,
    );
    const DisputeSchema = z.object({
      id: z.string(),
      stripeDisputeId: z.string(),
      stripeChargeId: z.string().nullable().optional(),
      stripePaymentIntentId: z.string().nullable().optional(),
      campgroundId: z.string(),
      reservationId: z.string().nullable().optional(),
      payoutId: z.string().nullable().optional(),
      amountCents: z.number(),
      currency: z.string(),
      reason: z.string().nullable().optional(),
      status: z.string(),
      evidenceDueBy: z.string().nullable().optional(),
      createdAt: z.string().optional(),
      updatedAt: z.string().optional(),
      notes: z.string().nullable().optional(),
    });
    return z.array(DisputeSchema).parse(data);
  },

  // Public API methods (no auth required)
  async getPublicCampgrounds(options?: { limit?: number }) {
    const maxResults = options?.limit ?? null;
    const pageSize = Math.max(1, Math.min(options?.limit ?? 1000, 1000));
    const allResults: unknown[] = [];
    let cursor: { createdAt: string; id: string } | null = null;

    while (true) {
      const params = new URLSearchParams();
      params.set("limit", String(pageSize));
      if (cursor) {
        params.set("cursorCreatedAt", cursor.createdAt);
        params.set("cursorId", cursor.id);
      }

      const query = params.toString();
      const data = await fetchJSONUnknown(`/public/campgrounds${query ? `?${query}` : ""}`);
      const parsed = z
        .union([
          z.array(z.unknown()),
          z.object({
            results: z.array(z.unknown()),
            nextCursor: z
              .object({ createdAt: z.string(), id: z.string() })
              .nullable()
              .optional(),
          }),
        ])
        .parse(data);

      const pageResults = Array.isArray(parsed) ? parsed : parsed.results;
      allResults.push(...pageResults);

      if (maxResults !== null && allResults.length >= maxResults) {
        return PublicCampgroundListSchema.parse(allResults.slice(0, maxResults));
      }

      const nextCursor = Array.isArray(parsed) ? null : parsed.nextCursor ?? null;
      if (!nextCursor || pageResults.length < pageSize) {
        break;
      }

      cursor = nextCursor;
    }

    return PublicCampgroundListSchema.parse(allResults);
  },
  async searchPublicEvents(params?: {
    state?: string;
    eventType?: string;
    startDate?: string;
    endDate?: string;
    limit?: number;
    offset?: number;
  }) {
    const searchParams = new URLSearchParams();
    if (params?.state) searchParams.set("state", params.state);
    if (params?.eventType) searchParams.set("eventType", params.eventType);
    if (params?.startDate) searchParams.set("startDate", params.startDate);
    if (params?.endDate) searchParams.set("endDate", params.endDate);
    if (params?.limit) searchParams.set("limit", String(params.limit));
    if (params?.offset) searchParams.set("offset", String(params.offset));
    const query = searchParams.toString();
    const data = await fetchJSONUnknown(`/public/events${query ? `?${query}` : ""}`);
    // Response is { results, total }
    const response = z
      .object({
        results: z.array(z.unknown()),
        total: z.number(),
      })
      .parse(data);
    return {
      results: z
        .array(
          z.object({
            id: z.string(),
            title: z.string(),
            description: z.string().nullable(),
            eventType: z.string(),
            startDate: z.string(),
            endDate: z.string().nullable(),
            startTime: z.string().nullable(),
            endTime: z.string().nullable(),
            isAllDay: z.boolean(),
            imageUrl: z.string().nullable(),
            priceCents: z.number(),
            capacity: z.number().nullable(),
            currentSignups: z.number(),
            location: z.string().nullable(),
            campground: z.object({
              id: z.string(),
              slug: z.string().nullable(),
              name: z.string(),
              city: z.string().nullable(),
              state: z.string().nullable(),
              heroImageUrl: z.string().nullable(),
            }),
          }),
        )
        .parse(response.results),
      total: response.total,
    };
  },
  async getPublicCampground(slug: string, previewToken?: string) {
    const url = previewToken
      ? `/public/campgrounds/${slug}/preview?token=${encodeURIComponent(previewToken)}`
      : `/public/campgrounds/${slug}`;
    const data = await fetchJSONUnknown(url);
    try {
      return PublicCampgroundDetailSchema.parse(data);
    } catch (parseError) {
      console.error("Zod parse error for campground:", parseError);
      console.error("Raw data that failed parsing:", data);
      throw parseError;
    }
  },
  async abandonPublicCart(payload: {
    campgroundId: string;
    email?: string;
    phone?: string;
    abandonedAt?: string;
  }) {
    const res = await fetch(`${API_BASE}/public/reservations/abandon`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    return parseResponse(res, z.object({ ok: z.boolean() }));
  },
  async getPublicAvailability(
    slug: string,
    dates: {
      arrivalDate: string;
      departureDate: string;
      rigType?: string;
      rigLength?: string | number;
      needsAccessible?: boolean;
    },
    previewToken?: string,
  ) {
    const params = new URLSearchParams();
    params.set("arrivalDate", dates.arrivalDate);
    params.set("departureDate", dates.departureDate);
    if (dates.rigType) params.set("rigType", dates.rigType);
    if (dates.rigLength !== undefined && dates.rigLength !== null && `${dates.rigLength}` !== "") {
      params.set("rigLength", String(dates.rigLength));
    }
    if (dates.needsAccessible) params.set("needsAccessible", "true");
    if (previewToken) params.set("token", previewToken);
    const data = await fetchJSONUnknown(
      `/public/campgrounds/${slug}/availability?${params.toString()}`,
    );
    return z
      .array(
        z.object({
          id: z.string(),
          name: z.string(),
          siteNumber: z.string(),
          siteType: z.string(),
          maxOccupancy: numberish(z.number().int().nonnegative()),
          rigMaxLength: numberish(z.number().int().nonnegative().nullable()).optional(),
          accessible: z.boolean().optional().default(false),
          pullThrough: z.boolean().optional(),
          status: z.enum(["available", "booked", "locked", "maintenance"]),
          siteClass: z
            .object({
              id: z.string(),
              name: z.string(),
              defaultRate: numberish(z.number().int().nonnegative()),
              siteType: z.string(),
              maxOccupancy: numberish(z.number().int().nonnegative()),
              hookupsPower: z.boolean(),
              hookupsWater: z.boolean(),
              hookupsSewer: z.boolean(),
              petFriendly: z.boolean(),
              description: z.string().nullable(),
              accessible: z.boolean().optional().default(false),
              rvOrientation: z.string().nullish(),
              photoUrl: z.string().nullable().optional(),
            })
            .nullable(),
        }),
      )
      .parse(data);
  },

  /**
   * Natural Language Search for available sites
   * Accepts plain English queries like:
   * - "Pet-friendly RV site next weekend under $50/night"
   * - "Cabin for 4 adults July 4th weekend"
   * - "Waterfront tent site with hookups this Friday to Sunday"
   */
  async naturalLanguageSearch(slug: string, query: string, sessionId?: string) {
    const res = await fetch(`${API_BASE}/public/campgrounds/${slug}/search`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query, sessionId }),
    });
    const data = await parseResponse(res, UnknownSchema);

    const NLSearchResultSchema = z.object({
      site: z.object({
        id: z.string(),
        name: z.string(),
        siteNumber: z.string(),
        siteType: z.string(),
        maxOccupancy: numberish(z.number().int().nonnegative()),
        rigMaxLength: numberish(z.number().int().nonnegative().nullable()).optional(),
        accessible: z.boolean().optional().default(false),
        siteClass: z
          .object({
            id: z.string(),
            name: z.string(),
            defaultRate: numberish(z.number().int().nonnegative()),
            siteType: z.string(),
            maxOccupancy: numberish(z.number().int().nonnegative()),
            hookupsPower: z.boolean(),
            hookupsWater: z.boolean(),
            hookupsSewer: z.boolean(),
            petFriendly: z.boolean(),
            description: z.string().nullable(),
            accessible: z.boolean().optional().default(false),
          })
          .nullable(),
      }),
      matchScore: z.number(),
      matchReasons: z.array(z.string()),
      pricePerNight: numberish(z.number().int().nonnegative()).optional(),
    });

    return z
      .object({
        results: z.array(NLSearchResultSchema),
        intent: z.object({
          arrivalDate: z.string().optional(),
          departureDate: z.string().optional(),
          nights: z.number().optional(),
          flexible: z.boolean().optional(),
          siteType: z.enum(["rv", "tent", "cabin", "glamping", "lodging"]).nullable().optional(),
          rigType: z.string().optional(),
          rigLength: z.number().optional(),
          amenities: z.array(z.string()).optional(),
          petFriendly: z.boolean().optional(),
          waterfront: z.boolean().optional(),
          hookups: z
            .object({
              power: z.boolean().optional(),
              water: z.boolean().optional(),
              sewer: z.boolean().optional(),
            })
            .optional(),
          accessible: z.boolean().optional(),
          adults: z.number().optional(),
          children: z.number().optional(),
          pets: z.number().optional(),
          maxPricePerNight: z.number().optional(),
          minPricePerNight: z.number().optional(),
          quiet: z.boolean().optional(),
          nearAmenities: z.boolean().optional(),
          confidence: z.number(),
          clarificationNeeded: z.string().optional(),
          interpretedQuery: z.string().optional(),
        }),
        sessionId: z.string().optional(),
        searchDuration: z.number().optional(),
        aiEnabled: z.boolean(),
      })
      .parse(data);
  },

  async getPublicQuote(
    slug: string,
    payload: {
      siteId: string;
      arrivalDate: string;
      departureDate: string;
      promoCode?: string;
      membershipId?: string;
      taxWaiverSigned?: boolean;
      referralCode?: string;
      stayReasonPreset?: string;
      stayReasonOther?: string;
      referralSource?: string;
      referralChannel?: string;
      adults?: number;
      children?: number;
      petCount?: number;
      petTypes?: string[];
      previewToken?: string;
    },
  ) {
    const res = await fetch(`${API_BASE}/public/campgrounds/${slug}/quote`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await parseResponse(res, UnknownSchema);

    const PolicyRequirementSchema = z.object({
      id: z.string(),
      name: z.string(),
      description: z.string().nullable().optional(),
      content: z.string().optional().default(""),
      version: z.number().int().optional().default(1),
      siteId: z.string().nullable().optional(),
      siteClassId: z.string().nullable().optional(),
      documentType: z.string().optional(),
      config: z.record(z.unknown()).optional().default({}),
    });

    const QuoteResponseSchema = z.object({
      nights: numberish(z.number().int().nonnegative()),
      baseSubtotalCents: numberish(z.number()),
      rulesDeltaCents: numberish(z.number()),
      totalCents: numberish(z.number()),
      perNightCents: numberish(z.number()),
      discountCents: numberish(z.number()).optional().default(0),
      discountCapped: z.boolean().optional().default(false),
      totalAfterDiscountCents: numberish(z.number()).optional(),
      taxesCents: numberish(z.number()).optional().default(0),
      totalWithTaxesCents: numberish(z.number()).optional(),
      promotionId: z.string().nullable().optional(),
      appliedDiscounts: z
        .array(
          z.object({
            id: z.string(),
            type: z.string().optional(),
            amountCents: numberish(z.number()),
            capped: z.boolean().optional().default(false),
          }),
        )
        .optional()
        .default([]),
      rejectedDiscounts: z
        .array(
          z.object({
            id: z.string(),
            reason: z.string().optional(),
          }),
        )
        .optional()
        .default([]),
      taxWaiverRequired: z.boolean().optional().default(false),
      taxWaiverText: z.string().nullable().optional(),
      taxExemptionApplied: z.boolean().optional().default(false),
      referralDiscountCents: numberish(z.number()).optional().default(0),
      referralProgramId: z.string().nullable().optional(),
      referralIncentiveType: z.string().nullable().optional(),
      referralIncentiveValue: numberish(z.number()).nullable().optional().default(0),
      referralSource: z.string().nullable().optional(),
      referralChannel: z.string().nullable().optional(),
      policyRequirements: z.array(PolicyRequirementSchema).optional().default([]),
    });

    const parsed = QuoteResponseSchema.parse(data);
    const totalAfterDiscount =
      parsed.totalAfterDiscountCents ??
      Math.max(0, parsed.totalCents - (parsed.discountCents || 0));
    const taxes = parsed.taxesCents ?? 0;

    return {
      ...parsed,
      totalAfterDiscountCents: totalAfterDiscount,
      taxesCents: taxes,
      totalWithTaxesCents: parsed.totalWithTaxesCents ?? totalAfterDiscount + taxes,
    };
  },
  async createPublicReservation(payload: {
    campgroundSlug: string;
    siteId?: string;
    siteClassId?: string; // For booking by site class
    siteLocked?: boolean;
    arrivalDate: string;
    departureDate: string;
    adults: number;
    children?: number;
    guest: { firstName: string; lastName: string; email: string; phone: string; zipCode: string };
    additionalGuests?: { firstName?: string; lastName?: string; email?: string; phone?: string }[];
    childrenDetails?: { name?: string; gender?: string; age?: number }[];
    promoCode?: string;
    referralCode?: string;
    referralSource?: string;
    referralChannel?: string;
    stayReasonPreset?: string;
    stayReasonOther?: string;
    taxWaiverSigned?: boolean;
    equipment?: {
      type: string;
      length?: number;
      plateNumber?: string;
      plateState?: string;
    };
    needsAccessible?: boolean;
    petCount?: number;
    petTypes?: string[];
    policyAcceptances?: {
      templateId: string;
      accepted: boolean;
      signerName?: string;
      signerEmail?: string;
      metadata?: Record<string, unknown>;
    }[];
    holdId?: string;
    charityDonation?: {
      charityId: string;
      amountCents: number;
    };
  }) {
    const res = await fetch(`${API_BASE}/public/reservations`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await parseResponse(res, UnknownSchema);
    return ReservationWithGroupSchema.parse(data);
  },

  // Loyalty
  async getLoyaltyProfile(guestId: string) {
    const data = await fetchJSONUnknown(`/loyalty/guests/${guestId}`);
    return LoyaltyProfileSchema.parse(data);
  },
  async getLoyaltyProfilesBatch(
    guestIds: string[],
  ): Promise<{ guestId: string; tier: string; pointsBalance: number }[]> {
    const res = await fetch(`${API_BASE}/loyalty/batch`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...scopedHeaders() },
      body: JSON.stringify({ guestIds }),
    });
    return parseResponse(
      res,
      z.array(
        z.object({
          guestId: z.string(),
          tier: z.string(),
          pointsBalance: z.number(),
        }),
      ),
    );
  },
  async awardPoints(guestId: string, amount: number, reason: string) {
    const res = await fetch(`${API_BASE}/loyalty/guests/${guestId}/points`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...scopedHeaders() },
      body: JSON.stringify({ amount, reason }),
    });
    const data = await parseResponse(res, UnknownSchema);
    // The API returns the transaction result which includes the updated profile
    // But let's just return the profile schema if possible, or just true.
    // The service returns the transaction result. Let's look at the service again.
    // Service returns: prisma.$transaction result.
    // Actually the service returns the result of the last operation in transaction?
    // No, $transaction returns the result of the callback.
    // The callback returns `tx.loyaltyProfile.update`.
    // So it returns the updated profile.
    return LoyaltyProfileSchema.parse(data);
  },

  // Guest Wallet
  async getGuestWallet(campgroundId: string, guestId: string) {
    return fetchJSON(
      `/campgrounds/${campgroundId}/guests/${guestId}/wallet`,
      z.object({
        walletId: z.string(),
        guestId: z.string(),
        campgroundId: z.string(),
        scopeType: z.enum(["campground", "organization", "global"]),
        scopeId: z.string().nullable(),
        balanceCents: z.number(),
        availableCents: z.number(),
        currency: z.string(),
      }),
    );
  },

  async getGuestWalletsForCampground(campgroundId: string, guestId: string) {
    return fetchJSON(
      `/campgrounds/${campgroundId}/guests/${guestId}/wallets`,
      z.array(
        z.object({
          walletId: z.string(),
          guestId: z.string(),
          campgroundId: z.string(),
          scopeType: z.enum(["campground", "organization", "global"]),
          scopeId: z.string().nullable(),
          balanceCents: z.number(),
          availableCents: z.number(),
          currency: z.string(),
          campgroundName: z.string().optional(),
          campgroundSlug: z.string().optional(),
        }),
      ),
    );
  },

  async addWalletCredit(
    campgroundId: string,
    guestId: string,
    amountCents: number,
    reason?: string,
    scopeType?: "campground" | "organization" | "global",
    scopeId?: string,
  ) {
    const res = await fetch(
      `${API_BASE}/campgrounds/${campgroundId}/guests/${guestId}/wallet/credit`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", ...scopedHeaders() },
        body: JSON.stringify({ amountCents, reason, scopeType, scopeId }),
      },
    );
    return parseResponse(
      res,
      z.object({
        walletId: z.string(),
        balanceCents: z.number(),
        transactionId: z.string(),
      }),
    );
  },

  async getWalletTransactions(
    campgroundId: string,
    guestId: string,
    limit?: number,
    offset?: number,
    walletId?: string,
  ) {
    const params = new URLSearchParams();
    if (limit) params.set("limit", String(limit));
    if (offset) params.set("offset", String(offset));
    if (walletId) params.set("walletId", walletId);
    const query = params.toString() ? `?${params.toString()}` : "";
    return fetchJSON(
      `/campgrounds/${campgroundId}/guests/${guestId}/wallet/transactions${query}`,
      z.object({
        transactions: z.array(
          z.object({
            id: z.string(),
            direction: z.string(),
            amountCents: z.number(),
            beforeBalanceCents: z.number(),
            afterBalanceCents: z.number(),
            referenceType: z.string(),
            referenceId: z.string(),
            reason: z.string().nullable(),
            createdAt: z.string(),
          }),
        ),
        total: z.number(),
      }),
    );
  },

  async debitWallet(
    campgroundId: string,
    guestId: string,
    amountCents: number,
    referenceType: string,
    referenceId: string,
    walletId?: string,
    currency?: string,
  ) {
    const res = await fetch(`${API_BASE}/campgrounds/${campgroundId}/wallet/debit`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...scopedHeaders() },
      body: JSON.stringify({
        guestId,
        amountCents,
        referenceType,
        referenceId,
        walletId,
        currency,
      }),
    });
    return parseResponse(
      res,
      z.object({
        walletId: z.string(),
        balanceCents: z.number(),
        transactionId: z.string(),
      }),
    );
  },

  // Guest Portal - Wallet (uses guest token)
  async getPortalWallets(token: string) {
    const res = await fetch(`${API_BASE}/portal/wallet`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return parseResponse(
      res,
      z.array(
        z.object({
          walletId: z.string(),
          campgroundId: z.string(),
          scopeType: z.enum(["campground", "organization", "global"]),
          scopeId: z.string().nullable(),
          campgroundName: z.string(),
          balanceCents: z.number(),
          availableCents: z.number(),
          currency: z.string(),
        }),
      ),
    );
  },

  async getPortalWalletTransactions(
    token: string,
    campgroundId: string,
    limit?: number,
    offset?: number,
    walletId?: string,
  ) {
    const params = new URLSearchParams();
    if (limit) params.set("limit", String(limit));
    if (offset) params.set("offset", String(offset));
    if (walletId) params.set("walletId", walletId);
    const query = params.toString() ? `?${params.toString()}` : "";
    const res = await fetch(`${API_BASE}/portal/wallet/${campgroundId}/transactions${query}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return parseResponse(
      res,
      z.object({
        transactions: z.array(
          z.object({
            id: z.string(),
            direction: z.string(),
            amountCents: z.number(),
            beforeBalanceCents: z.number(),
            afterBalanceCents: z.number(),
            referenceType: z.string(),
            referenceId: z.string(),
            reason: z.string().nullable(),
            createdAt: z.string(),
          }),
        ),
        total: z.number(),
      }),
    );
  },

  // Store
  async getStoreCategories(campgroundId: string) {
    const data = await fetchJSONUnknown(`/campgrounds/${campgroundId}/store/categories`);
    return z.array(ProductCategorySchema).parse(data);
  },
  async createStoreCategory(
    campgroundId: string,
    payload: Omit<z.input<typeof CreateProductCategorySchema>, "campgroundId">,
  ) {
    const res = await fetch(`${API_BASE}/campgrounds/${campgroundId}/store/categories`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...scopedHeaders() },
      body: JSON.stringify(payload),
    });
    const data = await parseResponse(res, UnknownSchema);
    return ProductCategorySchema.parse(data);
  },
  async updateStoreCategory(
    id: string,
    payload: Partial<z.input<typeof CreateProductCategorySchema>>,
    campgroundId?: string,
  ) {
    const path = withCampgroundId(`/store/categories/${id}`, campgroundId);
    const res = await fetch(`${API_BASE}${path}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", ...scopedHeaders() },
      body: JSON.stringify(payload),
    });
    const data = await parseResponse(res, UnknownSchema);
    return ProductCategorySchema.parse(data);
  },
  async deleteStoreCategory(id: string, campgroundId?: string) {
    const path = withCampgroundId(`/store/categories/${id}`, campgroundId);
    const res = await fetch(`${API_BASE}${path}`, { method: "DELETE", headers: scopedHeaders() });
    if (!res.ok) throw new Error("Failed to delete category");
    return true;
  },

  async getStoreProducts(campgroundId: string) {
    const data = await fetchJSONUnknown(`/campgrounds/${campgroundId}/store/products`);
    return z.array(ProductSchema).parse(data);
  },
  async createStoreProduct(
    campgroundId: string,
    payload: Omit<z.input<typeof CreateProductSchema>, "campgroundId">,
  ) {
    const res = await fetch(`${API_BASE}/campgrounds/${campgroundId}/store/products`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...scopedHeaders() },
      body: JSON.stringify(payload),
    });
    const data = await parseResponse(res, UnknownSchema);
    return ProductSchema.parse(data);
  },
  async updateStoreProduct(
    id: string,
    payload: Partial<z.input<typeof CreateProductSchema>>,
    campgroundId?: string,
  ) {
    const path = withCampgroundId(`/store/products/${id}`, campgroundId);
    const res = await fetch(`${API_BASE}${path}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", ...scopedHeaders() },
      body: JSON.stringify(payload),
    });
    const data = await parseResponse(res, UnknownSchema);
    return ProductSchema.parse(data);
  },
  async updateStoreStock(
    campgroundId: string,
    id: string,
    payload: {
      stockQty?: number;
      delta?: number;
      channel?: "pos" | "online" | "portal" | "kiosk" | "internal";
    },
  ) {
    const res = await fetch(`${API_BASE}/campgrounds/${campgroundId}/store/products/${id}/stock`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", ...scopedHeaders() },
      body: JSON.stringify(payload),
    });
    const data = await parseResponse(res, UnknownSchema);
    return ProductSchema.parse(data);
  },
  async deleteStoreProduct(id: string, campgroundId?: string) {
    const path = withCampgroundId(`/store/products/${id}`, campgroundId);
    const res = await fetch(`${API_BASE}${path}`, { method: "DELETE", headers: scopedHeaders() });
    if (!res.ok) throw new Error("Failed to delete product");
    return true;
  },

  async getStoreAddOns(campgroundId: string) {
    const data = await fetchJSONUnknown(`/campgrounds/${campgroundId}/store/addons`);
    return z.array(AddOnSchema).parse(data);
  },
  async createStoreAddOn(
    campgroundId: string,
    payload: Omit<z.input<typeof CreateAddOnSchema>, "campgroundId">,
  ) {
    const res = await fetch(`${API_BASE}/campgrounds/${campgroundId}/store/addons`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...scopedHeaders() },
      body: JSON.stringify(payload),
    });
    const data = await parseResponse(res, UnknownSchema);
    return AddOnSchema.parse(data);
  },
  async updateStoreAddOn(
    id: string,
    payload: Partial<z.input<typeof CreateAddOnSchema>>,
    campgroundId?: string,
  ) {
    const path = withCampgroundId(`/store/addons/${id}`, campgroundId);
    const res = await fetch(`${API_BASE}${path}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", ...scopedHeaders() },
      body: JSON.stringify(payload),
    });
    const data = await parseResponse(res, UnknownSchema);
    return AddOnSchema.parse(data);
  },
  async deleteStoreAddOn(id: string, campgroundId?: string) {
    const path = withCampgroundId(`/store/addons/${id}`, campgroundId);
    const res = await fetch(`${API_BASE}${path}`, { method: "DELETE", headers: scopedHeaders() });
    if (!res.ok) throw new Error("Failed to delete add-on");
    return true;
  },

  // Store Locations (Multi-location POS)
  async getStoreLocations(campgroundId: string, includeInactive = false) {
    const params = includeInactive ? "?includeInactive=true" : "";
    const data = await fetchJSONUnknown(`/campgrounds/${campgroundId}/store/locations${params}`);
    return z.array(StoreLocationSchema).parse(data);
  },
  async getStoreLocation(id: string, campgroundId?: string) {
    const path = withCampgroundId(`/store/locations/${id}`, campgroundId);
    const data = await fetchJSONUnknown(path);
    return StoreLocationSchema.parse(data);
  },
  async getDefaultStoreLocation(campgroundId: string) {
    const data = await fetchJSONUnknown(`/campgrounds/${campgroundId}/store/locations/default`);
    return StoreLocationSchema.nullable().parse(data);
  },
  async createStoreLocation(
    campgroundId: string,
    payload: z.input<typeof CreateStoreLocationSchema>,
  ) {
    const res = await fetch(`${API_BASE}/campgrounds/${campgroundId}/store/locations`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...scopedHeaders() },
      body: JSON.stringify(payload),
    });
    const data = await parseResponse(res, UnknownSchema);
    return StoreLocationSchema.parse(data);
  },
  async updateStoreLocation(
    id: string,
    payload: Partial<z.input<typeof CreateStoreLocationSchema>>,
    campgroundId?: string,
  ) {
    const path = withCampgroundId(`/store/locations/${id}`, campgroundId);
    const res = await fetch(`${API_BASE}${path}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", ...scopedHeaders() },
      body: JSON.stringify(payload),
    });
    const data = await parseResponse(res, UnknownSchema);
    return StoreLocationSchema.parse(data);
  },
  async deleteStoreLocation(id: string, campgroundId?: string) {
    const path = withCampgroundId(`/store/locations/${id}`, campgroundId);
    const res = await fetch(`${API_BASE}${path}`, { method: "DELETE", headers: scopedHeaders() });
    if (!res.ok) {
      const error = await res.json().catch(() => ({}));
      throw new Error(error.message || "Failed to delete location");
    }
    return true;
  },
  async ensureDefaultStoreLocation(campgroundId: string) {
    const res = await fetch(
      `${API_BASE}/campgrounds/${campgroundId}/store/locations/ensure-default`,
      {
        method: "POST",
        headers: scopedHeaders(),
      },
    );
    const data = await parseResponse(res, z.string());
    return data;
  },

  // Location Inventory
  async getLocationInventory(locationId: string, productId?: string, campgroundId?: string) {
    const searchParams = new URLSearchParams();
    if (productId) searchParams.set("productId", productId);
    const qs = searchParams.toString();
    const path = withCampgroundId(
      `/store/locations/${locationId}/inventory${qs ? `?${qs}` : ""}`,
      campgroundId,
    );
    const data = await fetchJSONUnknown(path);
    return z.array(LocationInventorySchema).parse(data);
  },
  async updateLocationInventory(
    locationId: string,
    productId: string,
    payload: { stockQty?: number; adjustment?: number; lowStockAlert?: number; notes?: string },
    campgroundId?: string,
  ) {
    const path = withCampgroundId(
      `/store/locations/${locationId}/inventory/${productId}`,
      campgroundId,
    );
    const res = await fetch(`${API_BASE}${path}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", ...scopedHeaders() },
      body: JSON.stringify(payload),
    });
    const data = await parseResponse(res, UnknownSchema);
    return LocationInventorySchema.parse(data);
  },

  // Location Price Overrides
  async getLocationPriceOverrides(locationId: string, campgroundId?: string) {
    const path = withCampgroundId(`/store/locations/${locationId}/prices`, campgroundId);
    const data = await fetchJSONUnknown(path);
    return z.array(LocationPriceOverrideSchema).parse(data);
  },
  async createLocationPriceOverride(
    locationId: string,
    payload: { productId: string; priceCents: number; reason?: string },
    campgroundId?: string,
  ) {
    const path = withCampgroundId(`/store/locations/${locationId}/prices`, campgroundId);
    const res = await fetch(`${API_BASE}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...scopedHeaders() },
      body: JSON.stringify(payload),
    });
    const data = await parseResponse(res, UnknownSchema);
    return LocationPriceOverrideSchema.parse(data);
  },
  async deleteLocationPriceOverride(locationId: string, productId: string, campgroundId?: string) {
    const path = withCampgroundId(
      `/store/locations/${locationId}/prices/${productId}`,
      campgroundId,
    );
    const res = await fetch(`${API_BASE}${path}`, {
      method: "DELETE",
      headers: scopedHeaders(),
    });
    if (!res.ok) throw new Error("Failed to delete price override");
    return true;
  },

  // Inventory Movements (Audit Log)
  async getInventoryMovements(
    campgroundId: string,
    params?: {
      productId?: string;
      locationId?: string;
      movementType?: string;
      startDate?: string;
      endDate?: string;
      limit?: number;
    },
  ) {
    const searchParams = new URLSearchParams();
    if (params?.productId) searchParams.set("productId", params.productId);
    if (params?.locationId) searchParams.set("locationId", params.locationId);
    if (params?.movementType) searchParams.set("movementType", params.movementType);
    if (params?.startDate) searchParams.set("startDate", params.startDate);
    if (params?.endDate) searchParams.set("endDate", params.endDate);
    if (params?.limit) searchParams.set("limit", String(params.limit));
    const qs = searchParams.toString();
    const data = await fetchJSONUnknown(
      `/campgrounds/${campgroundId}/store/inventory/movements${qs ? `?${qs}` : ""}`,
    );
    return z.array(InventoryMovementSchema).parse(data);
  },

  // Inventory Transfers
  async getInventoryTransfers(
    campgroundId: string,
    params?: {
      status?: string;
      fromLocationId?: string;
      toLocationId?: string;
    },
  ) {
    const searchParams = new URLSearchParams();
    if (params?.status) searchParams.set("status", params.status);
    if (params?.fromLocationId) searchParams.set("fromLocationId", params.fromLocationId);
    if (params?.toLocationId) searchParams.set("toLocationId", params.toLocationId);
    const qs = searchParams.toString();
    const data = await fetchJSONUnknown(
      `/campgrounds/${campgroundId}/store/transfers${qs ? `?${qs}` : ""}`,
    );
    return z.array(InventoryTransferSchema).parse(data);
  },
  async getInventoryTransfer(id: string, campgroundId?: string) {
    const path = withCampgroundId(`/store/transfers/${id}`, campgroundId);
    const data = await fetchJSONUnknown(path);
    return InventoryTransferSchema.parse(data);
  },
  async createInventoryTransfer(
    campgroundId: string,
    payload: z.input<typeof CreateInventoryTransferSchema>,
  ) {
    const res = await fetch(`${API_BASE}/campgrounds/${campgroundId}/store/transfers`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...scopedHeaders() },
      body: JSON.stringify(payload),
    });
    const data = await parseResponse(res, UnknownSchema);
    return InventoryTransferSchema.parse(data);
  },
  async approveInventoryTransfer(id: string, campgroundId?: string) {
    const path = withCampgroundId(`/store/transfers/${id}/approve`, campgroundId);
    const res = await fetch(`${API_BASE}${path}`, {
      method: "PATCH",
      headers: scopedHeaders(),
    });
    const data = await parseResponse(res, UnknownSchema);
    return InventoryTransferSchema.parse(data);
  },
  async completeInventoryTransfer(id: string, campgroundId?: string) {
    const path = withCampgroundId(`/store/transfers/${id}/complete`, campgroundId);
    const res = await fetch(`${API_BASE}${path}`, {
      method: "PATCH",
      headers: scopedHeaders(),
    });
    const data = await parseResponse(res, UnknownSchema);
    return InventoryTransferSchema.parse(data);
  },
  async cancelInventoryTransfer(id: string, campgroundId?: string) {
    const path = withCampgroundId(`/store/transfers/${id}/cancel`, campgroundId);
    const res = await fetch(`${API_BASE}${path}`, {
      method: "PATCH",
      headers: scopedHeaders(),
    });
    const data = await parseResponse(res, UnknownSchema);
    return InventoryTransferSchema.parse(data);
  },

  // POS Location Integration
  async getProductsForLocation(campgroundId: string, locationId?: string) {
    const params = locationId ? `?locationId=${locationId}` : "";
    const data = await fetchJSONUnknown(
      `/campgrounds/${campgroundId}/store/products-for-location${params}`,
    );
    return z
      .array(
        ProductSchema.extend({
          effectivePriceCents: z.number(),
          effectiveStock: z.number().nullable(),
        }),
      )
      .parse(data);
  },

  // Fulfillment Queue
  async getFulfillmentQueue(
    campgroundId: string,
    params?: {
      status?: string;
      locationId?: string;
      limit?: number;
    },
  ) {
    const searchParams = new URLSearchParams();
    if (params?.status) searchParams.set("status", params.status);
    if (params?.locationId) searchParams.set("locationId", params.locationId);
    if (params?.limit) searchParams.set("limit", String(params.limit));
    const qs = searchParams.toString();
    const data = await fetchJSONUnknown(
      `/campgrounds/${campgroundId}/store/orders/fulfillment-queue${qs ? `?${qs}` : ""}`,
    );
    return z
      .array(
        StoreOrderSchema.extend({
          fulfillmentLocation: StoreLocationSchema.pick({ id: true, name: true, code: true })
            .nullable()
            .optional(),
          assignedBy: z
            .object({ id: z.string(), name: z.string().nullable(), email: z.string() })
            .nullable()
            .optional(),
          guest: z
            .object({
              id: z.string(),
              firstName: z.string().nullable(),
              lastName: z.string().nullable(),
              phone: z.string().nullable(),
            })
            .nullable()
            .optional(),
        }),
      )
      .parse(data);
  },
  async getFulfillmentCounts(campgroundId: string) {
    const data = await fetchJSONUnknown(
      `/campgrounds/${campgroundId}/store/orders/fulfillment-counts`,
    );
    return z.record(z.string(), z.number()).parse(data);
  },
  async assignOrderToLocation(orderId: string, locationId: string, campgroundId?: string) {
    const path = withCampgroundId(`/store/orders/${orderId}/assign-location`, campgroundId);
    const res = await fetch(`${API_BASE}${path}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", ...scopedHeaders() },
      body: JSON.stringify({ locationId }),
    });
    const data = await parseResponse(res, UnknownSchema);
    return StoreOrderSchema.parse(data);
  },
  async updateFulfillmentStatus(orderId: string, status: string, campgroundId?: string) {
    const path = withCampgroundId(`/store/orders/${orderId}/fulfillment-status`, campgroundId);
    const res = await fetch(`${API_BASE}${path}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", ...scopedHeaders() },
      body: JSON.stringify({ status }),
    });
    const data = await parseResponse(res, UnknownSchema);
    return StoreOrderSchema.parse(data);
  },
  async getLocationFulfillmentOrders(
    locationId: string,
    includeCompleted = false,
    campgroundId?: string,
  ) {
    const params = includeCompleted ? "?includeCompleted=true" : "";
    const path = withCampgroundId(
      `/store/locations/${locationId}/fulfillment-orders${params}`,
      campgroundId,
    );
    const data = await fetchJSONUnknown(path);
    return z.array(StoreOrderSchema).parse(data);
  },
  async bulkAssignOrders(campgroundId: string, orderIds: string[], locationId: string) {
    const res = await fetch(`${API_BASE}/campgrounds/${campgroundId}/store/orders/bulk-assign`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...scopedHeaders() },
      body: JSON.stringify({ orderIds, locationId }),
    });
    const data = await parseResponse(res, UnknownSchema);
    return z.object({ assignedCount: z.number() }).parse(data);
  },

  // Blackout Dates
  async getBlackouts(campgroundId: string) {
    const data = await fetchJSONUnknown(`/blackouts/campgrounds/${campgroundId}`);
    return z.array(BlackoutDateSchema).parse(data);
  },
  async createBlackout(payload: z.input<typeof CreateBlackoutDateSchema>) {
    const res = await fetch(`${API_BASE}/blackouts`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...scopedHeaders() },
      body: JSON.stringify(payload),
    });
    const data = await parseResponse(res, UnknownSchema);
    return BlackoutDateSchema.parse(data);
  },
  async updateBlackout(
    id: string,
    payload: Partial<z.input<typeof CreateBlackoutDateSchema>>,
    campgroundId?: string,
  ) {
    const path = withCampgroundId(`/blackouts/${id}`, campgroundId);
    const res = await fetch(`${API_BASE}${path}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", ...scopedHeaders() },
      body: JSON.stringify(payload),
    });
    const data = await parseResponse(res, UnknownSchema);
    return BlackoutDateSchema.parse(data);
  },
  async deleteBlackout(id: string, campgroundId?: string) {
    const path = withCampgroundId(`/blackouts/${id}`, campgroundId);
    const res = await fetch(`${API_BASE}${path}`, { method: "DELETE", headers: scopedHeaders() });
    if (!res.ok) throw new Error("Failed to delete blackout date");
    return true;
  },

  // Promotions
  async getPromotions(campgroundId: string) {
    const data = await fetchJSONUnknown(`/promotions/campgrounds/${campgroundId}`);
    return z
      .array(
        z.object({
          id: z.string(),
          campgroundId: z.string(),
          code: z.string(),
          type: z.enum(["percentage", "flat"]),
          value: z.number(),
          validFrom: z.string().nullable(),
          validTo: z.string().nullable(),
          usageLimit: z.number().nullable(),
          usageCount: z.number(),
          isActive: z.boolean(),
          description: z.string().nullable(),
          createdAt: z.string(),
          updatedAt: z.string(),
        }),
      )
      .parse(data);
  },
  async createPromotion(payload: {
    campgroundId: string;
    code: string;
    type?: "percentage" | "flat";
    value: number;
    validFrom?: string;
    validTo?: string;
    usageLimit?: number;
    isActive?: boolean;
    description?: string;
  }) {
    const res = await fetch(`${API_BASE}/promotions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...scopedHeaders() },
      body: JSON.stringify(payload),
    });
    return parseResponse(res, IdSchema);
  },
  async updatePromotion(
    id: string,
    payload: {
      code?: string;
      type?: "percentage" | "flat";
      value?: number;
      validFrom?: string | null;
      validTo?: string | null;
      usageLimit?: number | null;
      isActive?: boolean;
      description?: string | null;
    },
    campgroundId?: string,
  ) {
    const path = withCampgroundId(`/promotions/${id}`, campgroundId);
    const res = await fetch(`${API_BASE}${path}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", ...scopedHeaders() },
      body: JSON.stringify(payload),
    });
    return parseResponse(res, IdSchema);
  },
  async deletePromotion(id: string, campgroundId?: string) {
    const path = withCampgroundId(`/promotions/${id}`, campgroundId);
    const res = await fetch(`${API_BASE}${path}`, { method: "DELETE", headers: scopedHeaders() });
    if (!res.ok) throw new Error("Failed to delete promotion");
    return true;
  },
  async validatePromoCode(campgroundId: string, code: string, subtotal: number) {
    const res = await fetch(`${API_BASE}/promotions/validate`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...scopedHeaders() },
      body: JSON.stringify({ campgroundId, code, subtotal }),
    });
    const data = await parseResponse(res, UnknownSchema);
    return z
      .object({
        valid: z.boolean(),
        discountCents: z.number(),
        promotionId: z.string(),
        code: z.string(),
        type: z.string(),
        value: z.number(),
      })
      .parse(data);
  },

  // Campground photos
  async updateCampgroundPhotos(
    campgroundId: string,
    payload: { photos: string[]; heroImageUrl?: string | null },
  ) {
    const res = await fetch(`${API_BASE}/campgrounds/${campgroundId}/photos`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", ...scopedHeaders() },
      body: JSON.stringify(payload),
    });
    return parseResponse(res, UnknownSchema);
  },

  // Campground FAQs
  async updateCampgroundFaqs(
    campgroundId: string,
    faqs: Array<{ id: string; question: string; answer: string; order: number }>,
  ) {
    const res = await fetch(`${API_BASE}/campgrounds/${campgroundId}/faqs`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", ...scopedHeaders() },
      body: JSON.stringify({ faqs }),
    });
    return parseResponse(res, UnknownSchema);
  },

  // Form templates
  async getFormTemplates(campgroundId: string) {
    const data = await fetchJSONUnknown(`/campgrounds/${campgroundId}/forms`);
    return FormTemplateArray.parse(data);
  },
  async createFormTemplate(payload: {
    campgroundId: string;
    title: string;
    type: "waiver" | "vehicle" | "intake" | "custom";
    description?: string;
    fields?: Record<string, unknown>;
    isActive?: boolean;
    autoAttachMode?: "manual" | "all_bookings" | "site_classes";
    siteClassIds?: string[];
    showAt?: string[];
    isRequired?: boolean;
    allowSkipWithNote?: boolean;
    validityDays?: number | null;
    sendReminder?: boolean;
    reminderDaysBefore?: number | null;
    displayConditions?: Array<{
      field: string;
      operator: string;
      value: string | number | string[];
    }>;
    conditionLogic?: "all" | "any";
  }) {
    const res = await fetch(`${API_BASE}/forms`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...scopedHeaders() },
      body: JSON.stringify(payload),
    });
    const data = await parseResponse(res, UnknownSchema);
    return FormTemplateSchema.parse(data);
  },
  async updateFormTemplate(
    id: string,
    payload: Partial<{
      title: string;
      type: "waiver" | "vehicle" | "intake" | "custom";
      description?: string | null;
      fields?: Record<string, unknown> | null;
      isActive?: boolean;
      autoAttachMode?: "manual" | "all_bookings" | "site_classes";
      siteClassIds?: string[];
      showAt?: string[];
      isRequired?: boolean;
      allowSkipWithNote?: boolean;
      validityDays?: number | null;
      sendReminder?: boolean;
      reminderDaysBefore?: number | null;
      displayConditions?: Array<{
        field: string;
        operator: string;
        value: string | number | string[];
      }>;
      conditionLogic?: "all" | "any";
    }>,
  ) {
    const res = await fetch(`${API_BASE}/forms/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", ...scopedHeaders() },
      body: JSON.stringify(payload),
    });
    const data = await parseResponse(res, UnknownSchema);
    return FormTemplateSchema.parse(data);
  },
  async deleteFormTemplate(id: string) {
    const res = await fetch(`${API_BASE}/forms/${id}`, {
      method: "DELETE",
      headers: scopedHeaders(),
    });
    if (!res.ok) throw new Error("Failed to delete form");
    return true;
  },
  async getFormSubmissionsByReservation(reservationId: string) {
    const data = await fetchJSONUnknown(`/reservations/${reservationId}/forms`);
    return FormSubmissionArray.parse(data);
  },
  async getFormSubmissionsByGuest(guestId: string) {
    const data = await fetchJSONUnknown(`/guests/${guestId}/forms`);
    return FormSubmissionArray.parse(data);
  },
  async createFormSubmission(payload: {
    formTemplateId: string;
    reservationId?: string;
    guestId?: string;
    responses?: Record<string, unknown>;
  }) {
    const res = await fetch(`${API_BASE}/forms/submissions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...scopedHeaders() },
      body: JSON.stringify(payload),
    });
    const data = await parseResponse(res, UnknownSchema);
    return FormSubmissionSchema.parse(data);
  },
  async updateFormSubmission(
    id: string,
    payload: Partial<{
      status: "pending" | "completed" | "void";
      responses: Record<string, unknown>;
    }>,
  ) {
    const res = await fetch(`${API_BASE}/forms/submissions/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", ...scopedHeaders() },
      body: JSON.stringify(payload),
    });
    const data = await parseResponse(res, UnknownSchema);
    return FormSubmissionSchema.parse(data);
  },
  async deleteFormSubmission(id: string) {
    const res = await fetch(`${API_BASE}/forms/submissions/${id}`, {
      method: "DELETE",
      headers: scopedHeaders(),
    });
    if (!res.ok) throw new Error("Failed to delete form submission");
    return true;
  },

  // Guest Portal Auth
  async sendMagicLink(email: string) {
    const res = await fetch(`${API_BASE}/guest-auth/magic-link`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    if (!res.ok) throw new Error("Failed to send magic link");
    return true;
  },
  async verifyGuestToken(token: string) {
    const res = await fetch(`${API_BASE}/guest-auth/verify`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
      credentials: "include", // SECURITY: Receive httpOnly cookie from API
    });
    const data = await parseResponse(res, UnknownSchema);
    return z
      .object({
        token: z.string(),
        guest: z.object({
          id: z.string(),
          firstName: z.string(),
          lastName: z.string(),
          email: z.string(),
        }),
      })
      .parse(data);
  },
  async getGuestMe(token?: string) {
    // SECURITY: Prefer httpOnly cookie over localStorage token
    const res = await fetch(`${API_BASE}/guest-auth/me`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      credentials: "include", // Send httpOnly cookie if set
    });
    const data = await parseResponse(res, UnknownSchema);
    // We can refine this schema later, for now just return raw data or basic guest schema
    return GuestSchema.extend({
      reservations: z.array(
        ReservationSchema.extend({
          campground: z.object({
            name: z.string(),
            slug: z.string(),
            heroImageUrl: z.string().nullable(),
            amenities: z.array(z.string()),
            checkInTime: z.string().nullable(),
            checkOutTime: z.string().nullable(),
          }),
          site: SiteSchema,
        }),
      ),
    }).parse(data);
  },

  // Messages API
  async getReservationMessages(reservationId: string) {
    const data = await fetchJSONUnknown(`/reservations/${reservationId}/messages`);
    return z
      .array(
        z.object({
          id: z.string(),
          campgroundId: z.string(),
          reservationId: z.string(),
          guestId: z.string(),
          senderType: z.enum(["guest", "staff"]),
          content: z.string(),
          readAt: z.string().nullable(),
          createdAt: z.string(),
          guest: z.object({
            id: z.string(),
            primaryFirstName: z.string(),
            primaryLastName: z.string(),
          }),
        }),
      )
      .parse(data);
  },
  async sendReservationMessage(
    reservationId: string,
    content: string,
    senderType: "guest" | "staff",
    guestId: string,
  ) {
    const res = await fetch(`${API_BASE}/reservations/${reservationId}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...scopedHeaders() },
      body: JSON.stringify({ content, senderType, guestId }),
    });
    return parseResponse(res, IdSchema);
  },
  async markMessagesAsRead(reservationId: string, senderType: "guest" | "staff") {
    const res = await fetch(`${API_BASE}/reservations/${reservationId}/messages/read`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", ...scopedHeaders() },
      body: JSON.stringify({ senderType }),
    });
    return parseResponse(res, CountSchema);
  },
  async getUnreadMessageCount(campgroundId: string) {
    const data = await fetchJSONUnknown(`/campgrounds/${campgroundId}/messages/unread-count`);
    return z.object({ unreadCount: z.number() }).parse(data);
  },
  async getConversations(campgroundId: string) {
    const data = await fetchJSONUnknown(`/campgrounds/${campgroundId}/conversations`);
    const messageSchema = z.object({
      id: z.string(),
      campgroundId: z.string(),
      reservationId: z.string(),
      guestId: z.string().nullable(),
      senderType: z.enum(["guest", "staff"]),
      content: z.string(),
      readAt: z.string().nullable(),
      createdAt: z.string(),
      guest: z
        .object({
          id: z.string(),
          primaryFirstName: z.string().nullable(),
          primaryLastName: z.string().nullable(),
        })
        .nullable(),
    });
    return z
      .array(
        z.object({
          reservationId: z.string(),
          guestName: z.string(),
          guestEmail: z.string().nullable().optional(),
          guestPhone: z.string().nullable().optional(),
          guestId: z.string().nullable().optional(),
          siteName: z.string(),
          siteType: z.string().nullable().optional(),
          status: z.string(),
          arrivalDate: z.string().nullable().optional(),
          departureDate: z.string().nullable().optional(),
          adults: z.number().nullable().optional(),
          children: z.number().nullable().optional(),
          pets: z.number().nullable().optional(),
          totalAmountCents: z.number().nullable().optional(),
          notes: z.string().nullable().optional(),
          unreadCount: z.number(),
          messages: z.array(messageSchema),
          lastMessage: messageSchema.nullable(),
        }),
      )
      .parse(data);
  },

  // Internal Conversations
  async getInternalConversations(campgroundId: string) {
    const data = await fetchJSONUnknown(`/internal-conversations?campgroundId=${campgroundId}`);
    return z
      .array(
        z.object({
          id: z.string(),
          name: z.string().nullable(),
          type: z.enum(["channel", "dm"]),
          participants: z.array(
            z.object({
              user: z.object({
                id: z.string(),
                firstName: z.string(),
                lastName: z.string(),
                email: z.string(),
              }),
            }),
          ),
          messages: z
            .array(
              z.object({
                content: z.string(),
                createdAt: z.string(),
                senderId: z.string(),
              }),
            )
            .optional(),
        }),
      )
      .parse(data);
  },

  async createInternalConversation(
    campgroundId: string,
    payload: { name?: string; type: "channel" | "dm"; participantIds: string[] },
  ) {
    const res = await fetch(`${API_BASE}/internal-conversations`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...scopedHeaders() },
      body: JSON.stringify({ ...payload, campgroundId }),
    });
    return parseResponse(res, UnknownSchema);
  },

  // Internal Messages (Staff-to-Staff)
  async getInternalMessages(conversationId: string) {
    const data = await fetchJSONUnknown(`/internal-messages?conversationId=${conversationId}`);
    return z
      .array(
        z.object({
          id: z.string(),
          content: z.string(),
          createdAt: z.string(),
          senderId: z.string(),
          sender: z.object({
            id: z.string(),
            firstName: z.string(),
            lastName: z.string(),
            email: z.string(),
          }),
        }),
      )
      .parse(data);
  },
  async sendInternalMessage(conversationId: string, content: string) {
    const res = await fetch(`${API_BASE}/internal-messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...scopedHeaders() },
      body: JSON.stringify({ content, conversationId }),
    });
    return parseResponse(
      res,
      z.object({
        id: z.string(),
        content: z.string(),
        createdAt: z.string(),
        sender: z.object({
          id: z.string(),
          firstName: z.string(),
          lastName: z.string(),
          email: z.string(),
        }),
      }),
    );
  },

  // Waitlist
  async joinWaitlist(payload: z.input<typeof CreateWaitlistEntrySchema>) {
    const res = await fetch(`${API_BASE}/waitlist`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...scopedHeaders() },
      body: JSON.stringify(payload),
    });
    const data = await parseResponse(res, UnknownSchema);
    return WaitlistEntrySchema.parse(data);
  },
  async getWaitlist(campgroundId: string, type?: string) {
    const url =
      type && type !== "all"
        ? `/waitlist?campgroundId=${campgroundId}&type=${type}`
        : `/waitlist?campgroundId=${campgroundId}`;
    const data = await fetchJSONUnknown(url);
    return z.array(WaitlistEntrySchema).parse(data);
  },
  async deleteWaitlistEntry(id: string) {
    const res = await fetch(`${API_BASE}/waitlist/${id}`, {
      method: "DELETE",
      headers: scopedHeaders(),
    });
    if (!res.ok) throw new Error("Failed to delete waitlist entry");
    return true;
  },
  async createStaffWaitlistEntry(payload: {
    campgroundId: string;
    type: "regular" | "seasonal";
    contactName: string;
    contactEmail?: string;
    contactPhone?: string;
    notes?: string;
    siteId?: string;
    arrivalDate?: string;
    departureDate?: string;
  }) {
    const res = await fetch(`${API_BASE}/waitlist/staff`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...scopedHeaders() },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error("Failed to add to waitlist");
    return WaitlistEntrySchema.parse(await res.json());
  },

  async createPublicWaitlistEntry(payload: z.input<typeof CreatePublicWaitlistSchema>) {
    const res = await fetch(`${API_BASE}/public/waitlist`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error("Failed to join waitlist");
    return WaitlistEntrySchema.parse(await res.json());
  },

  // Portal messages (guest-jwt protected)
  async getPortalMessages(reservationId: string, token: string) {
    const res = await fetch(`${API_BASE}/portal/reservations/${reservationId}/messages`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await parseResponse(res, UnknownSchema);
    return z
      .array(
        z.object({
          id: z.string(),
          campgroundId: z.string(),
          reservationId: z.string(),
          guestId: z.string(),
          senderType: z.enum(["guest", "staff"]),
          content: z.string(),
          readAt: z.string().nullable(),
          createdAt: z.string(),
          guest: z.object({
            id: z.string(),
            primaryFirstName: z.string(),
            primaryLastName: z.string(),
          }),
        }),
      )
      .parse(data);
  },
  async sendPortalMessage(reservationId: string, content: string, token: string) {
    const res = await fetch(`${API_BASE}/portal/reservations/${reservationId}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ content }),
    });
    return parseResponse(res, IdSchema);
  },

  // Portal Self-Service
  async getPortalGuest(token: string) {
    const res = await fetch(`${API_BASE}/portal/me`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await parseResponse(res, UnknownSchema);
    return z
      .object({
        id: z.string(),
        primaryFirstName: z.string(),
        primaryLastName: z.string(),
        email: z.string(),
        reservations: z.array(
          z.object({
            id: z.string(),
            arrivalDate: z.string(),
            departureDate: z.string(),
            status: z.string(),
            adults: z.number(),
            children: z.number(),
            totalCents: z.number().default(0),
            paidCents: z.number().default(0),
            campground: z.object({
              name: z.string(),
              slug: z.string(),
              heroImageUrl: z.string().nullable().optional(),
              amenities: z.array(z.string()).default([]),
              checkInTime: z.string().nullable().optional(),
              checkOutTime: z.string().nullable().optional(),
            }),
            site: z.object({
              name: z.string().optional(),
              siteNumber: z.string(),
              siteType: z.string().optional(),
            }),
          }),
        ),
      })
      .parse(data);
  },
  async requestPortalDateChange(
    token: string,
    reservationId: string,
    payload: { newArrival: string; newDeparture: string },
  ) {
    const res = await fetch(`${API_BASE}/portal/reservations/${reservationId}/modify-dates`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error("Failed to request date change");
    return parseResponse(res, SuccessSchema);
  },
  async requestPortalSiteChange(
    token: string,
    reservationId: string,
    payload: { reason?: string },
  ) {
    const res = await fetch(`${API_BASE}/portal/reservations/${reservationId}/change-site`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error("Failed to request site change");
    return parseResponse(res, SuccessSchema);
  },
  async updatePortalGuestCount(
    token: string,
    reservationId: string,
    payload: { adults: number; children: number },
  ) {
    const res = await fetch(`${API_BASE}/portal/reservations/${reservationId}/guest-count`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error("Failed to update guest count");
    return parseResponse(res, SuccessSchema);
  },
  async requestPortalCancellation(
    token: string,
    reservationId: string,
    payload: { reason?: string },
  ) {
    const res = await fetch(`${API_BASE}/portal/reservations/${reservationId}/cancel`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error("Failed to cancel reservation");
    return parseResponse(res, SuccessSchema);
  },

  // Tax Rules
  async getTaxRules(campgroundId: string) {
    const data = await fetchJSONUnknown(`/tax-rules/campground/${campgroundId}`);
    return z
      .array(
        z.object({
          id: z.string(),
          campgroundId: z.string(),
          name: z.string(),
          type: z.enum(["percentage", "flat", "exemption"]),
          rate: z.number().nullable(),
          minNights: z.number().nullable(),
          maxNights: z.number().nullable(),
          requiresWaiver: z.boolean(),
          waiverText: z.string().nullable(),
          isActive: z.boolean(),
          createdAt: z.string(),
          updatedAt: z.string(),
        }),
      )
      .parse(data);
  },
  async createTaxRule(payload: {
    campgroundId: string;
    name: string;
    type: "percentage" | "flat" | "exemption";
    rate?: number;
    minNights?: number;
    maxNights?: number;
    requiresWaiver?: boolean;
    waiverText?: string;
  }) {
    const res = await fetch(`${API_BASE}/tax-rules`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...scopedHeaders() },
      body: JSON.stringify(payload),
    });
    return parseResponse(res, IdSchema);
  },
  async updateTaxRule(
    id: string,
    payload: Partial<{
      name: string;
      type: "percentage" | "flat" | "exemption";
      rate: number;
      minNights: number;
      maxNights: number;
      requiresWaiver: boolean;
      waiverText: string;
      isActive: boolean;
    }>,
    campgroundId?: string,
  ) {
    const path = withCampgroundId(`/tax-rules/${id}`, campgroundId);
    const res = await fetch(`${API_BASE}${path}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", ...scopedHeaders() },
      body: JSON.stringify(payload),
    });
    return parseResponse(res, IdSchema);
  },
  async deleteTaxRule(id: string, campgroundId?: string) {
    const path = withCampgroundId(`/tax-rules/${id}`, campgroundId);
    const res = await fetch(`${API_BASE}${path}`, {
      method: "DELETE",
      headers: scopedHeaders(),
    });
    return parseResponse(res, IdSchema);
  },

  // Seasonal Rates
  async getSeasonalRates(campgroundId: string) {
    const data = await fetchJSONUnknown(`/seasonal-rates/campground/${campgroundId}`);
    return z
      .array(
        z.object({
          id: z.string(),
          campgroundId: z.string(),
          siteClassId: z.string().nullable(),
          name: z.string(),
          rateType: z.enum(["nightly", "weekly", "monthly", "seasonal"]),
          amount: z.number(),
          minNights: z.number().nullable(),
          startDate: z.string().nullable(),
          endDate: z.string().nullable(),
          isActive: z.boolean(),
          paymentSchedule: z.enum([
            "single",
            "weekly",
            "monthly",
            "as_you_stay",
            "offseason_installments",
          ]),
          pricingStructure: z.enum(["per_night", "flat_week", "flat_month", "flat_season"]),
          offseasonInterval: z.number().nullable(),
          offseasonAmount: z.number().nullable(),
          prorateExcess: z.boolean(),
          createdAt: z.string(),
          updatedAt: z.string(),
        }),
      )
      .parse(data);
  },
  async createSeasonalRate(payload: {
    campgroundId: string;
    siteClassId?: string;
    name: string;
    rateType: "nightly" | "weekly" | "monthly" | "seasonal";
    amount: number;
    minNights?: number;
    startDate?: string;
    endDate?: string;
    paymentSchedule?: "single" | "weekly" | "monthly" | "as_you_stay" | "offseason_installments";
    pricingStructure?: "per_night" | "flat_week" | "flat_month" | "flat_season";
    offseasonInterval?: number;
    offseasonAmount?: number;
    prorateExcess?: boolean;
  }) {
    const res = await fetch(`${API_BASE}/seasonal-rates`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...scopedHeaders() },
      body: JSON.stringify(payload),
    });
    return parseResponse(res, IdSchema);
  },
  async updateSeasonalRate(
    id: string,
    payload: Partial<{
      name: string;
      rateType: "nightly" | "weekly" | "monthly" | "seasonal";
      amount: number;
      minNights: number;
      startDate: string;
      endDate: string;
      isActive: boolean;
      paymentSchedule: "single" | "weekly" | "monthly" | "as_you_stay" | "offseason_installments";
      pricingStructure: "per_night" | "flat_week" | "flat_month" | "flat_season";
      offseasonInterval: number;
      offseasonAmount: number;
      prorateExcess: boolean;
    }>,
    campgroundId?: string,
  ) {
    const path = withCampgroundId(`/seasonal-rates/${id}`, campgroundId);
    const res = await fetch(`${API_BASE}${path}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", ...scopedHeaders() },
      body: JSON.stringify(payload),
    });
    return parseResponse(res, IdSchema);
  },
  async deleteSeasonalRate(id: string, campgroundId?: string) {
    const path = withCampgroundId(`/seasonal-rates/${id}`, campgroundId);
    const res = await fetch(`${API_BASE}${path}`, {
      method: "DELETE",
      headers: scopedHeaders(),
    });
    return parseResponse(res, IdSchema);
  },
  async getRepeatChargesByReservation(reservationId: string, campgroundId?: string) {
    const path = withCampgroundId(`/repeat-charges/reservation/${reservationId}`, campgroundId);
    const data = await fetchJSONUnknown(path);
    return z
      .array(
        z.object({
          id: z.string(),
          reservationId: z.string(),
          dueDate: z.string(),
          amount: z.number(),
          status: z.enum(["pending", "paid", "failed", "cancelled"]),
          paidAt: z.string().nullable(),
          createdAt: z.string(),
          updatedAt: z.string(),
        }),
      )
      .parse(data);
  },

  // Guest Equipment
  async getGuestEquipment(guestId: string) {
    const data = await fetchJSONUnknown(`/guests/${guestId}/equipment`);
    return z.array(GuestEquipmentSchema).parse(data);
  },
  async createGuestEquipment(
    guestId: string,
    payload: {
      type: string;
      make?: string;
      model?: string;
      length?: number;
      plateNumber?: string;
      plateState?: string;
    },
  ) {
    const res = await fetch(`${API_BASE}/guests/${guestId}/equipment`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...scopedHeaders() },
      body: JSON.stringify(payload),
    });
    const data = await parseResponse(res, UnknownSchema);
    return GuestEquipmentSchema.parse(data);
  },
  async updateGuestEquipment(
    id: string,
    payload: {
      type?: string;
      make?: string;
      model?: string;
      length?: number;
      plateNumber?: string;
      plateState?: string;
    },
  ) {
    const res = await fetch(`${API_BASE}/guests/equipment/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", ...scopedHeaders() },
      body: JSON.stringify(payload),
    });
    const data = await parseResponse(res, UnknownSchema);
    return GuestEquipmentSchema.parse(data);
  },
  async deleteGuestEquipment(id: string) {
    const res = await fetch(`${API_BASE}/guests/equipment/${id}`, {
      method: "DELETE",
      headers: scopedHeaders(),
    });
    return parseResponse(res, IdSchema);
  },

  // Repeat Charges
  // Repeat Charges
  async generateRepeatCharges(reservationId: string, campgroundId?: string) {
    const path = withCampgroundId(
      `/repeat-charges/reservation/${reservationId}/generate`,
      campgroundId,
    );
    const res = await fetch(`${API_BASE}${path}`, {
      method: "POST",
      headers: scopedHeaders(),
    });
    return parseResponse(res, UnknownSchema);
  },
  async getRepeatChargesByCampground(campgroundId: string) {
    const path = withCampgroundId(`/repeat-charges`, campgroundId);
    const data = await fetchJSONUnknown(path);
    return z
      .array(
        z.object({
          id: z.string(),
          reservationId: z.string(),
          amount: z.number(),
          dueDate: z.string(),
          status: z.enum(["pending", "paid", "failed"]),
          paidAt: z.string().nullable(),
          failedAt: z.string().nullable(),
          failureReason: z.string().nullable(),
          createdAt: z.string(),
          updatedAt: z.string(),
          reservation: z
            .object({
              id: z.string(),
              guest: z
                .object({
                  primaryFirstName: z.string(),
                  primaryLastName: z.string(),
                  email: z.string(),
                })
                .optional(),
              site: z
                .object({
                  siteNumber: z.string(),
                })
                .optional(),
            })
            .optional(),
        }),
      )
      .parse(data);
  },
  async processRepeatCharge(id: string, campgroundId?: string) {
    const path = withCampgroundId(`/repeat-charges/${id}/process`, campgroundId);
    const res = await fetch(`${API_BASE}${path}`, {
      method: "POST",
      headers: scopedHeaders(),
    });
    return parseResponse(res, IdSchema);
  },

  // Activities
  async getActivities(campgroundId: string) {
    const data = await fetchJSONUnknown(`/activities?campgroundId=${campgroundId}`);
    return z
      .array(
        z.object({
          id: z.string(),
          name: z.string(),
          description: z.string().nullable(),
          price: z.number(),
          duration: z.number(),
          capacity: z.number(),
          images: z.array(z.string()),
          isActive: z.boolean(),
          createdAt: z.string(),
          updatedAt: z.string(),
        }),
      )
      .parse(data);
  },

  async getActivityCapacity(activityId: string) {
    const data = await fetchJSONUnknown(`/activities/${activityId}/capacity`);
    return ActivityCapacitySchema.parse(data);
  },

  async updateActivityCapacity(
    activityId: string,
    payload: { capacity?: number; waitlistEnabled?: boolean; booked?: number },
  ) {
    const res = await fetch(`${API_BASE}/activities/${activityId}/capacity`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", ...scopedHeaders() },
      body: JSON.stringify(payload),
    });
    const data = await parseResponse(res, UnknownSchema);
    return ActivityCapacitySchema.parse(data);
  },

  async addActivityWaitlistEntry(
    activityId: string,
    payload: { guestName: string; partySize?: number; contact?: string },
  ) {
    const res = await fetch(`${API_BASE}/activities/${activityId}/waitlist`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...scopedHeaders() },
      body: JSON.stringify(payload),
    });
    const data = await parseResponse(res, UnknownSchema);
    return z
      .object({ entry: ActivityWaitlistEntrySchema, snapshot: ActivityCapacitySchema })
      .parse(data);
  },

  async createActivity(campgroundId: string, payload: Record<string, unknown>) {
    const res = await fetch(`${API_BASE}/activities`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...scopedHeaders() },
      body: JSON.stringify({ ...payload, campgroundId }),
    });
    return parseResponse(res, UnknownSchema);
  },

  async updateActivity(id: string, payload: Record<string, unknown>) {
    const res = await fetch(`${API_BASE}/activities/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", ...scopedHeaders() },
      body: JSON.stringify(payload),
    });
    return parseResponse(res, UnknownSchema);
  },

  async deleteActivity(id: string) {
    const res = await fetch(`${API_BASE}/activities/${id}`, {
      method: "DELETE",
      headers: scopedHeaders(),
    });
    if (!res.ok) throw new Error("Failed to delete activity");
    return true;
  },

  async getSessions(activityId: string) {
    const data = await fetchJSONUnknown(`/activities/${activityId}/sessions`);
    return z
      .array(
        z.object({
          id: z.string(),
          activityId: z.string(),
          startTime: z.string(),
          endTime: z.string(),
          capacity: z.number(),
          bookedCount: z.number(),
          status: z.string(),
          bookings: z.array(z.unknown()).optional(),
        }),
      )
      .parse(data);
  },

  async createSession(activityId: string, payload: Record<string, unknown>) {
    const res = await fetch(`${API_BASE}/activities/${activityId}/sessions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...scopedHeaders() },
      body: JSON.stringify(payload),
    });
    return parseResponse(res, UnknownSchema);
  },

  async bookActivity(
    sessionId: string,
    payload: { guestId: string; quantity: number; reservationId?: string },
  ) {
    const res = await fetch(`${API_BASE}/activities/sessions/${sessionId}/book`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...scopedHeaders() },
      body: JSON.stringify(payload),
    });
    return parseResponse(res, UnknownSchema);
  },

  async cancelActivityBooking(id: string) {
    const res = await fetch(`${API_BASE}/activities/bookings/${id}/cancel`, {
      method: "POST",
      headers: scopedHeaders(),
    });
    return parseResponse(res, UnknownSchema);
  },

  // Bulk session generation
  async previewGeneratedSessions(
    activityId: string,
    payload: {
      patternType: "none" | "daily" | "weekly" | "biweekly" | "monthly";
      daysOfWeek?: number[];
      startTime: string;
      endTime?: string;
      startDate: string;
      endDate: string;
      capacity?: number;
    },
  ) {
    const res = await fetch(`${API_BASE}/activities/${activityId}/sessions/preview`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...scopedHeaders() },
      body: JSON.stringify(payload),
    });
    return parseResponse(
      res,
      z.object({
        sessions: z.array(
          z.object({
            startTime: z.string(),
            endTime: z.string(),
            dayOfWeek: z.string(),
            isWeekend: z.boolean(),
          }),
        ),
        totalCount: z.number(),
        patternDescription: z.string(),
      }),
    );
  },

  async generateSessions(
    activityId: string,
    payload: {
      patternType: "none" | "daily" | "weekly" | "biweekly" | "monthly";
      daysOfWeek?: number[];
      startTime: string;
      endTime?: string;
      startDate: string;
      endDate: string;
      capacity?: number;
      savePattern?: boolean;
    },
  ) {
    const res = await fetch(`${API_BASE}/activities/${activityId}/sessions/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...scopedHeaders() },
      body: JSON.stringify(payload),
    });
    return parseResponse(
      res,
      z.object({
        created: z.number(),
        patternId: z.string().optional(),
      }),
    );
  },

  async getRecurrencePatterns(activityId: string) {
    const data = await fetchJSONUnknown(`/activities/${activityId}/patterns`);
    return z
      .array(
        z.object({
          id: z.string(),
          patternType: z.string(),
          daysOfWeek: z.array(z.number()),
          startTime: z.string(),
          endTime: z.string(),
          validFrom: z.string(),
          validUntil: z.string().nullable(),
          capacity: z.number().nullable(),
          isActive: z.boolean(),
        }),
      )
      .parse(data);
  },

  async deleteRecurrencePattern(patternId: string) {
    const res = await fetch(`${API_BASE}/activities/patterns/${patternId}`, {
      method: "DELETE",
      headers: scopedHeaders(),
    });
    await parseResponse(res, UnknownSchema);
  },

  // Activity bundles
  async getActivityBundles(campgroundId: string) {
    const data = await fetchJSONUnknown(`/activities/bundles?campgroundId=${campgroundId}`);
    return z
      .array(
        z.object({
          id: z.string(),
          name: z.string(),
          description: z.string().nullable(),
          price: z.number(),
          discountType: z.string(),
          discountValue: z.number().nullable(),
          isActive: z.boolean(),
          items: z.array(
            z.object({
              id: z.string(),
              activityId: z.string(),
              quantity: z.number(),
              activity: z.object({
                id: z.string(),
                name: z.string(),
                price: z.number(),
              }),
            }),
          ),
        }),
      )
      .parse(data);
  },

  async createActivityBundle(
    campgroundId: string,
    payload: {
      name: string;
      description?: string;
      price: number;
      discountType?: "fixed" | "percent";
      discountValue?: number;
      activityIds: string[];
    },
  ) {
    const res = await fetch(`${API_BASE}/activities/bundles?campgroundId=${campgroundId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...scopedHeaders() },
      body: JSON.stringify(payload),
    });
    return parseResponse(res, UnknownSchema);
  },

  async updateActivityBundle(
    id: string,
    payload: {
      name?: string;
      description?: string;
      price?: number;
      isActive?: boolean;
      activityIds?: string[];
    },
  ) {
    const res = await fetch(`${API_BASE}/activities/bundles/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", ...scopedHeaders() },
      body: JSON.stringify(payload),
    });
    return parseResponse(res, UnknownSchema);
  },

  async deleteActivityBundle(id: string) {
    const res = await fetch(`${API_BASE}/activities/bundles/${id}`, {
      method: "DELETE",
      headers: scopedHeaders(),
    });
    await parseResponse(res, UnknownSchema);
  },

  // Memberships
  async getMembershipTypes(campgroundId: string) {
    const data = await fetchJSONUnknown(`/memberships/types?campgroundId=${campgroundId}`);
    return z
      .array(
        z.object({
          id: z.string(),
          name: z.string(),
          description: z.string().nullable(),
          price: z.number(),
          durationDays: z.number(),
          discountPercent: z.number(),
          isActive: z.boolean(),
        }),
      )
      .parse(data);
  },

  async createMembershipType(campgroundId: string, payload: Record<string, unknown>) {
    const res = await fetch(`${API_BASE}/memberships/types`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...scopedHeaders() },
      body: JSON.stringify({ ...payload, campgroundId }),
    });
    return parseResponse(res, UnknownSchema);
  },

  async updateMembershipType(id: string, payload: Record<string, unknown>) {
    const res = await fetch(`${API_BASE}/memberships/types/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", ...scopedHeaders() },
      body: JSON.stringify(payload),
    });
    return parseResponse(res, UnknownSchema);
  },

  async deleteMembershipType(id: string) {
    const res = await fetch(`${API_BASE}/memberships/types/${id}`, {
      method: "DELETE",
      headers: scopedHeaders(),
    });
    if (!res.ok) throw new Error("Failed to delete membership type");
    return true;
  },

  async purchaseMembership(payload: { guestId: string; membershipTypeId: string }) {
    const res = await fetch(`${API_BASE}/memberships/purchase`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...scopedHeaders() },
      body: JSON.stringify(payload),
    });
    return parseResponse(res, UnknownSchema);
  },

  async getGuestMemberships(guestId: string) {
    const data = await fetchJSONUnknown(`/memberships/guest/${guestId}`);
    return z
      .array(
        z.object({
          id: z.string(),
          membershipTypeId: z.string(),
          guestId: z.string(),
          startDate: z.string(),
          endDate: z.string(),
          status: z.string(),
          membershipType: z.object({
            name: z.string(),
            discountPercent: z.number(),
          }),
        }),
      )
      .parse(data);
  },

  // Campaigns
  async listCampaigns(campgroundId?: string) {
    const params = campgroundId ? `?campgroundId=${campgroundId}` : "";
    const data = await fetchJSONUnknown(`/campaigns${params}`);
    return z.array(CampaignSchema).parse(data);
  },
  async createCampaign(payload: {
    campgroundId: string;
    name: string;
    subject: string;
    fromEmail: string;
    fromName?: string;
    html: string;
    textBody?: string;
    channel?: "email" | "sms" | "both";
    templateId?: string;
    audienceJson?: unknown;
    suggestedReason?: string;
    variables?: unknown;
    scheduledAt?: string | null;
    batchPerMinute?: number | null;
  }) {
    const res = await fetch(`${API_BASE}/campaigns`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...scopedHeaders() },
      body: JSON.stringify(payload),
    });
    const data = await parseResponse(res, UnknownSchema);
    return CampaignSchema.parse(data);
  },
  async updateCampaign(
    id: string,
    payload: Partial<{
      name: string;
      subject: string;
      fromEmail: string;
      fromName?: string;
      html: string;
      textBody?: string;
      channel?: "email" | "sms" | "both";
      templateId?: string;
      audienceJson?: unknown;
      suggestedReason?: string;
      status: "draft" | "scheduled" | "sending" | "sent" | "cancelled";
      scheduledAt?: string | null;
    }>,
  ) {
    const res = await fetch(`${API_BASE}/campaigns/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", ...scopedHeaders() },
      body: JSON.stringify(payload),
    });
    const data = await parseResponse(res, UnknownSchema);
    return CampaignSchema.parse(data);
  },
  async sendCampaign(
    id: string,
    opts?: { scheduledAt?: string | null; batchPerMinute?: number | null },
  ) {
    const res = await fetch(`${API_BASE}/campaigns/${id}/send`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...scopedHeaders() },
      body: JSON.stringify({
        scheduledAt: opts?.scheduledAt ?? null,
        batchPerMinute: opts?.batchPerMinute ?? null,
      }),
    });
    const data = await parseResponse(res, UnknownSchema);
    return z
      .object({
        sent: z.number().optional(),
        scheduledAt: z.string().optional(),
      })
      .parse(data);
  },
  async testCampaign(id: string, payload: { email?: string; phone?: string }) {
    const res = await fetch(`${API_BASE}/campaigns/${id}/test`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...scopedHeaders() },
      body: JSON.stringify(payload),
    });
    return parseResponse(res, UnknownSchema);
  },

  // Campaign Templates
  async listCampaignTemplates(campgroundId: string) {
    const data = await fetchJSONUnknown(`/campaign-templates?campgroundId=${campgroundId}`);
    return z.array(CampaignTemplateSchema).parse(data);
  },
  async getCampaignTemplates(campgroundId: string) {
    return this.listCampaignTemplates(campgroundId);
  },
  async createCampaignTemplate(
    campgroundIdOrPayload:
      | string
      | {
          campgroundId: string;
          name: string;
          channel?: "email" | "sms" | "both";
          category?: string;
          subject?: string;
          html?: string;
          textBody?: string;
        },
    payloadArg?: {
      name: string;
      channel?: "email" | "sms" | "both";
      category?: string;
      subject?: string;
      html?: string;
      textBody?: string;
    },
  ) {
    const payload =
      typeof campgroundIdOrPayload === "string"
        ? { campgroundId: campgroundIdOrPayload, ...payloadArg! }
        : campgroundIdOrPayload;
    const res = await fetch(`${API_BASE}/campaign-templates`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...scopedHeaders() },
      body: JSON.stringify(payload),
    });
    const data = await parseResponse(res, UnknownSchema);
    return CampaignTemplateSchema.parse(data);
  },
  async updateCampaignTemplate(
    id: string,
    payload: {
      name?: string;
      category?: string;
      subject?: string;
      html?: string;
      textBody?: string;
    },
  ) {
    const res = await fetch(`${API_BASE}/campaign-templates/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", ...scopedHeaders() },
      body: JSON.stringify(payload),
    });
    const data = await parseResponse(res, UnknownSchema);
    return CampaignTemplateSchema.parse(data);
  },
  async deleteCampaignTemplate(id: string) {
    const res = await fetch(`${API_BASE}/campaign-templates/${id}`, {
      method: "DELETE",
      headers: scopedHeaders(),
    });
    if (!res.ok) throw new Error("Failed to delete template");
    return true;
  },

  // Audience
  async previewCampaignAudience(payload: {
    campgroundId: string;
    siteType?: string;
    siteClassId?: string;
    stayedFrom?: string;
    stayedTo?: string;
    lastStayBefore?: string;
    state?: string;
    notStayedThisYear?: boolean;
  }) {
    const res = await fetch(`${API_BASE}/campaigns/audience/preview`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...scopedHeaders() },
      body: JSON.stringify(payload),
    });
    const data = await parseResponse(res, UnknownSchema);
    return z
      .object({
        count: z.number(),
        sample: z.array(
          z.object({
            id: z.string(),
            name: z.string().optional(),
            email: z.string().nullable().optional(),
            phone: z.string().nullable().optional(),
            lastStay: z.string().nullable().optional(),
          }),
        ),
      })
      .parse(data);
  },
  async getCampaignSuggestions(campgroundId: string) {
    const data = await fetchJSONUnknown(`/campaigns/suggestions?campgroundId=${campgroundId}`);
    return z
      .array(
        z.object({
          reason: z.string(),
          filters: z.unknown(),
        }),
      )
      .parse(data);
  },

  // Marketing leads (stubbed; client-side only)
  async listLeads(campgroundId?: string) {
    const leads = readLeadStore();
    return campgroundId ? leads.filter((lead) => lead.campgroundId === campgroundId) : leads;
  },
  async saveLead(payload: {
    campgroundId?: string;
    campgroundName?: string;
    name: string;
    email: string;
    interest: string;
    source?: string;
  }) {
    const resolvedCampgroundId = getCurrentCampgroundId(payload.campgroundId);
    const record: LeadRecord = {
      id: generateLeadId(),
      campgroundId: resolvedCampgroundId,
      campgroundName: payload.campgroundName,
      name: payload.name,
      email: payload.email,
      interest: payload.interest,
      status: "new",
      source: payload.source,
      createdAt: new Date().toISOString(),
      lastSyncedAt: null,
    };
    return upsertLead(record);
  },
  async updateLeadStatus(id: string, status: LeadStatus) {
    const updated = updateLead(id, (lead) => ({ ...lead, status }));
    if (!updated) {
      throw new Error("Lead not found");
    }
    return updated;
  },
  async syncLeadToCrm(id: string) {
    const updated = updateLead(id, (lead) => ({
      ...lead,
      lastSyncedAt: new Date().toISOString(),
    }));
    if (!updated) {
      throw new Error("Lead not found");
    }
    return updated;
  },

  // Identity & permissions
  async getWhoami(token?: string) {
    const headers = token ? { Authorization: `Bearer ${token}` } : undefined;
    const data = await fetchJSONUnknown("/permissions/whoami", headers);
    return z
      .object({
        user: z.object({
          id: z.string(),
          email: z.string(),
          firstName: z.string().nullable().optional(),
          lastName: z.string().nullable().optional(),
          region: z.string().nullable(),
          platformRole: z.string().nullable().optional(),
          platformRegion: z.string().nullable().optional(),
          platformActive: z.boolean().nullable().optional(),
          ownershipRoles: z.array(z.string()).default([]),
          memberships: z
            .array(
              z.object({
                campgroundId: z.string(),
                role: z.string(),
                campground: z
                  .object({
                    id: z.string(),
                    name: z.string(),
                    slug: z.string().nullable().optional(),
                  })
                  .nullable()
                  .optional(),
              }),
            )
            .default([]),
        }),
        allowed: z.object({
          supportRead: z.boolean().optional().default(false),
          supportAssign: z.boolean().optional().default(false),
          supportAnalytics: z.boolean().optional().default(false),
          operationsWrite: z.boolean().optional().default(false),
          financeRead: z.boolean().optional().default(false),
          reportsRead: z.boolean().optional().default(false),
          usersWrite: z.boolean().optional().default(false),
          settingsWrite: z.boolean().optional().default(false),
          pricingWrite: z.boolean().optional().default(false),
        }),
      })
      .parse(data);
  },

  // Growth & recovery
  async listAbandonedCarts(campgroundId: string) {
    const data = await fetchJSONUnknown(`/abandoned-carts?campgroundId=${campgroundId}`);
    return z.array(AbandonedCartSchema).parse(data);
  },
  async enqueueAbandonedCart(payload: {
    campgroundId: string;
    email?: string;
    phone?: string;
    abandonedAt?: string;
  }) {
    const res = await fetch(`${API_BASE}/abandoned-carts/queue`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...scopedHeaders() },
      body: JSON.stringify(payload),
    });
    const data = await parseResponse(res, UnknownSchema);
    return AbandonedCartSchema.parse(data);
  },
  async markAbandonedCartContacted(id: string, payload?: { note?: string }) {
    const res = await fetch(`${API_BASE}/abandoned-carts/${id}/contact`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...scopedHeaders() },
      body: JSON.stringify(payload || {}),
    });
    const data = await parseResponse(res, UnknownSchema);
    return AbandonedCartSchema.parse(data);
  },

  async updateSiteHousekeeping(siteId: string, status: string) {
    const res = await fetch(`${API_BASE}/operations/sites/${siteId}/housekeeping`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", ...scopedHeaders() },
      body: JSON.stringify({ status }),
    });
    return parseResponse(res, UnknownSchema);
  },

  async getHousekeepingStats(campgroundId: string) {
    const data = await fetchJSONUnknown(
      `/operations/stats/housekeeping?campgroundId=${campgroundId}`,
    );
    return z
      .object({
        clean: z.number(),
        dirty: z.number(),
        inspecting: z.number(),
        total: z.number(),
      })
      .parse(data);
  },
  async getAutoTasking(campgroundId: string) {
    const data = await fetchJSONUnknown(`/operations/auto-tasking?campgroundId=${campgroundId}`);
    return z
      .array(
        z.object({
          trigger: z.string(),
          task: z.string(),
          status: z.string(),
          dueMinutes: z.number().optional(),
          owner: z.string().optional(),
          playbook: z.string().optional(),
        }),
      )
      .parse(data);
  },
  async triggerAutoTask(campgroundId: string, trigger: string) {
    const res = await fetch(`${API_BASE}/operations/auto-tasking/trigger`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...scopedHeaders() },
      body: JSON.stringify({ campgroundId, trigger }),
    });
    const data = await parseResponse(res, UnknownSchema);
    return z
      .object({
        triggered: z.boolean(),
        trigger: z.string(),
        created: z.array(
          z.object({
            id: z.string(),
            title: z.string(),
            status: z.string(),
            priority: z.string().optional(),
            dueAt: z.string().optional(),
            owner: z.string().optional(),
          }),
        ),
      })
      .parse(data);
  },
  async listChecklists(campgroundId: string) {
    const data = await fetchJSONUnknown(`/operations/checklists?campgroundId=${campgroundId}`);
    return z
      .array(
        z.object({
          id: z.string(),
          name: z.string(),
          steps: z.array(z.string()),
          status: z.string(),
          owner: z.string().optional(),
          dueMinutes: z.number().optional(),
        }),
      )
      .parse(data);
  },
  async listReorders(campgroundId: string) {
    const data = await fetchJSONUnknown(`/operations/reorders?campgroundId=${campgroundId}`);
    return z
      .array(
        z.object({
          id: z.string(),
          item: z.string(),
          qty: z.number(),
          threshold: z.number(),
          status: z.string(),
          vendor: z.string().optional(),
          reorderQty: z.number().optional(),
        }),
      )
      .parse(data);
  },
  async listOpsSuggestions(campgroundId: string) {
    const data = await fetchJSONUnknown(
      `/operations/copilot/suggestions?campgroundId=${campgroundId}`,
    );
    return z
      .array(
        z.object({
          id: z.string(),
          suggestion: z.string(),
          impact: z.string(),
          action: z.string(),
          status: z.string(),
        }),
      )
      .parse(data);
  },

  async getOpsHealth(campgroundId: string) {
    const data = await fetchJSONUnknown(`/operations/ops-health?campgroundId=${campgroundId}`);
    return z
      .object({
        campgroundId: z.string(),
        capturedAt: z.string(),
        autoTasking: z.object({
          recentRuns: z.array(
            z.object({
              trigger: z.string(),
              status: z.string(),
              createdTasks: z.number(),
              durationMs: z.number(),
              at: z.string(),
            }),
          ),
          tasksCreatedLast24h: z.number(),
        }),
        checklists: z.object({
          completionRate: z.number(),
          active: z.number(),
          overdue: z.number(),
        }),
        reorders: z.object({
          pending: z.number(),
          items: z.array(
            z.object({
              id: z.string(),
              item: z.string(),
              qty: z.number(),
              threshold: z.number(),
              status: z.string(),
              vendor: z.string().optional(),
              reorderQty: z.number().optional(),
            }),
          ),
        }),
      })
      .parse(data);
  },

  async sendOpsHealthAlert(
    campgroundId: string,
    payload: { channel?: string; target?: string; message?: string } = {},
  ) {
    const res = await fetch(`${API_BASE}/operations/ops-health/alert`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...scopedHeaders() },
      body: JSON.stringify({ campgroundId, ...payload }),
    });
    return parseResponse(res, UnknownSchema);
  },

  // NPS
  async createNpsSurvey(payload: {
    campgroundId: string;
    name: string;
    question?: string;
    channels?: string[];
    locales?: string[];
    cooldownDays?: number;
    samplingPercent?: number;
    activeFrom?: string;
    activeTo?: string;
  }) {
    const res = await fetch(`${API_BASE}/nps/surveys`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...scopedHeaders() },
      body: JSON.stringify(payload),
    });
    const data = await parseResponse(res, UnknownSchema);
    return NpsSurveySchema.parse(data);
  },
  async listNpsSurveys(campgroundId: string) {
    const data = await fetchJSONUnknown(`/nps/surveys?campgroundId=${campgroundId}`);
    return z.array(NpsSurveySchema.extend({ rules: z.array(z.unknown()).optional() })).parse(data);
  },
  async createNpsRule(payload: {
    surveyId: string;
    trigger: string;
    percentage?: number;
    cooldownDays?: number;
    segmentJson?: unknown;
    isActive?: boolean;
  }) {
    const res = await fetch(`${API_BASE}/nps/rules`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...scopedHeaders() },
      body: JSON.stringify(payload),
    });
    return parseResponse(res, UnknownSchema);
  },
  async createNpsInvite(payload: {
    surveyId: string;
    campgroundId: string;
    organizationId?: string;
    guestId?: string;
    reservationId?: string;
    channel: "email" | "sms" | "inapp";
    email?: string;
    phone?: string;
    expireDays?: number;
  }) {
    const res = await fetch(`${API_BASE}/nps/invites`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...scopedHeaders() },
      body: JSON.stringify(payload),
    });
    const data = await parseResponse(res, UnknownSchema);
    return NpsInviteSchema.parse(data);
  },
  async respondNps(payload: { token: string; score: number; comment?: string; tags?: string[] }) {
    const res = await fetch(`${API_BASE}/nps/respond`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await parseResponse(res, UnknownSchema);
    return NpsResponseSchema.parse(data);
  },
  async getNpsMetrics(campgroundId: string) {
    const data = await fetchJSONUnknown(`/nps/metrics?campgroundId=${campgroundId}`);
    return NpsMetricsSchema.parse(data);
  },

  // Reviews
  async createReviewRequest(payload: {
    campgroundId: string;
    organizationId?: string;
    guestId?: string;
    reservationId?: string;
    channel: "email" | "sms" | "inapp" | "kiosk";
    email?: string;
    phone?: string;
    expireDays?: number;
  }) {
    const res = await fetch(`${API_BASE}/reviews/requests`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...scopedHeaders() },
      body: JSON.stringify(payload),
    });
    const data = await parseResponse(res, UnknownSchema);
    return ReviewRequestSchema.parse(data);
  },
  async submitReview(payload: {
    token: string;
    rating: number;
    title?: string;
    body?: string;
    photos?: string[];
    tags?: string[];
  }) {
    const res = await fetch(`${API_BASE}/reviews/submit`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await parseResponse(res, UnknownSchema);
    return ReviewSchema.parse(data);
  },
  async getPublicReviews(campgroundId: string) {
    const data = await fetchJSONUnknown(`/reviews/public?campgroundId=${campgroundId}`);
    return z
      .array(ReviewSchema.extend({ replies: z.array(ReviewReplySchema).optional() }))
      .parse(data);
  },
  async getAdminReviews(campgroundId: string, status?: string) {
    const qs = new URLSearchParams({ campgroundId });
    if (status) qs.set("status", status);
    const data = await fetchJSONUnknown(`/reviews?${qs.toString()}`);
    return z
      .array(
        ReviewSchema.extend({
          moderation: ReviewModerationSchema.nullish(),
          guest: z
            .object({
              primaryFirstName: z.string().optional().nullable(),
              primaryLastName: z.string().optional().nullable(),
              email: z.string().optional().nullable(),
            })
            .optional()
            .nullable(),
          reservation: z.object({ id: z.string() }).optional().nullable(),
          replies: z.array(ReviewReplySchema).optional(),
        }),
      )
      .parse(data);
  },
  async moderateReview(payload: {
    reviewId: string;
    status: "approved" | "rejected" | "pending";
    reasons?: string[];
    notes?: string;
  }) {
    const res = await fetch(`${API_BASE}/reviews/moderate`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...scopedHeaders() },
      body: JSON.stringify(payload),
    });
    return parseResponse(res, UnknownSchema);
  },
  async voteReview(payload: { reviewId: string; value: "helpful" | "not_helpful" }) {
    const res = await fetch(`${API_BASE}/reviews/vote`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...scopedHeaders() },
      body: JSON.stringify(payload),
    });
    return parseResponse(res, UnknownSchema);
  },
  async replyReview(payload: {
    reviewId: string;
    authorType: "staff" | "guest";
    authorId?: string;
    body: string;
  }) {
    const res = await fetch(`${API_BASE}/reviews/reply`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...scopedHeaders() },
      body: JSON.stringify(payload),
    });
    return parseResponse(res, UnknownSchema);
  },

  // -------------------------------------------------------------------------
  // Analytics & Decision Engine
  // -------------------------------------------------------------------------
  async getAnalyticsFunnel(campgroundId: string, days: number = 30) {
    const data = await fetchJSONUnknown(
      `/analytics/reports/funnel?campgroundId=${campgroundId}&days=${days}`,
    );
    return z
      .object({
        windowDays: z.number(),
        steps: z.object({
          views: z.number(),
          addToStay: z.number(),
          starts: z.number(),
          abandoned: z.number(),
          completed: z.number(),
        }),
        conversionRate: z.number(),
        abandonmentRate: z.number(),
      })
      .parse(data);
  },
  async getAnalyticsImagePerformance(campgroundId: string, days: number = 30) {
    const data = await fetchJSONUnknown(
      `/analytics/reports/images?campgroundId=${campgroundId}&days=${days}`,
    );
    return z
      .array(
        z.object({
          imageId: z.string(),
          views: z.number(),
          clicks: z.number(),
          ctr: z.number(),
        }),
      )
      .parse(data);
  },
  async getAnalyticsDealPerformance(campgroundId: string, days: number = 30) {
    const data = await fetchJSONUnknown(
      `/analytics/reports/deals?campgroundId=${campgroundId}&days=${days}`,
    );
    return z
      .array(
        z.object({
          promotionId: z.string(),
          views: z.number(),
          applies: z.number(),
          applyRate: z.number(),
        }),
      )
      .parse(data);
  },
  async getAnalyticsAttribution(campgroundId: string, days: number = 30) {
    const data = await fetchJSONUnknown(
      `/analytics/reports/attribution?campgroundId=${campgroundId}&days=${days}`,
    );
    return z
      .array(
        z.object({
          referrer: z.string().nullable(),
          count: z.number(),
          share: z.number(),
        }),
      )
      .parse(data);
  },
  async getAnalyticsPricingSignals(campgroundId: string, days: number = 30) {
    const data = await fetchJSONUnknown(
      `/analytics/reports/pricing?campgroundId=${campgroundId}&days=${days}`,
    );
    return z
      .object({
        windowDays: z.number(),
        availabilityChecks: z.number(),
        addToStay: z.number(),
        completes: z.number(),
        conversionFromAvailability: z.number(),
        conversionFromAddToStay: z.number(),
      })
      .parse(data);
  },
  async getAnalyticsRecommendations(campgroundId: string) {
    const data = await fetchJSONUnknown(`/analytics/recommendations?campgroundId=${campgroundId}`);
    return z
      .object({
        recommendations: z.array(
          z.object({
            id: z.string(),
            type: z.string(),
            title: z.string(),
            explanation: z.string(),
            confidence: z.string(),
            projectedImpact: z.string(),
            action: z.string(),
            applyAllowed: z.boolean(),
            requiresApproval: z.boolean(),
          }),
        ),
        windowDays: z.number(),
        stats: z.record(z.unknown()),
      })
      .parse(data);
  },
  async getAnalyticsAnnualReport(campgroundId: string, year?: number, format?: "json" | "csv") {
    const params = new URLSearchParams({ campgroundId });
    if (year) params.append("year", String(year));
    if (format) params.append("format", format);
    const data = await fetchJSONUnknown(`/analytics/reports/annual?${params.toString()}`);
    return z
      .object({
        year: z.number(),
        csv: z.string().optional(),
        events: z.array(z.object({ eventName: z.string(), count: z.number() })).optional(),
        deals: z
          .array(z.object({ promotionId: z.string(), views: z.number(), applies: z.number() }))
          .optional(),
        images: z
          .array(z.object({ imageId: z.string(), views: z.number(), clicks: z.number() }))
          .optional(),
      })
      .parse(data);
  },
  async getDeviceBreakdown(campgroundId: string, days: number = 30) {
    const data = await fetchJSONUnknown(
      `/analytics/reports/devices?campgroundId=${campgroundId}&days=${days}`,
    );
    return z
      .object({
        period: z.object({ days: z.number(), since: z.string() }),
        devices: z.array(
          z.object({
            deviceType: z.string(),
            sessions: z.number(),
            bookings: z.number(),
            conversionRate: z.number(),
          }),
        ),
        trends: z.array(
          z.object({
            date: z.string(),
            deviceType: z.string(),
            sessions: z.number(),
          }),
        ),
      })
      .parse(data);
  },
  async logAnalyticsEvent(payload: {
    sessionId: string;
    eventName: string;
    occurredAt?: string;
    campgroundId?: string;
    organizationId?: string;
    reservationId?: string;
    siteId?: string;
    siteClassId?: string;
    promotionId?: string;
    imageId?: string;
    abVariantId?: string;
    page?: string;
    referrer?: string;
    referrerUrl?: string;
    deviceType?: string;
    region?: string;
    metadata?: Record<string, unknown>;
  }) {
    const res = await fetch(`${API_BASE}/analytics/events`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    return parseResponse(res, UnknownSchema);
  },
  async applyAnalyticsRecommendation(payload: {
    recommendationId: string;
    campgroundId: string;
    type?: string;
    action?: string;
    targetId?: string;
    payload?: Record<string, unknown>;
  }) {
    const res = await fetch(`${API_BASE}/analytics/recommendations/apply`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...scopedHeaders() },
      body: JSON.stringify(payload),
    });
    return parseResponse(res, UnknownSchema);
  },
  async proposeAnalyticsRecommendation(payload: {
    recommendationId: string;
    campgroundId: string;
    type?: string;
    targetId?: string;
    payload?: Record<string, unknown>;
  }) {
    const res = await fetch(`${API_BASE}/analytics/recommendations/propose`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...scopedHeaders() },
      body: JSON.stringify(payload),
    });
    return parseResponse(res, UnknownSchema);
  },

  // -------------------------------------------------------------------------
  // AI Suggestions (Legacy - see AI Settings section at end for new methods)
  // -------------------------------------------------------------------------
  async generateAiSuggestions(payload: { campgroundId: string; focus?: string }) {
    const res = await fetch(`${API_BASE}/ai/suggestions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...scopedHeaders() },
      body: JSON.stringify(payload),
    });
    return parseResponse(
      res,
      z.object({
        suggestions: z.string(),
        windowDays: z.number(),
        usage: z
          .object({
            promptTokens: z.number().nullable(),
            completionTokens: z.number().nullable(),
            totalTokens: z.number().nullable(),
          })
          .optional(),
      }),
    );
  },
  async askAi(payload: { campgroundId: string; question: string; includeActions?: boolean }) {
    const res = await fetch(`${API_BASE}/ai/ask`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...scopedHeaders() },
      body: JSON.stringify(payload),
    });
    return parseResponse(
      res,
      z.object({
        answer: z.string(),
        usage: z
          .object({
            promptTokens: z.number().nullable(),
            completionTokens: z.number().nullable(),
            totalTokens: z.number().nullable(),
          })
          .optional(),
      }),
    );
  },
  async aiPartnerChat(
    campgroundId: string,
    payload: {
      sessionId?: string;
      message: string;
      history?: { role: "user" | "assistant"; content: string }[];
    },
  ) {
    const res = await fetch(`${API_BASE}/ai/campgrounds/${campgroundId}/partner`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...scopedHeaders() },
      body: JSON.stringify(payload),
    });
    return parseResponse(res, AiPartnerChatResponseSchema);
  },
  async aiPartnerConfirmAction(
    campgroundId: string,
    payload: {
      action: {
        type: string;
        parameters?: Record<string, unknown>;
        sensitivity?: "low" | "medium" | "high";
        impactArea?: string;
      };
    },
  ) {
    const res = await fetch(`${API_BASE}/ai/campgrounds/${campgroundId}/partner/confirm`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...scopedHeaders() },
      body: JSON.stringify(payload),
    });
    return parseResponse(res, UnknownSchema);
  },

  // -------------------------------------------------------------------------
  // Social Media Planner
  // -------------------------------------------------------------------------
  async listSocialPosts(campgroundId: string) {
    const data = await fetchJSONUnknown(`/social-planner/posts?campgroundId=${campgroundId}`);
    return z.array(SocialPostSchema).parse(data);
  },
  async createSocialPost(payload: Record<string, unknown>) {
    const res = await fetch(`${API_BASE}/social-planner/posts`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...scopedHeaders() },
      body: JSON.stringify(payload),
    });
    const data = await parseResponse(res, UnknownSchema);
    return SocialPostSchema.parse(data);
  },
  async updateSocialPost(id: string, payload: Record<string, unknown>) {
    const res = await fetch(`${API_BASE}/social-planner/posts/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", ...scopedHeaders() },
      body: JSON.stringify(payload),
    });
    const data = await parseResponse(res, UnknownSchema);
    return SocialPostSchema.parse(data);
  },
  async deleteSocialPost(id: string) {
    const res = await fetch(`${API_BASE}/social-planner/posts/${id}`, {
      method: "DELETE",
      headers: { ...scopedHeaders() },
    });
    return parseResponse(res, UnknownSchema);
  },

  async listSocialTemplates(campgroundId: string) {
    const data = await fetchJSONUnknown(`/social-planner/templates?campgroundId=${campgroundId}`);
    return z.array(SocialTemplateSchemaLocal).parse(data);
  },
  async createSocialTemplate(payload: Record<string, unknown>) {
    const res = await fetch(`${API_BASE}/social-planner/templates`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...scopedHeaders() },
      body: JSON.stringify(payload),
    });
    const data = await parseResponse(res, UnknownSchema);
    return SocialTemplateSchemaLocal.parse(data);
  },
  async updateSocialTemplate(id: string, payload: Record<string, unknown>) {
    const res = await fetch(`${API_BASE}/social-planner/templates/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", ...scopedHeaders() },
      body: JSON.stringify(payload),
    });
    const data = await parseResponse(res, UnknownSchema);
    return SocialTemplateSchemaLocal.parse(data);
  },
  async deleteSocialTemplate(id: string) {
    const res = await fetch(`${API_BASE}/social-planner/templates/${id}`, {
      method: "DELETE",
      headers: { ...scopedHeaders() },
    });
    return parseResponse(res, UnknownSchema);
  },

  async listSocialAssets(campgroundId: string) {
    const data = await fetchJSONUnknown(`/social-planner/assets?campgroundId=${campgroundId}`);
    return z.array(SocialAssetSchema).parse(data);
  },
  async createSocialAsset(payload: Record<string, unknown>) {
    const res = await fetch(`${API_BASE}/social-planner/assets`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...scopedHeaders() },
      body: JSON.stringify(payload),
    });
    const data = await parseResponse(res, UnknownSchema);
    return SocialAssetSchema.parse(data);
  },
  async updateSocialAsset(id: string, payload: Record<string, unknown>) {
    const res = await fetch(`${API_BASE}/social-planner/assets/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", ...scopedHeaders() },
      body: JSON.stringify(payload),
    });
    const data = await parseResponse(res, UnknownSchema);
    return SocialAssetSchema.parse(data);
  },
  async deleteSocialAsset(id: string) {
    const res = await fetch(`${API_BASE}/social-planner/assets/${id}`, {
      method: "DELETE",
      headers: { ...scopedHeaders() },
    });
    return parseResponse(res, UnknownSchema);
  },

  async listSocialSuggestions(campgroundId: string, status?: string) {
    const params = new URLSearchParams({ campgroundId });
    if (status) params.append("status", status);
    const data = await fetchJSONUnknown(`/social-planner/suggestions?${params.toString()}`);
    return z.array(SocialSuggestionSchema).parse(data);
  },
  async refreshSocialSuggestions(campgroundId: string) {
    const res = await fetch(`${API_BASE}/social-planner/suggestions/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...scopedHeaders() },
      body: JSON.stringify({ campgroundId }),
    });
    const data = await parseResponse(res, UnknownSchema);
    return z.array(SocialSuggestionSchema).parse(data);
  },
  async updateSocialSuggestionStatus(id: string, payload: Record<string, unknown>) {
    const res = await fetch(`${API_BASE}/social-planner/suggestions/${id}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", ...scopedHeaders() },
      body: JSON.stringify(payload),
    });
    const data = await parseResponse(res, UnknownSchema);
    return SocialSuggestionSchema.parse(data);
  },
  async createSocialSuggestion(payload: Record<string, unknown>) {
    const res = await fetch(`${API_BASE}/social-planner/suggestions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...scopedHeaders() },
      body: JSON.stringify(payload),
    });
    const data = await parseResponse(res, UnknownSchema);
    return SocialSuggestionSchema.parse(data);
  },

  async generateWeeklySocialIdeas(campgroundId: string) {
    const res = await fetch(`${API_BASE}/social-planner/weekly`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...scopedHeaders() },
      body: JSON.stringify({ campgroundId }),
    });
    const data = await parseResponse(res, UnknownSchema);
    return SocialWeeklyIdeaSchema.parse(data);
  },

  async listSocialStrategies(campgroundId: string) {
    const data = await fetchJSONUnknown(`/social-planner/strategies?campgroundId=${campgroundId}`);
    return z.array(SocialStrategySchema).parse(data);
  },
  async createSocialStrategy(payload: Record<string, unknown>) {
    const res = await fetch(`${API_BASE}/social-planner/strategies`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...scopedHeaders() },
      body: JSON.stringify(payload),
    });
    const data = await parseResponse(res, UnknownSchema);
    return SocialStrategySchema.parse(data);
  },

  async listSocialAlerts(campgroundId: string) {
    const data = await fetchJSONUnknown(`/social-planner/alerts?campgroundId=${campgroundId}`);
    return z.array(SocialAlertSchema).parse(data);
  },
  async createSocialAlert(payload: Record<string, unknown>) {
    const res = await fetch(`${API_BASE}/social-planner/alerts`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...scopedHeaders() },
      body: JSON.stringify(payload),
    });
    const data = await parseResponse(res, UnknownSchema);
    return SocialAlertSchema.parse(data);
  },
  async dismissSocialAlert(id: string) {
    const res = await fetch(`${API_BASE}/social-planner/alerts/${id}/dismiss`, {
      method: "POST",
      headers: { ...scopedHeaders() },
    });
    const data = await parseResponse(res, UnknownSchema);
    return SocialAlertSchema.parse(data);
  },

  async recordSocialPerformance(payload: Record<string, unknown>) {
    const res = await fetch(`${API_BASE}/social-planner/performance`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...scopedHeaders() },
      body: JSON.stringify(payload),
    });
    return parseResponse(res, UnknownSchema);
  },

  async getSocialReport(campgroundId: string) {
    const data = await fetchJSONUnknown(`/social-planner/reports?campgroundId=${campgroundId}`);
    return SocialReportSchema.parse(data);
  },

  // -------------------------------------------------------------------------
  // Enterprise scale & internationalization
  // -------------------------------------------------------------------------
  async getPortfolios() {
    const data = await fetchJSONUnknown("/portfolios");
    return PortfolioListSchema.parse(data);
  },
  async selectPortfolio(payload: { portfolioId: string; parkId?: string }) {
    const res = await fetch(`${API_BASE}/portfolios/select`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...scopedHeaders() },
      body: JSON.stringify(payload),
    });
    return parseResponse(res, UnknownSchema);
  },
  async getPortfolioReport(portfolioId: string) {
    const data = await fetchJSONUnknown(`/portfolios/${portfolioId}/report`);
    return PortfolioReportSchema.parse(data);
  },
  async listLocales() {
    const data = await fetchJSONUnknown("/localization/locales");
    return z.array(LocaleOptionSchema).parse(data);
  },
  async getLocalizationSettings() {
    const data = await fetchJSONUnknown("/localization/settings");
    return LocalizationSettingsSchema.parse(data);
  },
  async updateLocalizationSettings(payload: {
    locale?: string;
    currency?: string;
    timezone?: string;
    orgLocale?: string;
    orgCurrency?: string;
  }) {
    const res = await fetch(`${API_BASE}/localization/settings`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...scopedHeaders() },
      body: JSON.stringify(payload),
    });
    const data = await parseResponse(res, UnknownSchema);
    return LocalizationSettingsSchema.parse(data);
  },
  async getLocalizationPreview(params: { locale: string; currency: string; timezone: string }) {
    const qs = new URLSearchParams({
      locale: params.locale,
      currency: params.currency,
      timezone: params.timezone,
    });
    const data = await fetchJSONUnknown(`/localization/preview?${qs.toString()}`);
    return LocalizationPreviewSchema.parse(data);
  },
  async getCurrencyTaxConfig() {
    const data = await fetchJSONUnknown("/currency-tax");
    return CurrencyTaxConfigSchema.parse(data);
  },
  async updateCurrencyTaxConfig(payload: {
    baseCurrency?: string;
    reportingCurrency?: string;
    fxProvider?: string;
    fxRates?: { base: string; quote: string; rate: number; asOf?: string }[];
    taxProfiles?: {
      id: string;
      name: string;
      region: string;
      type: "vat" | "gst" | "sales";
      rate: number;
      inclusive: boolean;
      notes?: string;
    }[];
    parkCurrencies?: { parkId: string; currency: string; taxProfileId: string }[];
  }) {
    const res = await fetch(`${API_BASE}/currency-tax`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...scopedHeaders() },
      body: JSON.stringify(payload),
    });
    const data = await parseResponse(res, UnknownSchema);
    return CurrencyTaxConfigSchema.parse(data);
  },
  async convertCurrency(payload: { amount: number; from: string; to: string }) {
    const res = await fetch(`${API_BASE}/currency-tax/convert`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...scopedHeaders() },
      body: JSON.stringify(payload),
    });
    const data = await parseResponse(res, UnknownSchema);
    return ConversionResultSchema.parse(data);
  },
  async listApprovals() {
    const data = await fetchJSONUnknown("/approvals");
    return ApprovalListSchema.parse(data);
  },
  async listApprovalPolicies() {
    const data = await fetchJSONUnknown("/approvals/policies");
    return z.array(ApprovalPolicySchema).parse(data);
  },
  async createApprovalRequest(payload: {
    type: "refund" | "payout" | "config_change";
    amount: number;
    currency: string;
    reason: string;
    requester: string;
    metadata?: Record<string, unknown>;
  }) {
    const res = await fetch(`${API_BASE}/approvals`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...scopedHeaders() },
      body: JSON.stringify(payload),
    });
    const data = await parseResponse(res, UnknownSchema);
    return ApprovalRequestSchema.parse(data);
  },
  async approveRequest(id: string, approver: string) {
    const res = await fetch(`${API_BASE}/approvals/${id}/approve`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...scopedHeaders() },
      body: JSON.stringify({ approver }),
    });
    const data = await parseResponse(res, UnknownSchema);
    return ApprovalRequestSchema.parse(data);
  },
  async rejectRequest(id: string, approver: string, reason?: string) {
    const res = await fetch(`${API_BASE}/approvals/${id}/reject`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...scopedHeaders() },
      body: JSON.stringify({ approver, reason }),
    });
    const data = await parseResponse(res, UnknownSchema);
    return ApprovalRequestSchema.parse(data);
  },
  async createApprovalPolicy(payload: {
    name: string;
    appliesTo: string[];
    thresholdCents?: number;
    currency?: string;
    approversNeeded?: number;
    description?: string;
    approverRoles?: string[];
    campgroundId?: string;
  }) {
    const res = await fetch(`${API_BASE}/approvals/policies`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...scopedHeaders() },
      body: JSON.stringify(payload),
    });
    const data = await parseResponse(res, UnknownSchema);
    return ApprovalPolicySchema.parse(data);
  },
  async updateApprovalPolicy(
    id: string,
    payload: {
      name?: string;
      appliesTo?: string[];
      thresholdCents?: number | null;
      currency?: string;
      approversNeeded?: number;
      description?: string | null;
      approverRoles?: string[];
      isActive?: boolean;
    },
  ) {
    const res = await fetch(`${API_BASE}/approvals/policies/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", ...scopedHeaders() },
      body: JSON.stringify(payload),
    });
    const data = await parseResponse(res, UnknownSchema);
    return ApprovalPolicySchema.parse(data);
  },
  async deleteApprovalPolicy(id: string) {
    const res = await fetch(`${API_BASE}/approvals/policies/${id}`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json", ...scopedHeaders() },
    });
    return parseResponse(
      res,
      z.object({
        success: z.boolean(),
        id: z.string(),
      }),
    );
  },

  // ---------------------------------------------------------------------------
  // Gamification
  // ---------------------------------------------------------------------------
  async getGamificationDashboard(campgroundId: string) {
    const data = await fetchJSONUnknown(`/gamification/dashboard?campgroundId=${campgroundId}`);
    return GamificationDashboardSchema.parse(data);
  },
  async getGamificationSettings(campgroundId: string) {
    const data = await fetchJSONUnknown(`/gamification/settings?campgroundId=${campgroundId}`);
    return GamificationSettingSchema.parse(data);
  },
  async updateGamificationSettings(payload: {
    campgroundId: string;
    enabled: boolean;
    enabledRoles: z.infer<typeof StaffRoleEnum>[];
  }) {
    const res = await fetch(`${API_BASE}/gamification/settings`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", ...scopedHeaders() },
      body: JSON.stringify(payload),
    });
    const data = await parseResponse(res, UnknownSchema);
    return GamificationSettingSchema.parse(data);
  },
  async getGamificationRules(campgroundId: string) {
    const data = await fetchJSONUnknown(`/gamification/rules?campgroundId=${campgroundId}`);
    return z.array(GamificationRuleSchema).parse(data);
  },
  async upsertGamificationRule(payload: {
    campgroundId: string;
    category: z.infer<typeof GamificationCategoryEnum>;
    minXp?: number;
    maxXp?: number;
    defaultXp?: number;
    isActive?: boolean;
  }) {
    const res = await fetch(`${API_BASE}/gamification/rules`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...scopedHeaders() },
      body: JSON.stringify(payload),
    });
    const data = await parseResponse(res, UnknownSchema);
    return GamificationRuleSchema.parse(data);
  },
  async manualGamificationAward(payload: {
    campgroundId: string;
    targetUserId: string;
    category: z.infer<typeof GamificationCategoryEnum>;
    xp?: number;
    reason?: string;
    sourceType?: string;
    sourceId?: string;
    eventKey?: string;
    membershipId?: string;
    metadata?: unknown;
  }) {
    const res = await fetch(`${API_BASE}/gamification/award`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...scopedHeaders() },
      body: JSON.stringify(payload),
    });
    const data = await parseResponse(res, UnknownSchema);
    return GamificationAwardResultSchema.parse(data);
  },
  async listGamificationLevels() {
    const data = await fetchJSONUnknown(`/gamification/levels`);
    return z.array(GamificationLevelSchema).parse(data);
  },
  async getGamificationLeaderboard(campgroundId: string, days?: number) {
    const suffix = days !== undefined ? `&days=${days}` : "";
    const data = await fetchJSONUnknown(
      `/gamification/leaderboard?campgroundId=${campgroundId}${suffix}`,
    );
    return GamificationLeaderboardSchema.parse(data);
  },
  async getGamificationStats(campgroundId: string, days?: number) {
    const suffix = days ? `&days=${days}` : "";
    const data = await fetchJSONUnknown(
      `/gamification/stats?campgroundId=${campgroundId}${suffix}`,
    );
    return GamificationStatsSchema.parse(data);
  },

  async updateReservationGroup(
    id: string,
    payload: { groupId: string | null; role?: "primary" | "member" | null },
  ) {
    const res = await fetch(`${API_BASE}/reservations/${id}/group`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", ...scopedHeaders() },
      body: JSON.stringify(payload),
    });
    const data = await parseResponse(res, UnknownSchema);
    return ReservationWithGroupSchema.parse(data);
  },

  async listBlocks(tenantId: string, state?: string) {
    const qs = new URLSearchParams({ tenantId });
    if (state) qs.set("state", state);
    const data = await fetchJSONUnknown(`/blocks?${qs.toString()}`);
    return z.array(z.unknown()).parse(data);
  },
  async getBlock(blockId: string) {
    const data = await fetchJSONUnknown(`/blocks/${blockId}`);
    return z.unknown().parse(data);
  },
  async createBlock(payload: {
    tenantId: string;
    sites: string[];
    windowStart: string;
    windowEnd: string;
    reason: string;
    lockId: string;
    createdBy: string;
  }) {
    const res = await fetch(`${API_BASE}/blocks`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...scopedHeaders() },
      body: JSON.stringify(payload),
    });
    return parseResponse(res, UnknownSchema);
  },
  async updateBlock(
    blockId: string,
    payload: {
      state?: "active" | "released";
      windowStart?: string;
      windowEnd?: string;
      reason?: string;
    },
  ) {
    const res = await fetch(`${API_BASE}/blocks/${blockId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", ...scopedHeaders() },
      body: JSON.stringify(payload),
    });
    return parseResponse(res, UnknownSchema);
  },
  async releaseBlock(blockId: string) {
    const res = await fetch(`${API_BASE}/blocks/${blockId}/release`, {
      method: "PATCH",
      headers: scopedHeaders(),
    });
    return parseResponse(res, UnknownSchema);
  },

  // ---------------------------------------------------------------------------
  // Phase 1: Dynamic Pricing V2
  // ---------------------------------------------------------------------------
  async getPricingRulesV2(campgroundId: string) {
    const data = await fetchJSONUnknown(`/campgrounds/${campgroundId}/pricing-rules/v2`);
    return z
      .array(
        z.object({
          id: z.string(),
          campgroundId: z.string(),
          name: z.string(),
          type: z.enum(["season", "weekend", "holiday", "event", "demand"]),
          priority: z.number(),
          stackMode: z.enum(["additive", "max", "override"]),
          adjustmentType: z.enum(["percent", "flat"]),
          adjustmentValue: z.coerce.number(), // Prisma Decimal comes as string
          siteClassId: z.string().nullable(),
          calendarRefId: z.string().nullable(),
          demandBandId: z.string().nullable(),
          dowMask: z.array(z.number()).nullable(),
          startDate: z.string().nullable(),
          endDate: z.string().nullable(),
          minRateCap: z.coerce.number().nullable(), // Prisma Decimal comes as string
          maxRateCap: z.coerce.number().nullable(), // Prisma Decimal comes as string
          active: z.boolean(),
          createdAt: z.string(),
          updatedAt: z.string(),
        }),
      )
      .parse(data);
  },
  async createPricingRuleV2(
    campgroundId: string,
    payload: {
      name: string;
      type: "season" | "weekend" | "holiday" | "event" | "demand";
      priority: number;
      stackMode: "additive" | "max" | "override";
      adjustmentType: "percent" | "flat";
      adjustmentValue: number;
      siteClassId?: string | null;
      calendarRefId?: string | null;
      demandBandId?: string | null;
      dowMask?: number[];
      startDate?: string | null;
      endDate?: string | null;
      minRateCap?: number | null;
      maxRateCap?: number | null;
      active?: boolean;
    },
  ) {
    const res = await fetch(`${API_BASE}/campgrounds/${campgroundId}/pricing-rules/v2`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...scopedHeaders() },
      body: JSON.stringify(payload),
    });
    return parseResponse(res, UnknownSchema);
  },
  async updatePricingRuleV2(
    id: string,
    payload: Partial<{
      name: string;
      type: "season" | "weekend" | "holiday" | "event" | "demand";
      priority: number;
      stackMode: "additive" | "max" | "override";
      adjustmentType: "percent" | "flat";
      adjustmentValue: number;
      siteClassId: string | null;
      calendarRefId: string | null;
      demandBandId: string | null;
      dowMask: number[];
      startDate: string | null;
      endDate: string | null;
      minRateCap: number | null;
      maxRateCap: number | null;
      active: boolean;
    }>,
    campgroundId?: string,
  ) {
    const path = withCampgroundId(`/pricing-rules/v2/${id}`, campgroundId);
    const res = await fetch(`${API_BASE}${path}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", ...scopedHeaders() },
      body: JSON.stringify(payload),
    });
    return parseResponse(res, UnknownSchema);
  },
  async deletePricingRuleV2(id: string, campgroundId?: string) {
    const path = withCampgroundId(`/pricing-rules/v2/${id}`, campgroundId);
    const res = await fetch(`${API_BASE}${path}`, {
      method: "DELETE",
      headers: scopedHeaders(),
    });
    return parseResponse(res, UnknownSchema);
  },

  // ---------------------------------------------------------------------------
  // Phase 1: Deposit Policies
  // ---------------------------------------------------------------------------
  async getDepositPolicies(campgroundId: string) {
    const data = await fetchJSONUnknown(`/campgrounds/${campgroundId}/deposit-policies`);
    return z
      .array(
        z.object({
          id: z.string(),
          campgroundId: z.string(),
          name: z.string(),
          strategy: z.enum(["first_night", "percent", "fixed"]),
          value: z.number(),
          applyTo: z.enum(["lodging_only", "lodging_and_fees"]),
          dueTiming: z.enum(["at_booking", "before_arrival"]),
          dueHoursBeforeArrival: z.number().nullable(),
          minCap: z.number().nullable(),
          maxCap: z.number().nullable(),
          siteClassId: z.string().nullable(),
          retryPlanId: z.string().nullable(),
          active: z.boolean(),
          version: z.number(),
          createdAt: z.string(),
          updatedAt: z.string(),
        }),
      )
      .parse(data);
  },
  async createDepositPolicy(
    campgroundId: string,
    payload: {
      name: string;
      strategy: "first_night" | "percent" | "fixed";
      value: number;
      applyTo?: "lodging_only" | "lodging_and_fees";
      dueTiming?: "at_booking" | "before_arrival";
      dueHoursBeforeArrival?: number | null;
      minCap?: number | null;
      maxCap?: number | null;
      siteClassId?: string | null;
      retryPlanId?: string | null;
      active?: boolean;
    },
  ) {
    const res = await fetch(`${API_BASE}/campgrounds/${campgroundId}/deposit-policies`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...scopedHeaders() },
      body: JSON.stringify(payload),
    });
    return parseResponse(res, UnknownSchema);
  },
  async updateDepositPolicy(
    id: string,
    payload: Partial<{
      name: string;
      strategy: "first_night" | "percent" | "fixed";
      value: number;
      applyTo: "lodging_only" | "lodging_and_fees";
      dueTiming: "at_booking" | "before_arrival";
      dueHoursBeforeArrival: number | null;
      minCap: number | null;
      maxCap: number | null;
      siteClassId: string | null;
      retryPlanId: string | null;
      active: boolean;
    }>,
    campgroundId?: string,
  ) {
    const path = withCampgroundId(`/deposit-policies/${id}`, campgroundId);
    const res = await fetch(`${API_BASE}${path}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", ...scopedHeaders() },
      body: JSON.stringify(payload),
    });
    return parseResponse(res, UnknownSchema);
  },
  async deleteDepositPolicy(id: string, campgroundId?: string) {
    const path = withCampgroundId(`/deposit-policies/${id}`, campgroundId);
    const res = await fetch(`${API_BASE}${path}`, {
      method: "DELETE",
      headers: scopedHeaders(),
    });
    return parseResponse(res, UnknownSchema);
  },

  // ---------------------------------------------------------------------------
  // Phase 1: Upsells / Add-ons
  // ---------------------------------------------------------------------------
  async getUpsellItems(campgroundId: string) {
    const data = await fetchJSONUnknown(`/campgrounds/${campgroundId}/upsells`);
    return z
      .array(
        z.object({
          id: z.string(),
          campgroundId: z.string(),
          name: z.string(),
          description: z.string().nullable(),
          priceType: z.enum(["flat", "per_night", "per_guest", "per_site"]),
          priceCents: z.number(),
          siteClassId: z.string().nullable(),
          taxCode: z.string().nullable(),
          inventoryTracking: z.boolean(),
          inventoryQty: z.number().nullable(),
          active: z.boolean(),
          createdAt: z.string(),
          updatedAt: z.string(),
        }),
      )
      .parse(data);
  },
  async createUpsellItem(
    campgroundId: string,
    payload: {
      name: string;
      description?: string | null;
      priceType: "flat" | "per_night" | "per_guest" | "per_site";
      priceCents: number;
      siteClassId?: string | null;
      taxCode?: string | null;
      inventoryTracking?: boolean;
      inventoryQty?: number | null;
      active?: boolean;
    },
  ) {
    const res = await fetch(`${API_BASE}/campgrounds/${campgroundId}/upsells`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...scopedHeaders() },
      body: JSON.stringify(payload),
    });
    return parseResponse(res, UnknownSchema);
  },
  async updateUpsellItem(
    id: string,
    payload: Partial<{
      name: string;
      description: string | null;
      priceType: "flat" | "per_night" | "per_guest" | "per_site";
      priceCents: number;
      siteClassId: string | null;
      taxCode: string | null;
      inventoryTracking: boolean;
      inventoryQty: number | null;
      active: boolean;
    }>,
    campgroundId?: string,
  ) {
    const path = withCampgroundId(`/upsells/${id}`, campgroundId);
    const res = await fetch(`${API_BASE}${path}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", ...scopedHeaders() },
      body: JSON.stringify(payload),
    });
    return parseResponse(res, UnknownSchema);
  },
  async deleteUpsellItem(id: string, campgroundId?: string) {
    const path = withCampgroundId(`/upsells/${id}`, campgroundId);
    const res = await fetch(`${API_BASE}${path}`, {
      method: "DELETE",
      headers: scopedHeaders(),
    });
    return parseResponse(res, UnknownSchema);
  },

  // ---------------------------------------------------------------------------
  // Phase 2: Tasks / Housekeeping
  // ---------------------------------------------------------------------------
  async getTasks(
    campgroundId: string,
    filters?: {
      siteId?: string;
      state?: "pending" | "in_progress" | "done" | "failed" | "expired";
      slaStatus?: "on_track" | "at_risk" | "breached";
      type?: "turnover" | "inspection" | "maintenance" | "custom";
      assignedToUserId?: string;
    },
  ) {
    const params = new URLSearchParams({ tenantId: campgroundId });
    if (filters?.siteId) params.set("siteId", filters.siteId);
    if (filters?.state) params.set("state", filters.state);
    if (filters?.slaStatus) params.set("slaStatus", filters.slaStatus);
    if (filters?.type) params.set("type", filters.type);
    if (filters?.assignedToUserId) params.set("assignedToUserId", filters.assignedToUserId);
    const data = await fetchJSONUnknown(`/tasks?${params.toString()}`);
    return z
      .array(
        z.object({
          id: z.string(),
          tenantId: z.string(),
          type: z.enum(["turnover", "inspection", "maintenance", "custom"]),
          state: z.enum(["pending", "in_progress", "done", "failed", "expired"]),
          priority: z.string().nullable(),
          siteId: z.string(),
          reservationId: z.string().nullable(),
          assignedToUserId: z.string().nullable(),
          assignedToTeamId: z.string().nullable(),
          slaDueAt: z.string().nullable(),
          slaStatus: z.enum(["on_track", "at_risk", "breached"]),
          checklist: z.unknown().nullable(),
          photos: z.unknown().nullable(),
          notes: z.string().nullable(),
          source: z.string().nullable(),
          createdBy: z.string(),
          createdAt: z.string(),
          updatedAt: z.string(),
        }),
      )
      .parse(data);
  },
  async getTask(id: string) {
    const data = await fetchJSONUnknown(`/tasks/${id}`);
    return z
      .object({
        id: z.string(),
        tenantId: z.string(),
        type: z.enum(["turnover", "inspection", "maintenance", "custom"]),
        state: z.enum(["pending", "in_progress", "done", "failed", "expired"]),
        priority: z.string().nullable(),
        siteId: z.string(),
        reservationId: z.string().nullable(),
        assignedToUserId: z.string().nullable(),
        assignedToTeamId: z.string().nullable(),
        slaDueAt: z.string().nullable(),
        slaStatus: z.enum(["on_track", "at_risk", "breached"]),
        checklist: z.unknown().nullable(),
        photos: z.unknown().nullable(),
        notes: z.string().nullable(),
        source: z.string().nullable(),
        createdBy: z.string(),
        createdAt: z.string(),
        updatedAt: z.string(),
      })
      .parse(data);
  },
  async createTask(
    campgroundId: string,
    payload: {
      type: string;
      siteId: string;
      reservationId?: string;
      priority?: string;
      slaDueAt?: string;
      checklist?: unknown;
      assignedToUserId?: string;
      assignedToTeamId?: string;
      notes?: string;
      source?: string;
      createdBy: string;
    },
  ) {
    const res = await fetch(`${API_BASE}/tasks`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...scopedHeaders() },
      body: JSON.stringify({ ...payload, tenantId: campgroundId }),
    });
    return parseResponse(res, UnknownSchema);
  },
  async updateTask(
    id: string,
    payload: Partial<{
      state: "pending" | "in_progress" | "blocked" | "done" | "failed" | "expired";
      priority: string;
      slaDueAt: string;
      assignedToUserId: string;
      assignedToTeamId: string;
      checklist: unknown;
      photos: unknown;
      notes: string;
    }>,
  ) {
    const res = await fetch(`${API_BASE}/tasks/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", ...scopedHeaders() },
      body: JSON.stringify(payload),
    });
    return parseResponse(res, UnknownSchema);
  },
  async deleteTask(id: string) {
    const res = await fetch(`${API_BASE}/tasks/${id}`, {
      method: "DELETE",
      headers: scopedHeaders(),
    });
    return parseResponse(res, UnknownSchema);
  },

  // ---------------------------------------------------------------------------
  // Phase 2: Groups
  // ---------------------------------------------------------------------------
  async getGroups(campgroundId: string) {
    const data = await fetchJSONUnknown(`/groups?tenantId=${campgroundId}`);
    return z
      .array(
        z.object({
          id: z.string(),
          tenantId: z.string(),
          sharedPayment: z.boolean(),
          sharedComm: z.boolean(),
          primaryReservationId: z.string().nullable(),
          reservationCount: z.number(),
          createdAt: z.string(),
          updatedAt: z.string(),
        }),
      )
      .parse(data);
  },
  async getGroup(id: string) {
    const data = await fetchJSONUnknown(`/groups/${id}`);
    return z
      .object({
        id: z.string(),
        tenantId: z.string(),
        sharedPayment: z.boolean(),
        sharedComm: z.boolean(),
        primaryReservationId: z.string().nullable(),
        createdAt: z.string(),
        updatedAt: z.string(),
        reservations: z.array(
          z.object({
            id: z.string(),
            groupRole: z.enum(["primary", "member"]).nullable(),
            arrivalDate: z.string(),
            departureDate: z.string(),
            status: z.string(),
            guestId: z.string(),
            siteId: z.string(),
            guest: z
              .object({
                id: z.string(),
                primaryFirstName: z.string().nullable(),
                primaryLastName: z.string().nullable(),
                email: z.string().nullable(),
              })
              .nullable(),
            site: z
              .object({
                id: z.string(),
                name: z.string(),
                siteNumber: z.string(),
              })
              .nullable(),
          }),
        ),
      })
      .parse(data);
  },
  async createGroup(
    campgroundId: string,
    payload: {
      name?: string;
      sharedPayment?: boolean;
      sharedComm?: boolean;
      reservationIds?: string[];
      primaryReservationId?: string;
    },
  ) {
    const res = await fetch(`${API_BASE}/groups`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...scopedHeaders() },
      body: JSON.stringify({ ...payload, tenantId: campgroundId }),
    });
    return parseResponse(res, UnknownSchema);
  },
  async updateGroup(
    id: string,
    payload: Partial<{
      sharedPayment: boolean;
      sharedComm: boolean;
      addReservationIds: string[];
      removeReservationIds: string[];
    }>,
  ) {
    const res = await fetch(`${API_BASE}/groups/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", ...scopedHeaders() },
      body: JSON.stringify(payload),
    });
    return parseResponse(res, UnknownSchema);
  },
  async deleteGroup(id: string) {
    const res = await fetch(`${API_BASE}/groups/${id}`, {
      method: "DELETE",
      headers: scopedHeaders(),
    });
    return parseResponse(res, UnknownSchema);
  },

  // ---------------------------------------------------------------------------
  // Phase 2: Self Check-in/out
  // ---------------------------------------------------------------------------
  async getCheckinStatus(reservationId: string) {
    const data = await fetchJSONUnknown(`/reservations/${reservationId}/checkin-status`);
    return z
      .object({
        id: z.string(),
        checkInStatus: z.enum(["pending", "in_progress", "completed", "failed"]).nullable(),
        checkOutStatus: z.enum(["pending", "in_progress", "completed", "failed"]).nullable(),
        siteReady: z.boolean(),
        siteReadyAt: z.string().nullable(),
        selfCheckInAt: z.string().nullable(),
        selfCheckOutAt: z.string().nullable(),
        idVerificationRequired: z.boolean(),
        waiverRequired: z.boolean(),
        paymentRequired: z.boolean(),
        lateArrivalFlag: z.boolean(),
        paymentStatus: z.string().nullable(),
        balanceAmount: z.number(),
      })
      .parse(data);
  },
  async selfCheckin(
    reservationId: string,
    options?: { lateArrival?: boolean; override?: boolean },
  ) {
    const res = await fetch(`${API_BASE}/reservations/${reservationId}/self-checkin`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...scopedHeaders() },
      body: JSON.stringify(options ?? {}),
    });
    return parseResponse(
      res,
      z.object({
        status: z.enum(["completed", "failed"]),
        reason: z.string().optional(),
        selfCheckInAt: z.string().optional(),
      }),
    );
  },
  async selfCheckout(
    reservationId: string,
    options?: {
      damageNotes?: string;
      damagePhotos?: string[];
      override?: boolean;
    },
  ) {
    const res = await fetch(`${API_BASE}/reservations/${reservationId}/self-checkout`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...scopedHeaders() },
      body: JSON.stringify(options ?? {}),
    });
    return parseResponse(
      res,
      z.object({
        status: z.enum(["completed", "failed"]),
        reason: z.string().optional(),
        selfCheckOutAt: z.string().optional(),
      }),
    );
  },

  // ---------------------------------------------------------------------------
  // Phase 3: Dashboard Metrics & Analytics
  // ---------------------------------------------------------------------------
  async getDashboardMetrics(campgroundId: string, days: number = 30) {
    const data = await fetchJSONUnknown(
      `/campgrounds/${campgroundId}/reports/dashboard-metrics?days=${days}`,
    );
    return z
      .object({
        period: z.object({
          start: z.string(),
          end: z.string(),
          days: z.number(),
        }),
        revenue: z.object({
          totalCents: z.number(),
          adrCents: z.number(),
          revparCents: z.number(),
          changePct: z.number(),
        }),
        occupancy: z.object({
          pct: z.number(),
          totalNights: z.number(),
          availableNights: z.number(),
        }),
        balances: z.object({
          outstandingCents: z.number(),
        }),
        today: z.object({
          arrivals: z.number(),
          departures: z.number(),
        }),
        futureBookings: z.number(),
        totalSites: z.number(),
      })
      .parse(data);
  },
  async getRevenueTrend(campgroundId: string, months: number = 12) {
    const data = await fetchJSONUnknown(
      `/campgrounds/${campgroundId}/reports/revenue-trend?months=${months}`,
    );
    return z
      .array(
        z.object({
          month: z.string(),
          year: z.number(),
          revenueCents: z.number(),
          bookings: z.number(),
        }),
      )
      .parse(data);
  },
  async getOccupancyForecast(campgroundId: string, days: number = 30) {
    const data = await fetchJSONUnknown(
      `/campgrounds/${campgroundId}/reports/occupancy-forecast?days=${days}`,
    );
    return z
      .array(
        z.object({
          date: z.string(),
          occupiedSites: z.number(),
          totalSites: z.number(),
          pct: z.number(),
        }),
      )
      .parse(data);
  },
  async getTaskMetrics(campgroundId: string) {
    const data = await fetchJSONUnknown(`/campgrounds/${campgroundId}/reports/task-metrics`);
    return z
      .object({
        pending: z.number(),
        inProgress: z.number(),
        breached: z.number(),
        atRisk: z.number(),
        completedToday: z.number(),
      })
      .parse(data);
  },

  // ---------------------------------------------------------------------------
  // Phase 4: Enhanced Waitlist
  // ---------------------------------------------------------------------------
  async getWaitlistStats(campgroundId: string) {
    const data = await fetchJSONUnknown(`/campgrounds/${campgroundId}/waitlist/stats`);
    return z
      .object({
        active: z.number(),
        offered: z.number(),
        converted: z.number(),
        expired: z.number(),
        total: z.number(),
      })
      .parse(data);
  },
  async updateWaitlistEntry(
    id: string,
    payload: Partial<{
      contactName: string;
      contactEmail: string;
      contactPhone: string;
      notes: string;
      siteId: string;
      siteTypeId: string;
      arrivalDate: string;
      departureDate: string;
      priority: number;
      autoOffer: boolean;
      maxPrice: number;
      flexibleDates: boolean;
      flexibleDays: number;
    }>,
  ) {
    const res = await fetch(`${API_BASE}/waitlist/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", ...scopedHeaders() },
      body: JSON.stringify(payload),
    });
    return parseResponse(res, UnknownSchema);
  },

  // ---------------------------------------------------------------------------
  // Phase 4: Stored Value (Gift Cards / Credits)
  // ---------------------------------------------------------------------------
  async getStoredValueAccounts(campgroundId: string) {
    const data = await fetchJSONUnknown(`/stored-value/campgrounds/${campgroundId}/accounts`);
    return z.array(StoredValueAccountSchema).parse(data);
  },
  async getStoredValueLedger(campgroundId: string) {
    const data = await fetchJSONUnknown(`/stored-value/campgrounds/${campgroundId}/ledger`);
    return z.array(StoredValueLedgerSchema).parse(data);
  },
  async issueStoredValue(payload: {
    tenantId: string;
    amountCents: number;
    currency: string;
    expiresAt?: string;
    customerId?: string;
    code?: string;
    type: "gift" | "credit";
    scopeType?: "campground" | "organization" | "global";
    scopeId?: string;
    metadata?: Record<string, unknown>;
  }) {
    const res = await fetch(`${API_BASE}/stored-value/issue`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...scopedHeaders() },
      body: JSON.stringify(payload),
    });
    const data = await parseResponse(res, UnknownSchema);
    return StoredValueIssueResponseSchema.parse(data);
  },
  async redeemStoredValue(payload: {
    accountId?: string;
    code?: string;
    pin?: string;
    amountCents: number;
    currency: string;
    redeemCampgroundId?: string;
    referenceType: string;
    referenceId: string;
    channel?: string;
  }) {
    const res = await fetch(`${API_BASE}/stored-value/redeem`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...scopedHeaders() },
      body: JSON.stringify(payload),
    });
    const data = await parseResponse(res, UnknownSchema);
    return StoredValueRedeemResponseSchema.parse(data);
  },
  async adjustStoredValue(payload: { accountId: string; deltaCents: number; reason: string }) {
    const res = await fetch(`${API_BASE}/stored-value/adjust`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...scopedHeaders() },
      body: JSON.stringify(payload),
    });
    const data = await parseResponse(res, UnknownSchema);
    return StoredValueAdjustResponseSchema.parse(data);
  },

  // ---------------------------------------------------------------------------
  // Phase 4: Notification Triggers
  // ---------------------------------------------------------------------------
  async getNotificationTriggers(campgroundId: string) {
    const data = await fetchJSONUnknown(`/campgrounds/${campgroundId}/notification-triggers`);
    return z
      .array(
        z.object({
          id: z.string(),
          campgroundId: z.string(),
          event: z.string(),
          channel: z.enum(["email", "sms", "both"]),
          enabled: z.boolean(),
          templateId: z.string().nullable(),
          delayMinutes: z.number(),
          conditions: z.unknown().nullable(),
          createdAt: z.string(),
          updatedAt: z.string(),
          template: z
            .object({
              id: z.string(),
              name: z.string(),
              subject: z.string().nullable(),
            })
            .nullable()
            .optional(),
        }),
      )
      .parse(data);
  },
  async createNotificationTrigger(
    campgroundId: string,
    payload: {
      event: string;
      channel: "email" | "sms" | "both";
      enabled?: boolean;
      templateId?: string;
      delayMinutes?: number;
      conditions?: Record<string, unknown>;
    },
  ) {
    const res = await fetch(`${API_BASE}/campgrounds/${campgroundId}/notification-triggers`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...scopedHeaders() },
      body: JSON.stringify(payload),
    });
    return parseResponse(res, UnknownSchema);
  },
  async updateNotificationTrigger(
    id: string,
    payload: Partial<{
      event: string;
      channel: "email" | "sms" | "both";
      enabled: boolean;
      templateId: string | null;
      delayMinutes: number;
      conditions: Record<string, unknown> | null;
    }>,
  ) {
    const res = await fetch(`${API_BASE}/notification-triggers/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", ...scopedHeaders() },
      body: JSON.stringify(payload),
    });
    return parseResponse(res, UnknownSchema);
  },
  async deleteNotificationTrigger(id: string) {
    const res = await fetch(`${API_BASE}/notification-triggers/${id}`, {
      method: "DELETE",
      headers: scopedHeaders(),
    });
    return parseResponse(res, UnknownSchema);
  },
  async testNotificationTrigger(id: string, email: string) {
    const res = await fetch(`${API_BASE}/notification-triggers/${id}/test`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...scopedHeaders() },
      body: JSON.stringify({ email }),
    });
    return parseResponse(res, UnknownSchema);
  },

  // ---------------------------------------------------------------------------
  // Incidents & COI
  // ---------------------------------------------------------------------------
  async listIncidents(campgroundId: string) {
    const res = await fetch(`${API_BASE}/incidents?campgroundId=${campgroundId}`, {
      headers: scopedHeaders(),
    });
    const data = await parseResponse(res, UnknownSchema);
    return z.array(IncidentSchema).parse(data);
  },
  async createIncident(payload: {
    campgroundId: string;
    reservationId?: string;
    guestId?: string;
    type: string;
    severity?: string;
    notes?: string;
    photos?: string[];
    witnesses?: unknown;
    occurredAt?: string;
  }) {
    const res = await fetch(`${API_BASE}/incidents`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...scopedHeaders() },
      body: JSON.stringify(payload),
    });
    const data = await parseResponse(res, UnknownSchema);
    return IncidentSchema.parse(data);
  },
  async updateIncident(
    id: string,
    payload: Partial<{
      type: string;
      status: string;
      severity: string;
      notes: string;
      photos: string[];
      witnesses: unknown;
      occurredAt: string;
    }>,
  ) {
    const res = await fetch(`${API_BASE}/incidents/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", ...scopedHeaders() },
      body: JSON.stringify(payload),
    });
    const data = await parseResponse(res, UnknownSchema);
    return IncidentSchema.parse(data);
  },
  async closeIncident(id: string, payload?: { resolutionNotes?: string; claimId?: string }) {
    const res = await fetch(`${API_BASE}/incidents/${id}/close`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...scopedHeaders() },
      body: JSON.stringify(payload ?? {}),
    });
    const data = await parseResponse(res, UnknownSchema);
    return IncidentSchema.parse(data);
  },
  async addIncidentEvidence(
    id: string,
    payload: {
      type?: string;
      url?: string;
      storageKey?: string;
      description?: string;
      uploadedBy?: string;
    },
  ) {
    const res = await fetch(`${API_BASE}/incidents/${id}/evidence`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...scopedHeaders() },
      body: JSON.stringify(payload),
    });
    const data = await parseResponse(res, UnknownSchema);
    return IncidentEvidenceSchema.parse(data);
  },
  async linkIncidentClaim(
    id: string,
    payload: { claimId: string; provider?: string; notes?: string },
  ) {
    const res = await fetch(`${API_BASE}/incidents/${id}/claim`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...scopedHeaders() },
      body: JSON.stringify(payload),
    });
    const data = await parseResponse(res, UnknownSchema);
    return IncidentSchema.parse(data);
  },
  async setIncidentReminder(id: string, payload: { reminderAt: string; message?: string }) {
    const res = await fetch(`${API_BASE}/incidents/${id}/reminder`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...scopedHeaders() },
      body: JSON.stringify(payload),
    });
    const data = await parseResponse(res, UnknownSchema);
    return IncidentSchema.parse(data);
  },
  async createIncidentTask(
    id: string,
    payload: { title: string; dueAt?: string; reminderAt?: string; assignedTo?: string },
  ) {
    const res = await fetch(`${API_BASE}/incidents/${id}/tasks`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...scopedHeaders() },
      body: JSON.stringify(payload),
    });
    const data = await parseResponse(res, UnknownSchema);
    return IncidentTaskSchema.parse(data);
  },
  async updateIncidentTask(
    id: string,
    taskId: string,
    payload: Partial<{ status: string; dueAt: string; reminderAt: string; assignedTo: string }>,
  ) {
    const res = await fetch(`${API_BASE}/incidents/${id}/tasks/${taskId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", ...scopedHeaders() },
      body: JSON.stringify(payload),
    });
    const data = await parseResponse(res, UnknownSchema);
    return IncidentTaskSchema.parse(data);
  },
  async attachIncidentCoi(
    id: string,
    payload: {
      fileUrl: string;
      provider?: string;
      policyNumber?: string;
      coverageType?: string;
      effectiveDate?: string;
      expiresAt?: string;
      uploadedBy?: string;
    },
  ) {
    const res = await fetch(`${API_BASE}/incidents/${id}/coi`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...scopedHeaders() },
      body: JSON.stringify(payload),
    });
    const data = await parseResponse(res, UnknownSchema);
    return CertificateOfInsuranceSchema.parse(data);
  },
  async getIncidentReport(campgroundId: string, format: "json" | "csv" = "json") {
    const url = `${API_BASE}/incidents/report/export?campgroundId=${campgroundId}${format === "csv" ? "&format=csv" : ""}`;
    const res = await fetch(url, { headers: scopedHeaders() });
    if (format === "csv") {
      return res.text();
    }
    const data = await parseResponse(res, UnknownSchema);
    return IncidentReportSchema.parse(data);
  },

  // ---------------------------------------------------------------------------
  // Utilities & Billing
  // ---------------------------------------------------------------------------
  async listUtilityMeters(campgroundId: string) {
    const data = await fetchJSONUnknown(`/campgrounds/${campgroundId}/meters`);
    return z.array(UtilityMeterSchema).parse(data);
  },
  async createUtilityMeter(
    campgroundId: string,
    payload: {
      siteId: string;
      type: string;
      serialNumber?: string;
      ratePlanId?: string;
      billingMode?: string;
      billTo?: string;
      multiplier?: number;
      autoEmail?: boolean;
    },
  ) {
    const res = await fetch(`${API_BASE}/campgrounds/${campgroundId}/meters`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...scopedHeaders() },
      body: JSON.stringify(payload),
    });
    const data = await parseResponse(res, UnknownSchema);
    return UtilityMeterSchema.parse(data);
  },
  async addUtilityMeterRead(
    meterId: string,
    payload: {
      readingValue: number;
      readAt: string;
      readBy?: string;
      note?: string;
      source?: string;
    },
    campgroundId?: string,
  ) {
    const path = withCampgroundId(`/meters/${meterId}/reads`, campgroundId);
    const res = await fetch(`${API_BASE}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...scopedHeaders() },
      body: JSON.stringify(payload),
    });
    const data = await parseResponse(res, UnknownSchema);
    return UtilityMeterReadSchema.parse(data);
  },
  async importUtilityMeterReads(payload: {
    campgroundId: string;
    reads: Array<{
      meterId: string;
      readingValue: number;
      readAt: string;
      note?: string;
      readBy?: string;
      source?: string;
    }>;
  }) {
    const res = await fetch(`${API_BASE}/meters/import`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...scopedHeaders() },
      body: JSON.stringify(payload),
    });
    return parseResponse(
      res,
      z.object({
        imported: z.number(),
        skipped: z.number(),
      }),
    );
  },
  async listUtilityRatePlans(campgroundId: string) {
    const data = await fetchJSONUnknown(`/campgrounds/${campgroundId}/utility-rate-plans`);
    return z.array(UtilityRatePlanSchema).parse(data);
  },
  async updateUtilityMeter(
    meterId: string,
    payload: {
      ratePlanId?: string | null;
      billingMode?: string;
      billTo?: string;
      multiplier?: number;
      autoEmail?: boolean;
      active?: boolean;
      serialNumber?: string | null;
    },
    campgroundId?: string,
  ) {
    const path = withCampgroundId(`/meters/${meterId}`, campgroundId);
    const res = await fetch(`${API_BASE}${path}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", ...scopedHeaders() },
      body: JSON.stringify(payload),
    });
    const data = await parseResponse(res, UnknownSchema);
    return UtilityMeterSchema.parse(data);
  },
  async billUtilityMeter(meterId: string, campgroundId?: string) {
    const path = withCampgroundId(`/meters/${meterId}/bill`, campgroundId);
    const res = await fetch(`${API_BASE}${path}`, {
      method: "POST",
      headers: { ...scopedHeaders() },
    });
    return parseResponse(res, UnknownSchema);
  },
  async seedMetersForSiteClass(siteClassId: string, campgroundId?: string) {
    const path = withCampgroundId(`/site-classes/${siteClassId}/meters/seed`, campgroundId);
    const res = await fetch(`${API_BASE}${path}`, {
      method: "POST",
      headers: { ...scopedHeaders() },
    });
    return parseResponse(
      res,
      z.object({
        created: z.number(),
        totalSites: z.number(),
      }),
    );
  },
  async listUtilityMeterReads(
    meterId: string,
    params?: { start?: string; end?: string },
    campgroundId?: string,
  ) {
    const qs = new URLSearchParams();
    if (params?.start) qs.set("start", params.start);
    if (params?.end) qs.set("end", params.end);
    const path = withCampgroundId(
      `/meters/${meterId}/reads${qs.toString() ? `?${qs.toString()}` : ""}`,
      campgroundId,
    );
    const data = await fetchJSONUnknown(path);
    return z.array(UtilityMeterReadSchema).parse(data);
  },
  async listInvoicesByReservation(reservationId: string, campgroundId?: string) {
    const path = withCampgroundId(`/reservations/${reservationId}/invoices`, campgroundId);
    const data = await fetchJSONUnknown(path);
    return z.array(InvoiceSchema).parse(data);
  },
  async getInvoice(invoiceId: string, campgroundId?: string) {
    const path = withCampgroundId(`/invoices/${invoiceId}`, campgroundId);
    const data = await fetchJSONUnknown(path);
    return InvoiceSchema.parse(data);
  },
  async generateInvoiceForCycle(cycleId: string, campgroundId?: string) {
    const path = withCampgroundId(`/billing/cycles/${cycleId}/generate`, campgroundId);
    const res = await fetch(`${API_BASE}${path}`, {
      method: "POST",
      headers: { ...scopedHeaders() },
    });
    const data = await parseResponse(res, UnknownSchema);
    return InvoiceSchema.parse(data);
  },
  async runLateFees(campgroundId?: string) {
    const path = withCampgroundId(`/billing/late-fees/run`, campgroundId);
    const res = await fetch(`${API_BASE}${path}`, {
      method: "POST",
      headers: scopedHeaders(),
    });
    return parseResponse(res, UnknownSchema);
  },
  async uploadCampgroundMap(
    campgroundId: string,
    payload: { url?: string; dataUrl?: string; contentType?: string; filename?: string },
  ) {
    const res = await fetch(`${API_BASE}/campgrounds/${campgroundId}/map`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...scopedHeaders() },
      body: JSON.stringify(payload),
    });
    return parseResponse(res, z.object({ url: z.string() }));
  },
  // Developer API
  async listApiClients(campgroundId: string) {
    const qs = new URLSearchParams({ campgroundId });
    const data = await fetchJSONUnknown(`/developer/clients?${qs.toString()}`);
    const ApiClientSchema = z.object({
      id: z.string(),
      name: z.string(),
      clientId: z.string(),
      isActive: z.boolean(),
      scopes: z.array(z.string()).default([]),
      createdAt: z.string(),
      lastUsedAt: z.string().nullable().optional(),
    });
    return z.array(ApiClientSchema).parse(data);
  },

  async createApiClient(campgroundId: string, name: string) {
    const res = await fetch(`${API_BASE}/developer/clients`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...scopedHeaders() },
      body: JSON.stringify({ campgroundId, name, scopes: [] }),
    });
    return parseResponse(
      res,
      z.object({
        client: z.object({
          id: z.string(),
          name: z.string(),
          clientId: z.string(),
          isActive: z.boolean(),
          scopes: z.array(z.string()).default([]),
          createdAt: z.string(),
          lastUsedAt: z.string().nullable().optional(),
        }),
        clientSecret: z.string(),
      }),
    );
  },

  async rotateApiClientSecret(clientId: string, campgroundId?: string) {
    const path = withCampgroundId(`/developer/clients/${clientId}/rotate`, campgroundId);
    const res = await fetch(`${API_BASE}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...scopedHeaders() },
    });
    return parseResponse(
      res,
      z.object({
        client: z.object({
          id: z.string(),
          name: z.string(),
          clientId: z.string(),
          isActive: z.boolean(),
          scopes: z.array(z.string()).default([]),
          createdAt: z.string(),
          lastUsedAt: z.string().nullable().optional(),
        }),
        clientSecret: z.string(),
      }),
    );
  },

  async toggleApiClient(clientId: string, isActive: boolean, campgroundId?: string) {
    const path = withCampgroundId(`/developer/clients/${clientId}/toggle`, campgroundId);
    const res = await fetch(`${API_BASE}${path}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", ...scopedHeaders() },
      body: JSON.stringify({ isActive }),
    });
    return parseResponse(res, UnknownSchema);
  },

  async deleteApiClient(clientId: string, campgroundId?: string) {
    const path = withCampgroundId(`/developer/clients/${clientId}`, campgroundId);
    const res = await fetch(`${API_BASE}${path}`, {
      method: "DELETE",
      headers: { ...scopedHeaders() },
    });
    return parseResponse(res, UnknownSchema);
  },

  // Webhooks
  async listWebhooks(campgroundId: string) {
    const qs = new URLSearchParams({ campgroundId });
    const res = await fetch(`${API_BASE}/developer/webhooks?${qs.toString()}`, {
      headers: { ...scopedHeaders() },
    });
    const data = await parseResponse(res, UnknownArraySchema);
    return z.array(WebhookEndpointSchema).parse(data);
  },

  async createWebhook(
    campgroundId: string,
    payload: { url: string; eventTypes: string[]; description?: string },
  ) {
    const res = await fetch(`${API_BASE}/developer/webhooks`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...scopedHeaders() },
      body: JSON.stringify({ campgroundId, ...payload }),
    });
    return parseResponse(
      res,
      z.object({
        endpoint: UnknownSchema,
        secret: z.string(),
      }),
    );
  },

  async toggleWebhook(id: string, isActive: boolean, campgroundId?: string) {
    const path = withCampgroundId(`/developer/webhooks/${id}/toggle`, campgroundId);
    const res = await fetch(`${API_BASE}${path}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", ...scopedHeaders() },
      body: JSON.stringify({ isActive }),
    });
    return parseResponse(res, UnknownSchema);
  },

  async listWebhookDeliveries(campgroundId: string) {
    const qs = new URLSearchParams({ campgroundId });
    const res = await fetch(`${API_BASE}/developer/webhooks/deliveries?${qs.toString()}`, {
      headers: { ...scopedHeaders() },
    });
    const data = await parseResponse(res, UnknownArraySchema);
    return z.array(WebhookDeliverySchema).parse(data);
  },

  async replayWebhookDelivery(id: string, campgroundId?: string) {
    const path = withCampgroundId(`/developer/webhooks/deliveries/${id}/replay`, campgroundId);
    const res = await fetch(`${API_BASE}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...scopedHeaders() },
    });
    return parseResponse(res, UnknownSchema);
  },

  // IoT
  async getUtilityMeters() {
    const data = await fetchJSONUnknown(`/iot/meters`);
    return z.array(UtilityMeterSchema).parse(data);
  },

  async getSmartLocks() {
    const data = await fetchJSONUnknown(`/iot/locks`);
    return z.array(SmartLockSchema).parse(data);
  },

  async triggerIotSimulation() {
    const res = await fetch(`${API_BASE}/iot/simulate/trigger`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...scopedHeaders() },
    });
    return parseResponse(res, UnknownSchema);
  },

  // AI Settings
  async getAiSettings(campgroundId: string) {
    const data = await fetchJSONUnknown(`/ai/campgrounds/${campgroundId}/settings`);
    return z
      .object({
        id: z.string(),
        name: z.string(),
        aiEnabled: z.boolean(),
        aiReplyAssistEnabled: z.boolean(),
        aiBookingAssistEnabled: z.boolean(),
        aiAnalyticsEnabled: z.boolean(),
        aiForecastingEnabled: z.boolean(),
        aiAnonymizationLevel: z.string(),
        aiProvider: z.string(),
        aiApiKey: z.string().nullable(),
        hasCustomApiKey: z.boolean(),
        aiMonthlyBudgetCents: z.number().nullable(),
        aiTotalTokensUsed: z.number(),
      })
      .parse(data);
  },

  async updateAiSettings(campgroundId: string, settings: Record<string, unknown>) {
    const res = await fetch(`${API_BASE}/ai/campgrounds/${campgroundId}/settings`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", ...scopedHeaders() },
      body: JSON.stringify(settings),
    });
    return parseResponse(res, UnknownSchema);
  },

  async getAiUsage(campgroundId: string) {
    const data = await fetchJSONUnknown(`/ai/campgrounds/${campgroundId}/usage`);
    return z
      .object({
        period: z.object({ days: z.number(), since: z.string() }),
        byFeature: z.array(
          z.object({
            feature: z.string(),
            interactions: z.number(),
            tokensUsed: z.number(),
            costCents: z.number(),
            avgLatencyMs: z.number(),
          }),
        ),
        totals: z.object({
          interactions: z.number(),
          tokensUsed: z.number(),
          costCents: z.number(),
        }),
      })
      .parse(data);
  },

  // AI Sentiment Analysis
  async getSentimentStats(
    campgroundId: string,
    options?: { startDate?: string; endDate?: string },
  ) {
    const params = new URLSearchParams();
    if (options?.startDate) params.set("startDate", options.startDate);
    if (options?.endDate) params.set("endDate", options.endDate);
    const query = params.toString() ? `?${params.toString()}` : "";
    const endpoint = query
      ? `/ai/campgrounds/${campgroundId}/sentiment/range${query}`
      : `/ai/campgrounds/${campgroundId}/sentiment`;
    const data = await fetchJSONUnknown(endpoint);
    return z
      .object({
        total: z.number(),
        breakdown: z.object({ positive: z.number(), neutral: z.number(), negative: z.number() }),
        percentages: z.object({ positive: z.number(), neutral: z.number(), negative: z.number() }),
        urgency: z.object({ critical: z.number(), high: z.number() }),
        needsAttention: z.array(
          z.object({
            id: z.string(),
            type: z.string(),
            subject: z.string().nullable(),
            preview: z.string().nullable(),
            sentiment: z.string().nullable(),
            urgencyLevel: z.string().nullable(),
            detectedIntent: z.string().nullable(),
            createdAt: z.string(),
            guest: z
              .object({
                primaryFirstName: z.string().nullable(),
                primaryLastName: z.string().nullable(),
              })
              .nullable(),
          }),
        ),
      })
      .parse(data);
  },

  async analyzeCommunicationSentiment(communicationId: string) {
    const res = await fetch(`${API_BASE}/ai/communications/${communicationId}/analyze-sentiment`, {
      method: "POST",
      headers: scopedHeaders(),
    });
    return parseResponse(
      res,
      z.union([
        z.object({
          sentiment: z.enum(["positive", "neutral", "negative"]),
          sentimentScore: z.number(),
          urgencyLevel: z.enum(["low", "normal", "high", "critical"]),
          detectedIntent: z.string(),
          confidence: z.number(),
          summary: z.string().optional(),
        }),
        z.null(),
      ]),
    );
  },

  // Charity / Round-Up for Donations
  async getCampgroundCharity(campgroundId: string) {
    const data = await fetchJSONUnknown(`/campgrounds/${campgroundId}/charity`);
    return z
      .object({
        id: z.string(),
        campgroundId: z.string(),
        charityId: z.string(),
        isEnabled: z.boolean(),
        customMessage: z.string().nullable(),
        roundUpType: z.string(),
        roundUpOptions: UnknownRecordSchema.nullable(),
        defaultOptIn: z.boolean(),
        charity: z.object({
          id: z.string(),
          name: z.string(),
          description: z.string().nullable(),
          logoUrl: z.string().nullable(),
          category: z.string().nullable(),
          isVerified: z.boolean(),
        }),
      })
      .nullable()
      .parse(data);
  },

  async calculateRoundUp(campgroundId: string, amountCents: number) {
    const data = await fetchJSONUnknown(
      `/campgrounds/${campgroundId}/charity/calculate-roundup?amountCents=${amountCents}`,
    );
    return z
      .object({
        originalAmountCents: z.number(),
        roundedAmountCents: z.number(),
        donationAmountCents: z.number(),
        charityName: z.string(),
        charityId: z.string(),
      })
      .parse(data);
  },

  async createCharityDonation(
    campgroundId: string,
    payload: {
      reservationId: string;
      charityId: string;
      amountCents: number;
      guestId?: string;
    },
  ) {
    const res = await fetch(`${API_BASE}/campgrounds/${campgroundId}/charity/donations`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...scopedHeaders() },
      body: JSON.stringify(payload),
    });
    return parseResponse(
      res,
      z.object({
        id: z.string(),
        amountCents: z.number(),
        status: z.string(),
      }),
    );
  },

  async listCharities(options?: { category?: string; activeOnly?: boolean }) {
    const params = new URLSearchParams();
    if (options?.category) params.set("category", options.category);
    if (options?.activeOnly !== undefined) params.set("activeOnly", String(options.activeOnly));
    const data = await fetchJSONUnknown(`/charity?${params.toString()}`);
    return z
      .array(
        z.object({
          id: z.string(),
          name: z.string(),
          description: z.string().nullable(),
          logoUrl: z.string().nullable(),
          taxId: z.string().nullable(),
          website: z.string().nullable(),
          category: z.string().nullable(),
          isActive: z.boolean(),
          isVerified: z.boolean(),
          _count: z.object({ campgroundCharities: z.number(), donations: z.number() }),
        }),
      )
      .parse(data);
  },

  async setCampgroundCharity(
    campgroundId: string,
    payload: {
      charityId?: string;
      newCharity?: {
        name: string;
        description?: string;
        taxId?: string;
        website?: string;
      };
      isEnabled?: boolean;
      customMessage?: string;
      roundUpType?: string;
      roundUpOptions?: { values: number[] };
      defaultOptIn?: boolean;
      glCode?: string;
    },
  ) {
    const res = await fetch(`${API_BASE}/campgrounds/${campgroundId}/charity`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", ...scopedHeaders() },
      body: JSON.stringify(payload),
    });
    const data = await parseResponse(res, UnknownSchema);
    return z
      .object({
        id: z.string(),
        campgroundId: z.string(),
        charityId: z.string(),
        isEnabled: z.boolean(),
        customMessage: z.string().nullable(),
        roundUpType: z.string(),
        roundUpOptions: UnknownRecordSchema.nullable(),
        defaultOptIn: z.boolean(),
        charity: z.object({
          id: z.string(),
          name: z.string(),
          description: z.string().nullable(),
          logoUrl: z.string().nullable(),
        }),
      })
      .parse(data);
  },

  async disableCampgroundCharity(campgroundId: string) {
    const res = await fetch(`${API_BASE}/campgrounds/${campgroundId}/charity`, {
      method: "DELETE",
      headers: scopedHeaders(),
    });
    return parseResponse(res, z.object({ isEnabled: z.boolean() }));
  },

  async getCampgroundCharityStats(campgroundId: string, startDate?: string, endDate?: string) {
    const params = new URLSearchParams();
    if (startDate) params.set("startDate", startDate);
    if (endDate) params.set("endDate", endDate);
    const data = await fetchJSONUnknown(
      `/campgrounds/${campgroundId}/charity/stats?${params.toString()}`,
    );
    return z
      .object({
        totalDonations: z.number(),
        totalAmountCents: z.number(),
        donorCount: z.number(),
        optInRate: z.number(),
        averageDonationCents: z.number(),
        byStatus: z.array(
          z.object({
            status: z.string(),
            count: z.number(),
            amountCents: z.number(),
          }),
        ),
      })
      .parse(data);
  },

  async getPlatformCharityStats(startDate?: string, endDate?: string) {
    const params = new URLSearchParams();
    if (startDate) params.set("startDate", startDate);
    if (endDate) params.set("endDate", endDate);
    const data = await fetchJSONUnknown(`/charity/stats/platform?${params.toString()}`);
    return z
      .object({
        totalDonations: z.number(),
        totalAmountCents: z.number(),
        donorCount: z.number(),
        optInRate: z.number(),
        averageDonationCents: z.number(),
        byStatus: z.array(
          z.object({
            status: z.string(),
            count: z.number(),
            amountCents: z.number(),
          }),
        ),
        byCharity: z.array(
          z.object({
            charity: z
              .object({
                id: z.string(),
                name: z.string(),
                logoUrl: z.string().nullable(),
              })
              .optional(),
            count: z.number(),
            amountCents: z.number(),
          }),
        ),
      })
      .parse(data);
  },

  // Platform Stats (public - no auth required)
  async getPlatformStats() {
    const data = await fetchJSONUnknown("/public/platform-stats");
    return z
      .object({
        campgrounds: z.object({
          total: z.number(),
          claimed: z.number(),
          byState: z.array(z.object({ state: z.string(), count: z.number() })),
        }),
        activity: z.object({
          pageViewsToday: z.number(),
          pageViewsThisWeek: z.number(),
          searchesToday: z.number(),
          searchesThisWeek: z.number(),
          uniqueVisitorsToday: z.number(),
        }),
        recentActivity: z.array(
          z.object({
            type: z.enum(["page_view", "search", "booking"]),
            campgroundName: z.string().nullable(),
            campgroundSlug: z.string().nullable(),
            state: z.string().nullable(),
            minutesAgo: z.number(),
          }),
        ),
        topRegions: z.array(
          z.object({
            state: z.string(),
            activityCount: z.number(),
          }),
        ),
      })
      .parse(data);
  },

  // Data Import
  async getImportSchema(campgroundId: string, entityType: string) {
    const data = await fetchJSONUnknown(`/campgrounds/${campgroundId}/import/schema/${entityType}`);
    return z
      .object({
        entityType: z.string(),
        requiredFields: z.array(z.string()),
        optionalFields: z.array(z.string()),
        fieldDescriptions: z.record(z.string()),
        exampleCSV: z.string(),
      })
      .parse(data);
  },

  async getImportTemplate(campgroundId: string, entityType: string) {
    const res = await fetch(
      `${API_BASE}/campgrounds/${campgroundId}/import/template/${entityType}`,
      {
        headers: scopedHeaders(),
      },
    );
    return res.text();
  },

  async detectImportFormat(
    campgroundId: string,
    payload: { csvContent: string; entityType: string },
  ) {
    const res = await fetch(`${API_BASE}/campgrounds/${campgroundId}/import/detect`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...scopedHeaders() },
      body: JSON.stringify(payload),
    });
    return parseResponse(
      res,
      z.object({
        format: z.string(),
        confidence: z.number(),
        headers: z.array(z.string()),
        suggestedMappings: z.array(
          z.object({
            sourceField: z.string(),
            suggestedTarget: z.string(),
            confidence: z.number(),
          }),
        ),
      }),
    );
  },

  async previewImport(
    campgroundId: string,
    payload: {
      csvContent: string;
      entityType: string;
      fieldMappings: Array<{ sourceField: string; targetField: string }>;
    },
  ) {
    const res = await fetch(`${API_BASE}/campgrounds/${campgroundId}/import/preview`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...scopedHeaders() },
      body: JSON.stringify(payload),
    });
    return parseResponse(
      res,
      z.object({
        totalRows: z.number(),
        validRows: z.number(),
        newSites: z.number().optional(),
        updateSites: z.number().optional(),
        newGuests: z.number().optional(),
        updateGuests: z.number().optional(),
        duplicateEmails: z.number().optional(),
        errors: z.array(z.object({ row: z.number(), message: z.string() })),
        warnings: z.array(z.object({ row: z.number(), message: z.string() })),
        preview: z.array(
          z.object({
            rowNumber: z.number(),
            data: UnknownRecordSchema,
            action: z.enum(["create", "update", "skip"]),
            existingSite: z.object({ id: z.string(), siteNumber: z.string() }).optional(),
            existingGuest: z.object({ id: z.string(), email: z.string() }).optional(),
          }),
        ),
      }),
    );
  },

  async executeImport(
    campgroundId: string,
    payload: {
      csvContent: string;
      entityType: string;
      fieldMappings: Array<{ sourceField: string; targetField: string }>;
      updateExisting?: boolean;
    },
  ) {
    const res = await fetch(`${API_BASE}/campgrounds/${campgroundId}/import/execute`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...scopedHeaders() },
      body: JSON.stringify(payload),
    });
    return parseResponse(
      res,
      z.object({
        jobId: z.string(),
        success: z.boolean(),
        created: z.number(),
        updated: z.number(),
        skipped: z.number(),
        errors: z.array(z.object({ row: z.number(), message: z.string() })),
      }),
    );
  },

  async getImportJobStatus(jobId: string) {
    const data = await fetchJSONUnknown(`/import/jobs/${jobId}`);
    return z
      .object({
        id: z.string(),
        campgroundId: z.string(),
        entityType: z.string(),
        format: z.string(),
        status: z.enum(["pending", "processing", "completed", "failed"]),
        totalRows: z.number(),
        processedRows: z.number(),
        createdCount: z.number(),
        updatedCount: z.number(),
        skippedCount: z.number(),
        errorCount: z.number(),
        errors: z.array(z.object({ row: z.number(), message: z.string() })),
        createdAt: z.string(),
        completedAt: z.string().optional(),
      })
      .parse(data);
  },

  // ==================== HOUSEKEEPING ====================

  async getHousekeepingTasks(campgroundId?: string) {
    const query = campgroundId ? `?campgroundId=${campgroundId}` : "";
    const data = await fetchJSONUnknown(`/tasks${query}`);
    return z.array(z.unknown()).parse(data);
  },

  async getHousekeepingStatusStats(campgroundId: string) {
    const data = await fetchJSONUnknown(`/housekeeping/stats?campgroundId=${campgroundId}`);
    return z
      .object({
        total: z.number(),
        byStatus: z.record(z.number()),
      })
      .parse(data);
  },

  async getSiteStatuses(campgroundId?: string) {
    const query = campgroundId ? `?campgroundId=${campgroundId}` : "";
    const data = await fetchJSONUnknown(`/housekeeping/sites${query}`);
    return z.array(z.unknown()).parse(data);
  },

  async updateSiteHousekeepingStatus(siteId: string, status: string) {
    const res = await fetch(`${API_BASE}/housekeeping/sites/${siteId}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", ...scopedHeaders() },
      body: JSON.stringify({ status }),
    });
    return parseResponse(res, UnknownSchema);
  },

  async getDailySchedule(campgroundId: string, date?: string) {
    const query = new URLSearchParams({ campgroundId });
    if (date) query.set("date", date);
    const data = await fetchJSONUnknown(`/housekeeping/schedule/daily?${query.toString()}`);
    return DailyScheduleSchema.parse(data);
  },

  async getStaffWorkload(campgroundId: string, date?: string) {
    const query = new URLSearchParams({ campgroundId });
    if (date) query.set("date", date);
    const data = await fetchJSONUnknown(`/housekeeping/workload?${query.toString()}`);
    return z
      .record(
        z.object({
          total: z.number(),
          completed: z.number(),
          inProgress: z.number(),
          pending: z.number(),
        }),
      )
      .parse(data);
  },

  async getCleaningTemplates(campgroundId: string) {
    const data = await fetchJSONUnknown(`/housekeeping/templates?campgroundId=${campgroundId}`);
    return z.array(z.unknown()).parse(data);
  },

  async createCleaningTemplate(payload: {
    campgroundId: string;
    taskType: string;
    siteType?: string;
    name: string;
    estimatedMinutes: number;
    checklist: unknown;
    suppliesNeeded?: unknown;
    priority?: number;
    slaMinutes?: number;
    requiresInspection?: boolean;
  }) {
    const res = await fetch(`${API_BASE}/housekeeping/templates`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...scopedHeaders() },
      body: JSON.stringify(payload),
    });
    return parseResponse(res, UnknownSchema);
  },

  async updateCleaningTemplate(
    id: string,
    payload: Partial<{
      name: string;
      estimatedMinutes: number;
      checklist: unknown;
      suppliesNeeded: unknown;
      priority: number;
      slaMinutes: number;
      requiresInspection: boolean;
      isActive: boolean;
    }>,
  ) {
    const res = await fetch(`${API_BASE}/housekeeping/templates/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", ...scopedHeaders() },
      body: JSON.stringify(payload),
    });
    return parseResponse(res, UnknownSchema);
  },

  async getCleaningZones(campgroundId: string) {
    const data = await fetchJSONUnknown(`/housekeeping/zones?campgroundId=${campgroundId}`);
    return z.array(z.unknown()).parse(data);
  },

  async createCleaningZone(payload: {
    campgroundId: string;
    name: string;
    zoneType: string;
    parentZoneId?: string;
    primaryTeamId?: string;
    color?: string;
  }) {
    const res = await fetch(`${API_BASE}/housekeeping/zones`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...scopedHeaders() },
      body: JSON.stringify(payload),
    });
    return parseResponse(res, UnknownSchema);
  },

  async submitInspection(payload: {
    taskId: string;
    inspectorId: string;
    responses: Array<{ itemId: string; passed: boolean; notes?: string; photo?: string }>;
    notes?: string;
    photos?: string[];
  }) {
    const res = await fetch(`${API_BASE}/housekeeping/inspections`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...scopedHeaders() },
      body: JSON.stringify(payload),
    });
    return parseResponse(res, UnknownSchema);
  },

  async getInspectionStats(campgroundId: string, startDate?: string, endDate?: string) {
    const query = new URLSearchParams({ campgroundId });
    if (startDate) query.set("startDate", startDate);
    if (endDate) query.set("endDate", endDate);
    const data = await fetchJSONUnknown(`/housekeeping/inspections/stats?${query.toString()}`);
    return z
      .object({
        total: z.number(),
        passed: z.number(),
        failed: z.number(),
        partial: z.number(),
        passRate: z.number(),
        averageScore: z.number(),
        recleanRate: z.number(),
      })
      .parse(data);
  },

  // ==================== FLEX CHECK ====================

  async getFlexCheckPolicy(campgroundId: string) {
    const data = await fetchJSONUnknown(`/flex-check/policy?campgroundId=${campgroundId}`);
    return FlexCheckPolicySchema.parse(data);
  },

  async updateFlexCheckPolicy(
    campgroundId: string,
    payload: {
      earlyCheckInEnabled?: boolean;
      earlyCheckInMinHours?: number;
      earlyCheckInPricing?: unknown;
      earlyCheckInAutoApprove?: boolean;
      lateCheckoutEnabled?: boolean;
      lateCheckoutMaxHours?: number;
      lateCheckoutPricing?: unknown;
      lateCheckoutAutoApprove?: boolean;
    },
  ) {
    const res = await fetch(`${API_BASE}/flex-check/policy?campgroundId=${campgroundId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", ...scopedHeaders() },
      body: JSON.stringify(payload),
    });
    return parseResponse(res, UnknownSchema);
  },

  async requestEarlyCheckIn(reservationId: string, requestedTime: string) {
    const res = await fetch(`${API_BASE}/flex-check/early-checkin/request`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...scopedHeaders() },
      body: JSON.stringify({ reservationId, requestedTime }),
    });
    return parseResponse(res, UnknownSchema);
  },

  async approveEarlyCheckIn(reservationId: string) {
    const res = await fetch(`${API_BASE}/flex-check/early-checkin/${reservationId}/approve`, {
      method: "POST",
      headers: scopedHeaders(),
    });
    return parseResponse(res, UnknownSchema);
  },

  async requestLateCheckout(reservationId: string, requestedTime: string) {
    const res = await fetch(`${API_BASE}/flex-check/late-checkout/request`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...scopedHeaders() },
      body: JSON.stringify({ reservationId, requestedTime }),
    });
    return parseResponse(res, UnknownSchema);
  },

  async approveLateCheckout(reservationId: string) {
    const res = await fetch(`${API_BASE}/flex-check/late-checkout/${reservationId}/approve`, {
      method: "POST",
      headers: scopedHeaders(),
    });
    return parseResponse(res, UnknownSchema);
  },

  async getPendingFlexRequests(campgroundId: string) {
    const data = await fetchJSONUnknown(`/flex-check/pending?campgroundId=${campgroundId}`);
    return z
      .object({
        earlyCheckIn: z.array(
          z.object({
            reservationId: z.string(),
            guestName: z.string(),
            siteName: z.string(),
            requestedTime: z.string(),
            arrivalDate: z.string(),
            proposedCharge: z.number(),
          }),
        ),
        lateCheckout: z.array(
          z.object({
            reservationId: z.string(),
            guestName: z.string(),
            siteName: z.string(),
            requestedTime: z.string(),
            departureDate: z.string(),
            proposedCharge: z.number(),
          }),
        ),
      })
      .parse(data);
  },

  // ==================== ROOM MOVES ====================

  async createRoomMoveRequest(payload: {
    reservationId: string;
    toSiteId: string;
    moveDate: string;
    moveReason: string;
    isComplimentary?: boolean;
    notes?: string;
  }) {
    const res = await fetch(`${API_BASE}/room-moves`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...scopedHeaders() },
      body: JSON.stringify(payload),
    });
    return parseResponse(res, UnknownSchema);
  },

  async getPendingRoomMoves(campgroundId: string) {
    const data = await fetchJSONUnknown(`/room-moves?campgroundId=${campgroundId}`);
    return z.array(z.unknown()).parse(data);
  },

  async getTodaysRoomMoves(campgroundId: string) {
    const data = await fetchJSONUnknown(`/room-moves/today?campgroundId=${campgroundId}`);
    return z.array(z.unknown()).parse(data);
  },

  async approveRoomMove(id: string) {
    const res = await fetch(`${API_BASE}/room-moves/${id}/approve`, {
      method: "POST",
      headers: scopedHeaders(),
    });
    return parseResponse(res, UnknownSchema);
  },

  async completeRoomMove(id: string) {
    const res = await fetch(`${API_BASE}/room-moves/${id}/complete`, {
      method: "POST",
      headers: scopedHeaders(),
    });
    return parseResponse(res, UnknownSchema);
  },

  // ==================== GROUP BOOKINGS ====================

  async getGroupBookings(
    campgroundId: string,
    filters?: { groupType?: string; assignmentStatus?: string },
  ) {
    const query = new URLSearchParams({ campgroundId });
    if (filters?.groupType) query.set("groupType", filters.groupType);
    if (filters?.assignmentStatus) query.set("assignmentStatus", filters.assignmentStatus);
    const data = await fetchJSONUnknown(`/group-bookings?${query.toString()}`);
    return z.array(z.unknown()).parse(data);
  },

  async getGroupBooking(id: string) {
    const data = await fetchJSONUnknown(`/group-bookings/${id}`);
    return GroupBookingSchema.parse(data);
  },

  async createGroupBooking(payload: {
    campgroundId: string;
    groupName: string;
    primaryGuestId: string;
    groupType: string;
    preferAdjacent?: boolean;
    preferSameFloor?: boolean;
    preferConnecting?: boolean;
    preferredZone?: string;
    billingType?: string;
    groupArrivalTime?: string;
    groupDepartureTime?: string;
  }) {
    const res = await fetch(`${API_BASE}/group-bookings`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...scopedHeaders() },
      body: JSON.stringify(payload),
    });
    return parseResponse(res, UnknownSchema);
  },

  async updateGroupBooking(
    id: string,
    payload: Partial<{
      groupName: string;
      groupType: string;
      preferAdjacent: boolean;
      preferSameFloor: boolean;
      preferConnecting: boolean;
      preferredZone: string;
      billingType: string;
      groupArrivalTime: string;
      groupDepartureTime: string;
    }>,
  ) {
    const res = await fetch(`${API_BASE}/group-bookings/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", ...scopedHeaders() },
      body: JSON.stringify(payload),
    });
    return parseResponse(res, UnknownSchema);
  },

  async addReservationToGroup(groupId: string, reservationId: string) {
    const res = await fetch(`${API_BASE}/group-bookings/${groupId}/reservations`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...scopedHeaders() },
      body: JSON.stringify({ reservationId }),
    });
    return parseResponse(res, UnknownSchema);
  },

  async optimizeGroupAssignments(groupId: string) {
    const res = await fetch(`${API_BASE}/group-bookings/${groupId}/optimize-assignments`, {
      method: "POST",
      headers: scopedHeaders(),
    });
    return parseResponse(res, UnknownSchema);
  },

  async getGroupStats(campgroundId: string, startDate?: string, endDate?: string) {
    const query = new URLSearchParams({ campgroundId });
    if (startDate) query.set("startDate", startDate);
    if (endDate) query.set("endDate", endDate);
    const data = await fetchJSONUnknown(`/group-bookings/stats?${query.toString()}`);
    return z
      .object({
        totalGroups: z.number(),
        totalRooms: z.number(),
        averageGroupSize: z.number(),
        byType: z.record(z.number()),
        byStatus: z.record(z.number()),
      })
      .parse(data);
  },

  // ==================== POS INTEGRATIONS ====================

  async listPosIntegrations(campgroundId: string) {
    const data = await fetchJSONUnknown(`/pos/integrations?campgroundId=${campgroundId}`);
    return z
      .array(
        z.object({
          id: z.string(),
          campgroundId: z.string(),
          provider: z.string(),
          displayName: z.string().nullable(),
          status: z.string(),
          capabilities: z.array(z.string()),
          lastSyncAt: z.string().nullable(),
          lastSyncStatus: z.string().nullable(),
          lastError: z.string().nullable(),
          mappingCount: z.number().optional(),
          createdAt: z.string(),
        }),
      )
      .parse(data);
  },

  async getPosIntegration(id: string) {
    const data = await fetchJSONUnknown(`/pos/integrations/${id}`);
    return z
      .object({
        id: z.string(),
        campgroundId: z.string(),
        provider: z.string(),
        displayName: z.string().nullable(),
        status: z.string(),
        capabilities: z.array(z.string()),
        credentials: UnknownRecordSchema,
        settings: UnknownRecordSchema.nullable(),
        locationMappings: z.record(z.string()).nullable(),
        lastSyncAt: z.string().nullable(),
        lastSyncStatus: z.string().nullable(),
        lastError: z.string().nullable(),
        createdAt: z.string(),
        updatedAt: z.string(),
      })
      .parse(data);
  },

  async createPosIntegration(payload: {
    campgroundId: string;
    provider: string;
    displayName?: string;
    credentials: Record<string, unknown>;
    settings?: Record<string, unknown>;
    capabilities?: string[];
  }) {
    const res = await fetch(`${API_BASE}/pos/integrations`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...scopedHeaders() },
      body: JSON.stringify(payload),
    });
    return parseResponse(
      res,
      z.object({
        id: z.string(),
        provider: z.string(),
        status: z.string(),
      }),
    );
  },

  async updatePosIntegration(
    id: string,
    payload: {
      displayName?: string;
      credentials?: Record<string, unknown>;
      settings?: Record<string, unknown>;
      capabilities?: string[];
      status?: string;
    },
  ) {
    const res = await fetch(`${API_BASE}/pos/integrations/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", ...scopedHeaders() },
      body: JSON.stringify(payload),
    });
    return parseResponse(res, UnknownSchema);
  },

  async deletePosIntegration(id: string) {
    const res = await fetch(`${API_BASE}/pos/integrations/${id}`, {
      method: "DELETE",
      headers: scopedHeaders(),
    });
    return parseResponse(res, UnknownSchema);
  },

  async testPosConnection(id: string) {
    const res = await fetch(`${API_BASE}/pos/integrations/${id}/test`, {
      method: "POST",
      headers: scopedHeaders(),
    });
    return parseResponse(
      res,
      z.object({
        success: z.boolean(),
        message: z.string().optional(),
        details: UnknownRecordSchema.optional(),
      }),
    );
  },

  async triggerPosSync(id: string, type: "products" | "inventory" | "sales") {
    const res = await fetch(`${API_BASE}/pos/integrations/${id}/sync`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...scopedHeaders() },
      body: JSON.stringify({ type }),
    });
    return parseResponse(
      res,
      z.object({
        jobId: z.string().optional(),
        status: z.string(),
        message: z.string().optional(),
      }),
    );
  },

  // Product Mappings
  async listProductMappings(campgroundId: string, provider?: string) {
    const query = new URLSearchParams({ campgroundId });
    if (provider) query.set("provider", provider);
    const data = await fetchJSONUnknown(`/pos/product-mappings?${query.toString()}`);
    return z
      .array(
        z.object({
          id: z.string(),
          campgroundId: z.string(),
          productId: z.string(),
          provider: z.string(),
          externalId: z.string(),
          externalSku: z.string().nullable(),
          lastSyncedAt: z.string().nullable(),
          syncStatus: z.string().nullable(),
          syncError: z.string().nullable(),
          metadata: UnknownRecordSchema.nullable(),
          product: z.object({
            id: z.string(),
            name: z.string(),
            sku: z.string().nullable(),
            priceCents: z.number(),
          }),
        }),
      )
      .parse(data);
  },

  async importExternalProducts(integrationId: string) {
    const res = await fetch(`${API_BASE}/pos/integrations/${integrationId}/import-products`, {
      method: "POST",
      headers: scopedHeaders(),
    });
    return parseResponse(
      res,
      z.object({
        imported: z.number(),
        updated: z.number(),
        failed: z.number(),
        products: z.array(
          z.object({
            externalId: z.string(),
            externalSku: z.string().nullable(),
            name: z.string(),
            priceCents: z.number(),
            category: z.string().nullable(),
          }),
        ),
      }),
    );
  },

  async linkProduct(payload: {
    campgroundId: string;
    productId: string;
    provider: string;
    externalId: string;
  }) {
    const res = await fetch(`${API_BASE}/pos/product-mappings/link`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...scopedHeaders() },
      body: JSON.stringify(payload),
    });
    return parseResponse(
      res,
      z.object({
        id: z.string(),
        syncStatus: z.string(),
      }),
    );
  },

  async unlinkProduct(mappingId: string) {
    const res = await fetch(`${API_BASE}/pos/product-mappings/${mappingId}`, {
      method: "DELETE",
      headers: scopedHeaders(),
    });
    return parseResponse(res, UnknownSchema);
  },

  async autoMatchProducts(integrationId: string) {
    const res = await fetch(`${API_BASE}/pos/integrations/${integrationId}/auto-match`, {
      method: "POST",
      headers: scopedHeaders(),
    });
    return parseResponse(
      res,
      z.object({
        matched: z.number(),
        unmatched: z.number(),
      }),
    );
  },

  // Sync Operations
  async pushInventoryToPos(integrationId: string, productId?: string) {
    const res = await fetch(`${API_BASE}/pos/integrations/${integrationId}/push-inventory`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...scopedHeaders() },
      body: JSON.stringify({ productId }),
    });
    return parseResponse(
      res,
      z.object({
        pushed: z.number(),
        failed: z.number(),
        results: UnknownArraySchema,
      }),
    );
  },

  async pullSalesFromPos(integrationId: string, since?: string) {
    const query = since ? `?since=${since}` : "";
    const res = await fetch(`${API_BASE}/pos/integrations/${integrationId}/pull-sales${query}`, {
      method: "POST",
      headers: scopedHeaders(),
    });
    return parseResponse(
      res,
      z.object({
        processed: z.number(),
        deducted: z.number(),
        skipped: z.number(),
        errors: z.array(z.string()),
      }),
    );
  },

  async getSyncLogs(integrationId: string, limit?: number) {
    const query = limit ? `?limit=${limit}` : "";
    const data = await fetchJSONUnknown(`/pos/integrations/${integrationId}/logs${query}`);
    return z
      .array(
        z.object({
          id: z.string(),
          integrationId: z.string(),
          direction: z.string(),
          type: z.string(),
          status: z.string(),
          itemsProcessed: z.number(),
          itemsFailed: z.number(),
          errors: z.array(z.string()),
          startedAt: z.string(),
          completedAt: z.string().nullable(),
        }),
      )
      .parse(data);
  },

  async getUnmatchedExternalProducts(integrationId: string) {
    const data = await fetchJSONUnknown(`/pos/integrations/${integrationId}/unmatched`);
    return z
      .array(
        z.object({
          id: z.string(),
          externalId: z.string(),
          externalSku: z.string().nullable(),
          metadata: UnknownRecordSchema.nullable(),
        }),
      )
      .parse(data);
  },

  // ==================== KIOSK DEVICE PAIRING ====================

  /**
   * Pair a kiosk device using a 6-digit pairing code (public, no auth required)
   */
  async kioskPairDevice(code: string, deviceName?: string) {
    const res = await fetch(`${API_BASE}/kiosk/pair`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code, deviceName }),
    });
    return parseResponse(
      res,
      z.object({
        deviceToken: z.string(),
        deviceId: z.string(),
        campground: z.object({
          id: z.string(),
          name: z.string(),
          slug: z.string(),
          heroImageUrl: z.string().nullable(),
          latitude: z.number().nullable(),
          longitude: z.number().nullable(),
        }),
      }),
    );
  },

  /**
   * Validate kiosk device token and get campground info (public, uses X-Kiosk-Token header)
   */
  async kioskGetDeviceInfo(deviceToken: string) {
    const res = await fetch(`${API_BASE}/kiosk/me`, {
      method: "GET",
      headers: { "X-Kiosk-Token": deviceToken },
    });
    return parseResponse(
      res,
      z.object({
        valid: z.boolean(),
        error: z.string().optional(),
        deviceId: z.string().optional(),
        deviceName: z.string().optional(),
        campground: z
          .object({
            id: z.string(),
            name: z.string(),
            slug: z.string(),
            heroImageUrl: z.string().nullable(),
            latitude: z.number().nullable(),
            longitude: z.number().nullable(),
            checkInTime: z.string().nullable(),
            checkOutTime: z.string().nullable(),
          })
          .optional(),
        features: z
          .object({
            allowWalkIns: z.boolean(),
            allowCheckIn: z.boolean(),
            allowPayments: z.boolean(),
          })
          .optional(),
      }),
    );
  },

  /**
   * Create a walk-in reservation from the kiosk (uses X-Kiosk-Token header)
   */
  async kioskCreateReservation(
    deviceToken: string,
    data: {
      siteId: string;
      arrivalDate: string;
      departureDate: string;
      adults: number;
      children?: number;
      guest: {
        firstName: string;
        lastName: string;
        email: string;
        phone: string;
        zipCode: string;
      };
      equipment?: {
        type: string;
        plateNumber?: string;
      };
    },
  ) {
    const res = await fetch(`${API_BASE}/kiosk/reservations`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Kiosk-Token": deviceToken,
      },
      body: JSON.stringify(data),
    });
    return parseResponse(
      res,
      z.object({
        id: z.string(),
        arrivalDate: z.string(),
        departureDate: z.string(),
        status: z.string(),
        adults: z.number(),
        children: z.number(),
        totalAmount: z.number(),
        paidAmount: z.number(),
        site: z
          .object({ id: z.string(), name: z.string(), siteNumber: z.string() })
          .nullable()
          .optional(),
        guest: z
          .object({
            primaryFirstName: z.string(),
            primaryLastName: z.string(),
            email: z.string(),
          })
          .nullable()
          .optional(),
      }),
    );
  },

  /**
   * Generate a pairing code for a campground (staff auth required)
   */
  async kioskGeneratePairingCode(campgroundId: string) {
    const res = await fetch(`${API_BASE}/campgrounds/${campgroundId}/kiosk/pairing-code`, {
      method: "POST",
      headers: scopedHeaders(),
    });
    return parseResponse(
      res,
      z.object({
        code: z.string(),
        expiresAt: z.string(),
      }),
    );
  },

  /**
   * List all kiosk devices for a campground (staff auth required)
   */
  async kioskListDevices(campgroundId: string) {
    const data = await fetchJSONUnknown(`/campgrounds/${campgroundId}/kiosk/devices`);
    return z
      .array(
        z.object({
          id: z.string(),
          name: z.string(),
          status: z.string(),
          lastSeenAt: z.string().nullable(),
          userAgent: z.string().nullable(),
          allowWalkIns: z.boolean(),
          allowCheckIn: z.boolean(),
          allowPayments: z.boolean(),
          createdAt: z.string(),
          revokedAt: z.string().nullable(),
        }),
      )
      .parse(data);
  },

  /**
   * Update a kiosk device's settings (staff auth required)
   */
  async kioskUpdateDevice(
    campgroundId: string,
    deviceId: string,
    data: {
      name?: string;
      allowWalkIns?: boolean;
      allowCheckIn?: boolean;
      allowPayments?: boolean;
    },
  ) {
    const res = await fetch(`${API_BASE}/campgrounds/${campgroundId}/kiosk/devices/${deviceId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", ...scopedHeaders() },
      body: JSON.stringify(data),
    });
    return parseResponse(res, UnknownSchema);
  },

  /**
   * Revoke a kiosk device (staff auth required)
   */
  async kioskRevokeDevice(campgroundId: string, deviceId: string) {
    const res = await fetch(
      `${API_BASE}/campgrounds/${campgroundId}/kiosk/devices/${deviceId}/revoke`,
      {
        method: "POST",
        headers: scopedHeaders(),
      },
    );
    return parseResponse(res, UnknownSchema);
  },

  /**
   * Re-enable a revoked kiosk device (staff auth required)
   */
  async kioskEnableDevice(campgroundId: string, deviceId: string) {
    const res = await fetch(
      `${API_BASE}/campgrounds/${campgroundId}/kiosk/devices/${deviceId}/enable`,
      {
        method: "POST",
        headers: scopedHeaders(),
      },
    );
    return parseResponse(res, UnknownSchema);
  },

  /**
   * Delete a kiosk device permanently (staff auth required)
   */
  async kioskDeleteDevice(campgroundId: string, deviceId: string) {
    const res = await fetch(`${API_BASE}/campgrounds/${campgroundId}/kiosk/devices/${deviceId}`, {
      method: "DELETE",
      headers: scopedHeaders(),
    });
    return parseResponse(res, z.object({ deleted: z.boolean() }));
  },

  // ============================================================
  // NOTIFICATIONS
  // ============================================================

  /**
   * Get notifications for a user
   */
  async getNotifications(userId: string, options?: { limit?: number; unreadOnly?: boolean }) {
    const params = new URLSearchParams();
    if (options?.limit) params.set("limit", String(options.limit));
    if (options?.unreadOnly) params.set("unreadOnly", "true");
    const res = await fetch(`${API_BASE}/staff/notifications/${userId}?${params}`, {
      headers: scopedHeaders(),
    });
    return parseResponse(
      res,
      z.array(
        z.object({
          id: z.string(),
          campgroundId: z.string(),
          userId: z.string().nullable(),
          type: z.string(),
          title: z.string(),
          body: z.string(),
          data: UnknownRecordSchema.nullable(),
          sentAt: z.string().nullable(),
          readAt: z.string().nullable(),
          clickedAt: z.string().nullable(),
          createdAt: z.string(),
        }),
      ),
    );
  },

  /**
   * Mark a notification as read
   */
  async markNotificationRead(notificationId: string) {
    const res = await fetch(`${API_BASE}/staff/notifications/${notificationId}/read`, {
      method: "PATCH",
      headers: scopedHeaders(),
    });
    return parseResponse(
      res,
      z.object({
        id: z.string(),
        readAt: z.string(),
      }),
    );
  },

  /**
   * Mark all notifications as read for a user
   */
  async markAllNotificationsRead(userId: string) {
    const res = await fetch(`${API_BASE}/staff/notifications/${userId}/read-all`, {
      method: "POST",
      headers: scopedHeaders(),
    });
    return parseResponse(res, CountSchema);
  },

  /**
   * Send a push notification (for testing or manual triggers)
   */
  async sendNotification(data: {
    campgroundId: string;
    userId: string | null;
    type: string;
    title: string;
    body: string;
    data?: Record<string, unknown>;
  }) {
    const res = await fetch(`${API_BASE}/staff/notifications`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...scopedHeaders() },
      body: JSON.stringify(data),
    });
    return parseResponse(res, IdSchema);
  },

  // ============================================================
  // UNIFIED OPERATIONS / OP-TASKS
  // ============================================================

  // Tasks
  async getOpTasks(
    campgroundId: string,
    filters?: {
      categories?: string[];
      category?: string;
      states?: string[];
      state?: string;
      priorities?: string[];
      priority?: string;
      assignedToUserId?: string;
      assignedToTeamId?: string;
      siteId?: string;
      slaStatus?: string;
      dueBefore?: string;
      dueAfter?: string;
      excludeCompleted?: boolean;
      limit?: number;
      offset?: number;
    },
  ) {
    const params = new URLSearchParams();
    if (filters?.categories?.length) params.set("categories", filters.categories.join(","));
    if (filters?.category) params.set("category", filters.category);
    if (filters?.states?.length) params.set("states", filters.states.join(","));
    if (filters?.state) params.set("state", filters.state);
    if (filters?.priorities?.length) params.set("priorities", filters.priorities.join(","));
    if (filters?.priority) params.set("priority", filters.priority);
    if (filters?.assignedToUserId) params.set("assignedToUserId", filters.assignedToUserId);
    if (filters?.assignedToTeamId) params.set("assignedToTeamId", filters.assignedToTeamId);
    if (filters?.siteId) params.set("siteId", filters.siteId);
    if (filters?.slaStatus) params.set("slaStatus", filters.slaStatus);
    if (filters?.dueBefore) params.set("dueBefore", filters.dueBefore);
    if (filters?.dueAfter) params.set("dueAfter", filters.dueAfter);
    if (filters?.excludeCompleted) params.set("excludeCompleted", "true");
    if (filters?.limit) params.set("limit", String(filters.limit));
    if (filters?.offset) params.set("offset", String(filters.offset));
    const res = await fetch(`${API_BASE}/op-tasks/${campgroundId}/tasks?${params}`, {
      headers: scopedHeaders(),
    });
    return parseResponse(res, UnknownArraySchema);
  },

  async getOpTask(campgroundId: string, taskId: string) {
    const res = await fetch(`${API_BASE}/op-tasks/${campgroundId}/tasks/${taskId}`, {
      headers: scopedHeaders(),
    });
    return parseResponse(res, UnknownSchema);
  },

  async getOpTaskStats(campgroundId: string) {
    const res = await fetch(`${API_BASE}/op-tasks/${campgroundId}/tasks/stats`, {
      headers: scopedHeaders(),
    });
    return parseResponse(res, UnknownSchema);
  },

  async getOpTasksDueToday(campgroundId: string) {
    const res = await fetch(`${API_BASE}/op-tasks/${campgroundId}/tasks/due-today`, {
      headers: scopedHeaders(),
    });
    return parseResponse(res, UnknownArraySchema);
  },

  async getOpTasksOverdue(campgroundId: string) {
    const res = await fetch(`${API_BASE}/op-tasks/${campgroundId}/tasks/overdue`, {
      headers: scopedHeaders(),
    });
    return parseResponse(res, UnknownArraySchema);
  },

  async getMyOpTasks(campgroundId: string) {
    const res = await fetch(`${API_BASE}/op-tasks/${campgroundId}/tasks/my-tasks`, {
      headers: scopedHeaders(),
    });
    return parseResponse(res, UnknownArraySchema);
  },

  async createOpTask(
    campgroundId: string,
    payload: {
      category: string;
      title: string;
      description?: string;
      priority?: string;
      siteId?: string;
      reservationId?: string;
      locationDescription?: string;
      assignedToUserId?: string;
      assignedToTeamId?: string;
      slaDueAt?: string;
      checklist?: Array<{ id: string; text: string; completed: boolean; required?: boolean }>;
      notes?: string;
      isBlocking?: boolean;
      templateId?: string;
    },
  ) {
    const res = await fetch(`${API_BASE}/op-tasks/${campgroundId}/tasks`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...scopedHeaders() },
      body: JSON.stringify(payload),
    });
    return parseResponse(res, UnknownSchema);
  },

  async updateOpTask(
    campgroundId: string,
    taskId: string,
    payload: {
      state?: string;
      priority?: string;
      title?: string;
      description?: string;
      assignedToUserId?: string;
      assignedToTeamId?: string;
      slaDueAt?: string;
      checklist?: Array<{ id: string; text: string; completed: boolean }>;
      notes?: string;
      isBlocking?: boolean;
    },
  ) {
    const res = await fetch(`${API_BASE}/op-tasks/${campgroundId}/tasks/${taskId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", ...scopedHeaders() },
      body: JSON.stringify(payload),
    });
    return parseResponse(res, UnknownSchema);
  },

  async deleteOpTask(campgroundId: string, taskId: string) {
    const res = await fetch(`${API_BASE}/op-tasks/${campgroundId}/tasks/${taskId}`, {
      method: "DELETE",
      headers: scopedHeaders(),
    });
    await parseResponse(res, UnknownSchema);
  },

  async assignOpTask(
    campgroundId: string,
    taskId: string,
    payload: { userId?: string; teamId?: string },
  ) {
    const res = await fetch(`${API_BASE}/op-tasks/${campgroundId}/tasks/${taskId}/assign`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...scopedHeaders() },
      body: JSON.stringify(payload),
    });
    return parseResponse(res, UnknownSchema);
  },

  async addOpTaskComment(campgroundId: string, taskId: string, content: string) {
    const res = await fetch(`${API_BASE}/op-tasks/${campgroundId}/tasks/${taskId}/comments`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...scopedHeaders() },
      body: JSON.stringify({ content }),
    });
    return parseResponse(res, UnknownSchema);
  },

  async bulkUpdateOpTasks(campgroundId: string, ids: string[], state: string) {
    const res = await fetch(`${API_BASE}/op-tasks/${campgroundId}/tasks/bulk-update`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...scopedHeaders() },
      body: JSON.stringify({ ids, state }),
    });
    return parseResponse(res, UnknownSchema);
  },

  // Templates
  async getOpTemplates(campgroundId: string, filters?: { category?: string; isActive?: boolean }) {
    const params = new URLSearchParams();
    if (filters?.category) params.set("category", filters.category);
    if (filters?.isActive !== undefined) params.set("isActive", String(filters.isActive));
    const res = await fetch(`${API_BASE}/op-tasks/${campgroundId}/templates?${params}`, {
      headers: scopedHeaders(),
    });
    return parseResponse(res, UnknownArraySchema);
  },

  async getOpStarterTemplates(campgroundId: string) {
    const res = await fetch(`${API_BASE}/op-tasks/${campgroundId}/templates/starters`, {
      headers: scopedHeaders(),
    });
    return parseResponse(res, UnknownArraySchema);
  },

  async createOpTemplate(
    campgroundId: string,
    payload: {
      name: string;
      description?: string;
      category: string;
      priority?: string;
      checklistTemplate?: Array<{
        id: string;
        text: string;
        required?: boolean;
        category?: string;
        estimatedMinutes?: number;
      }>;
      suppliesNeeded?: Array<{ item: string; quantity?: number; notes?: string }>;
      estimatedMinutes?: number;
      slaMinutes?: number;
      defaultTeamId?: string;
      defaultAssigneeId?: string;
      siteClassIds?: string[];
      siteIds?: string[];
      xpValue?: number;
    },
  ) {
    const res = await fetch(`${API_BASE}/op-tasks/${campgroundId}/templates`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...scopedHeaders() },
      body: JSON.stringify(payload),
    });
    return parseResponse(res, UnknownSchema);
  },

  async updateOpTemplate(
    campgroundId: string,
    templateId: string,
    payload: Record<string, unknown>,
  ) {
    const res = await fetch(`${API_BASE}/op-tasks/${campgroundId}/templates/${templateId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", ...scopedHeaders() },
      body: JSON.stringify(payload),
    });
    return parseResponse(res, UnknownSchema);
  },

  async deleteOpTemplate(campgroundId: string, templateId: string) {
    const res = await fetch(`${API_BASE}/op-tasks/${campgroundId}/templates/${templateId}`, {
      method: "DELETE",
      headers: scopedHeaders(),
    });
    await parseResponse(res, UnknownSchema);
  },

  async duplicateOpTemplate(campgroundId: string, templateId: string, name?: string) {
    const res = await fetch(
      `${API_BASE}/op-tasks/${campgroundId}/templates/${templateId}/duplicate`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", ...scopedHeaders() },
        body: JSON.stringify({ name }),
      },
    );
    return parseResponse(res, UnknownSchema);
  },

  async seedOpStarterTemplates(campgroundId: string) {
    const res = await fetch(`${API_BASE}/op-tasks/${campgroundId}/templates/seed`, {
      method: "POST",
      headers: scopedHeaders(),
    });
    return parseResponse(res, UnknownArraySchema);
  },

  // Triggers
  async getOpTriggers(campgroundId: string, filters?: { event?: string; isActive?: boolean }) {
    const params = new URLSearchParams();
    if (filters?.event) params.set("event", filters.event);
    if (filters?.isActive !== undefined) params.set("isActive", String(filters.isActive));
    const res = await fetch(`${API_BASE}/op-tasks/${campgroundId}/triggers?${params}`, {
      headers: scopedHeaders(),
    });
    return parseResponse(res, UnknownArraySchema);
  },

  async getTriggerSuggestions(campgroundId: string) {
    const res = await fetch(`${API_BASE}/op-tasks/${campgroundId}/triggers/suggestions`, {
      headers: scopedHeaders(),
    });
    return parseResponse(res, UnknownArraySchema);
  },

  async createOpTrigger(
    campgroundId: string,
    payload: {
      name: string;
      triggerEvent: string;
      templateId: string;
      conditions?: {
        siteClassIds?: string[];
        siteIds?: string[];
        minNights?: number;
        maxNights?: number;
        hasPets?: boolean;
        stayType?: string;
      };
      slaOffsetMinutes?: number;
      assignToTeamId?: string;
      assignToUserId?: string;
    },
  ) {
    const res = await fetch(`${API_BASE}/op-tasks/${campgroundId}/triggers`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...scopedHeaders() },
      body: JSON.stringify(payload),
    });
    return parseResponse(res, UnknownSchema);
  },

  async updateOpTrigger(campgroundId: string, triggerId: string, payload: Record<string, unknown>) {
    const res = await fetch(`${API_BASE}/op-tasks/${campgroundId}/triggers/${triggerId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", ...scopedHeaders() },
      body: JSON.stringify(payload),
    });
    return parseResponse(res, UnknownSchema);
  },

  async deleteOpTrigger(campgroundId: string, triggerId: string) {
    const res = await fetch(`${API_BASE}/op-tasks/${campgroundId}/triggers/${triggerId}`, {
      method: "DELETE",
      headers: scopedHeaders(),
    });
    await parseResponse(res, UnknownSchema);
  },

  // Recurrence Rules
  async getOpRecurrenceRules(
    campgroundId: string,
    filters?: { pattern?: string; isActive?: boolean },
  ) {
    const params = new URLSearchParams();
    if (filters?.pattern) params.set("pattern", filters.pattern);
    if (filters?.isActive !== undefined) params.set("isActive", String(filters.isActive));
    const res = await fetch(`${API_BASE}/op-tasks/${campgroundId}/recurrence?${params}`, {
      headers: scopedHeaders(),
    });
    return parseResponse(res, UnknownArraySchema);
  },

  async getRecurrenceSuggestions(campgroundId: string) {
    const res = await fetch(`${API_BASE}/op-tasks/${campgroundId}/recurrence/suggestions`, {
      headers: scopedHeaders(),
    });
    return parseResponse(res, UnknownArraySchema);
  },

  async createOpRecurrenceRule(
    campgroundId: string,
    payload: {
      name: string;
      templateId: string;
      pattern: string;
      daysOfWeek?: number[];
      daysOfMonth?: number[];
      generateAtHour?: number;
      generateAtMinute?: number;
      siteClassIds?: string[];
      siteIds?: string[];
      locationFilter?: string;
      assignToTeamId?: string;
      assignToUserId?: string;
    },
  ) {
    const res = await fetch(`${API_BASE}/op-tasks/${campgroundId}/recurrence`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...scopedHeaders() },
      body: JSON.stringify(payload),
    });
    return parseResponse(res, UnknownSchema);
  },

  async updateOpRecurrenceRule(
    campgroundId: string,
    ruleId: string,
    payload: Record<string, unknown>,
  ) {
    const res = await fetch(`${API_BASE}/op-tasks/${campgroundId}/recurrence/${ruleId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", ...scopedHeaders() },
      body: JSON.stringify(payload),
    });
    return parseResponse(res, UnknownSchema);
  },

  async deleteOpRecurrenceRule(campgroundId: string, ruleId: string) {
    const res = await fetch(`${API_BASE}/op-tasks/${campgroundId}/recurrence/${ruleId}`, {
      method: "DELETE",
      headers: scopedHeaders(),
    });
    await parseResponse(res, UnknownSchema);
  },

  async triggerRecurrenceRule(campgroundId: string, ruleId: string) {
    const res = await fetch(`${API_BASE}/op-tasks/${campgroundId}/recurrence/${ruleId}/trigger`, {
      method: "POST",
      headers: scopedHeaders(),
    });
    return parseResponse(res, UnknownArraySchema);
  },

  // Teams
  async getOpTeams(campgroundId: string, filters?: { isActive?: boolean }) {
    const params = new URLSearchParams();
    if (filters?.isActive !== undefined) params.set("isActive", String(filters.isActive));
    const res = await fetch(`${API_BASE}/op-tasks/${campgroundId}/teams?${params}`, {
      headers: scopedHeaders(),
    });
    return parseResponse(res, UnknownArraySchema);
  },

  async getMyOpTeams(campgroundId: string) {
    const res = await fetch(`${API_BASE}/op-tasks/${campgroundId}/teams/my-teams`, {
      headers: scopedHeaders(),
    });
    return parseResponse(res, UnknownArraySchema);
  },

  async getAvailableStaff(campgroundId: string) {
    const res = await fetch(`${API_BASE}/op-tasks/${campgroundId}/teams/available-staff`, {
      headers: scopedHeaders(),
    });
    return parseResponse(res, UnknownArraySchema);
  },

  async getOpTeam(campgroundId: string, teamId: string) {
    const res = await fetch(`${API_BASE}/op-tasks/${campgroundId}/teams/${teamId}`, {
      headers: scopedHeaders(),
    });
    return parseResponse(res, UnknownSchema);
  },

  async getOpTeamStats(campgroundId: string, teamId: string) {
    const res = await fetch(`${API_BASE}/op-tasks/${campgroundId}/teams/${teamId}/stats`, {
      headers: scopedHeaders(),
    });
    return parseResponse(res, UnknownSchema);
  },

  async createOpTeam(
    campgroundId: string,
    payload: { name: string; description?: string; color?: string },
  ) {
    const res = await fetch(`${API_BASE}/op-tasks/${campgroundId}/teams`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...scopedHeaders() },
      body: JSON.stringify(payload),
    });
    return parseResponse(res, UnknownSchema);
  },

  async updateOpTeam(
    campgroundId: string,
    teamId: string,
    payload: { name?: string; description?: string; color?: string; isActive?: boolean },
  ) {
    const res = await fetch(`${API_BASE}/op-tasks/${campgroundId}/teams/${teamId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", ...scopedHeaders() },
      body: JSON.stringify(payload),
    });
    return parseResponse(res, UnknownSchema);
  },

  async deleteOpTeam(campgroundId: string, teamId: string) {
    const res = await fetch(`${API_BASE}/op-tasks/${campgroundId}/teams/${teamId}`, {
      method: "DELETE",
      headers: scopedHeaders(),
    });
    await parseResponse(res, UnknownSchema);
  },

  async addOpTeamMember(
    campgroundId: string,
    teamId: string,
    payload: { userId: string; role?: string },
  ) {
    const res = await fetch(`${API_BASE}/op-tasks/${campgroundId}/teams/${teamId}/members`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...scopedHeaders() },
      body: JSON.stringify(payload),
    });
    return parseResponse(res, UnknownSchema);
  },

  async removeOpTeamMember(campgroundId: string, teamId: string, userId: string) {
    const res = await fetch(
      `${API_BASE}/op-tasks/${campgroundId}/teams/${teamId}/members/${userId}`,
      {
        method: "DELETE",
        headers: scopedHeaders(),
      },
    );
    await parseResponse(res, UnknownSchema);
  },

  async updateOpTeamMemberRole(campgroundId: string, teamId: string, userId: string, role: string) {
    const res = await fetch(
      `${API_BASE}/op-tasks/${campgroundId}/teams/${teamId}/members/${userId}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...scopedHeaders() },
        body: JSON.stringify({ role }),
      },
    );
    return parseResponse(res, UnknownSchema);
  },

  async seedDefaultOpTeams(campgroundId: string) {
    const res = await fetch(`${API_BASE}/op-tasks/${campgroundId}/teams/seed`, {
      method: "POST",
      headers: scopedHeaders(),
    });
    return parseResponse(res, UnknownArraySchema);
  },

  // SLA Dashboard
  async getSlaDashboard(campgroundId: string) {
    const res = await fetch(`${API_BASE}/op-tasks/${campgroundId}/sla/dashboard`, {
      headers: scopedHeaders(),
    });
    return parseResponse(
      res,
      z.object({
        current: z.object({
          onTrack: z.number(),
          atRisk: z.number(),
          breached: z.number(),
          total: z.number(),
        }),
        today: z.object({
          completed: z.number(),
          onTime: z.number(),
          late: z.number(),
          complianceRate: z.number(),
        }),
        week: z.object({ completed: z.number() }),
      }),
    );
  },

  async getUpcomingDeadlines(
    campgroundId: string,
    options?: { limit?: number; hoursAhead?: number },
  ) {
    const params = new URLSearchParams();
    if (options?.limit) params.set("limit", String(options.limit));
    if (options?.hoursAhead) params.set("hoursAhead", String(options.hoursAhead));
    const res = await fetch(`${API_BASE}/op-tasks/${campgroundId}/sla/upcoming?${params}`, {
      headers: scopedHeaders(),
    });
    return parseResponse(res, UnknownArraySchema);
  },

  async getBreachedTasks(campgroundId: string) {
    const res = await fetch(`${API_BASE}/op-tasks/${campgroundId}/sla/breached`, {
      headers: scopedHeaders(),
    });
    return parseResponse(res, UnknownArraySchema);
  },

  async getTeamSlaPerformance(campgroundId: string) {
    const res = await fetch(`${API_BASE}/op-tasks/${campgroundId}/sla/team-performance`, {
      headers: scopedHeaders(),
    });
    return parseResponse(
      res,
      z.array(
        z.object({
          teamId: z.string(),
          teamName: z.string(),
          totalCompleted: z.number(),
          onTime: z.number(),
          late: z.number(),
          complianceRate: z.number(),
        }),
      ),
    );
  },

  async getStaffSlaPerformance(campgroundId: string) {
    const res = await fetch(`${API_BASE}/op-tasks/${campgroundId}/sla/staff-performance`, {
      headers: scopedHeaders(),
    });
    return parseResponse(
      res,
      z.array(
        z.object({
          userId: z.string(),
          userName: z.string(),
          totalCompleted: z.number(),
          onTime: z.number(),
          late: z.number(),
          complianceRate: z.number(),
        }),
      ),
    );
  },

  async escalateTask(campgroundId: string, taskId: string, escalateToUserId: string) {
    const res = await fetch(`${API_BASE}/op-tasks/${campgroundId}/sla/${taskId}/escalate`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...scopedHeaders() },
      body: JSON.stringify({ escalateToUserId }),
    });
    return parseResponse(res, UnknownSchema);
  },

  // ============================================================================
  // GAMIFICATION
  // ============================================================================

  async getLeaderboard(
    campgroundId: string,
    options?: { period?: "week" | "month" | "all_time"; limit?: number },
  ) {
    const params = new URLSearchParams();
    if (options?.period) params.append("period", options.period);
    if (options?.limit) params.append("limit", String(options.limit));
    const queryString = params.toString();
    const res = await fetch(
      `${API_BASE}/op-tasks/${campgroundId}/gamification/leaderboard${queryString ? `?${queryString}` : ""}`,
      {
        headers: scopedHeaders(),
      },
    );
    return parseResponse(
      res,
      z.array(
        z.object({
          userId: z.string(),
          userName: z.string(),
          totalPoints: z.number(),
          periodPoints: z.number(),
          rank: z.number(),
          level: z.number(),
          tasksCompleted: z.number(),
          streak: z.number(),
          badges: z.number(),
        }),
      ),
    );
  },

  async getBadges(campgroundId: string) {
    const res = await fetch(`${API_BASE}/op-tasks/${campgroundId}/gamification/badges`, {
      headers: scopedHeaders(),
    });
    return parseResponse(
      res,
      z.array(
        z.object({
          id: z.string(),
          code: z.string(),
          name: z.string(),
          description: z.string(),
          icon: z.string(),
          category: z.string(),
          tier: z.string(),
          points: z.number(),
          earnedCount: z.number(),
        }),
      ),
    );
  },

  async seedDefaultBadges(campgroundId: string) {
    const res = await fetch(`${API_BASE}/op-tasks/${campgroundId}/gamification/badges/seed`, {
      method: "POST",
      headers: scopedHeaders(),
    });
    return parseResponse(res, z.object({ seeded: z.number() }));
  },

  async getStaffGamificationProfile(campgroundId: string, userId: string) {
    const res = await fetch(`${API_BASE}/op-tasks/${campgroundId}/gamification/staff/${userId}`, {
      headers: scopedHeaders(),
    });
    return parseResponse(
      res,
      z.object({
        userId: z.string(),
        userName: z.string(),
        level: z.number(),
        totalPoints: z.number(),
        weekPoints: z.number(),
        monthPoints: z.number(),
        xpToNextLevel: z.number(),
        currentStreak: z.number(),
        longestStreak: z.number(),
        totalTasksCompleted: z.number(),
        slaComplianceRate: z.number(),
        weeklyRank: z.number().nullable(),
        monthlyRank: z.number().nullable(),
        badges: z.array(
          z.object({
            id: z.string(),
            name: z.string(),
            icon: z.string(),
            tier: z.string(),
            earnedAt: z.string(),
          }),
        ),
        recentActivity: z.array(
          z.object({
            date: z.string(),
            tasksCompleted: z.number(),
            pointsEarned: z.number(),
          }),
        ),
      }),
    );
  },

  async getMyGamificationStats(campgroundId: string) {
    const res = await fetch(`${API_BASE}/op-tasks/${campgroundId}/gamification/my-stats`, {
      headers: scopedHeaders(),
    });
    return parseResponse(
      res,
      z.object({
        userId: z.string(),
        userName: z.string(),
        level: z.number(),
        totalPoints: z.number(),
        weekPoints: z.number(),
        monthPoints: z.number(),
        xpToNextLevel: z.number(),
        currentStreak: z.number(),
        longestStreak: z.number(),
        totalTasksCompleted: z.number(),
        slaComplianceRate: z.number(),
        weeklyRank: z.number().nullable(),
        monthlyRank: z.number().nullable(),
        badges: z.array(
          z.object({
            id: z.string(),
            name: z.string(),
            icon: z.string(),
            tier: z.string(),
            earnedAt: z.string(),
          }),
        ),
        recentActivity: z.array(
          z.object({
            date: z.string(),
            tasksCompleted: z.number(),
            pointsEarned: z.number(),
          }),
        ),
      }),
    );
  },

  async getAllStaffGamificationStats(campgroundId: string) {
    const res = await fetch(`${API_BASE}/op-tasks/${campgroundId}/gamification/all-staff`, {
      headers: scopedHeaders(),
    });
    return parseResponse(
      res,
      z.array(
        z.object({
          userId: z.string(),
          userName: z.string(),
          level: z.number(),
          totalPoints: z.number(),
          weekPoints: z.number(),
          monthPoints: z.number(),
          currentStreak: z.number(),
          tasksCompleted: z.number(),
          slaComplianceRate: z.number(),
          badgeCount: z.number(),
        }),
      ),
    );
  },

  // ==================== AI AUTOPILOT ====================

  async getAutopilotConfig(campgroundId: string) {
    return fetchJSON(
      `/ai/autopilot/campgrounds/${campgroundId}/config`,
      z.object({
        id: z.string(),
        campgroundId: z.string(),
        autoReplyEnabled: z.boolean(),
        autoReplyMode: z.string(),
        autoReplyConfidenceThreshold: z.number(),
        autoReplyDelayMinutes: z.number(),
        autoReplyExcludeCategories: z.array(z.string()),
        smartWaitlistEnabled: z.boolean(),
        smartWaitlistMode: z.string(),
        waitlistGuestValueWeight: z.number(),
        waitlistLikelihoodWeight: z.number(),
        waitlistSeasonalWeight: z.number(),
        anomalyDetectionEnabled: z.boolean(),
        anomalyAlertMode: z.string(),
        anomalyDigestSchedule: z.string(),
        anomalyDigestTime: z.string(),
        anomalySensitivity: z.string(),
        noShowPredictionEnabled: z.boolean(),
        noShowThreshold: z.number(),
        noShowAutoReminder: z.boolean(),
        noShowReminderDaysBefore: z.number(),
        weatherAlertsEnabled: z.boolean().optional(),
      }),
    );
  },

  async updateAutopilotConfig(campgroundId: string, config: Record<string, unknown>) {
    const res = await fetch(`${API_BASE}/ai/autopilot/campgrounds/${campgroundId}/config`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", ...scopedHeaders() },
      body: JSON.stringify(config),
    });
    return parseResponse(res, UnknownSchema);
  },

  async getAutopilotContext(campgroundId: string, type?: string, category?: string) {
    const params = new URLSearchParams();
    if (type) params.set("type", type);
    if (category) params.set("category", category);
    return fetchJSON(
      `/ai/autopilot/campgrounds/${campgroundId}/context?${params}`,
      z.array(
        z.object({
          id: z.string(),
          type: z.string(),
          question: z.string().optional(),
          answer: z.string(),
          category: z.string().optional(),
          priority: z.number(),
          isActive: z.boolean(),
          source: z.string(),
        }),
      ),
    );
  },

  async createAutopilotContext(
    campgroundId: string,
    data: { type: string; question?: string; answer: string; category?: string; priority?: number },
  ) {
    const res = await fetch(`${API_BASE}/ai/autopilot/campgrounds/${campgroundId}/context`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...scopedHeaders() },
      body: JSON.stringify(data),
    });
    return parseResponse(res, UnknownSchema);
  },

  async updateAutopilotContext(id: string, data: Record<string, unknown>) {
    const res = await fetch(`${API_BASE}/ai/autopilot/context/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", ...scopedHeaders() },
      body: JSON.stringify(data),
    });
    return parseResponse(res, UnknownSchema);
  },

  async deleteAutopilotContext(id: string) {
    const res = await fetch(`${API_BASE}/ai/autopilot/context/${id}`, {
      method: "DELETE",
      headers: scopedHeaders(),
    });
    return parseResponse(res, UnknownSchema);
  },

  async autoPopulateContext(campgroundId: string) {
    const res = await fetch(
      `${API_BASE}/ai/autopilot/campgrounds/${campgroundId}/context/auto-populate`,
      {
        method: "POST",
        headers: scopedHeaders(),
      },
    );
    return parseResponse(
      res,
      z.object({
        success: z.boolean(),
        created: z.number(),
      }),
    );
  },

  async getReplyDrafts(campgroundId: string, status?: string) {
    const params = new URLSearchParams();
    if (status) params.set("status", status);
    return fetchJSON(
      `/ai/autopilot/campgrounds/${campgroundId}/reply-drafts?${params}`,
      z.array(
        z.object({
          id: z.string(),
          communicationId: z.string(),
          inboundSubject: z.string().optional(),
          inboundPreview: z.string().optional(),
          draftContent: z.string(),
          confidence: z.number(),
          detectedIntent: z.string().optional(),
          detectedTone: z.string().optional(),
          status: z.string(),
          createdAt: z.string(),
          autoSendScheduledAt: z.string().optional(),
        }),
      ),
    );
  },

  async reviewReplyDraft(
    id: string,
    action: "approve" | "edit" | "reject",
    editedContent?: string,
    rejectionReason?: string,
  ) {
    const res = await fetch(`${API_BASE}/ai/autopilot/reply-drafts/${id}/review`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...scopedHeaders() },
      body: JSON.stringify({ action, editedContent, rejectionReason }),
    });
    return parseResponse(res, UnknownSchema);
  },

  async sendReplyDraft(id: string) {
    const res = await fetch(`${API_BASE}/ai/autopilot/reply-drafts/${id}/send`, {
      method: "POST",
      headers: scopedHeaders(),
    });
    return parseResponse(res, UnknownSchema);
  },

  async getAnomalyAlerts(campgroundId: string, status?: string, severity?: string) {
    const params = new URLSearchParams();
    if (status) params.set("status", status);
    if (severity) params.set("severity", severity);
    return fetchJSON(
      `/ai/autopilot/campgrounds/${campgroundId}/anomalies?${params}`,
      z.array(
        z.object({
          id: z.string(),
          type: z.string(),
          severity: z.string(),
          title: z.string(),
          summary: z.string(),
          aiAnalysis: z.string().optional(),
          suggestedAction: z.string().optional(),
          metric: z.string(),
          currentValue: z.number(),
          expectedValue: z.number(),
          deviation: z.number(),
          status: z.string(),
          detectedAt: z.string(),
        }),
      ),
    );
  },

  async updateAnomalyStatus(
    id: string,
    status: "acknowledged" | "resolved" | "dismissed",
    dismissedReason?: string,
  ) {
    const res = await fetch(`${API_BASE}/ai/autopilot/anomalies/${id}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", ...scopedHeaders() },
      body: JSON.stringify({ status, dismissedReason }),
    });
    return parseResponse(res, UnknownSchema);
  },

  async runAnomalyCheck(campgroundId: string) {
    const res = await fetch(
      `${API_BASE}/ai/autopilot/campgrounds/${campgroundId}/anomalies/check`,
      {
        method: "POST",
        headers: scopedHeaders(),
      },
    );
    return parseResponse(
      res,
      z.object({
        checked: z.boolean(),
        alerts: UnknownArraySchema,
      }),
    );
  },

  async getNoShowRisks(campgroundId: string, flaggedOnly?: boolean, daysAhead?: number) {
    const params = new URLSearchParams();
    if (flaggedOnly) params.set("flaggedOnly", "true");
    if (daysAhead) params.set("daysAhead", String(daysAhead));
    return fetchJSON(
      `/ai/autopilot/campgrounds/${campgroundId}/no-show-risks?${params}`,
      z.array(
        z.object({
          id: z.string(),
          reservationId: z.string(),
          riskScore: z.number(),
          paymentStatusScore: z.number(),
          leadTimeScore: z.number(),
          guestHistoryScore: z.number(),
          communicationScore: z.number(),
          bookingPatternScore: z.number(),
          riskReason: z.string().optional(),
          flagged: z.boolean(),
          guestConfirmed: z.boolean(),
          reminderSentAt: z.string().optional(),
          reservation: z.object({
            id: z.string(),
            confirmationNumber: z.string(),
            arrivalDate: z.string(),
            departureDate: z.string(),
            status: z.string(),
            guest: z.object({
              id: z.string(),
              primaryFirstName: z.string().optional(),
              primaryLastName: z.string().optional(),
              email: z.string().optional(),
            }),
            site: z.object({ id: z.string(), name: z.string() }).optional(),
          }),
        }),
      ),
    );
  },

  async sendNoShowReminder(reservationId: string) {
    const res = await fetch(
      `${API_BASE}/ai/autopilot/reservations/${reservationId}/no-show-risk/remind`,
      {
        method: "POST",
        headers: scopedHeaders(),
      },
    );
    return parseResponse(
      res,
      z.object({
        sent: z.boolean(),
        to: z.string(),
      }),
    );
  },

  async markNoShowConfirmed(reservationId: string, source?: string) {
    const res = await fetch(
      `${API_BASE}/ai/autopilot/reservations/${reservationId}/no-show-risk/confirm`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", ...scopedHeaders() },
        body: JSON.stringify({ source }),
      },
    );
    return parseResponse(res, UnknownSchema);
  },

  async getWaitlistAiScores(campgroundId: string) {
    return fetchJSON(
      `/ai/autopilot/campgrounds/${campgroundId}/waitlist/ai-scores`,
      z.array(
        z.object({
          id: z.string(),
          waitlistEntryId: z.string(),
          aiScore: z.number(),
          baseScore: z.number(),
          guestLtvScore: z.number(),
          bookingLikelihood: z.number(),
          seasonalFitScore: z.number(),
          communicationScore: z.number(),
          aiReason: z.string().optional(),
          waitlistEntry: z.object({
            id: z.string(),
            guest: z.object({
              id: z.string(),
              primaryFirstName: z.string().optional(),
              primaryLastName: z.string().optional(),
              email: z.string().optional(),
            }),
            site: z.object({ id: z.string(), name: z.string() }).optional(),
            siteClass: z.object({ id: z.string(), name: z.string() }).optional(),
          }),
        }),
      ),
    );
  },

  async rescoreWaitlist(campgroundId: string) {
    const res = await fetch(
      `${API_BASE}/ai/autopilot/campgrounds/${campgroundId}/waitlist/rescore`,
      {
        method: "POST",
        headers: scopedHeaders(),
      },
    );
    return parseResponse(
      res,
      z.object({
        scored: z.number(),
        total: z.number(),
      }),
    );
  },

  // ==================== AI AUTONOMOUS FEATURES ====================

  // Dashboard
  async getAiDashboard(campgroundId: string) {
    return fetchJSON(
      `/ai/autopilot/campgrounds/${campgroundId}/dashboard`,
      z.object({
        quickStats: z.object({
          needsAttention: z.number(),
          pendingReplies: z.number(),
          activeAnomalies: z.number(),
          pendingPricing: z.number(),
          activeMaintenanceAlerts: z.number(),
          activeWeatherAlerts: z.number(),
          todayCalls: z.number(),
        }),
        metrics: z.object({
          messagesHandled: z.number(),
          messagesAutoSent: z.number(),
          risksIdentified: z.number(),
          noShowsPrevented: z.number(),
          pricingSuggestions: z.number(),
          phoneCallsHandled: z.number(),
          estimatedRevenueSavedCents: z.number(),
          aiCostCents: z.number(),
          roiPercent: z.number(),
        }),
        activity: z.array(
          z.object({
            id: z.string(),
            type: z.string(),
            title: z.string(),
            subtitle: z.string(),
            timestamp: z.string(),
            icon: z.string(),
            color: z.string(),
          }),
        ),
      }),
    );
  },

  async getAiActivityFeed(campgroundId: string, limit?: number) {
    const params = limit ? `?limit=${limit}` : "";
    return fetchJSON(
      `/ai/autopilot/campgrounds/${campgroundId}/dashboard/activity${params}`,
      z.array(
        z.object({
          id: z.string(),
          type: z.string(),
          title: z.string(),
          subtitle: z.string(),
          timestamp: z.string(),
          icon: z.string(),
          color: z.string(),
        }),
      ),
    );
  },

  // Dynamic Pricing
  async getPricingRecommendations(campgroundId: string, status?: string) {
    const params = status ? `?status=${status}` : "";
    return fetchJSON(
      `/ai/autopilot/campgrounds/${campgroundId}/pricing/recommendations${params}`,
      z.array(
        z.object({
          id: z.string(),
          siteClassId: z.string().nullable(),
          dateStart: z.string(),
          dateEnd: z.string(),
          recommendationType: z.string(),
          currentPriceCents: z.number(),
          suggestedPriceCents: z.number(),
          adjustmentPercent: z.number(),
          confidence: z.number(),
          reasoning: z.string(),
          status: z.string(),
          estimatedRevenueDelta: z.number().nullable(),
        }),
      ),
    );
  },

  async applyPricingRecommendation(id: string) {
    const res = await fetch(`${API_BASE}/ai/autopilot/pricing/recommendations/${id}/apply`, {
      method: "POST",
      headers: scopedHeaders(),
    });
    return parseResponse(res, UnknownSchema);
  },

  async dismissPricingRecommendation(id: string, reason?: string) {
    const res = await fetch(`${API_BASE}/ai/autopilot/pricing/recommendations/${id}/dismiss`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...scopedHeaders() },
      body: JSON.stringify({ reason }),
    });
    return parseResponse(res, UnknownSchema);
  },

  async getPricingSummary(campgroundId: string) {
    return fetchJSON(
      `/ai/autopilot/campgrounds/${campgroundId}/pricing/summary`,
      z.object({
        pendingRecommendations: z.number(),
        appliedLast30Days: z.number(),
        estimatedRevenueDeltaCents: z.number(),
        averageAdjustmentPercent: z.number(),
      }),
    );
  },

  async getPriceSensitivity(campgroundId: string, siteClassId?: string) {
    const params = siteClassId ? `?siteClassId=${siteClassId}` : "";
    return fetchJSON(
      `/ai/autopilot/campgrounds/${campgroundId}/pricing/sensitivity${params}`,
      z.object({
        elasticity: z.number(),
        optimalPriceRange: z.object({ min: z.number(), max: z.number() }),
        pricePoints: z.array(
          z.object({
            price: z.number(),
            conversionRate: z.number(),
            bookings: z.number(),
          }),
        ),
        insight: z.string(),
      }),
    );
  },

  // Revenue Insights
  async getRevenueInsights(campgroundId: string, status?: string) {
    const params = status ? `?status=${status}` : "";
    return fetchJSON(
      `/ai/autopilot/campgrounds/${campgroundId}/revenue/insights${params}`,
      z.array(
        z.object({
          id: z.string(),
          insightType: z.string(),
          title: z.string(),
          summary: z.string(),
          impactCents: z.number(),
          difficulty: z.string(),
          priority: z.number(),
          recommendations: z.array(z.object({ action: z.string(), details: z.string() })),
          status: z.string(),
        }),
      ),
    );
  },

  async startRevenueInsight(id: string) {
    const res = await fetch(`${API_BASE}/ai/autopilot/revenue/insights/${id}/start`, {
      method: "POST",
      headers: scopedHeaders(),
    });
    return parseResponse(res, UnknownSchema);
  },

  async completeRevenueInsight(id: string) {
    const res = await fetch(`${API_BASE}/ai/autopilot/revenue/insights/${id}/complete`, {
      method: "POST",
      headers: scopedHeaders(),
    });
    return parseResponse(res, UnknownSchema);
  },

  async dismissRevenueInsight(id: string, reason?: string) {
    const res = await fetch(`${API_BASE}/ai/autopilot/revenue/insights/${id}/dismiss`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...scopedHeaders() },
      body: JSON.stringify({ reason }),
    });
    return parseResponse(res, UnknownSchema);
  },

  async getRevenueSummary(campgroundId: string) {
    return fetchJSON(
      `/ai/autopilot/campgrounds/${campgroundId}/revenue/summary`,
      z.object({
        totalOpportunityCents: z.number(),
        activeInsights: z.number(),
        newInsights: z.number(),
        byType: z.record(z.object({ count: z.number(), impact: z.number() })),
      }),
    );
  },

  // Yield Management
  async getYieldDashboard(campgroundId: string) {
    return fetchJSON(
      `/ai/autopilot/campgrounds/${campgroundId}/yield/dashboard`,
      z.object({
        metrics: z.object({
          todayOccupancy: z.number(),
          todayRevenue: z.number(),
          todayADR: z.number(),
          todayRevPAN: z.number(),
          periodOccupancy: z.number(),
          periodRevenue: z.number(),
          periodADR: z.number(),
          periodRevPAN: z.number(),
          periodNights: z.number(),
          yoyChange: z
            .object({
              occupancy: z.number(),
              revenue: z.number(),
              adr: z.number(),
            })
            .nullable(),
          next7DaysOccupancy: z.number(),
          next30DaysOccupancy: z.number(),
          forecastRevenue30Days: z.number(),
          gapNights: z.number(),
          pendingRecommendations: z.number(),
          potentialRevenue: z.number(),
        }),
        occupancyTrend: z.array(
          z.object({
            date: z.string(),
            occupancy: z.number(),
            revenue: z.number(),
          }),
        ),
        forecasts: z.array(
          z.object({
            date: z.string(),
            occupiedSites: z.number(),
            totalSites: z.number(),
            occupancyPct: z.number(),
            projectedRevenue: z.number(),
          }),
        ),
        topRecommendations: z.array(
          z.object({
            id: z.string(),
            siteClassId: z.string(),
            dateStart: z.string(),
            dateEnd: z.string(),
            currentPrice: z.number(),
            suggestedPrice: z.number(),
            adjustmentPercent: z.number(),
            confidence: z.number(),
            estimatedRevenueDelta: z.number(),
            status: z.string(),
          }),
        ),
        revenueInsights: z.array(
          z.object({
            id: z.string(),
            insightType: z.string(),
            title: z.string(),
            description: z.string(),
            priority: z.number(),
            estimatedValueCents: z.number().nullable(),
            status: z.string(),
          }),
        ),
      }),
    );
  },

  async getYieldMetrics(campgroundId: string, options?: { startDate?: string; endDate?: string }) {
    const params = new URLSearchParams();
    if (options?.startDate) params.append("startDate", options.startDate);
    if (options?.endDate) params.append("endDate", options.endDate);
    const query = params.toString() ? `?${params.toString()}` : "";
    return fetchJSON(
      `/ai/autopilot/campgrounds/${campgroundId}/yield/metrics${query}`,
      z.object({
        todayOccupancy: z.number(),
        todayRevenue: z.number(),
        todayADR: z.number(),
        todayRevPAN: z.number(),
        periodOccupancy: z.number(),
        periodRevenue: z.number(),
        periodADR: z.number(),
        periodRevPAN: z.number(),
        periodNights: z.number(),
        yoyChange: z
          .object({
            occupancy: z.number(),
            revenue: z.number(),
            adr: z.number(),
          })
          .nullable(),
        next7DaysOccupancy: z.number(),
        next30DaysOccupancy: z.number(),
        forecastRevenue30Days: z.number(),
        gapNights: z.number(),
        pendingRecommendations: z.number(),
        potentialRevenue: z.number(),
      }),
    );
  },

  async getOccupancyTrend(campgroundId: string, days?: number) {
    const query = days ? `?days=${days}` : "";
    return fetchJSON(
      `/ai/autopilot/campgrounds/${campgroundId}/yield/occupancy-trend${query}`,
      z.array(z.object({ date: z.string(), occupancy: z.number(), revenue: z.number() })),
    );
  },

  async getYieldForecast(campgroundId: string, days?: number) {
    const query = days ? `?days=${days}` : "";
    return fetchJSON(
      `/ai/autopilot/campgrounds/${campgroundId}/yield/forecast${query}`,
      z.object({
        forecasts: z.array(
          z.object({
            date: z.string(),
            occupiedSites: z.number(),
            totalSites: z.number(),
            occupancyPct: z.number(),
            projectedRevenue: z.number(),
          }),
        ),
        avgOccupancy: z.number(),
        totalRevenue: z.number(),
      }),
    );
  },

  async backfillYieldSnapshots(campgroundId: string, days?: number) {
    const res = await fetch(`${API_BASE}/ai/autopilot/campgrounds/${campgroundId}/yield/backfill`, {
      method: "POST",
      headers: scopedHeaders(),
      body: JSON.stringify({ days: days || 90 }),
    });
    return parseResponse(
      res,
      z.object({
        success: z.boolean(),
        recordedDays: z.number(),
      }),
    );
  },

  // Demand Forecasting
  async getDemandForecast(campgroundId: string, days?: number) {
    const query = days ? `?days=${days}` : "";
    return fetchJSON(
      `/ai/autopilot/campgrounds/${campgroundId}/demand/forecast${query}`,
      z.object({
        forecasts: z.array(
          z.object({
            date: z.string(),
            predictedOccupancy: z.number(),
            predictedRevenue: z.number(),
            confidenceLow: z.number(),
            confidenceHigh: z.number(),
            demandLevel: z.enum(["very_low", "low", "moderate", "high", "very_high"]),
            factors: z.array(
              z.object({ name: z.string(), impact: z.number(), description: z.string() }),
            ),
            existingBookings: z.number(),
          }),
        ),
        summary: z.object({
          avgPredictedOccupancy: z.number(),
          totalPredictedRevenue: z.number(),
          highDemandDays: z.number(),
          lowDemandDays: z.number(),
          confidenceScore: z.number(),
        }),
      }),
    );
  },

  async getDemandHeatmap(campgroundId: string, startDate?: string, endDate?: string) {
    const params = new URLSearchParams();
    if (startDate) params.set("startDate", startDate);
    if (endDate) params.set("endDate", endDate);
    const query = params.toString() ? `?${params.toString()}` : "";
    return fetchJSON(
      `/ai/autopilot/campgrounds/${campgroundId}/demand/heatmap${query}`,
      z.array(
        z.object({
          date: z.string(),
          demandScore: z.number(),
          demandLevel: z.enum(["very_low", "low", "moderate", "high", "very_high"]),
          predictedOccupancy: z.number(),
          existingOccupancy: z.number(),
          isWeekend: z.boolean(),
          isHoliday: z.boolean(),
          holidayName: z.string().optional(),
        }),
      ),
    );
  },

  async getDemandInsights(campgroundId: string) {
    return fetchJSON(
      `/ai/autopilot/campgrounds/${campgroundId}/demand/insights`,
      z.object({
        peakDemandPeriods: z.array(
          z.object({
            startDate: z.string(),
            endDate: z.string(),
            avgDemand: z.number(),
            reason: z.string(),
          }),
        ),
        lowDemandPeriods: z.array(
          z.object({
            startDate: z.string(),
            endDate: z.string(),
            avgDemand: z.number(),
            suggestion: z.string(),
          }),
        ),
        upcomingOpportunities: z.array(
          z.object({
            date: z.string(),
            type: z.string(),
            description: z.string(),
          }),
        ),
      }),
    );
  },

  async getDemandAnalysis(campgroundId: string) {
    return fetchJSON(
      `/ai/autopilot/campgrounds/${campgroundId}/demand/analysis`,
      z.object({
        baselineOccupancy: z.number(),
        seasonality: z.array(
          z.object({
            month: z.number(),
            factor: z.number(),
            isHighSeason: z.boolean(),
          }),
        ),
        dayOfWeek: z.array(
          z.object({
            dayOfWeek: z.number(),
            factor: z.number(),
            avgOccupancy: z.number(),
          }),
        ),
        recentTrend: z.number(),
        variance: z.number(),
        dataPoints: z.number(),
      }),
    );
  },

  // Predictive Maintenance
  async getMaintenanceAlerts(campgroundId: string, status?: string) {
    const params = status ? `?status=${status}` : "";
    return fetchJSON(
      `/ai/autopilot/campgrounds/${campgroundId}/maintenance/alerts${params}`,
      z.array(
        z.object({
          id: z.string(),
          siteId: z.string().nullable(),
          alertType: z.string(),
          severity: z.string(),
          category: z.string(),
          title: z.string(),
          summary: z.string(),
          incidentCount: z.number(),
          confidence: z.number(),
          suggestedAction: z.string(),
          estimatedCostCents: z.number().nullable(),
          status: z.string(),
        }),
      ),
    );
  },

  async acknowledgeMaintenanceAlert(id: string) {
    const res = await fetch(`${API_BASE}/ai/autopilot/maintenance/alerts/${id}/acknowledge`, {
      method: "POST",
      headers: scopedHeaders(),
    });
    return parseResponse(res, UnknownSchema);
  },

  async resolveMaintenanceAlert(id: string) {
    const res = await fetch(`${API_BASE}/ai/autopilot/maintenance/alerts/${id}/resolve`, {
      method: "POST",
      headers: scopedHeaders(),
    });
    return parseResponse(res, UnknownSchema);
  },

  async getMaintenanceSummary(campgroundId: string) {
    return fetchJSON(
      `/ai/autopilot/campgrounds/${campgroundId}/maintenance/summary`,
      z.object({
        activeAlerts: z.number(),
        critical: z.number(),
        high: z.number(),
        medium: z.number(),
        low: z.number(),
        requiresAttention: z.number(),
      }),
    );
  },

  // Weather
  async getCurrentWeather(campgroundId: string) {
    return fetchJSON(
      `/ai/autopilot/campgrounds/${campgroundId}/weather/current`,
      z.union([
        z.object({
          temp: z.number(),
          temperature: z.number().optional(),
          feelsLike: z.number(),
          humidity: z.number(),
          windSpeed: z.number(),
          windGust: z.number().optional(),
          description: z.string(),
          icon: z.string(),
          updatedAt: z.string().optional(),
          alerts: z.array(
            z.object({
              event: z.string(),
              severity: z.string(),
              headline: z.string(),
              start: z.string(),
              end: z.string(),
            }),
          ),
        }),
        z.null(),
      ]),
    );
  },

  async getWeatherForecast(campgroundId: string) {
    return fetchJSON(
      `/ai/autopilot/campgrounds/${campgroundId}/weather/forecast`,
      z.array(
        z.object({
          date: z.string(),
          tempHigh: z.number(),
          tempLow: z.number(),
          description: z.string(),
          icon: z.string(),
          pop: z.number(),
          windSpeed: z.number(),
        }),
      ),
    );
  },

  async getWeatherAlerts(campgroundId: string) {
    return fetchJSON(
      `/ai/autopilot/campgrounds/${campgroundId}/weather/alerts`,
      z.array(
        z.object({
          id: z.string(),
          alertType: z.string(),
          severity: z.string(),
          title: z.string(),
          message: z.string(),
          startTime: z.string(),
          guestsAffected: z.number(),
          guestsNotified: z.number(),
          status: z.string(),
        }),
      ),
    );
  },

  async sendWeatherNotifications(alertId: string) {
    const res = await fetch(`${API_BASE}/ai/autopilot/weather/alerts/${alertId}/notify`, {
      method: "POST",
      headers: scopedHeaders(),
    });
    return parseResponse(
      res,
      z.object({
        sent: z.number(),
        total: z.number(),
      }),
    );
  },

  // Phone Agent
  async getPhoneSessions(campgroundId: string, status?: string, limit?: number) {
    const params = new URLSearchParams();
    if (status) params.set("status", status);
    if (limit) params.set("limit", String(limit));
    const query = params.toString() ? `?${params}` : "";
    return fetchJSON(
      `/ai/autopilot/campgrounds/${campgroundId}/phone/sessions${query}`,
      z.array(
        z.object({
          id: z.string(),
          callerPhone: z.string(),
          status: z.string(),
          startedAt: z.string(),
          endedAt: z.string().nullable(),
          durationSeconds: z.number().nullable(),
          intents: z.array(z.string()),
          summary: z.string().nullable(),
          resolutionStatus: z.string().nullable(),
        }),
      ),
    );
  },

  async getPhoneSummary(campgroundId: string, days?: number) {
    const params = days ? `?days=${days}` : "";
    return fetchJSON(
      `/ai/autopilot/campgrounds/${campgroundId}/phone/summary${params}`,
      z.object({
        totalCalls: z.number(),
        callsHandled: z.number(),
        callsTransferred: z.number(),
        voicemails: z.number(),
        avgDurationSeconds: z.number(),
        totalCostCents: z.number(),
        resolutionRate: z.number(),
      }),
    );
  },

  // Autonomous Actions
  async getAutonomousActions(campgroundId: string, actionType?: string, limit?: number) {
    const params = new URLSearchParams();
    if (actionType) params.set("actionType", actionType);
    if (limit) params.set("limit", String(limit));
    const query = params.toString() ? `?${params}` : "";
    return fetchJSON(
      `/ai/autopilot/campgrounds/${campgroundId}/autonomous-actions${query}`,
      z.array(
        z.object({
          id: z.string(),
          actionType: z.string(),
          entityType: z.string(),
          entityId: z.string(),
          description: z.string(),
          confidence: z.number().nullable(),
          reversible: z.boolean(),
          reversedAt: z.string().nullable(),
          outcome: z.string().nullable(),
          createdAt: z.string(),
        }),
      ),
    );
  },

  async reverseAutonomousAction(id: string, reason: string) {
    const res = await fetch(`${API_BASE}/ai/autopilot/autonomous-actions/${id}/reverse`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...scopedHeaders() },
      body: JSON.stringify({ reason }),
    });
    return parseResponse(res, UnknownSchema);
  },

  async getAutonomousActionsSummary(campgroundId: string, days?: number) {
    const params = days ? `?days=${days}` : "";
    return fetchJSON(
      `/ai/autopilot/campgrounds/${campgroundId}/autonomous-actions/summary${params}`,
      z.record(
        z.object({
          total: z.number(),
          success: z.number(),
          reversed: z.number(),
        }),
      ),
    );
  },

  // =============================================================================
  // STRIPE PAYMENTS - Terminal, Saved Cards, Refunds
  // =============================================================================

  // Terminal Locations
  async getTerminalLocations(campgroundId: string) {
    return fetchJSON(
      `/campgrounds/${campgroundId}/terminal/locations`,
      z.array(
        z.object({
          id: z.string(),
          campgroundId: z.string(),
          stripeLocationId: z.string(),
          displayName: z.string(),
          address: z
            .object({
              line1: z.string(),
              line2: z.string().optional(),
              city: z.string(),
              state: z.string(),
              postal_code: z.string(),
              country: z.string().optional(),
            })
            .nullable(),
          isActive: z.boolean(),
          readerCount: z.number(),
          createdAt: z.string(),
        }),
      ),
    );
  },

  async createTerminalLocation(
    campgroundId: string,
    payload: {
      displayName: string;
      address: {
        line1: string;
        line2?: string;
        city: string;
        state: string;
        postal_code: string;
        country?: string;
      };
    },
  ) {
    const res = await fetch(`${API_BASE}/campgrounds/${campgroundId}/terminal/locations`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...scopedHeaders() },
      body: JSON.stringify(payload),
    });
    return parseResponse(
      res,
      z.object({
        id: z.string(),
        stripeLocationId: z.string(),
      }),
    );
  },

  async deleteTerminalLocation(campgroundId: string, locationId: string) {
    const res = await fetch(
      `${API_BASE}/campgrounds/${campgroundId}/terminal/locations/${locationId}`,
      {
        method: "DELETE",
        headers: scopedHeaders(),
      },
    );
    if (!res.ok) throw new Error("Failed to delete terminal location");
    return true;
  },

  // Terminal Readers
  async getTerminalReaders(campgroundId: string, locationId?: string) {
    const params = locationId ? `?locationId=${locationId}` : "";
    return fetchJSON(
      `/campgrounds/${campgroundId}/terminal/readers${params}`,
      z.array(
        z.object({
          id: z.string(),
          campgroundId: z.string(),
          locationId: z.string().nullable(),
          stripeReaderId: z.string(),
          label: z.string(),
          deviceType: z.string(),
          status: z.string(),
          serialNumber: z.string().nullable(),
          ipAddress: z.string().nullable(),
          lastSeenAt: z.string().nullable(),
          createdAt: z.string(),
          location: z.object({ displayName: z.string() }).nullable().optional(),
        }),
      ),
    );
  },

  async registerTerminalReader(
    campgroundId: string,
    payload: {
      registrationCode: string;
      label: string;
      locationId?: string;
    },
  ) {
    const res = await fetch(`${API_BASE}/campgrounds/${campgroundId}/terminal/readers`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...scopedHeaders() },
      body: JSON.stringify(payload),
    });
    return parseResponse(
      res,
      z.object({
        id: z.string(),
        stripeReaderId: z.string(),
      }),
    );
  },

  async updateTerminalReader(campgroundId: string, readerId: string, payload: { label: string }) {
    const res = await fetch(
      `${API_BASE}/campgrounds/${campgroundId}/terminal/readers/${readerId}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...scopedHeaders() },
        body: JSON.stringify(payload),
      },
    );
    return parseResponse(res, IdSchema);
  },

  async deleteTerminalReader(campgroundId: string, readerId: string) {
    const res = await fetch(
      `${API_BASE}/campgrounds/${campgroundId}/terminal/readers/${readerId}`,
      {
        method: "DELETE",
        headers: scopedHeaders(),
      },
    );
    if (!res.ok) throw new Error("Failed to delete terminal reader");
    return true;
  },

  async getTerminalConnectionToken(campgroundId: string, readerId: string) {
    const res = await fetch(
      `${API_BASE}/campgrounds/${campgroundId}/terminal/readers/${readerId}/connection-token`,
      {
        method: "POST",
        headers: scopedHeaders(),
      },
    );
    return parseResponse(res, z.object({ secret: z.string() }));
  },

  // Terminal Payments
  async createTerminalPayment(
    campgroundId: string,
    payload: {
      readerId: string;
      amountCents: number;
      currency?: string;
      guestId?: string;
      reservationId?: string;
      saveCard?: boolean;
      metadata?: Record<string, string>;
    },
  ) {
    const res = await fetch(`${API_BASE}/campgrounds/${campgroundId}/terminal/payments`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...scopedHeaders() },
      body: JSON.stringify(payload),
    });
    return parseResponse(
      res,
      z.object({
        paymentIntentId: z.string(),
        clientSecret: z.string(),
        status: z.string(),
      }),
    );
  },

  async processTerminalPayment(campgroundId: string, readerId: string, paymentIntentId: string) {
    const res = await fetch(`${API_BASE}/campgrounds/${campgroundId}/terminal/payments/process`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...scopedHeaders() },
      body: JSON.stringify({ readerId, paymentIntentId }),
    });
    return parseResponse(
      res,
      z.object({
        success: z.boolean(),
        status: z.string(),
        paymentId: z.string().optional(),
        error: z.string().optional(),
      }),
    );
  },

  async cancelTerminalPayment(campgroundId: string, paymentIntentId: string) {
    const res = await fetch(
      `${API_BASE}/campgrounds/${campgroundId}/terminal/payments/${paymentIntentId}`,
      {
        method: "DELETE",
        headers: scopedHeaders(),
      },
    );
    return parseResponse(res, z.object({ canceled: z.boolean() }));
  },

  // Guest Payment Methods (Saved Cards)
  async createPaymentMethodSetupIntent(
    campgroundId: string,
    guestId: string,
    metadata?: Record<string, string>,
  ) {
    const res = await fetch(
      `${API_BASE}/campgrounds/${campgroundId}/payment-methods/setup-intent`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", ...scopedHeaders() },
        body: JSON.stringify({ guestId, metadata }),
      },
    );
    return parseResponse(
      res,
      z.object({
        setupIntentId: z.string(),
        clientSecret: z.string(),
        customerId: z.string(),
      }),
    );
  },

  async attachPaymentMethod(
    campgroundId: string,
    payload: {
      guestId: string;
      stripePaymentMethodId: string;
      nickname?: string;
      setAsDefault?: boolean;
    },
  ) {
    const res = await fetch(`${API_BASE}/campgrounds/${campgroundId}/payment-methods/attach`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...scopedHeaders() },
      body: JSON.stringify(payload),
    });
    return parseResponse(
      res,
      z.object({
        id: z.string(),
        last4: z.string(),
        brand: z.string(),
      }),
    );
  },

  async getGuestPaymentMethods(campgroundId: string, guestId: string) {
    return fetchJSON(
      `/campgrounds/${campgroundId}/payment-methods/guest/${guestId}`,
      z.array(
        z.object({
          id: z.string(),
          stripePaymentMethodId: z.string(),
          type: z.string(),
          last4: z.string().nullable(),
          brand: z.string().nullable(),
          expMonth: z.number().nullable(),
          expYear: z.number().nullable(),
          isDefault: z.boolean(),
          nickname: z.string().nullable(),
          addedBy: z.string(),
          createdAt: z.string(),
        }),
      ),
    );
  },

  async updatePaymentMethod(
    campgroundId: string,
    paymentMethodId: string,
    payload: { nickname?: string },
  ) {
    const res = await fetch(
      `${API_BASE}/campgrounds/${campgroundId}/payment-methods/${paymentMethodId}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...scopedHeaders() },
        body: JSON.stringify(payload),
      },
    );
    return parseResponse(res, IdSchema);
  },

  async deletePaymentMethod(campgroundId: string, paymentMethodId: string) {
    const res = await fetch(
      `${API_BASE}/campgrounds/${campgroundId}/payment-methods/${paymentMethodId}`,
      {
        method: "DELETE",
        headers: scopedHeaders(),
      },
    );
    if (!res.ok) throw new Error("Failed to delete payment method");
    return true;
  },

  async setDefaultPaymentMethod(campgroundId: string, guestId: string, paymentMethodId: string) {
    const res = await fetch(
      `${API_BASE}/campgrounds/${campgroundId}/payment-methods/${paymentMethodId}/default`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", ...scopedHeaders() },
        body: JSON.stringify({ guestId }),
      },
    );
    return parseResponse(res, IdSchema);
  },

  // Charge Saved Cards
  async chargeSavedCard(
    campgroundId: string,
    payload: {
      guestId: string;
      paymentMethodId: string;
      amountCents: number;
      currency?: string;
      reservationId?: string;
      description?: string;
      metadata?: Record<string, string>;
    },
  ) {
    const res = await fetch(`${API_BASE}/campgrounds/${campgroundId}/saved-cards/charge`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...scopedHeaders() },
      body: JSON.stringify(payload),
    });
    return parseResponse(
      res,
      z.object({
        success: z.boolean(),
        paymentId: z.string(),
        paymentIntentId: z.string(),
        status: z.string(),
      }),
    );
  },

  async chargeDefaultCard(
    campgroundId: string,
    payload: {
      guestId: string;
      amountCents: number;
      currency?: string;
      reservationId?: string;
      metadata?: Record<string, string>;
    },
  ) {
    const res = await fetch(`${API_BASE}/campgrounds/${campgroundId}/saved-cards/charge-default`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...scopedHeaders() },
      body: JSON.stringify(payload),
    });
    return parseResponse(
      res,
      z.object({
        success: z.boolean(),
        paymentId: z.string(),
        paymentIntentId: z.string(),
        status: z.string(),
      }),
    );
  },

  async getChargeablePaymentMethods(campgroundId: string, guestId: string) {
    return fetchJSON(
      `/campgrounds/${campgroundId}/saved-cards/guest/${guestId}/chargeable`,
      z.array(
        z.object({
          id: z.string(),
          type: z.string(),
          last4: z.string().nullable(),
          brand: z.string().nullable(),
          isDefault: z.boolean(),
          nickname: z.string().nullable(),
        }),
      ),
    );
  },

  // Refunds
  async getRefundEligibility(campgroundId: string, paymentId: string) {
    return fetchJSON(
      `/campgrounds/${campgroundId}/refunds/${paymentId}/eligibility`,
      z.object({
        eligible: z.boolean(),
        reason: z.string().optional(),
        maxRefundCents: z.number(),
        alreadyRefundedCents: z.number(),
        originalAmountCents: z.number(),
        originalPaymentMethod: z
          .object({
            type: z.string(),
            last4: z.string().optional(),
            brand: z.string().optional(),
          })
          .nullable(),
      }),
    );
  },

  async processRefund(
    campgroundId: string,
    paymentId: string,
    payload: {
      amountCents?: number;
      reason?: "duplicate" | "fraudulent" | "requested_by_customer";
      note?: string;
    },
  ) {
    const res = await fetch(`${API_BASE}/campgrounds/${campgroundId}/refunds/${paymentId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...scopedHeaders() },
      body: JSON.stringify(payload),
    });
    return parseResponse(
      res,
      z.object({
        refundId: z.string(),
        stripeRefundId: z.string(),
        amountCents: z.number(),
        status: z.string(),
      }),
    );
  },

  async getRefundHistory(campgroundId: string, paymentId: string) {
    return fetchJSON(
      `/campgrounds/${campgroundId}/refunds/${paymentId}/history`,
      z.array(
        z.object({
          id: z.string(),
          stripeRefundId: z.string(),
          amountCents: z.number(),
          status: z.string(),
          reason: z.string().nullable(),
          createdAt: z.string(),
        }),
      ),
    );
  },

  // Portal - Guest Payment Methods (for self-service)
  async getPortalPaymentMethods(token: string) {
    const res = await fetch(`${API_BASE}/portal/payment-methods`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return parseResponse(
      res,
      z.array(
        z.object({
          id: z.string(),
          campgroundId: z.string(),
          campgroundName: z.string(),
          type: z.string(),
          last4: z.string().nullable(),
          brand: z.string().nullable(),
          expMonth: z.number().nullable(),
          expYear: z.number().nullable(),
          isDefault: z.boolean(),
          nickname: z.string().nullable(),
          createdAt: z.string(),
        }),
      ),
    );
  },

  async createPortalSetupIntent(token: string, campgroundId: string) {
    const res = await fetch(`${API_BASE}/portal/payment-methods/setup-intent`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ campgroundId }),
    });
    return parseResponse(
      res,
      z.object({
        setupIntentId: z.string(),
        clientSecret: z.string(),
      }),
    );
  },

  async deletePortalPaymentMethod(token: string, paymentMethodId: string) {
    const res = await fetch(`${API_BASE}/portal/payment-methods/${paymentMethodId}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) throw new Error("Failed to delete payment method");
    return true;
  },

  // =========================================================================
  // SMS Conversations (Threading)
  // =========================================================================
  async getSmsConversations(campgroundId: string) {
    const data = await fetchJSONUnknown(
      `/communications/sms/conversations?campgroundId=${campgroundId}`,
    );
    return z
      .array(
        z.object({
          conversationId: z.string(),
          lastMessageId: z.string(),
          lastMessagePreview: z.string(),
          lastMessageDirection: z.enum(["inbound", "outbound"]),
          lastMessageAt: z.string(),
          messageCount: z.number(),
          unreadCount: z.number(),
          guestId: z.string().nullable(),
          guestName: z.string().nullable(),
          phoneNumber: z.string().nullable(),
        }),
      )
      .parse(data);
  },
  async getSmsConversation(conversationId: string, campgroundId: string, limit?: number) {
    const url = `/communications/sms/conversations/${encodeURIComponent(conversationId)}?campgroundId=${campgroundId}${limit ? `&limit=${limit}` : ""}`;
    const data = await fetchJSONUnknown(url);
    return z
      .object({
        conversationId: z.string(),
        messages: z.array(
          z.object({
            id: z.string(),
            campgroundId: z.string(),
            guestId: z.string().nullable(),
            reservationId: z.string().nullable(),
            direction: z.string(),
            body: z.string().nullable(),
            status: z.string(),
            toAddress: z.string().nullable(),
            fromAddress: z.string().nullable(),
            createdAt: z.string(),
            guest: z
              .object({
                id: z.string(),
                primaryFirstName: z.string().nullable(),
                primaryLastName: z.string().nullable(),
                phone: z.string().nullable(),
              })
              .nullable(),
            reservation: z
              .object({
                id: z.string(),
                arrivalDate: z.string(),
                departureDate: z.string(),
                status: z.string(),
                site: z
                  .object({
                    siteNumber: z.string(),
                  })
                  .nullable(),
              })
              .nullable(),
          }),
        ),
      })
      .parse(data);
  },
  async replySmsConversation(conversationId: string, campgroundId: string, message: string) {
    const res = await fetch(
      `${API_BASE}/communications/sms/conversations/${encodeURIComponent(conversationId)}/reply`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", ...scopedHeaders() },
        body: JSON.stringify({ campgroundId, message }),
      },
    );
    return parseResponse(res, UnknownSchema);
  },
  async markSmsConversationRead(conversationId: string, campgroundId: string) {
    const res = await fetch(
      `${API_BASE}/communications/sms/conversations/${encodeURIComponent(conversationId)}/read?campgroundId=${campgroundId}`,
      {
        method: "PATCH",
        headers: scopedHeaders(),
      },
    );
    return parseResponse(res, z.object({ updated: z.number() }));
  },

  // ==================== SEASONAL GUESTS ====================

  async getSeasonalRateCards(campgroundId: string, seasonYear?: number) {
    const params = new URLSearchParams();
    if (seasonYear) params.set("seasonYear", String(seasonYear));
    const query = params.toString() ? `?${params.toString()}` : "";
    const res = await fetch(`${API_BASE}/seasonals/campground/${campgroundId}/rate-cards${query}`, {
      headers: scopedHeaders(),
    });
    return parseResponse(res, UnknownArraySchema);
  },

  async previewSeasonalPricing(dto: {
    rateCardId: string;
    isMetered?: boolean;
    paymentMethod?: string;
    paysInFull?: boolean;
    tenureYears?: number;
    commitDate?: string;
    isReturning?: boolean;
    siteClassId?: string;
    isReferral?: boolean;
    isMilitary?: boolean;
    isSenior?: boolean;
  }) {
    const res = await fetch(`${API_BASE}/seasonals/pricing/preview`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...scopedHeaders() },
      body: JSON.stringify(dto),
    });
    return parseResponse(res, UnknownSchema);
  },

  async createSeasonalGuest(dto: {
    guestId: string;
    currentSiteId?: string;
    rateCardId: string;
    firstSeasonYear: number;
    billingFrequency: string;
    preferredPaymentMethod?: string;
    paysInFull?: boolean;
    autoPayEnabled?: boolean;
    paymentDay?: number;
    isMetered?: boolean;
    meteredElectric?: boolean;
    meteredWater?: boolean;
    vehiclePlates?: string[];
    petCount?: number;
    petNotes?: string;
    emergencyContact?: string;
    emergencyPhone?: string;
    coiExpiresAt?: string;
    notes?: string;
  }) {
    const res = await fetch(`${API_BASE}/seasonals`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...scopedHeaders() },
      body: JSON.stringify(dto),
    });
    return parseResponse(res, UnknownSchema);
  },

  // ==================== COMPETITIVE INTELLIGENCE ====================

  async getCompetitors(campgroundId: string, includeInactive = false) {
    const params = includeInactive ? "?includeInactive=true" : "";
    const data = await fetchJSONUnknown(
      `/campgrounds/${campgroundId}/competitive/competitors${params}`,
    );
    return z
      .array(
        z.object({
          id: z.string(),
          campgroundId: z.string(),
          name: z.string(),
          url: z.string().optional(),
          notes: z.string().optional(),
          isActive: z.boolean(),
          createdAt: z.string(),
          updatedAt: z.string(),
          rates: z
            .array(
              z.object({
                id: z.string(),
                competitorId: z.string(),
                siteType: z.string(),
                rateNightly: z.number(),
                source: z.string(),
                capturedAt: z.string(),
                validFrom: z.string().optional(),
                validTo: z.string().optional(),
                notes: z.string().optional(),
              }),
            )
            .optional(),
        }),
      )
      .parse(data);
  },

  async getCompetitor(campgroundId: string, competitorId: string) {
    const data = await fetchJSONUnknown(
      `/campgrounds/${campgroundId}/competitive/competitors/${competitorId}`,
    );
    return z
      .object({
        id: z.string(),
        campgroundId: z.string(),
        name: z.string(),
        url: z.string().optional(),
        notes: z.string().optional(),
        isActive: z.boolean(),
        createdAt: z.string(),
        updatedAt: z.string(),
        rates: z
          .array(
            z.object({
              id: z.string(),
              competitorId: z.string(),
              siteType: z.string(),
              rateNightly: z.number(),
              source: z.string(),
              capturedAt: z.string(),
            }),
          )
          .optional(),
      })
      .parse(data);
  },

  async createCompetitor(
    campgroundId: string,
    payload: { name: string; url?: string; notes?: string },
  ) {
    const res = await fetch(`${API_BASE}/campgrounds/${campgroundId}/competitive/competitors`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...scopedHeaders() },
      body: JSON.stringify(payload),
    });
    return parseResponse(res, UnknownSchema);
  },

  async updateCompetitor(
    campgroundId: string,
    competitorId: string,
    payload: { name?: string; url?: string; notes?: string; isActive?: boolean },
  ) {
    const res = await fetch(
      `${API_BASE}/campgrounds/${campgroundId}/competitive/competitors/${competitorId}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...scopedHeaders() },
        body: JSON.stringify(payload),
      },
    );
    return parseResponse(res, UnknownSchema);
  },

  async deleteCompetitor(campgroundId: string, competitorId: string) {
    const res = await fetch(
      `${API_BASE}/campgrounds/${campgroundId}/competitive/competitors/${competitorId}`,
      {
        method: "DELETE",
        headers: scopedHeaders(),
      },
    );
    if (!res.ok) {
      const error = await res.json().catch(() => ({}));
      throw new Error(error.message || "Failed to delete competitor");
    }
    return true;
  },

  async getCompetitorRates(campgroundId: string, siteType?: string) {
    const params = siteType ? `?siteType=${siteType}` : "";
    const data = await fetchJSONUnknown(`/campgrounds/${campgroundId}/competitive/rates${params}`);
    return z
      .array(
        z.object({
          id: z.string(),
          competitorId: z.string(),
          siteType: z.string(),
          rateNightly: z.number(),
          source: z.string(),
          capturedAt: z.string(),
          validFrom: z.string().optional(),
          validTo: z.string().optional(),
          notes: z.string().optional(),
          competitor: z.object({
            id: z.string(),
            name: z.string(),
          }),
        }),
      )
      .parse(data);
  },

  async createCompetitorRate(
    campgroundId: string,
    payload: {
      competitorId: string;
      siteType: string;
      rateNightly: number;
      source?: string;
      notes?: string;
    },
  ) {
    const res = await fetch(`${API_BASE}/campgrounds/${campgroundId}/competitive/rates`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...scopedHeaders() },
      body: JSON.stringify(payload),
    });
    return parseResponse(res, UnknownSchema);
  },

  async deleteCompetitorRate(campgroundId: string, rateId: string) {
    const res = await fetch(`${API_BASE}/campgrounds/${campgroundId}/competitive/rates/${rateId}`, {
      method: "DELETE",
      headers: scopedHeaders(),
    });
    if (!res.ok) {
      const error = await res.json().catch(() => ({}));
      throw new Error(error.message || "Failed to delete rate");
    }
    return true;
  },

  async getMarketPosition(campgroundId: string) {
    const data = await fetchJSONUnknown(`/campgrounds/${campgroundId}/competitive/market-position`);
    return z
      .array(
        z.object({
          siteType: z.string(),
          yourRate: z.number(),
          position: z.number(),
          totalCompetitors: z.number(),
          positionLabel: z.string(),
          averageMarketRate: z.number(),
          lowestRate: z.number(),
          highestRate: z.number(),
          competitorRates: z.array(
            z.object({
              competitorId: z.string(),
              competitorName: z.string(),
              rate: z.number(),
              difference: z.number(),
              percentDifference: z.number(),
            }),
          ),
        }),
      )
      .parse(data);
  },

  async getCompetitorComparison(campgroundId: string, siteType: string, date?: string) {
    const params = date ? `?date=${date}` : "";
    const data = await fetchJSONUnknown(
      `/campgrounds/${campgroundId}/competitive/comparison/${siteType}${params}`,
    );
    return z
      .object({
        siteType: z.string(),
        yourRate: z.number(),
        position: z.number(),
        totalCompetitors: z.number(),
        positionLabel: z.string(),
        averageMarketRate: z.number(),
        lowestRate: z.number(),
        highestRate: z.number(),
        competitorRates: z.array(
          z.object({
            competitorId: z.string(),
            competitorName: z.string(),
            rate: z.number(),
            difference: z.number(),
            percentDifference: z.number(),
          }),
        ),
      })
      .parse(data);
  },

  async checkRateParity(campgroundId: string) {
    const data = await fetchJSONUnknown(`/campgrounds/${campgroundId}/competitive/rate-parity`);
    return z
      .object({
        hasParityIssues: z.boolean(),
        alerts: z.array(
          z.object({
            siteType: z.string(),
            directRate: z.number(),
            otaRate: z.number(),
            otaSource: z.string(),
            difference: z.number(),
          }),
        ),
      })
      .parse(data);
  },

  async getRateParityAlerts(campgroundId: string, status?: string) {
    const params = status ? `?status=${status}` : "";
    const data = await fetchJSONUnknown(`/campgrounds/${campgroundId}/competitive/alerts${params}`);
    return z
      .array(
        z.object({
          id: z.string(),
          campgroundId: z.string(),
          siteType: z.string(),
          directRateCents: z.number(),
          otaRateCents: z.number(),
          otaSource: z.string(),
          difference: z.number(),
          status: z.enum(["active", "acknowledged", "resolved"]),
          acknowledgedBy: z.string().optional(),
          acknowledgedAt: z.string().optional(),
          resolvedAt: z.string().optional(),
          createdAt: z.string(),
        }),
      )
      .parse(data);
  },

  async acknowledgeRateParityAlert(campgroundId: string, alertId: string) {
    const res = await fetch(
      `${API_BASE}/campgrounds/${campgroundId}/competitive/alerts/${alertId}/acknowledge`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", ...scopedHeaders() },
        body: JSON.stringify({ userId: "current" }), // The backend will get actual user from JWT
      },
    );
    return parseResponse(res, UnknownSchema);
  },

  async resolveRateParityAlert(campgroundId: string, alertId: string) {
    const res = await fetch(
      `${API_BASE}/campgrounds/${campgroundId}/competitive/alerts/${alertId}/resolve`,
      {
        method: "POST",
        headers: scopedHeaders(),
      },
    );
    return parseResponse(res, UnknownSchema);
  },

  async getRateTrends(
    campgroundId: string,
    siteType: string,
    startDate?: string,
    endDate?: string,
  ) {
    const params = new URLSearchParams();
    if (startDate) params.set("startDate", startDate);
    if (endDate) params.set("endDate", endDate);
    const query = params.toString() ? `?${params.toString()}` : "";
    const data = await fetchJSONUnknown(
      `/campgrounds/${campgroundId}/competitive/trends/${siteType}${query}`,
    );
    return z
      .object({
        siteType: z.string(),
        trends: z.array(
          z.object({
            competitorId: z.string(),
            competitorName: z.string(),
            dataPoints: z.array(z.object({ date: z.string(), rate: z.number() })),
          }),
        ),
      })
      .parse(data);
  },

  // -------------------------------------------------------------------------
  // Semantic Search (Public)
  // -------------------------------------------------------------------------
  async searchCampgroundsSemantic(query: string, limit: number = 10) {
    const res = await fetch(`${API_BASE}/semantic-search/search`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query, limit }),
    });
    return parseResponse(
      res,
      z.object({
        query: z.string(),
        results: z.array(
          z.object({
            id: z.string(),
            name: z.string(),
            slug: z.string(),
            description: z.string().nullable(),
            city: z.string().nullable(),
            state: z.string().nullable(),
            similarity: z.number(),
          }),
        ),
        count: z.number(),
      }),
    );
  },

  // -------------------------------------------------------------------------
  // Generic HTTP Methods (for dynamic endpoints)
  // -------------------------------------------------------------------------
  async get<T>(
    url: string,
    options: {
      params?: Record<string, string | number | boolean | undefined | null>;
      schema: z.ZodType<T>;
    },
  ): Promise<{ data: T }> {
    const searchParams = new URLSearchParams();
    if (options?.params) {
      Object.entries(options.params).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          searchParams.set(key, String(value));
        }
      });
    }
    const query = searchParams.toString() ? `?${searchParams.toString()}` : "";
    const data = await fetchJSON(`${url}${query}`, options.schema);
    return { data };
  },

  async post<T>(
    url: string,
    body: unknown | undefined,
    schema: z.ZodType<T>,
  ): Promise<{ data: T }> {
    const res = await fetch(`${API_BASE}${url}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...scopedHeaders() },
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = await parseResponse(res, schema);
    return { data };
  },
};

export type PublicCampgroundList = z.infer<typeof PublicCampgroundListSchema>;
