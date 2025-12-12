declare module "@prisma/client" {
  export enum ReservationStatus {
    pending = "pending",
    confirmed = "confirmed",
    checked_in = "checked_in",
    checked_out = "checked_out",
    cancelled = "cancelled",
  }

  export enum TaxRuleType {
    percentage = "percentage",
    flat = "flat",
    exemption = "exemption",
  }

  export enum IdempotencyStatus {
    pending = "pending",
    inflight = "inflight",
    succeeded = "succeeded",
    failed = "failed",
  }

  export enum WaitlistStatus {
    active = "active",
    fulfilled = "fulfilled",
    expired = "expired",
    cancelled = "cancelled",
  }

  export enum WaitlistType {
    regular = "regular",
    seasonal = "seasonal",
  }

  export enum StayReasonPreset {
    vacation = "vacation",
    family_visit = "family_visit",
    event = "event",
    work_remote = "work_remote",
    stopover = "stopover",
    relocation = "relocation",
    other = "other",
  }

  export enum ReferralIncentiveType {
    percent_discount = "percent_discount",
    amount_discount = "amount_discount",
    credit = "credit",
  }

  export enum StoredValueStatus {
    active = "active",
    frozen = "frozen",
    expired = "expired",
  }

  export enum StoredValueDirection {
    issue = "issue",
    redeem = "redeem",
    adjust = "adjust",
    expire = "expire",
    refund = "refund",
    hold_create = "hold_create",
    hold_capture = "hold_capture",
    hold_release = "hold_release",
  }

  export enum UserRole {
    owner = "owner",
    manager = "manager",
    front_desk = "front_desk",
    maintenance = "maintenance",
    finance = "finance",
    marketing = "marketing",
    readonly = "readonly",
  }

  export enum PermissionEffect {
    allow = "allow",
    deny = "deny",
  }

  export enum GamificationEventCategory {
    booking = "booking",
    upsell = "upsell",
    review = "review",
    support = "support",
    social = "social",
    maintenance = "maintenance",
    other = "other",
  }

  export enum SocialAlertCategory {
    weather = "weather",
    occupancy = "occupancy",
    events = "events",
    deals = "deals",
    reviews = "reviews",
    inactivity = "inactivity",
    inventory = "inventory",
  }

  export enum OnboardingStatus {
    pending = "pending",
    in_progress = "in_progress",
    completed = "completed",
    expired = "expired",
    cancelled = "cancelled",
  }

  export enum OnboardingStep {
    account_profile = "account_profile",
    payment_gateway = "payment_gateway",
    taxes_and_fees = "taxes_and_fees",
    inventory_sites = "inventory_sites",
    rates_and_fees = "rates_and_fees",
    policies = "policies",
    communications_templates = "communications_templates",
    pos_hardware = "pos_hardware",
    imports = "imports",
  }

  export enum SocialPostStatus {
    draft = "draft",
    scheduled = "scheduled",
    sending = "sending",
    sent = "sent",
    cancelled = "cancelled",
  }

  export enum SocialSuggestionStatus {
    open = "open",
    accepted = "accepted",
    rejected = "rejected",
  }

  export enum SocialSuggestionType {
    holiday = "holiday",
    promotion = "promotion",
    review = "review",
    weather = "weather",
    occupancy = "occupancy",
    event = "event",
    inactivity = "inactivity",
  }

  export enum PosProviderType {
    clover = "clover",
    square = "square",
    toast = "toast",
  }

  export enum PosProviderCapability {
    payments = "payments",
    items_sync = "items_sync",
    receipts = "receipts",
  }

  export enum PosIntegrationStatus {
    enabled = "enabled",
    disabled = "disabled",
    error = "error",
  }

  export enum PosSyncTarget {
    catalog = "catalog",
    tenders = "tenders",
    payments = "payments",
  }

  export enum PosSyncStatus {
    idle = "idle",
    running = "running",
    succeeded = "succeeded",
    failed = "failed",
  }

  export enum AccessProviderType {
    kisi = "kisi",
    brivo = "brivo",
    cloudkey = "cloudkey",
  }

  export enum AccessGrantStatus {
    pending = "pending",
    active = "active",
    revoked = "revoked",
    blocked = "blocked",
    expired = "expired",
    failed = "failed",
  }

  export enum AccessCredentialType {
    pin = "pin",
    card = "card",
    fob = "fob",
    mobile = "mobile",
    qr = "qr",
  }

  export enum SignatureDocumentType {
    long_term_stay = "long_term_stay",
    park_rules = "park_rules",
    deposit = "deposit",
    waiver = "waiver",
    coi = "coi",
    other = "other",
  }

  export enum SignatureRequestStatus {
    draft = "draft",
    sent = "sent",
    viewed = "viewed",
    signed = "signed",
    declined = "declined",
    voided = "voided",
    expired = "expired",
  }

  export enum SignatureDeliveryChannel {
    email = "email",
    sms = "sms",
    email_and_sms = "email_and_sms",
  }

  export enum CoiStatus {
    pending = "pending",
    active = "active",
    expired = "expired",
    voided = "voided",
  }

  export type Activity = any;
  export type ActivitySession = any;
  export type ActivityBooking = any;
  export type OperationalTask = any;

  export type MembershipType = any;
  export type GuestMembership = any;
  export namespace Prisma {
    export type TransactionClient = any;
    export type InputJsonValue = any;
    export type SocialPostCreateInput = any;
    export type SocialPostUpdateInput = any;
    export type SocialTemplateCreateInput = any;
    export type SocialTemplateUpdateInput = any;
    export type SocialContentAssetCreateInput = any;
    export type SocialContentAssetUpdateInput = any;
    export type SocialSuggestionCreateInput = any;
    export type SocialSuggestionUpdateInput = any;
    export type SocialSuggestionCreateManyInput = any;
    export type GuestMembershipGetPayload<T> = any;
  }

  export class PrismaClient {
    [key: string]: any;
  }
}
