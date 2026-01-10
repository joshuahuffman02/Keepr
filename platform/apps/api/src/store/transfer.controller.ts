import {
    BadRequestException,
    Body,
    Controller,
    Get,
    Param,
    Patch,
    Post,
    Query,
    UseGuards,
    Req,
} from "@nestjs/common";
import { TransferService, CreateTransferDto } from "./transfer.service";
import { JwtAuthGuard } from "../auth/guards";
import { RolesGuard } from "../auth/guards/roles.guard";
import { ScopeGuard } from "../permissions/scope.guard";

@UseGuards(JwtAuthGuard, RolesGuard, ScopeGuard)
@Controller()
export class TransferController {
    constructor(private readonly transferService: TransferService) {}

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

    @Get("campgrounds/:campgroundId/store/transfers")
    listTransfers(
        @Param("campgroundId") campgroundId: string,
        @Query("status") status?: string,
        @Query("fromLocationId") fromLocationId?: string,
        @Query("toLocationId") toLocationId?: string,
        @Req() req?: any
    ) {
        this.assertCampgroundAccess(campgroundId, req?.user);
        return this.transferService.listTransfers(campgroundId, {
            status,
            fromLocationId,
            toLocationId,
        });
    }

    @Get("store/transfers/:id")
    getTransfer(
        @Param("id") id: string,
        @Query("campgroundId") campgroundId: string | undefined,
        @Req() req: Request
    ) {
        const requiredCampgroundId = this.requireCampgroundId(req, campgroundId);
        this.assertCampgroundAccess(requiredCampgroundId, req.user);
        return this.transferService.getTransfer(requiredCampgroundId, id);
    }

    @Post("campgrounds/:campgroundId/store/transfers")
    createTransfer(
        @Param("campgroundId") campgroundId: string,
        @Body() body: Omit<CreateTransferDto, "campgroundId">,
        @Req() req: Request
    ) {
        const userId = req.user?.id || req.user?.userId;
        this.assertCampgroundAccess(campgroundId, req.user);
        return this.transferService.createTransfer({ campgroundId, ...body }, userId);
    }

    @Patch("store/transfers/:id/approve")
    approveTransfer(
        @Param("id") id: string,
        @Query("campgroundId") campgroundId: string | undefined,
        @Req() req: Request
    ) {
        const userId = req.user?.id || req.user?.userId;
        const requiredCampgroundId = this.requireCampgroundId(req, campgroundId);
        this.assertCampgroundAccess(requiredCampgroundId, req.user);
        return this.transferService.approveTransfer(requiredCampgroundId, id, userId);
    }

    @Patch("store/transfers/:id/complete")
    completeTransfer(
        @Param("id") id: string,
        @Query("campgroundId") campgroundId: string | undefined,
        @Req() req: Request
    ) {
        const userId = req.user?.id || req.user?.userId;
        const requiredCampgroundId = this.requireCampgroundId(req, campgroundId);
        this.assertCampgroundAccess(requiredCampgroundId, req.user);
        return this.transferService.completeTransfer(requiredCampgroundId, id, userId);
    }

    @Patch("store/transfers/:id/cancel")
    cancelTransfer(
        @Param("id") id: string,
        @Query("campgroundId") campgroundId: string | undefined,
        @Req() req: Request
    ) {
        const userId = req.user?.id || req.user?.userId;
        const requiredCampgroundId = this.requireCampgroundId(req, campgroundId);
        this.assertCampgroundAccess(requiredCampgroundId, req.user);
        return this.transferService.cancelTransfer(requiredCampgroundId, id, userId);
    }
}
