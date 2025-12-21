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
type PartnerMode = "staff" | "admin";
type PersonaKey = "revenue" | "operations" | "marketing" | "accounting" | "hospitality" | "compliance" | "general";

type ActionType =
  | "lookup_availability"
  | "create_hold"
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
    private readonly publicReservations: PublicReservationsService
  ) {}

  async chat(request: PartnerChatRequest): Promise<AiPartnerResponse> {
    const { campgroundId, message, history = [], sessionId, user } = request;

    await this.gate.assertFeatureEnabled(campgroundId, AiFeatureType.reply_assist);

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
    } else if (actionType === "create_hold") {
      executed = await this.executeHold(campground, draft, user);
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
        personaPrompt
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
        }
        if (actionType === "create_hold") {
          const executed = await this.executeHold(params.campground, actionDraft, params.user);
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
                    enum: ["lookup_availability", "create_hold", "move_reservation", "adjust_rate", "none"]
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
  }) {
    return `You are the Active Campground AI Partner for ${params.campgroundName}.
MODE: ${params.mode.toUpperCase()}
ROLE: ${params.role}
PARK_SCOPE: ${params.campgroundId}
PERSONA: ${params.persona.toUpperCase()}
PERSONA_FOCUS: ${params.personaPrompt}

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

Allowed actions (must map to one of these):
- lookup_availability (read-only)
- create_hold (write: place a temporary hold)
- move_reservation (write: draft only)
- adjust_rate (write: draft only)
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

    let resolvedSiteId = siteId as string | undefined;
    if (!resolvedSiteId && siteNumber) {
      const site = await this.prisma.site.findFirst({
        where: { campgroundId: campground.id, siteNumber: String(siteNumber) },
        select: { id: true }
      });
      resolvedSiteId = site?.id;
    }
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
