import { z } from "zod";
import {
  DepositConfigSchema,
  DepositRuleSchema,
  DepositScheduleEntrySchema,
  DepositTierSchema,
  DepositSeasonSchema,
  DepositScopeRuleSchema
} from "./deposits.types";
export * from "./deposits";
export * from "./format";

const numberish = <T extends z.ZodTypeAny>(schema: T) =>
  z.preprocess((val) => {
    if (val === null || val === undefined) return undefined;
    if (typeof val === "string" || typeof val === "number") {
      const num = Number(val);
      return Number.isNaN(num) ? val : num;
    }
    return val;
  }, schema);

export { DepositConfigSchema } from "./deposits.types";
export type {
  DepositConfig,
  DepositRule,
  DepositScheduleEntry,
  DepositTier,
  DepositSeason,
  DepositScopeRule
} from "./deposits.types";

export const NpsScheduleEntrySchema = z.object({
  id: z.string(),
  anchor: z.enum(["arrival", "departure"]),
  direction: z.enum(["before", "after"]),
  offset: z.number().int(),
  unit: z.enum(["hours", "days"]),
  templateId: z.string().nullish(),
  enabled: z.boolean().default(true)
});
export type NpsScheduleEntry = z.infer<typeof NpsScheduleEntrySchema>;

export const CampgroundSchema = z.object({
  id: z.string().cuid(),
  organizationId: z.string().cuid(),
  name: z.string().min(1),
  slug: z.string().min(1),
  isExternal: z.boolean().optional(),
  isBookable: z.boolean().optional(),
  externalUrl: z.string().url().nullish(),
  nonBookableReason: z.string().nullish(),

  // Location
  city: z.string().min(1).nullish(),
  state: z.string().min(1).nullish(),
  country: z.string().min(1).nullish(),
  address1: z.string().nullish(),
  address2: z.string().nullish(),
  postalCode: z.string().nullish(),
  latitude: numberish(z.number().optional()),
  longitude: numberish(z.number().optional()),
  timezone: z.string().nullish(),

  // Contact
  phone: z.string().nullish(),
  email: z.string().nullish(),
  website: z.string().url().nullish(),
  facebookUrl: z.string().url().nullish(),
  instagramUrl: z.string().url().nullish(),
  dataSource: z.string().nullish(),
  dataSourceId: z.string().nullish(),
  dataSourceUpdatedAt: z.string().nullish(),
  provenance: z.record(z.any()).optional().nullable(),

  // Public listing
  description: z.string().nullish(),
  tagline: z.string().nullish(),
  pricePerNight: numberish(z.number().optional()),
  amenities: z.array(z.string()).optional(),
  photos: z.array(z.string()).optional(),
  photosMeta: z.any().optional().nullable(),
  reviews: z.array(z.lazy(() => ReviewSchema)).optional(),
  heroImageUrl: z.string().url().nullish(),
  isPublished: z.boolean().optional(),
  amenitySummary: z.record(z.any()).optional().nullable(),
  importedAt: z.string().nullish(),

  // Operations
  seasonStart: z.string().nullish(),
  seasonEnd: z.string().nullish(),
  checkInTime: z.string().nullish(),
  checkOutTime: z.string().nullish(),
  slaMinutes: z.number().int().optional().nullable(),
  senderDomain: z.string().optional().nullable(),
  senderDomainStatus: z.string().optional().nullable(),
  senderDomainCheckedAt: z.string().optional().nullable(),
  senderDomainDmarc: z.string().optional().nullable(),
  senderDomainSpf: z.string().optional().nullable(),
  quietHoursStart: z.string().optional().nullable(),
  quietHoursEnd: z.string().optional().nullable(),
  routingAssigneeId: z.string().optional().nullable(),

  // Branding
  logoUrl: z.string().nullish(),
  primaryColor: z.string().nullish(),
  accentColor: z.string().nullish(),
  brandingNote: z.string().nullish(),
  secondaryColor: z.string().nullish(),
  buttonColor: z.string().nullish(),
  brandFont: z.string().nullish(),
  emailHeader: z.string().nullish(),
  receiptFooter: z.string().nullish(),

  // Financial
  taxState: numberish(z.number().optional()),
  taxLocal: numberish(z.number().optional()),
  currency: z.string().optional().default("USD"),
  taxId: z.string().optional().nullable(),
  taxIdName: z.string().optional().default("Tax ID"),
  depositRule: z
    .enum(["none", "full", "half", "first_night", "first_night_fees", "percentage", "percentage_50"])
    .nullish(),
  depositPercentage: z.number().int().min(0).max(100).nullish(),
  depositConfig: DepositConfigSchema.nullish(),
  cancellationPolicyType: z.string().nullish(),
  cancellationWindowHours: z.number().int().nullish(),
  cancellationFeeType: z.string().nullish(),
  cancellationFeeFlatCents: z.number().int().nullish(),
  cancellationFeePercent: z.number().int().nullish(),
  cancellationNotes: z.string().nullish(),

  // Store hours
  storeOpenHour: z.number().int().optional().nullable(),
  storeCloseHour: z.number().int().optional().nullable(),

  // Payments / Stripe
  stripeAccountId: z.string().nullish(),
  billingPlan: z.string().optional().nullable(),
  perBookingFeeCents: z.number().int().optional().nullable(),

  // Reviews / NPS
  npsAutoSendEnabled: z.boolean().optional(),
  npsSendHour: z.number().int().optional(),
  npsTemplateId: z.string().nullish(),
  npsSchedule: z.array(NpsScheduleEntrySchema).optional(),
  reviewScore: numberish(z.number().optional()).nullish(),
  reviewCount: z.number().int().optional().default(0),
  reviewSources: z.record(z.any()).optional().nullable(),
  reviewsUpdatedAt: z.string().nullish()
});
export type Campground = z.infer<typeof CampgroundSchema>;

