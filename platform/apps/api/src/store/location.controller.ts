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
    UseGuards,
    Req,
} from "@nestjs/common";
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

@UseGuards(JwtAuthGuard, RolesGuard, ScopeGuard)
@Controller()
export class LocationController {
    constructor(private readonly locationService: LocationService) {}

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

    // ==================== STORE LOCATIONS ====================

    @Get("campgrounds/:campgroundId/store/locations")
    listLocations(
        @Param("campgroundId") campgroundId: string,
        @Query("includeInactive") includeInactive?: string,
        @Req() req?: any
    ) {
        this.assertCampgroundAccess(campgroundId, req?.user);
        return this.locationService.listLocations(
            campgroundId,
            includeInactive === "true"
        );
    }

    @Get("store/locations/:id")
    getLocation(
        @Param("id") id: string,
        @Query("campgroundId") campgroundId: string | undefined,
        @Req() req: Request
    ) {
        const requiredCampgroundId = this.requireCampgroundId(req, campgroundId);
        this.assertCampgroundAccess(requiredCampgroundId, req.user);
        return this.locationService.getLocation(requiredCampgroundId, id);
    }

    @Get("campgrounds/:campgroundId/store/locations/default")
    getDefaultLocation(@Param("campgroundId") campgroundId: string, @Req() req: Request) {
        this.assertCampgroundAccess(campgroundId, req.user);
        return this.locationService.getDefaultLocation(campgroundId);
    }

    @Post("campgrounds/:campgroundId/store/locations")
    createLocation(
        @Param("campgroundId") campgroundId: string,
        @Body() body: Omit<CreateStoreLocationDto, "campgroundId">,
        @Req() req: Request
    ) {
        this.assertCampgroundAccess(campgroundId, req.user);
        return this.locationService.createLocation({ campgroundId, ...body });
    }

    @Patch("store/locations/:id")
    updateLocation(
        @Param("id") id: string,
        @Body() body: UpdateStoreLocationDto,
        @Query("campgroundId") campgroundId: string | undefined,
        @Req() req: Request
    ) {
        const requiredCampgroundId = this.requireCampgroundId(req, campgroundId);
        this.assertCampgroundAccess(requiredCampgroundId, req.user);
        return this.locationService.updateLocation(requiredCampgroundId, id, body);
    }

    @Delete("store/locations/:id")
    deleteLocation(
        @Param("id") id: string,
        @Query("campgroundId") campgroundId: string | undefined,
        @Req() req: Request
    ) {
        const requiredCampgroundId = this.requireCampgroundId(req, campgroundId);
        this.assertCampgroundAccess(requiredCampgroundId, req.user);
        return this.locationService.deleteLocation(requiredCampgroundId, id);
    }

    // ==================== LOCATION INVENTORY ====================

    @Get("store/locations/:id/inventory")
    getLocationInventory(
        @Param("id") locationId: string,
        @Query("productId") productId?: string,
        @Query("campgroundId") campgroundId?: string,
        @Req() req?: any
    ) {
        const requiredCampgroundId = this.requireCampgroundId(req, campgroundId);
        this.assertCampgroundAccess(requiredCampgroundId, req?.user);
        return this.locationService.getLocationInventory(requiredCampgroundId, locationId, productId);
    }

    @Patch("store/locations/:id/inventory/:productId")
    setLocationStock(
        @Param("id") locationId: string,
        @Param("productId") productId: string,
        @Body() body: { stockQty?: number; adjustment?: number; lowStockAlert?: number; notes?: string },
        @Query("campgroundId") campgroundId?: string,
        @Req() req: Request
    ) {
        const userId = req.user?.id || req.user?.userId;
        const requiredCampgroundId = this.requireCampgroundId(req, campgroundId);
        this.assertCampgroundAccess(requiredCampgroundId, req.user);

        if (typeof body.stockQty === "number") {
            return this.locationService.setLocationStock(requiredCampgroundId, locationId, {
                productId,
                stockQty: body.stockQty,
                lowStockAlert: body.lowStockAlert,
            }, userId);
        }

        return this.locationService.adjustLocationStock(requiredCampgroundId, locationId, {
            productId,
            adjustment: body.adjustment ?? 0,
            notes: body.notes,
        }, userId);
    }

    // ==================== PRICE OVERRIDES ====================

