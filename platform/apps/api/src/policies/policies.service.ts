import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { SignaturesService } from "../signatures/signatures.service";
import { CreatePolicyTemplateDto } from "./dto/create-policy-template.dto";
import { UpdatePolicyTemplateDto } from "./dto/update-policy-template.dto";
import { randomBytes, randomUUID } from "crypto";
import { Prisma, SignatureDeliveryChannel, SignatureDocumentType } from "@prisma/client";
import type {
  DocumentTemplate,
  Guest,
  Reservation,
  SignatureRequest,
  Site,
  SiteClass,
} from "@prisma/client";

type PolicyRuleOperator =
  | "eq"
  | "neq"
  | "in"
  | "not_in"
  | "gt"
  | "gte"
  | "lt"
  | "lte"
  | "between"
  | "contains"
  | "contains_any"
  | "contains_all"
  | "exists";

export type PolicyRule = {
  field: string;
  op: PolicyRuleOperator;
  value?: unknown;
  values?: unknown[];
};

export type PolicyRuleGroup = {
  mode?: "all" | "any";
  rules?: PolicyRule[];
};

export type PolicyConfig = {
  enforcement?: "none" | "pre_booking" | "pre_checkin" | "post_booking";
  showDuringBooking?: boolean;
  requireSignature?: boolean;
  autoSend?: boolean;
  deliveryChannel?: "email" | "sms" | "email_and_sms";
  reminderCadenceDays?: number;
  reminderMaxCount?: number;
  expiresAfterDays?: number;
  signerRequirement?: string;
  enforceOnChannels?: string[];
  minNights?: number;
  maxNights?: number;
  siteTypes?: string[];
  siteClassIds?: string[];
  siteIds?: string[];
  petTypes?: string[];
  rules?: PolicyRuleGroup | PolicyRule[];
};

export type PolicyRequirement = {
  id: string;
  name: string;
  description?: string | null;
  content: string;
  version: number;
  siteId?: string | null;
  siteClassId?: string | null;
  documentType?: SignatureDocumentType;
  config: PolicyConfig;
};

export type PolicyAcceptance = {
  templateId: string;
  accepted: boolean;
  signerName?: string;
  signerEmail?: string;
  metadata?: Record<string, unknown>;
};

export type PolicyContext = {
  campgroundId: string;
  channel?: string;
  stay?: {
    nights?: number;
    arrivalDate?: Date;
    departureDate?: Date;
  };
  site?: {
    id?: string | null;
    siteClassId?: string | null;
    siteType?: string | null;
    tags?: string[];
    amenityTags?: string[];
    vibeTags?: string[];
    petFriendly?: boolean;
    accessible?: boolean;
    maxOccupancy?: number | null;
  };
  siteClass?: {
    id?: string | null;
    siteType?: string | null;
    tags?: string[];
    petFriendly?: boolean;
    accessible?: boolean;
    maxOccupancy?: number | null;
    minNights?: number | null;
    maxNights?: number | null;
  };
  guest?: {
    adults?: number;
    children?: number;
    partySize?: number;
    petCount?: number | null;
    petTypes?: string[];
    stayReasonPreset?: string | null;
  };
};

const DEFAULT_POLICY_CONFIG: Required<
  Pick<
    PolicyConfig,
    | "enforcement"
    | "showDuringBooking"
    | "requireSignature"
    | "autoSend"
    | "deliveryChannel"
    | "reminderCadenceDays"
    | "reminderMaxCount"
    | "expiresAfterDays"
    | "signerRequirement"
  >
> = {
  enforcement: "post_booking",
  showDuringBooking: true,
  requireSignature: true,
  autoSend: false,
  deliveryChannel: "email",
  reminderCadenceDays: 7,
  reminderMaxCount: 8,
  expiresAfterDays: 30,
  signerRequirement: "primary_guest",
};

const ALLOWED_SIGNATURE_TYPES = new Set<SignatureDocumentType>([
  SignatureDocumentType.long_term_stay,
  SignatureDocumentType.park_rules,
  SignatureDocumentType.deposit,
  SignatureDocumentType.waiver,
  SignatureDocumentType.coi,
  SignatureDocumentType.other,
]);