export const FormTemplateSchema = z.object({
  id: z.string().cuid(),
  campgroundId: z.string().cuid(),
  title: z.string(),
  type: z.enum(["waiver", "vehicle", "intake", "custom"]),
  description: z.string().nullish(),
  fields: z.record(z.any()).optional().nullable(),
  isActive: z.boolean().default(true).optional(),
  version: z.number().int(),
  // Auto-attach settings
  autoAttachMode: z.enum(["manual", "all_bookings", "site_classes"]).default("manual").optional(),
  siteClassIds: z.array(z.string()).default([]).optional(),
  // Display settings
  showAt: z.array(z.enum(["during_booking", "at_checkin", "after_booking", "on_demand"])).default(["during_booking"]).optional(),
  isRequired: z.boolean().default(true).optional(),
  allowSkipWithNote: z.boolean().default(false).optional(),
  // Conditional display rules
  displayConditions: z.array(z.object({
    field: z.enum(["pets", "adults", "children", "rigType", "siteClassId", "addOns", "stayLength"]),
    operator: z.enum(["equals", "not_equals", "greater_than", "less_than", "in", "not_in", "contains"]),
    value: z.union([z.string(), z.number(), z.array(z.string())])
  })).default([]).optional(),
  conditionLogic: z.enum(["all", "any"]).default("all").optional(),
  // Validity settings
  validityDays: z.number().int().nullish(),
  // Reminder settings
  sendReminder: z.boolean().default(false).optional(),
  reminderDaysBefore: z.number().int().default(1).optional(),
  createdAt: z.string(),
  updatedAt: z.string()
});
export type FormTemplate = z.infer<typeof FormTemplateSchema>;

export const FormSubmissionSchema = z.object({
  id: z.string().cuid(),
  formTemplateId: z.string().cuid(),
  reservationId: z.string().nullish(),
  guestId: z.string().nullish(),
  status: z.enum(["pending", "completed", "skipped", "void"]),
  responses: z.record(z.any()).optional().nullable(),
  skipNote: z.string().nullish(),
  signedAt: z.string().nullish(),
  createdAt: z.string(),
  updatedAt: z.string(),
  formTemplate: FormTemplateSchema.pick({
    id: true,
    title: true,
    type: true,
    isRequired: true,
    allowSkipWithNote: true,
    showAt: true
  }).optional()
});
export type FormSubmission = z.infer<typeof FormSubmissionSchema>;

export const SiteClassSchema = z.object({
  id: z.string().cuid(),
  campgroundId: z.string().cuid(),
  name: z.string().min(1),
  description: z.string().nullish(),
  defaultRate: z.number().int().nonnegative(),
  siteType: z.enum(["rv", "tent", "cabin", "group", "glamping"]),
  maxOccupancy: z.number().int().nonnegative(),
  rigMaxLength: z.number().int().nonnegative().nullish(),
  hookupsPower: z.boolean().optional(),
  hookupsWater: z.boolean().optional(),
  hookupsSewer: z.boolean().optional(),
  electricAmps: z.array(z.number().int()).optional().default([]),
  rvOrientation: z.string().nullish(),
  amenityTags: z.array(z.string()).optional().default([]),
  meteredEnabled: z.boolean().optional(),
  meteredType: z.string().nullish(),
  meteredBillingMode: z.string().nullish(),
  meteredBillTo: z.string().nullish(),
  // Decimal in DB; accept number-like strings from Prisma JSON
  meteredMultiplier: numberish(z.number().optional()).nullish(),
  meteredRatePlanId: z.string().nullish(),
  meteredAutoEmail: z.boolean().optional(),
  tags: z.array(z.string()).optional(),
  glCode: z.string().nullish(),
  clientAccount: z.string().nullish(),
  minNights: z.number().int().optional().nullable(),
  maxNights: z.number().int().optional().nullable(),
  petFriendly: z.boolean().optional(),
  accessible: z.boolean().optional(),
  photos: z.array(z.string()).optional(),
  photoAttributions: z.any().optional().nullable(),
  policyVersion: z.string().nullish(),
  isActive: z.boolean().optional().default(true)
});
export type SiteClass = z.infer<typeof SiteClassSchema>;

export const SiteSchema = z.object({
  id: z.string().cuid(),
  campgroundId: z.string().cuid(),
  siteClassId: z.string().cuid().optional().nullable(),
  name: z.string().min(1),
  siteNumber: z.string().min(1),
  siteType: z.enum(["rv", "tent", "cabin", "group", "glamping"]),
  maxOccupancy: z.number().int().nonnegative(),
  rigMaxLength: numberish(z.number().int().nonnegative()).nullish(),
  hookupsPower: z.boolean().optional(),
  hookupsWater: z.boolean().optional(),
  hookupsSewer: z.boolean().optional(),
  powerAmps: z.array(z.number().int()).optional().default([]),
  petFriendly: z.boolean().optional(),
  accessible: z.boolean().optional(),
  minNights: z.number().int().optional().nullable(),
  maxNights: z.number().int().optional().nullable(),
  photos: z.array(z.string()).optional(),
  photoAttributions: z.any().optional().nullable(),
  description: z.string().optional().nullable(),
  tags: z.array(z.string()).optional(),
  vibeTags: z.array(z.string()).optional(),
  popularityScore: z.number().int().optional().default(0),
  isActive: z.boolean().default(true),
  status: z.string().nullish(),
  housekeepingStatus: z.string().optional().default("clean"),
  latitude: numberish(z.number().optional()),
  longitude: numberish(z.number().optional())
});
export type Site = z.infer<typeof SiteSchema>;

