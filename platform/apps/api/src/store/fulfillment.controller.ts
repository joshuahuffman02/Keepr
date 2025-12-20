import {
    Body,
    Controller,
    Get,
    Param,
    Patch,
    Post,
    Query,
    Req,
    UseGuards,
} from "@nestjs/common";
import { FulfillmentService } from "./fulfillment.service";
import { JwtAuthGuard } from "../auth/guards";
import { FulfillmentAssignmentStatus } from "@prisma/client";

@UseGuards(JwtAuthGuard)
@Controller()
export class FulfillmentController {
    constructor(private readonly fulfillmentService: FulfillmentService) {}

    /**
     * GET /campgrounds/:campgroundId/store/orders/fulfillment-queue
     * Get online orders awaiting fulfillment or in progress
     */
    @Get("campgrounds/:campgroundId/store/orders/fulfillment-queue")
    getFulfillmentQueue(
        @Param("campgroundId") campgroundId: string,
        @Query("status") status?: string,
        @Query("locationId") locationId?: string,
        @Query("limit") limit?: string
    ) {
        const statusFilter = status
            ? (status.split(",") as FulfillmentAssignmentStatus[])
            : undefined;

        return this.fulfillmentService.getFulfillmentQueue(campgroundId, {
            status: statusFilter,
            locationId,
            limit: limit ? parseInt(limit, 10) : undefined,
        });
    }

    /**
     * GET /campgrounds/:campgroundId/store/orders/fulfillment-counts
     * Get count of orders in each fulfillment status
     */
    @Get("campgrounds/:campgroundId/store/orders/fulfillment-counts")
    getFulfillmentCounts(@Param("campgroundId") campgroundId: string) {
        return this.fulfillmentService.getFulfillmentCounts(campgroundId);
    }

    /**
     * PATCH /store/orders/:id/assign-location
     * Assign an order to a location for fulfillment
     */
    @Patch("store/orders/:id/assign-location")
    assignToLocation(
        @Param("id") orderId: string,
        @Body() body: { locationId: string },
        @Req() req: any
    ) {
        const userId = req.user?.id || req.user?.userId;
        return this.fulfillmentService.assignToLocation(orderId, body.locationId, userId);
    }

    /**
     * PATCH /store/orders/:id/fulfillment-status
     * Update the fulfillment status of an order
     */
    @Patch("store/orders/:id/fulfillment-status")
    updateFulfillmentStatus(
        @Param("id") orderId: string,
        @Body() body: { status: FulfillmentAssignmentStatus },
        @Req() req: any
    ) {
        const userId = req.user?.id || req.user?.userId;
        return this.fulfillmentService.updateFulfillmentStatus(orderId, body.status, userId);
    }

    /**
     * GET /store/locations/:id/fulfillment-orders
     * Get orders assigned to a specific location
     */
    @Get("store/locations/:id/fulfillment-orders")
    getLocationOrders(
        @Param("id") locationId: string,
        @Query("includeCompleted") includeCompleted?: string
    ) {
        return this.fulfillmentService.getLocationOrders(
            locationId,
            includeCompleted === "true"
        );
    }

    /**
     * POST /campgrounds/:campgroundId/store/orders/bulk-assign
     * Bulk assign multiple orders to a location
     */
    @Post("campgrounds/:campgroundId/store/orders/bulk-assign")
    bulkAssignToLocation(
        @Param("campgroundId") _campgroundId: string,
        @Body() body: { orderIds: string[]; locationId: string },
        @Req() req: any
    ) {
        const userId = req.user?.id || req.user?.userId;
        return this.fulfillmentService.bulkAssignToLocation(
            body.orderIds,
            body.locationId,
            userId
        );
    }
}
