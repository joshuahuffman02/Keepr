import { Injectable, Logger, NotFoundException, BadRequestException } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import {
  PosProviderType,
  PosIntegrationStatus,
  Prisma,
  type PosProviderIntegration,
} from "@prisma/client";
import { randomUUID } from "crypto";
import { PrismaService } from "../prisma/prisma.service";
import { PosProviderRegistry } from "./pos-provider.registry";
import { BatchInventoryService } from "../inventory/batch-inventory.service";
import {
  ExternalProduct,
  ExternalSale,
  ExternalSyncResult,
  IntegrationRecord,
} from "./pos-provider.types";

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const isJsonValue = (value: unknown): value is Prisma.InputJsonValue => {
  if (value === null) return true;
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean")
    return true;
  if (Array.isArray(value)) return value.every(isJsonValue);
  if (isRecord(value)) return Object.values(value).every(isJsonValue);
  return false;
};

const toNullableJsonInput = (
  value: unknown,
): Prisma.InputJsonValue | Prisma.NullableJsonNullValueInput | undefined => {
  if (value === undefined) return undefined;
  if (value === null) return Prisma.JsonNull;
  return isJsonValue(value) ? value : undefined;
};

const toRecord = (value: unknown): Record<string, unknown> => (isRecord(value) ? value : {});

const toStringRecord = (value: unknown): Record<string, string> => {
  if (!isRecord(value)) return {};
  const result: Record<string, string> = {};
  for (const [key, entry] of Object.entries(value)) {
    if (typeof entry === "string") {
      result[key] = entry;
    }
  }
  return result;
};

const getErrorMessage = (error: unknown) =>
  error instanceof Error ? error.message : "Unknown error";

interface SyncJob {
  id: string;
  campgroundId: string;
  integrationId: string;
  provider: PosProviderType;
  type: "products" | "inventory" | "sales";
  status: "pending" | "running" | "completed" | "failed";
  startedAt?: Date;
  completedAt?: Date;
  itemsProcessed: number;
  itemsFailed: number;
  errors: string[];
}

