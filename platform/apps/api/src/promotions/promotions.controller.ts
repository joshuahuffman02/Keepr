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
import { PromotionsService } from "./promotions.service";
import { CreatePromotionDto, UpdatePromotionDto, ValidatePromotionDto } from "./dto/promotions.dto";
import { JwtAuthGuard } from "../auth/guards";
import { RolesGuard } from "../auth/guards/roles.guard";
import { ScopeGuard } from "../permissions/scope.guard";
import type { Request } from "express";
import type { AuthUser } from "../auth/auth.types";

@UseGuards(JwtAuthGuard, RolesGuard, ScopeGuard)
@Controller("promotions")
export class PromotionsController {
    constructor(private readonly promotionsService: PromotionsService) { }

    private requireCampgroundId(req: Request, fallback?: string): string {
        const headerValue = req.headers["x-campground-id"];
        const headerCampgroundId = Array.isArray(headerValue) ? headerValue[0] : headerValue;
        const campgroundId = fallback ?? req.campgroundId ?? headerCampgroundId;
        if (!campgroundId) {
            throw new BadRequestException("campgroundId is required");
        }
        return campgroundId;
    }

    private assertCampgroundAccess(campgroundId: string, user?: AuthUser | null): void {
        const isPlatformStaff = user?.platformRole === "platform_admin" ||
                                user?.platformRole === "platform_superadmin" ||
                                user?.platformRole === "support_agent";
        if (isPlatformStaff) {
            return;
        }

        const userCampgroundIds = user?.memberships?.map((m) => m.campgroundId) ?? [];
        if (!userCampgroundIds.includes(campgroundId)) {
            throw new BadRequestException("You do not have access to this campground");
        }
    }

    @Post()
    create(@Body() createPromotionDto: CreatePromotionDto, @Req() req: Request) {
        this.assertCampgroundAccess(createPromotionDto.campgroundId, req.user);
        return this.promotionsService.create(createPromotionDto);
    }

    @Get("campgrounds/:campgroundId")
    findAll(@Param("campgroundId") campgroundId: string, @Req() req: Request) {
        this.assertCampgroundAccess(campgroundId, req.user);
        return this.promotionsService.findAll(campgroundId);
    }

    @Get(":id")
    findOne(
        @Param("id") id: string,
        @Query("campgroundId") campgroundId: string | undefined,
        @Req() req: Request
    ) {
        const requiredCampgroundId = this.requireCampgroundId(req, campgroundId);
        this.assertCampgroundAccess(requiredCampgroundId, req.user);
        return this.promotionsService.findOne(requiredCampgroundId, id);
    }

    @Patch(":id")
    update(
        @Param("id") id: string,
        @Body() updatePromotionDto: UpdatePromotionDto,
        @Query("campgroundId") campgroundId: string | undefined,
        @Req() req: Request
    ) {
        const requiredCampgroundId = this.requireCampgroundId(req, campgroundId);
        this.assertCampgroundAccess(requiredCampgroundId, req.user);
        return this.promotionsService.update(requiredCampgroundId, id, updatePromotionDto);
    }

    @Delete(":id")
    remove(
        @Param("id") id: string,
        @Query("campgroundId") campgroundId: string | undefined,
        @Req() req: Request
    ) {
        const requiredCampgroundId = this.requireCampgroundId(req, campgroundId);
        this.assertCampgroundAccess(requiredCampgroundId, req.user);
        return this.promotionsService.remove(requiredCampgroundId, id);
    }

    @Post("validate")
    validate(@Body() validatePromotionDto: ValidatePromotionDto, @Req() req: Request) {
        this.assertCampgroundAccess(validatePromotionDto.campgroundId, req.user);
        return this.promotionsService.validate(validatePromotionDto);
    }
}
