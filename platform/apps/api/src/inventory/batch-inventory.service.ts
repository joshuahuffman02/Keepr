import {
    Injectable,
    NotFoundException,
    BadRequestException,
    ConflictException,
} from "@nestjs/common";
import { Prisma, ExpirationTier } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { WebhookService } from "../developer-api/webhook.service";
import {
    CreateBatchDto,
    UpdateBatchDto,
    AdjustBatchDto,
    DisposeBatchDto,
    BatchAllocation,
    BatchListFilters,
} from "./dto/batch.dto";

export class InsufficientBatchInventoryException extends BadRequestException {
    constructor(
        productId: string,
        requested: number,
        available: number
    ) {
        super({
            code: "INSUFFICIENT_BATCH_INVENTORY",
            message: `Insufficient batch inventory for product ${productId}. Requested: ${requested}, Available: ${available}`,
            productId,
            requested,
            available,
        });
    }
}

export class ExpiredBatchException extends BadRequestException {
    constructor(productId: string, batchId: string, expirationDate: Date) {
        super({
            code: "EXPIRED_BATCH",
            message: `Batch ${batchId} expired on ${expirationDate.toISOString()}. Manager override required.`,
            productId,
            batchId,
            expirationDate,
        });
    }
}

@Injectable()
export class BatchInventoryService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly webhookService: WebhookService
    ) {}

    // ==================== BATCH CRUD ====================

    async createBatch(
        campgroundId: string,
        dto: CreateBatchDto,
        actorUserId: string
    ) {
        // Verify product exists and has batch tracking enabled
        const product = await this.prisma.product.findUnique({
            where: { id: dto.productId },
            select: { id: true, campgroundId: true, useBatchTracking: true, name: true },
        });

        if (!product) throw new NotFoundException("Product not found");
        if (product.campgroundId !== campgroundId) {
            throw new BadRequestException("Product does not belong to this campground");
        }
        if (!product.useBatchTracking) {
            throw new BadRequestException(
                "Batch tracking is not enabled for this product. Enable it first."
            );
        }

        // Verify location if provided
        if (dto.locationId) {
            const location = await this.prisma.storeLocation.findUnique({
                where: { id: dto.locationId },
            });
            if (!location || location.campgroundId !== campgroundId) {
                throw new NotFoundException("Location not found");
            }
        }

        // Create batch with initial movement record
        return this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
            const batch = await tx.inventoryBatch.create({
                data: {
                    campgroundId,
                    productId: dto.productId,
                    locationId: dto.locationId,
                    batchNumber: dto.batchNumber,
                    supplierId: dto.supplierId,
                    qtyReceived: dto.qtyReceived,
                    qtyRemaining: dto.qtyReceived,
                    receivedDate: new Date(),
                    expirationDate: dto.expirationDate,
                    unitCostCents: dto.unitCostCents,
                    createdById: actorUserId,
                },
            });

            // Record the initial receipt movement
            await tx.batchMovement.create({
                data: {
                    batchId: batch.id,
                    qty: dto.qtyReceived,
                    movementType: "receive",
                    referenceType: "manual",
                    previousQty: 0,
                    newQty: dto.qtyReceived,
                    actorUserId,
                },
            });

            return batch;
        });

        // Emit webhook event for batch received
        await this.webhookService.emit("inventory.batch.received", campgroundId, {
            batchId: batch.id,
            productId: dto.productId,
            productName: product.name,
            batchNumber: dto.batchNumber ?? null,
            qtyReceived: dto.qtyReceived,
            expirationDate: dto.expirationDate?.toISOString() ?? null,
            locationId: dto.locationId ?? null,
        });

        return batch;
    }

    async getBatch(id: string) {
        const batch = await this.prisma.inventoryBatch.findUnique({
            where: { id },
            include: {
                product: { select: { id: true, name: true, sku: true } },
                location: { select: { id: true, name: true } },
                movements: {
                    orderBy: { createdAt: "desc" },
                    take: 20,
                    include: {
                        actor: { select: { id: true, firstName: true, lastName: true } },
                    },
                },
            },
        });
        if (!batch) throw new NotFoundException("Batch not found");
        return batch;
    }

    async listBatches(campgroundId: string, filters?: BatchListFilters) {
        const where: Prisma.InventoryBatchWhereInput = {
            campgroundId,
            ...(filters?.productId ? { productId: filters.productId } : {}),
            ...(filters?.locationId ? { locationId: filters.locationId } : {}),
            ...(filters?.isActive !== undefined ? { isActive: filters.isActive } : {}),
        };

        // Handle expiration filters
        if (filters?.expiredOnly) {
            where.expirationDate = { lt: new Date() };
        } else if (filters?.expiringWithinDays) {
            const futureDate = new Date();
            futureDate.setDate(futureDate.getDate() + filters.expiringWithinDays);
            where.expirationDate = {
                gte: new Date(),
                lte: futureDate,
            };
        }

        return this.prisma.inventoryBatch.findMany({
            where,
            include: {
                product: { select: { id: true, name: true, sku: true } },
                location: { select: { id: true, name: true } },
            },
            orderBy: [
                { expirationDate: "asc" }, // FEFO order
                { receivedDate: "asc" },
            ],
        });
    }

    async updateBatch(id: string, dto: UpdateBatchDto) {
        const batch = await this.prisma.inventoryBatch.findUnique({ where: { id } });
        if (!batch) throw new NotFoundException("Batch not found");

        return this.prisma.inventoryBatch.update({
            where: { id },
            data: {
                batchNumber: dto.batchNumber,
                supplierId: dto.supplierId,
                expirationDate: dto.expirationDate,
                unitCostCents: dto.unitCostCents,
            },
        });
    }

    async adjustBatch(
        id: string,
        dto: AdjustBatchDto,
        actorUserId: string
    ) {
        const batch = await this.prisma.inventoryBatch.findUnique({ where: { id } });
        if (!batch) throw new NotFoundException("Batch not found");

        const newQty = batch.qtyRemaining + dto.adjustment;
        if (newQty < 0) {
            throw new BadRequestException(
                `Adjustment would result in negative quantity. Current: ${batch.qtyRemaining}, Adjustment: ${dto.adjustment}`
            );
        }

        return this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
            const updatedBatch = await tx.inventoryBatch.update({
                where: { id },
                data: {
                    qtyRemaining: newQty,
                    isActive: newQty > 0,
                    depletedAt: newQty === 0 ? new Date() : null,
                },
            });

            await tx.batchMovement.create({
                data: {
                    batchId: id,
                    qty: dto.adjustment,
                    movementType: "adjustment",
                    referenceType: "manual",
                    disposalReason: dto.disposalReason,
                    disposalNotes: dto.notes,
                    previousQty: batch.qtyRemaining,
                    newQty,
                    actorUserId,
                },
            });

            return updatedBatch;
        });
    }

    async disposeBatch(
        id: string,
        dto: DisposeBatchDto,
        actorUserId: string
    ) {
        const batch = await this.prisma.inventoryBatch.findUnique({
            where: { id },
            include: {
                product: { select: { id: true, name: true } },
            },
        });
        if (!batch) throw new NotFoundException("Batch not found");

        if (batch.qtyRemaining === 0) {
            throw new ConflictException("Batch is already depleted");
        }

        const updatedBatch = await this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
            const updated = await tx.inventoryBatch.update({
                where: { id },
                data: {
                    qtyRemaining: 0,
                    isActive: false,
                    depletedAt: new Date(),
                },
            });

            await tx.batchMovement.create({
                data: {
                    batchId: id,
                    qty: -batch.qtyRemaining,
                    movementType: "disposal",
                    referenceType: "manual",
                    disposalReason: dto.reason,
                    disposalNotes: dto.notes,
                    previousQty: batch.qtyRemaining,
                    newQty: 0,
                    actorUserId,
                },
            });

            return updated;
        });

        // Emit webhook event for batch depleted (via disposal)
        await this.webhookService.emit("inventory.batch.depleted", batch.campgroundId, {
            batchId: batch.id,
            productId: batch.productId,
            productName: batch.product.name,
            batchNumber: batch.batchNumber,
            locationId: batch.locationId,
            reason: "disposal",
            disposalReason: dto.reason,
        });

        return updatedBatch;
    }

    // ==================== FEFO ALLOCATION ====================

    /**
     * Allocate inventory using FEFO (First Expiring, First Out) algorithm.
     * Returns batch allocations ordered by expiration date (earliest first).
     * Non-perishable batches (null expiration) are allocated last.
     *
     * @throws InsufficientBatchInventoryException if not enough stock
     * @throws ExpiredBatchException if allowExpired=false and batch is expired
     */
    async allocateFEFO(
        productId: string,
        locationId: string | null,
        requestedQty: number,
        options?: {
            allowExpired?: boolean;
            previewOnly?: boolean; // Don't throw errors, just return what's available
        }
    ): Promise<BatchAllocation[]> {
        const now = new Date();

        // Get active batches sorted by FEFO order:
        // 1. Earliest expiration date first
        // 2. NULL expiration dates last (non-perishables)
        // 3. Within same expiration: earliest received first
        const batches = await this.prisma.inventoryBatch.findMany({
            where: {
                productId,
                isActive: true,
                qtyRemaining: { gt: 0 },
                ...(locationId ? { locationId } : {}),
            },
            orderBy: [
                { expirationDate: { sort: "asc", nulls: "last" } },
                { receivedDate: "asc" },
            ],
        });

        const allocations: BatchAllocation[] = [];
        let remaining = requestedQty;

        for (const batch of batches) {
            if (remaining <= 0) break;

            // Check if batch is expired
            if (batch.expirationDate && batch.expirationDate < now) {
                if (!options?.allowExpired && !options?.previewOnly) {
                    throw new ExpiredBatchException(
                        productId,
                        batch.id,
                        batch.expirationDate
                    );
                }
                // Skip expired batches in preview mode unless allowExpired
                if (options?.previewOnly && !options?.allowExpired) continue;
            }

            const allocateQty = Math.min(batch.qtyRemaining, remaining);
            const daysUntilExpiration = batch.expirationDate
                ? Math.ceil((batch.expirationDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
                : null;

            allocations.push({
                batchId: batch.id,
                qty: allocateQty,
                expirationDate: batch.expirationDate,
                unitCostCents: batch.unitCostCents,
                daysUntilExpiration,
            });

            remaining -= allocateQty;
        }

        // Check if we have enough
        if (remaining > 0 && !options?.previewOnly) {
            const totalAvailable = batches.reduce((sum, b) => sum + b.qtyRemaining, 0);
            throw new InsufficientBatchInventoryException(
                productId,
                requestedQty,
                totalAvailable
            );
        }

        return allocations;
    }

    /**
     * Deduct inventory from batches using FEFO allocation.
     * Creates movement records for audit trail.
     */
    async deductFromBatches(
        campgroundId: string,
        allocations: BatchAllocation[],
        actorUserId: string,
        referenceType?: string,
        referenceId?: string
    ): Promise<void> {
        // Track depleted batches for webhook emission after transaction
        const depletedBatches: Array<{
            batchId: string;
            productId: string;
            productName: string;
            locationId: string | null;
            batchNumber: string | null;
        }> = [];

        await this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
            for (const alloc of allocations) {
                const batch = await tx.inventoryBatch.findUnique({
                    where: { id: alloc.batchId },
                    include: {
                        product: { select: { name: true } },
                    },
                });

                if (!batch) continue;

                const newQty = batch.qtyRemaining - alloc.qty;
                const isDepleted = newQty <= 0;

                // Update batch
                await tx.inventoryBatch.update({
                    where: { id: alloc.batchId },
                    data: {
                        qtyRemaining: Math.max(0, newQty),
                        isActive: !isDepleted,
                        depletedAt: isDepleted ? new Date() : null,
                    },
                });

                // Track depleted batches for webhook
                if (isDepleted) {
                    depletedBatches.push({
                        batchId: batch.id,
                        productId: batch.productId,
                        productName: batch.product.name,
                        locationId: batch.locationId,
                        batchNumber: batch.batchNumber,
                    });
                }

                // Create inventory movement
                const movement = await tx.inventoryMovement.create({
                    data: {
                        campgroundId,
                        productId: batch.productId,
                        locationId: batch.locationId,
                        batchId: batch.id,
                        movementType: "sale",
                        qty: -alloc.qty,
                        previousQty: batch.qtyRemaining,
                        newQty: Math.max(0, newQty),
                        referenceType,
                        referenceId,
                        actorUserId,
                    },
                });

                // Create batch movement for detailed audit
                await tx.batchMovement.create({
                    data: {
                        batchId: alloc.batchId,
                        movementId: movement.id,
                        qty: -alloc.qty,
                        movementType: "sale",
                        referenceType,
                        referenceId,
                        previousQty: batch.qtyRemaining,
                        newQty: Math.max(0, newQty),
                        actorUserId,
                    },
                });
            }
        });

        // Emit webhook events for depleted batches after transaction commits
        for (const depleted of depletedBatches) {
            await this.webhookService.emit("inventory.batch.depleted", campgroundId, {
                batchId: depleted.batchId,
                productId: depleted.productId,
                productName: depleted.productName,
                batchNumber: depleted.batchNumber,
                locationId: depleted.locationId,
            });
        }
    }

    /**
     * Return inventory to batches (for order cancellations/returns).
     * Attempts to return to original batch if still available.
     */
    async returnToBatches(
        campgroundId: string,
        items: Array<{ batchId: string; qty: number }>,
        actorUserId: string,
        referenceType?: string,
        referenceId?: string
    ): Promise<void> {
        await this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
            for (const item of items) {
                const batch = await tx.inventoryBatch.findUnique({
                    where: { id: item.batchId },
                });

                if (!batch) continue;

                const newQty = batch.qtyRemaining + item.qty;

                // Update batch
                await tx.inventoryBatch.update({
                    where: { id: item.batchId },
                    data: {
                        qtyRemaining: newQty,
                        isActive: true,
                        depletedAt: null,
                    },
                });

                // Create inventory movement
                const movement = await tx.inventoryMovement.create({
                    data: {
                        campgroundId,
                        productId: batch.productId,
                        locationId: batch.locationId,
                        batchId: batch.id,
                        movementType: "return",
                        qty: item.qty,
                        previousQty: batch.qtyRemaining,
                        newQty,
                        referenceType,
                        referenceId,
                        actorUserId,
                    },
                });

                // Create batch movement
                await tx.batchMovement.create({
                    data: {
                        batchId: item.batchId,
                        movementId: movement.id,
                        qty: item.qty,
                        movementType: "return",
                        referenceType,
                        referenceId,
                        previousQty: batch.qtyRemaining,
                        newQty,
                        actorUserId,
                    },
                });
            }
        });
    }

    // ==================== EXPIRATION HELPERS ====================

    /**
     * Get expiration tier for a batch based on category/product thresholds.
     */
    async getExpirationTier(
        batch: { productId: string; expirationDate: Date | null }
    ): Promise<ExpirationTier> {
        if (!batch.expirationDate) return ExpirationTier.fresh;

        const now = new Date();
        const daysUntilExpiration = Math.ceil(
            (batch.expirationDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
        );

        if (daysUntilExpiration < 0) return ExpirationTier.expired;

        // Get thresholds from product config or category config
        const product = await this.prisma.product.findUnique({
            where: { id: batch.productId },
            include: {
                expirationConfigs: true,
                category: {
                    include: {
                        expirationConfigs: true,
                    },
                },
            },
        });

        if (!product) return ExpirationTier.fresh;

        // Product-level overrides take precedence
        const productConfig = product.expirationConfigs?.[0];
        const categoryConfig = product.category?.expirationConfigs?.[0];

        const warningDays = productConfig?.warningDays
            ?? categoryConfig?.warningDays
            ?? product.category?.defaultWarningDays
            ?? 7;
        const criticalDays = productConfig?.criticalDays
            ?? categoryConfig?.criticalDays
            ?? product.category?.defaultCriticalDays
            ?? 2;

        if (daysUntilExpiration <= criticalDays) return ExpirationTier.critical;
        if (daysUntilExpiration <= warningDays) return ExpirationTier.warning;
        return ExpirationTier.fresh;
    }

    /**
     * Get expiration summary for dashboard.
     */
    async getExpirationSummary(campgroundId: string) {
        const now = new Date();

        // Get all active batches with expiration dates
        const batches = await this.prisma.inventoryBatch.findMany({
            where: {
                campgroundId,
                isActive: true,
                qtyRemaining: { gt: 0 },
                expirationDate: { not: null },
            },
            include: {
                product: {
                    include: {
                        category: true,
                        expirationConfigs: true,
                    },
                },
            },
        });

        const summary = {
            fresh: 0,
            warning: 0,
            critical: 0,
            expired: 0,
            totalValue: 0,
            batches: [] as Array<{
                batchId: string;
                productName: string;
                qty: number;
                expirationDate: Date;
                tier: ExpirationTier;
                daysRemaining: number;
            }>,
        };

        for (const batch of batches) {
            const tier = await this.getExpirationTier(batch);
            summary[tier]++;

            const daysRemaining = Math.ceil(
                (batch.expirationDate!.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
            );

            if (tier !== ExpirationTier.fresh) {
                summary.batches.push({
                    batchId: batch.id,
                    productName: batch.product.name,
                    qty: batch.qtyRemaining,
                    expirationDate: batch.expirationDate!,
                    tier,
                    daysRemaining,
                });

                // Add to total value at cost
                if (batch.unitCostCents) {
                    summary.totalValue += batch.qtyRemaining * batch.unitCostCents;
                }
            }
        }

        // Sort batches by days remaining (most urgent first)
        summary.batches.sort((a, b) => a.daysRemaining - b.daysRemaining);

        return summary;
    }

    /**
     * Get total batch stock for a product (for inventory calculations).
     */
    async getBatchStock(productId: string, locationId?: string): Promise<number> {
        const result = await this.prisma.inventoryBatch.aggregate({
            where: {
                productId,
                isActive: true,
                qtyRemaining: { gt: 0 },
                ...(locationId ? { locationId } : {}),
            },
            _sum: { qtyRemaining: true },
        });

        return result._sum.qtyRemaining ?? 0;
    }
}
