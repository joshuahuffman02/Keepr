import {
    BadRequestException,
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
import { RolesGuard } from "../auth/guards/roles.guard";
import { ScopeGuard } from "../permissions/scope.guard";
import { FulfillmentAssignmentStatus } from "@prisma/client";

@UseGuards(JwtAuthGuard, RolesGuard, ScopeGuard)
@Controller()
export class FulfillmentController {
    constructor(private readonly fulfillmentService: FulfillmentService) {}

    private requireCampgroundId(req: any, fallback?: string): string {
        const campgroundId = fallback || req?.campgroundId || req?.headers?.["x-campground-id"];
        if (!campgroundId) {
            throw new BadRequestException("campgroundId is required");
        }
        return campgroundId;
    }

    private assertCampgroundAccess(campgroundId: string, user: any): void {
        const isPlatformStaff = user?.platformRole === "platform_admin" ||
                                user?.platformRole === "platform_superadmin" ||
                                user?.platformRole === "support_agent";
        if (isPlatformStaff) {
            return;
        }

        const userCampgroundIds = user?.memberships?.map((m: any) => m.campgroundId) ?? [];
        if (!userCampgroundIds.includes(campgroundId)) {
            throw new BadRequestException("You do not have access to this campground");
        }
    }

    /**
     * GET /campgrounds/:campgroundId/store/orders/fulfillment-queue
     * Get online orders awaiting fulfillment or in progress
     */
    @Get("campgrounds/:campgroundId/store/orders/fulfillment-queue")
    getFulfillmentQueue(
        @Param("campgroundId") campgroundId: string,
        @Query("status") status?: string,
        @Query("locationId") locationId?: string,
        @Query("limit") limit?: string,
        @Req() req?: any
    ) {
        this.assertCampgroundAccess(campgroundId, req?.user);
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
    getFulfillmentCounts(@Param("campgroundId") campgroundId: string, @Req() req: any) {
        this.assertCampgroundAccess(campgroundId, req.user);
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
        @Query("campgroundId") campgroundId: string | undefined,
        @Req() req: any
    ) {
        const userId = req.user?.id || req.user?.userId;
        const requiredCampgroundId = this.requireCampgroundId(req, campgroundId);
        this.assertCampgroundAccess(requiredCampgroundId, req.user);
        return this.fulfillmentService.assignToLocation(
            requiredCampgroundId,
            orderId,
            body.locationId,
            userId
        );
    }

    /**
     * PATCH /store/orders/:id/fulfillment-status
     * Update the fulfillment status of an order
     */
    @Patch("store/orders/:id/fulfillment-status")
    updateFulfillmentStatus(
        @Param("id") orderId: string,
        @Body() body: { status: FulfillmentAssignmentStatus },
        @Query("campgroundId") campgroundId: string | undefined,
        @Req() req: any
    ) {
        const userId = req.user?.id || req.user?.userId;
        const requiredCampgroundId = this.requireCampgroundId(req, campgroundId);
        this.assertCampgroundAccess(requiredCampgroundId, req.user);
        return this.fulfillmentService.updateFulfillmentStatus(
            requiredCampgroundId,
            orderId,
            body.status,
            userId
        );
    }

    /**
     * GET /store/locations/:id/fulfillment-orders
     * Get orders assigned to a specific location
     */
    @Get("store/locations/:id/fulfillment-orders")
    getLocationOrders(
        @Param("id") locationId: string,
        @Query("includeCompleted") includeCompleted?: string,
        @Query("campgroundId") campgroundId?: string,
        @Req() req?: any
    ) {
        const requiredCampgroundId = this.requireCampgroundId(req, campgroundId);
        this.assertCampgroundAccess(requiredCampgroundId, req?.user);
        return this.fulfillmentService.getLocationOrders(
            requiredCampgroundId,
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
        @Param("campgroundId") campgroundId: string,
        @Body() body: { orderIds: string[]; locationId: string },
        @Req() req: any
    ) {
        const userId = req.user?.id || req.user?.userId;
        this.assertCampgroundAccess(campgroundId, req.user);
        return this.fulfillmentService.bulkAssignToLocation(
            campgroundId,
            body.orderIds,
            body.locationId,
            userId
        );
    }
}
