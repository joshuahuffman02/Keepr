import { Injectable, Logger } from "@nestjs/common";
import { randomUUID } from "crypto";
import { AiProviderService } from "./ai-provider.service";
import { AiPrivacyService } from "./ai-privacy.service";
import { AiFeatureGateService } from "./ai-feature-gate.service";
import { AiFeatureType, UserRole } from "@prisma/client";
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
type PartnerMode = "staff" | "admin";
type PersonaKey = "revenue" | "operations" | "marketing" | "accounting" | "hospitality" | "compliance" | "general";

type ActionType =
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
  | "none";

type ImpactArea = "availability" | "pricing" | "policy" | "revenue" | "operations" | "none";

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
  parameters: Record<string, any>;
  status: "draft" | "executed" | "denied";
  requiresConfirmation?: boolean;
  sensitivity?: "low" | "medium" | "high";
  impactArea?: ImpactArea;
  impact?: ImpactSummary;
  evidenceLinks?: EvidenceLink[];
  result?: Record<string, any>;
};

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
  user: any;
};

type PartnerConfirmRequest = {
  campgroundId: string;
  action: { type: ActionType; parameters?: Record<string, any>; sensitivity?: "low" | "medium" | "high"; impactArea?: ImpactArea };
  user: any;
};

const PERSONA_PROMPTS: Record<PersonaKey, string> = {
  revenue: "You are the Revenue strategist. Focus on occupancy, ADR, demand signals, and pricing strategy. Explain trade-offs and highlight revenue impact.",
  operations: "You are the Operations chief. Focus on site readiness, maintenance status, holds, and execution speed. Keep responses direct and action-oriented.",
  marketing: "You are the Marketing advisor. Focus on demand generation, referrals, promotions, and messaging. Recommend experiments and channels.",
  accounting: "You are the Accounting advisor. Focus on deposits, cash handling, refunds, reconciliation, and receipts. Be precise and risk-aware.",
  hospitality: "You are the Hospitality advisor. Focus on guest experience, accessibility, and clear communication. Keep tone warm and practical.",
  compliance: "You are the Compliance advisor. Focus on privacy, PCI, ADA, safety, and policy adherence. Be conservative and explicit about risk.",
  general: "You are a helpful campground operations partner. Provide clear, calm guidance."
};

const ACTION_REGISTRY: Record<
  Exclude<ActionType, "none">,
  { resource: string; action: "read" | "write"; impactArea: ImpactArea; sensitivity: "low" | "medium" | "high"; confirmByDefault?: boolean }
