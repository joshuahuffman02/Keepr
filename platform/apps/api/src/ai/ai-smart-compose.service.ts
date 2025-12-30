import { Injectable, NotFoundException } from "@nestjs/common";
import { AiProviderService } from "./ai-provider.service";
import { AiPrivacyService } from "./ai-privacy.service";
import { AiFeatureGateService } from "./ai-feature-gate.service";
import { PrismaService } from "../prisma/prisma.service";
import { AiFeatureType } from "@prisma/client";

interface ComposeContext {
  campgroundId: string;
  conversationId?: string;
  guestName?: string;
  recipientType: "guest" | "staff" | "vendor";
  messageType: "email" | "sms" | "internal";
  priorMessages?: Array<{ role: "guest" | "staff"; content: string }>;
  reservationContext?: {
    siteName?: string;
    arrivalDate?: string;
    departureDate?: string;
    totalAmount?: number;
  };
}

export interface InlineCompletion {
  completion: string;
  fullSentence: string;
  confidence: number;
}

interface GrammarSuggestion {
  original: string;
  suggestion: string;
  reason: string;
  position: { start: number; end: number };
}

@Injectable()
export class AiSmartComposeService {
  // Common campground phrases for fast local completion
  private readonly commonPhrases = [
    "Thank you for your inquiry",
    "Thank you for booking with us",
    "We look forward to seeing you",
    "Please let us know if you have any questions",
    "Your reservation has been confirmed",
    "Check-in time is",
    "Check-out time is",
    "We're happy to help",
    "Is there anything else I can assist you with",
    "Your confirmation number is",
    "We appreciate your patience",
    "We apologize for any inconvenience",
    "Looking forward to hosting you",
    "Safe travels",
    "Have a great stay",
    "Welcome to",
    "We hope you enjoyed your stay",
    "Please don't hesitate to reach out",
    "Our office hours are",
    "Feel free to contact us",
  ];

  // Phrase starters that trigger completions
  private readonly phraseCompletions: Record<string, string[]> = {
    "thank you": [
      "for your inquiry about our campground.",
      "for booking with us! We look forward to hosting you.",
      "for your patience while we processed your request.",
      "for choosing our campground for your upcoming trip.",
      "for reaching out to us.",
    ],
    "we look": [
      "forward to seeing you!",
      "forward to hosting you during your stay.",
      "forward to welcoming you to our campground.",
    ],
    "please let": [
      "us know if you have any questions.",
      "us know how we can assist you further.",
      "me know if there's anything else you need.",
    ],
    "your reservation": [
      "has been confirmed. You should receive a confirmation email shortly.",
      "is all set! Here are the details:",
      "number is",
    ],
    "check-in": [
      "time is 3:00 PM. Early check-in may be available upon request.",
      "begins at 3:00 PM.",
      "is at 3:00 PM, and our office will be open to greet you.",
    ],
    "check-out": [
      "time is 11:00 AM.",
      "is at 11:00 AM. Late check-out may be available upon request.",
    ],
    "we apologize": [
      "for any inconvenience this may have caused.",
      "for the confusion.",
      "for the delay in our response.",
    ],
    "if you have": [
      "any questions, please don't hesitate to reach out.",
      "any concerns, we're here to help.",
      "special requests, please let us know in advance.",
    ],
    "we hope": [
      "you enjoyed your stay!",
      "to see you again soon.",
      "this helps answer your question.",
    ],
    "feel free": [
      "to contact us if you need anything.",
      "to reach out anytime.",
      "to call us at our office number.",
    ],
  };

  constructor(
    private readonly provider: AiProviderService,
    private readonly privacy: AiPrivacyService,
    private readonly gate: AiFeatureGateService,
    private readonly prisma: PrismaService
  ) {}

