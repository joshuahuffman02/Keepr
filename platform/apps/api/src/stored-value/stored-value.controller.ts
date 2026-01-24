import type { Request } from "express";
import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from "@nestjs/common";
import { JwtAuthGuard } from "../auth/guards";
import { Roles, RolesGuard } from "../auth/guards/roles.guard";
import {
  IssueStoredValueDto,
  RedeemStoredValueDto,
  AdjustStoredValueDto,
} from "./stored-value.dto";
import { StoredValueService } from "./stored-value.service";
import { ScopeGuard } from "../permissions/scope.guard";
import { UserRole } from "@prisma/client";
import type { AuthUser } from "../auth/auth.types";

type CampgroundRequest = Request & { campgroundId?: string };

const getHeaderValue = (value: string | string[] | undefined): string | undefined =>
  Array.isArray(value) ? value[0] : value;

// These routes assume Idempotency-Key header handled in the service layer.
@UseGuards(JwtAuthGuard, RolesGuard, ScopeGuard)
@Controller("stored-value")
export class StoredValueController {
  constructor(private readonly service: StoredValueService) {}

  private requireCampgroundId(req: CampgroundRequest, fallback?: string): string {
    const headerCampgroundId = getHeaderValue(req.headers?.["x-campground-id"]);
    const campgroundId = fallback ?? req.campgroundId ?? headerCampgroundId;
    if (!campgroundId) {
      throw new BadRequestException("campgroundId is required");
    }
    return campgroundId;
  }

  private assertCampgroundAccess(campgroundId: string, user: AuthUser | undefined): void {
    if (!user) {
      throw new BadRequestException("You do not have access to this campground");
    }

    const platformRole = user.platformRole ?? "";
    const isPlatformStaff = ["platform_admin", "platform_superadmin", "support_agent"].includes(
      platformRole,
    );
    if (isPlatformStaff) {
      return;
    }

    const userCampgroundIds = user.memberships.map((membership) => membership.campgroundId);
    if (!userCampgroundIds.includes(campgroundId)) {
      throw new BadRequestException("You do not have access to this campground");
    }
  }

  @Post("issue")
  @Roles(UserRole.owner, UserRole.manager, UserRole.front_desk, UserRole.finance)
  issue(@Body() dto: IssueStoredValueDto, @Req() req: Request) {
    const requiredCampgroundId = this.requireCampgroundId(req);
    this.assertCampgroundAccess(requiredCampgroundId, req.user);
    const actor = { ...req.user, campgroundId: requiredCampgroundId };
    return this.service.issue(dto, getHeaderValue(req.headers["idempotency-key"]), actor);
  }

  @Post("redeem")
  @Roles(UserRole.owner, UserRole.manager, UserRole.front_desk, UserRole.finance)
  redeem(@Body() dto: RedeemStoredValueDto, @Req() req: Request) {
    const requiredCampgroundId = this.requireCampgroundId(req, dto.redeemCampgroundId);
    this.assertCampgroundAccess(requiredCampgroundId, req.user);
    const actor = { ...req.user, campgroundId: requiredCampgroundId };
    return this.service.redeem(dto, getHeaderValue(req.headers["idempotency-key"]), actor);
  }

  @Post("holds/:id/capture")
  @Roles(UserRole.owner, UserRole.manager, UserRole.front_desk, UserRole.finance)
  capture(@Param("id") id: string, @Req() req: Request) {
    const requiredCampgroundId = this.requireCampgroundId(req);
    this.assertCampgroundAccess(requiredCampgroundId, req.user);
    const actor = { ...req.user, campgroundId: requiredCampgroundId };
    return this.service.captureHold(id, getHeaderValue(req.headers["idempotency-key"]), actor);
  }

  @Post("holds/:id/release")
  @Roles(UserRole.owner, UserRole.manager, UserRole.front_desk, UserRole.finance)
  release(@Param("id") id: string, @Req() req: Request) {
    const requiredCampgroundId = this.requireCampgroundId(req);
    this.assertCampgroundAccess(requiredCampgroundId, req.user);
    const actor = { ...req.user, campgroundId: requiredCampgroundId };
    return this.service.releaseHold(id, getHeaderValue(req.headers["idempotency-key"]), actor);
  }

  @Post("adjust")
  @Roles(UserRole.owner, UserRole.manager, UserRole.front_desk, UserRole.finance)
  adjust(@Body() dto: AdjustStoredValueDto, @Req() req: Request) {
    const requiredCampgroundId = this.requireCampgroundId(req);
    this.assertCampgroundAccess(requiredCampgroundId, req.user);
    const actor = { ...req.user, campgroundId: requiredCampgroundId };
    return this.service.adjust(dto, getHeaderValue(req.headers["idempotency-key"]), actor);
  }

  @Get("campgrounds/:campgroundId/accounts")
  @Roles(UserRole.owner, UserRole.manager, UserRole.front_desk, UserRole.finance)
  listAccounts(@Param("campgroundId") campgroundId: string, @Req() req: Request) {
    this.assertCampgroundAccess(campgroundId, req.user);
    return this.service.listAccounts(campgroundId);
  }

  @Get("campgrounds/:campgroundId/ledger")
  @Roles(UserRole.owner, UserRole.manager, UserRole.front_desk, UserRole.finance)
  listLedger(@Param("campgroundId") campgroundId: string, @Req() req: Request) {
    this.assertCampgroundAccess(campgroundId, req.user);
    return this.service.listLedger(campgroundId);
  }

  @Get(":id/balance")
  @Roles(UserRole.owner, UserRole.manager, UserRole.front_desk, UserRole.finance)
  balance(
    @Param("id") id: string,
    @Query("campgroundId") campgroundId: string | undefined,
    @Req() req: Request,
  ) {
    const requiredCampgroundId = this.requireCampgroundId(req, campgroundId);
    this.assertCampgroundAccess(requiredCampgroundId, req.user);
    return this.service.balanceByAccount(id, requiredCampgroundId);
  }

  @Get("code/:code/balance")
  @Roles(UserRole.owner, UserRole.manager, UserRole.front_desk, UserRole.finance)
  balanceByCode(
    @Param("code") code: string,
    @Query("campgroundId") campgroundId: string | undefined,
    @Req() req: Request,
  ) {
    const requiredCampgroundId = this.requireCampgroundId(req, campgroundId);
    this.assertCampgroundAccess(requiredCampgroundId, req.user);
    return this.service.balanceByCode(code, requiredCampgroundId);
  }
}
