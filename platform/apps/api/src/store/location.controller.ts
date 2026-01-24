import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from "@nestjs/common";
import type { Request } from "express";
import { LocationService } from "./location.service";
import {
  CreateStoreLocationDto,
  UpdateStoreLocationDto,
  SetLocationInventoryDto,
  AdjustLocationInventoryDto,
  CreateLocationPriceOverrideDto,
  UpdateLocationPriceOverrideDto,
} from "./dto/location.dto";
import { JwtAuthGuard } from "../auth/guards";
import { RolesGuard } from "../auth/guards/roles.guard";
import { ScopeGuard } from "../permissions/scope.guard";
import type { AuthUser } from "../auth/auth.types";

type LocationRequest = Request & {
  user?: AuthUser;
  campgroundId?: string | null;
};

@UseGuards(JwtAuthGuard, RolesGuard, ScopeGuard)
@Controller()
export class LocationController {
  constructor(private readonly locationService: LocationService) {}

  private requireCampgroundId(req: LocationRequest, fallback?: string): string {
    const headerValue = req.headers["x-campground-id"];
    const headerCampgroundId = Array.isArray(headerValue) ? headerValue[0] : headerValue;
    const campgroundId = fallback ?? req.campgroundId ?? headerCampgroundId ?? undefined;
    if (!campgroundId) {
      throw new BadRequestException("campgroundId is required");
    }
    return campgroundId;
  }

