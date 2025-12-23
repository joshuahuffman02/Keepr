import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { BatchInventoryService } from "../inventory/batch-inventory.service";
import { MarkdownRulesService } from "../inventory/markdown-rules.service";
import { ExpirationTier } from "@prisma/client";
import {
  ScanProductDto,
  ScanProductResponseDto,
} from "./dto/scan-product.dto";
import {
  RecordSaleDto,
  RecordSaleResponseDto,
  RecordRefundDto,
  RecordRefundResponseDto,
} from "./dto/record-sale.dto";

@Injectable()
export class PartnerApiService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly batchInventory: BatchInventoryService,
    private readonly markdownRules: MarkdownRulesService
  ) {}

  /**
   * Scan a product by SKU and return pricing/markdown/batch info
   */
  async scanProduct(
    campgroundId: string,
    dto: ScanProductDto
  ): Promise<ScanProductResponseDto> {
    // Find product by SKU
    const product = await this.prisma.product.findFirst({
      where: {
        campgroundId,
        sku: dto.sku,
        isActive: true,
      },
      include: {
        category: true,
      },
    });

    if (!product) {
      throw new NotFoundException(`Product with SKU '${dto.sku}' not found`);
    }

    const qty = dto.qty ?? 1;
    let batchId: string | null = null;
    let expirationDate: Date | null = null;
    let daysUntilExpiration: number | null = null;
    let expirationTier: ExpirationTier | null = null;
    let markdownApplied = false;
    let markdownDiscountCents = 0;
    let markdownRuleId: string | null = null;
    let requiresOverride = false;
    let warningMessage: string | null = null;
    let qtyAvailable = product.stockQty;

    // If batch tracking is enabled, get FEFO allocation preview
    if (product.useBatchTracking) {
      try {
        const allocation = await this.batchInventory.allocateFEFO(
          product.id,
          dto.locationId ?? null,
          qty,
          { previewOnly: true, allowExpired: dto.allowExpired }
        );

        if (allocation.length > 0) {
          const firstBatch = allocation[0];
          batchId = firstBatch.batchId;
          expirationDate = firstBatch.expirationDate;

          if (expirationDate) {
            const now = new Date();
            const diffMs = expirationDate.getTime() - now.getTime();
            daysUntilExpiration = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

            // Determine expiration tier
            const config = await this.getExpirationConfig(campgroundId, product.id, product.categoryId);
            if (daysUntilExpiration <= 0) {
              expirationTier = ExpirationTier.expired;
              requiresOverride = !dto.allowExpired;
              warningMessage = "This item has expired. Manager override required.";
            } else if (daysUntilExpiration <= config.criticalDays) {
              expirationTier = ExpirationTier.critical;
              warningMessage = `Item expires in ${daysUntilExpiration} day(s)`;
            } else if (daysUntilExpiration <= config.warningDays) {
              expirationTier = ExpirationTier.warning;
              warningMessage = `Item expires in ${daysUntilExpiration} day(s)`;
            } else {
              expirationTier = ExpirationTier.fresh;
            }

            // Check for markdown rules
            if (daysUntilExpiration > 0) {
              const markdown = await this.markdownRules.calculateMarkdown(
                campgroundId,
                product.id,
                product.categoryId,
                daysUntilExpiration
              );

              if (markdown) {
                markdownApplied = true;
                markdownDiscountCents = markdown.discountCents;
                markdownRuleId = markdown.ruleId;
              }
            }
          }

          qtyAvailable = allocation.reduce((sum, a) => sum + a.qty, 0);
        }
      } catch (err) {
        // If allocation fails (not enough stock), continue with standard pricing
        qtyAvailable = 0;
      }
    }

    const originalPriceCents = product.priceCents;
    const effectivePriceCents = Math.max(0, originalPriceCents - markdownDiscountCents);

    return {
      product: {
        id: product.id,
        sku: product.sku,
        name: product.name,
        category: product.category?.name ?? null,
      },
      unitPriceCents: effectivePriceCents,
      markdownApplied,
      originalPriceCents,
      markdownDiscountCents,
      effectivePriceCents,
      batchId,
      expirationDate: expirationDate?.toISOString() ?? null,
      daysUntilExpiration,
      expirationTier,
      useBatchTracking: product.useBatchTracking,
      requiresOverride,
      warningMessage,
      qtyAvailable,
    };
  }

  /**
   * Record a sale from an external POS system
   */
  async recordSale(
    campgroundId: string,
    apiClientId: string,
    dto: RecordSaleDto
  ): Promise<RecordSaleResponseDto> {
    // Check for duplicate transaction
    const existing = await this.prisma.externalPosSale.findUnique({
      where: {
        campgroundId_externalTransactionId: {
          campgroundId,
          externalTransactionId: dto.externalTransactionId,
        },
      },
    });

    if (existing) {
      throw new ConflictException(
        `Transaction '${dto.externalTransactionId}' already recorded`
      );
    }

    // Resolve SKUs to products
    const skus = dto.items.map((i) => i.sku);
    const products = await this.prisma.product.findMany({
      where: {
        campgroundId,
        sku: { in: skus },
        isActive: true,
      },
    });

    const productMap = new Map(products.map((p) => [p.sku, p]));

    // Validate all SKUs exist
    for (const item of dto.items) {
      if (!productMap.has(item.sku)) {
        throw new BadRequestException(`Product with SKU '${item.sku}' not found`);
      }
    }

    // Calculate total
    const totalCents = dto.items.reduce(
      (sum, item) => sum + item.priceCents * item.qty,
      0
    );

    // Record the sale and deduct inventory in a transaction
    const result = await this.prisma.$transaction(async (tx) => {
      // Create the external POS sale record
      const sale = await tx.externalPosSale.create({
        data: {
          campgroundId,
          externalTransactionId: dto.externalTransactionId,
          provider: "partner_api",
          apiClientId,
          items: dto.items,
          totalCents,
          paymentMethod: dto.paymentMethod,
          locationId: dto.locationId,
          saleDate: new Date(),
          metadata: dto.metadata,
          inventoryDeducted: false,
        },
      });

      const deductionResults: Array<{
        sku: string;
        qtyDeducted: number;
        batchId: string | null;
        remainingInBatch: number | null;
      }> = [];

      // Deduct inventory for each item
      for (const item of dto.items) {
        const product = productMap.get(item.sku)!;

        if (product.useBatchTracking) {
          // Use FEFO allocation
          try {
            const allocations = await this.batchInventory.allocateFEFO(
              product.id,
              dto.locationId ?? null,
              item.qty
            );

            // Deduct from all allocated batches
            // Note: deductFromBatches creates its own transaction, so we call it outside the outer tx
            // For now, we'll handle the deduction results tracking here
            for (const alloc of allocations) {
              // Get current batch state before deduction
              const batchBefore = await tx.inventoryBatch.findUnique({
                where: { id: alloc.batchId },
              });

              if (batchBefore) {
                const newQty = Math.max(0, batchBefore.qtyRemaining - alloc.qty);

                // Update batch
                await tx.inventoryBatch.update({
                  where: { id: alloc.batchId },
                  data: {
                    qtyRemaining: newQty,
                    isActive: newQty > 0,
                    depletedAt: newQty <= 0 ? new Date() : null,
                  },
                });

                // Create inventory movement
                await tx.inventoryMovement.create({
                  data: {
                    campgroundId,
                    productId: product.id,
                    locationId: dto.locationId,
                    batchId: alloc.batchId,
                    movementType: "sale",
                    qty: -alloc.qty,
                    previousQty: batchBefore.qtyRemaining,
                    newQty,
                    referenceType: "external_pos_sale",
                    referenceId: sale.id,
                  },
                });

                deductionResults.push({
                  sku: item.sku,
                  qtyDeducted: alloc.qty,
                  batchId: alloc.batchId,
                  remainingInBatch: newQty,
                });
              }
            }
          } catch (err) {
            // If batch allocation fails, fall back to simple deduction
            await this.deductSimpleInventory(tx, product.id, dto.locationId, item.qty);
            deductionResults.push({
              sku: item.sku,
              qtyDeducted: item.qty,
              batchId: null,
              remainingInBatch: null,
            });
          }
        } else {
          // Simple inventory deduction
          await this.deductSimpleInventory(tx, product.id, dto.locationId, item.qty);
          deductionResults.push({
            sku: item.sku,
            qtyDeducted: item.qty,
            batchId: null,
            remainingInBatch: null,
          });
        }

        // Update lastSaleDate
        await tx.product.update({
          where: { id: product.id },
          data: { lastSaleDate: new Date() },
        });
      }

      // Mark inventory as deducted
      await tx.externalPosSale.update({
        where: { id: sale.id },
        data: { inventoryDeducted: true },
      });

      return {
        sale,
        deductionResults,
      };
    });

    return {
      saleId: result.sale.id,
      externalTransactionId: dto.externalTransactionId,
      inventoryDeducted: true,
      items: result.deductionResults,
      totalCents,
    };
  }

  /**
   * Record a refund for a previous sale
   */
  async recordRefund(
    campgroundId: string,
    saleId: string,
    dto: RecordRefundDto
  ): Promise<RecordRefundResponseDto> {
    const sale = await this.prisma.externalPosSale.findFirst({
      where: {
        id: saleId,
        campgroundId,
      },
    });

    if (!sale) {
      throw new NotFoundException(`Sale '${saleId}' not found`);
    }

    // Resolve SKUs to products
    const skus = dto.items.map((i) => i.sku);
    const products = await this.prisma.product.findMany({
      where: {
        campgroundId,
        sku: { in: skus },
      },
    });

    const productMap = new Map(products.map((p) => [p.sku, p]));

    const restoredItems: Array<{ sku: string; qtyRestored: number }> = [];

    await this.prisma.$transaction(async (tx) => {
      for (const item of dto.items) {
        const product = productMap.get(item.sku);
        if (!product) {
          throw new BadRequestException(`Product with SKU '${item.sku}' not found`);
        }

        if (product.useBatchTracking && item.batchId) {
          // Restore to specific batch
          const batch = await tx.inventoryBatch.findUnique({
            where: { id: item.batchId },
          });

          if (batch) {
            const newQty = batch.qtyRemaining + item.qty;

            await tx.inventoryBatch.update({
              where: { id: item.batchId },
              data: {
                qtyRemaining: newQty,
                isActive: true, // Reactivate if depleted
                depletedAt: null,
              },
            });

            // Create inventory movement for audit
            await tx.inventoryMovement.create({
              data: {
                campgroundId,
                productId: product.id,
                locationId: batch.locationId,
                batchId: item.batchId,
                movementType: "return",
                qty: item.qty,
                previousQty: batch.qtyRemaining,
                newQty,
                referenceType: "external_pos_refund",
                referenceId: saleId,
                notes: dto.reason,
              },
            });
          }
        } else {
          // Simple inventory restoration
          await this.restoreSimpleInventory(tx, product.id, sale.locationId, item.qty);
        }

        restoredItems.push({
          sku: item.sku,
          qtyRestored: item.qty,
        });
      }
    });

    return {
      refundId: `refund_${saleId}_${Date.now()}`,
      originalSaleId: saleId,
      inventoryRestored: true,
      items: restoredItems,
    };
  }

  /**
   * List products with optional filtering
   */
  async listProducts(
    campgroundId: string,
    options?: {
      categoryId?: string;
      search?: string;
      limit?: number;
      offset?: number;
    }
  ) {
    const where: any = {
      campgroundId,
      isActive: true,
    };

    if (options?.categoryId) {
      where.categoryId = options.categoryId;
    }

    if (options?.search) {
      where.OR = [
        { name: { contains: options.search, mode: "insensitive" } },
        { sku: { contains: options.search, mode: "insensitive" } },
      ];
    }

    const [products, total] = await Promise.all([
      this.prisma.product.findMany({
        where,
        include: { category: true },
        take: options?.limit ?? 100,
        skip: options?.offset ?? 0,
        orderBy: { name: "asc" },
      }),
      this.prisma.product.count({ where }),
    ]);

    return {
      products: products.map((p) => ({
        id: p.id,
        sku: p.sku,
        name: p.name,
        description: p.description,
        priceCents: p.priceCents,
        category: p.category?.name ?? null,
        stockQty: p.stockQty,
        useBatchTracking: p.useBatchTracking,
        isActive: p.isActive,
      })),
      total,
      limit: options?.limit ?? 100,
      offset: options?.offset ?? 0,
    };
  }

  /**
   * Get product by SKU with batch info
   */
  async getProductBySku(campgroundId: string, sku: string) {
    const product = await this.prisma.product.findFirst({
      where: { campgroundId, sku, isActive: true },
      include: {
        category: true,
        inventoryBatches: {
          where: { isActive: true, qtyRemaining: { gt: 0 } },
          orderBy: [{ expirationDate: "asc" }, { receivedDate: "asc" }],
        },
      },
    });

    if (!product) {
      throw new NotFoundException(`Product with SKU '${sku}' not found`);
    }

    return {
      id: product.id,
      sku: product.sku,
      name: product.name,
      description: product.description,
      priceCents: product.priceCents,
      category: product.category?.name ?? null,
      stockQty: product.stockQty,
      useBatchTracking: product.useBatchTracking,
      batches: product.useBatchTracking
        ? product.inventoryBatches.map((b) => ({
            id: b.id,
            batchNumber: b.batchNumber,
            qtyRemaining: b.qtyRemaining,
            expirationDate: b.expirationDate?.toISOString() ?? null,
            receivedDate: b.receivedDate.toISOString(),
          }))
        : [],
    };
  }

  /**
   * Get expiring inventory summary
   */
  async getExpiringInventory(campgroundId: string) {
    const now = new Date();
    const sevenDays = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    const twoDays = new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000);

    const batches = await this.prisma.inventoryBatch.findMany({
      where: {
        campgroundId,
        isActive: true,
        qtyRemaining: { gt: 0 },
        expirationDate: { not: null, lte: sevenDays },
      },
      include: {
        product: { select: { id: true, sku: true, name: true } },
        location: { select: { id: true, name: true } },
      },
      orderBy: { expirationDate: "asc" },
    });

    const summary = {
      expired: [] as any[],
      critical: [] as any[],
      warning: [] as any[],
    };

    for (const batch of batches) {
      if (!batch.expirationDate) continue;

      const item = {
        batchId: batch.id,
        productId: batch.product.id,
        productSku: batch.product.sku,
        productName: batch.product.name,
        qtyRemaining: batch.qtyRemaining,
        expirationDate: batch.expirationDate.toISOString(),
        locationId: batch.location?.id ?? null,
        locationName: batch.location?.name ?? null,
      };

      if (batch.expirationDate <= now) {
        summary.expired.push(item);
      } else if (batch.expirationDate <= twoDays) {
        summary.critical.push(item);
      } else {
        summary.warning.push(item);
      }
    }

    return {
      summary: {
        expiredCount: summary.expired.length,
        criticalCount: summary.critical.length,
        warningCount: summary.warning.length,
      },
      expired: summary.expired,
      critical: summary.critical,
      warning: summary.warning,
    };
  }

  // Private helpers

  private async getExpirationConfig(
    campgroundId: string,
    productId: string,
    categoryId: string | null
  ) {
    // Check product-level config
    const productConfig = await this.prisma.productExpirationConfig.findFirst({
      where: { campgroundId, productId },
    });

    if (productConfig) {
      return {
        warningDays: productConfig.warningDays ?? 7,
        criticalDays: productConfig.criticalDays ?? 2,
      };
    }

    // Check category-level config
    if (categoryId) {
      const categoryConfig = await this.prisma.categoryExpirationConfig.findFirst({
        where: { campgroundId, categoryId },
      });

      if (categoryConfig) {
        return {
          warningDays: categoryConfig.warningDays,
          criticalDays: categoryConfig.criticalDays,
        };
      }
    }

    // Default values
    return { warningDays: 7, criticalDays: 2 };
  }

  private async deductSimpleInventory(
    tx: any,
    productId: string,
    locationId: string | null | undefined,
    qty: number
  ) {
    if (locationId) {
      await tx.locationInventory.updateMany({
        where: { productId, locationId },
        data: { stockQty: { decrement: qty } },
      });
    } else {
      await tx.product.update({
        where: { id: productId },
        data: { stockQty: { decrement: qty } },
      });
    }
  }

  private async restoreSimpleInventory(
    tx: any,
    productId: string,
    locationId: string | null | undefined,
    qty: number
  ) {
    if (locationId) {
      await tx.locationInventory.updateMany({
        where: { productId, locationId },
        data: { stockQty: { increment: qty } },
      });
    } else {
      await tx.product.update({
        where: { id: productId },
        data: { stockQty: { increment: qty } },
      });
    }
  }
}