export const GuestSchema = z.object({
  id: z.string().cuid(),
  primaryFirstName: z.string().min(1),
  primaryLastName: z.string().min(1),
  email: z.string(),
  phone: z.string().nullish(),
  address1: z.string().nullish(),
  address2: z.string().nullish(),
  city: z.string().nullish(),
  state: z.string().nullish(),
  postalCode: z.string().nullish(),
  country: z.string().nullish(),
  rigType: z.string().nullish(),
  rigLength: numberish(z.number().int().optional()),
  preferredContact: z.string().nullish(),
  preferredLanguage: z.string().nullish(),
  vehiclePlate: z.string().nullish(),
  vehicleState: z.string().nullish(),
  tags: z.array(z.string()).optional(),
  vip: z.boolean().optional(),
  leadSource: z.string().nullish(),
  marketingOptIn: z.boolean().optional(),
  repeatStays: z.number().int().optional(),
  notes: z.string().nullish(),
  preferences: z.record(z.any()).optional().nullable(),
  insights: z.record(z.any()).optional().nullable(),
  loyaltyProfile: z.object({
    tier: z.string(),
    pointsBalance: z.number()
  }).optional().nullable(),
  reservations: z.array(z.object({
    id: z.string(),
    campgroundId: z.string(),
    arrivalDate: z.string(),
    departureDate: z.string(),
    status: z.string().optional(),
    site: z.object({
      id: z.string(),
      name: z.string(),
      siteNumber: z.string(),
      siteClassId: z.string().nullable()
    }).optional().nullable()
  })).optional()
});
export type Guest = z.infer<typeof GuestSchema>;

export const ReservationSchema = z.object({
  id: z.string().cuid(),
  campgroundId: z.string().cuid(),
  siteId: z.string().cuid(),
  siteLocked: z.boolean().optional().default(false),
  guestId: z.string().cuid(),
  arrivalDate: z.string(),
  departureDate: z.string(),
  adults: z.number().int().nonnegative(),
  children: z.number().int().nonnegative().default(0),
  status: z.enum(["pending", "confirmed", "checked_in", "checked_out", "cancelled"]),
  totalAmount: z.number().nonnegative(),
  paidAmount: numberish(z.number().nonnegative().optional()),
  balanceAmount: numberish(z.number().nonnegative().optional()),
  paymentStatus: z.string().nullish(),
  baseSubtotal: z.number().nonnegative().optional(),
  feesAmount: z.number().nonnegative().optional(),
  taxesAmount: z.number().nonnegative().optional(),
  discountsAmount: z.number().nonnegative().optional(),
  promoCode: z.string().nullish(),
  source: z.string().nullish(),
  policyVersion: z.string().nullish(),
  checkInWindowStart: z.string().nullish(),
  checkInWindowEnd: z.string().nullish(),
  vehiclePlate: z.string().nullish(),
  vehicleState: z.string().nullish(),
  rigType: z.string().nullish(),
  rigLength: numberish(z.number().int().optional()),
  createdBy: z.string().nullish(),
  updatedBy: z.string().nullish(),
  checkInAt: z.string().nullish(),
  checkOutAt: z.string().nullish(),
  notes: z.string().nullish(),
  seasonalRateId: z.string().cuid().nullish(),
  pricingType: z.enum(["transient", "seasonal"]).optional().default("transient"),
  taxWaiverSigned: z.boolean().optional().default(false),
  taxWaiverDate: z.string().nullish(),
  stayReasonPreset: z.string().nullish(),
  stayReasonOther: z.string().nullish(),
  referralProgramId: z.string().nullish(),
  referralCode: z.string().nullish(),
  referralSource: z.string().nullish(),
  referralChannel: z.string().nullish(),
  referralIncentiveType: z.string().nullish(),
  referralIncentiveValue: z.number().int().nonnegative().nullable().optional(),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
  guest: GuestSchema.optional(),
  site: z
    .object({
      id: z.string(),
      name: z.string().optional().nullable(),
      siteNumber: z.string().optional().nullable(),
      siteType: z.string().optional().nullable()
    })
    .optional()
});
export type Reservation = z.infer<typeof ReservationSchema>;

export const CreateOrganizationSchema = z.object({
  name: z.string().min(1)
});
export type CreateOrganizationDto = z.infer<typeof CreateOrganizationSchema>;

export const CreateCampgroundSchema = z.object({
  organizationId: z.string().cuid(),
  name: z.string().min(1),
  slug: z.string().min(1),
  city: z.string().optional(),
  state: z.string().optional(),
  country: z.string().optional(),
  timezone: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().optional(),
  seasonStart: z.string().optional(),
  seasonEnd: z.string().optional(),
  logoUrl: z.string().optional(),
  primaryColor: z.string().optional(),
  accentColor: z.string().optional(),
  taxState: z.number().optional(),
  taxLocal: z.number().optional(),
  brandingNote: z.string().optional(),
  depositRule: z.enum(["none", "full", "half", "first_night", "first_night_fees"]).optional(),
  isExternal: z.boolean().optional(),
  isBookable: z.boolean().optional(),
  externalUrl: z.string().optional(),
  nonBookableReason: z.string().optional(),
  dataSource: z.string().optional(),
  dataSourceId: z.string().optional(),
  dataSourceUpdatedAt: z.string().optional(),
  amenities: z.array(z.string()).optional(),
  photos: z.array(z.string()).optional(),
  npsAutoSendEnabled: z.boolean().optional(),
  npsSendHour: z.number().int().optional(),
  reviewScore: z.number().optional(),
  reviewCount: z.number().optional()
});
export type CreateCampgroundDto = z.infer<typeof CreateCampgroundSchema>;

