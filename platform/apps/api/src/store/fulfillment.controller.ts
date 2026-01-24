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
import type { Request } from "express";
import { FulfillmentService } from "./fulfillment.service";
import { JwtAuthGuard } from "../auth/guards";
import { RolesGuard } from "../auth/guards/roles.guard";
import { ScopeGuard } from "../permissions/scope.guard";
import { FulfillmentAssignmentStatus } from "@prisma/client";
import type { AuthUser } from "../auth/auth.types";

type FulfillmentRequest = Request & {
  user?: AuthUser;
  campgroundId?: string | null;
};

@UseGuards(JwtAuthGuard, RolesGuard, ScopeGuard)
@Controller()
export class FulfillmentController {
  constructor(private readonly fulfillmentService: FulfillmentService) {}

  private requireCampgroundId(req: FulfillmentRequest, fallback?: string): string {
    const headerValue = req.headers["x-campground-id"];
    const headerCampgroundId = Array.isArray(headerValue) ? headerValue[0] : headerValue;
    const campgroundId = fallback ?? req.campgroundId ?? headerCampgroundId ?? undefined;
    if (!campgroundId) {
      throw new BadRequestException("campgroundId is required");
    }
    return campgroundId;
  }

  private requireUserId(req: FulfillmentRequest): string {
    const userId = req.user?.id;
    if (!userId) {
      throw new BadRequestException("User not found");
    }
    return userId;
  }

  private assertCampgroundAccess(campgroundId: string, user: AuthUser | null | undefined): void {
    const isPlatformStaff =
      user?.platformRole === "platform_admin" ||
      user?.platformRole === "support_agent" ||
      user?.platformRole === "support_lead" ||
      user?.platformRole === "regional_support" ||
      user?.platformRole === "ops_engineer";
    if (isPlatformStaff) {
      return;
    }

    const userCampgroundIds = user?.memberships?.map((membership) => membership.campgroundId) ?? [];
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
    @Req() req: FulfillmentRequest,
    @Query("status") status?: string,
    @Query("locationId") locationId?: string,
    @Query("limit") limit?: string,
  ) {
    this.assertCampgroundAccess(campgroundId, req.user);
    const statusValues: Set<string> = new Set(Object.values(FulfillmentAssignmentStatus));
    const statusFilter = status
      ? status
          .split(",")
          .filter((value): value is FulfillmentAssignmentStatus => statusValues.has(value))
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
  getFulfillmentCounts(
    @Param("campgroundId") campgroundId: string,
    @Req() req: FulfillmentRequest,
  ) {
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
    @Req() req: FulfillmentRequest,
    @Query("campgroundId") campgroundId?: string,
  ) {
    const userId = this.requireUserId(req);
    const requiredCampgroundId = this.requireCampgroundId(req, campgroundId);
    this.assertCampgroundAccess(requiredCampgroundId, req.user);
    return this.fulfillmentService.assignToLocation(
      requiredCampgroundId,
      orderId,
      body.locationId,
      userId,
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
    @Req() req: FulfillmentRequest,
    @Query("campgroundId") campgroundId?: string,
  ) {
    const userId = this.requireUserId(req);
    const requiredCampgroundId = this.requireCampgroundId(req, campgroundId);
    this.assertCampgroundAccess(requiredCampgroundId, req.user);
    return this.fulfillmentService.updateFulfillmentStatus(
      requiredCampgroundId,
      orderId,
      body.status,
      userId,
    );
  }

  /**
   * GET /store/locations/:id/fulfillment-orders
   * Get orders assigned to a specific location
   */
  @Get("store/locations/:id/fulfillment-orders")
  getLocationOrders(
    @Param("id") locationId: string,
    @Req() req: FulfillmentRequest,
    @Query("includeCompleted") includeCompleted?: string,
    @Query("campgroundId") campgroundId?: string,
  ) {
    const requiredCampgroundId = this.requireCampgroundId(req, campgroundId);
    this.assertCampgroundAccess(requiredCampgroundId, req.user);
    return this.fulfillmentService.getLocationOrders(
      requiredCampgroundId,
      locationId,
      includeCompleted === "true",
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
    @Req() req: FulfillmentRequest,
  ) {
    const userId = this.requireUserId(req);
    this.assertCampgroundAccess(campgroundId, req.user);
    return this.fulfillmentService.bulkAssignToLocation(
      campgroundId,
      body.orderIds,
      body.locationId,
      userId,
    );
  }
}
