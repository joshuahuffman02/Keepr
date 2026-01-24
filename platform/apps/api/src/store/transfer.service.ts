import {
  Injectable,
  ConflictException,
  NotFoundException,
  BadRequestException,
} from "@nestjs/common";
import { Prisma, InventoryTransferStatus } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { randomUUID } from "crypto";

export interface CreateTransferDto {
  campgroundId: string;
  fromLocationId: string;
  toLocationId: string;
  items: Array<{ productId: string; qty: number }>;
  notes?: string;
}

export interface TransferItemDto {
  productId: string;
  qty: number;
}

const transferInclude = {
  StoreLocation_InventoryTransfer_fromLocationIdToStoreLocation: {
    select: { id: true, name: true, code: true },
  },
  StoreLocation_InventoryTransfer_toLocationIdToStoreLocation: {
    select: { id: true, name: true, code: true },
  },
  User_InventoryTransfer_requestedByIdToUser: {
    select: { id: true, firstName: true, lastName: true },
  },
  User_InventoryTransfer_approvedByIdToUser: {
    select: { id: true, firstName: true, lastName: true },
  },
  User_InventoryTransfer_completedByIdToUser: {
    select: { id: true, firstName: true, lastName: true },
  },
  InventoryTransferItem: {
    include: {
      Product: { select: { id: true, name: true, sku: true, priceCents: true } },
    },
  },
  _count: { select: { InventoryTransferItem: true } },
} satisfies Prisma.InventoryTransferInclude;

type TransferWithRelations = Prisma.InventoryTransferGetPayload<{
  include: typeof transferInclude;
}>;

const normalizeTransfer = (transfer: TransferWithRelations) => {
  const {
    StoreLocation_InventoryTransfer_fromLocationIdToStoreLocation: fromLocation,
    StoreLocation_InventoryTransfer_toLocationIdToStoreLocation: toLocation,
    User_InventoryTransfer_requestedByIdToUser: requestedBy,
    User_InventoryTransfer_approvedByIdToUser: approvedBy,
    User_InventoryTransfer_completedByIdToUser: completedBy,
    InventoryTransferItem,
    _count,
    ...rest
  } = transfer;

  const items = InventoryTransferItem.map((item) => {
    const { Product, ...itemRest } = item;
    return { ...itemRest, product: Product };
  });

  return {
    ...rest,
    fromLocation,
    toLocation,
    requestedBy,
    approvedBy,
    completedBy,
    items,
    _count: _count ? { items: _count.InventoryTransferItem } : undefined,
  };
};