export const CreateSiteClassSchema = SiteClassSchema.omit({ id: true });
export type CreateSiteClassDto = z.infer<typeof CreateSiteClassSchema>;

export const CreateSiteSchema = z.object({
  campgroundId: z.string().cuid(),
  siteClassId: z.string().cuid().optional().nullable(),
  name: z.string().min(1),
  siteNumber: z.string().min(1),
  siteType: SiteSchema.shape.siteType,
  maxOccupancy: z.number().int().nonnegative(),
  rigMaxLength: z.number().int().nonnegative().optional(),
  hookupsPower: z.boolean().optional(),
  hookupsWater: z.boolean().optional(),
  hookupsSewer: z.boolean().optional(),
  isActive: z.boolean().default(true)
});
export type CreateSiteDto = z.infer<typeof CreateSiteSchema>;

export const CreateGuestSchema = z.object({
  primaryFirstName: z.string().min(1),
  primaryLastName: z.string().min(1),
  email: z.string().optional(),
  phone: z.string().optional(),
  notes: z.string().optional(),
  tags: z.array(z.string()).optional()
});
export type CreateGuestDto = z.infer<typeof CreateGuestSchema>;

export const CreateReservationSchema = z.object({
  campgroundId: z.string().cuid(),
  siteId: z.string().cuid().optional(),
  siteClassId: z.string().cuid().optional(),
  siteLocked: z.boolean().optional(),
  guestId: z.string().cuid(),
  arrivalDate: z.string(),
  departureDate: z.string(),
  adults: z.number().int().nonnegative(),
  children: z.number().int().nonnegative().default(0),
  totalAmount: z.number().nonnegative(),
  status: ReservationSchema.shape.status,
  paidAmount: z.number().nonnegative().optional(),
  balanceAmount: z.number().nonnegative().optional(),
  paymentStatus: z.string().optional(),
  baseSubtotal: z.number().nonnegative().optional(),
  feesAmount: z.number().nonnegative().optional(),
  taxesAmount: z.number().nonnegative().optional(),
  discountsAmount: z.number().nonnegative().optional(),
  promoCode: z.string().optional(),
  source: z.string().optional(),
  policyVersion: z.string().optional(),
  checkInWindowStart: z.string().optional(),
  checkInWindowEnd: z.string().optional(),
  vehiclePlate: z.string().optional(),
  vehicleState: z.string().optional(),
  rigType: z.string().optional(),
  rigLength: z.number().int().optional(),
  rvType: z.string().optional(),
  stayReasonPreset: z.string().optional(),
  stayReasonOther: z.string().optional(),
  referralCode: z.string().optional(),
  referralProgramId: z.string().optional(),
  referralSource: z.string().optional(),
  referralChannel: z.string().optional(),
  holdId: z.string().cuid().optional(),
  paymentMethod: z.string().optional(),
  transactionId: z.string().optional(),
  paymentNotes: z.string().optional(),
  pets: z.number().int().optional(),
  createdBy: z.string().optional(),
  updatedBy: z.string().optional(),
  checkInAt: z.string().optional(),
  checkOutAt: z.string().optional(),
  notes: z.string().optional(),
  seasonalRateId: z.string().cuid().optional(),
  pricingType: z.enum(["transient", "seasonal"]).optional()
}).refine(
  (data) => data.siteId || data.siteClassId,
  { message: "Either siteId or siteClassId must be provided" }
);
export type CreateReservationDto = z.infer<typeof CreateReservationSchema>;

// Maintenance
export const MaintenanceSchema = z.object({
  id: z.string().cuid(),
  campgroundId: z.string().cuid(),
  siteId: z.string().cuid().nullable().optional(),
  title: z.string().min(1),
  description: z.string().nullish(),
  status: z.enum(["open", "in_progress", "closed"]),
  priority: z.enum(["low", "medium", "high", "critical"]),
  dueDate: z.string().nullish(),
  assignedTo: z.string().nullish(),
  isBlocking: z.boolean().optional().default(false),
  resolvedAt: z.string().nullish(),
  siteName: z.string().nullish().optional(),
  siteNumber: z.string().nullish().optional(),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional()
});
export type Maintenance = z.infer<typeof MaintenanceSchema>;
export const CreateMaintenanceSchema = MaintenanceSchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true
});
export type CreateMaintenanceDto = z.infer<typeof CreateMaintenanceSchema>;

// Pricing
export const PricingRuleSchema = z.object({
  id: z.string().cuid(),
  campgroundId: z.string().cuid(),
  siteClassId: z.string().cuid().nullish(),
  label: z.string().nullish(),
  ruleType: z.enum(["flat", "percent", "seasonal", "dow"]),
  startDate: z.string().nullish(),
  endDate: z.string().nullish(),
  dayOfWeek: z.number().int().min(0).max(6).nullish(),
  percentAdjust: numberish(z.number().optional().nullable()),
  flatAdjust: z.number().int().optional().nullable(),
  minNights: z.number().int().optional().nullable(),
  isActive: z.boolean().optional().default(true)
});
export type PricingRule = z.infer<typeof PricingRuleSchema>;
export const CreatePricingRuleSchema = PricingRuleSchema.omit({ id: true });
export type CreatePricingRuleDto = z.infer<typeof CreatePricingRuleSchema>;

// Pricing quote
export const QuoteSchema = z.object({
  nights: z.number().int().nonnegative(),
  baseSubtotalCents: z.number().int().nonnegative(),
  rulesDeltaCents: z.number().int(),
  totalCents: z.number().int().nonnegative(),
  perNightCents: z.number().int().nonnegative(),
  taxExemptionEligible: z.boolean().optional(),
  requiresWaiver: z.boolean().optional(),
  waiverText: z.string().optional().nullable()
});
export type Quote = z.infer<typeof QuoteSchema>;