  private requireUserId(req: LocationRequest): string {
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

  // ==================== STORE LOCATIONS ====================

  @Get("campgrounds/:campgroundId/store/locations")
  listLocations(
    @Param("campgroundId") campgroundId: string,
    @Req() req: LocationRequest,
    @Query("includeInactive") includeInactive?: string,
  ) {
    this.assertCampgroundAccess(campgroundId, req.user);
    return this.locationService.listLocations(campgroundId, includeInactive === "true");
  }

  @Get("store/locations/:id")
  getLocation(
    @Param("id") id: string,
    @Req() req: LocationRequest,
    @Query("campgroundId") campgroundId?: string,
  ) {
    const requiredCampgroundId = this.requireCampgroundId(req, campgroundId);
    this.assertCampgroundAccess(requiredCampgroundId, req.user);
    return this.locationService.getLocation(requiredCampgroundId, id);
  }

  @Get("campgrounds/:campgroundId/store/locations/default")
  getDefaultLocation(@Param("campgroundId") campgroundId: string, @Req() req: LocationRequest) {
    this.assertCampgroundAccess(campgroundId, req.user);
    return this.locationService.getDefaultLocation(campgroundId);
  }

  @Post("campgrounds/:campgroundId/store/locations")
  createLocation(
    @Param("campgroundId") campgroundId: string,
    @Body() body: Omit<CreateStoreLocationDto, "campgroundId">,
    @Req() req: LocationRequest,
  ) {
    this.assertCampgroundAccess(campgroundId, req.user);
    return this.locationService.createLocation({ campgroundId, ...body });
  }

  @Patch("store/locations/:id")
  updateLocation(
    @Param("id") id: string,
    @Body() body: UpdateStoreLocationDto,
    @Req() req: LocationRequest,
    @Query("campgroundId") campgroundId?: string,
  ) {
    const requiredCampgroundId = this.requireCampgroundId(req, campgroundId);
    this.assertCampgroundAccess(requiredCampgroundId, req.user);
    return this.locationService.updateLocation(requiredCampgroundId, id, body);
  }

  @Delete("store/locations/:id")
  deleteLocation(
    @Param("id") id: string,
    @Req() req: LocationRequest,
    @Query("campgroundId") campgroundId?: string,
  ) {
    const requiredCampgroundId = this.requireCampgroundId(req, campgroundId);
    this.assertCampgroundAccess(requiredCampgroundId, req.user);
    return this.locationService.deleteLocation(requiredCampgroundId, id);
  }

  // ==================== LOCATION INVENTORY ====================

  @Get("store/locations/:id/inventory")
  getLocationInventory(
    @Param("id") locationId: string,
    @Req() req: LocationRequest,
    @Query("productId") productId?: string,
    @Query("campgroundId") campgroundId?: string,
  ) {
    const requiredCampgroundId = this.requireCampgroundId(req, campgroundId);
    this.assertCampgroundAccess(requiredCampgroundId, req.user);
    return this.locationService.getLocationInventory(requiredCampgroundId, locationId, productId);
  }

  @Patch("store/locations/:id/inventory/:productId")
  setLocationStock(
    @Param("id") locationId: string,
    @Param("productId") productId: string,
    @Body()
    body: { stockQty?: number; adjustment?: number; lowStockAlert?: number; notes?: string },
    @Req() req: LocationRequest,
    @Query("campgroundId") campgroundId?: string,
  ) {
    const userId = this.requireUserId(req);
    const requiredCampgroundId = this.requireCampgroundId(req, campgroundId);
    this.assertCampgroundAccess(requiredCampgroundId, req.user);

    if (typeof body.stockQty === "number") {
      return this.locationService.setLocationStock(
        requiredCampgroundId,
        locationId,
        {
          productId,
          stockQty: body.stockQty,
          lowStockAlert: body.lowStockAlert,
        },
        userId,
      );
    }

    return this.locationService.adjustLocationStock(
      requiredCampgroundId,
      locationId,
      {
        productId,
        adjustment: body.adjustment ?? 0,
        notes: body.notes,
      },
      userId,
    );
  }

  // ==================== PRICE OVERRIDES ====================

  @Get("store/locations/:id/prices")
  getLocationPriceOverrides(
    @Param("id") locationId: string,
    @Req() req: LocationRequest,
    @Query("campgroundId") campgroundId?: string,
  ) {
    const requiredCampgroundId = this.requireCampgroundId(req, campgroundId);
    this.assertCampgroundAccess(requiredCampgroundId, req.user);
    return this.locationService.getLocationPriceOverrides(requiredCampgroundId, locationId);
  }

  @Post("store/locations/:id/prices")
  createPriceOverride(
    @Param("id") locationId: string,
    @Body() body: CreateLocationPriceOverrideDto,
    @Req() req: LocationRequest,
    @Query("campgroundId") campgroundId?: string,
  ) {
    const requiredCampgroundId = this.requireCampgroundId(req, campgroundId);
    this.assertCampgroundAccess(requiredCampgroundId, req.user);
    return this.locationService.createPriceOverride(requiredCampgroundId, locationId, body);
  }

  @Patch("store/prices/:id")
  updatePriceOverride(
    @Param("id") id: string,
    @Body() body: UpdateLocationPriceOverrideDto,
    @Req() req: LocationRequest,
    @Query("campgroundId") campgroundId?: string,
  ) {
    const requiredCampgroundId = this.requireCampgroundId(req, campgroundId);
    this.assertCampgroundAccess(requiredCampgroundId, req.user);
    return this.locationService.updatePriceOverride(requiredCampgroundId, id, body);
  }

  @Delete("store/locations/:locationId/prices/:productId")
  deletePriceOverride(
    @Param("locationId") locationId: string,
    @Param("productId") productId: string,
    @Req() req: LocationRequest,
    @Query("campgroundId") campgroundId?: string,
  ) {
    const requiredCampgroundId = this.requireCampgroundId(req, campgroundId);
    this.assertCampgroundAccess(requiredCampgroundId, req.user);
    return this.locationService.deletePriceOverride(requiredCampgroundId, locationId, productId);
  }

  // ==================== INVENTORY MOVEMENTS (AUDIT LOG) ====================

  @Get("campgrounds/:campgroundId/store/inventory/movements")
  getInventoryMovements(
    @Param("campgroundId") campgroundId: string,
    @Req() req: LocationRequest,
    @Query("productId") productId?: string,
    @Query("locationId") locationId?: string,
    @Query("movementType") movementType?: string,
    @Query("startDate") startDate?: string,
    @Query("endDate") endDate?: string,
    @Query("limit") limit?: string,
  ) {
    this.assertCampgroundAccess(campgroundId, req.user);
    return this.locationService.getInventoryMovements(
      campgroundId,
      {
        productId,
        locationId,
        movementType,
        startDate: startDate ? new Date(startDate) : undefined,
        endDate: endDate ? new Date(endDate) : undefined,
      },
      limit ? parseInt(limit, 10) : 100,
    );
  }

  // ==================== UTILITY ====================

  @Post("campgrounds/:campgroundId/store/locations/ensure-default")
  ensureDefaultLocation(@Param("campgroundId") campgroundId: string, @Req() req: LocationRequest) {
    this.assertCampgroundAccess(campgroundId, req.user);
    return this.locationService.ensureDefaultLocation(campgroundId);
  }

  @Get("store/products/:productId/effective-price")
  getEffectivePrice(
    @Param("productId") productId: string,
    @Req() req: LocationRequest,
    @Query("locationId") locationId?: string,
    @Query("campgroundId") campgroundId?: string,
  ) {
    const requiredCampgroundId = this.requireCampgroundId(req, campgroundId);
    this.assertCampgroundAccess(requiredCampgroundId, req.user);
    return this.locationService.getEffectivePrice(requiredCampgroundId, productId, locationId);
  }

  @Get("store/products/:productId/effective-stock")
  getEffectiveStock(
    @Param("productId") productId: string,
    @Req() req: LocationRequest,
    @Query("locationId") locationId?: string,
    @Query("campgroundId") campgroundId?: string,
  ) {
    const requiredCampgroundId = this.requireCampgroundId(req, campgroundId);
    this.assertCampgroundAccess(requiredCampgroundId, req.user);
    return this.locationService.getEffectiveStock(requiredCampgroundId, productId, locationId);
  }

  // ==================== POS INTEGRATION ====================

  @Get("campgrounds/:campgroundId/store/products-for-location")
  getProductsForLocation(
    @Param("campgroundId") campgroundId: string,
    @Req() req: LocationRequest,
    @Query("locationId") locationId?: string,
  ) {
    this.assertCampgroundAccess(campgroundId, req.user);
    return this.locationService.getProductsForLocation(campgroundId, locationId);
  }
}
