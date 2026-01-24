import {
  Injectable,
  ConflictException,
  NotFoundException,
  Inject,
  forwardRef,
} from "@nestjs/common";
import type { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { randomUUID } from "crypto";
import {
  CreateStoreLocationDto,
  UpdateStoreLocationDto,
  SetLocationInventoryDto,
  AdjustLocationInventoryDto,
  CreateLocationPriceOverrideDto,
  UpdateLocationPriceOverrideDto,
} from "./dto/location.dto";
import { BatchInventoryService } from "../inventory/batch-inventory.service";
import type { BatchAllocation } from "../inventory/dto/batch.dto";

@Injectable()
export class LocationService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(forwardRef(() => BatchInventoryService))
    private readonly batchInventory: BatchInventoryService,
  ) {}

  // ==================== STORE LOCATIONS ====================

  async listLocations(campgroundId: string, includeInactive = false) {
    const locations = await this.prisma.storeLocation.findMany({
      where: {
        campgroundId,
        ...(includeInactive ? {} : { isActive: true }),
      },
      orderBy: [{ isDefault: "desc" }, { sortOrder: "asc" }, { name: "asc" }],
      include: {
        _count: {
          select: {
            PosTerminal: true,
            LocationInventory: true,
            LocationPriceOverride: true,
          },
        },
      },
    });
    return locations.map((location) => ({
      ...location,
      _count: {
        ...location._count,
        terminals: location._count.PosTerminal,
        locationInventory: location._count.LocationInventory,
        priceOverrides: location._count.LocationPriceOverride,
      },
    }));
  }

  async getLocation(campgroundId: string, id: string) {
    const location = await this.prisma.storeLocation.findFirst({
      where: { id, campgroundId },
      include: {
        PosTerminal: true,
        _count: {
          select: {
            PosTerminal: true,
            LocationInventory: true,
            LocationPriceOverride: true,
            StoreOrder: true,
          },
        },
      },
    });
    if (!location) throw new NotFoundException("Location not found");
    return {
      ...location,
      terminals: location.PosTerminal,
      PosTerminal: undefined,
      _count: {
        ...location._count,
        terminals: location._count.PosTerminal,
        locationInventory: location._count.LocationInventory,
        priceOverrides: location._count.LocationPriceOverride,
        fulfillmentOrders: location._count.StoreOrder,
      },
    };
  }

  async getDefaultLocation(campgroundId: string) {
    return this.prisma.storeLocation.findFirst({
      where: { campgroundId, isDefault: true, isActive: true },
    });
  }

  async createLocation(data: CreateStoreLocationDto) {
    // If this is the first location or is marked default, handle default logic
    if (data.isDefault) {
      await this.prisma.storeLocation.updateMany({
        where: { campgroundId: data.campgroundId, isDefault: true },
        data: { isDefault: false },
      });
    }

    // Check if this is the first location - make it default automatically
    const existingCount = await this.prisma.storeLocation.count({
      where: { campgroundId: data.campgroundId },
    });

    return this.prisma.storeLocation.create({
      data: {
        id: randomUUID(),
        ...data,
        isDefault: data.isDefault ?? existingCount === 0,
      },
    });
  }

  async updateLocation(campgroundId: string, id: string, data: UpdateStoreLocationDto) {
    const location = await this.prisma.storeLocation.findFirst({
      where: { id, campgroundId },
    });
    if (!location) throw new NotFoundException("Location not found");

    // If setting as default, unset other defaults
    if (data.isDefault) {
      await this.prisma.storeLocation.updateMany({
        where: { campgroundId: location.campgroundId, isDefault: true, id: { not: id } },
        data: { isDefault: false },
      });
    }

    return this.prisma.storeLocation.update({ where: { id }, data });
  }

  async deleteLocation(campgroundId: string, id: string) {
    const location = await this.prisma.storeLocation.findFirst({
      where: { id, campgroundId },
      include: { _count: { select: { PosTerminal: true, StoreOrder: true } } },
    });

    if (!location) throw new NotFoundException("Location not found");

    if (location.isDefault) {
      throw new ConflictException(
        "Cannot delete the default location. Set another location as default first.",
      );
    }

    if (location._count.PosTerminal > 0) {
      throw new ConflictException(
        "Cannot delete location with assigned terminals. Reassign terminals first.",
      );
    }

    if (location._count.StoreOrder > 0) {
      throw new ConflictException(
        "Cannot delete location with orders. Consider deactivating instead.",
      );
    }

    return this.prisma.storeLocation.delete({ where: { id } });
  }

  // ==================== LOCATION INVENTORY ====================

  async getLocationInventory(campgroundId: string, locationId: string, productId?: string) {
    const location = await this.prisma.storeLocation.findFirst({
      where: { id: locationId, campgroundId },
    });
    if (!location) throw new NotFoundException("Location not found");

    if (productId) {
      const product = await this.prisma.product.findFirst({
        where: { id: productId, campgroundId },
      });
      if (!product) throw new NotFoundException("Product not found");
    }

    const inventory = await this.prisma.locationInventory.findMany({
      where: {
        locationId,
        ...(productId ? { productId } : {}),
      },
      include: {
        Product: {
          select: {
            id: true,
            name: true,
            sku: true,
            priceCents: true,
            trackInventory: true,
            lowStockAlert: true,
          },
        },
      },
      orderBy: { Product: { name: "asc" } },
    });
    return inventory.map((item) => ({
      ...item,
      product: item.Product,
      Product: undefined,
    }));
  }

  async setLocationStock(
    campgroundId: string,
    locationId: string,
    data: SetLocationInventoryDto,
    actorUserId: string,
  ) {
    const location = await this.prisma.storeLocation.findFirst({
      where: { id: locationId, campgroundId },
    });
    if (!location) throw new NotFoundException("Location not found");

    const product = await this.prisma.product.findFirst({
      where: { id: data.productId, campgroundId },
    });
    if (!product) throw new NotFoundException("Product not found");

    // Get current stock
    const existing = await this.prisma.locationInventory.findUnique({
      where: { productId_locationId: { productId: data.productId, locationId } },
    });

    const previousQty = existing?.stockQty ?? 0;
    const newQty = Math.max(0, data.stockQty);

    // Use transaction to update inventory and log movement
    return this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const inventory = await tx.locationInventory.upsert({
        where: { productId_locationId: { productId: data.productId, locationId } },
        create: {
          id: randomUUID(),
          productId: data.productId,
          locationId,
          stockQty: newQty,
          lowStockAlert: data.lowStockAlert,
        },
        update: {
          stockQty: newQty,
          lowStockAlert: data.lowStockAlert,
        },
      });

      // Log the movement
      if (previousQty !== newQty) {
        await tx.inventoryMovement.create({
          data: {
            id: randomUUID(),
            campgroundId: location.campgroundId,
            productId: data.productId,
            locationId,
            movementType: "adjustment",
            qty: newQty - previousQty,
            previousQty,
            newQty,
            referenceType: "manual",
            actorUserId,
          },
        });
      }

      return inventory;
    });
  }

  async adjustLocationStock(
    campgroundId: string,
    locationId: string,
    data: AdjustLocationInventoryDto,
    actorUserId: string,
  ) {
    const location = await this.prisma.storeLocation.findFirst({
      where: { id: locationId, campgroundId },
    });
    if (!location) throw new NotFoundException("Location not found");

    const product = await this.prisma.product.findFirst({
      where: { id: data.productId, campgroundId },
    });
    if (!product) throw new NotFoundException("Product not found");

    // Get current stock
    const existing = await this.prisma.locationInventory.findUnique({
      where: { productId_locationId: { productId: data.productId, locationId } },
    });

    const previousQty = existing?.stockQty ?? 0;
    const newQty = Math.max(0, previousQty + data.adjustment);

    return this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const inventory = await tx.locationInventory.upsert({
        where: { productId_locationId: { productId: data.productId, locationId } },
        create: {
          id: randomUUID(),
          productId: data.productId,
          locationId,
          stockQty: newQty,
        },
        update: {
          stockQty: newQty,
        },
      });

      // Log the movement
      await tx.inventoryMovement.create({
        data: {
          id: randomUUID(),
          campgroundId: location.campgroundId,
          productId: data.productId,
          locationId,
          movementType: data.adjustment > 0 ? "restock" : "adjustment",
          qty: data.adjustment,
          previousQty,
          newQty,
          referenceType: "manual",
          notes: data.notes,
          actorUserId,
        },
      });

      return inventory;
    });
  }

  // ==================== PRICE OVERRIDES ====================

  async getLocationPriceOverrides(campgroundId: string, locationId: string) {
    const location = await this.prisma.storeLocation.findFirst({
      where: { id: locationId, campgroundId },
    });
    if (!location) throw new NotFoundException("Location not found");

    const overrides = await this.prisma.locationPriceOverride.findMany({
      where: { locationId, isActive: true },
      include: {
        Product: {
          select: {
            id: true,
            name: true,
            priceCents: true, // Base price for comparison
          },
        },
      },
      orderBy: { Product: { name: "asc" } },
    });
    return overrides.map((override) => ({
      ...override,
      product: override.Product,
      Product: undefined,
    }));
  }

  async createPriceOverride(
    campgroundId: string,
    locationId: string,
    data: CreateLocationPriceOverrideDto,
  ) {
    const location = await this.prisma.storeLocation.findFirst({
      where: { id: locationId, campgroundId },
    });
    if (!location) throw new NotFoundException("Location not found");

    const product = await this.prisma.product.findFirst({
      where: { id: data.productId, campgroundId },
    });
    if (!product) throw new NotFoundException("Product not found");

    // Check for existing override
    const existing = await this.prisma.locationPriceOverride.findUnique({
      where: { productId_locationId: { productId: data.productId, locationId } },
    });

    if (existing) {
      // Update existing override
      return this.prisma.locationPriceOverride.update({
        where: { id: existing.id },
        data: {
          priceCents: data.priceCents,
          reason: data.reason,
          isActive: true,
        },
      });
    }

    return this.prisma.locationPriceOverride.create({
      data: {
        id: randomUUID(),
        productId: data.productId,
        locationId,
        priceCents: data.priceCents,
        reason: data.reason,
      },
    });
  }

  async updatePriceOverride(
    campgroundId: string,
    id: string,
    data: UpdateLocationPriceOverrideDto,
  ) {
    const override = await this.prisma.locationPriceOverride.findFirst({
      where: { id, StoreLocation: { campgroundId } },
    });
    if (!override) throw new NotFoundException("Price override not found");

    return this.prisma.locationPriceOverride.update({ where: { id }, data });
  }

  async deletePriceOverride(campgroundId: string, locationId: string, productId: string) {
    const location = await this.prisma.storeLocation.findFirst({
      where: { id: locationId, campgroundId },
    });
    if (!location) throw new NotFoundException("Location not found");

    const override = await this.prisma.locationPriceOverride.findUnique({
      where: { productId_locationId: { productId, locationId } },
    });
    if (!override) throw new NotFoundException("Price override not found");

    return this.prisma.locationPriceOverride.delete({ where: { id: override.id } });
  }

  // ==================== HELPER METHODS ====================

  /**
   * Get the effective price for a product at a location.
   * Returns override price if exists and active, otherwise base price.
   */
  async getEffectivePrice(
    campgroundId: string,
    productId: string,
    locationId?: string,
  ): Promise<number> {
    const product = await this.prisma.product.findFirst({
      where: { id: productId, campgroundId },
      select: { priceCents: true },
    });

    if (!product) throw new NotFoundException("Product not found");

    if (!locationId) return product.priceCents;

    const location = await this.prisma.storeLocation.findFirst({
      where: { id: locationId, campgroundId },
    });
    if (!location) throw new NotFoundException("Location not found");

    const override = await this.prisma.locationPriceOverride.findFirst({
      where: {
        productId,
        locationId,
        isActive: true,
      },
    });

    return override?.priceCents ?? product.priceCents;
  }

  /**
   * Get effective stock for a product, considering inventory mode.
   * For shared mode: returns product.stockQty
   * For per_location mode: returns sum of all location stocks or specific location stock
   */
  async getEffectiveStock(
    campgroundId: string,
    productId: string,
    locationId?: string,
  ): Promise<number> {
    const product = await this.prisma.product.findFirst({
      where: { id: productId, campgroundId },
      select: { stockQty: true, inventoryMode: true, trackInventory: true },
    });

    if (!product) throw new NotFoundException("Product not found");
    if (!product.trackInventory) return Infinity; // Unlimited stock

    if (product.inventoryMode === "shared") {
      return product.stockQty;
    }

    // Per-location mode
    if (locationId) {
      const location = await this.prisma.storeLocation.findFirst({
        where: { id: locationId, campgroundId },
      });
      if (!location) throw new NotFoundException("Location not found");

      const inventory = await this.prisma.locationInventory.findUnique({
        where: { productId_locationId: { productId, locationId } },
      });
      return inventory?.stockQty ?? 0;
    }

    // Sum all location stocks
    const result = await this.prisma.locationInventory.aggregate({
      where: { productId },
      _sum: { stockQty: true },
    });

    return result._sum.stockQty ?? 0;
  }

  /**
   * Get inventory movements for audit purposes.
   */
  async getInventoryMovements(
    campgroundId: string,
    filters?: {
      productId?: string;
      locationId?: string;
      movementType?: string;
      startDate?: Date;
      endDate?: Date;
    },
    limit = 100,
  ) {
    const movements = await this.prisma.inventoryMovement.findMany({
      where: {
        campgroundId,
        ...(filters?.productId ? { productId: filters.productId } : {}),
        ...(filters?.locationId ? { locationId: filters.locationId } : {}),
        ...(filters?.movementType ? { movementType: filters.movementType } : {}),
        ...(filters?.startDate || filters?.endDate
          ? {
              createdAt: {
                ...(filters?.startDate ? { gte: filters.startDate } : {}),
                ...(filters?.endDate ? { lte: filters.endDate } : {}),
              },
            }
          : {}),
      },
      include: {
        Product: { select: { id: true, name: true, sku: true } },
        StoreLocation: { select: { id: true, name: true, code: true } },
        User: { select: { id: true, firstName: true, lastName: true } },
      },
      orderBy: { createdAt: "desc" },
      take: limit,
    });
    return movements.map((movement) => ({
      ...movement,
      product: movement.Product,
      location: movement.StoreLocation,
      actor: movement.User,
      Product: undefined,
      StoreLocation: undefined,
      User: undefined,
    }));
  }

  /**
   * Ensure a campground has at least one default location.
   * Creates "Main Store" if none exists.
   */
  async ensureDefaultLocation(campgroundId: string): Promise<string> {
    const existing = await this.prisma.storeLocation.findFirst({
      where: { campgroundId, isDefault: true, isActive: true },
    });

    if (existing) return existing.id;

    const created = await this.prisma.storeLocation.create({
      data: {
        id: randomUUID(),
        campgroundId,
        name: "Main Store",
        isDefault: true,
        acceptsOnline: true,
      },
    });

    return created.id;
  }

  // ==================== POS INTEGRATION ====================

  /**
   * Deduct inventory for a POS sale.
   * Handles shared, per-location, and batch-tracked inventory modes.
   *
   * @param options.batchAllocations Pre-computed batch allocations from POS (optional)
   * @param options.allowExpired Whether to allow selling expired items (requires manager override)
   */
  async deductInventoryForSale(
    campgroundId: string,
    items: Array<{
      productId: string;
      qty: number;
      batchAllocations?: BatchAllocation[]; // Pre-allocated from POS
    }>,
    locationId: string | null,
    actorUserId: string,
    referenceId?: string,
    options?: { allowExpired?: boolean },
  ): Promise<void> {
    await this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      for (const item of items) {
        const product = await tx.product.findUnique({
          where: { id: item.productId },
          select: {
            id: true,
            name: true,
            stockQty: true,
            inventoryMode: true,
            trackInventory: true,
            useBatchTracking: true,
          },
        });

        if (!product || !product.trackInventory) continue;

        // Update lastSaleDate for slow-moving detection
        await tx.product.update({
          where: { id: item.productId },
          data: { lastSaleDate: new Date() },
        });

        // Handle batch-tracked products
        if (product.useBatchTracking) {
          // Use pre-allocated batches if provided, otherwise allocate now
          const allocations =
            item.batchAllocations ??
            (await this.batchInventory.allocateFEFO(item.productId, locationId, item.qty, {
              allowExpired: options?.allowExpired,
            }));

          // Deduct from batches (outside transaction since batchInventory has its own)
          // Note: In production, this should be refactored to share the transaction
          await this.batchInventory.deductFromBatches(
            campgroundId,
            allocations,
            actorUserId,
            "order",
            referenceId,
          );
          continue;
        }

        // Standard inventory deduction (non-batch-tracked)
        if (product.inventoryMode === "per_location" && locationId) {
          // Deduct from location inventory
          const inventory = await tx.locationInventory.findUnique({
            where: { productId_locationId: { productId: item.productId, locationId } },
          });

          const previousQty = inventory?.stockQty ?? 0;
          const newQty = Math.max(0, previousQty - item.qty);

          await tx.locationInventory.upsert({
            where: { productId_locationId: { productId: item.productId, locationId } },
            create: { id: randomUUID(), productId: item.productId, locationId, stockQty: newQty },
            update: { stockQty: newQty },
          });

          // Log movement
          await tx.inventoryMovement.create({
            data: {
              id: randomUUID(),
              campgroundId,
              productId: item.productId,
              locationId,
              movementType: "sale",
              qty: -item.qty,
              previousQty,
              newQty,
              referenceType: "order",
              referenceId,
              actorUserId,
            },
          });
        } else {
          // Deduct from shared stock
          const previousQty = product.stockQty;
          const newQty = Math.max(0, previousQty - item.qty);

          await tx.product.update({
            where: { id: item.productId },
            data: { stockQty: newQty },
          });

          // Log movement
          await tx.inventoryMovement.create({
            data: {
              id: randomUUID(),
              campgroundId,
              productId: item.productId,
              locationId: null,
              movementType: "sale",
              qty: -item.qty,
              previousQty,
              newQty,
              referenceType: "order",
              referenceId,
              actorUserId,
            },
          });
        }
      }
    });
  }

  /**
   * Restore inventory for a returned item.
   * For batch-tracked items, requires batchId to return to the original batch.
   */
  async restoreInventoryForReturn(
    campgroundId: string,
    items: Array<{
      productId: string;
      qty: number;
      batchId?: string; // Required for batch-tracked products
    }>,
    locationId: string | null,
    actorUserId: string,
    referenceId?: string,
  ): Promise<void> {
    await this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      for (const item of items) {
        const product = await tx.product.findUnique({
          where: { id: item.productId },
          select: {
            id: true,
            stockQty: true,
            inventoryMode: true,
            trackInventory: true,
            useBatchTracking: true,
          },
        });

        if (!product || !product.trackInventory) continue;

        // Handle batch-tracked returns
        if (product.useBatchTracking && item.batchId) {
          await this.batchInventory.returnToBatches(
            campgroundId,
            [{ batchId: item.batchId, qty: item.qty }],
            actorUserId,
            "order",
            referenceId,
          );
          continue;
        }

        // Standard inventory return
        if (product.inventoryMode === "per_location" && locationId) {
          const inventory = await tx.locationInventory.findUnique({
            where: { productId_locationId: { productId: item.productId, locationId } },
          });

          const previousQty = inventory?.stockQty ?? 0;
          const newQty = previousQty + item.qty;

          await tx.locationInventory.upsert({
            where: { productId_locationId: { productId: item.productId, locationId } },
            create: { id: randomUUID(), productId: item.productId, locationId, stockQty: newQty },
            update: { stockQty: newQty },
          });

          await tx.inventoryMovement.create({
            data: {
              id: randomUUID(),
              campgroundId,
              productId: item.productId,
              locationId,
              movementType: "return",
              qty: item.qty,
              previousQty,
              newQty,
              referenceType: "order",
              referenceId,
              actorUserId,
            },
          });
        } else {
          const previousQty = product.stockQty;
          const newQty = previousQty + item.qty;

          await tx.product.update({
            where: { id: item.productId },
            data: { stockQty: newQty },
          });

          await tx.inventoryMovement.create({
            data: {
              id: randomUUID(),
              campgroundId,
              productId: item.productId,
              locationId: null,
              movementType: "return",
              qty: item.qty,
              previousQty,
              newQty,
              referenceType: "order",
              referenceId,
              actorUserId,
            },
          });
        }
      }
    });
  }

  /**
   * Get products with their effective prices and stock for a location.
   * Used by POS to display available products.
   */
  async getProductsForLocation(campgroundId: string, locationId?: string) {
    if (locationId) {
      const location = await this.prisma.storeLocation.findFirst({
        where: { id: locationId, campgroundId },
      });
      if (!location) throw new NotFoundException("Location not found");
    }

    const products = await this.prisma.product.findMany({
      where: { campgroundId, isActive: true },
      include: {
        ProductCategory: { select: { id: true, name: true } },
        LocationInventory: locationId ? { where: { locationId } } : false,
        LocationPriceOverride: locationId ? { where: { locationId, isActive: true } } : false,
      },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    });

    return products.map((p) => {
      const overrides = Array.isArray(p.LocationPriceOverride) ? p.LocationPriceOverride : [];
      const inventories = Array.isArray(p.LocationInventory) ? p.LocationInventory : [];
      const override = overrides[0];
      const locInventory = inventories[0];

      const effectiveStock = p.trackInventory
        ? p.inventoryMode === "per_location"
          ? (locInventory?.stockQty ?? 0)
          : p.stockQty
        : null;

      return {
        ...p,
        category: p.ProductCategory,
        effectivePriceCents: override?.priceCents ?? p.priceCents,
        effectiveStock,
        hasLocationStock: !!locInventory,
        hasPriceOverride: !!override,
      };
    });
  }
}