@Injectable()
export class TransferService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * List all transfers for a campground
   */
  async listTransfers(
    campgroundId: string,
    filters?: {
      status?: InventoryTransferStatus;
      fromLocationId?: string;
      toLocationId?: string;
    },
  ) {
    const transfers = await this.prisma.inventoryTransfer.findMany({
      where: {
        campgroundId,
        ...(filters?.status ? { status: filters.status } : {}),
        ...(filters?.fromLocationId ? { fromLocationId: filters.fromLocationId } : {}),
        ...(filters?.toLocationId ? { toLocationId: filters.toLocationId } : {}),
      },
      include: transferInclude,
      orderBy: { createdAt: "desc" },
    });

    return transfers.map(normalizeTransfer);
  }

  /**
   * Get a single transfer by ID
   */
  async getTransfer(campgroundId: string, id: string) {
    const transfer = await this.prisma.inventoryTransfer.findFirst({
      where: { id, campgroundId },
      include: transferInclude,
    });

    if (!transfer) throw new NotFoundException("Transfer not found");
    return normalizeTransfer(transfer);
  }

  /**
   * Create a new inventory transfer request
   */
  async createTransfer(data: CreateTransferDto, requestedById: string) {
    // Validate locations exist and are different
    if (data.fromLocationId === data.toLocationId) {
      throw new BadRequestException("Cannot transfer to the same location");
    }

    const [fromLocation, toLocation] = await Promise.all([
      this.prisma.storeLocation.findFirst({
        where: { id: data.fromLocationId, campgroundId: data.campgroundId },
      }),
      this.prisma.storeLocation.findFirst({
        where: { id: data.toLocationId, campgroundId: data.campgroundId },
      }),
    ]);

    if (!fromLocation) throw new NotFoundException("Source location not found");
    if (!toLocation) throw new NotFoundException("Destination location not found");

    // Validate items
    if (!data.items || data.items.length === 0) {
      throw new BadRequestException("At least one item is required");
    }

    // Verify products exist and have sufficient stock
    for (const item of data.items) {
      if (item.qty <= 0) {
        throw new BadRequestException("Quantity must be positive");
      }

      const product = await this.prisma.product.findFirst({
        where: { id: item.productId, campgroundId: data.campgroundId },
      });
      if (!product) throw new NotFoundException(`Product ${item.productId} not found`);

      // Check stock at source location
      const inventory = await this.prisma.locationInventory.findUnique({
        where: {
          productId_locationId: { productId: item.productId, locationId: data.fromLocationId },
        },
      });

      if (!inventory || inventory.stockQty < item.qty) {
        throw new BadRequestException(
          `Insufficient stock for ${product.name} at source location (have: ${inventory?.stockQty ?? 0}, need: ${item.qty})`,
        );
      }
    }

    // Create transfer with items
    const transfer = await this.prisma.inventoryTransfer.create({
      data: {
        id: randomUUID(),
        campgroundId: data.campgroundId,
        fromLocationId: data.fromLocationId,
        toLocationId: data.toLocationId,
        status: "pending",
        notes: data.notes,
        requestedById,
        InventoryTransferItem: {
          create: data.items.map((item) => ({
            id: randomUUID(),
            productId: item.productId,
            qty: item.qty,
          })),
        },
      },
      include: transferInclude,
    });

    return normalizeTransfer(transfer);
  }

  /**
   * Approve a pending transfer (marks it as in_transit)
   */
  async approveTransfer(campgroundId: string, id: string, approvedById: string) {
    const transfer = await this.prisma.inventoryTransfer.findFirst({
      where: { id, campgroundId },
      include: {
        InventoryTransferItem: {
          include: { Product: { select: { id: true, name: true, sku: true, priceCents: true } } },
        },
      },
    });

    if (!transfer) throw new NotFoundException("Transfer not found");
    if (transfer.status !== "pending") {
      throw new ConflictException(`Cannot approve transfer with status: ${transfer.status}`);
    }

    // Re-verify stock availability
    for (const item of transfer.InventoryTransferItem) {
      const inventory = await this.prisma.locationInventory.findUnique({
        where: {
          productId_locationId: { productId: item.productId, locationId: transfer.fromLocationId },
        },
      });

      if (!inventory || inventory.stockQty < item.qty) {
        throw new BadRequestException(
          `Insufficient stock for product ${item.productId} (need: ${item.qty}, have: ${inventory?.stockQty ?? 0})`,
        );
      }
    }

    const updated = await this.prisma.inventoryTransfer.update({
      where: { id },
      data: {
        status: "in_transit",
        approvedById,
        approvedAt: new Date(),
      },
      include: transferInclude,
    });

    return normalizeTransfer(updated);
  }

  /**
   * Complete a transfer (actually moves the inventory)
   */
  async completeTransfer(campgroundId: string, id: string, completedById: string) {
    const transfer = await this.prisma.inventoryTransfer.findFirst({
      where: { id, campgroundId },
      include: {
        InventoryTransferItem: { include: { Product: true } },
        StoreLocation_InventoryTransfer_fromLocationIdToStoreLocation: true,
        StoreLocation_InventoryTransfer_toLocationIdToStoreLocation: true,
      },
    });

    if (!transfer) throw new NotFoundException("Transfer not found");
    if (transfer.status !== "in_transit" && transfer.status !== "pending") {
      throw new ConflictException(`Cannot complete transfer with status: ${transfer.status}`);
    }

    // Execute transfer in a transaction
    return this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const now = new Date();

      for (const item of transfer.InventoryTransferItem) {
        // Get current stock at both locations
        const [fromInventory, toInventory] = await Promise.all([
          tx.locationInventory.findUnique({
            where: {
              productId_locationId: {
                productId: item.productId,
                locationId: transfer.fromLocationId,
              },
            },
          }),
          tx.locationInventory.findUnique({
            where: {
              productId_locationId: {
                productId: item.productId,
                locationId: transfer.toLocationId,
              },
            },
          }),
        ]);

        const fromPrevQty = fromInventory?.stockQty ?? 0;
        const toPrevQty = toInventory?.stockQty ?? 0;

        if (fromPrevQty < item.qty) {
          throw new BadRequestException(
            `Insufficient stock for ${item.Product.name} (need: ${item.qty}, have: ${fromPrevQty})`,
          );
        }

        const fromNewQty = fromPrevQty - item.qty;
        const toNewQty = toPrevQty + item.qty;

        // Update source location (decrease stock)
        await tx.locationInventory.upsert({
          where: {
            productId_locationId: {
              productId: item.productId,
              locationId: transfer.fromLocationId,
            },
          },
          create: {
            id: randomUUID(),
            productId: item.productId,
            locationId: transfer.fromLocationId,
            stockQty: fromNewQty,
          },
          update: { stockQty: fromNewQty },
        });

        // Update destination location (increase stock)
        await tx.locationInventory.upsert({
          where: {
            productId_locationId: { productId: item.productId, locationId: transfer.toLocationId },
          },
          create: {
            id: randomUUID(),
            productId: item.productId,
            locationId: transfer.toLocationId,
            stockQty: toNewQty,
          },
          update: { stockQty: toNewQty },
        });

        // Log transfer_out movement
        await tx.inventoryMovement.create({
          data: {
            id: randomUUID(),
            campgroundId: transfer.campgroundId,
            productId: item.productId,
            locationId: transfer.fromLocationId,
            movementType: "transfer_out",
            qty: -item.qty,
            previousQty: fromPrevQty,
            newQty: fromNewQty,
            referenceType: "transfer",
            referenceId: transfer.id,
            actorUserId: completedById,
          },
        });

        // Log transfer_in movement
        await tx.inventoryMovement.create({
          data: {
            id: randomUUID(),
            campgroundId: transfer.campgroundId,
            productId: item.productId,
            locationId: transfer.toLocationId,
            movementType: "transfer_in",
            qty: item.qty,
            previousQty: toPrevQty,
            newQty: toNewQty,
            referenceType: "transfer",
            referenceId: transfer.id,
            actorUserId: completedById,
          },
        });
      }

      // Update transfer status
      const updated = await tx.inventoryTransfer.update({
        where: { id },
        data: {
          status: "completed",
          completedById,
          completedAt: now,
          // If not previously approved, approve now
          ...(transfer.status === "pending"
            ? { approvedById: completedById, approvedAt: now }
            : {}),
        },
        include: transferInclude,
      });

      return normalizeTransfer(updated);
    });
  }

  /**
   * Cancel a pending or in_transit transfer
   */
  async cancelTransfer(campgroundId: string, id: string, cancelledById: string) {
    const transfer = await this.prisma.inventoryTransfer.findFirst({
      where: { id, campgroundId },
    });

    if (!transfer) throw new NotFoundException("Transfer not found");
    if (transfer.status === "completed") {
      throw new ConflictException("Cannot cancel a completed transfer");
    }
    if (transfer.status === "cancelled") {
      throw new ConflictException("Transfer is already cancelled");
    }

    return this.prisma.inventoryTransfer.update({
      where: { id },
      data: {
        status: "cancelled",
        // Store who cancelled it in notes
        notes: transfer.notes
          ? `${transfer.notes}\n[Cancelled by user ${cancelledById}]`
          : `[Cancelled by user ${cancelledById}]`,
      },
    });
  }
}
