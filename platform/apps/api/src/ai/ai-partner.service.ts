import { Injectable, Logger } from "@nestjs/common";
import { randomUUID } from "crypto";
import { AiProviderService } from "./ai-provider.service";
import { AiPrivacyService } from "./ai-privacy.service";
import { AiFeatureGateService } from "./ai-feature-gate.service";
import {
  AdjustmentType,
  AiFeatureType,
  MaintenancePriority,
  PlatformRole,
  PricingRuleType,
  PricingStackMode,
  UserRole,
} from "@prisma/client";
import { PermissionsService } from "../permissions/permissions.service";
import { AuditService } from "../audit/audit.service";
import { PrismaService } from "../prisma/prisma.service";
import { HoldsService } from "../holds/holds.service";
import { PublicReservationsService } from "../public-reservations/public-reservations.service";
import { MaintenanceService } from "../maintenance/maintenance.service";
import { OperationsService } from "../operations/operations.service";
import { RepeatChargesService } from "../repeat-charges/repeat-charges.service";
import { ReservationsService } from "../reservations/reservations.service";
import { PricingV2Service } from "../pricing-v2/pricing-v2.service";
import type { AuthMembership, AuthUser } from "../auth/auth.types";
import type { Request } from "express";
// Analytical services for enhanced insights
import { AiYieldService } from "./ai-yield.service";
import { AiDynamicPricingService } from "./ai-dynamic-pricing.service";
import { AiDashboardService } from "./ai-dashboard.service";
import { AiRevenueManagerService } from "./ai-revenue-manager.service";
type PartnerMode = "staff" | "admin";
type PersonaKey =
  | "revenue"
  | "operations"
  | "marketing"
  | "accounting"
  | "hospitality"
  | "compliance"
  | "general";

export type ActionType =
  | "lookup_availability"
  | "create_hold"
  | "block_site"
  | "create_maintenance_ticket"
  | "create_operational_task"
  | "update_housekeeping_status"
  | "generate_billing_schedule"
  | "refund_reservation"
  | "send_guest_message"
  | "move_reservation"
  | "adjust_rate"
  // Analysis actions (read-only insights)
  | "get_yield_metrics"
  | "get_occupancy_forecast"
  | "get_pricing_recommendations"
  | "get_revenue_insights"
  | "get_dashboard_summary"
  | "none";

export type ImpactArea = "availability" | "pricing" | "policy" | "revenue" | "operations" | "none";

type EvidenceLink = { label: string; url: string };

type ImpactSummary = {
  level: "low" | "medium" | "high";
  summary: string;
  warnings?: string[];
  saferAlternative?: string;
};

type ActionDraft = {
  id: string;
  actionType: ActionType;
  resource: string;
  action: "read" | "write";
  parameters: Record<string, unknown>;
  status: "draft" | "executed" | "denied";
  requiresConfirmation?: boolean;
  sensitivity?: "low" | "medium" | "high";
  impactArea?: ImpactArea;
  impact?: ImpactSummary;
  evidenceLinks?: EvidenceLink[];
  result?: Record<string, unknown>;
};

export type PartnerMembership = {
  campgroundId?: string | null;
  role?: UserRole | string;
};

export type PartnerUser = {
  id?: string | null;
  role?: UserRole | string;
  ownershipRoles?: string[];
  memberships?: PartnerMembership[];
  platformRole?: string;
};

export type SensitivityLevel = "low" | "medium" | "high";

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const isString = (value: unknown): value is string => typeof value === "string";

const toString = (value: unknown): string | undefined => (isString(value) ? value : undefined);

const toNumber = (value: unknown): number | undefined => {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return undefined;
};

const toNumberArray = (value: unknown): number[] => {
  if (!Array.isArray(value)) return [];
  const result: number[] = [];
  for (const entry of value) {
    const parsed = toNumber(entry);
    if (typeof parsed === "number") {
      result.push(parsed);
    }
  }
  return result;
};

const isUserRole = (value: unknown): value is UserRole =>
  typeof value === "string" && Object.values(UserRole).some((role) => role === value);

const isPlatformRole = (value: unknown): value is PlatformRole =>
  typeof value === "string" && Object.values(PlatformRole).some((role) => role === value);

const toAuthMemberships = (memberships: PartnerMembership[] | undefined): AuthMembership[] => {
  if (!Array.isArray(memberships)) return [];
  return memberships
    .filter(
      (membership) =>
        typeof membership.campgroundId === "string" && membership.campgroundId.length > 0,
    )
    .map((membership) => ({
      id: randomUUID(),
      campgroundId: membership.campgroundId ?? "",
      role: isUserRole(membership.role) ? membership.role : null,
      campground: undefined,
    }));
};

const toAuthUser = (user: PartnerUser | null | undefined): AuthUser | null => {
  if (!user) return null;
  const ownershipRoles = Array.isArray(user.ownershipRoles)
    ? user.ownershipRoles.filter(isString)
    : [];
  return {
    id: user.id ?? "unknown",
    email: "",
    firstName: "",
    lastName: "",
    region: null,
    platformRole: isPlatformRole(user.platformRole) ? user.platformRole : null,
    platformRegion: null,
    platformActive: true,
    ownershipRoles,
    role: isUserRole(user.role) ? user.role : null,
    memberships: toAuthMemberships(user.memberships),
  };
};

const toAnonymizationLevel = (
  value: string | null | undefined,
): "strict" | "moderate" | "minimal" => {
  switch (value) {
    case "strict":
    case "moderate":
    case "minimal":
      return value;
    default:
      return "moderate";
  }
};

const ACTION_TYPE_VALUES: ActionType[] = [
  "lookup_availability",
  "create_hold",
  "block_site",
  "create_maintenance_ticket",
  "create_operational_task",
  "update_housekeeping_status",
  "generate_billing_schedule",
  "refund_reservation",
  "send_guest_message",
  "move_reservation",
  "adjust_rate",
  "get_yield_metrics",
  "get_occupancy_forecast",
  "get_pricing_recommendations",
  "get_revenue_insights",
  "get_dashboard_summary",
  "none",
];

const IMPACT_AREA_VALUES: ImpactArea[] = [
  "availability",
  "pricing",
  "policy",
  "revenue",
  "operations",
  "none",
];

const SENSITIVITY_VALUES: SensitivityLevel[] = ["low", "medium", "high"];

const MAINTENANCE_PRIORITY_VALUES: MaintenancePriority[] = [
  MaintenancePriority.low,
  MaintenancePriority.medium,
  MaintenancePriority.high,
  MaintenancePriority.critical,
];

const PRICING_RULE_TYPE_VALUES: PricingRuleType[] = [
  PricingRuleType.season,
  PricingRuleType.weekend,
  PricingRuleType.holiday,
  PricingRuleType.event,
  PricingRuleType.demand,
];

const PRICING_STACK_MODE_VALUES: PricingStackMode[] = [
  PricingStackMode.additive,
  PricingStackMode.max,
  PricingStackMode.override,
];

const ADJUSTMENT_TYPE_VALUES: AdjustmentType[] = [AdjustmentType.percent, AdjustmentType.flat];

const USER_ROLE_VALUES: UserRole[] = [
  UserRole.owner,
  UserRole.manager,
  UserRole.front_desk,
  UserRole.maintenance,
  UserRole.finance,
  UserRole.marketing,
  UserRole.readonly,
];

const parseActionType = (value: unknown): ActionType | undefined => {
  if (!isString(value)) return undefined;
  return ACTION_TYPE_VALUES.find((item) => item === value);
};

const parseImpactArea = (value: unknown): ImpactArea | undefined => {
  if (!isString(value)) return undefined;
  return IMPACT_AREA_VALUES.find((item) => item === value);
};

const parseSensitivity = (value: unknown): SensitivityLevel | undefined => {
  if (!isString(value)) return undefined;
  return SENSITIVITY_VALUES.find((item) => item === value);
};

const parseMaintenancePriority = (value: unknown): MaintenancePriority | undefined => {
  if (!isString(value)) return undefined;
  return MAINTENANCE_PRIORITY_VALUES.find((item) => item === value);
};

const parsePricingRuleType = (value: unknown): PricingRuleType | undefined => {
  if (!isString(value)) return undefined;
  return PRICING_RULE_TYPE_VALUES.find((item) => item === value);
};

const parsePricingStackMode = (value: unknown): PricingStackMode | undefined => {
  if (!isString(value)) return undefined;
  return PRICING_STACK_MODE_VALUES.find((item) => item === value);
};

const parseAdjustmentType = (value: unknown): AdjustmentType | undefined => {
  if (!isString(value)) return undefined;
  return ADJUSTMENT_TYPE_VALUES.find((item) => item === value);
};

const parseUserRole = (value: unknown): UserRole | undefined => {
  if (!isString(value)) return undefined;
  return USER_ROLE_VALUES.find((item) => item === value);
};

const isAdminRole = (role: UserRole): boolean =>
  role === UserRole.owner || role === UserRole.manager || role === UserRole.finance;

export type AiPartnerResponse = {
  mode: PartnerMode;
  message: string;
  actionDrafts?: ActionDraft[];
  confirmations?: { id: string; prompt: string }[];
  denials?: { reason: string; guidance?: string }[];
  questions?: string[];
  evidenceLinks?: EvidenceLink[];
};

type PartnerChatRequest = {
  campgroundId: string;
  message: string;
  history?: { role: "user" | "assistant"; content: string }[];
  sessionId?: string;
  user: PartnerUser;
};

type PartnerConfirmRequest = {
  campgroundId: string;
  action: {
    type?: ActionType;
    parameters?: Record<string, unknown>;
    sensitivity?: SensitivityLevel;
    impactArea?: ImpactArea;
  };
  user: PartnerUser;
};

