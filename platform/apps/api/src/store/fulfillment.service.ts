import { Injectable, NotFoundException, BadRequestException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { FulfillmentAssignmentStatus, OrderChannel, OrderStatus } from "@prisma/client";
import type { Prisma } from "@prisma/client";

@Injectable()
export class FulfillmentService {
  constructor(private readonly prisma: PrismaService) {}

  private normalizeFulfillmentOrder(
    order: Prisma.StoreOrderGetPayload<{
      include: {
        StoreOrderItem: {
          include: { Product: { select: { id: true; name: true; imageUrl: true } } };
        };
        Guest: {
          select: {
            id: true;
            email: true;
            phone: true;
            primaryFirstName: true;
            primaryLastName: true;
          };
        };
        Reservation: { select: { id: true; siteId: true } };
        StoreLocation: { select: { id: true; name: true; code: true } };
        User_StoreOrder_assignedByIdToUser: {
          select: { id: true; email: true; firstName: true; lastName: true };
        };
      };
    }>,
  ) {
    const {
      StoreOrderItem,
      Guest,
      Reservation,
      StoreLocation,
      User_StoreOrder_assignedByIdToUser,
      ...rest
    } = order;

    const items = StoreOrderItem.map((item) => {
      const { Product, ...itemRest } = item;
      return { ...itemRest, product: Product, Product: undefined };
    });

    const assignedBy = User_StoreOrder_assignedByIdToUser
      ? {
          id: User_StoreOrder_assignedByIdToUser.id,
          name:
            `${User_StoreOrder_assignedByIdToUser.firstName} ${User_StoreOrder_assignedByIdToUser.lastName}`.trim() ||
            null,
          email: User_StoreOrder_assignedByIdToUser.email,
        }
      : null;

    const guest = Guest
      ? {
          id: Guest.id,
          firstName: Guest.primaryFirstName,
          lastName: Guest.primaryLastName,
          email: Guest.email,
          phone: Guest.phone,
        }
      : null;

    const reservation = Reservation ? { id: Reservation.id, siteId: Reservation.siteId } : null;

    return {
      ...rest,
      items,
      guest,
      reservation,
      fulfillmentLocation: StoreLocation,
      assignedBy,
      StoreOrderItem: undefined,
      Guest: undefined,
      Reservation: undefined,
      StoreLocation: undefined,
      User_StoreOrder_assignedByIdToUser: undefined,
    };
  }

  /**
   * Get the fulfillment queue - online orders awaiting assignment or in progress
   */
  async getFulfillmentQueue(
    campgroundId: string,
    filters?: {
      status?: FulfillmentAssignmentStatus | FulfillmentAssignmentStatus[];
      locationId?: string;
      limit?: number;
    },
  ) {
    const defaultStatuses: FulfillmentAssignmentStatus[] = [
      FulfillmentAssignmentStatus.unassigned,
      FulfillmentAssignmentStatus.assigned,
      FulfillmentAssignmentStatus.preparing,
      FulfillmentAssignmentStatus.ready,
    ];
    const statusFilter = filters?.status
      ? Array.isArray(filters.status)
        ? { in: filters.status }
        : filters.status
      : { in: defaultStatuses };

    const orders = await this.prisma.storeOrder.findMany({
      where: {
        campgroundId,
        channel: OrderChannel.online,
        fulfillmentStatus: statusFilter,
        ...(filters?.locationId && { fulfillmentLocationId: filters.locationId }),
      },
      include: {
        StoreOrderItem: {
          include: {
            Product: { select: { id: true, name: true, imageUrl: true } },
          },
        },
        Guest: {
          select: {
            id: true,
            email: true,
            phone: true,
            primaryFirstName: true,
            primaryLastName: true,
          },
        },
        Reservation: { select: { id: true, siteId: true } },
        StoreLocation: { select: { id: true, name: true, code: true } },
        User_StoreOrder_assignedByIdToUser: {
          select: { id: true, email: true, firstName: true, lastName: true },
        },
      },
      orderBy: [{ promisedAt: "asc" }, { createdAt: "asc" }],
      take: filters?.limit || 50,
    });

    return orders.map((order) => this.normalizeFulfillmentOrder(order));
  }

  /**
   * Get count of orders in each fulfillment status
   */
  async getFulfillmentCounts(campgroundId: string) {
    const counts = await this.prisma.storeOrder.groupBy({
      by: ["fulfillmentStatus"],
      where: {
        campgroundId,
        channel: OrderChannel.online,
      },
      _count: { id: true },
    });

    const base: Record<FulfillmentAssignmentStatus, number> = {
      [FulfillmentAssignmentStatus.unassigned]: 0,
      [FulfillmentAssignmentStatus.assigned]: 0,
      [FulfillmentAssignmentStatus.preparing]: 0,
      [FulfillmentAssignmentStatus.ready]: 0,
      [FulfillmentAssignmentStatus.completed]: 0,
    };
    return counts.reduce((acc, item) => {
      acc[item.fulfillmentStatus] = item._count.id;
      return acc;
    }, base);
  }

  /**
   * Assign an order to a location for fulfillment
   */
  async assignToLocation(
    campgroundId: string,
    orderId: string,
    locationId: string,
    assignedById: string,
  ) {
    const order = await this.prisma.storeOrder.findFirst({
      where: { id: orderId, campgroundId },
      include: { StoreLocation: true },
    });

    if (!order) {
      throw new NotFoundException(`Order ${orderId} not found`);
    }

    // Verify the location exists and belongs to the same campground
    const location = await this.prisma.storeLocation.findFirst({
      where: {
        id: locationId,
        campgroundId,
        isActive: true,
      },
    });

    if (!location) {
      throw new NotFoundException(`Location ${locationId} not found or inactive`);
    }

    if (!location.acceptsOnline) {
      throw new BadRequestException(`Location "${location.name}" does not accept online orders`);
    }

    const updated = await this.prisma.storeOrder.update({
      where: { id: orderId },
      data: {
        fulfillmentLocationId: locationId,
        fulfillmentStatus: FulfillmentAssignmentStatus.assigned,
        assignedAt: new Date(),
        assignedById,
      },
      include: {
        StoreOrderItem: {
          include: { Product: { select: { id: true, name: true, imageUrl: true } } },
        },
        Guest: {
          select: {
            id: true,
            email: true,
            phone: true,
            primaryFirstName: true,
            primaryLastName: true,
          },
        },
        Reservation: { select: { id: true, siteId: true } },
        StoreLocation: { select: { id: true, name: true, code: true } },
        User_StoreOrder_assignedByIdToUser: {
          select: { id: true, email: true, firstName: true, lastName: true },
        },
      },
    });

    return this.normalizeFulfillmentOrder(updated);
  }

  /**
   * Update the fulfillment status of an order
   */
  async updateFulfillmentStatus(
    campgroundId: string,
    orderId: string,
    status: FulfillmentAssignmentStatus,
    actorUserId: string,
  ) {
    const order = await this.prisma.storeOrder.findFirst({
      where: { id: orderId, campgroundId },
    });

    if (!order) {
      throw new NotFoundException(`Order ${orderId} not found`);
    }

    // Validate status transitions
    const validTransitions: Record<FulfillmentAssignmentStatus, FulfillmentAssignmentStatus[]> = {
      unassigned: ["assigned"],
      assigned: ["preparing", "unassigned"], // Can unassign if needed
      preparing: ["ready", "assigned"], // Can go back to assigned
      ready: ["completed", "preparing"], // Can go back to preparing
      completed: [], // Terminal state
    };

    if (!validTransitions[order.fulfillmentStatus].includes(status)) {
      throw new BadRequestException(
        `Cannot transition from ${order.fulfillmentStatus} to ${status}`,
      );
    }

    // If completing, mark the order as completed too
    const updateData =
      status === FulfillmentAssignmentStatus.completed
        ? {
            fulfillmentStatus: status,
            completedAt: new Date(),
            completedById: actorUserId,
            status: OrderStatus.completed,
          }
        : { fulfillmentStatus: status };

    const updated = await this.prisma.storeOrder.update({
      where: { id: orderId },
      data: updateData,
      include: {
        StoreOrderItem: {
          include: { Product: { select: { id: true, name: true, imageUrl: true } } },
        },
        Guest: {
          select: {
            id: true,
            email: true,
            phone: true,
            primaryFirstName: true,
            primaryLastName: true,
          },
        },
        Reservation: { select: { id: true, siteId: true } },
        StoreLocation: { select: { id: true, name: true, code: true } },
        User_StoreOrder_assignedByIdToUser: {
          select: { id: true, email: true, firstName: true, lastName: true },
        },
      },
    });

    return this.normalizeFulfillmentOrder(updated);
  }

  /**
   * Get orders assigned to a specific location
   */
  async getLocationOrders(campgroundId: string, locationId: string, includeCompleted = false) {
    const location = await this.prisma.storeLocation.findFirst({
      where: { id: locationId, campgroundId },
    });

    if (!location) {
      throw new NotFoundException(`Location ${locationId} not found`);
    }

    const activeStatuses: FulfillmentAssignmentStatus[] = ["assigned", "preparing", "ready"];
    const orders = await this.prisma.storeOrder.findMany({
      where: {
        campgroundId,
        fulfillmentLocationId: locationId,
        fulfillmentStatus: includeCompleted ? undefined : { in: activeStatuses },
      },
      include: {
        StoreOrderItem: {
          include: {
            Product: { select: { id: true, name: true, imageUrl: true } },
          },
        },
        Guest: {
          select: {
            id: true,
            email: true,
            phone: true,
            primaryFirstName: true,
            primaryLastName: true,
          },
        },
        Reservation: { select: { id: true, siteId: true } },
        StoreLocation: { select: { id: true, name: true, code: true } },
        User_StoreOrder_assignedByIdToUser: {
          select: { id: true, email: true, firstName: true, lastName: true },
        },
      },
      orderBy: [{ promisedAt: "asc" }, { createdAt: "asc" }],
    });

    return orders.map((order) => this.normalizeFulfillmentOrder(order));
  }

  /**
   * Bulk assign multiple orders to a location
   */
  async bulkAssignToLocation(
    campgroundId: string,
    orderIds: string[],
    locationId: string,
    assignedById: string,
  ) {
    // Verify location
    const location = await this.prisma.storeLocation.findFirst({
      where: {
        id: locationId,
        campgroundId,
        isActive: true,
        acceptsOnline: true,
      },
    });

    if (!location) {
      throw new NotFoundException(
        `Location ${locationId} not found or cannot accept online orders`,
      );
    }

    const firstOrder = await this.prisma.storeOrder.findFirst({
      where: { id: { in: orderIds }, campgroundId },
    });

    if (!firstOrder) {
      throw new NotFoundException("No orders found");
    }

    const result = await this.prisma.storeOrder.updateMany({
      where: {
        id: { in: orderIds },
        campgroundId,
        fulfillmentStatus: FulfillmentAssignmentStatus.unassigned,
      },
      data: {
        fulfillmentLocationId: locationId,
        fulfillmentStatus: FulfillmentAssignmentStatus.assigned,
        assignedAt: new Date(),
        assignedById,
      },
    });

    return { assignedCount: result.count };
  }
}
