import { BadGatewayException, Injectable, Logger } from "@nestjs/common";
import { AiFeatureType, type Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { AiProviderService } from "./ai-provider.service";
import { AiFeatureGateService } from "./ai-feature-gate.service";

export interface SentimentAnalysis {
  sentiment: "positive" | "neutral" | "negative";
  sentimentScore: number; // -1.0 to 1.0
  urgencyLevel: "low" | "normal" | "high" | "critical";
  detectedIntent:
    | "booking"
    | "complaint"
    | "question"
    | "praise"
    | "cancellation"
    | "payment"
    | "other";
  confidence: number; // 0-1
  summary?: string;
}

interface AnalysisResult {
  sentiment: string;
  sentimentScore: number;
  urgencyLevel: string;
  detectedIntent: string;
  confidence: number;
  summary: string;
}

@Injectable()
export class AiSentimentService {
  private readonly logger = new Logger(AiSentimentService.name);
  private readonly sentimentValues: SentimentAnalysis["sentiment"][] = [
    "positive",
    "neutral",
    "negative",
  ];
  private readonly urgencyValues: SentimentAnalysis["urgencyLevel"][] = [
    "low",
    "normal",
    "high",
    "critical",
  ];
  private readonly intentValues: SentimentAnalysis["detectedIntent"][] = [
    "booking",
    "complaint",
    "question",
    "praise",
    "cancellation",
    "payment",
    "other",
  ];

  constructor(
    private readonly prisma: PrismaService,
    private readonly aiProvider: AiProviderService,
    private readonly featureGate: AiFeatureGateService,
  ) {}

  /**
   * Analyze the sentiment of a message or communication
   */
  async analyzeMessage(
    campgroundId: string,
    content: string,
    context?: {
      subject?: string;
      guestName?: string;
      reservationStatus?: string;
      type?: "email" | "sms" | "message";
    },
  ): Promise<SentimentAnalysis> {
    // Check if AI is enabled for this campground
    const isEnabled = await this.featureGate.isFeatureEnabled(
      campgroundId,
      AiFeatureType.analytics,
    );

    if (!isEnabled.allowed) {
      this.logger.debug(`Sentiment analysis disabled for campground ${campgroundId}`);
      return this.fallbackAnalysis(content);
    }

    try {
      const result = await this.aiAnalyze(campgroundId, content, context);
      return result;
    } catch (error) {
      this.logger.error("AI sentiment analysis failed, using fallback", error);
      return this.fallbackAnalysis(content);
    }
  }

  /**
   * Analyze and update a Communication record
   */
  async analyzeCommunication(communicationId: string): Promise<SentimentAnalysis | null> {
    const communication = await this.prisma.communication.findUnique({
      where: { id: communicationId },
      include: { Guest: true, Reservation: true },
    });

    if (!communication) {
      this.logger.warn(`Communication ${communicationId} not found`);
      return null;
    }

    // Only analyze inbound messages
    if (communication.direction !== "inbound") {
      return null;
    }

    const content = communication.body || communication.preview || "";
    if (!content.trim()) {
      return null;
    }

    const analysis = await this.analyzeMessage(communication.campgroundId, content, {
      subject: communication.subject || undefined,
      guestName: communication.Guest
        ? `${communication.Guest.primaryFirstName || ""} ${communication.Guest.primaryLastName || ""}`.trim()
        : undefined,
      reservationStatus: communication.Reservation?.status || undefined,
      type: this.normalizeMessageType(communication.type),
    });

    // Update the communication record
    await this.prisma.communication.update({
      where: { id: communicationId },
      data: {
        sentiment: analysis.sentiment,
        sentimentScore: analysis.sentimentScore,
        urgencyLevel: analysis.urgencyLevel,
        detectedIntent: analysis.detectedIntent,
        aiAnalyzedAt: new Date(),
      },
    });

    return analysis;
  }

  /**
   * Analyze and update a Message record
   */
  async analyzeGuestMessage(messageId: string): Promise<SentimentAnalysis | null> {
    const message = await this.prisma.message.findUnique({
      where: { id: messageId },
      include: { Guest: true, Reservation: true },
    });

    if (!message) {
      this.logger.warn(`Message ${messageId} not found`);
      return null;
    }

    // Only analyze guest messages
    if (message.senderType !== "guest") {
      return null;
    }

    const analysis = await this.analyzeMessage(message.campgroundId, message.content, {
      guestName: message.Guest
        ? `${message.Guest.primaryFirstName || ""} ${message.Guest.primaryLastName || ""}`.trim()
        : undefined,
      reservationStatus: message.Reservation?.status || undefined,
      type: "message",
    });

    // Update the message record
    await this.prisma.message.update({
      where: { id: messageId },
      data: {
        sentiment: analysis.sentiment,
        sentimentScore: analysis.sentimentScore,
        urgencyLevel: analysis.urgencyLevel,
        aiAnalyzedAt: new Date(),
      },
    });

    return analysis;
  }

  /**
   * Get sentiment statistics for a campground
   */
  async getSentimentStats(campgroundId: string, options?: { startDate?: Date; endDate?: Date }) {
    const where: Prisma.CommunicationWhereInput = {
      campgroundId,
      direction: "inbound",
      sentiment: { not: null },
    };

    if (options?.startDate || options?.endDate) {
      where.createdAt = {};
      if (options.startDate) where.createdAt.gte = options.startDate;
      if (options.endDate) where.createdAt.lte = options.endDate;
    }

    const [total, positive, neutral, negative, critical, high] = await Promise.all([
      this.prisma.communication.count({ where }),
      this.prisma.communication.count({ where: { ...where, sentiment: "positive" } }),
      this.prisma.communication.count({ where: { ...where, sentiment: "neutral" } }),
      this.prisma.communication.count({ where: { ...where, sentiment: "negative" } }),
      this.prisma.communication.count({ where: { ...where, urgencyLevel: "critical" } }),
      this.prisma.communication.count({ where: { ...where, urgencyLevel: "high" } }),
    ]);

    // Get recent negative/critical messages for dashboard
    const needsAttention = await this.prisma.communication.findMany({
      where: {
        campgroundId,
        direction: "inbound",
        OR: [{ sentiment: "negative" }, { urgencyLevel: "critical" }, { urgencyLevel: "high" }],
      },
      orderBy: { createdAt: "desc" },
      take: 10,
      select: {
        id: true,
        type: true,
        subject: true,
        preview: true,
        sentiment: true,
        urgencyLevel: true,
        detectedIntent: true,
        createdAt: true,
        Guest: {
          select: {
            primaryFirstName: true,
            primaryLastName: true,
          },
        },
      },
    });

    return {
      total,
      breakdown: {
        positive,
        neutral,
        negative,
      },
      percentages: {
        positive: total > 0 ? Math.round((positive / total) * 100) : 0,
        neutral: total > 0 ? Math.round((neutral / total) * 100) : 0,
        negative: total > 0 ? Math.round((negative / total) * 100) : 0,
      },
      urgency: {
        critical,
        high,
      },
      needsAttention,
    };
  }

  /**
   * AI-powered sentiment analysis
   */
  private async aiAnalyze(
    campgroundId: string,
    content: string,
    context?: {
      subject?: string;
      guestName?: string;
      reservationStatus?: string;
      type?: "email" | "sms" | "message";
    },
  ): Promise<SentimentAnalysis> {
    const contextStr = context
      ? `
Context:
- Type: ${context.type || "message"}
- Subject: ${context.subject || "N/A"}
- Guest: ${context.guestName || "Unknown"}
- Reservation Status: ${context.reservationStatus || "N/A"}
`
      : "";

    const prompt = `Analyze this customer message for sentiment, urgency, and intent.

${contextStr}
Message:
"${content.substring(0, 2000)}"

Respond with ONLY valid JSON in this exact format:
{
  "sentiment": "positive" | "neutral" | "negative",
  "sentimentScore": <number from -1.0 to 1.0>,
  "urgencyLevel": "low" | "normal" | "high" | "critical",
  "detectedIntent": "booking" | "complaint" | "question" | "praise" | "cancellation" | "payment" | "other",
  "confidence": <number from 0 to 1>,
  "summary": "<brief 1-sentence summary of the message>"
}

Guidelines:
- "critical" urgency: Safety issues, emergencies, threats to leave bad reviews
- "high" urgency: Complaints, billing disputes, same-day requests
- "normal" urgency: General questions, booking modifications
- "low" urgency: Praise, general feedback, future planning

- Sentiment score: -1.0 (very negative) to 1.0 (very positive), 0 is neutral
- confidence: How confident you are in this analysis (0.0 to 1.0)`;

    const response = await this.aiProvider.getCompletion({
      campgroundId,
      featureType: AiFeatureType.analytics,
      systemPrompt: "You analyze campground guest messages and respond with JSON only.",
      userPrompt: prompt,
      maxTokens: 500,
      temperature: 0.3,
    });

    try {
      // Extract JSON from response
      const jsonMatch = response.content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new BadGatewayException("No JSON found in response");
      }

      const parsed: AnalysisResult = JSON.parse(jsonMatch[0]);

      return {
        sentiment: this.validateSentiment(parsed.sentiment),
        sentimentScore: this.clamp(parsed.sentimentScore, -1, 1),
        urgencyLevel: this.validateUrgency(parsed.urgencyLevel),
        detectedIntent: this.validateIntent(parsed.detectedIntent),
        confidence: this.clamp(parsed.confidence, 0, 1),
        summary: parsed.summary,
      };
    } catch (error) {
      this.logger.warn("Failed to parse AI response, using fallback", error);
      return this.fallbackAnalysis(content);
    }
  }

  /**
   * Rule-based fallback when AI is unavailable
   */
  private fallbackAnalysis(content: string): SentimentAnalysis {
    const lowerContent = content.toLowerCase();

    // Sentiment detection
    const negativeWords = [
      "disappointed",
      "frustrat",
      "angry",
      "upset",
      "terrible",
      "worst",
      "horrible",
      "awful",
      "unacceptable",
      "refund",
      "complaint",
      "problem",
      "broken",
      "dirty",
      "rude",
      "disgusting",
      "never again",
      "warning",
    ];
    const positiveWords = [
      "thank",
      "great",
      "excellent",
      "wonderful",
      "amazing",
      "love",
      "perfect",
      "fantastic",
      "awesome",
      "best",
      "happy",
      "appreciate",
      "recommend",
      "enjoy",
      "beautiful",
    ];

    const negativeCount = negativeWords.filter((w) => lowerContent.includes(w)).length;
    const positiveCount = positiveWords.filter((w) => lowerContent.includes(w)).length;

    let sentiment: "positive" | "neutral" | "negative" = "neutral";
    let sentimentScore = 0;

    if (negativeCount > positiveCount && negativeCount >= 2) {
      sentiment = "negative";
      sentimentScore = -0.5 - Math.min(negativeCount * 0.1, 0.4);
    } else if (positiveCount > negativeCount && positiveCount >= 2) {
      sentiment = "positive";
      sentimentScore = 0.5 + Math.min(positiveCount * 0.1, 0.4);
    } else if (negativeCount > 0) {
      sentiment = "negative";
      sentimentScore = -0.3;
    } else if (positiveCount > 0) {
      sentiment = "positive";
      sentimentScore = 0.3;
    }

    // Urgency detection
    const criticalWords = ["emergency", "urgent", "asap", "immediately", "safety", "help", "911"];
    const highUrgencyWords = [
      "complaint",
      "refund",
      "today",
      "now",
      "right now",
      "manager",
      "lawyer",
    ];

    let urgencyLevel: "low" | "normal" | "high" | "critical" = "normal";

    if (criticalWords.some((w) => lowerContent.includes(w))) {
      urgencyLevel = "critical";
    } else if (highUrgencyWords.some((w) => lowerContent.includes(w)) || sentiment === "negative") {
      urgencyLevel = "high";
    } else if (sentiment === "positive") {
      urgencyLevel = "low";
    }

    // Intent detection
    let detectedIntent: SentimentAnalysis["detectedIntent"] = "other";

    if (lowerContent.includes("cancel") || lowerContent.includes("cancellation")) {
      detectedIntent = "cancellation";
    } else if (
      lowerContent.includes("book") ||
      lowerContent.includes("reserv") ||
      lowerContent.includes("availability")
    ) {
      detectedIntent = "booking";
    } else if (
      lowerContent.includes("pay") ||
      lowerContent.includes("charge") ||
      lowerContent.includes("refund") ||
      lowerContent.includes("bill")
    ) {
      detectedIntent = "payment";
    } else if (
      lowerContent.includes("complaint") ||
      lowerContent.includes("problem") ||
      lowerContent.includes("issue")
    ) {
      detectedIntent = "complaint";
    } else if (
      lowerContent.includes("?") ||
      lowerContent.includes("how") ||
      lowerContent.includes("what") ||
      lowerContent.includes("when")
    ) {
      detectedIntent = "question";
    } else if (sentiment === "positive") {
      detectedIntent = "praise";
    }

    return {
      sentiment,
      sentimentScore: this.clamp(sentimentScore, -1, 1),
      urgencyLevel,
      detectedIntent,
      confidence: 0.5, // Lower confidence for fallback
    };
  }

  private validateSentiment(s: string): "positive" | "neutral" | "negative" {
    return this.isSentiment(s) ? s : "neutral";
  }

  private validateUrgency(u: string): "low" | "normal" | "high" | "critical" {
    return this.isUrgency(u) ? u : "normal";
  }

  private validateIntent(i: string): SentimentAnalysis["detectedIntent"] {
    return this.isIntent(i) ? i : "other";
  }

  private normalizeMessageType(type?: string | null): "email" | "sms" | "message" | undefined {
    if (type === "email" || type === "sms" || type === "message") {
      return type;
    }
    return undefined;
  }

  private isSentiment(value: string): value is SentimentAnalysis["sentiment"] {
    return this.sentimentValues.some((entry) => entry === value);
  }

  private isUrgency(value: string): value is SentimentAnalysis["urgencyLevel"] {
    return this.urgencyValues.some((entry) => entry === value);
  }

  private isIntent(value: string): value is SentimentAnalysis["detectedIntent"] {
    return this.intentValues.some((entry) => entry === value);
  }

  private clamp(value: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, value || 0));
  }
}
