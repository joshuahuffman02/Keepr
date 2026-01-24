import { Injectable, Logger, NotFoundException } from "@nestjs/common";
import { AiProviderService } from "./ai-provider.service";
import { PrismaService } from "../prisma/prisma.service";
import { AiFeatureType } from "@prisma/client";

interface SupportChatRequest {
  sessionId: string;
  message: string;
  history?: { role: "user" | "assistant"; content: string }[];
  context?: string;
  userId?: string;
}

interface HelpArticle {
  title: string;
  url: string;
}

export interface SupportChatResponse {
  message: string;
  helpArticles?: HelpArticle[];
  showTicketPrompt?: boolean;
}

// Embedded help knowledge base (mirrors frontend topics)
const HELP_KNOWLEDGE = [
  {
    id: "dashboard-overview",
    title: "Dashboard at a Glance",
    keywords: ["dashboard", "overview", "metrics", "occupancy", "revenue", "arrivals"],
    summary:
      "See occupancy, revenue, arrivals, and alerts in one place. Use the date selector to change time windows and click widgets to drill into reports.",
  },
  {
    id: "calendar-availability",
    title: "Calendar & Availability",
    keywords: ["calendar", "availability", "reservations", "dates", "schedule"],
    summary:
      "View site availability by date range. Drag across dates to create reservations, click booking blocks to edit. Use filters to show certain classes or statuses.",
  },
  {
    id: "booking-new",
    title: "Create a New Reservation",
    keywords: ["booking", "reservation", "new", "create", "book"],
    summary:
      "Start bookings from the Booking page or drag-select on calendar. Choose dates, guest count, site, enter contact info, and collect payment.",
  },
  {
    id: "reservation-manage",
    title: "Manage an Existing Reservation",
    keywords: ["reservation", "edit", "change", "modify", "update", "assign"],
    summary:
      "Search reservations by name, code, or dates. Change dates/sites (system checks conflicts), add charges/refunds, log notes for staff.",
  },
  {
    id: "check-in-out",
    title: "Check-In and Check-Out",
    keywords: ["check-in", "check-out", "arrival", "departure", "front desk"],
    summary:
      "Open Due for Arrival/Departure lists. Confirm identity and balance, collect payments, mark status, notify housekeeping if needed.",
  },
  {
    id: "guests-profiles",
    title: "Guest Profiles & History",
    keywords: ["guests", "profile", "history", "contact"],
    summary:
      "Search guests by name/email/phone. View past stays, balance history, saved payment methods. Add notes or flags for special handling.",
  },
  {
    id: "payments-collect",
    title: "Collect a Payment",
    keywords: ["payment", "collect", "charge", "card", "cash", "pos"],
    summary:
      "Open reservation Billing tab, click Collect Payment, choose method, enter amount, process and issue receipt.",
  },
  {
    id: "payments-refund",
    title: "Issue a Refund",
    keywords: ["refund", "return", "cancel payment"],
    summary:
      "From Billing tab, select Refund, choose original payment, enter amount and reason. System records audit trail.",
  },
  {
    id: "stripe-connect",
    title: "Connect Stripe",
    keywords: ["stripe", "payment gateway", "connect", "setup payments"],
    summary:
      "Go to Settings > Payments to connect your Stripe account. This enables you to accept credit card payments from guests.",
  },
  {
    id: "pricing-rules",
    title: "Pricing Rules & Overrides",
    keywords: ["pricing", "rates", "seasons", "discount", "price"],
    summary:
      "Open Pricing to manage rate cards. Add rules for adjustments, set seasonal windows, minimum nights, and preview final prices.",
  },
  {
    id: "site-classes",
    title: "Manage Site Classes",
    keywords: ["site class", "hookups", "amenities", "group sites"],
    summary:
      "Group sites by hookups/size/amenities. Create classes with shared pricing rules. Assign sites to classes.",
  },
  {
    id: "sites-management",
    title: "Manage Sites & Amenities",
    keywords: ["sites", "add site", "edit site", "amenities"],
    summary:
      "Add site number/name, hookups, max length. Assign to class for pricing. Set status (active, offline, maintenance).",
  },
  {
    id: "users-roles",
    title: "Users & Roles",
    keywords: ["users", "roles", "staff", "permissions", "invite", "access"],
    summary:
      "Invite users by email, assign roles, adjust permissions. Assign campground access. Deactivate users who no longer need access.",
  },
  {
    id: "support-contact",
    title: "Contact Support",
    keywords: ["support", "help", "contact", "issue", "problem"],
    summary:
      "Check help panel first. Use in-app chat or email support@keeprstay.com. Include reservation IDs or screenshots.",
  },
];

@Injectable()
export class AiSupportService {
  private readonly logger = new Logger(AiSupportService.name);