// Payments / Ledger
export const PaymentSchema = z.object({
  id: z.string().cuid(),
  campgroundId: z.string().cuid(),
  reservationId: z.string().cuid(),
  amountCents: z.number().int(),
  method: z.string(),
  direction: z.enum(["charge", "refund"]),
  note: z.string().nullish(),
  createdAt: z.string()
});
export type Payment = z.infer<typeof PaymentSchema>;

export const LedgerEntrySchema = z.object({
  id: z.string().cuid(),
  campgroundId: z.string().cuid(),
  reservationId: z.string().cuid().optional().nullable(),
  glCode: z.string().nullish(),
  account: z.string().nullish(),
  description: z.string().nullish(),
  amountCents: z.number().int(),
  direction: z.enum(["debit", "credit"]),
  occurredAt: z.string(),
  createdAt: z.string()
});
export type LedgerEntry = z.infer<typeof LedgerEntrySchema>;

// Users
export const UserRoleSchema = z.enum([
  "owner",
  "manager",
  "front_desk",
  "maintenance",
  "finance",
  "marketing",
  "readonly"
]);
export type UserRole = z.infer<typeof UserRoleSchema>;

export const UserSchema = z.object({
  id: z.string().cuid(),
  email: z.string().email(),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  isActive: z.boolean().default(true),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional()
});
export type User = z.infer<typeof UserSchema>;

export const CampgroundMembershipSchema = z.object({
  id: z.string().cuid(),
  userId: z.string().cuid(),
  campgroundId: z.string().cuid(),
  role: UserRoleSchema,
  createdAt: z.string().optional()
});
export type CampgroundMembership = z.infer<typeof CampgroundMembershipSchema>;

export const CreateUserSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  firstName: z.string().min(1),
  lastName: z.string().min(1)
});
export type CreateUserDto = z.infer<typeof CreateUserSchema>;

// Organization
export const SubscriptionTierSchema = z.enum([
  "free",
  "starter",
  "professional",
  "enterprise"
]);
export type SubscriptionTier = z.infer<typeof SubscriptionTierSchema>;

export const OrganizationSchema = z.object({
  id: z.string().cuid(),
  name: z.string().min(1),

  // Billing & subscription
  subscriptionTier: SubscriptionTierSchema.optional(),
  billingEmail: z.string().email().nullish(),
  billingName: z.string().nullish(),
  billingAddress1: z.string().nullish(),
  billingAddress2: z.string().nullish(),
  billingCity: z.string().nullish(),
  billingState: z.string().nullish(),
  billingPostalCode: z.string().nullish(),
  billingCountry: z.string().nullish(),
  stripeCustomerId: z.string().nullish(),
  subscriptionStatus: z.enum(["active", "past_due", "canceled", "trialing"]).nullish(),
  trialEndsAt: z.string().nullish(),

  createdAt: z.string().optional(),
  updatedAt: z.string().optional()
});
export type Organization = z.infer<typeof OrganizationSchema>;

// Events
export const EventTypeSchema = z.enum([
  "activity",
  "workshop",
  "entertainment",
  "holiday",
  "recurring",
  "ongoing",
  "themed"
]);
export type EventType = z.infer<typeof EventTypeSchema>;

const eventShape = {
  id: z.string().cuid(),
  campgroundId: z.string().cuid(),

  // Basic info
  title: z.string().min(1),
  description: z.string().nullish(),
  eventType: EventTypeSchema,

  // Scheduling
  startDate: z.string(),
  endDate: z.string().nullish(),
  startTime: z.string().nullish(),
  endTime: z.string().nullish(),
  isAllDay: z.boolean().optional(),
  isRecurring: z.boolean().optional(),
  recurrenceRule: z.string().nullish(),

  // Location
  location: z.string().nullish(),

  // Capacity & pricing
  capacity: z.number().int().optional().nullable(),
  currentSignups: z.number().int().optional(),
  priceCents: z.number().int().optional(),
  isGuestOnly: z.boolean().optional(),

  // Media
  imageUrl: z.string().url().nullish(),

  // Status
  isPublished: z.boolean().optional(),
  isCancelled: z.boolean().optional(),
  cancelledAt: z.string().nullish(),
  cancellationReason: z.string().nullish(),

  // Recurrence enhancements
  recurrenceDays: z.array(z.number().int().min(0).max(6)).optional(),
  recurrenceEndDate: z.string().nullish(),

  // Parent/child for holiday/themed weekends
  parentEventId: z.string().cuid().nullish(),

  createdAt: z.string().optional(),
  updatedAt: z.string().optional()
};

export const EventSchema: z.ZodType<any> = z.lazy(() =>
  z.object({
    ...eventShape,
    children: z.array(EventSchema).optional()
  })
);
export type Event = z.infer<typeof EventSchema>;

export const CreateEventSchema = z.object(eventShape).omit({
  id: true,
  currentSignups: true,
  isCancelled: true,
  cancelledAt: true,
  cancellationReason: true,
  createdAt: true,
  updatedAt: true
});
export type CreateEventDto = z.infer<typeof CreateEventSchema>;

// Store
export const ProductCategorySchema = z.object({
  id: z.string().cuid(),
  campgroundId: z.string().cuid(),
  name: z.string().min(1),
  description: z.string().nullish(),
  sortOrder: z.number().int().optional(),
  isActive: z.boolean().optional().default(true),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional()
});
export type ProductCategory = z.infer<typeof ProductCategorySchema>;

export const CreateProductCategorySchema = ProductCategorySchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true
});
export type CreateProductCategoryDto = z.infer<typeof CreateProductCategorySchema>;