@Injectable()
export class InventorySyncService {
  private readonly logger = new Logger(InventorySyncService.name);
  private readonly activeJobs = new Map<string, SyncJob>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly registry: PosProviderRegistry,
    private readonly batchInventory: BatchInventoryService,
  ) {}

  private buildIntegrationRecord(integration: PosProviderIntegration): IntegrationRecord {
    const locations = toStringRecord(integration.locations);
    const devices = toStringRecord(integration.devices);

    return {
      id: integration.id,
      campgroundId: integration.campgroundId,
      provider: integration.provider,
      displayName: integration.displayName,
      status: integration.status,
      capabilities: integration.capabilities,
      credentials: toRecord(integration.credentials),
      locations: Object.keys(locations).length > 0 ? locations : undefined,
      devices: Object.keys(devices).length > 0 ? devices : undefined,
      webhookSecret: integration.webhookSecret,
    };
  }

  // ==================== SCHEDULED SYNC ====================

  /**
   * Hourly job to sync sales from external POS systems.
   * This pulls sales data and deducts inventory accordingly.
   */
  @Cron(CronExpression.EVERY_HOUR, {
    name: "syncExternalPosSales",
    timeZone: "America/Chicago",
  })
  async syncExternalPosSales() {
    this.logger.log("Starting hourly external POS sales sync...");

    try {
      // Get all active POS integrations that support inventory sync
      const integrations = await this.prisma.posProviderIntegration.findMany({
        where: {
          status: PosIntegrationStatus.enabled,
          capabilities: { hasSome: ["inventory_pull"] },
        },
      });

      for (const integration of integrations) {
        try {
          await this.syncSalesFromProvider(integration.campgroundId, integration.id);
        } catch (error: unknown) {
          this.logger.error(
            `Failed to sync sales for integration ${integration.id}: ${getErrorMessage(error)}`,
          );
        }
      }

      this.logger.log("External POS sales sync completed");
    } catch (error) {
      this.logger.error("Failed to run external POS sales sync", error);
    }
  }

  // ==================== PRODUCT SYNC ====================

  /**
   * Fetch products from external POS and create product mappings.
   */
  async syncProductsFromProvider(
    campgroundId: string,
    integrationId: string,
  ): Promise<{
    imported: number;
    updated: number;
    failed: number;
    products: ExternalProduct[];
  }> {
    const integration = await this.prisma.posProviderIntegration.findUnique({
      where: { id: integrationId },
    });

    if (!integration || integration.campgroundId !== campgroundId) {
      throw new NotFoundException("Integration not found");
    }

    const adapter = this.registry.getAdapter(integration.provider);
    if (!adapter || !adapter.fetchProducts) {
      throw new BadRequestException(
        `Provider ${integration.provider} does not support product sync`,
      );
    }

    const config = this.buildIntegrationRecord(integration);

    const externalProducts = await adapter.fetchProducts(config);

    let imported = 0;
    let updated = 0;
    let failed = 0;

    for (const extProduct of externalProducts) {
      try {
        // Check if mapping already exists
        const existing = await this.prisma.productExternalMapping.findUnique({
          where: {
            campgroundId_provider_externalId: {
              campgroundId,
              provider: integration.provider,
              externalId: extProduct.externalId,
            },
          },
        });

        if (existing) {
          // Update existing mapping
          await this.prisma.productExternalMapping.update({
            where: { id: existing.id },
            data: {
              externalSku: extProduct.externalSku,
              lastSyncedAt: new Date(),
              syncStatus: "synced",
              metadata: toNullableJsonInput(extProduct.metadata),
            },
          });
          updated++;
        } else {
          // Try to match with existing product by SKU
          let productId: string | null = null;

          if (extProduct.externalSku) {
            const matchingProduct = await this.prisma.product.findFirst({
              where: {
                campgroundId,
                sku: extProduct.externalSku,
              },
            });
            productId = matchingProduct?.id ?? null;
          }

          // Create mapping (productId may be null if not matched)
          await this.prisma.productExternalMapping.create({
            data: {
              id: randomUUID(),
              campgroundId,
              productId: productId ?? "unmatched", // We'll need to handle unmatched products
              provider: integration.provider,
              externalId: extProduct.externalId,
              externalSku: extProduct.externalSku,
              lastSyncedAt: new Date(),
              syncStatus: productId ? "synced" : "unmatched",
              metadata:
                toNullableJsonInput({
                  ...extProduct.metadata,
                  originalName: extProduct.name,
                  originalPrice: extProduct.priceCents,
                  category: extProduct.category,
                }) ?? Prisma.DbNull,
              updatedAt: new Date(),
            },
          });
          imported++;
        }
      } catch (error: unknown) {
        this.logger.error(
          `Failed to sync product ${extProduct.externalId}: ${getErrorMessage(error)}`,
        );
        failed++;
      }
    }

    // Update integration sync timestamp
    await this.prisma.posProviderIntegration.update({
      where: { id: integrationId },
      data: { lastSyncAt: new Date() },
    });

    return {
      imported,
      updated,
      failed,
      products: externalProducts,
    };
  }

  // ==================== SALES SYNC ====================

  /**
   * Fetch sales from external POS and deduct inventory.
   */
  async syncSalesFromProvider(
    campgroundId: string,
    integrationId: string,
    since?: Date,
  ): Promise<{
    processed: number;
    deducted: number;
    skipped: number;
    errors: string[];
  }> {
    const integration = await this.prisma.posProviderIntegration.findUnique({
      where: { id: integrationId },
    });

    if (!integration || integration.campgroundId !== campgroundId) {
      throw new NotFoundException("Integration not found");
    }

    const adapter = this.registry.getAdapter(integration.provider);
    if (!adapter || !adapter.fetchSales) {
      throw new BadRequestException(`Provider ${integration.provider} does not support sales sync`);
    }

    // Default to last sync time or 24 hours ago
    const syncSince = since ?? integration.lastSyncAt ?? new Date(Date.now() - 24 * 60 * 60 * 1000);

    const config = this.buildIntegrationRecord(integration);

    const externalSales = await adapter.fetchSales(config, syncSince);

    let processed = 0;
    let deducted = 0;
    let skipped = 0;
    const errors: string[] = [];

    for (const sale of externalSales) {
      try {
        // Check if we've already processed this sale
        const existing = await this.prisma.externalPosSale.findUnique({
          where: {
            campgroundId_externalTransactionId: {
              campgroundId,
              externalTransactionId: sale.externalTransactionId,
            },
          },
        });

        if (existing) {
          skipped++;
          continue;
        }

        // Record the sale
        const itemsValue: Prisma.InputJsonValue =
          isJsonValue(sale.items) && sale.items !== null ? sale.items : [];
        const saleRecord = await this.prisma.externalPosSale.create({
          data: {
            id: randomUUID(),
            campgroundId,
            externalTransactionId: sale.externalTransactionId,
            provider: integration.provider,
            items: itemsValue,
            totalCents: sale.totalCents,
            paymentMethod: sale.paymentMethod,
            saleDate: sale.saleDate,
            metadata: toNullableJsonInput(sale.metadata),
            inventoryDeducted: false,
          },
        });

        // Try to deduct inventory for each item
        let allDeducted = true;

        for (const item of sale.items) {
          // Find the product mapping
          const mapping = await this.prisma.productExternalMapping.findFirst({
            where: {
              campgroundId,
              provider: integration.provider,
              OR: [{ externalId: item.externalProductId }, { externalSku: item.externalSku ?? "" }],
            },
          });

          if (!mapping || mapping.syncStatus === "unmatched") {
            errors.push(`No mapping for external product ${item.externalProductId}`);
            allDeducted = false;
            continue;
          }

          // Check if product uses batch tracking
          const product = await this.prisma.product.findUnique({
            where: { id: mapping.productId },
            select: { id: true, useBatchTracking: true, campgroundId: true },
          });

          if (!product) {
            errors.push(`Product ${mapping.productId} not found`);
            allDeducted = false;
            continue;
          }

          if (product.useBatchTracking) {
            // Use FEFO allocation
            try {
              const allocations = await this.batchInventory.allocateFEFO(
                product.id,
                null, // No specific location
                item.qty,
                { allowExpired: false },
              );

              await this.batchInventory.deductFromBatches(
                campgroundId,
                allocations,
                "system", // System user for external sync
                "external_sale",
                saleRecord.id,
              );

              deducted++;
            } catch (err: unknown) {
              errors.push(
                `Failed to deduct batch inventory for ${product.id}: ${getErrorMessage(err)}`,
              );
              allDeducted = false;
            }
          } else {
            // Simple inventory deduction
            await this.prisma.inventoryMovement.create({
              data: {
                id: randomUUID(),
                campgroundId,
                productId: product.id,
                movementType: "sale",
                qty: -item.qty,
                previousQty: 0, // We'd need to track this better
                newQty: 0,
                referenceType: "external_sale",
                referenceId: saleRecord.id,
                actorUserId: "system",
              },
            });
            deducted++;
          }
        }

        // Mark sale as inventory deducted if all items processed
        if (allDeducted) {
          await this.prisma.externalPosSale.update({
            where: { id: saleRecord.id },
            data: { inventoryDeducted: true },
          });
        }

        processed++;
      } catch (error: unknown) {
        errors.push(
          `Failed to process sale ${sale.externalTransactionId}: ${getErrorMessage(error)}`,
        );
      }
    }

    // Update integration sync timestamp
    await this.prisma.posProviderIntegration.update({
      where: { id: integrationId },
      data: { lastSyncAt: new Date() },
    });

    return {
      processed,
      deducted,
      skipped,
      errors,
    };
  }

  // ==================== PUSH SYNC ====================

  /**
   * Push inventory levels to external POS.
   */
  async pushInventoryToProvider(
    campgroundId: string,
    integrationId: string,
    productId?: string,
  ): Promise<{
    pushed: number;
    failed: number;
    results: ExternalSyncResult[];
  }> {
    const integration = await this.prisma.posProviderIntegration.findUnique({
      where: { id: integrationId },
    });

    if (!integration || integration.campgroundId !== campgroundId) {
      throw new NotFoundException("Integration not found");
    }

    const adapter = this.registry.getAdapter(integration.provider);
    if (!adapter || !adapter.pushInventoryUpdate) {
      throw new BadRequestException(
        `Provider ${integration.provider} does not support inventory push`,
      );
    }

    // Get product mappings to sync
    const mappings = await this.prisma.productExternalMapping.findMany({
      where: {
        campgroundId,
        provider: integration.provider,
        syncStatus: "synced",
        ...(productId ? { productId } : {}),
      },
      include: {
        Product: true,
      },
    });

    const config = this.buildIntegrationRecord(integration);

    const results: ExternalSyncResult[] = [];
    let pushed = 0;
    let failed = 0;

    for (const mapping of mappings) {
      try {
        // Get current inventory level
        let qtyOnHand: number;

        if (mapping.Product.useBatchTracking) {
          qtyOnHand = await this.batchInventory.getBatchStock(mapping.productId);
        } else if (mapping.Product.channelInventoryMode === "split") {
          qtyOnHand = Math.max(0, mapping.Product.posStockQty ?? 0);
        } else {
          qtyOnHand = Math.max(0, mapping.Product.stockQty ?? 0);
        }

        const result = await adapter.pushInventoryUpdate(config, {
          productId: mapping.productId,
          externalId: mapping.externalId,
          qtyOnHand,
        });

        results.push(result);

        if (result.success) {
          pushed++;
          await this.prisma.productExternalMapping.update({
            where: { id: mapping.id },
            data: {
              lastSyncedAt: new Date(),
              syncStatus: "synced",
              syncError: null,
            },
          });
        } else {
          failed++;
          await this.prisma.productExternalMapping.update({
            where: { id: mapping.id },
            data: {
              syncStatus: "error",
              syncError: result.error,
            },
          });
        }
      } catch (error: unknown) {
        failed++;
        results.push({
          success: false,
          error: getErrorMessage(error),
        });
      }
    }

    return {
      pushed,
      failed,
      results,
    };
  }

  /**
   * Push price update (including markdowns) to external POS.
   */
  async pushPriceToProvider(
    campgroundId: string,
    integrationId: string,
    productId: string,
    priceCents: number,
    isMarkdown: boolean = false,
    originalPriceCents?: number,
  ): Promise<ExternalSyncResult> {
    const integration = await this.prisma.posProviderIntegration.findUnique({
      where: { id: integrationId },
    });

    if (!integration || integration.campgroundId !== campgroundId) {
      throw new NotFoundException("Integration not found");
    }

    const adapter = this.registry.getAdapter(integration.provider);
    if (!adapter || !adapter.pushPriceUpdate) {
      throw new BadRequestException(`Provider ${integration.provider} does not support price push`);
    }

    // Get mapping
    const mapping = await this.prisma.productExternalMapping.findFirst({
      where: {
        campgroundId,
        provider: integration.provider,
        productId,
        syncStatus: "synced",
      },
    });

    if (!mapping) {
      return {
        success: false,
        error: "No mapping found for this product",
      };
    }

    const config = this.buildIntegrationRecord(integration);

    return adapter.pushPriceUpdate(config, {
      productId,
      externalId: mapping.externalId,
      priceCents,
      originalPriceCents,
      isMarkdown,
    });
  }

  // ==================== MAPPING MANAGEMENT ====================

  /**
   * Link a Campreserv product to an external POS product.
   */
  async linkProduct(
    campgroundId: string,
    productId: string,
    provider: PosProviderType,
    externalId: string,
  ) {
    // Verify product exists
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
    });

    if (!product || product.campgroundId !== campgroundId) {
      throw new NotFoundException("Product not found");
    }

    // Update or create mapping
    return this.prisma.productExternalMapping.upsert({
      where: {
        campgroundId_provider_externalId: {
          campgroundId,
          provider,
          externalId,
        },
      },
      update: {
        productId,
        syncStatus: "synced",
        lastSyncedAt: new Date(),
      },
      create: {
        id: randomUUID(),
        campgroundId,
        productId,
        provider,
        externalId,
        syncStatus: "synced",
        lastSyncedAt: new Date(),
        updatedAt: new Date(),
      },
    });
  }

  /**
   * Unlink a product from external POS.
   */
  async unlinkProduct(mappingId: string) {
    return this.prisma.productExternalMapping.delete({
      where: { id: mappingId },
    });
  }

  /**
   * Get all product mappings for a campground.
   */
  async getProductMappings(campgroundId: string, provider?: PosProviderType) {
    return this.prisma.productExternalMapping.findMany({
      where: {
        campgroundId,
        ...(provider ? { provider } : {}),
      },
      include: {
        Product: {
          select: {
            id: true,
            name: true,
            sku: true,
            priceCents: true,
          },
        },
      },
      orderBy: { lastSyncedAt: "desc" },
    });
  }

  /**
   * Get unmatched external products (imported but not linked).
   */
  async getUnmatchedProducts(campgroundId: string, provider: PosProviderType) {
    return this.prisma.productExternalMapping.findMany({
      where: {
        campgroundId,
        provider,
        syncStatus: "unmatched",
      },
    });
  }
}
