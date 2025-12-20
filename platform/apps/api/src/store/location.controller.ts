import {
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

@UseGuards(JwtAuthGuard)
@Controller()
export class LocationController {
    constructor(private readonly locationService: LocationService) {}

    // ==================== STORE LOCATIONS ====================

    @Get("campgrounds/:campgroundId/store/locations")
    listLocations(
        @Param("campgroundId") campgroundId: string,
        @Query("includeInactive") includeInactive?: string
    ) {
        return this.locationService.listLocations(
            campgroundId,
            includeInactive === "true"
        );
    }

    @Get("store/locations/:id")
    getLocation(@Param("id") id: string) {
        return this.locationService.getLocation(id);
    }

    @Get("campgrounds/:campgroundId/store/locations/default")
    getDefaultLocation(@Param("campgroundId") campgroundId: string) {
        return this.locationService.getDefaultLocation(campgroundId);
    }

    @Post("campgrounds/:campgroundId/store/locations")
    createLocation(
        @Param("campgroundId") campgroundId: string,
        @Body() body: Omit<CreateStoreLocationDto, "campgroundId">
    ) {
        return this.locationService.createLocation({ campgroundId, ...body });
    }

    @Patch("store/locations/:id")
    updateLocation(
        @Param("id") id: string,
        @Body() body: UpdateStoreLocationDto
    ) {
        return this.locationService.updateLocation(id, body);
    }

    @Delete("store/locations/:id")
    deleteLocation(@Param("id") id: string) {
        return this.locationService.deleteLocation(id);
    }

    // ==================== LOCATION INVENTORY ====================

    @Get("store/locations/:id/inventory")
    getLocationInventory(
        @Param("id") locationId: string,
        @Query("productId") productId?: string
    ) {
        return this.locationService.getLocationInventory(locationId, productId);
    }

    @Patch("store/locations/:id/inventory/:productId")
    setLocationStock(
        @Param("id") locationId: string,
        @Param("productId") productId: string,
        @Body() body: { stockQty?: number; adjustment?: number; lowStockAlert?: number; notes?: string },
        @Req() req: any
    ) {
        const userId = req.user?.id || req.user?.userId;

        if (typeof body.stockQty === "number") {
            return this.locationService.setLocationStock(locationId, {
                productId,
                stockQty: body.stockQty,
                lowStockAlert: body.lowStockAlert,
            }, userId);
        }

        return this.locationService.adjustLocationStock(locationId, {
            productId,
            adjustment: body.adjustment ?? 0,
            notes: body.notes,
        }, userId);
    }

    // ==================== PRICE OVERRIDES ====================

    @Get("store/locations/:id/prices")
    getLocationPriceOverrides(@Param("id") locationId: string) {
        return this.locationService.getLocationPriceOverrides(locationId);
    }

    @Post("store/locations/:id/prices")
    createPriceOverride(
        @Param("id") locationId: string,
        @Body() body: CreateLocationPriceOverrideDto
    ) {
        return this.locationService.createPriceOverride(locationId, body);
    }

    @Patch("store/prices/:id")
    updatePriceOverride(
        @Param("id") id: string,
        @Body() body: UpdateLocationPriceOverrideDto
    ) {
        return this.locationService.updatePriceOverride(id, body);
    }

    @Delete("store/locations/:locationId/prices/:productId")
    deletePriceOverride(
        @Param("locationId") locationId: string,
        @Param("productId") productId: string
    ) {
        return this.locationService.deletePriceOverride(locationId, productId);
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
        @Query("limit") limit?: string
    ) {
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
    ensureDefaultLocation(@Param("campgroundId") campgroundId: string) {
        return this.locationService.ensureDefaultLocation(campgroundId);
    }

    @Get("store/products/:productId/effective-price")
    getEffectivePrice(
        @Param("productId") productId: string,
        @Query("locationId") locationId?: string
    ) {
        return this.locationService.getEffectivePrice(productId, locationId);
    }

    @Get("store/products/:productId/effective-stock")
    getEffectiveStock(
        @Param("productId") productId: string,
        @Query("locationId") locationId?: string
    ) {
        return this.locationService.getEffectiveStock(productId, locationId);
    }

    // ==================== POS INTEGRATION ====================

    @Get("campgrounds/:campgroundId/store/products-for-location")
    getProductsForLocation(
        @Param("campgroundId") campgroundId: string,
        @Query("locationId") locationId?: string
    ) {
        return this.locationService.getProductsForLocation(campgroundId, locationId);
    }
}
