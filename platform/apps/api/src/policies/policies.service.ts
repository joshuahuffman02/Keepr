import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { SignaturesService } from "../signatures/signatures.service";
import { CreatePolicyTemplateDto } from "./dto/create-policy-template.dto";
import { UpdatePolicyTemplateDto } from "./dto/update-policy-template.dto";
import { randomBytes } from "crypto";

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
  value?: any;
  values?: any[];
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
  documentType?: string;
  config: PolicyConfig;
};

export type PolicyAcceptance = {
  templateId: string;
  accepted: boolean;
  signerName?: string;
  signerEmail?: string;
  metadata?: Record<string, any>;
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

const DEFAULT_POLICY_CONFIG: Required<Pick<
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
>> = {
  enforcement: "post_booking",
  showDuringBooking: true,
  requireSignature: true,
  autoSend: false,
  deliveryChannel: "email",
  reminderCadenceDays: 7,
  reminderMaxCount: 8,
  expiresAfterDays: 30,
  signerRequirement: "primary_guest"
};

const ALLOWED_SIGNATURE_TYPES = new Set([
  "long_term_stay",
  "park_rules",
  "deposit",
  "waiver",
  "coi",
  "other"
]);

@Injectable()
export class PoliciesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly signatures: SignaturesService
  ) {}

  private appBaseUrl() {
    return process.env.FRONTEND_URL || "https://app.campreserv.com";
  }

  private normalizeConfig(template: any): PolicyConfig {
    const raw = (template?.policyConfig ?? {}) as PolicyConfig;
    const autoSend = raw.autoSend ?? template?.autoSend ?? DEFAULT_POLICY_CONFIG.autoSend;
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
      signerRequirement: raw.signerRequirement ?? DEFAULT_POLICY_CONFIG.signerRequirement
    };
  }

  private getContextValue(context: Record<string, any>, field: string) {
    const parts = field.split(".");
    let current: any = context;
    for (const part of parts) {
      if (current === null || current === undefined) return undefined;
      current = current[part];
    }
    return current;
  }

  private toComparable(value: any) {
    if (value instanceof Date) return value.getTime();
    if (typeof value === "number") return value;
    if (typeof value === "string") {
      const date = Date.parse(value);
      if (!Number.isNaN(date)) return date;
      const num = Number(value);
      if (!Number.isNaN(num)) return num;
    }
    return value;
  }

  private evaluateRule(rule: PolicyRule, context: PolicyContext) {
    const actual = this.getContextValue(context as any, rule.field);
    const op = rule.op;
    const value = rule.value;
    const values = rule.values ?? (value !== undefined ? [value] : []);

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
        return left > right;
      case "gte":
        return left >= right;
      case "lt":
        return left < right;
      case "lte":
        return left <= right;
      case "between": {
        if (!Array.isArray(values) || values.length < 2) return false;
        const min = this.toComparable(values[0]);
        const max = this.toComparable(values[1]);
        return left >= min && left <= max;
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
    if (typeof config.minNights === "number" && nights !== null && nights < config.minNights) return false;
    if (typeof config.maxNights === "number" && nights !== null && nights > config.maxNights) return false;

    const siteType = context.site?.siteType ?? context.siteClass?.siteType ?? null;
    if (config.siteTypes?.length && siteType && !config.siteTypes.includes(siteType)) return false;

    const siteId = context.site?.id ?? null;
    if (config.siteIds?.length && siteId && !config.siteIds.includes(siteId)) return false;

    const siteClassId = context.site?.siteClassId ?? context.siteClass?.id ?? null;
    if (config.siteClassIds?.length && siteClassId && !config.siteClassIds.includes(siteClassId)) return false;

    const petTypes = context.guest?.petTypes ?? [];
    if (config.petTypes?.length && !config.petTypes.some((p) => petTypes.includes(p))) return false;

    return true;
  }

  private templateApplies(template: any, context: PolicyContext) {
    if (template.siteId && template.siteId !== context.site?.id) return false;
    if (template.siteClassId && template.siteClassId !== context.site?.siteClassId && template.siteClassId !== context.siteClass?.id) {
      return false;
    }

    const config = this.normalizeConfig(template);
    if (!this.matchesSimpleConfig(config, context)) return false;
    return this.evaluateRuleGroup(config, context);
  }

  private toRequirement(template: any): PolicyRequirement {
    return {
      id: template.id,
      name: template.name,
      description: template.description ?? null,
      content: template.content ?? "",
      version: template.version ?? 1,
      siteId: template.siteId ?? null,
      siteClassId: template.siteClassId ?? null,
      documentType: template.type ?? "other",
      config: this.normalizeConfig(template)
    };
  }

  async listTemplates(campgroundId: string) {
    return this.prisma.documentTemplate.findMany({
      where: { campgroundId },
      orderBy: { updatedAt: "desc" }
    });
  }

  async createTemplate(campgroundId: string, dto: CreatePolicyTemplateDto) {
    const type = dto.type && ALLOWED_SIGNATURE_TYPES.has(dto.type) ? dto.type : "other";
    return this.prisma.documentTemplate.create({
      data: {
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
        policyConfig: dto.policyConfig ?? null
      }
    });
  }

  async updateTemplate(campgroundId: string, id: string, dto: UpdatePolicyTemplateDto) {
    const existing = await this.prisma.documentTemplate.findFirst({
      where: { id, campgroundId }
    });
    if (!existing) {
      throw new NotFoundException("Policy template not found");
    }
    const type = dto.type && ALLOWED_SIGNATURE_TYPES.has(dto.type) ? dto.type : undefined;
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
        policyConfig: dto.policyConfig ?? undefined
      }
    });
  }

  async removeTemplate(campgroundId: string, id: string) {
    const existing = await this.prisma.documentTemplate.findFirst({
      where: { id, campgroundId }
    });
    if (!existing) {
      throw new NotFoundException("Policy template not found");
    }
    return this.prisma.documentTemplate.delete({ where: { id } });
  }

  async evaluatePolicies(campgroundId: string, context: PolicyContext) {
    const templates = await this.prisma.documentTemplate.findMany({
      where: { campgroundId, isActive: true },
      orderBy: { updatedAt: "desc" }
    });
    return templates.filter((tpl) => this.templateApplies(tpl, context)).map((tpl) => this.toRequirement(tpl));
  }

  async assertPreBookingPolicies(
    campgroundId: string,
    context: PolicyContext,
    acceptances: PolicyAcceptance[] | undefined
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
        policies: missing.map((req) => ({ id: req.id, name: req.name }))
      });
    }

    return { requirements, acceptanceMap };
  }

  async applyPoliciesToReservation(args: {
    reservation: any;
    guest: any;
    site?: any;
    siteClass?: any;
    channel?: string;
    acceptances?: PolicyAcceptance[];
  }) {
    const arrival = args.reservation.arrivalDate ? new Date(args.reservation.arrivalDate) : null;
    const departure = args.reservation.departureDate ? new Date(args.reservation.departureDate) : null;
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
        departureDate: departure ?? undefined
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
          maxOccupancy: args.site.maxOccupancy
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
          maxNights: args.siteClass.maxNights ?? null
        }
        : undefined,
      guest: {
        adults: args.reservation.adults ?? undefined,
        children: args.reservation.children ?? undefined,
        partySize: (args.reservation.adults ?? 0) + (args.reservation.children ?? 0),
        petCount: args.reservation.petCount ?? undefined,
        petTypes: (args.reservation.petTypes as string[]) ?? [],
        stayReasonPreset: args.reservation.stayReasonPreset ?? undefined
      }
    };

    const requirements = await this.evaluatePolicies(args.reservation.campgroundId, context);
    const acceptanceMap = new Map((args.acceptances ?? []).map((a) => [a.templateId, a]));
    const results: any[] = [];

    for (const req of requirements) {
      const acceptance = acceptanceMap.get(req.id);
      const existing = await this.prisma.signatureRequest.findFirst({
        where: {
          reservationId: args.reservation.id,
          templateId: req.id
        }
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
        ...(acceptance?.metadata ?? {})
      };

      if (acceptance?.accepted) {
        const signed = await this.signatures.createSignedRequest({
          campgroundId: args.reservation.campgroundId,
          reservationId: args.reservation.id,
          guestId: args.reservation.guestId,
          templateId: req.id,
          documentType: req.documentType ?? "other",
          recipientName: acceptance.signerName ?? args.guest?.primaryFirstName ?? null,
          recipientEmail: acceptance.signerEmail ?? args.guest?.email ?? null,
          metadata
        });
        results.push(signed);
        continue;
      }

      if (req.config.autoSend) {
        const expiresAt = new Date(Date.now() + (req.config.expiresAfterDays ?? 30) * 24 * 60 * 60 * 1000);
        const reminderAt = new Date(Date.now() + (req.config.reminderCadenceDays ?? 7) * 24 * 60 * 60 * 1000);
        const sent = await this.signatures.createAndSend(
          {
            campgroundId: args.reservation.campgroundId,
            reservationId: args.reservation.id,
            guestId: args.reservation.guestId,
            templateId: req.id,
            documentType: req.documentType ?? "other",
            subject: req.name,
            recipientEmail: args.guest?.email ?? undefined,
            recipientPhone: args.guest?.phone ?? undefined,
            deliveryChannel: req.config.deliveryChannel ?? "email",
            message: req.content ? req.content.slice(0, 280) : undefined,
            expiresAt: expiresAt.toISOString(),
            reminderAt: reminderAt.toISOString(),
            metadata
          },
          null
        );
        results.push(sent);
      } else {
        const created = await this.prisma.signatureRequest.create({
          data: {
            campgroundId: args.reservation.campgroundId,
            reservationId: args.reservation.id,
            guestId: args.reservation.guestId,
            templateId: req.id,
            documentType: req.documentType ?? "other",
            status: "draft",
            deliveryChannel: req.config.deliveryChannel ?? "email",
            token: randomBytes(24).toString("hex"),
            subject: req.name,
            recipientName: args.guest?.primaryFirstName ?? null,
            recipientEmail: args.guest?.email ?? null,
            recipientPhone: args.guest?.phone ?? null,
            metadata
          }
        });
        results.push(created);
      }
    }

    return results;
  }

  async getPendingPolicyCompliance(reservationId: string) {
    const requests = await this.prisma.signatureRequest.findMany({
      where: { reservationId },
      include: { template: true }
    });

    const pending = requests.filter((req) => {
      const isPolicy = Boolean(req.metadata?.policyId || req.metadata?.enforcement);
      if (!isPolicy) return false;
      return !["signed"].includes(req.status);
    });

    const blocking = pending.find((req) => {
      const enforcement = (req.metadata as any)?.enforcement
        ?? (req.template ? this.normalizeConfig(req.template).enforcement : "post_booking");
      return enforcement === "pre_checkin";
    });

    if (!blocking) return { ok: true };

    const signingUrl = blocking.token ? `${this.appBaseUrl()}/sign/${blocking.token}` : undefined;
    return {
      ok: false,
      reason: "policy_required",
      signingUrl,
      pending: pending.map((req) => ({
        id: req.id,
        name: req.template?.name ?? req.metadata?.policyName ?? "Policy",
        status: req.status
      }))
    };
  }
}
