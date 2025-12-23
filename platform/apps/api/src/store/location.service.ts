import { Injectable, ConflictException, NotFoundException, Inject, forwardRef } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import {
    CreateStoreLocationDto,
    UpdateStoreLocationDto,
    SetLocationInventoryDto,
    AdjustLocationInventoryDto,
    CreateLocationPriceOverrideDto,
    UpdateLocationPriceOverrideDto,
} from "./dto/location.dto";
import { BatchInventoryService, BatchAllocation } from "../inventory/batch-inventory.service";

@Injectable()
export class LocationService {
    constructor(
        private readonly prisma: PrismaService,
        @Inject(forwardRef(() => BatchInventoryService))
        private readonly batchInventory: BatchInventoryService
    ) {}

    // ==================== STORE LOCATIONS ====================

    async listLocations(campgroundId: string, includeInactive = false) {
        return this.prisma.storeLocation.findMany({
            where: {
                campgroundId,
                ...(includeInactive ? {} : { isActive: true }),
            },
            orderBy: [{ isDefault: "desc" }, { sortOrder: "asc" }, { name: "asc" }],
            include: {
                _count: {
                    select: {
                        terminals: true,
                        locationInventory: true,
                        priceOverrides: true,
                    },
                },
            },
        });
    }

    async getLocation(id: string) {
        const location = await this.prisma.storeLocation.findUnique({
            where: { id },
            include: {
                terminals: true,
                _count: {
                    select: {
                        locationInventory: true,
                        priceOverrides: true,
                        fulfillmentOrders: true,
                    },
                },
            },
        });
        if (!location) throw new NotFoundException("Location not found");
        return location;
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
                ...data,
                isDefault: data.isDefault ?? existingCount === 0,
            },
        });
    }

    async updateLocation(id: string, data: UpdateStoreLocationDto) {
        const location = await this.prisma.storeLocation.findUnique({ where: { id } });
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

    async deleteLocation(id: string) {
        const location = await this.prisma.storeLocation.findUnique({
            where: { id },
            include: { _count: { select: { terminals: true, fulfillmentOrders: true } } },
        });

        if (!location) throw new NotFoundException("Location not found");

        if (location.isDefault) {
            throw new ConflictException("Cannot delete the default location. Set another location as default first.");
        }

        if (location._count.terminals > 0) {
            throw new ConflictException("Cannot delete location with assigned terminals. Reassign terminals first.");
        }

        if (location._count.fulfillmentOrders > 0) {
            throw new ConflictException("Cannot delete location with orders. Consider deactivating instead.");
        }

        return this.prisma.storeLocation.delete({ where: { id } });
    }

    // ==================== LOCATION INVENTORY ====================

    async getLocationInventory(locationId: string, productId?: string) {
        return this.prisma.locationInventory.findMany({
            where: {
                locationId,
                ...(productId ? { productId } : {}),
            },
            include: {
                product: {
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
            orderBy: { product: { name: "asc" } },
        });
    }

    async setLocationStock(
        locationId: string,
        data: SetLocationInventoryDto,
        actorUserId: string
    ) {
        const location = await this.prisma.storeLocation.findUnique({ where: { id: locationId } });
        if (!location) throw new NotFoundException("Location not found");

        const product = await this.prisma.product.findUnique({ where: { id: data.productId } });
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
        locationId: string,
        data: AdjustLocationInventoryDto,
        actorUserId: string
    ) {
        const location = await this.prisma.storeLocation.findUnique({ where: { id: locationId } });
        if (!location) throw new NotFoundException("Location not found");

        const product = await this.prisma.product.findUnique({ where: { id: data.productId } });
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

    async getLocationPriceOverrides(locationId: string) {
        return this.prisma.locationPriceOverride.findMany({
            where: { locationId, isActive: true },
            include: {
                product: {
                    select: {
                        id: true,
                        name: true,
                        priceCents: true, // Base price for comparison
                    },
                },
            },
            orderBy: { product: { name: "asc" } },
        });
    }

    async createPriceOverride(locationId: string, data: CreateLocationPriceOverrideDto) {
        const location = await this.prisma.storeLocation.findUnique({ where: { id: locationId } });
        if (!location) throw new NotFoundException("Location not found");

        const product = await this.prisma.product.findUnique({ where: { id: data.productId } });
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
                productId: data.productId,
                locationId,
                priceCents: data.priceCents,
                reason: data.reason,
            },
        });
    }

    async updatePriceOverride(id: string, data: UpdateLocationPriceOverrideDto) {
        const override = await this.prisma.locationPriceOverride.findUnique({ where: { id } });
        if (!override) throw new NotFoundException("Price override not found");

        return this.prisma.locationPriceOverride.update({ where: { id }, data });
    }

    async deletePriceOverride(locationId: string, productId: string) {
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
    async getEffectivePrice(productId: string, locationId?: string): Promise<number> {
        const product = await this.prisma.product.findUnique({
            where: { id: productId },
            select: { priceCents: true },
        });

        if (!product) throw new NotFoundException("Product not found");

        if (!locationId) return product.priceCents;

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
    async getEffectiveStock(productId: string, locationId?: string): Promise<number> {
        const product = await this.prisma.product.findUnique({
            where: { id: productId },
            select: { stockQty: true, inventoryMode: true, trackInventory: true },
        });

        if (!product) throw new NotFoundException("Product not found");
        if (!product.trackInventory) return Infinity; // Unlimited stock

        if (product.inventoryMode === "shared") {
            return product.stockQty;
        }

        // Per-location mode
        if (locationId) {
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
        limit = 100
    ) {
        return this.prisma.inventoryMovement.findMany({
            where: {
                campgroundId,
                ...(filters?.productId ? { productId: filters.productId } : {}),
                ...(filters?.locationId ? { locationId: filters.locationId } : {}),
                ...(filters?.movementType ? { movementType: filters.movementType } : {}),
                ...(filters?.startDate || filters?.endDate
                    ? {
                          createdAt: {
                              ...(filters.startDate ? { gte: filters.startDate } : {}),
                              ...(filters.endDate ? { lte: filters.endDate } : {}),
                          },
                      }
                    : {}),
            },
            include: {
                product: { select: { id: true, name: true, sku: true } },
                location: { select: { id: true, name: true, code: true } },
                actor: { select: { id: true, firstName: true, lastName: true } },
            },
            orderBy: { createdAt: "desc" },
            take: limit,
        });
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
        options?: { allowExpired?: boolean }
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
                    const allocations = item.batchAllocations ??
                        await this.batchInventory.allocateFEFO(
                            item.productId,
                            locationId,
                            item.qty,
                            { allowExpired: options?.allowExpired }
                        );

                    // Deduct from batches (outside transaction since batchInventory has its own)
                    // Note: In production, this should be refactored to share the transaction
                    await this.batchInventory.deductFromBatches(
                        campgroundId,
                        allocations,
                        actorUserId,
                        "order",
                        referenceId
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
                        create: { productId: item.productId, locationId, stockQty: newQty },
                        update: { stockQty: newQty },
                    });

                    // Log movement
                    await tx.inventoryMovement.create({
                        data: {
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
        referenceId?: string
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
                        referenceId
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
                        create: { productId: item.productId, locationId, stockQty: newQty },
                        update: { stockQty: newQty },
                    });

                    await tx.inventoryMovement.create({
                        data: {
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
        const products = await this.prisma.product.findMany({
            where: { campgroundId, isActive: true },
            include: {
                category: { select: { id: true, name: true } },
                locationInventory: locationId ? { where: { locationId } } : false,
                priceOverrides: locationId ? { where: { locationId, isActive: true } } : false,
            },
            orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
        });

        return products.map((p) => {
            const override = (p.priceOverrides as any)?.[0];
            const locInventory = (p.locationInventory as any)?.[0];

            const effectiveStock = p.trackInventory
                ? (p.inventoryMode === "per_location"
                    ? (locInventory?.stockQty ?? 0)
                    : p.stockQty)
                : null;

            return {
                ...p,
                effectivePriceCents: override?.priceCents ?? p.priceCents,
                effectiveStock,
                hasLocationStock: !!locInventory,
                hasPriceOverride: !!override,
            };
        });
    }
}