const PERSONA_PROMPTS: Record<PersonaKey, string> = {
  revenue:
    "You are the Revenue strategist. Focus on occupancy, ADR, demand signals, and pricing strategy. Explain trade-offs and highlight revenue impact.",
  operations:
    "You are the Operations chief. Focus on site readiness, maintenance status, holds, and execution speed. Keep responses direct and action-oriented.",
  marketing:
    "You are the Marketing advisor. Focus on demand generation, referrals, promotions, and messaging. Recommend experiments and channels.",
  accounting:
    "You are the Accounting advisor. Focus on deposits, cash handling, refunds, reconciliation, and receipts. Be precise and risk-aware.",
  hospitality:
    "You are the Hospitality advisor. Focus on guest experience, accessibility, and clear communication. Keep tone warm and practical.",
  compliance:
    "You are the Compliance advisor. Focus on privacy, PCI, ADA, safety, and policy adherence. Be conservative and explicit about risk.",
  general: "You are a helpful campground operations partner. Provide clear, calm guidance.",
};

const ACTION_REGISTRY: Record<
  Exclude<ActionType, "none">,
  {
    resource: string;
    action: "read" | "write";
    impactArea: ImpactArea;
    sensitivity: "low" | "medium" | "high";
    confirmByDefault?: boolean;
  }
> = {
  lookup_availability: {
    resource: "reservations",
    action: "read",
    impactArea: "availability",
    sensitivity: "low",
  },
  create_hold: {
    resource: "holds",
    action: "write",
    impactArea: "availability",
    sensitivity: "medium",
  },
  block_site: {
    resource: "operations",
    action: "write",
    impactArea: "availability",
    sensitivity: "medium",
    confirmByDefault: true,
  },
  create_maintenance_ticket: {
    resource: "operations",
    action: "write",
    impactArea: "operations",
    sensitivity: "low",
  },
  create_operational_task: {
    resource: "operations",
    action: "write",
    impactArea: "operations",
    sensitivity: "low",
  },
  update_housekeeping_status: {
    resource: "operations",
    action: "write",
    impactArea: "operations",
    sensitivity: "low",
  },
  generate_billing_schedule: {
    resource: "payments",
    action: "write",
    impactArea: "revenue",
    sensitivity: "medium",
    confirmByDefault: true,
  },
  refund_reservation: {
    resource: "payments",
    action: "write",
    impactArea: "revenue",
    sensitivity: "high",
    confirmByDefault: true,
  },
  send_guest_message: {
    resource: "communications",
    action: "write",
    impactArea: "none",
    sensitivity: "low",
  },
  move_reservation: {
    resource: "reservations",
    action: "write",
    impactArea: "availability",
    sensitivity: "high",
    confirmByDefault: true,
  },
  adjust_rate: {
    resource: "pricing",
    action: "write",
    impactArea: "pricing",
    sensitivity: "high",
    confirmByDefault: true,
  },
  // Analysis actions (read-only)
  get_yield_metrics: {
    resource: "analytics",
    action: "read",
    impactArea: "revenue",
    sensitivity: "low",
  },
  get_occupancy_forecast: {
    resource: "analytics",
    action: "read",
    impactArea: "availability",
    sensitivity: "low",
  },
  get_pricing_recommendations: {
    resource: "pricing",
    action: "read",
    impactArea: "pricing",
    sensitivity: "low",
  },
  get_revenue_insights: {
    resource: "analytics",
    action: "read",
    impactArea: "revenue",
    sensitivity: "low",
  },
  get_dashboard_summary: {
    resource: "analytics",
    action: "read",
    impactArea: "none",
    sensitivity: "low",
  },
};

@Injectable()
export class AiPartnerService {
  private readonly logger = new Logger(AiPartnerService.name);

  constructor(
    private readonly provider: AiProviderService,
    private readonly privacy: AiPrivacyService,
    private readonly gate: AiFeatureGateService,
    private readonly permissions: PermissionsService,
    private readonly audit: AuditService,
    private readonly prisma: PrismaService,
    private readonly holds: HoldsService,
    private readonly publicReservations: PublicReservationsService,
    private readonly maintenance: MaintenanceService,
    private readonly operations: OperationsService,
    private readonly repeatCharges: RepeatChargesService,
    private readonly reservations: ReservationsService,
    private readonly pricingV2: PricingV2Service,
    // Analytical services
    private readonly yieldService: AiYieldService,
    private readonly pricingService: AiDynamicPricingService,
    private readonly dashboardService: AiDashboardService,
    private readonly revenueManager: AiRevenueManagerService,
  ) {}

  async chat(request: PartnerChatRequest): Promise<AiPartnerResponse> {
    const { campgroundId, message, history = [], sessionId, user } = request;

    await this.gate.assertFeatureEnabled(campgroundId, AiFeatureType.reply_assist);

    const campground = await this.prisma.campground.findUnique({
      where: { id: campgroundId },
      select: {
        id: true,
        name: true,
        slug: true,
        aiAnonymizationLevel: true,
        timezone: true,
        parkTimeZone: true,
      },
    });

    if (!campground) {
      return {
        mode: "staff",
        message: "Campground not found.",
        denials: [{ reason: "Campground not found." }],
      };
    }

    const { role, mode } = this.resolveUserRole(user, campgroundId);
    const timeZone = this.getCampgroundTimeZone(campground);
    const now = new Date();
    const today = this.formatDateInTimeZone(now, timeZone);
    const weekday = this.formatWeekdayInTimeZone(now, timeZone);
    const anonymizationLevel = toAnonymizationLevel(campground.aiAnonymizationLevel);

    // Privacy Redaction
    const { anonymizedText, tokenMap } = this.privacy.anonymize(message, anonymizationLevel);
    const { historyText, historyTokenMap } = this.buildHistory(history, anonymizationLevel);
    const mergedTokenMap = this.mergeTokenMaps(tokenMap, historyTokenMap);

    const routing = await this.routePersona({
      campgroundId,
      anonymizedText,
      historyText,
      role,
      mode,
    });

    return this.runOpenAiPartner({
      campground,
      campgroundId,
      timeZone,
      today,
      weekday,
      anonymizedText,
      historyText,
      tokenMap: mergedTokenMap,
      role,
      mode,
      user,
      sessionId,
      persona: routing.persona,
      routingReason: routing.reason,
      routingConfidence: routing.confidence,
    });
  }

  async confirmAction(request: PartnerConfirmRequest): Promise<AiPartnerResponse> {
    const { campgroundId, action, user } = request;

    const campground = await this.prisma.campground.findUnique({
      where: { id: campgroundId },
      select: { id: true, name: true, slug: true, aiAnonymizationLevel: true },
    });

    if (!campground) {
      return {
        mode: "staff",
        message: "Campground not found.",
        denials: [{ reason: "Campground not found." }],
      };
    }

    const { role, mode } = this.resolveUserRole(user, campgroundId);
    const actionType = action?.type;

    if (!actionType || actionType === "none" || !(actionType in ACTION_REGISTRY)) {
      return {
        mode,
        message: "No valid action to confirm.",
        denials: [{ reason: "No valid action to confirm." }],
      };
    }

    const registry = ACTION_REGISTRY[actionType];
    const parameters = action?.parameters ?? {};
    const sensitivity = action?.sensitivity ?? registry.sensitivity;
    const impactArea = action?.impactArea ?? registry.impactArea;

    const access = await this.permissions.checkAccess({
      user: toAuthUser(user),
      campgroundId,
      resource: registry.resource,
      action: registry.action,
    });

    const baseDraft: ActionDraft = {
      id: randomUUID(),
      actionType,
      resource: registry.resource,
      action: registry.action,
      parameters,
      status: access.allowed ? "draft" : "denied",
      sensitivity,
      impactArea,
    };

    if (!access.allowed) {
      return {
        mode,
        message: "You don't have permission to perform that action.",
        actionDrafts: [baseDraft],
        denials: [{ reason: "You don't have permission to perform that action." }],
      };
    }

    const impact = await this.evaluateImpact({
      campgroundId,
      actionType,
      impactArea,
      parameters,
    });

    const draft: ActionDraft = {
      ...baseDraft,
      requiresConfirmation: false,
      impact: impact ?? undefined,
      evidenceLinks: this.buildEvidenceLinks(actionType, parameters),
    };

    let executed: { action: ActionDraft; message: string } | null = null;
    if (actionType === "lookup_availability") {
      executed = await this.executeReadAction(campground, draft);
    } else if (this.isAnalysisAction(actionType)) {
      executed = await this.executeAnalysisAction(campground, draft);
    } else {
      executed = await this.executeWriteAction(campground, draft, user);
    }

    if (!executed) {
      return {
        mode,
        message: "This action requires manual review. Use the provided links to continue.",
        actionDrafts: [draft],
        evidenceLinks: draft.evidenceLinks,
      };
    }

    const actionWithEvidence = {
      ...executed.action,
      evidenceLinks: draft.evidenceLinks ?? executed.action.evidenceLinks,
    };

    return {
      mode,
      message: executed.message,
      actionDrafts: [actionWithEvidence],
      evidenceLinks: actionWithEvidence.evidenceLinks,
    };
  }

  private async routePersona(params: {
    campgroundId: string;
    anonymizedText: string;
    historyText: string;
    role: string;
    mode: PartnerMode;
  }): Promise<{ persona: PersonaKey; confidence?: number; reason?: string }> {
    const systemPrompt = `You are a routing agent for Keepr Host.
Select the single best persona for the request.
Return ONLY valid JSON with keys: persona, confidence, reason.

Valid personas:
- revenue
- operations
- marketing
- accounting
- hospitality
- compliance
- general`;

    const historyBlock = params.historyText ? `\nHistory:\n${params.historyText}` : "";
    const userPrompt = `User Role: ${params.role}
Mode: ${params.mode}
Request: "${params.anonymizedText}"${historyBlock}`;

    try {
      const response = await this.provider.getCompletion({
        campgroundId: params.campgroundId,
        featureType: AiFeatureType.reply_assist,
        systemPrompt,
        userPrompt,
        maxTokens: 120,
        temperature: 0,
      });

      const parsed = this.parseJsonBlock(response.content);
      if (!isRecord(parsed)) {
        return { persona: "general" };
      }

      const persona = this.normalizePersona(parsed.persona);
      const confidence = typeof parsed.confidence === "number" ? parsed.confidence : undefined;
      const reason = typeof parsed.reason === "string" ? parsed.reason.slice(0, 200) : undefined;

      return { persona, confidence, reason };
    } catch (err) {
      this.logger.warn("AI partner routing failed", err);
      return { persona: "general" };
    }
  }

