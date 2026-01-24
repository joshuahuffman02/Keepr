import { Injectable, Logger, NotFoundException, BadRequestException } from "@nestjs/common";
import { Cron } from "@nestjs/schedule";
import { randomUUID } from "crypto";
import { PrismaService } from "../prisma/prisma.service";
import { AiProviderService } from "./ai-provider.service";
import { AiPrivacyService } from "./ai-privacy.service";
import { AiAutopilotConfigService } from "./ai-autopilot-config.service";
import { EmailService } from "../email/email.service";
import { ReviewDraftDto } from "./dto/autopilot.dto";
import { AiFeatureType } from "@prisma/client";
import type { AiReplyDraft, Prisma } from "@prisma/client";

interface GeneratedReply {
  content: string;
  confidence: number;
  detectedIntent: string;
  detectedTone: string;
  usedContextIds: string[];
  usedContextSummary: string;
}

type CommunicationWithRelations = Prisma.CommunicationGetPayload<{
  include: { Campground: true; Guest: true; Reservation: true };
}>;

@Injectable()
export class AiAutoReplyService {
  private readonly logger = new Logger(AiAutoReplyService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly aiProvider: AiProviderService,
    private readonly aiPrivacy: AiPrivacyService,
    private readonly configService: AiAutopilotConfigService,
    private readonly emailService: EmailService,
  ) {}

  // ==================== DRAFT CRUD ====================

