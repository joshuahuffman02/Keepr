import {
    Controller,
    Get,
    Post,
    Put,
    Delete,
    Body,
    Param,
    Query,
    UseGuards,
    Request,
} from "@nestjs/common";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { ScopeGuard } from "../auth/guards/scope.guard";
import { BatchInventoryService } from "./batch-inventory.service";
import { ExpirationAlertService } from "./expiration-alert.service";
import { SlowMovingInventoryService } from "./slow-moving.service";
import {
    CreateBatchDto,
    UpdateBatchDto,
    AdjustBatchDto,
    DisposeBatchDto,
} from "./dto/batch.dto";

@Controller("campgrounds/:campgroundId/inventory")
@UseGuards(JwtAuthGuard, ScopeGuard)
export class BatchInventoryController {
    constructor(
        private readonly batchService: BatchInventoryService,
        private readonly alertService: ExpirationAlertService,
        private readonly slowMovingService: SlowMovingInventoryService
    ) {}

    // ==================== BATCH CRUD ====================

    @Post("batches")
    async createBatch(
        @Param("campgroundId") campgroundId: string,
        @Body() dto: CreateBatchDto,
        @Request() req: any
    ) {
        return this.batchService.createBatch(campgroundId, dto, req.user.id);
    }

    @Get("batches")
    async listBatches(
        @Param("campgroundId") campgroundId: string,
        @Query("productId") productId?: string,
        @Query("locationId") locationId?: string,
        @Query("isActive") isActive?: string,
        @Query("expiringWithinDays") expiringWithinDays?: string,
        @Query("expiredOnly") expiredOnly?: string
    ) {
        return this.batchService.listBatches(campgroundId, {
            productId,
            locationId,
            isActive: isActive !== undefined ? isActive === "true" : undefined,
            expiringWithinDays: expiringWithinDays
                ? parseInt(expiringWithinDays, 10)
                : undefined,
            expiredOnly: expiredOnly === "true",
        });
    }

    @Get("batches/expiring")
    async getExpirationSummary(@Param("campgroundId") campgroundId: string) {
        return this.batchService.getExpirationSummary(campgroundId);
    }

    @Get("batches/:id")
    async getBatch(
        @Param("campgroundId") campgroundId: string,
        @Param("id") id: string
    ) {
        return this.batchService.getBatch(id, campgroundId);
    }

    @Put("batches/:id")
    async updateBatch(
        @Param("campgroundId") campgroundId: string,
        @Param("id") id: string,
        @Body() dto: UpdateBatchDto
    ) {
        return this.batchService.updateBatch(id, campgroundId, dto);
    }

    @Post("batches/:id/adjust")
    async adjustBatch(
        @Param("campgroundId") campgroundId: string,
        @Param("id") id: string,
        @Body() dto: AdjustBatchDto,
        @Request() req: any
    ) {
        return this.batchService.adjustBatch(id, campgroundId, dto, req.user.id);
    }

    @Post("batches/:id/dispose")
    async disposeBatch(
        @Param("campgroundId") campgroundId: string,
        @Param("id") id: string,
        @Body() dto: DisposeBatchDto,
        @Request() req: any
    ) {
        return this.batchService.disposeBatch(id, campgroundId, dto, req.user.id);
    }

    // ==================== EXPIRATION ALERTS ====================

    @Get("alerts/expiration")
    async getExpirationAlerts(
        @Param("campgroundId") campgroundId: string,
        @Query("tier") tier?: string,
        @Query("limit") limit?: string
    ) {
        return this.alertService.getActiveAlerts(campgroundId, {
            tier: tier as any,
            limit: limit ? parseInt(limit, 10) : undefined,
        });
    }

    @Post("alerts/:id/acknowledge")
    async acknowledgeAlert(@Param("id") id: string, @Request() req: any) {
        return this.alertService.acknowledgeAlert(id, req.user.id);
    }

    @Post("alerts/acknowledge-bulk")
    async acknowledgeAlertsBulk(
        @Body() body: { ids: string[] },
        @Request() req: any
    ) {
        return this.alertService.acknowledgeAlerts(body.ids, req.user.id);
    }

    // ==================== SLOW-MOVING INVENTORY ====================

    @Get("alerts/slow-moving")
    async getSlowMovingProducts(
        @Param("campgroundId") campgroundId: string,
        @Query("categoryId") categoryId?: string,
        @Query("minDays") minDays?: string,
        @Query("minValue") minValue?: string
    ) {
        return this.slowMovingService.getSlowMovingProducts(campgroundId, {
            categoryId,
            minDaysSinceLastSale: minDays ? parseInt(minDays, 10) : undefined,
            minValueCents: minValue ? parseInt(minValue, 10) : undefined,
        });
    }

    @Get("alerts/slow-moving/summary")
    async getSlowMovingSummary(@Param("campgroundId") campgroundId: string) {
        return this.slowMovingService.getSlowMovingSummary(campgroundId);
    }

    @Get("alerts/slow-moving/recommendations")
    async getSlowMovingRecommendations(
        @Param("campgroundId") campgroundId: string
    ) {
        return this.slowMovingService.getRecommendations(campgroundId);
    }

    // ==================== DASHBOARD ====================

    @Get("dashboard")
    async getDashboard(@Param("campgroundId") campgroundId: string) {
        const [expiration, slowMoving] = await Promise.all([
            this.alertService.getDashboardData(campgroundId),
            this.slowMovingService.getSlowMovingSummary(campgroundId),
        ]);

        return {
            expiration,
            slowMoving,
        };
    }
}