  constructor(
    private readonly aiProvider: AiProviderService,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * Handle support chat requests
   */
  async chat(request: SupportChatRequest): Promise<SupportChatResponse> {
    const { message, history = [], sessionId, userId } = request;

    // Find relevant help articles based on keywords
    const relevantArticles = this.findRelevantArticles(message);

    // Build context from relevant articles
    const helpContext = relevantArticles.map((a) => `- ${a.title}: ${a.summary}`).join("\n");

    const systemPrompt = `You are a helpful support assistant for Keepr, a campground management software. Your role is to help campground owners and staff use the platform effectively.

IMPORTANT GUIDELINES:
- Be friendly, concise, and helpful
- Focus on practical solutions and step-by-step guidance
- If you're unsure about something specific, suggest checking the Help Center or contacting support
- Never make up features that don't exist
- Keep responses under 200 words unless detailed instructions are needed

SAFETY & PRIVACY:
- Never ask for passwords, API keys, full payment card numbers, or SSNs
- Do not request or expose sensitive guest data
- If account changes or billing access are needed, direct users to secure in-app flows or support tickets

RELEVANT HELP TOPICS:
${helpContext || "No specific topics matched. Provide general guidance or suggest the Help Center."}

AVAILABLE FEATURES:
- Dashboard with occupancy, revenue, and alerts
- Calendar view for availability and reservations
- Booking flow for creating reservations
- Guest profiles and history
- Payments via Stripe (collecting, refunds)
- Pricing rules and seasonal adjustments
- Site management and classes
- User roles and permissions
- Reports and exports
- Messages/communications with guests
- Maintenance and work orders
- Promotions and discounts

If the user's question is outside your knowledge, suggest they:
1. Check the Help Center at /help
2. Browse FAQs at /help/faq
3. Submit a support ticket at /help/contact`;

    // Build conversation history for context
    const conversationContext = history
      .slice(-6) // Last 3 exchanges
      .map((m) => `${m.role === "user" ? "User" : "Assistant"}: ${m.content}`)
      .join("\n");

    const userPrompt = conversationContext
      ? `Previous conversation:\n${conversationContext}\n\nUser's new message: ${message}`
      : message;

    try {
      // Use a generic campground context for support (platform-level)
      // In production, you might want to get the user's campground for context
      const response = await this.aiProvider.getCompletion({
        campgroundId: await this.getDefaultCampgroundId(),
        featureType: AiFeatureType.reply_assist, // Reusing for support
        systemPrompt,
        userPrompt,
        userId,
        sessionId,
        maxTokens: 400,
        temperature: 0.7,
      });

      // Determine if we should show ticket prompt
      const showTicketPrompt = this.shouldShowTicketPrompt(message, response.content);

      // Format help articles for response
      const helpArticles = relevantArticles.slice(0, 3).map((a) => ({
        title: a.title,
        url: `/help#${a.id}`,
      }));

      return {
        message: response.content,
        helpArticles: helpArticles.length > 0 ? helpArticles : undefined,
        showTicketPrompt,
      };
    } catch (error) {
      this.logger.error("Support chat error:", error);

      // Graceful fallback
      return {
        message:
          "I'm having trouble connecting right now, but I can still help! Here are some resources:\n\n" +
          "- Check our Help Center for answers to common questions\n" +
          "- Browse the FAQ section for quick answers\n" +
          "- Submit a support ticket for personalized help\n\n" +
          "Our team typically responds within a few hours.",
        helpArticles: [
          { title: "Help Center", url: "/help" },
          { title: "FAQs", url: "/help/faq" },
          { title: "Contact Support", url: "/help/contact" },
        ],
        showTicketPrompt: true,
      };
    }
  }

  /**
   * Find relevant help articles based on message keywords
   */
  private findRelevantArticles(message: string): typeof HELP_KNOWLEDGE {
    const lowerMessage = message.toLowerCase();
    const words = lowerMessage.split(/\s+/);

    // Score each article by keyword matches
    const scored = HELP_KNOWLEDGE.map((article) => {
      let score = 0;
      for (const keyword of article.keywords) {
        if (lowerMessage.includes(keyword)) {
          score += 2; // Full keyword match
        } else {
          for (const word of words) {
            if (keyword.includes(word) && word.length > 2) {
              score += 1; // Partial match
            }
          }
        }
      }
      // Boost if title words appear
      const titleWords = article.title.toLowerCase().split(/\s+/);
      for (const titleWord of titleWords) {
        if (lowerMessage.includes(titleWord) && titleWord.length > 2) {
          score += 1;
        }
      }
      return { article, score };
    });

    // Return top matches with score > 0
    return scored
      .filter((s) => s.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 5)
      .map((s) => s.article);
  }

  /**
   * Determine if we should prompt for a support ticket
   */
  private shouldShowTicketPrompt(question: string, response: string): boolean {
    const ticketIndicators = [
      "contact support",
      "submit a ticket",
      "not sure",
      "can't help",
      "reach out",
      "technical issue",
      "bug",
      "error",
      "broken",
      "doesn't work",
    ];

    const lowerQuestion = question.toLowerCase();
    const lowerResponse = response.toLowerCase();

    // Show ticket prompt if question or response mentions issues
    return ticketIndicators.some(
      (indicator) => lowerQuestion.includes(indicator) || lowerResponse.includes(indicator),
    );
  }

  /**
   * Get a default campground ID for platform-level support
   * This uses the first available campground with AI enabled
   */
  private async getDefaultCampgroundId(): Promise<string> {
    const campground = await this.prisma.campground.findFirst({
      where: { aiEnabled: true },
      select: { id: true },
    });

    if (!campground) {
      // Use any campground as fallback
      const anyCampground = await this.prisma.campground.findFirst({
        select: { id: true },
      });
      if (!anyCampground) {
        throw new NotFoundException("No campgrounds available for AI support");
      }
      return anyCampground.id;
    }

    return campground.id;
  }
}