  async getDrafts(campgroundId: string, status?: string) {
    const where: Prisma.AiReplyDraftWhereInput = { campgroundId };
    if (status) where.status = status;

    return this.prisma.aiReplyDraft.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 100,
    });
  }

  async getDraft(id: string) {
    const draft = await this.prisma.aiReplyDraft.findUnique({ where: { id } });
    if (!draft) throw new NotFoundException("Draft not found");
    return draft;
  }

  // ==================== CORE PROCESSING ====================

  /**
   * Process an inbound message and generate an AI reply draft
   */
  async processInboundMessage(communicationId: string): Promise<AiReplyDraft | null> {
    // Get the communication
    const communication = await this.prisma.communication.findUnique({
      where: { id: communicationId },
      include: {
        Campground: true,
        Guest: true,
        Reservation: true,
      },
    });

    if (!communication) {
      this.logger.warn(`Communication ${communicationId} not found`);
      return null;
    }

    // Get autopilot config
    const config = await this.configService.getConfig(communication.campgroundId);

    if (!config.autoReplyEnabled) {
      this.logger.debug(`Auto-reply disabled for campground ${communication.campgroundId}`);
      return null;
    }

    // Check if draft already exists for this communication
    const existingDraft = await this.prisma.aiReplyDraft.findFirst({
      where: { communicationId },
    });

    if (existingDraft) {
      this.logger.debug(`Draft already exists for communication ${communicationId}`);
      return existingDraft;
    }

    // Generate the reply
    const reply = await this.generateReply(communication);

    // Check if category is excluded
    if (config.autoReplyExcludeCategories.includes(reply.detectedIntent)) {
      this.logger.debug(`Intent ${reply.detectedIntent} is excluded, skipping auto-reply`);
      return null;
    }

    // Create the draft
    const draft = await this.prisma.aiReplyDraft.create({
      data: {
        id: randomUUID(),
        campgroundId: communication.campgroundId,
        communicationId: communication.id,
        guestId: communication.guestId,
        reservationId: communication.reservationId,
        inboundSubject: communication.subject,
        inboundPreview: communication.body?.substring(0, 500),
        draftContent: reply.content,
        confidence: reply.confidence,
        detectedIntent: reply.detectedIntent,
        detectedTone: reply.detectedTone,
        usedContextIds: reply.usedContextIds,
        usedContextSummary: reply.usedContextSummary,
        status: "pending",
        updatedAt: new Date(),
      },
    });

    // If auto mode and confidence threshold met, schedule auto-send
    if (
      config.autoReplyMode === "auto" &&
      reply.confidence >= config.autoReplyConfidenceThreshold
    ) {
      const sendAt = new Date(Date.now() + config.autoReplyDelayMinutes * 60 * 1000);
      await this.prisma.aiReplyDraft.update({
        where: { id: draft.id },
        data: { autoSendScheduledAt: sendAt },
      });

      this.logger.log(`Scheduled auto-send for draft ${draft.id} at ${sendAt.toISOString()}`);
    }

    return draft;
  }

  /**
   * Generate an AI reply for a communication
   */
  private async generateReply(communication: CommunicationWithRelations): Promise<GeneratedReply> {
    // Get campground context
    const contextItems = await this.prisma.aiCampgroundContext.findMany({
      where: {
        campgroundId: communication.campgroundId,
        isActive: true,
      },
      orderBy: { priority: "desc" },
      take: 20,
    });

    // Build context summary
    const contextSummary = await this.configService.buildContextSummary(communication.campgroundId);

    // Anonymize the message
    const { anonymizedText, tokenMap } = this.aiPrivacy.anonymize(
      communication.body || communication.subject || "",
    );

    // Build the system prompt
    const systemPrompt = `You are a helpful campground assistant responding to guest messages.
You work for ${communication.Campground?.name || "the campground"}.

Your responses should be:
- Friendly and professional
- Concise but complete
- Accurate based on the campground's policies

${contextSummary}

IMPORTANT RULES:
1. Only answer questions you have information about
2. For questions about specific dates/availability, suggest the guest check the website or call
3. For complaints or urgent issues, express empathy and suggest they contact the office directly
4. Never make up policies or information not provided in the context
5. If unsure, admit you don't know and suggest contacting the office

Respond in JSON format:
{
  "reply": "Your response text here",
  "confidence": 0.0-1.0 (how confident you are this is a good response),
  "intent": "question|complaint|change_request|cancellation|general|booking_inquiry",
  "tone": "friendly|neutral|upset",
  "usedContext": ["brief description of context items used"]
}`;

    // Build the user message
    const userMessage = `Guest message:
Subject: ${communication.subject || "(no subject)"}

${anonymizedText}

${communication.Reservation ? `This guest has a reservation arriving ${communication.Reservation.arrivalDate}` : ""}
${communication.Guest ? `Guest name: ${communication.Guest.primaryFirstName || ""} ${communication.Guest.primaryLastName || ""}` : ""}`;

    try {
      // Call AI provider
      const response = await this.aiProvider.getCompletion({
        campgroundId: communication.campgroundId,
        featureType: AiFeatureType.reply_assist,
        systemPrompt,
        userPrompt: userMessage,
        temperature: 0.7,
        maxTokens: 500,
      });

      // Parse the response
      const parsed = JSON.parse(response.content);

      // De-anonymize the reply
      const deanonymizedReply = this.aiPrivacy.deanonymize(parsed.reply || "", tokenMap);

      // Find which context IDs were actually used (simplified - just return first few)
      const usedContextIds = contextItems.slice(0, 3).map((c) => c.id);

      return {
        content: deanonymizedReply,
        confidence: Math.min(1, Math.max(0, parsed.confidence || 0.5)),
        detectedIntent: parsed.intent || "general",
        detectedTone: parsed.tone || "neutral",
        usedContextIds,
        usedContextSummary: (parsed.usedContext || []).join("; ") || "General campground knowledge",
      };
    } catch (error) {
      this.logger.error(`Failed to generate reply: ${error}`);

      // Return a low-confidence fallback
      return {
        content:
          "Thank you for your message. Our team will review and respond as soon as possible. If you need immediate assistance, please call our office.",
        confidence: 0.3,
        detectedIntent: "general",
        detectedTone: "neutral",
        usedContextIds: [],
        usedContextSummary: "Fallback response (AI generation failed)",
      };
    }
  }

  // ==================== REVIEW & SEND ====================

  /**
   * Review a draft (approve, edit, or reject)
   */
  async reviewDraft(id: string, data: ReviewDraftDto, reviewerId?: string) {
    const draft = await this.getDraft(id);

    const updates: Prisma.AiReplyDraftUpdateInput = {
      reviewedById: reviewerId,
      reviewedAt: new Date(),
      autoSendScheduledAt: null, // Cancel any scheduled auto-send
    };

    switch (data.action) {
      case "approve":
        updates.status = "approved";
        break;
      case "edit":
        updates.status = "edited";
        updates.editedContent = data.editedContent;
        break;
      case "reject":
        updates.status = "rejected";
        updates.rejectionReason = data.rejectionReason;
        break;
    }

    return this.prisma.aiReplyDraft.update({
      where: { id },
      data: updates,
    });
  }

  /**
   * Send an approved or edited draft
   */
  async sendDraft(id: string) {
    const draft = await this.getDraft(id);

    if (!["approved", "edited", "pending"].includes(draft.status)) {
      throw new BadRequestException(`Cannot send draft with status: ${draft.status}`);
    }

    // Get the original communication for reply-to address
    const communication = await this.prisma.communication.findUnique({
      where: { id: draft.communicationId },
      include: { Campground: true, Guest: true },
    });

    if (!communication) {
      throw new NotFoundException("Original communication not found");
    }

    const replyContent = draft.editedContent || draft.draftContent;
    const toAddress = communication.fromAddress || communication.Guest?.email;

    if (!toAddress) {
      throw new BadRequestException("No recipient address available");
    }

    // Send via email service
    await this.emailService.sendEmail({
      to: toAddress,
      subject: `Re: ${communication.subject || "Your inquiry"}`,
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <p style="color: #334155; line-height: 1.6; white-space: pre-wrap;">${replyContent}</p>
          <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0;" />
          <p style="color: #64748b; font-size: 13px;">
            ${communication.Campground?.name || "The campground team"}
          </p>
        </div>
      `,
      guestId: draft.guestId || undefined,
      reservationId: draft.reservationId || undefined,
      campgroundId: draft.campgroundId,
    });

    // Record the outbound communication
    await this.prisma.communication.create({
      data: {
        id: randomUUID(),
        campgroundId: draft.campgroundId,
        guestId: draft.guestId,
        reservationId: draft.reservationId,
        type: "email",
        direction: "outbound",
        subject: `Re: ${communication.subject || "Your inquiry"}`,
        body: replyContent,
        preview: replyContent.substring(0, 280),
        status: "sent",
        toAddress,
        fromAddress: communication.Campground?.email || "noreply@keeprstay.com",
        sentAt: new Date(),
        metadata: { aiGenerated: true, draftId: draft.id },
      },
    });

    // Update the draft status
    return this.prisma.aiReplyDraft.update({
      where: { id },
      data: {
        status: draft.status === "pending" ? "auto_sent" : "sent",
        sentAt: new Date(),
      },
    });
  }

  // ==================== SCHEDULED JOBS ====================

  /**
   * Process scheduled auto-sends (runs every minute)
   */
  @Cron("*/1 * * * *")
  async processScheduledAutoSends() {
    const now = new Date();

    // Find drafts scheduled for auto-send
    const drafts = await this.prisma.aiReplyDraft.findMany({
      where: {
        status: "pending",
        autoSendScheduledAt: { lte: now },
      },
      take: 10,
    });

    if (drafts.length === 0) return;

    this.logger.log(`Processing ${drafts.length} scheduled auto-sends`);

    let sent = 0;
    let skipped = 0;

    for (const draft of drafts) {
      try {
        // Check quiet hours
        const campground = await this.prisma.campground.findUnique({
          where: { id: draft.campgroundId },
          select: { quietHoursStart: true, quietHoursEnd: true, timezone: true },
        });

        if (this.isQuietHours(campground)) {
          this.logger.debug(`Skipping auto-send during quiet hours for draft ${draft.id}`);
          skipped++;
          continue;
        }

        await this.sendDraft(draft.id);
        sent++;
      } catch (error) {
        this.logger.error(`Failed to auto-send draft ${draft.id}: ${error}`);
        // Mark as failed to prevent retry loop
        await this.prisma.aiReplyDraft.update({
          where: { id: draft.id },
          data: {
            status: "rejected",
            rejectionReason: `Auto-send failed: ${error}`,
            autoSendScheduledAt: null,
          },
        });
        skipped++;
      }
    }

    if (sent > 0 || skipped > 0) {
      this.logger.log(`Auto-send complete: ${sent} sent, ${skipped} skipped`);
    }
  }

  /**
   * Check if it's currently quiet hours for a campground
   */
  private isQuietHours(
    campground: {
      quietHoursStart?: string | null;
      quietHoursEnd?: string | null;
      timezone?: string | null;
    } | null,
  ): boolean {
    if (!campground?.quietHoursStart || !campground?.quietHoursEnd) {
      return false;
    }

    const now = new Date();
    const tz = campground.timezone || "America/New_York";

    // Get current time in campground timezone
    const localTime = now.toLocaleTimeString("en-US", {
      timeZone: tz,
      hour12: false,
      hour: "2-digit",
      minute: "2-digit",
    });

    const [currentHour, currentMin] = localTime.split(":").map(Number);
    const currentMinutes = currentHour * 60 + currentMin;

    const [startHour, startMin] = campground.quietHoursStart.split(":").map(Number);
    const startMinutes = startHour * 60 + startMin;

    const [endHour, endMin] = campground.quietHoursEnd.split(":").map(Number);
    const endMinutes = endHour * 60 + endMin;

    // Handle overnight quiet hours (e.g., 22:00 - 07:00)
    if (startMinutes > endMinutes) {
      return currentMinutes >= startMinutes || currentMinutes < endMinutes;
    }

    return currentMinutes >= startMinutes && currentMinutes < endMinutes;
  }
}