    @Get("store/locations/:id/prices")
    getLocationPriceOverrides(
        @Param("id") locationId: string,
        @Query("campgroundId") campgroundId?: string,
        @Req() req?: any
    ) {
        const requiredCampgroundId = this.requireCampgroundId(req, campgroundId);
        this.assertCampgroundAccess(requiredCampgroundId, req?.user);
        return this.locationService.getLocationPriceOverrides(requiredCampgroundId, locationId);
    }

    @Post("store/locations/:id/prices")
    createPriceOverride(
        @Param("id") locationId: string,
        @Body() body: CreateLocationPriceOverrideDto,
        @Query("campgroundId") campgroundId?: string,
        @Req() req?: any
    ) {
        const requiredCampgroundId = this.requireCampgroundId(req, campgroundId);
        this.assertCampgroundAccess(requiredCampgroundId, req?.user);
        return this.locationService.createPriceOverride(requiredCampgroundId, locationId, body);
    }

    @Patch("store/prices/:id")
    updatePriceOverride(
        @Param("id") id: string,
        @Body() body: UpdateLocationPriceOverrideDto,
        @Query("campgroundId") campgroundId?: string,
        @Req() req?: any
    ) {
        const requiredCampgroundId = this.requireCampgroundId(req, campgroundId);
        this.assertCampgroundAccess(requiredCampgroundId, req?.user);
        return this.locationService.updatePriceOverride(requiredCampgroundId, id, body);
    }

    @Delete("store/locations/:locationId/prices/:productId")
    deletePriceOverride(
        @Param("locationId") locationId: string,
        @Param("productId") productId: string,
        @Query("campgroundId") campgroundId?: string,
        @Req() req?: any
    ) {
        const requiredCampgroundId = this.requireCampgroundId(req, campgroundId);
        this.assertCampgroundAccess(requiredCampgroundId, req?.user);
        return this.locationService.deletePriceOverride(requiredCampgroundId, locationId, productId);
    }

    // ==================== INVENTORY MOVEMENTS (AUDIT LOG) ====================

    @Get("campgrounds/:campgroundId/store/inventory/movements")
    getInventoryMovements(
        @Param("campgroundId") campgroundId: string,
        @Query("productId") productId?: string,
        @Query("locationId") locationId?: string,
        @Query("movementType") movementType?: string,
        @Query("startDate") startDate?: string,
        @Query("endDate") endDate?: string,
        @Query("limit") limit?: string,
        @Req() req?: any
    ) {
        this.assertCampgroundAccess(campgroundId, req?.user);
        return this.locationService.getInventoryMovements(
            campgroundId,
            {
                productId,
                locationId,
                movementType,
                startDate: startDate ? new Date(startDate) : undefined,
                endDate: endDate ? new Date(endDate) : undefined,
            },
            limit ? parseInt(limit, 10) : 100
        );
    }

    // ==================== UTILITY ====================

    @Post("campgrounds/:campgroundId/store/locations/ensure-default")
    ensureDefaultLocation(@Param("campgroundId") campgroundId: string, @Req() req: Request) {
        this.assertCampgroundAccess(campgroundId, req.user);
        return this.locationService.ensureDefaultLocation(campgroundId);
    }

    @Get("store/products/:productId/effective-price")
    getEffectivePrice(
        @Param("productId") productId: string,
        @Query("locationId") locationId?: string,
        @Query("campgroundId") campgroundId?: string,
        @Req() req?: any
    ) {
        const requiredCampgroundId = this.requireCampgroundId(req, campgroundId);
        this.assertCampgroundAccess(requiredCampgroundId, req?.user);
        return this.locationService.getEffectivePrice(requiredCampgroundId, productId, locationId);
    }

    @Get("store/products/:productId/effective-stock")
    getEffectiveStock(
        @Param("productId") productId: string,
        @Query("locationId") locationId?: string,
        @Query("campgroundId") campgroundId?: string,
        @Req() req?: any
    ) {
        const requiredCampgroundId = this.requireCampgroundId(req, campgroundId);
        this.assertCampgroundAccess(requiredCampgroundId, req?.user);
        return this.locationService.getEffectiveStock(requiredCampgroundId, productId, locationId);
    }

    // ==================== POS INTEGRATION ====================

    @Get("campgrounds/:campgroundId/store/products-for-location")
    getProductsForLocation(
        @Param("campgroundId") campgroundId: string,
        @Query("locationId") locationId?: string,
        @Req() req?: any
    ) {
        this.assertCampgroundAccess(campgroundId, req?.user);
        return this.locationService.getProductsForLocation(campgroundId, locationId);
    }
}
