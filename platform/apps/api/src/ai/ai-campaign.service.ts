import { Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { AiProviderService } from "./ai-provider.service";
import { AiFeatureGateService } from "./ai-feature-gate.service";
import { AiFeatureType } from "@prisma/client";

export interface SubjectLineOption {
  subject: string;
  tone: "professional" | "friendly" | "urgent" | "casual" | "promotional";
  reasoning: string;
  estimatedOpenRate?: string;
}

export interface ContentSuggestion {
  headline: string;
  body: string;
  callToAction: string;
  tone: string;
}

interface CampaignContext {
  campaignType: string;
  targetAudience?: string;
  promotion?: string;
  seasonOrEvent?: string;
  campgroundName: string;
  previousSubject?: string;
}

@Injectable()
export class AiCampaignService {
  private readonly logger = new Logger(AiCampaignService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly provider: AiProviderService,
    private readonly gate: AiFeatureGateService,
  ) {}

  /**
   * Generate multiple subject line options for a campaign
   */
  async generateSubjectLines(
    campgroundId: string,
    context: CampaignContext,
    count: number = 5,
  ): Promise<SubjectLineOption[]> {
    await this.gate.assertFeatureEnabled(campgroundId, AiFeatureType.analytics);

    const systemPrompt = `You are an email marketing expert for campgrounds and RV parks.
Generate compelling email subject lines that:
- Are 40-60 characters for optimal mobile display
- Create curiosity or urgency without being spammy
- Match the campground's brand voice
- Avoid ALL CAPS, excessive punctuation, or spam trigger words

For each subject line, provide:
- The subject line itself
- The tone (professional, friendly, urgent, casual, or promotional)
- Brief reasoning for why it works
- Estimated open rate compared to baseline (e.g., "+15% vs baseline")`;

    const userPrompt = `Generate ${count} subject line options for ${context.campgroundName}.

Campaign Type: ${context.campaignType}
${context.targetAudience ? `Target Audience: ${context.targetAudience}` : ""}
${context.promotion ? `Promotion: ${context.promotion}` : ""}
${context.seasonOrEvent ? `Season/Event: ${context.seasonOrEvent}` : ""}
${context.previousSubject ? `Previous Subject (for A/B testing): ${context.previousSubject}` : ""}

Return JSON array:
[
  {
    "subject": "Subject line here",
    "tone": "friendly",
    "reasoning": "Why this works",
    "estimatedOpenRate": "+10% vs baseline"
  }
]`;

    try {
      const response = await this.provider.getCompletion({
        campgroundId,
        featureType: AiFeatureType.analytics,
        systemPrompt,
        userPrompt,
        maxTokens: 800,
        temperature: 0.7, // Higher temp for creative variation
      });

      const jsonMatch = response.content.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }

      return this.fallbackSubjectLines(context);
    } catch (error) {
      this.logger.warn(`AI subject line generation failed: ${error}`);
      return this.fallbackSubjectLines(context);
    }
  }

  /**
   * Generate email body content suggestions
   */
  async generateContent(
    campgroundId: string,
    context: CampaignContext & { subject: string },
  ): Promise<ContentSuggestion[]> {
    await this.gate.assertFeatureEnabled(campgroundId, AiFeatureType.analytics);

    const systemPrompt = `You are an email marketing expert for campgrounds and RV parks.
Generate email content that:
- Is scannable with short paragraphs
- Has a clear value proposition
- Includes a strong call to action
- Feels personal and welcoming
- Uses {{firstName}}, {{lastName}}, {{campgroundName}} as template variables`;

    const userPrompt = `Generate 3 email content variations for ${context.campgroundName}.

Subject Line: ${context.subject}
Campaign Type: ${context.campaignType}
${context.targetAudience ? `Target Audience: ${context.targetAudience}` : ""}
${context.promotion ? `Promotion Details: ${context.promotion}` : ""}
${context.seasonOrEvent ? `Season/Event: ${context.seasonOrEvent}` : ""}

For each variation, provide:
- A headline (displayed prominently)
- Body copy (2-3 paragraphs, HTML-friendly)
- Call to action button text

Return JSON array:
[
  {
    "headline": "Headline here",
    "body": "Body HTML here...",
    "callToAction": "Book Now",
    "tone": "friendly"
  }
]`;

    try {
      const response = await this.provider.getCompletion({
        campgroundId,
        featureType: AiFeatureType.analytics,
        systemPrompt,
        userPrompt,
        maxTokens: 1200,
        temperature: 0.6,
      });

      const jsonMatch = response.content.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }

      return this.fallbackContent(context);
    } catch (error) {
      this.logger.warn(`AI content generation failed: ${error}`);
      return this.fallbackContent(context);
    }
  }

  /**
   * Suggest optimal send times based on campaign type
   */
  async suggestSendTimes(
    campgroundId: string,
    campaignType: string,
    targetAudience?: string,
  ): Promise<{
    recommended: { day: string; time: string; reason: string };
    alternatives: { day: string; time: string; reason: string }[];
    insights: string[];
  }> {
    // Industry best practices for campground emails
    const sendTimeRules: Record<string, { day: string; time: string; reason: string }> = {
      promotional: {
        day: "Tuesday",
        time: "10:00 AM",
        reason: "Tuesday mornings see highest open rates for promotional content",
      },
      newsletter: {
        day: "Thursday",
        time: "9:00 AM",
        reason: "Thursday is ideal for informational content before weekend planning",
      },
      seasonal: {
        day: "Wednesday",
        time: "11:00 AM",
        reason: "Mid-week is best for seasonal announcements",
      },
      lapsed_guest: {
        day: "Sunday",
        time: "7:00 PM",
        reason: "Sunday evenings when people are planning their week ahead",
      },
      vip: {
        day: "Friday",
        time: "2:00 PM",
        reason: "Friday afternoon for VIPs planning their weekend",
      },
      booking_reminder: {
        day: "Monday",
        time: "8:00 AM",
        reason: "Start of week for booking-related reminders",
      },
      last_minute: {
        day: "Wednesday",
        time: "12:00 PM",
        reason: "Mid-week lunch for last-minute weekend deals",
      },
    };

    const typeKey = campaignType.toLowerCase().replace(/\s+/g, "_");
    const recommended = sendTimeRules[typeKey] || sendTimeRules.promotional;

    // Get alternatives
    const alternatives = Object.entries(sendTimeRules)
      .filter(([key]) => key !== typeKey)
      .slice(0, 3)
      .map(([_, value]) => value);

    return {
      recommended,
      alternatives,
      insights: [
        "Avoid Monday mornings - inbox is crowded from weekend accumulation",
        "Tuesday-Thursday 9-11 AM typically has highest engagement",
        "Friday afternoon works for weekend-relevant content",
        "Sunday evening for planning-oriented messages",
        "Consider timezone: send at 10 AM recipient's local time",
      ],
    };
  }

  /**
   * Improve existing email copy
   */
  async improveContent(
    campgroundId: string,
    currentContent: { subject?: string; body?: string },
    goal: "clarity" | "urgency" | "warmth" | "brevity" | "persuasion",
  ): Promise<{
    improvedSubject?: string;
    improvedBody?: string;
    changes: string[];
    tips: string[];
  }> {
    await this.gate.assertFeatureEnabled(campgroundId, AiFeatureType.analytics);

    const goalInstructions: Record<string, string> = {
      clarity: "Make the message clearer and easier to understand. Remove jargon and ambiguity.",
      urgency: "Add appropriate urgency without being spammy. Use time-sensitive language.",
      warmth: "Make it more personal and welcoming. Add friendly touches.",
      brevity: "Shorten without losing meaning. Get to the point faster.",
      persuasion: "Make it more compelling. Strengthen the value proposition and CTA.",
    };

    const systemPrompt = `You are an email marketing expert. Improve the email content with this goal: ${goalInstructions[goal]}

Keep template variables like {{firstName}}, {{campgroundName}} intact.
Maintain the core message but enhance it according to the goal.`;

    const userPrompt = `Improve this email content:

${currentContent.subject ? `Subject: ${currentContent.subject}` : ""}
${currentContent.body ? `Body:\n${currentContent.body}` : ""}

Goal: ${goal}

Return JSON:
{
  ${currentContent.subject ? `"improvedSubject": "Better subject line",` : ""}
  ${currentContent.body ? `"improvedBody": "Better body content",` : ""}
  "changes": ["List of specific changes made"],
  "tips": ["Additional tips for improvement"]
}`;

    try {
      const response = await this.provider.getCompletion({
        campgroundId,
        featureType: AiFeatureType.analytics,
        systemPrompt,
        userPrompt,
        maxTokens: 800,
        temperature: 0.4,
      });

      const jsonMatch = response.content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }

      return {
        changes: ["Could not analyze content"],
        tips: ["Try breaking content into shorter paragraphs", "Add a clear call to action"],
      };
    } catch (error) {
      this.logger.warn(`AI content improvement failed: ${error}`);
      return {
        changes: ["AI analysis unavailable"],
        tips: [
          "Keep subject lines under 50 characters",
          "Use action verbs in your CTA",
          "Personalize with guest names",
        ],
      };
    }
  }

  /**
   * Generate A/B test variations
   */
  async generateAbTest(
    campgroundId: string,
    original: { subject: string; body?: string },
    testElement: "subject" | "cta" | "opening",
  ): Promise<{
    variation: { subject: string; body?: string };
    hypothesis: string;
    whatToMeasure: string;
    sampleSize: string;
  }> {
    await this.gate.assertFeatureEnabled(campgroundId, AiFeatureType.analytics);

    const testInstructions: Record<string, string> = {
      subject:
        "Create an alternative subject line that tests a different approach (e.g., question vs statement, emoji vs no emoji, personalization vs generic)",
      cta: "Create a variation with a different call to action (different wording, urgency level, or positioning)",
      opening: "Create a variation with a different opening line or hook",
    };

    const systemPrompt = `You are an email A/B testing expert. Create a meaningful test variation.
${testInstructions[testElement]}

The variation should be different enough to test a hypothesis but similar enough for valid comparison.`;

    const userPrompt = `Create an A/B test variation:

Original Subject: ${original.subject}
${original.body ? `Original Body:\n${original.body}` : ""}

Element to Test: ${testElement}

Return JSON:
{
  "variation": {
    "subject": "Alternative subject",
    "body": "Alternative body if testing opening/CTA"
  },
  "hypothesis": "What we're testing and why",
  "whatToMeasure": "Primary metric (e.g., open rate for subject tests)",
  "sampleSize": "Recommended sample size for statistical significance"
}`;

    try {
      const response = await this.provider.getCompletion({
        campgroundId,
        featureType: AiFeatureType.analytics,
        systemPrompt,
        userPrompt,
        maxTokens: 600,
        temperature: 0.6,
      });

      const jsonMatch = response.content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }

      return this.fallbackAbTest(original, testElement);
    } catch (error) {
      this.logger.warn(`AI A/B test generation failed: ${error}`);
      return this.fallbackAbTest(original, testElement);
    }
  }

  // ==================== FALLBACKS ====================

  private fallbackSubjectLines(context: CampaignContext): SubjectLineOption[] {
    const templates: Record<string, SubjectLineOption[]> = {
      promotional: [
        {
          subject: `Special Offer from ${context.campgroundName}`,
          tone: "promotional",
          reasoning: "Direct and clear value proposition",
          estimatedOpenRate: "baseline",
        },
        {
          subject: `Your Exclusive Deal Awaits`,
          tone: "friendly",
          reasoning: "Creates curiosity and exclusivity",
          estimatedOpenRate: "+5% vs baseline",
        },
        {
          subject: `Limited Time: Save on Your Next Stay`,
          tone: "urgent",
          reasoning: "Urgency drives action",
          estimatedOpenRate: "+8% vs baseline",
        },
      ],
      newsletter: [
        {
          subject: `News from ${context.campgroundName}`,
          tone: "professional",
          reasoning: "Clear and expected",
          estimatedOpenRate: "baseline",
        },
        {
          subject: `What's Happening This Month`,
          tone: "casual",
          reasoning: "Conversational and engaging",
          estimatedOpenRate: "+3% vs baseline",
        },
      ],
      seasonal: [
        {
          subject: `${context.seasonOrEvent || "This Season"} at ${context.campgroundName}`,
          tone: "friendly",
          reasoning: "Timely and relevant",
          estimatedOpenRate: "+5% vs baseline",
        },
      ],
    };

    return templates[context.campaignType] || templates.promotional;
  }

  private fallbackContent(context: CampaignContext & { subject: string }): ContentSuggestion[] {
    return [
      {
        headline: `Welcome Back to ${context.campgroundName}`,
        body: `<p>Hi {{firstName}},</p><p>We've been thinking about you! ${context.promotion ? `We have a special offer: ${context.promotion}` : "We'd love to have you back for another memorable stay."}</p><p>Book today and experience the best of outdoor living.</p>`,
        callToAction: "Book Your Stay",
        tone: "friendly",
      },
    ];
  }

  private fallbackAbTest(
    original: { subject: string; body?: string },
    testElement: string,
  ): {
    variation: { subject: string; body?: string };
    hypothesis: string;
    whatToMeasure: string;
    sampleSize: string;
  } {
    const variations: Record<string, { subject: string }> = {
      subject: {
        subject: original.subject.includes("?")
          ? original.subject.replace("?", "!")
          : original.subject + "?",
      },
      cta: { subject: original.subject },
      opening: { subject: original.subject },
    };

    return {
      variation: variations[testElement] || variations.subject,
      hypothesis: `Testing if a different ${testElement} improves engagement`,
      whatToMeasure: testElement === "subject" ? "Open rate" : "Click-through rate",
      sampleSize: "At least 1,000 recipients per variation for statistical significance",
    };
  }
}