  private async runOpenAiPartner(params: {
    campground: { id: string; name: string; slug: string; aiAnonymizationLevel: string | null };
    campgroundId: string;
    timeZone: string;
    today: string;
    weekday: string;
    anonymizedText: string;
    historyText: string;
    tokenMap: Map<string, string>;
    role: string;
    mode: PartnerMode;
    user: PartnerUser;
    sessionId?: string;
    persona: PersonaKey;
    routingReason?: string;
    routingConfidence?: number;
  }): Promise<AiPartnerResponse> {
    try {
      const personaPrompt = PERSONA_PROMPTS[params.persona] ?? PERSONA_PROMPTS.general;
      const systemPrompt = this.buildSystemPrompt({
        mode: params.mode,
        campgroundName: params.campground.name,
        role: params.role,
        campgroundId: params.campgroundId,
        persona: params.persona,
        personaPrompt,
        timeZone: params.timeZone,
        today: params.today,
        weekday: params.weekday,
      });

      const userPrompt = this.buildUserPrompt({
        anonymizedText: params.anonymizedText,
        historyText: params.historyText,
        campgroundName: params.campground.name,
        campgroundId: params.campgroundId,
        userId: params.user?.id ?? undefined,
        role: params.role,
        mode: params.mode,
        persona: params.persona,
        routingReason: params.routingReason,
        routingConfidence: params.routingConfidence,
      });

      const toolResponse = await this.provider.getToolCompletion({
        campgroundId: params.campgroundId,
        featureType: AiFeatureType.reply_assist,
        systemPrompt,
        userPrompt,
        userId: params.user?.id ?? undefined,
        sessionId: params.sessionId,
        tools: this.buildTools(),
        toolChoice: { type: "function", function: { name: "assistant_response" } },
        maxTokens: 700,
        temperature: 0.2,
      });

      const toolCall = this.pickToolCall(toolResponse.toolCalls);
      const toolArgs = toolCall ? this.parseToolArgs(toolCall.arguments) : null;
      const toolArgsRecord = isRecord(toolArgs) ? toolArgs : {};
      const rawMessageValue = toolArgsRecord.message;
      const rawMessage =
        isString(rawMessageValue) && rawMessageValue.trim().length
          ? rawMessageValue
          : toolResponse.content;

      const message = this.privacy.deanonymize(
        rawMessage ||
          "I can help with availability, holds, and rate guidance. What would you like to do?",
        params.tokenMap,
      );

      const questions = Array.isArray(toolArgsRecord.questions)
        ? toolArgsRecord.questions.map((question) =>
            this.privacy.deanonymize(String(question), params.tokenMap),
          )
        : undefined;

      const denial = isRecord(toolArgsRecord.denial) ? toolArgsRecord.denial : null;
      if (denial) {
        const denialReason = toString(denial.reason) ?? "Request denied.";
        const denialGuidance = toString(denial.guidance);
        return {
          mode: params.mode,
          message,
          questions,
          denials: [
            {
              reason: this.privacy.deanonymize(denialReason, params.tokenMap),
              guidance: denialGuidance
                ? this.privacy.deanonymize(denialGuidance, params.tokenMap)
                : undefined,
            },
          ],
        };
      }

      const actionInput = isRecord(toolArgsRecord.action) ? toolArgsRecord.action : null;
      const actionType = actionInput ? parseActionType(actionInput.type) : undefined;
      if (!actionType || actionType === "none" || !(actionType in ACTION_REGISTRY)) {
        return { mode: params.mode, message, questions };
      }

      const registry = ACTION_REGISTRY[actionType];
      const parametersSource =
        actionInput && isRecord(actionInput.parameters) ? actionInput.parameters : {};
      const parameters = this.resolveParameters(parametersSource, params.tokenMap);
      this.applyRelativeDateDefaults(
        actionType,
        parameters,
        params.anonymizedText,
        params.timeZone,
      );
      const sensitivity = parseSensitivity(actionInput?.sensitivity) ?? registry.sensitivity;
      const impactArea = parseImpactArea(actionInput?.impactArea) ?? registry.impactArea;

      const access = await this.permissions.checkAccess({
        user: toAuthUser(params.user),
        campgroundId: params.campgroundId,
        resource: registry.resource,
        action: registry.action,
      });

      const baseDraft: ActionDraft = {
        id: randomUUID(),
        actionType,
        resource: registry.resource,
        action: registry.action,
        parameters,
        status: access.allowed ? "draft" : "denied",
        sensitivity,
        impactArea,
      };

      if (!access.allowed) {
        return {
          mode: params.mode,
          message,
          questions,
          actionDrafts: [baseDraft],
          denials: [{ reason: "You don't have permission to perform that action." }],
        };
      }

      const impact = await this.evaluateImpact({
        campgroundId: params.campgroundId,
        actionType,
        impactArea,
        parameters,
      });

      const explicitConfirmation =
        typeof actionInput?.requiresConfirmation === "boolean"
          ? actionInput.requiresConfirmation
          : undefined;
      const confirmedDefault = registry.confirmByDefault ?? false;
      const requiresConfirmation =
        (explicitConfirmation ?? confirmedDefault) ||
        sensitivity === "high" ||
        impact?.level === "high";

      const actionDraft: ActionDraft = {
        ...baseDraft,
        requiresConfirmation,
        impact: impact ?? undefined,
        evidenceLinks: this.buildEvidenceLinks(actionType, parameters),
      };

      let finalMessage = message;
      let finalDraft = actionDraft;

      if (!requiresConfirmation) {
        if (actionType === "lookup_availability") {
          const executed = await this.executeReadAction(params.campground, actionDraft);
          if (executed) {
            finalMessage = executed.message;
            finalDraft = executed.action;
          }
        } else if (this.isAnalysisAction(actionType)) {
          // Analysis actions are always executed immediately (read-only)
          const executed = await this.executeAnalysisAction(params.campground, actionDraft);
          if (executed) {
            finalMessage = executed.message;
            finalDraft = executed.action;
          }
        } else {
          const executed = await this.executeWriteAction(
            params.campground,
            actionDraft,
            params.user,
          );
          if (executed) {
            finalMessage = executed.message;
            finalDraft = executed.action;
          }
        }
      }

      const confirmationPrompt = actionInput?.summary
        ? this.privacy.deanonymize(String(actionInput.summary), params.tokenMap)
        : `Confirm to ${actionType.replace(/_/g, " ")}?`;

      return {
        mode: params.mode,
        message: finalMessage,
        questions,
        actionDrafts: [finalDraft],
        confirmations: requiresConfirmation
          ? [{ id: finalDraft.id, prompt: confirmationPrompt }]
          : undefined,
        evidenceLinks: finalDraft.evidenceLinks,
      };
    } catch (err) {
      this.logger.error("AI Partner request failed", err);
      return {
        mode: params.mode,
        message: "The AI partner is temporarily unavailable. Please try again shortly.",
      };
    }
  }

  private buildTools() {
    return [
      {
        type: "function",
        function: {
          name: "assistant_response",
          description: "Return a structured response with an optional action draft.",
          parameters: {
            type: "object",
            properties: {
              message: { type: "string" },
              action: {
                type: "object",
                properties: {
                  type: {
                    type: "string",
                    enum: [
                      "lookup_availability",
                      "create_hold",
                      "block_site",
                      "create_maintenance_ticket",
                      "create_operational_task",
                      "update_housekeeping_status",
                      "generate_billing_schedule",
                      "refund_reservation",
                      "send_guest_message",
                      "move_reservation",
                      "adjust_rate",
                      "get_yield_metrics",
                      "get_occupancy_forecast",
                      "get_pricing_recommendations",
                      "get_revenue_insights",
                      "get_dashboard_summary",
                      "none",
                    ],
                  },
                  parameters: { type: "object" },
                  sensitivity: { type: "string", enum: ["low", "medium", "high"] },
                  impactArea: {
                    type: "string",
                    enum: ["availability", "pricing", "policy", "revenue", "operations", "none"],
                  },
                  summary: { type: "string" },
                  requiresConfirmation: { type: "boolean" },
                },
                required: ["type"],
              },
              questions: {
                type: "array",
                items: { type: "string" },
              },
              denial: {
                type: "object",
                properties: {
                  reason: { type: "string" },
                  guidance: { type: "string" },
                },
              },
            },
            required: ["message", "action"],
          },
        },
      },
    ];
  }

