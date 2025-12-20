import {
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

@UseGuards(JwtAuthGuard)
@Controller()
export class TransferController {
    constructor(private readonly transferService: TransferService) {}

    @Get("campgrounds/:campgroundId/store/transfers")
    listTransfers(
        @Param("campgroundId") campgroundId: string,
        @Query("status") status?: string,
        @Query("fromLocationId") fromLocationId?: string,
        @Query("toLocationId") toLocationId?: string
    ) {
        return this.transferService.listTransfers(campgroundId, {
            status,
            fromLocationId,
            toLocationId,
        });
    }

    @Get("store/transfers/:id")
    getTransfer(@Param("id") id: string) {
        return this.transferService.getTransfer(id);
    }

    @Post("campgrounds/:campgroundId/store/transfers")
    createTransfer(
        @Param("campgroundId") campgroundId: string,
        @Body() body: Omit<CreateTransferDto, "campgroundId">,
        @Req() req: any
    ) {
        const userId = req.user?.id || req.user?.userId;
        return this.transferService.createTransfer({ campgroundId, ...body }, userId);
    }

    @Patch("store/transfers/:id/approve")
    approveTransfer(@Param("id") id: string, @Req() req: any) {
        const userId = req.user?.id || req.user?.userId;
        return this.transferService.approveTransfer(id, userId);
    }

    @Patch("store/transfers/:id/complete")
    completeTransfer(@Param("id") id: string, @Req() req: any) {
        const userId = req.user?.id || req.user?.userId;
        return this.transferService.completeTransfer(id, userId);
    }

    @Patch("store/transfers/:id/cancel")
    cancelTransfer(@Param("id") id: string, @Req() req: any) {
        const userId = req.user?.id || req.user?.userId;
        return this.transferService.cancelTransfer(id, userId);
    }
}
