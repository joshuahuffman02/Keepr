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
import { BlackoutsService } from "./blackouts.service";
import { CreateBlackoutDateDto, UpdateBlackoutDateDto } from "./dto/blackout.dto";
import { JwtAuthGuard } from "../auth/guards";
import { RolesGuard } from "../auth/guards/roles.guard";
import { ScopeGuard } from "../permissions/scope.guard";

@UseGuards(JwtAuthGuard, RolesGuard, ScopeGuard)
@Controller("blackouts")
export class BlackoutsController {
    constructor(private readonly blackoutsService: BlackoutsService) { }

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

    @Post()
    create(@Body() createBlackoutDateDto: CreateBlackoutDateDto, @Req() req: any) {
        this.assertCampgroundAccess(createBlackoutDateDto.campgroundId, req.user);
        return this.blackoutsService.create(createBlackoutDateDto);
    }

    @Get("campgrounds/:campgroundId")
    findAll(@Param("campgroundId") campgroundId: string, @Req() req: any) {
        this.assertCampgroundAccess(campgroundId, req.user);
        return this.blackoutsService.findAll(campgroundId);
    }

    @Get(":id")
    findOne(
        @Param("id") id: string,
        @Query("campgroundId") campgroundId: string | undefined,
        @Req() req: any
    ) {
        const requiredCampgroundId = this.requireCampgroundId(req, campgroundId);
        this.assertCampgroundAccess(requiredCampgroundId, req.user);
        return this.blackoutsService.findOne(requiredCampgroundId, id);
    }

    @Patch(":id")
    update(
        @Param("id") id: string,
        @Body() updateBlackoutDateDto: UpdateBlackoutDateDto,
        @Query("campgroundId") campgroundId: string | undefined,
        @Req() req: any
    ) {
        const requiredCampgroundId = this.requireCampgroundId(req, campgroundId);
        this.assertCampgroundAccess(requiredCampgroundId, req.user);
        return this.blackoutsService.update(requiredCampgroundId, id, updateBlackoutDateDto);
    }

    @Delete(":id")
    remove(
        @Param("id") id: string,
        @Query("campgroundId") campgroundId: string | undefined,
        @Req() req: any
    ) {
        const requiredCampgroundId = this.requireCampgroundId(req, campgroundId);
        this.assertCampgroundAccess(requiredCampgroundId, req.user);
        return this.blackoutsService.remove(requiredCampgroundId, id);
    }
}