  private buildSystemPrompt(params: {
    mode: PartnerMode;
    campgroundName: string;
    role: string;
    campgroundId: string;
    persona: PersonaKey;
    personaPrompt: string;
    timeZone: string;
    today: string;
    weekday: string;
  }) {
    return `You are the Active Campground AI Partner for ${params.campgroundName}.
MODE: ${params.mode.toUpperCase()}
ROLE: ${params.role}
PARK_SCOPE: ${params.campgroundId}
PERSONA: ${params.persona.toUpperCase()}
PERSONA_FOCUS: ${params.personaPrompt}
TODAY: ${params.today} (${params.weekday})
TIME_ZONE: ${params.timeZone}

Execution pipeline (do not skip):
1) Use injected identity and park context.
2) Assume input is privacy-redacted; never request PII.
3) Map intent to allowed actions using the tool schema.
4) Draft actions only; execution is gated by RBAC and confirmation.
5) Evaluate impact for pricing/availability/policy/revenue and warn on risk.
6) Provide evidence links when referencing data.

Behavior:
- Staff mode: fast, direct, minimal verbosity.
- Admin mode: strategic and cautious. Require confirmation for sensitive actions.

Privacy rules:
- Never request or expose personal data. Any identifiers appear as tokens like [NAME_1], [EMAIL_1].
- Do not ask for names, emails, phone numbers, or payment details.

Date handling:
- Use TODAY and TIME_ZONE to resolve relative dates (today, tomorrow, this weekend, next weekend, this week, next week, next month).
- For "this weekend" or "next weekend" default to Friday arrival and Sunday departure unless the user specifies another range.
- For "this week" default to today through next Monday unless the user specifies another range.
- For "next week" default to Monday arrival and Monday departure (7 nights) unless the user specifies another range.
- For "next month" default to the first day of next month through the first day of the following month unless the user specifies another range.
- If a relative date is unambiguous, include explicit arrivalDate/departureDate and avoid asking for dates.

Allowed actions (choose one; use none when you can only guide):

OPERATIONS ACTIONS:
- lookup_availability (arrivalDate, departureDate, optional rigType/rigLength)
- create_hold (siteId or siteNumber, arrivalDate, departureDate, optional holdMinutes)
- block_site (siteId or siteNumber, arrivalDate, departureDate, reason)
- create_maintenance_ticket (siteId or siteNumber, issue, optional priority)
- create_operational_task (title, type, optional priority/dueDate/siteId/siteNumber/assignedTo)
- update_housekeeping_status (siteId or siteNumber, status: clean|dirty|inspecting)
- generate_billing_schedule (reservationId)
- refund_reservation (reservationId, amountCents, destination: card|wallet, reason)
- send_guest_message (guestId or reservationId, message, optional subject; logs a guest note)
- move_reservation (reservationId, newArrivalDate/newDepartureDate, newSiteId/newSiteNumber)
- adjust_rate (siteClassId or siteClassName, adjustmentType: flat|percent, adjustmentValue, optional startDate/endDate/reason)

ANALYSIS ACTIONS (use when user asks about metrics, performance, insights, trends, revenue, occupancy, pricing):
- get_yield_metrics (returns occupancy, ADR, RevPAN for current period)
- get_occupancy_forecast (days: number, returns occupancy predictions)
- get_pricing_recommendations (returns AI pricing suggestions)
- get_revenue_insights (returns revenue opportunities and analysis)
- get_dashboard_summary (returns overall AI dashboard with all key metrics)

- none (use when you can only provide guidance without data)

For pricing/availability/policy/revenue-impacting actions:
- Mark sensitivity as medium/high.
- Include a short summary of impact and set requiresConfirmation if risky.

Output contract:
- Provide action drafts, confirmations, denials, and evidence when applicable.
- Use the assistant_response tool only.

Return your output exclusively via the assistant_response tool.`;
  }

  private buildUserPrompt(params: {
    anonymizedText: string;
    historyText: string;
    campgroundName: string;
    campgroundId: string;
    userId?: string;
    role: string;
    mode: PartnerMode;
    persona: PersonaKey;
    routingReason?: string;
    routingConfidence?: number;
  }) {
    const historyBlock = params.historyText ? `\n\nRecent history:\n${params.historyText}` : "";
    const routingBits: string[] = [`persona=${params.persona}`];
    if (params.routingReason) routingBits.push(`reason=${params.routingReason}`);
    if (typeof params.routingConfidence === "number")
      routingBits.push(`confidence=${params.routingConfidence.toFixed(2)}`);
    const routingBlock = routingBits.length ? `\nRouting: ${routingBits.join(" | ")}` : "";
    return `Campground: ${params.campgroundName}
Campground ID: ${params.campgroundId}
User ID: ${params.userId ?? "unknown"}
User Role: ${params.role}
Mode: ${params.mode}
${routingBlock}

User request: "${params.anonymizedText}"${historyBlock}`;
  }

  private buildHistory(
    history: { role: "user" | "assistant"; content: string }[],
    level: "strict" | "moderate" | "minimal",
  ) {
    if (!history.length) return { historyText: "", historyTokenMap: new Map<string, string>() };
    const tokenMap = new Map<string, string>();
    const lines = history.slice(-6).map((entry) => {
      const result = this.privacy.anonymize(entry.content, level);
      result.tokenMap.forEach((value, key) => tokenMap.set(key, value));
      return `${entry.role.toUpperCase()}: ${result.anonymizedText}`;
    });
    return { historyText: lines.join("\n"), historyTokenMap: tokenMap };
  }

  private mergeTokenMaps(a: Map<string, string>, b: Map<string, string>) {
    const merged = new Map<string, string>();
    a.forEach((value, key) => merged.set(key, value));
    b.forEach((value, key) => merged.set(key, value));
    return merged;
  }

  private getCampgroundTimeZone(campground: {
    parkTimeZone?: string | null;
    timezone?: string | null;
  }) {
    const timeZone = campground.parkTimeZone || campground.timezone || "UTC";
    try {
      new Intl.DateTimeFormat("en-US", { timeZone }).format(new Date());
      return timeZone;
    } catch {
      return "UTC";
    }
  }

  private formatDateInTimeZone(date: Date, timeZone: string) {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(date);
    const year = parts.find((part) => part.type === "year")?.value ?? "0000";
    const month = parts.find((part) => part.type === "month")?.value ?? "01";
    const day = parts.find((part) => part.type === "day")?.value ?? "01";
    return `${year}-${month}-${day}`;
  }

  private formatWeekdayInTimeZone(date: Date, timeZone: string) {
    return new Intl.DateTimeFormat("en-US", { timeZone, weekday: "long" }).format(date);
  }

  private getZonedDateInfo(date: Date, timeZone: string) {
    const formatted = this.formatDateInTimeZone(date, timeZone);
    const [year, month, day] = formatted.split("-").map((value) => Number(value));
    const utcDate = new Date(Date.UTC(year, month - 1, day));
    return { utcDate, dayOfWeek: utcDate.getUTCDay(), year, month, day };
  }

  private addDaysUtc(date: Date, days: number) {
    return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
  }

  private formatDateUtc(date: Date) {
    return date.toISOString().slice(0, 10);
  }

  private inferRelativeDateRange(requestText: string, timeZone: string) {
    const normalized = requestText.toLowerCase();
    const { utcDate, dayOfWeek, year, month } = this.getZonedDateInfo(new Date(), timeZone);

    const buildRange = (arrival: Date, nights: number) => {
      const departure = this.addDaysUtc(arrival, nights);
      return {
        arrivalDate: this.formatDateUtc(arrival),
        departureDate: this.formatDateUtc(departure),
      };
    };

    if (/\bnext\s+(week-?end|wknd)\b/.test(normalized)) {
      let daysUntilFriday = (5 - dayOfWeek + 7) % 7;
      if (daysUntilFriday === 0) {
        daysUntilFriday = 7;
      }
      const arrival = this.addDaysUtc(utcDate, daysUntilFriday);
      return buildRange(arrival, 2);
    }

    if (/\bthis\s+(week-?end|wknd)\b/.test(normalized)) {
      if (dayOfWeek >= 5 || dayOfWeek === 0) {
        const daysSinceFriday = (dayOfWeek - 5 + 7) % 7;
        let arrival = this.addDaysUtc(utcDate, -daysSinceFriday);
        let departure = this.addDaysUtc(arrival, 2);
        if (arrival < utcDate) {
          arrival = utcDate;
        }
        if (departure <= arrival) {
          departure = this.addDaysUtc(arrival, 1);
        }
        return {
          arrivalDate: this.formatDateUtc(arrival),
          departureDate: this.formatDateUtc(departure),
        };
      }

      const daysUntilFriday = (5 - dayOfWeek + 7) % 7;
      const arrival = this.addDaysUtc(utcDate, daysUntilFriday);
      return buildRange(arrival, 2);
    }

    if (/\bthis\s+week\b/.test(normalized)) {
      const daysSinceMonday = (dayOfWeek - 1 + 7) % 7;
      const weekStart = this.addDaysUtc(utcDate, -daysSinceMonday);
      const weekEnd = this.addDaysUtc(weekStart, 7);
      const arrival = weekStart < utcDate ? utcDate : weekStart;
      let departure = weekEnd;
      if (departure <= arrival) {
        departure = this.addDaysUtc(arrival, 1);
      }
      return {
        arrivalDate: this.formatDateUtc(arrival),
        departureDate: this.formatDateUtc(departure),
      };
    }

    if (/\bnext\s+week\b/.test(normalized)) {
      let daysUntilNextMonday = (8 - dayOfWeek) % 7;
      if (daysUntilNextMonday === 0) {
        daysUntilNextMonday = 7;
      }
      const arrival = this.addDaysUtc(utcDate, daysUntilNextMonday);
      return buildRange(arrival, 7);
    }

    if (/\bnext\s+month\b/.test(normalized)) {
      let nextMonth = month + 1;
      let nextYear = year;
      if (nextMonth > 12) {
        nextMonth = 1;
        nextYear += 1;
      }

      let followingMonth = nextMonth + 1;
      let followingYear = nextYear;
      if (followingMonth > 12) {
        followingMonth = 1;
        followingYear += 1;
      }

      const arrival = new Date(Date.UTC(nextYear, nextMonth - 1, 1));
      const departure = new Date(Date.UTC(followingYear, followingMonth - 1, 1));
      return {
        arrivalDate: this.formatDateUtc(arrival),
        departureDate: this.formatDateUtc(departure),
      };
    }

    if (/\btomorrow\b/.test(normalized)) {
      const arrival = this.addDaysUtc(utcDate, 1);
      return buildRange(arrival, 1);
    }

    if (/\btoday\b/.test(normalized)) {
      return buildRange(utcDate, 1);
    }

    return null;
  }

  private applyRelativeDateDefaults(
    actionType: ActionType,
    parameters: Record<string, unknown>,
    requestText: string,
    timeZone: string,
  ) {
    if (!["lookup_availability", "create_hold", "block_site"].includes(actionType)) return;
    if (parameters.arrivalDate && parameters.departureDate) return;

    const inferred = this.inferRelativeDateRange(requestText, timeZone);
    if (!inferred) return;

    if (!parameters.arrivalDate) parameters.arrivalDate = inferred.arrivalDate;
    if (!parameters.departureDate) parameters.departureDate = inferred.departureDate;
  }

