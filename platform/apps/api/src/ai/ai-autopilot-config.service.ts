import { Injectable, Logger, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { CreateContextItemDto, UpdateContextItemDto, UpdateAutopilotConfigDto } from "./dto/autopilot.dto";

@Injectable()
export class AiAutopilotConfigService {
  private readonly logger = new Logger(AiAutopilotConfigService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ==================== CONFIG CRUD ====================

  /**
   * Get autopilot config for a campground, creating default if doesn't exist
   */
  async getConfig(campgroundId: string) {
    let config = await this.prisma.aiAutopilotConfig.findUnique({
      where: { campgroundId },
    });

    if (!config) {
      config = await this.prisma.aiAutopilotConfig.create({
        data: { campgroundId },
      });
    }

    return config;
  }

  /**
   * Update autopilot config for a campground
   */
  async updateConfig(campgroundId: string, updates: UpdateAutopilotConfigDto) {
    // Ensure config exists
    await this.getConfig(campgroundId);

    return this.prisma.aiAutopilotConfig.update({
      where: { campgroundId },
      data: updates,
    });
  }

  // ==================== CONTEXT CRUD ====================

  /**
   * Get all context items for a campground
   */
  async getContextItems(campgroundId: string, type?: string, category?: string, activeOnly = true) {
    const where: any = { campgroundId };
    if (type) where.type = type;
    if (category) where.category = category;
    if (activeOnly) where.isActive = true;

    return this.prisma.aiCampgroundContext.findMany({
      where,
      orderBy: [{ priority: "desc" }, { createdAt: "desc" }],
    });
  }

  /**
   * Create a new context item
   */
  async createContextItem(campgroundId: string, data: CreateContextItemDto) {
    return this.prisma.aiCampgroundContext.create({
      data: {
        campgroundId,
        ...data,
        source: "manual",
      },
    });
  }

  /**
   * Update a context item
   */
  async updateContextItem(id: string, updates: UpdateContextItemDto) {
    const item = await this.prisma.aiCampgroundContext.findUnique({ where: { id } });
    if (!item) throw new NotFoundException("Context item not found");

    return this.prisma.aiCampgroundContext.update({
      where: { id },
      data: updates,
    });
  }

  /**
   * Delete a context item
   */
  async deleteContextItem(id: string) {
    const item = await this.prisma.aiCampgroundContext.findUnique({ where: { id } });
    if (!item) throw new NotFoundException("Context item not found");

    await this.prisma.aiCampgroundContext.delete({ where: { id } });
    return { success: true };
  }

  // ==================== AUTO-POPULATE ====================

  /**
   * Auto-populate context from existing campground data
   */
  async autoPopulateContext(campgroundId: string) {
    const campground = await this.prisma.campground.findUnique({
      where: { id: campgroundId },
      include: {
        siteClasses: {
          where: { deletedAt: null },
          select: { name: true, amenities: true, description: true },
        },
      },
    });

    if (!campground) throw new NotFoundException("Campground not found");

    const contextItems: Array<{
      type: string;
      question?: string;
      answer: string;
      category: string;
      priority: number;
    }> = [];

    // Check-in/Check-out times
    if (campground.checkInTime || campground.checkOutTime) {
      contextItems.push({
        type: "faq",
        question: "What are the check-in and check-out times?",
        answer: `Check-in time is ${campground.checkInTime || "3:00 PM"} and check-out time is ${campground.checkOutTime || "11:00 AM"}.`,
        category: "check_in",
        priority: 100,
      });
    }

    // Office hours
    if (campground.officeClosesAt) {
      contextItems.push({
        type: "faq",
        question: "What are the office hours?",
        answer: `Our office closes at ${campground.officeClosesAt}. Please plan your arrival accordingly.`,
        category: "check_in",
        priority: 90,
      });
    }

    // Cancellation policy
    if (campground.cancellationPolicyType) {
      let policyText = `Our cancellation policy is: ${campground.cancellationPolicyType}.`;
      if (campground.cancellationWindowHours) {
        policyText += ` Cancellations must be made at least ${campground.cancellationWindowHours} hours before arrival.`;
      }
      if (campground.cancellationFeeType === "flat" && campground.cancellationFeeFlatCents) {
        policyText += ` A cancellation fee of $${(campground.cancellationFeeFlatCents / 100).toFixed(2)} applies.`;
      } else if (campground.cancellationFeeType === "percent" && campground.cancellationFeePercent) {
        policyText += ` A cancellation fee of ${campground.cancellationFeePercent}% of the booking total applies.`;
      } else if (campground.cancellationFeeType === "first_night") {
        policyText += ` The first night's rate is non-refundable.`;
      }

      contextItems.push({
        type: "policy",
        answer: policyText,
        category: "cancellation",
        priority: 95,
      });

      contextItems.push({
        type: "faq",
        question: "What is your cancellation policy?",
        answer: policyText,
        category: "cancellation",
        priority: 95,
      });
    }

    // Pet policy
    if (campground.petPolicy) {
      contextItems.push({
        type: "policy",
        answer: campground.petPolicy,
        category: "pets",
        priority: 85,
      });

      contextItems.push({
        type: "faq",
        question: "Are pets allowed?",
        answer: campground.petPolicy,
        category: "pets",
        priority: 85,
      });
    }

    // Deposit/payment policy
    if (campground.depositRule && campground.depositRule !== "none") {
      let depositText = "";
      switch (campground.depositRule) {
        case "full":
          depositText = "Full payment is required at the time of booking.";
          break;
        case "half":
          depositText = "A 50% deposit is required at booking, with the balance due at check-in.";
          break;
        case "first_night":
          depositText = "The first night's rate is required as a deposit at booking.";
          break;
        case "first_night_fees":
          depositText = "The first night's rate plus fees is required as a deposit at booking.";
          break;
        case "percentage":
          depositText = `A ${campground.depositPercentage || 50}% deposit is required at booking.`;
          break;
      }

      if (depositText) {
        contextItems.push({
          type: "policy",
          answer: depositText,
          category: "payment",
          priority: 80,
        });

        contextItems.push({
          type: "faq",
          question: "What is the deposit or payment policy?",
          answer: depositText,
          category: "payment",
          priority: 80,
        });
      }
    }

    // Site types/amenities
    for (const siteClass of campground.siteClasses) {
      if (siteClass.description) {
        contextItems.push({
          type: "faq",
          question: `What amenities are included with ${siteClass.name} sites?`,
          answer: siteClass.description,
          category: "amenities",
          priority: 70,
        });
      }

      if (siteClass.amenities && Array.isArray(siteClass.amenities) && siteClass.amenities.length > 0) {
        const amenitiesList = (siteClass.amenities as string[]).join(", ");
        contextItems.push({
          type: "faq",
          question: `What amenities do ${siteClass.name} sites have?`,
          answer: `${siteClass.name} sites include: ${amenitiesList}.`,
          category: "amenities",
          priority: 70,
        });
      }
    }

    // Quiet hours
    if (campground.quietHoursStart && campground.quietHoursEnd) {
      contextItems.push({
        type: "policy",
        answer: `Quiet hours are from ${campground.quietHoursStart} to ${campground.quietHoursEnd}. Please respect your fellow campers during these times.`,
        category: "rules",
        priority: 75,
      });

      contextItems.push({
        type: "faq",
        question: "What are the quiet hours?",
        answer: `Quiet hours are from ${campground.quietHoursStart} to ${campground.quietHoursEnd}.`,
        category: "rules",
        priority: 75,
      });
    }

    // Create all context items
    const created = await Promise.all(
      contextItems.map((item) =>
        this.prisma.aiCampgroundContext.create({
          data: {
            campgroundId,
            ...item,
            source: "auto_import",
          },
        })
      )
    );

    this.logger.log(`Auto-populated ${created.length} context items for campground ${campgroundId}`);

    return {
      success: true,
      created: created.length,
      items: created,
    };
  }

  /**
   * Get summary of all context for building AI prompts
   */
  async buildContextSummary(campgroundId: string): Promise<string> {
    const items = await this.getContextItems(campgroundId, undefined, undefined, true);

    if (items.length === 0) {
      return "No specific campground context available.";
    }

    const sections: string[] = [];

    // Group by type
    const faqs = items.filter((i) => i.type === "faq");
    const policies = items.filter((i) => i.type === "policy");
    const trainingExamples = items.filter((i) => i.type === "training_example");

    if (policies.length > 0) {
      sections.push("## Campground Policies\n" + policies.map((p) => `- ${p.answer}`).join("\n"));
    }

    if (faqs.length > 0) {
      sections.push(
        "## Frequently Asked Questions\n" +
          faqs
            .map((f) => `Q: ${f.question}\nA: ${f.answer}`)
            .join("\n\n")
      );
    }

    if (trainingExamples.length > 0) {
      sections.push(
        "## Example Responses\n" +
          trainingExamples
            .map((t) => `Guest: ${t.question}\nResponse: ${t.answer}`)
            .join("\n\n")
      );
    }

    return sections.join("\n\n");
  }
}
