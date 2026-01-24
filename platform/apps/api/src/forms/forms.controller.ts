import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
  Req,
  BadRequestException,
  Query,
} from "@nestjs/common";
import { FormsService } from "./forms.service";
import { JwtAuthGuard, RolesGuard, Roles } from "../auth/guards";
import { ScopeGuard } from "../permissions/scope.guard";
import { UserRole } from "@prisma/client";
import {
  CreateFormTemplateDto,
  UpdateFormTemplateDto,
  CreateFormSubmissionDto,
  UpdateFormSubmissionDto,
} from "./dto/form-template.dto";
import type { Request } from "express";

type CampgroundRequest = Request & { campgroundId?: string | null };

@UseGuards(JwtAuthGuard, RolesGuard, ScopeGuard)
@Controller()
export class FormsController {
  constructor(private readonly forms: FormsService) {}

  private requireCampgroundId(req: CampgroundRequest, fallback?: string): string {
    const headerValue = req.headers["x-campground-id"];
    const headerCampgroundId = Array.isArray(headerValue) ? headerValue[0] : headerValue;
    const campgroundId = fallback ?? req.campgroundId ?? headerCampgroundId;
    if (!campgroundId) {
      throw new BadRequestException("campgroundId is required");
    }
    return campgroundId;
  }

  @Get("campgrounds/:campgroundId/forms")
  @Roles(UserRole.owner, UserRole.manager, UserRole.front_desk)
  listByCampground(@Param("campgroundId") campgroundId: string) {
    return this.forms.listByCampground(campgroundId);
  }

  @Post("forms")
  @Roles(UserRole.owner, UserRole.manager)
  create(@Body() body: CreateFormTemplateDto, @Req() req: Request) {
    const campgroundId = this.requireCampgroundId(req, body.campgroundId);
    return this.forms.create(body, campgroundId);
  }

  @Patch("forms/:id")
  @Roles(UserRole.owner, UserRole.manager)
  update(@Param("id") id: string, @Body() body: UpdateFormTemplateDto, @Req() req: Request) {
    const campgroundId = this.requireCampgroundId(req);
    return this.forms.update(id, body, campgroundId);
  }

  @Delete("forms/:id")
  @Roles(UserRole.owner, UserRole.manager)
  remove(@Param("id") id: string, @Req() req: Request) {
    const campgroundId = this.requireCampgroundId(req);
    return this.forms.remove(id, campgroundId);
  }

  @Get("reservations/:reservationId/forms")
  @Roles(UserRole.owner, UserRole.manager, UserRole.front_desk)
  listForReservation(
    @Param("reservationId") reservationId: string,
    @Query("campgroundId") campgroundId: string | undefined,
    @Req() req: Request,
  ) {
    const requiredCampgroundId = this.requireCampgroundId(req, campgroundId);
    return this.forms.listSubmissions({ reservationId, campgroundId: requiredCampgroundId });
  }

  @Get("guests/:guestId/forms")
  @Roles(UserRole.owner, UserRole.manager, UserRole.front_desk)
  listForGuest(
    @Param("guestId") guestId: string,
    @Query("campgroundId") campgroundId: string | undefined,
    @Req() req: Request,
  ) {
    const requiredCampgroundId = this.requireCampgroundId(req, campgroundId);
    return this.forms.listSubmissions({ guestId, campgroundId: requiredCampgroundId });
  }

  @Post("forms/submissions")
  @Roles(UserRole.owner, UserRole.manager, UserRole.front_desk)
  createSubmission(@Body() body: CreateFormSubmissionDto, @Req() req: Request) {
    const campgroundId = this.requireCampgroundId(req);
    return this.forms.createSubmission(body, campgroundId);
  }

  @Patch("forms/submissions/:id")
  @Roles(UserRole.owner, UserRole.manager, UserRole.front_desk)
  updateSubmission(
    @Param("id") id: string,
    @Body() body: UpdateFormSubmissionDto,
    @Req() req: Request,
  ) {
    const campgroundId = this.requireCampgroundId(req);
    return this.forms.updateSubmission(id, body, campgroundId);
  }

  @Delete("forms/submissions/:id")
  @Roles(UserRole.owner, UserRole.manager)
  deleteSubmission(@Param("id") id: string, @Req() req: Request) {
    const campgroundId = this.requireCampgroundId(req);
    return this.forms.deleteSubmission(id, campgroundId);
  }
}
