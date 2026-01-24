import { Injectable, Logger } from "@nestjs/common";
import { Cron } from "@nestjs/schedule";
import { PrismaService } from "../prisma/prisma.service";

export interface SlowMovingProduct {
  productId: string;
  productName: string;
  sku: string | null;
  categoryId: string | null;
  categoryName: string | null;
  lastSaleDate: Date | null;
  daysSinceLastSale: number | null;
  qtyOnHand: number;
  valueCents: number;
  slowMovingThreshold: number;
}

@Injectable()
export class SlowMovingInventoryService {
  private readonly logger = new Logger(SlowMovingInventoryService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ==================== SCHEDULED JOBS ====================

  /**
   * Weekly job to identify slow-moving inventory.
   * Runs every Monday at 7:00 AM.
   */
  @Cron("0 7 * * 1", {
    name: "processSlowMovingAlerts",
    timeZone: "America/Chicago",
  })
  async processSlowMovingAlerts() {
    this.logger.log("Starting weekly slow-moving inventory analysis...");

    try {
      // Get all campgrounds with inventory tracking
      const campgrounds = await this.prisma.campground.findMany({
        where: {
          Product: {
            some: { trackInventory: true },
          },
        },
        select: { id: true, name: true },
      });

      for (const campground of campgrounds) {
        const slowMoving = await this.getSlowMovingProducts(campground.id);
        if (slowMoving.length > 0) {
          this.logger.log(`${campground.name}: Found ${slowMoving.length} slow-moving products`);
        }
      }

      this.logger.log("Slow-moving inventory analysis completed");
    } catch (error) {
      this.logger.error("Failed to process slow-moving alerts", error);
    }
  }

  // ==================== SLOW-MOVING DETECTION ====================

  /**
   * Get products that haven't sold within their slow-moving threshold.
   */
  async getSlowMovingProducts(
    campgroundId: string,
    options?: {
      categoryId?: string;
      minDaysSinceLastSale?: number;
      minValueCents?: number;
    },
  ): Promise<SlowMovingProduct[]> {
    const now = new Date();

    // Get products with their category thresholds
    const products = await this.prisma.product.findMany({
      where: {
        campgroundId,
        trackInventory: true,
        isActive: true,
        stockQty: { gt: 0 },
        ...(options?.categoryId ? { categoryId: options.categoryId } : {}),
      },
      include: {
        ProductCategory: {
          select: {
            id: true,
            name: true,
            defaultSlowMovingDays: true,
            CategoryExpirationConfig: { where: { campgroundId } },
          },
        },
        ProductExpirationConfig: { where: { campgroundId } },
      },
    });

    const slowMoving: SlowMovingProduct[] = [];

    for (const product of products) {
      // Determine the slow-moving threshold
      const productConfig = product.ProductExpirationConfig?.[0];
      const categoryConfig = product.ProductCategory?.CategoryExpirationConfig?.[0];

      const threshold =
        productConfig?.slowMovingDays ??
        categoryConfig?.slowMovingDays ??
        product.ProductCategory?.defaultSlowMovingDays ??
        30;

      // Calculate days since last sale
      let daysSinceLastSale: number | null = null;
      if (product.lastSaleDate) {
        daysSinceLastSale = Math.ceil(
          (now.getTime() - product.lastSaleDate.getTime()) / (1000 * 60 * 60 * 24),
        );
      }

      // Check if product is slow-moving
      // Products with no sales or sales older than threshold are slow-moving
      const isSlowMoving = daysSinceLastSale === null || daysSinceLastSale >= threshold;

      if (!isSlowMoving) continue;

      // Apply minimum days filter if specified
      if (
        options?.minDaysSinceLastSale &&
        daysSinceLastSale !== null &&
        daysSinceLastSale < options.minDaysSinceLastSale
      ) {
        continue;
      }

      const valueCents = product.stockQty * product.priceCents;

      // Apply minimum value filter if specified
      if (options?.minValueCents && valueCents < options.minValueCents) {
        continue;
      }

      slowMoving.push({
        productId: product.id,
        productName: product.name,
        sku: product.sku,
        categoryId: product.categoryId,
        categoryName: product.ProductCategory?.name ?? null,
        lastSaleDate: product.lastSaleDate,
        daysSinceLastSale,
        qtyOnHand: product.stockQty,
        valueCents,
        slowMovingThreshold: threshold,
      });
    }

    // Sort by days since last sale (longest first)
    slowMoving.sort((a, b) => {
      // Null (never sold) comes first
      if (a.daysSinceLastSale === null) return -1;
      if (b.daysSinceLastSale === null) return 1;
      return b.daysSinceLastSale - a.daysSinceLastSale;
    });

    return slowMoving;
  }

  /**
   * Get slow-moving inventory summary for dashboard.
   */
  async getSlowMovingSummary(campgroundId: string) {
    const slowMoving = await this.getSlowMovingProducts(campgroundId);

    const totalQty = slowMoving.reduce((sum, p) => sum + p.qtyOnHand, 0);
    const totalValue = slowMoving.reduce((sum, p) => sum + p.valueCents, 0);

    // Group by category
    const byCategory: Record<string, { count: number; qty: number; valueCents: number }> = {};
    for (const product of slowMoving) {
      const key = product.categoryName ?? "Uncategorized";
      if (!byCategory[key]) {
        byCategory[key] = { count: 0, qty: 0, valueCents: 0 };
      }
      byCategory[key].count++;
      byCategory[key].qty += product.qtyOnHand;
      byCategory[key].valueCents += product.valueCents;
    }

    // Top 10 by value
    const topByValue = slowMoving.sort((a, b) => b.valueCents - a.valueCents).slice(0, 10);

    // Products never sold
    const neverSold = slowMoving.filter((p) => p.lastSaleDate === null);

    return {
      totalProducts: slowMoving.length,
      totalQty,
      totalValueCents: totalValue,
      neverSoldCount: neverSold.length,
      byCategory,
      topByValue: topByValue.map((p) => ({
        productId: p.productId,
        productName: p.productName,
        sku: p.sku,
        qtyOnHand: p.qtyOnHand,
        valueCents: p.valueCents,
        daysSinceLastSale: p.daysSinceLastSale,
      })),
    };
  }

  /**
   * Get recommended actions for slow-moving inventory.
   */
  async getRecommendations(campgroundId: string) {
    const slowMoving = await this.getSlowMovingProducts(campgroundId);

    const recommendations: Array<{
      productId: string;
      productName: string;
      action: "markdown" | "bundle" | "return" | "donate" | "discontinue";
      reason: string;
      suggestedDiscount?: number;
    }> = [];

    for (const product of slowMoving) {
      // Never sold - consider returning to supplier or discontinuing
      if (product.lastSaleDate === null) {
        recommendations.push({
          productId: product.productId,
          productName: product.productName,
          action: "discontinue",
          reason: "Product has never sold. Consider returning to supplier or discontinuing.",
        });
        continue;
      }

      // Very slow (2x threshold) - aggressive markdown
      if (
        product.daysSinceLastSale &&
        product.daysSinceLastSale > product.slowMovingThreshold * 2
      ) {
        recommendations.push({
          productId: product.productId,
          productName: product.productName,
          action: "markdown",
          reason: `No sales in ${product.daysSinceLastSale} days. Consider significant price reduction.`,
          suggestedDiscount: 30,
        });
        continue;
      }

      // Moderately slow - smaller markdown or bundle
      if (product.valueCents > 5000) {
        // Higher value items - markdown
        recommendations.push({
          productId: product.productId,
          productName: product.productName,
          action: "markdown",
          reason: `No sales in ${product.daysSinceLastSale} days. Consider 15-20% discount.`,
          suggestedDiscount: 15,
        });
      } else {
        // Lower value items - bundle or donate
        recommendations.push({
          productId: product.productId,
          productName: product.productName,
          action: "bundle",
          reason: "Consider bundling with popular items or using as promotional giveaway.",
        });
      }
    }

    return recommendations.slice(0, 20); // Return top 20 recommendations
  }

  /**
   * Generate weekly email report content.
   */
  async generateWeeklyReportContent(campgroundId: string) {
    const summary = await this.getSlowMovingSummary(campgroundId);
    const recommendations = await this.getRecommendations(campgroundId);

    return {
      hasSlowMoving: summary.totalProducts > 0,
      subject:
        summary.totalProducts > 0
          ? `${summary.totalProducts} slow-moving items ($${(summary.totalValueCents / 100).toFixed(2)} tied up)`
          : "No slow-moving inventory this week",
      summary,
      recommendations: recommendations.slice(0, 10),
    };
  }
}