  /**
   * Get inline completion suggestions as the user types
   * Uses local phrase matching first, then AI for novel sentences
   */
  async getInlineCompletion(
    context: ComposeContext,
    currentText: string,
    cursorPosition: number,
    userId: string
  ): Promise<InlineCompletion | null> {
    // Get text up to cursor
    const textBeforeCursor = currentText.slice(0, cursorPosition).toLowerCase();
    const lastSentenceStart = Math.max(
      textBeforeCursor.lastIndexOf(".") + 1,
      textBeforeCursor.lastIndexOf("!") + 1,
      textBeforeCursor.lastIndexOf("?") + 1,
      0
    );
    const currentSentence = textBeforeCursor.slice(lastSentenceStart).trim();

    // Skip if too short
    if (currentSentence.length < 3) {
      return null;
    }

    // Try local phrase matching first (fast, no AI needed)
    const localCompletion = this.getLocalCompletion(currentSentence);
    if (localCompletion) {
      return localCompletion;
    }

    // For longer text, try AI completion
    if (currentSentence.length >= 10) {
      try {
        return await this.getAiCompletion(context, currentSentence, userId);
      } catch {
        // Fail silently - inline completion is optional
        return null;
      }
    }

    return null;
  }

  /**
   * Check grammar and tone of the message
   */
  async checkGrammarAndTone(
    context: ComposeContext,
    text: string,
    userId: string
  ): Promise<{
    suggestions: GrammarSuggestion[];
    overallTone: "professional" | "friendly" | "formal" | "casual";
    toneScore: number;
  }> {
    if (text.length < 20) {
      return { suggestions: [], overallTone: "friendly", toneScore: 85 };
    }

    // Check if feature is enabled
    const enabled = await this.gate.isFeatureEnabled(
      context.campgroundId,
      AiFeatureType.reply_assist
    );

    if (!enabled) {
      return { suggestions: [], overallTone: "friendly", toneScore: 85 };
    }

    // Anonymize the text
    const { anonymizedText, tokenMap } = this.privacy.anonymize(text, "moderate");

    const systemPrompt = `You are a professional editor for hospitality communications.
Analyze the message and provide:
1. Grammar/spelling corrections (if any)
2. Overall tone assessment
3. Suggestions for improvement (if needed)

Be concise. Only flag genuine issues, not stylistic preferences.
Focus on clarity, professionalism, and warmth.

Output format (JSON):
{
  "suggestions": [
    { "original": "word", "suggestion": "corrected", "reason": "brief reason" }
  ],
  "tone": "professional|friendly|formal|casual",
  "toneScore": 85,
  "improvement": "optional brief tip"
}`;

    try {
      const response = await this.provider.getCompletion({
        campgroundId: context.campgroundId,
        featureType: AiFeatureType.reply_assist,
        systemPrompt,
        userPrompt: `Check this message:\n\n${anonymizedText}`,
        userId,
        maxTokens: 300,
        temperature: 0.3,
      });

      const result = this.parseGrammarResponse(response.content);

      // De-anonymize suggestions
      const deAnonymizedSuggestions = result.suggestions.map((s) => ({
        ...s,
        original: this.privacy.deanonymize(s.original, tokenMap),
        suggestion: this.privacy.deanonymize(s.suggestion, tokenMap),
      }));

      // Add positions based on text search
      const suggestionsWithPositions = deAnonymizedSuggestions.map((s) => {
        const start = text.toLowerCase().indexOf(s.original.toLowerCase());
        return {
          ...s,
          position: { start, end: start + s.original.length },
        };
      });

      return {
        suggestions: suggestionsWithPositions.filter((s) => s.position.start >= 0),
        overallTone: result.tone,
        toneScore: result.toneScore,
      };
    } catch {
      return { suggestions: [], overallTone: "friendly", toneScore: 85 };
    }
  }