type PolicySignatureResult = SignatureRequest | { request: SignatureRequest; signingUrl: string };

const toJsonValue = (value: unknown): Prisma.InputJsonValue | undefined => {
  if (value === undefined || value === null) return undefined;
  try {
    return JSON.parse(JSON.stringify(value));
  } catch {
    return undefined;
  }
};

const toNullableJsonInput = (
  value: unknown,
): Prisma.InputJsonValue | Prisma.NullableJsonNullValueInput | undefined => {
  if (value === undefined) return undefined;
  if (value === null) return Prisma.JsonNull;
  return toJsonValue(value) ?? Prisma.JsonNull;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const getString = (value: unknown): string | undefined =>
  typeof value === "string" ? value : undefined;

const getBoolean = (value: unknown): boolean | undefined =>
  typeof value === "boolean" ? value : undefined;

const getNumber = (value: unknown): number | undefined =>
  typeof value === "number" && Number.isFinite(value) ? value : undefined;

const getStringArray = (value: unknown): string[] => {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string");
};

const isPolicyRuleOperator = (value: unknown): value is PolicyRuleOperator =>
  value === "eq" ||
  value === "neq" ||
  value === "in" ||
  value === "not_in" ||
  value === "gt" ||
  value === "gte" ||
  value === "lt" ||
  value === "lte" ||
  value === "between" ||
  value === "contains" ||
  value === "contains_any" ||
  value === "contains_all" ||
  value === "exists";

const isSignatureDocumentType = (value: string): value is SignatureDocumentType =>
  Object.values(SignatureDocumentType).some((type) => type === value);

const isAllowedSignatureType = (value: string): value is SignatureDocumentType =>
  isSignatureDocumentType(value) && ALLOWED_SIGNATURE_TYPES.has(value);

const isPolicyEnforcement = (value: unknown): value is NonNullable<PolicyConfig["enforcement"]> =>
  value === "none" ||
  value === "pre_booking" ||
  value === "pre_checkin" ||
  value === "post_booking";

const isDeliveryChannel = (value: unknown): value is NonNullable<PolicyConfig["deliveryChannel"]> =>
  value === "email" || value === "sms" || value === "email_and_sms";

@Injectable()
export class PoliciesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly signatures: SignaturesService,
  ) {}

  private appBaseUrl() {
    return process.env.FRONTEND_URL || "https://app.campreserv.com";
  }

  private normalizeConfig(template: DocumentTemplate): PolicyConfig {
    const raw = this.parsePolicyConfig(template.policyConfig);
    const autoSend = raw.autoSend ?? template.autoSend ?? DEFAULT_POLICY_CONFIG.autoSend;
    return {
      ...DEFAULT_POLICY_CONFIG,
      ...raw,
      autoSend,
      enforcement: raw.enforcement ?? DEFAULT_POLICY_CONFIG.enforcement,
      showDuringBooking: raw.showDuringBooking ?? DEFAULT_POLICY_CONFIG.showDuringBooking,
      requireSignature: raw.requireSignature ?? DEFAULT_POLICY_CONFIG.requireSignature,
      deliveryChannel: raw.deliveryChannel ?? DEFAULT_POLICY_CONFIG.deliveryChannel,
      reminderCadenceDays: raw.reminderCadenceDays ?? DEFAULT_POLICY_CONFIG.reminderCadenceDays,
      reminderMaxCount: raw.reminderMaxCount ?? DEFAULT_POLICY_CONFIG.reminderMaxCount,
      expiresAfterDays: raw.expiresAfterDays ?? DEFAULT_POLICY_CONFIG.expiresAfterDays,
      signerRequirement: raw.signerRequirement ?? DEFAULT_POLICY_CONFIG.signerRequirement,
    };
  }

  private parsePolicyConfig(value: unknown): PolicyConfig {
    if (!isRecord(value)) return {};
    const config: PolicyConfig = {};

    const enforcement = getString(value.enforcement);
    if (isPolicyEnforcement(enforcement)) config.enforcement = enforcement;

    const showDuringBooking = getBoolean(value.showDuringBooking);
    if (showDuringBooking !== undefined) config.showDuringBooking = showDuringBooking;

    const requireSignature = getBoolean(value.requireSignature);
    if (requireSignature !== undefined) config.requireSignature = requireSignature;

    const autoSend = getBoolean(value.autoSend);
    if (autoSend !== undefined) config.autoSend = autoSend;

    const deliveryChannel = getString(value.deliveryChannel);
    if (isDeliveryChannel(deliveryChannel)) config.deliveryChannel = deliveryChannel;

    const reminderCadenceDays = getNumber(value.reminderCadenceDays);
    if (reminderCadenceDays !== undefined) config.reminderCadenceDays = reminderCadenceDays;

    const reminderMaxCount = getNumber(value.reminderMaxCount);
    if (reminderMaxCount !== undefined) config.reminderMaxCount = reminderMaxCount;

    const expiresAfterDays = getNumber(value.expiresAfterDays);
    if (expiresAfterDays !== undefined) config.expiresAfterDays = expiresAfterDays;

    const signerRequirement = getString(value.signerRequirement);
    if (signerRequirement) config.signerRequirement = signerRequirement;

    const enforceOnChannels = getStringArray(value.enforceOnChannels);
    if (enforceOnChannels.length) config.enforceOnChannels = enforceOnChannels;

    const minNights = getNumber(value.minNights);
    if (minNights !== undefined) config.minNights = minNights;

    const maxNights = getNumber(value.maxNights);
    if (maxNights !== undefined) config.maxNights = maxNights;

    const siteTypes = getStringArray(value.siteTypes);
    if (siteTypes.length) config.siteTypes = siteTypes;

    const siteClassIds = getStringArray(value.siteClassIds);
    if (siteClassIds.length) config.siteClassIds = siteClassIds;

    const siteIds = getStringArray(value.siteIds);
    if (siteIds.length) config.siteIds = siteIds;

    const petTypes = getStringArray(value.petTypes);
    if (petTypes.length) config.petTypes = petTypes;

    const rules = this.parsePolicyRules(value.rules);
    if (rules) config.rules = rules;

    return config;
  }

  private parsePolicyRules(value: unknown): PolicyRuleGroup | PolicyRule[] | undefined {
    if (Array.isArray(value)) {
      const rules = value
        .map((rule) => this.parsePolicyRule(rule))
        .filter((rule): rule is PolicyRule => rule !== null);
      return rules.length ? rules : undefined;
    }

    if (!isRecord(value)) return undefined;
    const mode = value.mode;
    const rulesValue = value.rules;
    const normalizedMode = mode === "all" || mode === "any" ? mode : undefined;
    const rules = Array.isArray(rulesValue)
      ? rulesValue
          .map((rule) => this.parsePolicyRule(rule))
          .filter((rule): rule is PolicyRule => rule !== null)
      : [];

    if (!normalizedMode && rules.length === 0) return undefined;
    return {
      ...(normalizedMode ? { mode: normalizedMode } : {}),
      rules,
    };
  }

  private parsePolicyRule(value: unknown): PolicyRule | null {
    if (!isRecord(value)) return null;
    const field = getString(value.field);
    const op = value.op;
    if (!field || !isPolicyRuleOperator(op)) return null;
    const rule: PolicyRule = { field, op };
    if ("value" in value) {
      rule.value = value.value;
    }
    if (Array.isArray(value.values)) {
      rule.values = value.values;
    }
    return rule;
  }

  private getContextValue(context: PolicyContext, field: string) {
    const parts = field.split(".");
    let current: unknown = context;
    for (const part of parts) {
      if (!isRecord(current)) return undefined;
      current = current[part];
    }
    return current;
  }

  private toComparable(value: unknown): string | number | boolean | null | undefined {
    if (value instanceof Date) return value.getTime();
    if (typeof value === "number") return value;
    if (typeof value === "boolean") return value;
    if (typeof value === "string") {
      const date = Date.parse(value);
      if (!Number.isNaN(date)) return date;
      const num = Number(value);
      if (!Number.isNaN(num)) return num;
      return value;
    }
    if (value === null) return null;
    return undefined;
  }

  private evaluateRule(rule: PolicyRule, context: PolicyContext) {
    const actual = this.getContextValue(context, rule.field);
    const op = rule.op;
    const value = rule.value;
    const values = Array.isArray(rule.values) ? rule.values : value !== undefined ? [value] : [];

    if (op === "exists") {
      return actual !== undefined && actual !== null;
    }

    if (op === "contains") {
      if (Array.isArray(actual)) return value !== undefined ? actual.includes(value) : false;
      if (typeof actual === "string" && value !== undefined) return actual.includes(String(value));
      return false;
    }

    if (op === "contains_any") {
      if (!Array.isArray(values) || values.length === 0) return false;
      if (Array.isArray(actual)) return values.some((v) => actual.includes(v));
      if (typeof actual === "string") return values.some((v) => actual.includes(String(v)));
      return false;
    }

    if (op === "contains_all") {
      if (!Array.isArray(values) || values.length === 0) return false;
      if (Array.isArray(actual)) return values.every((v) => actual.includes(v));
      if (typeof actual === "string") return values.every((v) => actual.includes(String(v)));
      return false;
    }

    if (op === "in") {
      if (Array.isArray(actual)) return values.some((v) => actual.includes(v));
      return values.includes(actual);
    }

    if (op === "not_in") {
      if (Array.isArray(actual)) return !values.some((v) => actual.includes(v));
      return !values.includes(actual);
    }

    const left = this.toComparable(actual);
    const right = this.toComparable(value);

    switch (op) {
      case "eq":
        return left === right;
      case "neq":
        return left !== right;
      case "gt":
        return right !== null &&
          right !== undefined &&
          typeof left === typeof right &&
          (typeof left === "number" || typeof left === "string")
          ? left > right
          : false;
      case "gte":
        return right !== null &&
          right !== undefined &&
          typeof left === typeof right &&
          (typeof left === "number" || typeof left === "string")
          ? left >= right
          : false;
      case "lt":
        return right !== null &&
          right !== undefined &&
          typeof left === typeof right &&
          (typeof left === "number" || typeof left === "string")
          ? left < right
          : false;
      case "lte":
        return right !== null &&
          right !== undefined &&
          typeof left === typeof right &&
          (typeof left === "number" || typeof left === "string")
          ? left <= right
          : false;
      case "between": {
        if (!Array.isArray(values) || values.length < 2) return false;
        const min = this.toComparable(values[0]);
        const max = this.toComparable(values[1]);
        if (typeof left !== typeof min || typeof left !== typeof max) return false;
        if (typeof left === "number" && typeof min === "number" && typeof max === "number") {
          return left >= min && left <= max;
        }
        if (typeof left === "string" && typeof min === "string" && typeof max === "string") {
          return left >= min && left <= max;
        }
        return false;
      }
      default:
        return false;
    }
  }

  private evaluateRuleGroup(config: PolicyConfig, context: PolicyContext) {
    const raw = config.rules;
    if (!raw) return true;

    const group: PolicyRuleGroup = Array.isArray(raw) ? { mode: "all", rules: raw } : raw;
    const rules = group.rules ?? [];
    if (!rules.length) return true;
    const mode = group.mode ?? "all";
    const results = rules.map((rule) => this.evaluateRule(rule, context));
    return mode === "any" ? results.some(Boolean) : results.every(Boolean);
  }

  private matchesSimpleConfig(config: PolicyConfig, context: PolicyContext) {
    const nights = context.stay?.nights ?? null;
    if (typeof config.minNights === "number" && nights !== null && nights < config.minNights)
      return false;
    if (typeof config.maxNights === "number" && nights !== null && nights > config.maxNights)
      return false;

    const siteType = context.site?.siteType ?? context.siteClass?.siteType ?? null;
    if (config.siteTypes?.length && siteType && !config.siteTypes.includes(siteType)) return false;

    const siteId = context.site?.id ?? null;
    if (config.siteIds?.length && siteId && !config.siteIds.includes(siteId)) return false;

    const siteClassId = context.site?.siteClassId ?? context.siteClass?.id ?? null;
    if (config.siteClassIds?.length && siteClassId && !config.siteClassIds.includes(siteClassId))
      return false;

    const petTypes = context.guest?.petTypes ?? [];
    if (config.petTypes?.length && !config.petTypes.some((p) => petTypes.includes(p))) return false;

    return true;
  }

  private templateApplies(template: DocumentTemplate, context: PolicyContext) {
    if (template.siteId && template.siteId !== context.site?.id) return false;
    if (
      template.siteClassId &&
      template.siteClassId !== context.site?.siteClassId &&
      template.siteClassId !== context.siteClass?.id
    ) {
      return false;
    }

    const config = this.normalizeConfig(template);
    if (!this.matchesSimpleConfig(config, context)) return false;
    return this.evaluateRuleGroup(config, context);
  }

  private toRequirement(template: DocumentTemplate): PolicyRequirement {
    return {
      id: template.id,
      name: template.name,
      description: template.description ?? null,
      content: template.content ?? "",
      version: template.version ?? 1,
      siteId: template.siteId ?? null,
      siteClassId: template.siteClassId ?? null,
      documentType: template.type ?? SignatureDocumentType.other,
      config: this.normalizeConfig(template),
    };
  }

  async listTemplates(campgroundId: string) {
    return this.prisma.documentTemplate.findMany({
      where: { campgroundId },
      orderBy: { updatedAt: "desc" },
    });
  }

  async createTemplate(campgroundId: string, dto: CreatePolicyTemplateDto) {
    const type =
      dto.type && isAllowedSignatureType(dto.type) ? dto.type : SignatureDocumentType.other;
    return this.prisma.documentTemplate.create({
      data: {
        id: randomUUID(),
        campgroundId,
        name: dto.name.trim(),
        description: dto.description ?? null,
        content: dto.content ?? "",
        type,
        version: dto.version ?? 1,
        isActive: dto.isActive ?? true,
        autoSend: dto.autoSend ?? false,
        siteClassId: dto.siteClassId ?? null,
        siteId: dto.siteId ?? null,
        policyConfig: toNullableJsonInput(dto.policyConfig),
        updatedAt: new Date(),
      },
    });
  }

  async updateTemplate(campgroundId: string, id: string, dto: UpdatePolicyTemplateDto) {
    const existing = await this.prisma.documentTemplate.findFirst({
      where: { id, campgroundId },
    });
    if (!existing) {
      throw new NotFoundException("Policy template not found");
    }
    const type = dto.type && isAllowedSignatureType(dto.type) ? dto.type : undefined;
    return this.prisma.documentTemplate.update({
      where: { id },
      data: {
        name: dto.name?.trim(),
        description: dto.description ?? undefined,
        content: dto.content ?? undefined,
        type,
        version: dto.version ?? undefined,
        isActive: dto.isActive ?? undefined,
        autoSend: dto.autoSend ?? undefined,
        siteClassId: dto.siteClassId ?? undefined,
        siteId: dto.siteId ?? undefined,
        policyConfig:
          dto.policyConfig === undefined ? undefined : toNullableJsonInput(dto.policyConfig),
        updatedAt: new Date(),
      },
    });
  }

  async removeTemplate(campgroundId: string, id: string) {
    const existing = await this.prisma.documentTemplate.findFirst({
      where: { id, campgroundId },
    });
    if (!existing) {
      throw new NotFoundException("Policy template not found");
    }
    return this.prisma.documentTemplate.delete({ where: { id } });
  }

  async evaluatePolicies(campgroundId: string, context: PolicyContext) {
    const templates = await this.prisma.documentTemplate.findMany({
      where: { campgroundId, isActive: true },
      orderBy: { updatedAt: "desc" },
    });
    return templates
      .filter((tpl) => this.templateApplies(tpl, context))
      .map((tpl) => this.toRequirement(tpl));
  }

  async assertPreBookingPolicies(
    campgroundId: string,
    context: PolicyContext,
    acceptances: PolicyAcceptance[] | undefined,
  ) {
    const requirements = await this.evaluatePolicies(campgroundId, context);
    const acceptanceMap = new Map((acceptances ?? []).map((a) => [a.templateId, a]));

    const missing = requirements.filter((req) => {
      if (req.config.enforcement !== "pre_booking") return false;
      const channels = req.config.enforceOnChannels ?? ["online"];
      if (context.channel && !channels.includes(context.channel)) return false;
      const acceptance = acceptanceMap.get(req.id);
      return !acceptance?.accepted;
    });

    if (missing.length) {
      throw new BadRequestException({
        reason: "policy_required",
        policies: missing.map((req) => ({ id: req.id, name: req.name })),
      });
    }

    return { requirements, acceptanceMap };
  }

  async applyPoliciesToReservation(args: {
    reservation: Reservation;
    guest: Guest | null;
    site?: Site | null;
    siteClass?: SiteClass | null;
    channel?: string;
    acceptances?: PolicyAcceptance[];
  }) {
    const arrival = args.reservation.arrivalDate ? new Date(args.reservation.arrivalDate) : null;
    const departure = args.reservation.departureDate
      ? new Date(args.reservation.departureDate)
      : null;
    const nights =
      arrival && departure
        ? Math.max(1, Math.round((departure.getTime() - arrival.getTime()) / (1000 * 60 * 60 * 24)))
        : undefined;

    const context: PolicyContext = {
      campgroundId: args.reservation.campgroundId,
      channel: args.channel,
      stay: {
        nights,
        arrivalDate: arrival ?? undefined,
        departureDate: departure ?? undefined,
      },
      site: args.site
        ? {
            id: args.site.id,
            siteClassId: args.site.siteClassId,
            siteType: args.site.siteType,
            tags: args.site.tags ?? [],
            amenityTags: args.site.amenityTags ?? [],
            vibeTags: args.site.vibeTags ?? [],
            petFriendly: args.site.petFriendly,
            accessible: args.site.accessible,
            maxOccupancy: args.site.maxOccupancy,
          }
        : undefined,
      siteClass: args.siteClass
        ? {
            id: args.siteClass.id,
            siteType: args.siteClass.siteType,
            tags: args.siteClass.tags ?? [],
            petFriendly: args.siteClass.petFriendly,
            accessible: args.siteClass.accessible,
            maxOccupancy: args.siteClass.maxOccupancy,
            minNights: args.siteClass.minNights ?? null,
            maxNights: args.siteClass.maxNights ?? null,
          }
        : undefined,
      guest: {
        adults: args.reservation.adults ?? undefined,
        children: args.reservation.children ?? undefined,
        partySize: (args.reservation.adults ?? 0) + (args.reservation.children ?? 0),
        petCount: args.reservation.petCount ?? undefined,
        petTypes: getStringArray(args.reservation.petTypes),
        stayReasonPreset: args.reservation.stayReasonPreset ?? undefined,
      },
    };

    const requirements = await this.evaluatePolicies(args.reservation.campgroundId, context);
    const acceptanceMap = new Map((args.acceptances ?? []).map((a) => [a.templateId, a]));
    const results: PolicySignatureResult[] = [];

    for (const req of requirements) {
      const acceptance = acceptanceMap.get(req.id);
      const existing = await this.prisma.signatureRequest.findFirst({
        where: {
          reservationId: args.reservation.id,
          templateId: req.id,
        },
      });
      if (existing) {
        results.push(existing);
        continue;
      }

      const metadata = {
        policyId: req.id,
        policyName: req.name,
        policyVersion: req.version,
        enforcement: req.config.enforcement,
        reminderCadenceDays: req.config.reminderCadenceDays,
        reminderMaxCount: req.config.reminderMaxCount,
        requireSignature: req.config.requireSignature,
        signerRequirement: req.config.signerRequirement,
        ...(acceptance?.metadata ?? {}),
      };

      if (acceptance?.accepted) {
        const signed = await this.signatures.createSignedRequest({
          campgroundId: args.reservation.campgroundId,
          reservationId: args.reservation.id,
          guestId: args.reservation.guestId,
          templateId: req.id,
          documentType: req.documentType ?? SignatureDocumentType.other,
          recipientName: acceptance.signerName ?? args.guest?.primaryFirstName ?? null,
          recipientEmail: acceptance.signerEmail ?? args.guest?.email ?? null,
          metadata,
        });
        results.push(signed);
        continue;
      }

      if (req.config.autoSend) {
        const expiresAt = new Date(
          Date.now() + (req.config.expiresAfterDays ?? 30) * 24 * 60 * 60 * 1000,
        );
        const reminderAt = new Date(
          Date.now() + (req.config.reminderCadenceDays ?? 7) * 24 * 60 * 60 * 1000,
        );
        const sent = await this.signatures.createAndSend(
          {
            campgroundId: args.reservation.campgroundId,
            reservationId: args.reservation.id,
            guestId: args.reservation.guestId,
            templateId: req.id,
            documentType: req.documentType ?? SignatureDocumentType.other,
            subject: req.name,
            recipientEmail: args.guest?.email ?? undefined,
            recipientPhone: args.guest?.phone ?? undefined,
            deliveryChannel: req.config.deliveryChannel ?? SignatureDeliveryChannel.email,
            message: req.content ? req.content.slice(0, 280) : undefined,
            expiresAt: expiresAt.toISOString(),
            reminderAt: reminderAt.toISOString(),
            metadata,
          },
          null,
        );
        results.push(sent);
      } else {
        const created = await this.prisma.signatureRequest.create({
          data: {
            id: randomUUID(),
            campgroundId: args.reservation.campgroundId,
            reservationId: args.reservation.id,
            guestId: args.reservation.guestId,
            templateId: req.id,
            documentType: req.documentType ?? SignatureDocumentType.other,
            status: "draft",
            deliveryChannel: req.config.deliveryChannel ?? SignatureDeliveryChannel.email,
            token: randomBytes(24).toString("hex"),
            subject: req.name,
            recipientName: args.guest?.primaryFirstName ?? null,
            recipientEmail: args.guest?.email ?? null,
            recipientPhone: args.guest?.phone ?? null,
            metadata: toNullableJsonInput(metadata),
            updatedAt: new Date(),
          },
        });
        results.push(created);
      }
    }

    return results;
  }

  async getPendingPolicyCompliance(reservationId: string) {
    const requests = await this.prisma.signatureRequest.findMany({
      where: { reservationId },
      include: { DocumentTemplate: true },
    });

    const pending = requests.filter((req) => {
      const metadata = isRecord(req.metadata) ? req.metadata : undefined;
      const isPolicy = Boolean(metadata?.policyId || metadata?.enforcement);
      if (!isPolicy) return false;
      return !["signed"].includes(req.status);
    });

    const blocking = pending.find((req) => {
      const metadata = isRecord(req.metadata) ? req.metadata : undefined;
      const template = req.DocumentTemplate ?? undefined;
      const enforcement =
        getString(metadata?.enforcement) ??
        (template ? this.normalizeConfig(template).enforcement : undefined) ??
        "post_booking";
      return enforcement === "pre_checkin";
    });

    if (!blocking) return { ok: true };

    const signingUrl = blocking.token ? `${this.appBaseUrl()}/sign/${blocking.token}` : undefined;
    return {
      ok: false,
      reason: "policy_required",
      signingUrl,
      pending: pending.map((req) => {
        const metadata = isRecord(req.metadata) ? req.metadata : undefined;
        return {
          id: req.id,
          name: req.DocumentTemplate?.name ?? getString(metadata?.policyName) ?? "Policy",
          status: req.status,
        };
      }),
    };
  }
}