> = {
  lookup_availability: {
    resource: "reservations",
    action: "read",
    impactArea: "availability",
    sensitivity: "low"
  },
  create_hold: {
    resource: "holds",
    action: "write",
    impactArea: "availability",
    sensitivity: "medium"
  },
  block_site: {
    resource: "operations",
    action: "write",
    impactArea: "availability",
    sensitivity: "medium",
    confirmByDefault: true
  },
  create_maintenance_ticket: {
    resource: "operations",
    action: "write",
    impactArea: "operations",
    sensitivity: "low"
  },
  create_operational_task: {
    resource: "operations",
    action: "write",
    impactArea: "operations",
    sensitivity: "low"
  },
  update_housekeeping_status: {
    resource: "operations",
    action: "write",
    impactArea: "operations",
    sensitivity: "low"
  },
  generate_billing_schedule: {
    resource: "payments",
    action: "write",
    impactArea: "revenue",
    sensitivity: "medium",
    confirmByDefault: true
  },
  refund_reservation: {
    resource: "payments",
    action: "write",
    impactArea: "revenue",
    sensitivity: "high",
    confirmByDefault: true
  },
  send_guest_message: {
    resource: "communications",
    action: "write",
    impactArea: "none",
    sensitivity: "low"
  },
  move_reservation: {
    resource: "reservations",
    action: "write",
    impactArea: "availability",
    sensitivity: "high",
    confirmByDefault: true
  },
  adjust_rate: {
    resource: "pricing",
    action: "write",
    impactArea: "pricing",
    sensitivity: "high",
    confirmByDefault: true
  }
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
    private readonly pricingV2: PricingV2Service
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
        parkTimeZone: true
      }
    });

    if (!campground) {
      return {
        mode: "staff",
        message: "Campground not found.",
        denials: [{ reason: "Campground not found." }]
      };
    }

    const { role, mode } = this.resolveUserRole(user, campgroundId);
    const timeZone = this.getCampgroundTimeZone(campground);
    const now = new Date();
    const today = this.formatDateInTimeZone(now, timeZone);
    const weekday = this.formatWeekdayInTimeZone(now, timeZone);

    // Privacy Redaction
    const { anonymizedText, tokenMap } = this.privacy.anonymize(message, campground.aiAnonymizationLevel ?? "moderate");
    const { historyText, historyTokenMap } = this.buildHistory(history, campground.aiAnonymizationLevel ?? "moderate");
    const mergedTokenMap = this.mergeTokenMaps(tokenMap, historyTokenMap);

    const routing = await this.routePersona({
      campgroundId,
      anonymizedText,
      historyText,
      role,
      mode
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
      routingConfidence: routing.confidence
    });
  }

  async confirmAction(request: PartnerConfirmRequest): Promise<AiPartnerResponse> {
    const { campgroundId, action, user } = request;

    const campground = await this.prisma.campground.findUnique({
      where: { id: campgroundId },
      select: { id: true, name: true, slug: true, aiAnonymizationLevel: true }
    });

    if (!campground) {
      return {
        mode: "staff",
        message: "Campground not found.",
        denials: [{ reason: "Campground not found." }]
      };
    }

    const { role, mode } = this.resolveUserRole(user, campgroundId);
    const actionType = action?.type as ActionType | undefined;

    if (!actionType || actionType === "none" || !(actionType in ACTION_REGISTRY)) {
      return {
        mode,
        message: "No valid action to confirm.",
        denials: [{ reason: "No valid action to confirm." }]
      };
    }

    const registry = ACTION_REGISTRY[actionType as Exclude<ActionType, "none">];
    const parameters = action?.parameters ?? {};
    const sensitivity = action?.sensitivity ?? registry.sensitivity;
    const impactArea = action?.impactArea ?? registry.impactArea;

    const access = await this.permissions.checkAccess({
      user,
      campgroundId,
      resource: registry.resource,
      action: registry.action
    });

    const baseDraft: ActionDraft = {
      id: randomUUID(),
      actionType,
      resource: registry.resource,
      action: registry.action,
      parameters,
      status: access.allowed ? "draft" : "denied",
      sensitivity,
      impactArea
    };

    if (!access.allowed) {
      return {
        mode,
        message: "You don't have permission to perform that action.",
        actionDrafts: [baseDraft],
        denials: [{ reason: "You don't have permission to perform that action." }]
      };
    }

    const impact = await this.evaluateImpact({
      campgroundId,
      actionType,
      impactArea,
      parameters
    });

    const draft: ActionDraft = {
      ...baseDraft,
      requiresConfirmation: false,
      impact,
      evidenceLinks: this.buildEvidenceLinks(actionType, parameters)
    };

    let executed: { action: ActionDraft; message: string } | null = null;
    if (actionType === "lookup_availability") {
      executed = await this.executeReadAction(campground, draft);
    } else {
      executed = await this.executeWriteAction(campground, draft, user);
    }

    if (!executed) {
      return {
        mode,
        message: "This action requires manual review. Use the provided links to continue.",
        actionDrafts: [draft],
        evidenceLinks: draft.evidenceLinks
      };
    }

    const actionWithEvidence = {
      ...executed.action,
      evidenceLinks: draft.evidenceLinks ?? executed.action.evidenceLinks
    };

    return {
      mode,
      message: executed.message,
      actionDrafts: [actionWithEvidence],
      evidenceLinks: actionWithEvidence.evidenceLinks
    };
  }

  private async routePersona(params: {
    campgroundId: string;
    anonymizedText: string;
    historyText: string;
    role: string;
    mode: PartnerMode;
  }): Promise<{ persona: PersonaKey; confidence?: number; reason?: string }> {
    const systemPrompt = `You are a routing agent for Camp Everyday Host.
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
        temperature: 0
      });

      const parsed = this.parseJsonBlock(response.content);
      if (!parsed || typeof parsed !== "object") {
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
    user: any;
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
        weekday: params.weekday
      });

      const userPrompt = this.buildUserPrompt({
        anonymizedText: params.anonymizedText,
        historyText: params.historyText,
        campgroundName: params.campground.name,
        campgroundId: params.campgroundId,
        userId: params.user?.id,
        role: params.role,
        mode: params.mode,
        persona: params.persona,
        routingReason: params.routingReason,
        routingConfidence: params.routingConfidence
      });

      const toolResponse = await this.provider.getToolCompletion({
        campgroundId: params.campgroundId,
        featureType: AiFeatureType.reply_assist,
        systemPrompt,
        userPrompt,
        userId: params.user?.id,
        sessionId: params.sessionId,
        tools: this.buildTools(),
        toolChoice: { type: "function", function: { name: "assistant_response" } },
        maxTokens: 700,
        temperature: 0.2
      });

      const toolCall = this.pickToolCall(toolResponse.toolCalls);
      const toolArgs = toolCall ? this.parseToolArgs(toolCall.arguments) : null;
      const rawMessage = typeof toolArgs?.message === "string" && toolArgs.message.trim().length
        ? toolArgs.message
        : toolResponse.content;

      const message = this.privacy.deanonymize(
        rawMessage || "I can help with availability, holds, and rate guidance. What would you like to do?",
        params.tokenMap
      );

      const questions = Array.isArray(toolArgs?.questions)
        ? toolArgs.questions.map((q: string) => this.privacy.deanonymize(String(q), params.tokenMap))
        : undefined;

      if (toolArgs?.denial) {
        return {
          mode: params.mode,
          message,
          questions,
          denials: [{
            reason: this.privacy.deanonymize(String(toolArgs.denial.reason || "Request denied."), params.tokenMap),
            guidance: toolArgs.denial.guidance
              ? this.privacy.deanonymize(String(toolArgs.denial.guidance), params.tokenMap)
              : undefined
          }]
        };
      }

      const actionInput = toolArgs?.action;
      const actionType = actionInput?.type as ActionType | undefined;
      if (!actionType || actionType === "none" || !(actionType in ACTION_REGISTRY)) {
        return { mode: params.mode, message, questions };
      }

      const registry = ACTION_REGISTRY[actionType as Exclude<ActionType, "none">];
      const parameters = this.resolveParameters(actionInput?.parameters ?? {}, params.tokenMap);
      this.applyRelativeDateDefaults(actionType, parameters, params.anonymizedText, params.timeZone);
      const sensitivity = (actionInput?.sensitivity as "low" | "medium" | "high" | undefined) ?? registry.sensitivity;
      const impactArea = (actionInput?.impactArea as ImpactArea | undefined) ?? registry.impactArea;

      const access = await this.permissions.checkAccess({
        user: params.user,
        campgroundId: params.campgroundId,
        resource: registry.resource,
        action: registry.action
      });

      const baseDraft: ActionDraft = {
        id: randomUUID(),
        actionType,
        resource: registry.resource,
        action: registry.action,
        parameters,
        status: access.allowed ? "draft" : "denied",
        sensitivity,
        impactArea
      };

      if (!access.allowed) {
        return {
          mode: params.mode,
          message,
          questions,
          actionDrafts: [baseDraft],
          denials: [{ reason: "You don't have permission to perform that action." }]
        };
      }

      const impact = await this.evaluateImpact({
        campgroundId: params.campgroundId,
        actionType,
        impactArea,
        parameters
      });

      const explicitConfirmation = actionInput?.requiresConfirmation ?? registry.confirmByDefault ?? false;
      const requiresConfirmation = explicitConfirmation || sensitivity === "high" || impact?.level === "high";

      const actionDraft: ActionDraft = {
        ...baseDraft,
        requiresConfirmation,
        impact,
        evidenceLinks: this.buildEvidenceLinks(actionType, parameters)
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
        } else {
          const executed = await this.executeWriteAction(params.campground, actionDraft, params.user);
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
        confirmations: requiresConfirmation ? [{ id: finalDraft.id, prompt: confirmationPrompt }] : undefined,
        evidenceLinks: finalDraft.evidenceLinks
      };
    } catch (err) {
      this.logger.error("AI Partner request failed", err);
      return {
        mode: params.mode,
        message: "The AI partner is temporarily unavailable. Please try again shortly."
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
                      "none"
                    ]
                  },
                  parameters: { type: "object" },
                  sensitivity: { type: "string", enum: ["low", "medium", "high"] },
                  impactArea: { type: "string", enum: ["availability", "pricing", "policy", "revenue", "operations", "none"] },
                  summary: { type: "string" },
                  requiresConfirmation: { type: "boolean" }
                },
                required: ["type"]
              },
              questions: {
                type: "array",
                items: { type: "string" }
              },
              denial: {
                type: "object",
                properties: {
                  reason: { type: "string" },
                  guidance: { type: "string" }
                }
              }
            },
            required: ["message", "action"]
          }
        }
      }
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
- Use TODAY and TIME_ZONE to resolve relative dates (today, tomorrow, this weekend, next weekend, next week).
- For "this weekend" or "next weekend" default to Friday arrival and Sunday departure unless the user specifies another range.
- For "next week" default to Monday arrival and Monday departure (7 nights) unless the user specifies another range.
- If a relative date is unambiguous, include explicit arrivalDate/departureDate and avoid asking for dates.

Allowed actions (choose one; use none when you can only guide):
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
- none

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
    if (typeof params.routingConfidence === "number") routingBits.push(`confidence=${params.routingConfidence.toFixed(2)}`);
    const routingBlock = routingBits.length ? `\nRouting: ${routingBits.join(" | ")}` : "";
    return `Campground: ${params.campgroundName}
Campground ID: ${params.campgroundId}
User ID: ${params.userId ?? "unknown"}
User Role: ${params.role}
Mode: ${params.mode}
${routingBlock}

User request: "${params.anonymizedText}"${historyBlock}`;
  }

  private buildHistory(history: { role: "user" | "assistant"; content: string }[], level: "strict" | "moderate" | "minimal") {
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

  private getCampgroundTimeZone(campground: { parkTimeZone?: string | null; timezone?: string | null }) {
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
      day: "2-digit"
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
    return { utcDate, dayOfWeek: utcDate.getUTCDay() };
  }

  private addDaysUtc(date: Date, days: number) {
    return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
  }

  private formatDateUtc(date: Date) {
    return date.toISOString().slice(0, 10);
  }

  private inferRelativeDateRange(requestText: string, timeZone: string) {
    const normalized = requestText.toLowerCase();
    const { utcDate, dayOfWeek } = this.getZonedDateInfo(new Date(), timeZone);

    const buildRange = (arrival: Date, nights: number) => {
      const departure = this.addDaysUtc(arrival, nights);
      return {
        arrivalDate: this.formatDateUtc(arrival),
        departureDate: this.formatDateUtc(departure)
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
          departureDate: this.formatDateUtc(departure)
        };
      }

      const daysUntilFriday = (5 - dayOfWeek + 7) % 7;
      const arrival = this.addDaysUtc(utcDate, daysUntilFriday);
      return buildRange(arrival, 2);
    }

    if (/\bnext\s+week\b/.test(normalized)) {
      let daysUntilNextMonday = (8 - dayOfWeek) % 7;
      if (daysUntilNextMonday === 0) {
        daysUntilNextMonday = 7;
      }
      const arrival = this.addDaysUtc(utcDate, daysUntilNextMonday);
      return buildRange(arrival, 7);
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
    parameters: Record<string, any>,
    requestText: string,
    timeZone: string
  ) {
    if (!["lookup_availability", "create_hold", "block_site"].includes(actionType)) return;
    if (parameters.arrivalDate && parameters.departureDate) return;

    const inferred = this.inferRelativeDateRange(requestText, timeZone);
    if (!inferred) return;

    if (!parameters.arrivalDate) parameters.arrivalDate = inferred.arrivalDate;
    if (!parameters.departureDate) parameters.departureDate = inferred.departureDate;
  }

  private resolveUserRole(user: any, campgroundId: string): { role: string; mode: PartnerMode } {
    const ownership = Array.isArray(user?.ownershipRoles) ? user.ownershipRoles : [];
    if (ownership.includes("owner")) {
      return { role: "owner", mode: "admin" };
    }

    if (user?.role) {
      const role = user.role as UserRole;
      return { role, mode: role === UserRole.owner || role === UserRole.manager || role === UserRole.finance ? "admin" : "staff" };
    }

    const membership = user?.memberships?.find((m: any) => m.campgroundId === campgroundId);
    const membershipRole = membership?.role as UserRole | undefined;
    if (membershipRole) {
      return {
        role: membershipRole,
        mode: membershipRole === UserRole.owner || membershipRole === UserRole.manager || membershipRole === UserRole.finance ? "admin" : "staff"
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

  private parseToolArgs(args: string) {
    try {
      return JSON.parse(args);
    } catch {
      return null;
    }
  }

  private parseJsonBlock(content: string) {
    if (!content) return null;
    const match = content.match(/\{[\s\S]*\}/);
    if (!match) return null;
    try {
      return JSON.parse(match[0]);
    } catch {
      return null;
    }
  }

  private normalizePersona(value: any): PersonaKey {
    if (typeof value !== "string") return "general";
    const normalized = value.trim().toLowerCase();
    if (normalized === "revenue") return "revenue";
    if (normalized === "operations" || normalized === "ops") return "operations";
    if (normalized === "marketing") return "marketing";
    if (normalized === "accounting" || normalized === "finance") return "accounting";
    if (normalized === "hospitality" || normalized === "guest") return "hospitality";
    if (normalized === "compliance") return "compliance";
    return "general";
  }

  private resolveParameters(parameters: Record<string, any>, tokenMap: Map<string, string>): Record<string, any> {
    const resolved: Record<string, any> = Array.isArray(parameters) ? [] : {};
    for (const [key, value] of Object.entries(parameters || {})) {
      resolved[key] = this.resolveValue(value, tokenMap);
    }
    return resolved;
  }

  private resolveValue(value: any, tokenMap: Map<string, string>): any {
    if (typeof value === "string") {
      return tokenMap.get(value) ?? value;
    }
    if (Array.isArray(value)) {
      return value.map((item) => this.resolveValue(item, tokenMap));
    }
    if (value && typeof value === "object") {
      return this.resolveParameters(value as Record<string, any>, tokenMap);
    }
    return value;
  }

  private async resolveSiteId(campgroundId: string, params: { siteId?: string; siteNumber?: string }) {
    if (params.siteId) return params.siteId;
    if (!params.siteNumber) return undefined;
    const site = await this.prisma.site.findFirst({
      where: { campgroundId, siteNumber: String(params.siteNumber) },
      select: { id: true }
    });
    return site?.id;
  }

  private async resolveSiteClass(campgroundId: string, params: { siteClassId?: string; siteClassName?: string }) {
    if (params.siteClassId) {
      const siteClass = await this.prisma.siteClass.findUnique({
        where: { id: params.siteClassId },
        select: { id: true, name: true, defaultRate: true, campgroundId: true }
      });
      if (!siteClass || siteClass.campgroundId !== campgroundId) return null;
      return siteClass;
    }
    if (!params.siteClassName) return null;
    const siteClass = await this.prisma.siteClass.findFirst({
      where: {
        campgroundId,
        name: { equals: String(params.siteClassName), mode: "insensitive" }
      },
      select: { id: true, name: true, defaultRate: true }
    });
    return siteClass ?? null;
  }

  private async executeReadAction(campground: { id: string; slug: string; name: string }, draft: ActionDraft) {
    if (draft.actionType !== "lookup_availability") return null;
    const { arrivalDate, departureDate, rigType, rigLength } = draft.parameters;
    if (!arrivalDate || !departureDate) {
      return null;
    }

    try {
      const availability = await this.publicReservations.getAvailability(
        campground.slug,
        arrivalDate,
        departureDate,
        rigType,
        rigLength ? String(rigLength) : undefined,
        false
      );
      const availableCount = availability.filter((site: any) => site.status === "available").length;
      const byClass = new Map<string, number>();
      availability.forEach((site: any) => {
        if (site.status !== "available" || !site.siteClass?.name) return;
        byClass.set(site.siteClass.name, (byClass.get(site.siteClass.name) || 0) + 1);
      });

      const summary = byClass.size
        ? Array.from(byClass.entries())
          .map(([name, count]) => `${name}: ${count}`)
          .join(", ")
        : "No available sites";

      const action: ActionDraft = {
        ...draft,
        status: "executed",
        result: {
          availableCount,
          classSummary: summary
        }
      };

      await this.audit.record({
        campgroundId: campground.id,
        actorId: null,
        action: "ai.partner.execute",
        entity: "availability",
        entityId: draft.id,
        after: action.result ?? {}
      });

      return {
        action,
        message: `Availability from ${arrivalDate} to ${departureDate}: ${availableCount} sites open. ${summary}.`
      };
    } catch (err) {
      this.logger.warn("Availability lookup failed", err instanceof Error ? err.message : `${err}`);
      return null;
    }
  }

  private async executeHold(campground: { id: string }, draft: ActionDraft, user: any) {
    const { siteId, siteNumber, arrivalDate, departureDate, holdMinutes } = draft.parameters;
    if (!arrivalDate || !departureDate) return null;

    const resolvedSiteId = await this.resolveSiteId(campground.id, { siteId, siteNumber });
    if (!resolvedSiteId) return null;

    try {
      const hold = await this.holds.create({
        campgroundId: campground.id,
        siteId: resolvedSiteId,
        arrivalDate,
        departureDate,
        holdMinutes: holdMinutes ?? 30
      });

      const action: ActionDraft = {
        ...draft,
        status: "executed",
        result: { holdId: hold.id, expiresAt: hold.expiresAt }
      };

      await this.audit.record({
        campgroundId: campground.id,
        actorId: user?.id ?? null,
        action: "ai.partner.execute",
        entity: "siteHold",
        entityId: hold.id,
        after: { siteId: resolvedSiteId, arrivalDate, departureDate }
      });

      return {
        action,
        message: `Hold placed on site ${siteNumber ?? resolvedSiteId} from ${arrivalDate} to ${departureDate}.`
      };
    } catch (err) {
      this.logger.warn("Hold creation failed", err instanceof Error ? err.message : `${err}`);
      return null;
    }
  }

  private async executeBlockSite(campground: { id: string }, draft: ActionDraft, user: any) {
    const { siteId, siteNumber, arrivalDate, departureDate, reason } = draft.parameters;
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
        priority: "high" as any,
      });

      const action: ActionDraft = {
        ...draft,
        status: "executed",
        result: { ticketId: ticket.id, outOfOrderUntil: ticket.outOfOrderUntil }
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
          outOfOrder: true
        }
      });

      return {
        action,
        message: `Blocked site ${siteNumber ?? resolvedSiteId} from ${arrivalDate} to ${departureDate}.`
      };
    } catch (err) {
      this.logger.warn("Block site failed", err instanceof Error ? err.message : `${err}`);
      return null;
    }
  }

  private async executeMaintenanceTicket(campground: { id: string }, draft: ActionDraft, user: any) {
    const { siteId, siteNumber, issue, priority } = draft.parameters;
    if (!issue) return null;

    const resolvedSiteId = await this.resolveSiteId(campground.id, { siteId, siteNumber });
    if (siteNumber && !resolvedSiteId) return null;

    try {
      const ticket = await this.maintenance.create({
        campgroundId: campground.id,
        siteId: resolvedSiteId,
        title: issue,
        priority: (priority as any) ?? "medium"
      });

      const action: ActionDraft = {
        ...draft,
        status: "executed",
        result: { ticketId: ticket.id, status: ticket.status }
      };

      await this.audit.record({
        campgroundId: campground.id,
        actorId: user?.id ?? null,
        action: "ai.partner.execute",
        entity: "maintenanceTicket",
        entityId: ticket.id,
        after: { siteId: resolvedSiteId, issue, priority: priority ?? "medium" }
      });

      return {
        action,
        message: `Created a maintenance ticket${resolvedSiteId ? ` for site ${siteNumber ?? resolvedSiteId}` : ""}.`
      };
    } catch (err) {
      this.logger.warn("Maintenance ticket create failed", err instanceof Error ? err.message : `${err}`);
      return null;
    }
  }

  private async executeOperationalTask(campground: { id: string }, draft: ActionDraft, user: any) {
    const { title, task, summary, description, type, priority, dueDate, assignedTo, siteId, siteNumber } = draft.parameters;
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
          type: type ?? "maintenance",
          priority: priority ?? "medium",
          assignedTo,
          dueDate: dueDate ? new Date(dueDate) : undefined,
          siteId: resolvedSiteId
        },
        user
      );

      const action: ActionDraft = {
        ...draft,
        status: "executed",
        result: { taskId: created.id, status: created.status }
      };

      await this.audit.record({
        campgroundId: campground.id,
        actorId: user?.id ?? null,
        action: "ai.partner.execute",
        entity: "operationalTask",
        entityId: created.id,
        after: { title: taskTitle, type: created.type, siteId: resolvedSiteId }
      });

      return {
        action,
        message: `Created a ${created.type} task: ${created.title}.`
      };
    } catch (err) {
      this.logger.warn("Operational task create failed", err instanceof Error ? err.message : `${err}`);
      return null;
    }
  }

  private async executeUpdateHousekeeping(campground: { id: string }, draft: ActionDraft, user: any) {
    const { siteId, siteNumber, status, housekeepingStatus } = draft.parameters;
    const nextStatus = status ?? housekeepingStatus;
    if (!nextStatus) return null;

    const resolvedSiteId = await this.resolveSiteId(campground.id, { siteId, siteNumber });
    if (!resolvedSiteId) return null;

    try {
      const updated = await this.operations.updateSiteHousekeeping(resolvedSiteId, String(nextStatus), user);
      const action: ActionDraft = {
        ...draft,
        status: "executed",
        result: { siteId: resolvedSiteId, housekeepingStatus: updated.housekeepingStatus }
      };

      await this.audit.record({
        campgroundId: campground.id,
        actorId: user?.id ?? null,
        action: "ai.partner.execute",
        entity: "site",
        entityId: resolvedSiteId,
        after: { housekeepingStatus: updated.housekeepingStatus }
      });

      return {
        action,
        message: `Updated housekeeping status for site ${siteNumber ?? resolvedSiteId} to ${updated.housekeepingStatus}.`
      };
    } catch (err) {
      this.logger.warn("Housekeeping update failed", err instanceof Error ? err.message : `${err}`);
      return null;
    }
  }

  private async executeGenerateBillingSchedule(campground: { id: string }, draft: ActionDraft, user: any) {
    const { reservationId } = draft.parameters;
    if (!reservationId) return null;

    try {
      const reservation = await this.prisma.reservation.findUnique({
        where: { id: String(reservationId) },
        select: { campgroundId: true }
      });
      if (!reservation || reservation.campgroundId !== campground.id) return null;

      const charges = await this.repeatCharges.generateCharges(String(reservationId));
      const action: ActionDraft = {
        ...draft,
        status: "executed",
        result: { reservationId, chargeCount: charges.length }
      };

      await this.audit.record({
        campgroundId: campground.id,
        actorId: user?.id ?? null,
        action: "ai.partner.execute",
        entity: "reservation",
        entityId: String(reservationId),
        after: { repeatChargeCount: charges.length }
      });

      return {
        action,
        message: `Generated ${charges.length} billing installments for reservation ${reservationId}.`
      };
    } catch (err) {
      this.logger.warn("Billing schedule generation failed", err instanceof Error ? err.message : `${err}`);
      return null;
    }
  }

  private async executeRefundReservation(campground: { id: string }, draft: ActionDraft, user: any) {
    const { reservationId, amountCents, destination, reason } = draft.parameters;
    const amount = Number(amountCents);
    if (!reservationId || !Number.isFinite(amount) || amount <= 0) return null;

    const reservation = await this.prisma.reservation.findUnique({
      where: { id: String(reservationId) },
      select: { id: true, campgroundId: true }
    });
    if (!reservation || reservation.campgroundId !== campground.id) return null;

    try {
      const updated = await this.reservations.refundPayment(
        String(reservationId),
        amount,
        {
          destination: destination === "wallet" ? "wallet" : "card",
          reason: reason ? String(reason) : undefined
        }
      );

      const action: ActionDraft = {
        ...draft,
        status: "executed",
        result: {
          reservationId: String(reservationId),
          refundedCents: amount,
          paidAmount: updated.paidAmount,
          balanceAmount: updated.balanceAmount
        }
      };

      await this.audit.record({
        campgroundId: campground.id,
        actorId: user?.id ?? null,
        action: "ai.partner.execute",
        entity: "reservation",
        entityId: String(reservationId),
        after: { refundedCents: amount, destination: destination ?? "card" }
      });

      return {
        action,
        message: `Recorded a ${amount} cent refund for reservation ${reservationId}. Confirm processor refund if needed.`
      };
    } catch (err) {
      this.logger.warn("Reservation refund failed", err instanceof Error ? err.message : `${err}`);
      return null;
    }
  }

  private async executeSendGuestMessage(campground: { id: string }, draft: ActionDraft, user: any) {
    const { guestId, reservationId, message, body, subject } = draft.parameters;
    const noteBody = message ?? body;
    if (!noteBody || (!guestId && !reservationId)) return null;

    let resolvedGuestId: string | null = guestId ? String(guestId) : null;
    let resolvedReservationId: string | null = reservationId ? String(reservationId) : null;
    let organizationId: string | null = null;

    if (resolvedReservationId) {
      const reservation = await this.prisma.reservation.findUnique({
        where: { id: resolvedReservationId },
        select: { campgroundId: true, guestId: true, campground: { select: { organizationId: true } } }
      });
      if (!reservation || reservation.campgroundId !== campground.id) return null;
      resolvedGuestId = resolvedGuestId ?? reservation.guestId;
      organizationId = reservation.campground?.organizationId ?? null;
    } else if (resolvedGuestId) {
      const match = await this.prisma.reservation.findFirst({
        where: { guestId: resolvedGuestId, campgroundId: campground.id },
        select: { id: true, campground: { select: { organizationId: true } } }
      });
      if (!match) return null;
      organizationId = match.campground?.organizationId ?? null;
    }

    try {
      const communication = await (this.prisma as any).communication.create({
        data: {
          campgroundId: campground.id,
          organizationId,
          guestId: resolvedGuestId ?? null,
          reservationId: resolvedReservationId ?? null,
          type: "note",
          direction: "outbound",
          subject: subject ? String(subject) : null,
          body: String(noteBody),
          preview: String(noteBody).slice(0, 280),
          status: "sent",
          provider: "internal"
        }
      });

      const action: ActionDraft = {
        ...draft,
        status: "executed",
        result: { communicationId: communication.id }
      };

      await this.audit.record({
        campgroundId: campground.id,
        actorId: user?.id ?? null,
        action: "ai.partner.execute",
        entity: "communication",
        entityId: communication.id,
        after: { reservationId: resolvedReservationId, guestId: resolvedGuestId }
      });

      return {
        action,
        message: "Logged an outbound guest note in the communications timeline."
      };
    } catch (err) {
      this.logger.warn("Guest note create failed", err instanceof Error ? err.message : `${err}`);
      return null;
    }
  }

  private async executeMoveReservation(campground: { id: string }, draft: ActionDraft, user: any) {
    const {
      reservationId,
      newArrivalDate,
      newDepartureDate,
      arrivalDate,
      departureDate,
      newSiteId,
      newSiteNumber,
      siteId,
      siteNumber
    } = draft.parameters;
    if (!reservationId) return null;

    const reservation = await this.prisma.reservation.findUnique({
      where: { id: String(reservationId) },
      select: { campgroundId: true }
    });
    if (!reservation || reservation.campgroundId !== campground.id) return null;

    const targetArrival = newArrivalDate ?? arrivalDate;
    const targetDeparture = newDepartureDate ?? departureDate;
    const targetSiteId = newSiteId ?? siteId;
    const targetSiteNumber = newSiteNumber ?? siteNumber;
    const resolvedSiteId = await this.resolveSiteId(campground.id, {
      siteId: targetSiteId,
      siteNumber: targetSiteNumber
    });
    if (targetSiteNumber && !resolvedSiteId) return null;

    const updatePayload: Record<string, any> = { updatedBy: user?.id ?? null };
    if (targetArrival) updatePayload.arrivalDate = String(targetArrival);
    if (targetDeparture) updatePayload.departureDate = String(targetDeparture);
    if (resolvedSiteId) updatePayload.siteId = resolvedSiteId;

    if (Object.keys(updatePayload).length <= 1) return null;

    try {
      const updated = await this.reservations.update(String(reservationId), updatePayload as any);
      const action: ActionDraft = {
        ...draft,
        status: "executed",
        result: {
          reservationId: String(reservationId),
          siteId: updated.siteId,
          arrivalDate: updated.arrivalDate,
          departureDate: updated.departureDate
        }
      };

      await this.audit.record({
        campgroundId: campground.id,
        actorId: user?.id ?? null,
        action: "ai.partner.execute",
        entity: "reservation",
        entityId: String(reservationId),
        after: { siteId: updated.siteId, arrivalDate: updated.arrivalDate, departureDate: updated.departureDate }
      });

      return {
        action,
        message: `Moved reservation ${reservationId} to site ${updated.siteId}.`
      };
    } catch (err) {
      this.logger.warn("Move reservation failed", err instanceof Error ? err.message : `${err}`);
      return null;
    }
  }

  private async executeAdjustRate(campground: { id: string }, draft: ActionDraft, user: any) {
    const {
      siteClassId,
      siteClassName,
      adjustmentType,
      adjustmentValue,
      newRateCents,
      stackMode,
      startDate,
      endDate,
      reason,
      name,
      dowMask,
      priority,
      type
    } = draft.parameters;

    const resolvedClass = await this.resolveSiteClass(campground.id, { siteClassId, siteClassName });
    const desiredRate = newRateCents !== undefined ? Number(newRateCents) : null;
    let resolvedAdjustment = adjustmentValue !== undefined ? Number(adjustmentValue) : null;

    if (!Number.isFinite(resolvedAdjustment ?? NaN) && desiredRate !== null) {
      if (!resolvedClass) return null;
      resolvedAdjustment = desiredRate - Number(resolvedClass.defaultRate ?? 0);
    }

    if (!Number.isFinite(resolvedAdjustment ?? NaN)) return null;

    const ruleName = name
      ? String(name)
      : reason
        ? `AI Adjustment: ${reason}`
        : "AI Adjustment";

    try {
      const created = await this.pricingV2.create(
        campground.id,
        {
          name: ruleName,
          type: (type ?? "event") as any,
          priority: Number.isFinite(Number(priority)) ? Number(priority) : 10,
          stackMode: (stackMode ?? (desiredRate !== null ? "override" : "additive")) as any,
          adjustmentType: (adjustmentType ?? "flat") as any,
          adjustmentValue: resolvedAdjustment,
          siteClassId: resolvedClass?.id ?? null,
          startDate: startDate ? String(startDate) : null,
          endDate: endDate ? String(endDate) : null,
          dowMask: Array.isArray(dowMask) ? dowMask.map((v: any) => Number(v)).filter((v: number) => Number.isFinite(v)) : undefined,
          active: true
        },
        user?.id ?? null
      );

      const action: ActionDraft = {
        ...draft,
        status: "executed",
        result: { ruleId: created.id, name: created.name }
      };

      await this.audit.record({
        campgroundId: campground.id,
        actorId: user?.id ?? null,
        action: "ai.partner.execute",
        entity: "pricingRuleV2",
        entityId: created.id,
        after: { adjustmentValue: resolvedAdjustment, adjustmentType: adjustmentType ?? "flat" }
      });

      return {
        action,
        message: `Created pricing rule "${created.name}".`
      };
    } catch (err) {
      this.logger.warn("Adjust rate failed", err instanceof Error ? err.message : `${err}`);
      return null;
    }
  }

  private async executeWriteAction(campground: { id: string }, draft: ActionDraft, user: any) {
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

  private buildEvidenceLinks(actionType: ActionType, parameters: Record<string, any>): EvidenceLink[] {
    if (actionType === "lookup_availability") {
      const params = new URLSearchParams();
      if (parameters.arrivalDate) params.set("arrivalDate", parameters.arrivalDate);
      if (parameters.departureDate) params.set("departureDate", parameters.departureDate);
      return [{ label: "Calendar view", url: `/calendar?${params.toString()}` }];
    }
    if (actionType === "create_hold") {
      const params = new URLSearchParams();
      if (parameters.arrivalDate) params.set("arrivalDate", parameters.arrivalDate);
      if (parameters.departureDate) params.set("departureDate", parameters.departureDate);
      if (parameters.siteId) params.set("siteId", parameters.siteId);
      return [{ label: "Calendar hold", url: `/calendar?${params.toString()}` }];
    }
    if (actionType === "block_site") {
      const params = new URLSearchParams();
      if (parameters.arrivalDate) params.set("arrivalDate", parameters.arrivalDate);
      if (parameters.departureDate) params.set("departureDate", parameters.departureDate);
      if (parameters.siteId) params.set("siteId", parameters.siteId);
      return [
        { label: "Maintenance", url: "/maintenance" },
        { label: "Calendar view", url: `/calendar?${params.toString()}` }
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
      if (parameters.reservationId) {
        return [{ label: "Reservation", url: `/reservations/${parameters.reservationId}` }];
      }
      return [{ label: "Payments", url: "/finance" }];
    }
    if (actionType === "send_guest_message") {
      if (parameters.reservationId) {
        return [{ label: "Messages", url: `/messages?reservationId=${parameters.reservationId}` }];
      }
      return [{ label: "Messages", url: "/messages" }];
    }
    if (actionType === "move_reservation" && parameters.reservationId) {
      return [{ label: "Reservation", url: `/reservations/${parameters.reservationId}` }];
    }
    if (actionType === "adjust_rate") {
      return [{ label: "Pricing rules", url: "/pricing" }];
    }
    return [];
  }

  private async evaluateImpact(params: {
    campgroundId: string;
    actionType: ActionType;
    impactArea: ImpactArea;
    parameters: Record<string, any>;
  }): Promise<ImpactSummary | null> {
    if (!["availability", "pricing", "policy", "revenue"].includes(params.impactArea)) {
      return null;
    }

    const now = new Date();
    const windowStart = params.parameters.arrivalDate ? new Date(params.parameters.arrivalDate) : now;
    const windowEnd = params.parameters.departureDate
      ? new Date(params.parameters.departureDate)
      : new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);

    const [siteCount, overlappingReservations, recentBookings] = await Promise.all([
      this.prisma.site.count({ where: { campgroundId: params.campgroundId, isActive: true } }),
      this.prisma.reservation.count({
        where: {
          campgroundId: params.campgroundId,
          status: { not: "cancelled" },
          departureDate: { gt: windowStart },
          arrivalDate: { lt: windowEnd }
        }
      }),
      this.prisma.reservation.count({
        where: {
          campgroundId: params.campgroundId,
          createdAt: { gte: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000) }
        }
      })
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
    const saferAlternative = params.actionType === "adjust_rate"
      ? "Consider a smaller rate test (e.g., +3%) or limit the change to weekends."
      : params.actionType === "move_reservation"
        ? "Consider a temporary hold or offer an alternate site in the same class first."
        : undefined;

    return {
      level,
      summary,
      warnings: warnings.length ? warnings : undefined,
      saferAlternative
    };
  }
}
