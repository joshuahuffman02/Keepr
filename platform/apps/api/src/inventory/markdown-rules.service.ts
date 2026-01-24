import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from "@nestjs/common";
import crypto from "node:crypto";
import { Prisma, MarkdownScope, MarkdownDiscountType } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { WebhookService } from "../developer-api/webhook.service";
import {
  CreateMarkdownRuleDto,
  UpdateMarkdownRuleDto,
  MarkdownCalculation,
  MarkdownPreview,
} from "./dto/markdown.dto";

@Injectable()
export class MarkdownRulesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly webhookService: WebhookService,
  ) {}

  // ==================== RULE CRUD ====================

  async createRule(campgroundId: string, dto: CreateMarkdownRuleDto, actorUserId: string) {
    // Validate scope-specific fields
    if (dto.scope === MarkdownScope.category && !dto.categoryId) {
      throw new BadRequestException("categoryId is required for category scope");
    }
    if (dto.scope === MarkdownScope.product && !dto.productId) {
      throw new BadRequestException("productId is required for product scope");
    }

    // Validate discount value for percentage type
    if (dto.discountType === MarkdownDiscountType.percentage && dto.discountValue > 100) {
      throw new BadRequestException("Percentage discount cannot exceed 100%");
    }

    return this.prisma.markdownRule.create({
      data: {
        id: crypto.randomUUID(),
        campgroundId,
        daysUntilExpiration: dto.daysUntilExpiration,
        discountType: dto.discountType,
        discountValue: dto.discountValue,
        scope: dto.scope,
        categoryId: dto.scope === MarkdownScope.category ? dto.categoryId : null,
        productId: dto.scope === MarkdownScope.product ? dto.productId : null,
        priority: dto.priority ?? 100,
        isActive: dto.isActive ?? true,
        createdById: actorUserId,
      },
    });
  }

  async getRule(id: string, campgroundId: string) {
    const rule = await this.prisma.markdownRule.findUnique({
      where: { id },
      include: {
        ProductCategory: { select: { id: true, name: true } },
        Product: { select: { id: true, name: true } },
      },
    });
    if (!rule) throw new NotFoundException("Markdown rule not found");
    if (rule.campgroundId !== campgroundId) {
      throw new ForbiddenException("Access denied to this markdown rule");
    }
    return rule;
  }

  async listRules(campgroundId: string, includeInactive = false) {
    return this.prisma.markdownRule.findMany({
      where: {
        campgroundId,
        ...(includeInactive ? {} : { isActive: true }),
      },
      include: {
        ProductCategory: { select: { id: true, name: true } },
        Product: { select: { id: true, name: true } },
      },
      orderBy: [{ priority: "asc" }, { daysUntilExpiration: "desc" }],
    });
  }

  async updateRule(id: string, campgroundId: string, dto: UpdateMarkdownRuleDto) {
    const rule = await this.prisma.markdownRule.findUnique({ where: { id } });
    if (!rule) throw new NotFoundException("Markdown rule not found");
    if (rule.campgroundId !== campgroundId) {
      throw new ForbiddenException("Access denied to this markdown rule");
    }

    // Validate discount value for percentage type
    const discountType = dto.discountType ?? rule.discountType;
    const discountValue = dto.discountValue ?? rule.discountValue;
    if (discountType === MarkdownDiscountType.percentage && discountValue > 100) {
      throw new BadRequestException("Percentage discount cannot exceed 100%");
    }

    return this.prisma.markdownRule.update({
      where: { id },
      data: dto,
    });
  }

  async deleteRule(id: string, campgroundId: string) {
    const rule = await this.prisma.markdownRule.findUnique({ where: { id } });
    if (!rule) throw new NotFoundException("Markdown rule not found");
    if (rule.campgroundId !== campgroundId) {
      throw new ForbiddenException("Access denied to this markdown rule");
    }

    return this.prisma.markdownRule.delete({ where: { id } });
  }

  // ==================== MARKDOWN CALCULATION ====================

  /**
   * Calculate markdown for a product/batch at POS time.
   * Returns the best applicable markdown based on batch expiration.
   */
  async calculateMarkdown(
    campgroundId: string,
    productId: string,
    batchId: string | null,
    basePriceCents: number,
  ): Promise<MarkdownCalculation> {
    const noMarkdown: MarkdownCalculation = {
      applies: false,
      originalPriceCents: basePriceCents,
      markdownPriceCents: basePriceCents,
      discountCents: 0,
      discountPercent: 0,
      ruleId: null,
      daysUntilExpiration: null,
      batchId,
    };

    // If no batch, no markdown applies
    if (!batchId) return noMarkdown;

    // Get batch and its expiration date
    const batch = await this.prisma.inventoryBatch.findUnique({
      where: { id: batchId },
      include: {
        Product: {
          include: { ProductCategory: true },
        },
      },
    });

    if (!batch || !batch.expirationDate) return noMarkdown;

    // Calculate days until expiration
    const now = new Date();
    const daysUntilExpiration = Math.ceil(
      (batch.expirationDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
    );

    // Get applicable rules (ordered by priority, then days threshold)
    const rules = await this.prisma.markdownRule.findMany({
      where: {
        campgroundId,
        isActive: true,
        daysUntilExpiration: { gte: daysUntilExpiration },
        OR: [
          { scope: MarkdownScope.all },
          {
            scope: MarkdownScope.category,
            categoryId: batch.Product.categoryId,
          },
          {
            scope: MarkdownScope.product,
            productId,
          },
        ],
      },
      orderBy: [
        { priority: "asc" },
        { daysUntilExpiration: "asc" }, // More specific (fewer days) takes precedence
      ],
    });

    if (rules.length === 0) return noMarkdown;

    // Apply the highest priority matching rule
    const rule = rules[0];
    let discountCents: number;

    if (rule.discountType === MarkdownDiscountType.percentage) {
      discountCents = Math.round((basePriceCents * rule.discountValue) / 100);
    } else {
      discountCents = rule.discountValue;
    }

    // Ensure we don't go below 0
    discountCents = Math.min(discountCents, basePriceCents);

    return {
      applies: true,
      originalPriceCents: basePriceCents,
      markdownPriceCents: basePriceCents - discountCents,
      discountCents,
      discountPercent: Math.round((discountCents / basePriceCents) * 100),
      ruleId: rule.id,
      daysUntilExpiration,
      batchId,
    };
  }

  /**
   * Compare markdown with other promotions and return the best discount.
   * User decision: "Take best discount"
   */
  async getBestDiscount(
    campgroundId: string,
    productId: string,
    batchId: string | null,
    basePriceCents: number,
    existingPromotionDiscountCents: number,
  ): Promise<{
    source: "markdown" | "promotion" | "none";
    discountCents: number;
    markdownRuleId: string | null;
    daysUntilExpiration: number | null;
  }> {
    const markdown = await this.calculateMarkdown(campgroundId, productId, batchId, basePriceCents);

    // Compare and take the best
    if (!markdown.applies && existingPromotionDiscountCents <= 0) {
      return {
        source: "none",
        discountCents: 0,
        markdownRuleId: null,
        daysUntilExpiration: null,
      };
    }

    if (markdown.discountCents >= existingPromotionDiscountCents) {
      return {
        source: "markdown",
        discountCents: markdown.discountCents,
        markdownRuleId: markdown.ruleId,
        daysUntilExpiration: markdown.daysUntilExpiration,
      };
    }

    return {
      source: "promotion",
      discountCents: existingPromotionDiscountCents,
      markdownRuleId: null,
      daysUntilExpiration: markdown.daysUntilExpiration,
    };
  }

  /**
   * Record a markdown application for reporting.
   */
  async recordMarkdownApplication(
    campgroundId: string,
    ruleId: string,
    batchId: string,
    cartId: string | null,
    originalPriceCents: number,
    markdownPriceCents: number,
    qty: number,
    daysUntilExpiration: number,
  ) {
    // Get batch and product info for webhook
    const batch = await this.prisma.inventoryBatch.findUnique({
      where: { id: batchId },
      include: {
        Product: { select: { id: true, name: true, sku: true } },
      },
    });

    const application = await this.prisma.markdownApplication.create({
      data: {
        id: crypto.randomUUID(),
        campgroundId,
        markdownRuleId: ruleId,
        batchId,
        cartId,
        originalPriceCents,
        markdownPriceCents,
        discountCents: originalPriceCents - markdownPriceCents,
        qty,
        daysUntilExpiration,
      },
    });

    // Emit webhook event for markdown application
    if (batch) {
      await this.webhookService.emit("markdown.rule.applied", campgroundId, {
        applicationId: application.id,
        ruleId,
        batchId,
        productId: batch.productId,
        productSku: batch.Product.sku,
        productName: batch.Product.name,
        originalPriceCents,
        markdownPriceCents,
        discountCents: originalPriceCents - markdownPriceCents,
        discountPercent: Math.round(
          ((originalPriceCents - markdownPriceCents) / originalPriceCents) * 100,
        ),
        qty,
        daysUntilExpiration,
      });
    }

    return application;
  }

  // ==================== PREVIEW & REPORTING ====================

  /**
   * Preview which items currently have markdown applied.
   * Useful for dashboard/reports.
   */
  async getMarkdownPreview(campgroundId: string): Promise<MarkdownPreview[]> {
    const now = new Date();
    const previews: MarkdownPreview[] = [];

    // Get all active batches with expiration dates
    const batches = await this.prisma.inventoryBatch.findMany({
      where: {
        campgroundId,
        isActive: true,
        qtyRemaining: { gt: 0 },
        expirationDate: { not: null },
      },
      include: {
        Product: {
          select: { id: true, name: true, priceCents: true },
        },
      },
    });

    for (const batch of batches) {
      const markdown = await this.calculateMarkdown(
        campgroundId,
        batch.productId,
        batch.id,
        batch.Product.priceCents,
      );

      if (markdown.applies && markdown.ruleId) {
        const rule = await this.prisma.markdownRule.findUnique({
          where: { id: markdown.ruleId },
          select: { priority: true },
        });

        previews.push({
          batchId: batch.id,
          productId: batch.productId,
          productName: batch.Product.name,
          expirationDate: batch.expirationDate,
          daysUntilExpiration: markdown.daysUntilExpiration,
          qtyRemaining: batch.qtyRemaining,
          originalPriceCents: batch.Product.priceCents,
          markdownPriceCents: markdown.markdownPriceCents,
          discountCents: markdown.discountCents,
          discountPercent: markdown.discountPercent,
          ruleId: markdown.ruleId,
          rulePriority: rule?.priority ?? 100,
        });
      }
    }

    // Sort by days until expiration (most urgent first)
    previews.sort((a, b) => (a.daysUntilExpiration ?? 999) - (b.daysUntilExpiration ?? 999));

    return previews;
  }

  /**
   * Get markdown report data for a date range.
   */
  async getMarkdownReport(campgroundId: string, startDate: Date, endDate: Date) {
    const applications = await this.prisma.markdownApplication.findMany({
      where: {
        campgroundId,
        createdAt: {
          gte: startDate,
          lte: endDate,
        },
      },
      include: {
        MarkdownRule: true,
        InventoryBatch: {
          include: {
            Product: { select: { name: true, categoryId: true } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    // Aggregate stats
    const totalDiscountCents = applications.reduce((sum, a) => sum + a.discountCents * a.qty, 0);
    const totalUnits = applications.reduce((sum, a) => sum + a.qty, 0);
    const uniqueProducts = new Set(applications.map((a) => a.InventoryBatch.productId)).size;

    return {
      applications,
      summary: {
        totalDiscountCents,
        totalUnits,
        uniqueProducts,
        applicationCount: applications.length,
      },
    };
  }
}
