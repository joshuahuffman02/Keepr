import { Injectable, NotFoundException, BadRequestException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { FulfillmentAssignmentStatus, OrderChannel } from "@prisma/client";

@Injectable()
export class FulfillmentService {
    constructor(private readonly prisma: PrismaService) {}

    /**
     * Get the fulfillment queue - online orders awaiting assignment or in progress
     */
    async getFulfillmentQueue(
        campgroundId: string,
        filters?: {
            status?: FulfillmentAssignmentStatus | FulfillmentAssignmentStatus[];
            locationId?: string;
            limit?: number;
        }
    ) {
        const statusFilter = filters?.status
            ? Array.isArray(filters.status)
                ? { in: filters.status }
                : filters.status
            : { in: ["unassigned", "assigned", "preparing", "ready"] as FulfillmentAssignmentStatus[] };

        const orders = await this.prisma.storeOrder.findMany({
            where: {
                campgroundId,
                channel: OrderChannel.online,
                fulfillmentStatus: statusFilter,
                ...(filters?.locationId && { fulfillmentLocationId: filters.locationId }),
            },
            include: {
                items: {
                    include: {
                        product: { select: { id: true, name: true, imageUrl: true } },
                    },
                },
                guest: { select: { id: true, firstName: true, lastName: true, email: true, phone: true } },
                reservation: { select: { id: true, siteId: true } },
                fulfillmentLocation: { select: { id: true, name: true, code: true } },
                assignedBy: { select: { id: true, name: true, email: true } },
            },
            orderBy: [{ promisedAt: "asc" }, { createdAt: "asc" }],
            take: filters?.limit || 50,
        });

        return orders;
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

        return counts.reduce(
            (acc, item) => {
                acc[item.fulfillmentStatus] = item._count.id;
                return acc;
            },
            {} as Record<FulfillmentAssignmentStatus, number>
        );
    }

    /**
     * Assign an order to a location for fulfillment
     */
    async assignToLocation(orderId: string, locationId: string, assignedById: string) {
        const order = await this.prisma.storeOrder.findUnique({
            where: { id: orderId },
            include: { fulfillmentLocation: true },
        });

        if (!order) {
            throw new NotFoundException(`Order ${orderId} not found`);
        }

        // Verify the location exists and belongs to the same campground
        const location = await this.prisma.storeLocation.findFirst({
            where: {
                id: locationId,
                campgroundId: order.campgroundId,
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
                items: true,
                fulfillmentLocation: { select: { id: true, name: true, code: true } },
            },
        });

        return updated;
    }

    /**
     * Update the fulfillment status of an order
     */
    async updateFulfillmentStatus(
        orderId: string,
        status: FulfillmentAssignmentStatus,
        actorUserId: string
    ) {
        const order = await this.prisma.storeOrder.findUnique({
            where: { id: orderId },
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
                `Cannot transition from ${order.fulfillmentStatus} to ${status}`
            );
        }

        // If completing, mark the order as completed too
        const updateData: any = {
            fulfillmentStatus: status,
        };

        if (status === FulfillmentAssignmentStatus.completed) {
            updateData.completedAt = new Date();
            updateData.completedById = actorUserId;
            updateData.status = "completed";
        }

        const updated = await this.prisma.storeOrder.update({
            where: { id: orderId },
            data: updateData,
            include: {
                items: true,
                fulfillmentLocation: { select: { id: true, name: true, code: true } },
            },
        });

        return updated;
    }

    /**
     * Get orders assigned to a specific location
     */
    async getLocationOrders(locationId: string, includeCompleted = false) {
        const orders = await this.prisma.storeOrder.findMany({
            where: {
                fulfillmentLocationId: locationId,
                fulfillmentStatus: includeCompleted
                    ? undefined
                    : { in: ["assigned", "preparing", "ready"] as FulfillmentAssignmentStatus[] },
            },
            include: {
                items: {
                    include: {
                        product: { select: { id: true, name: true, imageUrl: true } },
                    },
                },
                guest: { select: { id: true, firstName: true, lastName: true, phone: true } },
            },
            orderBy: [{ promisedAt: "asc" }, { createdAt: "asc" }],
        });

        return orders;
    }

    /**
     * Bulk assign multiple orders to a location
     */
    async bulkAssignToLocation(
        orderIds: string[],
        locationId: string,
        assignedById: string
    ) {
        // Verify location
        const firstOrder = await this.prisma.storeOrder.findFirst({
            where: { id: { in: orderIds } },
        });

        if (!firstOrder) {
            throw new NotFoundException("No orders found");
        }

        const location = await this.prisma.storeLocation.findFirst({
            where: {
                id: locationId,
                campgroundId: firstOrder.campgroundId,
                isActive: true,
                acceptsOnline: true,
            },
        });

        if (!location) {
            throw new NotFoundException(`Location ${locationId} not found or cannot accept online orders`);
        }

        const result = await this.prisma.storeOrder.updateMany({
            where: {
                id: { in: orderIds },
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
