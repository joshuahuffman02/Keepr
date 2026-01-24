import { Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { AiAutopilotConfigService } from "./ai-autopilot-config.service";
import { AiAutonomousActionService } from "./ai-autonomous-action.service";
import OpenAI from "openai";
import type { AiCampgroundContext, Prisma } from "@prisma/client";
import { randomUUID } from "crypto";

/**
 * AI Phone Agent Service - The Killer Feature
 *
 * Uses OpenAI Realtime API + Twilio Voice to handle phone calls autonomously.
 *
 * Architecture:
 * 1. Twilio receives incoming call → Webhook to our backend
 * 2. Backend returns TwiML with <Stream> to connect WebSocket
 * 3. WebSocket receives audio from Twilio, pipes to OpenAI Realtime API
 * 4. OpenAI Realtime API processes speech, generates responses
 * 5. Audio streamed back to Twilio for playback to caller
 *
 * The AI can:
 * - Check availability for dates
 * - Provide pricing information
 * - Create reservations
 * - Look up existing reservations
 * - Answer FAQs from knowledge base
 * - Transfer to staff when needed
 * - Take voicemails
 */

interface PhoneAgentTool {
  type: "function";
  name: string;
  description: string;
  parameters: {
    type: "object";
    properties: Record<string, unknown>;
    required?: string[];
  };
}

interface CallSession {
  callSid: string;
  campgroundId: string;
  callerPhone: string;
  openaiSession: unknown;
  intents: string[];
  actionsPerformed: PhoneActionLog[];
  startedAt: Date;
}

type PhoneActionLog = {
  action: string;
  args: Record<string, unknown>;
  result: Record<string, unknown>;
  timestamp: Date;
};

type AvailableSiteSummary = {
  siteName: string;
  siteType?: string | null;
  defaultRate?: number | null;
};

type ReservationLookup = Prisma.ReservationGetPayload<{
  include: {
    Site: { select: { name: true } };
    Guest: { select: { primaryFirstName: true; primaryLastName: true } };
  };
}>;

const getStringValue = (value: unknown): string | undefined =>
  typeof value === "string" && value.length > 0 ? value : undefined;
const getNumberValue = (value: unknown): number | undefined =>
  typeof value === "number" && Number.isFinite(value) ? value : undefined;
const toJsonValue = (value: unknown): Prisma.InputJsonValue | undefined => {
  if (value === undefined || value === null) return undefined;
  try {
    return JSON.parse(JSON.stringify(value));
  } catch {
    return undefined;
  }
};

@Injectable()
export class AiPhoneAgentService {
  private readonly logger = new Logger(AiPhoneAgentService.name);
  private openai: OpenAI | null = null;
  private activeSessions: Map<string, CallSession> = new Map();

  // Tools available to the AI phone agent
  private readonly tools: PhoneAgentTool[] = [
    {
      type: "function",
      name: "check_availability",
      description:
        "Check if sites are available for specific dates. Use this when the caller asks about availability.",
      parameters: {
        type: "object",
        properties: {
          arrivalDate: {
            type: "string",
            description: "Arrival date in YYYY-MM-DD format",
          },
          departureDate: {
            type: "string",
            description: "Departure date in YYYY-MM-DD format",
          },
          siteType: {
            type: "string",
            description: "Type of site requested (e.g., 'RV', 'tent', 'cabin'). Optional.",
          },
          guests: {
            type: "number",
            description: "Number of guests. Optional.",
          },
        },
        required: ["arrivalDate", "departureDate"],
      },
    },
    {
      type: "function",
      name: "get_rates",
      description:
        "Get pricing information for dates and site types. Use this when caller asks about prices.",
      parameters: {
        type: "object",
        properties: {
          arrivalDate: {
            type: "string",
            description: "Arrival date in YYYY-MM-DD format",
          },
          departureDate: {
            type: "string",
            description: "Departure date in YYYY-MM-DD format",
          },
          siteType: {
            type: "string",
            description: "Type of site requested",
          },
        },
        required: ["arrivalDate", "departureDate"],
      },
    },
    {
      type: "function",
      name: "lookup_reservation",
      description: "Look up an existing reservation by confirmation number or phone number.",
      parameters: {
        type: "object",
        properties: {
          confirmationNumber: {
            type: "string",
            description: "Reservation confirmation number",
          },
          phoneNumber: {
            type: "string",
            description: "Phone number associated with the reservation (if no confirmation number)",
          },
          lastName: {
            type: "string",
            description: "Guest last name for verification",
          },
        },
        required: [],
      },
    },
    {
      type: "function",
      name: "answer_faq",
      description:
        "Answer a question using the campground's knowledge base. Use for questions about policies, amenities, directions, etc.",
      parameters: {
        type: "object",
        properties: {
          question: {
            type: "string",
            description: "The question to answer",
          },
          category: {
            type: "string",
            description:
              "Category hint: check_in, amenities, pets, cancellation, directions, general",
          },
        },
        required: ["question"],
      },
    },
    {
      type: "function",
      name: "transfer_to_staff",
      description:
        "Transfer the call to a live staff member. Use when the caller requests to speak to a person, or when the request is too complex.",
      parameters: {
        type: "object",
        properties: {
          reason: {
            type: "string",
            description: "Reason for transfer",
          },
          urgency: {
            type: "string",
            enum: ["low", "medium", "high"],
            description: "Urgency of the transfer",
          },
        },
        required: ["reason"],
      },
    },
    {
      type: "function",
      name: "take_voicemail",
      description: "Offer to take a voicemail message when staff is unavailable or after hours.",
      parameters: {
        type: "object",
        properties: {
          reason: {
            type: "string",
            description: "Why voicemail is being offered (e.g., after hours, staff busy)",
          },
        },
        required: ["reason"],
      },
    },
  ];

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: AiAutopilotConfigService,
    private readonly autonomousAction: AiAutonomousActionService,
  ) {
    // Initialize OpenAI client if API key is available
    const apiKey = process.env.OPENAI_API_KEY;
    if (apiKey) {
      this.openai = new OpenAI({ apiKey });
    } else {
      this.logger.warn("OPENAI_API_KEY not set - phone agent will be disabled");
    }
  }

  // ==================== TWILIO WEBHOOKS ====================

  /**
   * Handle incoming voice call webhook from Twilio
   * Returns TwiML to connect the call to our WebSocket stream
   */
  async handleIncomingCall(callSid: string, callerPhone: string, toPhone: string): Promise<string> {
    // Find campground by phone number
    const config = await this.prisma.aiAutopilotConfig.findFirst({
      where: {
        phoneAgentNumber: toPhone,
        phoneAgentEnabled: true,
      },
      include: { Campground: true },
    });

    if (!config) {
      // Return TwiML to just ring through to default number
      this.logger.warn(`No phone agent configured for ${toPhone}`);
      return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say>We're sorry, but we cannot take your call at this time. Please try again later.</Say>
  <Hangup/>
</Response>`;
    }

    // Check if within operating hours
    if (!this.isWithinOperatingHours(config)) {
      // Take voicemail
      return this.generateVoicemailTwiML(config.Campground.name, callSid);
    }

    // Create phone session record
    await this.prisma.aiPhoneSession.create({
      data: {
        id: randomUUID(),
        campgroundId: config.campgroundId,
        twilioCallSid: callSid,
        callerPhone,
        status: "ringing",
        intents: [],
      },
    });

    // Generate TwiML to connect to our WebSocket
    const wsUrl = `wss://${process.env.API_HOST}/ai/phone/stream/${callSid}`;

    return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Connect>
    <Stream url="${wsUrl}">
      <Parameter name="campgroundId" value="${config.campgroundId}"/>
      <Parameter name="campgroundName" value="${config.Campground.name}"/>
    </Stream>
  </Connect>
</Response>`;
  }

  /**
   * Handle call status callback from Twilio
   */
  async handleCallStatus(callSid: string, status: string, duration?: number) {
    const session = await this.prisma.aiPhoneSession.findUnique({
      where: { twilioCallSid: callSid },
    });

    if (!session) return;

    const updates: Prisma.AiPhoneSessionUpdateInput = {};

    switch (status) {
      case "in-progress":
        updates.status = "in_progress";
        updates.connectedAt = new Date();
        break;
      case "completed":
        updates.status = "completed";
        updates.endedAt = new Date();
        updates.durationSeconds = duration;
        break;
      case "failed":
      case "busy":
      case "no-answer":
        updates.status = "failed";
        updates.endedAt = new Date();
        break;
    }

    if (Object.keys(updates).length > 0) {
      await this.prisma.aiPhoneSession.update({
        where: { id: session.id },
        data: updates,
      });
    }

    // If completed, log autonomous action
    if (status === "completed" && session.status === "in_progress") {
      await this.autonomousAction.logAction({
        campgroundId: session.campgroundId,
        actionType: "phone_call_handled",
        entityType: "phone_session",
        entityId: session.id,
        description: `AI handled phone call from ${session.callerPhone}`,
        details: {
          duration,
          intents: session.intents,
          actionsPerformed: session.actionsPerformed,
          resolutionStatus: session.resolutionStatus,
        },
      });
    }
  }

  // ==================== WEBSOCKET STREAMING ====================

  /**
   * Handle WebSocket connection for audio streaming
   * This is called when Twilio connects the <Stream>
   */
  async handleWebSocketConnection(
    callSid: string,
    campgroundId: string,
    campgroundName: string,
  ): Promise<CallSession | null> {
    if (!this.openai) {
      this.logger.error("OpenAI client not initialized");
      return null;
    }

    // Get campground context for the AI
    const context = await this.getCampgroundContext(campgroundId);

    // Create OpenAI Realtime session
    // NOTE: OpenAI Realtime API is currently in beta
    // This is the intended implementation pattern
    const systemPrompt = this.buildSystemPrompt(campgroundName, context);

    const session: CallSession = {
      callSid,
      campgroundId,
      callerPhone: "", // Will be set from Twilio data
      openaiSession: null, // Would be OpenAI Realtime session
      intents: [],
      actionsPerformed: [],
      startedAt: new Date(),
    };

    this.activeSessions.set(callSid, session);

    // Update session status
    await this.prisma.aiPhoneSession.update({
      where: { twilioCallSid: callSid },
      data: { status: "in_progress", connectedAt: new Date() },
    });

    this.logger.log(`WebSocket connected for call ${callSid}`);

    return session;
  }

  /**
   * Process audio chunk from Twilio
   */
  async processAudioChunk(callSid: string, audioData: Buffer) {
    const session = this.activeSessions.get(callSid);
    if (!session) return;

    // In real implementation:
    // 1. Send audio to OpenAI Realtime API
    // 2. Receive transcription and AI response
    // 3. Handle any tool calls
    // 4. Return audio to stream back to caller

    // This is a placeholder - actual implementation requires
    // OpenAI Realtime API WebSocket integration
  }

  /**
   * Handle tool call from OpenAI Realtime
   */
  async handleToolCall(
    callSid: string,
    toolName: string,
    toolArgs: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    const session = this.activeSessions.get(callSid);
    if (!session) return { error: "Session not found" };

    session.intents.push(toolName);

    let result: Record<string, unknown>;

    switch (toolName) {
      case "check_availability":
        result = await this.toolCheckAvailability(session.campgroundId, toolArgs);
        break;
      case "get_rates":
        result = await this.toolGetRates(session.campgroundId, toolArgs);
        break;
      case "lookup_reservation":
        result = await this.toolLookupReservation(session.campgroundId, toolArgs);
        break;
      case "answer_faq":
        result = await this.toolAnswerFaq(session.campgroundId, toolArgs);
        break;
      case "transfer_to_staff":
        result = await this.toolTransferToStaff(session, toolArgs);
        break;
      case "take_voicemail":
        result = await this.toolTakeVoicemail(session, toolArgs);
        break;
      default:
        result = { error: `Unknown tool: ${toolName}` };
    }

    session.actionsPerformed.push({
      action: toolName,
      args: toolArgs,
      result,
      timestamp: new Date(),
    });

    return result;
  }

  /**
   * Handle WebSocket disconnection
   */
  async handleWebSocketDisconnect(callSid: string) {
    const session = this.activeSessions.get(callSid);
    if (!session) return;

    // Update session with final data
    await this.prisma.aiPhoneSession.update({
      where: { twilioCallSid: callSid },
      data: {
        intents: session.intents,
        actionsPerformed: toJsonValue(session.actionsPerformed),
      },
    });

    this.activeSessions.delete(callSid);
    this.logger.log(`WebSocket disconnected for call ${callSid}`);
  }

  // ==================== TOOL IMPLEMENTATIONS ====================

  private async toolCheckAvailability(campgroundId: string, args: Record<string, unknown>) {
    try {
      const arrivalDate = getStringValue(args.arrivalDate);
      const departureDate = getStringValue(args.departureDate);
      const siteType = getStringValue(args.siteType);
      const guests = getNumberValue(args.guests);

      if (!arrivalDate || !departureDate) {
        return { error: "Arrival and departure dates are required." };
      }

      const arrival = new Date(arrivalDate);
      const departure = new Date(departureDate);

      // Get available sites
      const sites = await this.prisma.site.findMany({
        where: {
          campgroundId,
          status: "available",
          SiteClass: siteType ? { name: { contains: siteType, mode: "insensitive" } } : undefined,
        },
        include: { SiteClass: true },
      });

      // Check for conflicting reservations
      const available: AvailableSiteSummary[] = [];

      for (const site of sites) {
        const conflict = await this.prisma.reservation.findFirst({
          where: {
            siteId: site.id,
            status: { in: ["confirmed", "pending"] },
            arrivalDate: { lt: departure },
            departureDate: { gt: arrival },
          },
        });

        if (!conflict) {
          available.push({
            siteName: site.name,
            siteType: site.SiteClass?.name,
            defaultRate: site.SiteClass?.defaultRate,
          });
        }
      }

      if (available.length === 0) {
        return {
          available: false,
          message: `No sites available for ${arrivalDate} to ${departureDate}`,
          suggestion: "I can check nearby dates or add you to our waitlist.",
        };
      }

      return {
        available: true,
        count: available.length,
        siteTypes: [...new Set(available.map((s) => s.siteType))],
        priceRange: {
          min: Math.min(...available.map((s) => s.defaultRate || 0)),
          max: Math.max(...available.map((s) => s.defaultRate || 0)),
        },
        message: `We have ${available.length} sites available for those dates.`,
        guests,
      };
    } catch (error) {
      this.logger.error(`Check availability error: ${error}`);
      return { error: "Could not check availability", details: String(error) };
    }
  }

  private async toolGetRates(campgroundId: string, args: Record<string, unknown>) {
    try {
      const arrivalDate = getStringValue(args.arrivalDate);
      const departureDate = getStringValue(args.departureDate);
      const siteType = getStringValue(args.siteType);

      if (!arrivalDate || !departureDate) {
        return { error: "Arrival and departure dates are required." };
      }

      const siteClasses = await this.prisma.siteClass.findMany({
        where: {
          campgroundId,
          name: siteType ? { contains: siteType, mode: "insensitive" } : undefined,
        },
        select: { name: true, defaultRate: true, maxOccupancy: true },
      });

      if (siteClasses.length === 0) {
        return { error: "No site types found matching your request" };
      }

      const arrival = new Date(arrivalDate);
      const departure = new Date(departureDate);
      const nights = Math.ceil((departure.getTime() - arrival.getTime()) / (1000 * 60 * 60 * 24));

      return {
        rates: siteClasses.map((sc) => ({
          siteType: sc.name,
          pricePerNight: sc.defaultRate,
          pricePerNightFormatted: `$${((sc.defaultRate || 0) / 100).toFixed(2)}`,
          totalEstimate: (sc.defaultRate || 0) * nights,
          totalFormatted: `$${(((sc.defaultRate || 0) * nights) / 100).toFixed(2)}`,
          maxOccupancy: sc.maxOccupancy,
        })),
        nights,
        note: "Prices may vary based on season and availability. Taxes and fees may apply.",
      };
    } catch (error) {
      this.logger.error(`Get rates error: ${error}`);
      return { error: "Could not get rates" };
    }
  }

  private async toolLookupReservation(campgroundId: string, args: Record<string, unknown>) {
    try {
      const confirmationNumber = getStringValue(args.confirmationNumber);
      const phoneNumber = getStringValue(args.phoneNumber);
      const lastName = getStringValue(args.lastName);

      if (!confirmationNumber && !phoneNumber) {
        return { error: "Please provide either a confirmation number or phone number" };
      }

      let reservation: ReservationLookup | null = null;

      if (confirmationNumber) {
        reservation = await this.prisma.reservation.findFirst({
          where: {
            campgroundId,
            id: confirmationNumber,
          },
          include: {
            Site: { select: { name: true } },
            Guest: { select: { primaryFirstName: true, primaryLastName: true } },
          },
        });
      } else if (phoneNumber) {
        const normalizedPhone = phoneNumber.replace(/\D/g, "");
        reservation = await this.prisma.reservation.findFirst({
          where: {
            campgroundId,
            Guest: { phoneNormalized: { contains: normalizedPhone } },
          },
          include: {
            Site: { select: { name: true } },
            Guest: { select: { primaryFirstName: true, primaryLastName: true } },
          },
          orderBy: { arrivalDate: "desc" },
        });
      }

      if (!reservation) {
        return {
          found: false,
          message: "I couldn't find a reservation with that information.",
        };
      }

      return {
        found: true,
        confirmationNumber: reservation.id,
        guestName: `${reservation.Guest?.primaryFirstName} ${reservation.Guest?.primaryLastName}`,
        siteName: reservation.Site?.name,
        arrivalDate: reservation.arrivalDate.toISOString().split("T")[0],
        departureDate: reservation.departureDate.toISOString().split("T")[0],
        status: reservation.status,
        balance: reservation.balanceAmount || 0,
        lastName,
      };
    } catch (error) {
      this.logger.error(`Lookup reservation error: ${error}`);
      return { error: "Could not look up reservation" };
    }
  }

  private async toolAnswerFaq(campgroundId: string, args: Record<string, unknown>) {
    try {
      const question = getStringValue(args.question);
      const category = getStringValue(args.category);
      if (!question) {
        return { error: "Question is required to search FAQs." };
      }

      // Search knowledge base
      const contexts = await this.prisma.aiCampgroundContext.findMany({
        where: {
          campgroundId,
          isActive: true,
          category: category || undefined,
        },
        orderBy: { priority: "desc" },
        take: 5,
      });

      if (contexts.length === 0) {
        return {
          found: false,
          message:
            "I don't have specific information about that. Would you like me to transfer you to our staff?",
        };
      }

      // Simple keyword matching for relevant answers
      const keywords = question.toLowerCase().split(/\s+/);
      const relevant = contexts.filter((c) =>
        keywords.some(
          (kw) => c.question?.toLowerCase().includes(kw) || c.answer.toLowerCase().includes(kw),
        ),
      );

      if (relevant.length > 0) {
        return {
          found: true,
          answer: relevant[0].answer,
          category: relevant[0].category,
        };
      }

      return {
        found: false,
        message:
          "I'm not sure about that specific question. Would you like me to transfer you to our staff?",
      };
    } catch (error) {
      this.logger.error(`Answer FAQ error: ${error}`);
      return { error: "Could not search knowledge base" };
    }
  }

  private async toolTransferToStaff(session: CallSession, args: Record<string, unknown>) {
    const reason = getStringValue(args.reason) || "Caller requested transfer";
    const urgency = getStringValue(args.urgency);
    const config = await this.prisma.aiAutopilotConfig.findUnique({
      where: { campgroundId: session.campgroundId },
    });

    if (!config?.phoneAgentTransferNumber) {
      return {
        success: false,
        message:
          "I apologize, but I'm unable to transfer you right now. Would you like to leave a voicemail?",
      };
    }

    // Update session
    await this.prisma.aiPhoneSession.update({
      where: { twilioCallSid: session.callSid },
      data: {
        status: "transferred",
        transferredAt: new Date(),
        transferReason: reason,
        transferredTo: config.phoneAgentTransferNumber,
      },
    });

    return {
      success: true,
      action: "transfer",
      transferTo: config.phoneAgentTransferNumber,
      message: "I'll transfer you to our staff now. Please hold.",
      urgency,
    };
  }

  private async toolTakeVoicemail(session: CallSession, args: Record<string, unknown>) {
    const reason = getStringValue(args.reason) || "Please leave a message";
    await this.prisma.aiPhoneSession.update({
      where: { twilioCallSid: session.callSid },
      data: {
        status: "voicemail",
        resolutionStatus: "voicemail",
      },
    });

    return {
      action: "voicemail",
      message: `${reason}. Please leave your message after the tone, and we'll get back to you as soon as possible.`,
    };
  }

  // ==================== HELPER METHODS ====================

  private buildSystemPrompt(
    campgroundName: string,
    context: { faqs: AiCampgroundContext[]; policies: AiCampgroundContext[] },
  ): string {
    const faqText = context.faqs.map((f) => `Q: ${f.question}\nA: ${f.answer}`).join("\n\n");

    const policyText = context.policies.map((p) => p.answer).join("\n");

    return `You are a friendly and helpful phone assistant for ${campgroundName}.

Your job is to:
1. Greet callers warmly
2. Help with reservations (check availability, pricing, lookups)
3. Answer questions about the campground
4. Transfer to staff when needed
5. Take voicemails when appropriate

Important guidelines:
- Be conversational and natural
- Keep responses concise (this is a phone call)
- Always verify information before making changes
- Never make up information - use the tools available
- If unsure, offer to transfer to staff

CAMPGROUND KNOWLEDGE:

FAQs:
${faqText || "No FAQs available"}

Policies:
${policyText || "Standard campground policies apply"}

Start by greeting the caller and asking how you can help today.`;
  }

  private async getCampgroundContext(campgroundId: string) {
    const contexts = await this.prisma.aiCampgroundContext.findMany({
      where: { campgroundId, isActive: true },
      orderBy: { priority: "desc" },
      take: 20,
    });

    return {
      faqs: contexts.filter((c) => c.type === "faq"),
      policies: contexts.filter((c) => c.type === "policy"),
    };
  }

  private isWithinOperatingHours(config: {
    phoneAgentHoursStart?: string | null;
    phoneAgentHoursEnd?: string | null;
    Campground?: { timezone?: string | null } | null;
  }): boolean {
    if (!config.phoneAgentHoursStart || !config.phoneAgentHoursEnd) {
      return true; // 24/7 if no hours set
    }

    const now = new Date();
    const tz = config.Campground?.timezone || "America/New_York";

    const localTime = now.toLocaleTimeString("en-US", {
      timeZone: tz,
      hour12: false,
      hour: "2-digit",
      minute: "2-digit",
    });

    const [currentHour, currentMin] = localTime.split(":").map(Number);
    const currentMinutes = currentHour * 60 + currentMin;

    const [startHour, startMin] = config.phoneAgentHoursStart.split(":").map(Number);
    const startMinutes = startHour * 60 + startMin;

    const [endHour, endMin] = config.phoneAgentHoursEnd.split(":").map(Number);
    const endMinutes = endHour * 60 + endMin;

    return currentMinutes >= startMinutes && currentMinutes <= endMinutes;
  }

  private generateVoicemailTwiML(campgroundName: string, callSid: string): string {
    return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Joanna">
    Thank you for calling ${campgroundName}.
    We're currently closed, but your call is important to us.
    Please leave a message after the tone, including your name, phone number, and the reason for your call.
    We'll get back to you as soon as possible.
  </Say>
  <Record
    maxLength="120"
    action="/ai/phone/webhook/voicemail?callSid=${callSid}"
    transcribe="true"
    transcribeCallback="/ai/phone/webhook/transcription?callSid=${callSid}"
  />
  <Say voice="Polly.Joanna">
    We didn't receive your message. Please call back during our business hours. Goodbye.
  </Say>
  <Hangup/>
</Response>`;
  }

  // ==================== SESSION MANAGEMENT ====================

  /**
   * Get phone sessions for a campground
   */
  async getSessions(
    campgroundId: string,
    options: {
      status?: string;
      startDate?: Date;
      endDate?: Date;
      limit?: number;
    } = {},
  ) {
    const { status, startDate, endDate, limit = 50 } = options;

    const where: Prisma.AiPhoneSessionWhereInput = { campgroundId };
    if (status) where.status = status;
    if (startDate || endDate) {
      where.startedAt = {};
      if (startDate) where.startedAt.gte = startDate;
      if (endDate) where.startedAt.lte = endDate;
    }

    return this.prisma.aiPhoneSession.findMany({
      where,
      orderBy: { startedAt: "desc" },
      take: limit,
    });
  }

  /**
   * Get session by ID
   */
  async getSession(id: string) {
    return this.prisma.aiPhoneSession.findUnique({
      where: { id },
    });
  }

  /**
   * Get phone agent summary for dashboard
   */
  async getPhoneSummary(campgroundId: string, periodDays: number = 30) {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - periodDays);

    const sessions = await this.prisma.aiPhoneSession.findMany({
      where: {
        campgroundId,
        startedAt: { gte: startDate },
      },
      select: {
        status: true,
        resolutionStatus: true,
        durationSeconds: true,
        tokensUsed: true,
        costCents: true,
      },
    });

    const total = sessions.length;
    const handled = sessions.filter((s) => s.status === "completed").length;
    const transferred = sessions.filter((s) => s.status === "transferred").length;
    const voicemails = sessions.filter((s) => s.status === "voicemail").length;

    const durations = sessions.filter((s) => s.durationSeconds).map((s) => s.durationSeconds!);

    const avgDuration =
      durations.length > 0
        ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length)
        : 0;

    const totalCost = sessions.reduce((sum, s) => sum + (s.costCents || 0), 0);

    return {
      totalCalls: total,
      callsHandled: handled,
      callsTransferred: transferred,
      voicemails,
      avgDurationSeconds: avgDuration,
      totalCostCents: totalCost,
      resolutionRate: total > 0 ? Math.round((handled / total) * 100) : 0,
    };
  }
}