export const ProductSchema = z.object({
  id: z.string().cuid(),
  campgroundId: z.string().cuid(),
  categoryId: z.string().cuid().nullish(),
  name: z.string().min(1),
  description: z.string().nullish(),
  priceCents: z.number().int().nonnegative(),
  imageUrl: z.string().url().nullish(),
  sku: z.string().nullish(),
  stockQty: z.number().int().nonnegative().optional(),
  posStockQty: z.number().int().nonnegative().optional(),
  onlineStockQty: z.number().int().nonnegative().optional(),
  onlineBufferQty: z.number().int().nonnegative().optional(),
  lowStockAlert: z.number().int().nonnegative().optional(),
  trackInventory: z.boolean().optional(),
  afterHoursAllowed: z.boolean().optional(),
  channelInventoryMode: z.enum(["shared", "split"]).optional().default("shared"),
  sortOrder: z.number().int().optional(),
  glCode: z.string().nullish(),
  isActive: z.boolean().optional().default(true),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional()
});
export type Product = z.infer<typeof ProductSchema>;

export const CreateProductSchema = ProductSchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true
});
export type CreateProductDto = z.infer<typeof CreateProductSchema>;

export const AddOnSchema = z.object({
  id: z.string().cuid(),
  campgroundId: z.string().cuid(),
  name: z.string().min(1),
  description: z.string().nullish(),
  priceCents: z.number().int().nonnegative(),
  pricingType: z.enum(["flat", "per_night", "per_person"]).optional().default("flat"),
  sortOrder: z.number().int().optional(),
  glCode: z.string().nullish(),
  isActive: z.boolean().optional().default(true),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional()
});
export type AddOn = z.infer<typeof AddOnSchema>;

export const CreateAddOnSchema = AddOnSchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true
});
export type CreateAddOnDto = z.infer<typeof CreateAddOnSchema>;

// Store Locations (Multi-location POS)
export const StoreLocationSchema = z.object({
  id: z.string().cuid(),
  campgroundId: z.string().cuid(),
  name: z.string().min(1),
  code: z.string().nullish(),
  type: z.enum(["physical", "virtual"]).optional().default("physical"),
  isDefault: z.boolean().optional().default(false),
  isActive: z.boolean().optional().default(true),
  acceptsOnline: z.boolean().optional().default(false),
  sortOrder: z.number().int().optional().default(0),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
  _count: z.object({
    terminals: z.number().optional(),
    locationInventory: z.number().optional(),
    priceOverrides: z.number().optional(),
    fulfillmentOrders: z.number().optional(),
  }).optional(),
});
export type StoreLocation = z.infer<typeof StoreLocationSchema>;

export const CreateStoreLocationSchema = StoreLocationSchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  _count: true,
});
export type CreateStoreLocationDto = z.infer<typeof CreateStoreLocationSchema>;

export const LocationInventorySchema = z.object({
  id: z.string().cuid(),
  productId: z.string().cuid(),
  locationId: z.string().cuid(),
  stockQty: z.number().int().nonnegative().default(0),
  lowStockAlert: z.number().int().nonnegative().nullish(),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
  product: ProductSchema.optional(),
  location: z.lazy(() => StoreLocationSchema).optional(),
});
export type LocationInventory = z.infer<typeof LocationInventorySchema>;

export const LocationPriceOverrideSchema = z.object({
  id: z.string().cuid(),
  productId: z.string().cuid(),
  locationId: z.string().cuid(),
  priceCents: z.number().int().nonnegative(),
  reason: z.string().nullish(),
  isActive: z.boolean().optional().default(true),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
  product: ProductSchema.optional(),
});
export type LocationPriceOverride = z.infer<typeof LocationPriceOverrideSchema>;

export const InventoryMovementSchema = z.object({
  id: z.string().cuid(),
  campgroundId: z.string().cuid(),
  productId: z.string().cuid(),
  locationId: z.string().cuid().nullish(),
  movementType: z.string(),
  qty: z.number().int(),
  previousQty: z.number().int(),
  newQty: z.number().int(),
  referenceType: z.string().nullish(),
  referenceId: z.string().nullish(),
  notes: z.string().nullish(),
  actorUserId: z.string().cuid(),
  createdAt: z.string().optional(),
  product: z.object({
    id: z.string(),
    name: z.string(),
    sku: z.string().nullish(),
  }).optional(),
  location: z.object({
    id: z.string(),
    name: z.string(),
    code: z.string().nullish(),
  }).nullish(),
  actor: z.object({
    id: z.string(),
    firstName: z.string(),
    lastName: z.string(),
  }).optional(),
});
export type InventoryMovement = z.infer<typeof InventoryMovementSchema>;

// Inventory Transfers
export const InventoryTransferItemSchema = z.object({
  id: z.string().cuid(),
  transferId: z.string().cuid(),
  productId: z.string().cuid(),
  qty: z.number().int().positive(),
  product: z.object({
    id: z.string(),
    name: z.string(),
    sku: z.string().nullish(),
    priceCents: z.number().optional(),
  }).optional(),
});
export type InventoryTransferItem = z.infer<typeof InventoryTransferItemSchema>;