  private resolveUserRole(
    user: PartnerUser,
    campgroundId: string,
  ): { role: string; mode: PartnerMode } {
    const ownershipRoles = Array.isArray(user?.ownershipRoles)
      ? user.ownershipRoles.filter(isString)
      : [];
    if (ownershipRoles.includes("owner")) {
      return { role: "owner", mode: "admin" };
    }

    const directRole = parseUserRole(user?.role);
    if (directRole) {
      return { role: directRole, mode: isAdminRole(directRole) ? "admin" : "staff" };
    }

    const memberships = Array.isArray(user?.memberships) ? user.memberships : [];
    const membership = memberships.find(
      (member) => toString(member?.campgroundId) === campgroundId,
    );
    const membershipRole = parseUserRole(membership?.role);
    if (membershipRole) {
      return {
        role: membershipRole,
        mode: isAdminRole(membershipRole) ? "admin" : "staff",
      };
    }

    if (user?.platformRole === "platform_admin") {
      return { role: "platform_admin", mode: "admin" };
    }

    return { role: "staff", mode: "staff" };
  }

  private pickToolCall(toolCalls?: { name: string; arguments: string }[]) {
    if (!toolCalls?.length) return null;
    return toolCalls.find((call) => call.name === "assistant_response") ?? toolCalls[0];
  }

  private parseToolArgs(args: string): unknown {
    try {
      return JSON.parse(args);
    } catch {
      return null;
    }
  }

  private parseJsonBlock(content: string): unknown {
    if (!content) return null;
    const match = content.match(/\{[\s\S]*\}/);
    if (!match) return null;
    try {
      return JSON.parse(match[0]);
    } catch {
      return null;
    }
  }

  private normalizePersona(value: unknown): PersonaKey {
    if (!isString(value)) return "general";
    const normalized = value.trim().toLowerCase();
    if (normalized === "revenue") return "revenue";
    if (normalized === "operations" || normalized === "ops") return "operations";
    if (normalized === "marketing") return "marketing";
    if (normalized === "accounting" || normalized === "finance") return "accounting";
    if (normalized === "hospitality" || normalized === "guest") return "hospitality";
    if (normalized === "compliance") return "compliance";
    return "general";
  }