  /**
   * Get quick reply templates based on context
   */
  async getQuickReplies(
    context: ComposeContext,
    userId: string
  ): Promise<Array<{ label: string; text: string }>> {
    const quickReplies: Array<{ label: string; text: string }> = [];

    // Standard replies based on recipient type
    if (context.recipientType === "guest") {
      quickReplies.push(
        {
          label: "Greeting",
          text: `Hi${context.guestName ? ` ${context.guestName.split(" ")[0]}` : ""}! Thank you for reaching out.`,
        },
        {
          label: "Check-in Info",
          text: "Check-in time is 3:00 PM. Our office will be open to greet you. Please let us know if you'll be arriving late.",
        },
        {
          label: "Follow Up",
          text: "Is there anything else I can help you with?",
        },
        {
          label: "Closing",
          text: "Thank you for choosing us! We look forward to hosting you.",
        }
      );

      // Add reservation-specific replies
      if (context.reservationContext) {
        if (context.reservationContext.siteName) {
          quickReplies.push({
            label: "Site Confirmed",
            text: `Great news! You're all set for ${context.reservationContext.siteName}.`,
          });
        }
      }
    } else if (context.recipientType === "staff") {
      quickReplies.push(
        { label: "Acknowledge", text: "Got it, thanks for letting me know." },
        { label: "Will Do", text: "I'll take care of this right away." },
        {
          label: "Need Info",
          text: "Could you provide more details about this?",
        },
        { label: "Completed", text: "This has been completed. Let me know if you need anything else." }
      );
    }

    return quickReplies;
  }

  // Private methods

  private getLocalCompletion(text: string): InlineCompletion | null {
    const lowerText = text.toLowerCase();

    // Check phrase completions
    for (const [starter, completions] of Object.entries(this.phraseCompletions)) {
      if (lowerText.endsWith(starter) || lowerText.includes(starter + " ")) {
        const matchIndex = lowerText.lastIndexOf(starter);
        const afterStarter = text.slice(matchIndex + starter.length).trim();

        // Find matching completion
        for (const completion of completions) {
          if (completion.toLowerCase().startsWith(afterStarter.toLowerCase())) {
            const remaining = completion.slice(afterStarter.length);
            if (remaining.length > 0) {
              return {
                completion: remaining,
                fullSentence: completion,
                confidence: 0.9,
              };
            }
          }
        }

        // If no exact match, suggest first completion
        if (afterStarter.length === 0) {
          return {
            completion: " " + completions[0],
            fullSentence: completions[0],
            confidence: 0.8,
          };
        }
      }
    }

    // Check if text matches start of common phrases
    for (const phrase of this.commonPhrases) {
      if (phrase.toLowerCase().startsWith(lowerText) && phrase.length > text.length + 3) {
        const completion = phrase.slice(text.length);
        return {
          completion,
          fullSentence: phrase,
          confidence: 0.85,
        };
      }
    }

    return null;
  }

  private async getAiCompletion(
    context: ComposeContext,
    currentSentence: string,
    userId: string
  ): Promise<InlineCompletion | null> {
    // Check if feature is enabled
    const enabled = await this.gate.isFeatureEnabled(
      context.campgroundId,
      AiFeatureType.reply_assist
    );

    if (!enabled) {
      return null;
    }

    const systemPrompt = `You are an autocomplete assistant for campground staff messages.
Complete the sentence naturally and professionally.
Keep completions short (5-15 words typically).
Match the tone and intent of what's been typed.
Only output the completion text, nothing else.`;

    const contextInfo = context.priorMessages
      ? `Prior context: ${context.priorMessages.slice(-2).map((m) => `${m.role}: ${m.content}`).join("\n")}\n\n`
      : "";

    try {
      const response = await this.provider.getCompletion({
        campgroundId: context.campgroundId,
        featureType: AiFeatureType.reply_assist,
        systemPrompt,
        userPrompt: `${contextInfo}Complete this sentence naturally:\n"${currentSentence}"`,
        userId,
        maxTokens: 50,
        temperature: 0.4,
      });

      const completion = response.content.trim();

      if (completion && completion.length > 2 && completion.length < 100) {
        return {
          completion: completion.startsWith(currentSentence)
            ? completion.slice(currentSentence.length)
            : " " + completion,
          fullSentence: currentSentence + completion,
          confidence: 0.75,
        };
      }
    } catch {
      // Fail silently
    }

    return null;
  }

  private parseGrammarResponse(content: string): {
    suggestions: Array<{ original: string; suggestion: string; reason: string }>;
    tone: "professional" | "friendly" | "formal" | "casual";
    toneScore: number;
  } {
    try {
      // Try to parse as JSON
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return {
          suggestions: parsed.suggestions || [],
          tone: parsed.tone || "friendly",
          toneScore: parsed.toneScore || 85,
        };
      }
    } catch {
      // Fallback
    }

    return { suggestions: [], tone: "friendly", toneScore: 85 };
  }
}