export const InventoryTransferSchema = z.object({
  id: z.string().cuid(),
  campgroundId: z.string().cuid(),
  fromLocationId: z.string().cuid(),
  toLocationId: z.string().cuid(),
  status: z.enum(["pending", "in_transit", "completed", "cancelled"]),
  notes: z.string().nullish(),
  requestedById: z.string().cuid(),
  approvedById: z.string().cuid().nullish(),
  completedById: z.string().cuid().nullish(),
  requestedAt: z.string().optional(),
  approvedAt: z.string().nullish(),
  completedAt: z.string().nullish(),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
  fromLocation: z.object({
    id: z.string(),
    name: z.string(),
    code: z.string().nullish(),
  }).optional(),
  toLocation: z.object({
    id: z.string(),
    name: z.string(),
    code: z.string().nullish(),
  }).optional(),
  requestedBy: z.object({
    id: z.string(),
    firstName: z.string(),
    lastName: z.string(),
  }).optional(),
  approvedBy: z.object({
    id: z.string(),
    firstName: z.string(),
    lastName: z.string(),
  }).nullish(),
  completedBy: z.object({
    id: z.string(),
    firstName: z.string(),
    lastName: z.string(),
  }).nullish(),
  items: z.array(InventoryTransferItemSchema).optional(),
  _count: z.object({
    items: z.number().optional(),
  }).optional(),
});
export type InventoryTransfer = z.infer<typeof InventoryTransferSchema>;

export const CreateInventoryTransferSchema = z.object({
  fromLocationId: z.string().cuid(),
  toLocationId: z.string().cuid(),
  items: z.array(z.object({
    productId: z.string().cuid(),
    qty: z.number().int().positive(),
  })),
  notes: z.string().optional(),
});
export type CreateInventoryTransferDto = z.infer<typeof CreateInventoryTransferSchema>;

// Blackout Dates
export const BlackoutDateSchema = z.object({
  id: z.string().cuid(),
  campgroundId: z.string().cuid(),
  siteId: z.string().cuid().optional().nullable(),
  startDate: z.string(),
  endDate: z.string(),
  reason: z.string().optional().nullable(),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
  site: SiteSchema.optional().nullable()
});
export type BlackoutDate = z.infer<typeof BlackoutDateSchema>;

export const CreateBlackoutDateSchema = BlackoutDateSchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  site: true
});
export type CreateBlackoutDateDto = z.infer<typeof CreateBlackoutDateSchema>;

// Waitlist
export const WaitlistEntrySchema = z.object({
  id: z.string().cuid(),
  campgroundId: z.string().cuid(),
  guestId: z.string().cuid().nullable().optional(),
  siteId: z.string().cuid().optional().nullable(),
  siteTypeId: z.string().cuid().optional().nullable(),
  arrivalDate: z.string().nullable().optional(),
  departureDate: z.string().nullable().optional(),
  status: z.enum(["active", "offered", "converted", "fulfilled", "expired", "cancelled"]).default("active"),
  type: z.enum(["regular", "seasonal"]).default("regular"),
  contactName: z.string().nullable().optional(),
  contactEmail: z.string().nullable().optional(),
  contactPhone: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  lastNotifiedAt: z.string().nullable().optional(),
  notifiedCount: z.number().int().nonnegative().optional(),
  priority: z.number().int().min(0).max(100).optional(),
  autoOffer: z.boolean().optional(),
  maxPrice: z.number().int().nullable().optional(),
  flexibleDates: z.boolean().optional(),
  flexibleDays: z.number().int().optional(),
  convertedReservationId: z.string().cuid().nullable().optional(),
  convertedAt: z.string().nullable().optional(),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
  guest: z.object({
    primaryFirstName: z.string().nullable().optional(),
    primaryLastName: z.string().nullable().optional(),
    email: z.string().nullable().optional()
  }).nullable().optional(),
  site: z.object({
    siteNumber: z.string()
  }).nullable().optional(),
  siteClass: z.object({
    name: z.string()
  }).nullable().optional()
});
export type WaitlistEntry = z.infer<typeof WaitlistEntrySchema>;

export const CreateWaitlistEntrySchema = WaitlistEntrySchema.omit({
  id: true,
  status: true,
  createdAt: true,
  updatedAt: true
});
export type CreateWaitlistEntryDto = z.infer<typeof CreateWaitlistEntrySchema>;

// Communications
export const CommunicationSchema = z.object({
  id: z.string().cuid(),
  campgroundId: z.string().cuid(),
  organizationId: z.string().cuid().optional().nullable(),
  guestId: z.string().cuid().optional().nullable(),
  reservationId: z.string().cuid().optional().nullable(),
  type: z.enum(["email", "sms", "note", "call"]),
  direction: z.enum(["inbound", "outbound"]),
  subject: z.string().nullish(),
  body: z.string().nullish(),
  preview: z.string().nullish(),
  status: z.string(),
  provider: z.string().nullish(),
  providerMessageId: z.string().nullish(),
  toAddress: z.string().nullish(),
  fromAddress: z.string().nullish(),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional()
});
export type Communication = z.infer<typeof CommunicationSchema>;

export const CommunicationTemplateSchema = z.object({
  id: z.string().cuid(),
  campgroundId: z.string().cuid(),
  name: z.string(),
  subject: z.string().nullish(),
  bodyHtml: z.string().nullish(),
  status: z.enum(["draft", "pending", "approved", "rejected"]),
  version: z.number().int(),
  approvedById: z.string().nullish(),
  approvedAt: z.string().nullish(),
  auditLog: z.record(z.any()).optional().nullable(),
  createdAt: z.string(),
  updatedAt: z.string()
});
export type CommunicationTemplate = z.infer<typeof CommunicationTemplateSchema>;

export const CommunicationPlaybookSchema = z.object({
  id: z.string().cuid(),
  campgroundId: z.string().cuid(),
  type: z.enum(["arrival", "unpaid", "upsell", "abandoned_cart", "nps"]),
  enabled: z.boolean(),
  templateId: z.string().nullish(),
  channel: z.enum(["email", "sms"]).nullish(),
  offsetMinutes: z.number().int().nullish(),
  quietHoursStart: z.string().nullish(),
  quietHoursEnd: z.string().nullish(),
  throttlePerMinute: z.number().int().nullish(),
  routingAssigneeId: z.string().nullish(),
  createdAt: z.string(),
  updatedAt: z.string()
});
export type CommunicationPlaybook = z.infer<typeof CommunicationPlaybookSchema>;

