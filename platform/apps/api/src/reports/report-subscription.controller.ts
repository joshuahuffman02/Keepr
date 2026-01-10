import { Body, Controller, Delete, Get, Param, Patch, Post, Req, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../auth/guards";
import { ReportSubscriptionService } from "./report-subscription.service";

class CreateSubscriptionDto {
    reportType!: string;
    frequency!: string;
    campgroundId?: string;
    deliveryTime?: string;
    dayOfWeek?: number;
    dayOfMonth?: number;
}

class UpdateSubscriptionDto {
    enabled?: boolean;
    frequency?: string;
    deliveryTime?: string;
    dayOfWeek?: number;
    dayOfMonth?: number;
}

@Controller("report-subscriptions")
@UseGuards(JwtAuthGuard)
export class ReportSubscriptionController {
    constructor(private readonly subscriptions: ReportSubscriptionService) { }

    @Get()
    async list(@Req() req: Request) {
        return this.subscriptions.findByUser(req.user.id);
    }

    @Get("campground/:campgroundId")
    async listByCampground(@Param("campgroundId") campgroundId: string) {
        return this.subscriptions.findByCampground(campgroundId);
    }

    @Post()
    async create(@Body() dto: CreateSubscriptionDto, @Req() req: Request) {
        return this.subscriptions.create({
            userId: req.user.id,
            userEmail: req.user.email,
            campgroundId: dto.campgroundId,
            reportType: dto.reportType as any,
            frequency: dto.frequency as any,
            deliveryTime: dto.deliveryTime,
            dayOfWeek: dto.dayOfWeek,
            dayOfMonth: dto.dayOfMonth,
        });
    }

    @Patch(":id")
    async update(@Param("id") id: string, @Body() dto: UpdateSubscriptionDto) {
        return this.subscriptions.update(id, dto as any);
    }

    @Delete(":id")
    async delete(@Param("id") id: string) {
        return this.subscriptions.delete(id);
    }
}