  private resolveParameters(
    parameters: Record<string, unknown>,
    tokenMap: Map<string, string>,
  ): Record<string, unknown> {
    const resolved: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(parameters)) {
      resolved[key] = this.resolveValue(value, tokenMap);
    }
    return resolved;
  }

  private resolveValue(value: unknown, tokenMap: Map<string, string>): unknown {
    if (typeof value === "string") {
      return tokenMap.get(value) ?? value;
    }
    if (Array.isArray(value)) {
      return value.map((item) => this.resolveValue(item, tokenMap));
    }
    if (isRecord(value)) {
      return this.resolveParameters(value, tokenMap);
    }
    return value;
  }

  private async resolveSiteId(
    campgroundId: string,
    params: { siteId?: string; siteNumber?: string },
  ) {
    if (params.siteId) return params.siteId;
    if (!params.siteNumber) return undefined;
    const site = await this.prisma.site.findFirst({
      where: { campgroundId, siteNumber: String(params.siteNumber) },
      select: { id: true },
    });
    return site?.id;
  }

  private async resolveSiteClass(
    campgroundId: string,
    params: { siteClassId?: string; siteClassName?: string },
  ) {
    if (params.siteClassId) {
      const siteClass = await this.prisma.siteClass.findUnique({
        where: { id: params.siteClassId },
        select: { id: true, name: true, defaultRate: true, campgroundId: true },
      });
      if (!siteClass || siteClass.campgroundId !== campgroundId) return null;
      return siteClass;
    }
    if (!params.siteClassName) return null;
    const siteClass = await this.prisma.siteClass.findFirst({
      where: {
        campgroundId,
        name: { equals: String(params.siteClassName), mode: "insensitive" },
      },
      select: { id: true, name: true, defaultRate: true },
    });
    return siteClass ?? null;
  }

  private formatFriendlyDateRange(arrivalDate: string, departureDate: string): string {
    const arrival = new Date(arrivalDate + "T12:00:00");
    const departure = new Date(departureDate + "T12:00:00");
    const months = [
      "Jan",
      "Feb",
      "Mar",
      "Apr",
      "May",
      "Jun",
      "Jul",
      "Aug",
      "Sep",
      "Oct",
      "Nov",
      "Dec",
    ];
    const arrMonth = months[arrival.getMonth()];
    const depMonth = months[departure.getMonth()];
    const arrDay = arrival.getDate();
    const depDay = departure.getDate();

    if (arrMonth === depMonth) {
      return `${arrMonth} ${arrDay}-${depDay}`;
    }
    return `${arrMonth} ${arrDay} - ${depMonth} ${depDay}`;
  }

  private async executeReadAction(
    campground: { id: string; slug: string; name: string },
    draft: ActionDraft,
  ) {
    if (draft.actionType !== "lookup_availability") return null;
    const params = draft.parameters;
    const arrivalDate = toString(params.arrivalDate);
    const departureDate = toString(params.departureDate);
    const rigType = toString(params.rigType);
    const rigLength = toNumber(params.rigLength);
    if (!arrivalDate || !departureDate) {
      return null;
    }

    try {
      const availability = await this.publicReservations.getAvailability(
        campground.slug,
        arrivalDate,
        departureDate,
        rigType,
        rigLength !== undefined ? String(rigLength) : undefined,
        false,
      );
      const totalSites = availability.length;
      const availableCount = availability.filter((site) => site.status === "available").length;
      const byClass = new Map<string, number>();
      availability.forEach((site) => {
        if (site.status !== "available" || !site.siteClass?.name) return;
        byClass.set(site.siteClass.name, (byClass.get(site.siteClass.name) || 0) + 1);
      });

      const dateRange = this.formatFriendlyDateRange(arrivalDate, departureDate);
      const occupancyPct =
        totalSites > 0 ? Math.round(((totalSites - availableCount) / totalSites) * 100) : 0;

      // Build a natural language breakdown
      const breakdown = Array.from(byClass.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 4)
        .map(([name, count]) => `${count} ${name}`)
        .join(", ");

      // Craft a helpful message
      let message: string;
      if (availableCount === 0) {
        message = `Fully booked ${dateRange}. All ${totalSites} sites are reserved.`;
      } else if (occupancyPct >= 80) {
        message = `${dateRange} is filling up - only ${availableCount} of ${totalSites} sites left (${occupancyPct}% booked). ${breakdown}.`;
      } else if (occupancyPct >= 50) {
        message = `${dateRange} has decent availability - ${availableCount} of ${totalSites} sites open. ${breakdown}.`;
      } else {
        message = `${dateRange} is wide open - ${availableCount} of ${totalSites} sites available. ${breakdown}.`;
      }

      const action: ActionDraft = {
        ...draft,
        status: "executed",
        impact: undefined, // No impact assessment needed for read-only
        result: {
          availableCount,
          totalSites,
          occupancyPct,
          byClass: Object.fromEntries(byClass),
        },
      };

      await this.audit.record({
        campgroundId: campground.id,
        actorId: null,
        action: "ai.partner.execute",
        entity: "availability",
        entityId: draft.id,
        after: action.result ?? {},
      });

      return { action, message };
    } catch (err) {
      this.logger.warn("Availability lookup failed", err instanceof Error ? err.message : `${err}`);
      return null;
    }
  }

  private async executeHold(campground: { id: string }, draft: ActionDraft, user: PartnerUser) {
    const params = draft.parameters;
    const siteId = toString(params.siteId);
    const siteNumber = toString(params.siteNumber);
    const arrivalDate = toString(params.arrivalDate);
    const departureDate = toString(params.departureDate);
    const holdMinutes = toNumber(params.holdMinutes);
    if (!arrivalDate || !departureDate) return null;

    const resolvedSiteId = await this.resolveSiteId(campground.id, { siteId, siteNumber });
    if (!resolvedSiteId) return null;

    try {
      const hold = await this.holds.create({
        campgroundId: campground.id,
        siteId: resolvedSiteId,
        arrivalDate,
        departureDate,
        holdMinutes: holdMinutes ?? 30,
      });

      const action: ActionDraft = {
        ...draft,
        status: "executed",
        result: { holdId: hold.id, expiresAt: hold.expiresAt },
      };

      await this.audit.record({
        campgroundId: campground.id,
        actorId: user?.id ?? null,
        action: "ai.partner.execute",
        entity: "siteHold",
        entityId: hold.id,
        after: { siteId: resolvedSiteId, arrivalDate, departureDate },
      });

      return {
        action,
        message: `Hold placed on site ${siteNumber ?? resolvedSiteId} from ${arrivalDate} to ${departureDate}.`,
      };
    } catch (err) {
      this.logger.warn("Hold creation failed", err instanceof Error ? err.message : `${err}`);
      return null;
    }
  }

  private async executeBlockSite(
    campground: { id: string },
    draft: ActionDraft,
    user: PartnerUser,
  ) {
    const params = draft.parameters;
    const siteId = toString(params.siteId);
    const siteNumber = toString(params.siteNumber);
    const arrivalDate = toString(params.arrivalDate);
    const departureDate = toString(params.departureDate);
    const reason = toString(params.reason);
    if (!arrivalDate || !departureDate) return null;

    const resolvedSiteId = await this.resolveSiteId(campground.id, { siteId, siteNumber });
    if (!resolvedSiteId) return null;

    try {
      const title = reason ? `Site blocked: ${reason}` : "Site blocked for maintenance";
      const ticket = await this.maintenance.create({
        campgroundId: campground.id,
        siteId: resolvedSiteId,
        title,
        description: reason,
        isBlocking: true,
        outOfOrder: true,
        outOfOrderReason: reason,
        outOfOrderUntil: departureDate,
        priority: MaintenancePriority.high,
      });

      const action: ActionDraft = {
        ...draft,
        status: "executed",
        result: { ticketId: ticket.id, outOfOrderUntil: ticket.outOfOrderUntil },
      };

      await this.audit.record({
        campgroundId: campground.id,
        actorId: user?.id ?? null,
        action: "ai.partner.execute",
        entity: "maintenanceTicket",
        entityId: ticket.id,
        after: {
          siteId: resolvedSiteId,
          arrivalDate,
          departureDate,
          outOfOrder: true,
        },
      });

      return {
        action,
        message: `Blocked site ${siteNumber ?? resolvedSiteId} from ${arrivalDate} to ${departureDate}.`,
      };
    } catch (err) {
      this.logger.warn("Block site failed", err instanceof Error ? err.message : `${err}`);
      return null;
    }
  }

  private async executeMaintenanceTicket(
    campground: { id: string },
    draft: ActionDraft,
    user: PartnerUser,
  ) {
    const params = draft.parameters;
    const siteId = toString(params.siteId);
    const siteNumber = toString(params.siteNumber);
    const issue = toString(params.issue);
    const priority = params.priority;
    if (!issue) return null;

    const resolvedSiteId = await this.resolveSiteId(campground.id, { siteId, siteNumber });
    if (siteNumber && !resolvedSiteId) return null;

    try {
      const resolvedPriority = parseMaintenancePriority(priority) ?? MaintenancePriority.medium;
      const ticket = await this.maintenance.create({
        campgroundId: campground.id,
        siteId: resolvedSiteId,
        title: issue,
        priority: resolvedPriority,
      });

      const action: ActionDraft = {
        ...draft,
        status: "executed",
        result: { ticketId: ticket.id, status: ticket.status },
      };

      await this.audit.record({
        campgroundId: campground.id,
        actorId: user?.id ?? null,
        action: "ai.partner.execute",
        entity: "maintenanceTicket",
        entityId: ticket.id,
        after: { siteId: resolvedSiteId, issue, priority: resolvedPriority },
      });

      return {
        action,
        message: `Created a maintenance ticket${resolvedSiteId ? ` for site ${siteNumber ?? resolvedSiteId}` : ""}.`,
      };
    } catch (err) {
      this.logger.warn(
        "Maintenance ticket create failed",
        err instanceof Error ? err.message : `${err}`,
      );
      return null;
    }
  }

  private async executeOperationalTask(
    campground: { id: string },
    draft: ActionDraft,
    user: PartnerUser,
  ) {
    const params = draft.parameters;
    const title = toString(params.title);
    const task = toString(params.task);
    const summary = toString(params.summary);
    const description = toString(params.description);
    const type = toString(params.type) ?? "maintenance";
    const priority = toString(params.priority) ?? "medium";
    const dueDate = toString(params.dueDate);
    const assignedTo = toString(params.assignedTo);
    const siteId = toString(params.siteId);
    const siteNumber = toString(params.siteNumber);
    const taskTitle = title ?? task ?? summary;
    if (!taskTitle) return null;

    const resolvedSiteId = await this.resolveSiteId(campground.id, { siteId, siteNumber });
    if (siteNumber && !resolvedSiteId) return null;

    try {
      const created = await this.operations.createTask(
        campground.id,
        {
          title: taskTitle,
          description,
          type,
          priority,
          assignedTo,
          dueDate: dueDate ? new Date(dueDate) : undefined,
          siteId: resolvedSiteId,
        },
        user,
      );

      const action: ActionDraft = {
        ...draft,
        status: "executed",
        result: { taskId: created.id, status: created.status },
      };

      await this.audit.record({
        campgroundId: campground.id,
        actorId: user?.id ?? null,
        action: "ai.partner.execute",
        entity: "operationalTask",
        entityId: created.id,
        after: { title: taskTitle, type: created.type, siteId: resolvedSiteId },
      });

      return {
        action,
        message: `Created a ${created.type} task: ${created.title}.`,
      };
    } catch (err) {
      this.logger.warn(
        "Operational task create failed",
        err instanceof Error ? err.message : `${err}`,
      );
      return null;
    }
  }

  private async executeUpdateHousekeeping(
    campground: { id: string },
    draft: ActionDraft,
    user: PartnerUser,
  ) {
    const params = draft.parameters;
    const siteId = toString(params.siteId);
    const siteNumber = toString(params.siteNumber);
    const nextStatus = toString(params.status) ?? toString(params.housekeepingStatus);
    if (!nextStatus) return null;

    const resolvedSiteId = await this.resolveSiteId(campground.id, { siteId, siteNumber });
    if (!resolvedSiteId) return null;

    try {
      const updated = await this.operations.updateSiteHousekeeping(
        resolvedSiteId,
        nextStatus,
        user,
      );
      const action: ActionDraft = {
        ...draft,
        status: "executed",
        result: { siteId: resolvedSiteId, housekeepingStatus: updated.housekeepingStatus },
      };

      await this.audit.record({
        campgroundId: campground.id,
        actorId: user?.id ?? null,
        action: "ai.partner.execute",
        entity: "site",
        entityId: resolvedSiteId,
        after: { housekeepingStatus: updated.housekeepingStatus },
      });

      return {
        action,
        message: `Updated housekeeping status for site ${siteNumber ?? resolvedSiteId} to ${updated.housekeepingStatus}.`,
      };
    } catch (err) {
      this.logger.warn("Housekeeping update failed", err instanceof Error ? err.message : `${err}`);
      return null;
    }
  }

  private async executeGenerateBillingSchedule(
    campground: { id: string },
    draft: ActionDraft,
    user: PartnerUser,
  ) {
    const reservationId = toString(draft.parameters.reservationId);
    if (!reservationId) return null;

    try {
      const reservation = await this.prisma.reservation.findUnique({
        where: { id: reservationId },
        select: { campgroundId: true },
      });
      if (!reservation || reservation.campgroundId !== campground.id) return null;

      const charges = await this.repeatCharges.generateCharges(campground.id, reservationId);
      const action: ActionDraft = {
        ...draft,
        status: "executed",
        result: { reservationId, chargeCount: charges.length },
      };

      await this.audit.record({
        campgroundId: campground.id,
        actorId: user?.id ?? null,
        action: "ai.partner.execute",
        entity: "reservation",
        entityId: reservationId,
        after: { repeatChargeCount: charges.length },
      });

      return {
        action,
        message: `Generated ${charges.length} billing installments for reservation ${reservationId}.`,
      };
    } catch (err) {
      this.logger.warn(
        "Billing schedule generation failed",
        err instanceof Error ? err.message : `${err}`,
      );
      return null;
    }
  }

  private async executeRefundReservation(
    campground: { id: string },
    draft: ActionDraft,
    user: PartnerUser,
  ) {
    const params = draft.parameters;
    const reservationId = toString(params.reservationId);
    const amount = toNumber(params.amountCents);
    const destination = toString(params.destination);
    const reason = toString(params.reason);
    if (!reservationId || amount === undefined || amount <= 0) return null;

    const reservation = await this.prisma.reservation.findUnique({
      where: { id: reservationId },
      select: { id: true, campgroundId: true },
    });
    if (!reservation || reservation.campgroundId !== campground.id) return null;

    try {
      const updated = await this.reservations.refundPayment(reservationId, amount, {
        destination: destination === "wallet" ? "wallet" : "card",
        reason: reason ?? undefined,
      });

      const action: ActionDraft = {
        ...draft,
        status: "executed",
        result: {
          reservationId,
          refundedCents: amount,
          paidAmount: updated.paidAmount,
          balanceAmount: updated.balanceAmount,
        },
      };

      await this.audit.record({
        campgroundId: campground.id,
        actorId: user?.id ?? null,
        action: "ai.partner.execute",
        entity: "reservation",
        entityId: reservationId,
        after: { refundedCents: amount, destination: destination ?? "card" },
      });

      return {
        action,
        message: `Recorded a ${amount} cent refund for reservation ${reservationId}. Confirm processor refund if needed.`,
      };
    } catch (err) {
      this.logger.warn("Reservation refund failed", err instanceof Error ? err.message : `${err}`);
      return null;
    }
  }

  private async executeSendGuestMessage(
    campground: { id: string },
    draft: ActionDraft,
    user: PartnerUser,
  ) {
    const params = draft.parameters;
    const guestId = toString(params.guestId);
    const reservationId = toString(params.reservationId);
    const noteBody = toString(params.message) ?? toString(params.body);
    const subject = toString(params.subject);
    if (!noteBody || (!guestId && !reservationId)) return null;

    let resolvedGuestId: string | null = guestId ?? null;
    let resolvedReservationId: string | null = reservationId ?? null;
    let organizationId: string | null = null;

    if (resolvedReservationId) {
      const reservation = await this.prisma.reservation.findUnique({
        where: { id: resolvedReservationId },
        select: {
          campgroundId: true,
          guestId: true,
          Campground: { select: { organizationId: true } },
        },
      });
      if (!reservation || reservation.campgroundId !== campground.id) return null;
      resolvedGuestId = resolvedGuestId ?? reservation.guestId;
      organizationId = reservation.Campground?.organizationId ?? null;
    } else if (resolvedGuestId) {
      const match = await this.prisma.reservation.findFirst({
        where: { guestId: resolvedGuestId, campgroundId: campground.id },
        select: { id: true, Campground: { select: { organizationId: true } } },
      });
      if (!match) return null;
      organizationId = match.Campground?.organizationId ?? null;
    }

    try {
      const communication = await this.prisma.communication.create({
        data: {
          id: randomUUID(),
          campgroundId: campground.id,
          organizationId: organizationId ?? undefined,
          guestId: resolvedGuestId ?? undefined,
          reservationId: resolvedReservationId ?? undefined,
          type: "note",
          direction: "outbound",
          subject: subject ?? undefined,
          body: noteBody,
          preview: noteBody.slice(0, 280),
          status: "sent",
          provider: "internal",
          updatedAt: new Date(),
        },
      });

      const action: ActionDraft = {
        ...draft,
        status: "executed",
        result: { communicationId: communication.id },
      };

      await this.audit.record({
        campgroundId: campground.id,
        actorId: user?.id ?? null,
        action: "ai.partner.execute",
        entity: "communication",
        entityId: communication.id,
        after: { reservationId: resolvedReservationId, guestId: resolvedGuestId },
      });

      return {
        action,
        message: "Logged an outbound guest note in the communications timeline.",
      };
    } catch (err) {
      this.logger.warn("Guest note create failed", err instanceof Error ? err.message : `${err}`);
      return null;
    }
  }

  private async executeMoveReservation(
    campground: { id: string },
    draft: ActionDraft,
    user: PartnerUser,
  ) {
    const params = draft.parameters;
    const reservationId = toString(params.reservationId);
    const newArrivalDate = toString(params.newArrivalDate);
    const newDepartureDate = toString(params.newDepartureDate);
    const arrivalDate = toString(params.arrivalDate);
    const departureDate = toString(params.departureDate);
    const newSiteId = toString(params.newSiteId);
    const newSiteNumber = toString(params.newSiteNumber);
    const siteId = toString(params.siteId);
    const siteNumber = toString(params.siteNumber);
    if (!reservationId) return null;

    const reservation = await this.prisma.reservation.findUnique({
      where: { id: reservationId },
      select: { campgroundId: true },
    });
    if (!reservation || reservation.campgroundId !== campground.id) return null;

    const targetArrival = newArrivalDate ?? arrivalDate;
    const targetDeparture = newDepartureDate ?? departureDate;
    const targetSiteId = newSiteId ?? siteId;
    const targetSiteNumber = newSiteNumber ?? siteNumber;
    const resolvedSiteId = await this.resolveSiteId(campground.id, {
      siteId: targetSiteId,
      siteNumber: targetSiteNumber,
    });
    if (targetSiteNumber && !resolvedSiteId) return null;

    const updatePayload: {
      updatedBy?: string;
      arrivalDate?: string;
      departureDate?: string;
      siteId?: string;
    } = { updatedBy: user?.id ?? undefined };
    if (targetArrival) updatePayload.arrivalDate = targetArrival;
    if (targetDeparture) updatePayload.departureDate = targetDeparture;
    if (resolvedSiteId) updatePayload.siteId = resolvedSiteId;

    if (Object.keys(updatePayload).length <= 1) return null;

    try {
      const updated = await this.reservations.update(reservationId, updatePayload);
      const action: ActionDraft = {
        ...draft,
        status: "executed",
        result: {
          reservationId,
          siteId: updated.siteId,
          arrivalDate: updated.arrivalDate,
          departureDate: updated.departureDate,
        },
      };

      await this.audit.record({
        campgroundId: campground.id,
        actorId: user?.id ?? null,
        action: "ai.partner.execute",
        entity: "reservation",
        entityId: reservationId,
        after: {
          siteId: updated.siteId,
          arrivalDate: updated.arrivalDate,
          departureDate: updated.departureDate,
        },
      });

      return {
        action,
        message: `Moved reservation ${reservationId} to site ${updated.siteId}.`,
      };
    } catch (err) {
      this.logger.warn("Move reservation failed", err instanceof Error ? err.message : `${err}`);
      return null;
    }
  }

  private async executeAdjustRate(
    campground: { id: string },
    draft: ActionDraft,
    user: PartnerUser,
  ) {
    const params = draft.parameters;
    const siteClassId = toString(params.siteClassId);
    const siteClassName = toString(params.siteClassName);
    const adjustmentType = params.adjustmentType;
    const adjustmentValueInput = toNumber(params.adjustmentValue);
    const newRateCents = toNumber(params.newRateCents);
    const stackMode = params.stackMode;
    const startDate = toString(params.startDate);
    const endDate = toString(params.endDate);
    const reason = toString(params.reason);
    const name = toString(params.name);
    const dowMask = params.dowMask;
    const priority = toNumber(params.priority);
    const type = params.type;

    const resolvedClass = await this.resolveSiteClass(campground.id, {
      siteClassId,
      siteClassName,
    });
    const desiredRate = newRateCents ?? null;
    let resolvedAdjustment = adjustmentValueInput ?? null;

    if (!Number.isFinite(resolvedAdjustment ?? NaN) && desiredRate !== null) {
      if (!resolvedClass) return null;
      resolvedAdjustment = desiredRate - Number(resolvedClass.defaultRate ?? 0);
    }

    if (!Number.isFinite(resolvedAdjustment ?? NaN)) return null;
    if (resolvedAdjustment === null) return null;
    const adjustmentValue = resolvedAdjustment;

    const ruleName = name ? name : reason ? `AI Adjustment: ${reason}` : "AI Adjustment";
    const dowMaskValues = Array.isArray(dowMask) ? toNumberArray(dowMask) : undefined;

    try {
      const created = await this.pricingV2.create(
        campground.id,
        {
          name: ruleName,
          type: parsePricingRuleType(type) ?? PricingRuleType.event,
          priority: priority ?? 10,
          stackMode:
            parsePricingStackMode(stackMode) ??
            (desiredRate !== null ? PricingStackMode.override : PricingStackMode.additive),
          adjustmentType: parseAdjustmentType(adjustmentType) ?? AdjustmentType.flat,
          adjustmentValue,
          siteClassId: resolvedClass?.id ?? null,
          startDate: startDate ?? null,
          endDate: endDate ?? null,
          dowMask: dowMaskValues && dowMaskValues.length > 0 ? dowMaskValues : undefined,
          active: true,
        },
        user?.id ?? null,
      );

      const action: ActionDraft = {
        ...draft,
        status: "executed",
        result: { ruleId: created.id, name: created.name },
      };

      await this.audit.record({
        campgroundId: campground.id,
        actorId: user?.id ?? null,
        action: "ai.partner.execute",
        entity: "pricingRuleV2",
        entityId: created.id,
        after: { adjustmentValue: resolvedAdjustment, adjustmentType: adjustmentType ?? "flat" },
      });

      return {
        action,
        message: `Created pricing rule "${created.name}".`,
      };
    } catch (err) {
      this.logger.warn("Adjust rate failed", err instanceof Error ? err.message : `${err}`);
      return null;
    }
  }

  private async executeWriteAction(
    campground: { id: string },
    draft: ActionDraft,
    user: PartnerUser,
  ) {
    if (draft.actionType === "create_hold") {
      return this.executeHold(campground, draft, user);
    }
    if (draft.actionType === "block_site") {
      return this.executeBlockSite(campground, draft, user);
    }
    if (draft.actionType === "create_maintenance_ticket") {
      return this.executeMaintenanceTicket(campground, draft, user);
    }
    if (draft.actionType === "create_operational_task") {
      return this.executeOperationalTask(campground, draft, user);
    }
    if (draft.actionType === "update_housekeeping_status") {
      return this.executeUpdateHousekeeping(campground, draft, user);
    }
    if (draft.actionType === "generate_billing_schedule") {
      return this.executeGenerateBillingSchedule(campground, draft, user);
    }
    if (draft.actionType === "refund_reservation") {
      return this.executeRefundReservation(campground, draft, user);
    }
    if (draft.actionType === "send_guest_message") {
      return this.executeSendGuestMessage(campground, draft, user);
    }
    if (draft.actionType === "move_reservation") {
      return this.executeMoveReservation(campground, draft, user);
    }
    if (draft.actionType === "adjust_rate") {
      return this.executeAdjustRate(campground, draft, user);
    }
    return null;
  }

  private async executeAnalysisAction(
    campground: { id: string; slug: string; name: string },
    draft: ActionDraft,
  ): Promise<{ action: ActionDraft; message: string } | null> {
    const campgroundId = campground.id;

    try {
      if (draft.actionType === "get_yield_metrics") {
        const metrics = await this.yieldService.getYieldMetrics(campgroundId);
        const occ = metrics.todayOccupancy ?? 0;
        const adr = metrics.todayADR ?? 0;
        const revPan = metrics.todayRevPAN ?? 0;
        const next7 = metrics.next7DaysOccupancy ?? 0;
        const metricsResult = isRecord(metrics) ? metrics : {};

        let status: string;
        if (occ >= 80) status = "You're running hot today";
        else if (occ >= 50) status = "Solid occupancy today";
        else if (occ >= 20) status = "Quiet day";
        else status = "Very light today";

        const message = `${status} - ${occ.toFixed(0)}% occupied, earning $${(adr / 100).toFixed(0)} avg/site. Next 7 days tracking at ${next7.toFixed(0)}% occupancy.`;
        return {
          action: { ...draft, status: "executed", impact: undefined, result: metricsResult },
          message,
        };
      }

      if (draft.actionType === "get_occupancy_forecast") {
        const days = toNumber(draft.parameters.days) ?? 30;
        const forecastResult = await this.yieldService.forecastOccupancy(campgroundId, days);
        const forecasts = forecastResult.forecasts || [];
        const avgOccupancy = forecastResult.avgOccupancy ?? 0;

        let peakInfo = "";
        if (forecasts.length > 0) {
          const peak = forecasts.reduce((max, d) =>
            (d.occupancyPct ?? 0) > (max.occupancyPct ?? 0) ? d : max,
          );
          if (peak.occupancyPct > avgOccupancy + 10) {
            const peakDate = new Date(peak.date + "T12:00:00");
            const months = [
              "Jan",
              "Feb",
              "Mar",
              "Apr",
              "May",
              "Jun",
              "Jul",
              "Aug",
              "Sep",
              "Oct",
              "Nov",
              "Dec",
            ];
            peakInfo = ` Busiest day looks like ${months[peakDate.getMonth()]} ${peakDate.getDate()} at ${(peak.occupancyPct ?? 0).toFixed(0)}%.`;
          }
        }

        let outlook: string;
        if (avgOccupancy >= 70) outlook = "Looking strong";
        else if (avgOccupancy >= 40) outlook = "Moderate demand";
        else outlook = "Slower period ahead";

        const message = `${outlook} - averaging ${avgOccupancy.toFixed(0)}% occupancy over the next ${days} days.${peakInfo}`;
        return {
          action: { ...draft, status: "executed", impact: undefined, result: forecastResult },
          message,
        };
      }

      if (draft.actionType === "get_pricing_recommendations") {
        const recommendations = await this.pricingService.getRecommendations(campgroundId, {
          status: "pending",
          limit: 5,
        });
        const count = recommendations.length;
        let message: string;
        if (count === 0) {
          message =
            "No pricing adjustments recommended right now. Your rates are aligned with demand.";
        } else if (count === 1) {
          const rec = recommendations[0];
          message = `1 pricing suggestion: ${rec.reasoning || "Consider adjusting rates based on current demand patterns."}`;
        } else {
          message = `${count} pricing opportunities. Top suggestion: ${recommendations[0]?.reasoning || "Adjust rates for upcoming high-demand dates."}`;
        }
        return {
          action: {
            ...draft,
            status: "executed",
            impact: undefined,
            result: { recommendations, count },
          },
          message,
        };
      }

      if (draft.actionType === "get_revenue_insights") {
        const summary = await this.revenueManager.getRevenueSummary(campgroundId);
        const insights = await this.revenueManager.getInsights(campgroundId, {
          status: "new",
          limit: 5,
        });
        const totalCents = summary.totalOpportunityCents || 0;

        let message: string;
        if (insights.length === 0) {
          message = "No new revenue opportunities flagged. Keep doing what you're doing!";
        } else if (totalCents >= 50000) {
          message = `Found $${(totalCents / 100).toFixed(0)} in potential revenue across ${insights.length} opportunities. ${insights[0]?.title || ""}`;
        } else {
          message = `${insights.length} small opportunities identified. ${insights[0]?.title || "Check the AI dashboard for details."}`;
        }
        return {
          action: {
            ...draft,
            status: "executed",
            impact: undefined,
            result: { summary, insights },
          },
          message,
        };
      }

      if (draft.actionType === "get_dashboard_summary") {
        const [quickStats, activity] = await Promise.all([
          this.dashboardService.getQuickStats(campgroundId),
          this.dashboardService.getActivityFeed(campgroundId, 5),
        ]);
        const needsAttention = quickStats.needsAttention ?? 0;
        const pendingReplies = quickStats.pendingReplies ?? 0;
        const activeAnomalies = quickStats.activeAnomalies ?? 0;
        const pendingPricing = quickStats.pendingPricing ?? 0;
        const activeMaintenanceAlerts = quickStats.activeMaintenanceAlerts ?? 0;
        const activeWeatherAlerts = quickStats.activeWeatherAlerts ?? 0;
        const todayCalls = quickStats.todayCalls ?? 0;

        let message = `AI summary: ${needsAttention} items need attention (${pendingReplies} replies, ${activeAnomalies} anomalies, ${pendingPricing} pricing, ${activeMaintenanceAlerts} maintenance).`;
        if (activeWeatherAlerts > 0) {
          message += ` ${activeWeatherAlerts} weather alert${activeWeatherAlerts > 1 ? "s" : ""} active.`;
        }
        if (todayCalls > 0) {
          message += ` ${todayCalls} call${todayCalls > 1 ? "s" : ""} logged today.`;
        }
        if (activity && activity.length > 0) {
          message += ` AI recently handled ${activity.length} actions.`;
        }
        return {
          action: {
            ...draft,
            status: "executed",
            impact: undefined,
            result: { quickStats, activity },
          },
          message,
        };
      }

      return null;
    } catch (err) {
      this.logger.error(`Analysis action ${draft.actionType} failed:`, err);
      return {
        action: { ...draft, status: "executed", result: { error: "Failed to fetch data" } },
        message:
          "I couldn't retrieve that data right now. Please try again or check the dashboard directly.",
      };
    }
  }

  private isAnalysisAction(actionType: ActionType): boolean {
    return [
      "get_yield_metrics",
      "get_occupancy_forecast",
      "get_pricing_recommendations",
      "get_revenue_insights",
      "get_dashboard_summary",
    ].includes(actionType);
  }

  private buildEvidenceLinks(
    actionType: ActionType,
    parameters: Record<string, unknown>,
  ): EvidenceLink[] {
    if (actionType === "lookup_availability") {
      const params = new URLSearchParams();
      const arrivalDate = toString(parameters.arrivalDate);
      const departureDate = toString(parameters.departureDate);
      if (arrivalDate) params.set("arrivalDate", arrivalDate);
      if (departureDate) params.set("departureDate", departureDate);
      return [{ label: "Calendar view", url: `/calendar?${params.toString()}` }];
    }
    if (actionType === "create_hold") {
      const params = new URLSearchParams();
      const arrivalDate = toString(parameters.arrivalDate);
      const departureDate = toString(parameters.departureDate);
      const siteId = toString(parameters.siteId);
      if (arrivalDate) params.set("arrivalDate", arrivalDate);
      if (departureDate) params.set("departureDate", departureDate);
      if (siteId) params.set("siteId", siteId);
      return [{ label: "Calendar hold", url: `/calendar?${params.toString()}` }];
    }
    if (actionType === "block_site") {
      const params = new URLSearchParams();
      const arrivalDate = toString(parameters.arrivalDate);
      const departureDate = toString(parameters.departureDate);
      const siteId = toString(parameters.siteId);
      if (arrivalDate) params.set("arrivalDate", arrivalDate);
      if (departureDate) params.set("departureDate", departureDate);
      if (siteId) params.set("siteId", siteId);
      return [
        { label: "Maintenance", url: "/maintenance" },
        { label: "Calendar view", url: `/calendar?${params.toString()}` },
      ];
    }
    if (actionType === "create_maintenance_ticket") {
      return [{ label: "Maintenance", url: "/maintenance" }];
    }
    if (actionType === "create_operational_task" || actionType === "update_housekeeping_status") {
      return [{ label: "Operations", url: "/operations" }];
    }
    if (actionType === "generate_billing_schedule") {
      return [{ label: "Repeat charges", url: "/billing/repeat-charges" }];
    }
    if (actionType === "refund_reservation") {
      const reservationId = toString(parameters.reservationId);
      if (reservationId) {
        return [{ label: "Reservation", url: `/reservations/${reservationId}` }];
      }
      return [{ label: "Payments", url: "/finance" }];
    }
    if (actionType === "send_guest_message") {
      const reservationId = toString(parameters.reservationId);
      if (reservationId) {
        return [{ label: "Messages", url: `/messages?reservationId=${reservationId}` }];
      }
      return [{ label: "Messages", url: "/messages" }];
    }
    if (actionType === "move_reservation") {
      const reservationId = toString(parameters.reservationId);
      if (reservationId) {
        return [{ label: "Reservation", url: `/reservations/${reservationId}` }];
      }
    }
    if (actionType === "adjust_rate") {
      return [{ label: "Pricing rules", url: "/pricing" }];
    }
    // Analysis actions - link to relevant dashboards
    if (actionType === "get_yield_metrics" || actionType === "get_occupancy_forecast") {
      return [{ label: "Yield Dashboard", url: "/ai/yield" }];
    }
    if (actionType === "get_pricing_recommendations") {
      return [
        { label: "AI Pricing", url: "/ai/yield" },
        { label: "Pricing Rules", url: "/pricing" },
      ];
    }
    if (actionType === "get_revenue_insights" || actionType === "get_dashboard_summary") {
      return [{ label: "AI Command Center", url: "/ai" }];
    }
    return [];
  }

  private async evaluateImpact(params: {
    campgroundId: string;
    actionType: ActionType;
    impactArea: ImpactArea;
    parameters: Record<string, unknown>;
  }): Promise<ImpactSummary | null> {
    if (!["availability", "pricing", "policy", "revenue"].includes(params.impactArea)) {
      return null;
    }

    const now = new Date();
    const arrivalDate = toString(params.parameters.arrivalDate);
    const departureDate = toString(params.parameters.departureDate);
    const windowStart = arrivalDate ? new Date(arrivalDate) : now;
    const windowEnd = departureDate
      ? new Date(departureDate)
      : new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);

    const [siteCount, overlappingReservations, recentBookings] = await Promise.all([
      this.prisma.site.count({ where: { campgroundId: params.campgroundId, isActive: true } }),
      this.prisma.reservation.count({
        where: {
          campgroundId: params.campgroundId,
          status: { not: "cancelled" },
          departureDate: { gt: windowStart },
          arrivalDate: { lt: windowEnd },
        },
      }),
      this.prisma.reservation.count({
        where: {
          campgroundId: params.campgroundId,
          createdAt: { gte: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000) },
        },
      }),
    ]);

    const occupancy = siteCount > 0 ? overlappingReservations / siteCount : 0;
    const warnings: string[] = [];
    let level: "low" | "medium" | "high" = "low";

    if (occupancy >= 0.9) {
      level = "high";
      warnings.push("Occupancy is above 90% in the selected window.");
    } else if (occupancy >= 0.75) {
      level = "medium";
      warnings.push("Occupancy is trending high in the selected window.");
    }

    if (recentBookings > Math.max(5, siteCount * 0.2)) {
      level = level === "high" ? level : "medium";
      warnings.push("Booking velocity is elevated this week.");
    }

    const summary = `Occupancy estimate: ${(occupancy * 100).toFixed(0)}% (${overlappingReservations}/${siteCount} sites) over the next ${Math.max(1, Math.round((windowEnd.getTime() - windowStart.getTime()) / (24 * 60 * 60 * 1000)))} days.`;
    const saferAlternative =
      params.actionType === "adjust_rate"
        ? "Consider a smaller rate test (e.g., +3%) or limit the change to weekends."
        : params.actionType === "move_reservation"
          ? "Consider a temporary hold or offer an alternate site in the same class first."
          : undefined;

    return {
      level,
      summary,
      warnings: warnings.length ? warnings : undefined,
      saferAlternative,
    };
  }
}