export const CommunicationPlaybookJobSchema = z.object({
  id: z.string().cuid(),
  playbookId: z.string().cuid(),
  campgroundId: z.string().cuid(),
  reservationId: z.string().cuid().nullish(),
  guestId: z.string().cuid().nullish(),
  status: z.string(),
  scheduledAt: z.string(),
  attempts: z.number().int(),
  lastError: z.string().nullish(),
  metadata: z.record(z.any()).optional().nullable(),
  createdAt: z.string(),
  updatedAt: z.string()
});
export type CommunicationPlaybookJob = z.infer<typeof CommunicationPlaybookJobSchema>;

export const CreateCommunicationSchema = CommunicationSchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  preview: true,
  status: true
});
export type CreateCommunicationDto = z.infer<typeof CreateCommunicationSchema>;

// NPS
export const NpsSurveySchema = z.object({
  id: z.string().cuid(),
  campgroundId: z.string().cuid(),
  name: z.string(),
  question: z.string().nullable(),
  status: z.enum(["draft", "active", "paused", "archived"]),
  channels: z.array(z.string()).optional(),
  locales: z.array(z.string()).optional(),
  cooldownDays: z.number().int().nullable().optional(),
  samplingPercent: z.number().int().nullable().optional(),
  activeFrom: z.string().nullable().optional(),
  activeTo: z.string().nullable().optional(),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional()
});
export type NpsSurvey = z.infer<typeof NpsSurveySchema>;

export const NpsInviteSchema = z.object({
  id: z.string().cuid(),
  surveyId: z.string().cuid(),
  campgroundId: z.string().cuid(),
  guestId: z.string().cuid().nullable().optional(),
  reservationId: z.string().cuid().nullable().optional(),
  channel: z.string(),
  status: z.enum(["queued", "sent", "bounced", "opened", "responded", "expired"]),
  token: z.string(),
  expiresAt: z.string().nullable().optional(),
  sentAt: z.string().nullable().optional(),
  openedAt: z.string().nullable().optional(),
  respondedAt: z.string().nullable().optional(),
  createdAt: z.string().optional()
});
export type NpsInvite = z.infer<typeof NpsInviteSchema>;

export const NpsResponseSchema = z.object({
  id: z.string().cuid(),
  surveyId: z.string().cuid(),
  inviteId: z.string().cuid().nullable().optional(),
  campgroundId: z.string().cuid(),
  guestId: z.string().cuid().nullable().optional(),
  reservationId: z.string().cuid().nullable().optional(),
  score: z.number().int().min(0).max(10),
  comment: z.string().nullable().optional(),
  tags: z.array(z.string()).optional(),
  sentiment: z.string().nullable().optional(),
  createdAt: z.string().optional()
});
export type NpsResponse = z.infer<typeof NpsResponseSchema>;

export const NpsMetricsSchema = z.object({
  totalResponses: z.number(),
  promoters: z.number(),
  passives: z.number(),
  detractors: z.number(),
  nps: z.number().nullable(),
  responseRate: z.number().nullable(),
  // Benchmarking data
  systemAverage: z.number().nullable().optional(),
  systemTotalResponses: z.number().optional(),
  campgroundsInSystem: z.number().optional(),
  // Guidance to reach benchmarks
  toReachAverage: z.number().nullable().optional(),
  toReachWorldClass: z.number().nullable().optional(),
  isAboveAverage: z.boolean().nullable().optional(),
  isWorldClass: z.boolean().optional()
});
export type NpsMetrics = z.infer<typeof NpsMetricsSchema>;

// Reviews
export const ReviewSchema = z.object({
  id: z.string().cuid(),
  campgroundId: z.string().cuid(),
  rating: z.number().int().min(1).max(5),
  title: z.string().nullable().optional(),
  body: z.string().nullable().optional(),
  photos: z.array(z.string()).optional(),
  tags: z.array(z.string()).optional(),
  sentiment: z.string().nullable().optional(),
  source: z.enum(["onsite", "email", "sms", "kiosk", "import"]),
  status: z.enum(["pending", "approved", "rejected", "removed"]),
  exposure: z.enum(["private", "public"]),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional()
});
export type Review = z.infer<typeof ReviewSchema>;

export const ReviewRequestSchema = z.object({
  id: z.string().cuid(),
  campgroundId: z.string().cuid(),
  guestId: z.string().cuid().nullable().optional(),
  reservationId: z.string().cuid().nullable().optional(),
  channel: z.string(),
  status: z.string(),
  token: z.string(),
  expiresAt: z.string().nullable().optional(),
  sentAt: z.string().nullable().optional(),
  respondedAt: z.string().nullable().optional()
});
export type ReviewRequest = z.infer<typeof ReviewRequestSchema>;

export const ReviewModerationSchema = z.object({
  id: z.string().cuid(),
  reviewId: z.string().cuid(),
  status: z.enum(["pending", "approved", "rejected", "removed"]),
  reasons: z.array(z.string()).optional(),
  decidedBy: z.string().nullable().optional(),
  decidedAt: z.string().nullable().optional(),
  notes: z.string().nullable().optional()
});
export type ReviewModeration = z.infer<typeof ReviewModerationSchema>;

export const ReviewReplySchema = z.object({
  id: z.string().cuid(),
  reviewId: z.string().cuid(),
  authorType: z.string(),
  authorId: z.string().nullable().optional(),
  body: z.string(),
  createdAt: z.string().optional()
});
export type ReviewReply = z.infer<typeof ReviewReplySchema>;

// Deposits helpers
export * from "./deposits";
