import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Req,
  ForbiddenException,
  NotFoundException,
  Patch,
  UseGuards,
  Delete,
  BadRequestException,
  Query,
} from "@nestjs/common";
import { CampgroundsService } from "./campgrounds.service";
import { CreateCampgroundDto } from "./dto/create-campground.dto";
import type { Request } from "express";
import { JwtAuthGuard } from "../auth/guards";
import { ScopeGuard } from "../auth/guards/scope.guard";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { AddMemberDto, UpdateMemberRoleDto } from "./dto/membership.dto";
import { RolesGuard, Roles } from "../auth/guards/roles.guard";
import { UserRole, PlatformRole } from "@prisma/client";
import { ExternalCampgroundUpsertDto, OsmIngestRequestDto } from "./dto/external-campground.dto";
import { UpdatePhotosDto } from "./dto/update-photos.dto";
import { DepositConfigSchema, DepositRule } from "@keepr/shared";
import type { DepositConfig } from "@keepr/shared";
import type { AuthUser } from "../auth/auth.types";
import { PrismaService } from "../prisma/prisma.service";

type CampgroundsRequest = Request & {
  user?: AuthUser;
  organizationId?: string | null;
};

@Controller()
export class CampgroundsController {
  constructor(
    private readonly campgrounds: CampgroundsService,
    private readonly prisma: PrismaService,
  ) {}

  // Public endpoints (no auth required)
  @Get("public/campgrounds")
  listPublic() {
    return this.campgrounds.listPublic();
  }

  @Get("public/campgrounds/:slug")
  async getPublicBySlug(@Param("slug") slug: string) {
    const campground = await this.campgrounds.findBySlug(slug);
    if (!campground) throw new NotFoundException("Campground not found");
    if (!campground.isPublished && !campground.isExternal)
      throw new NotFoundException("Campground not found");
    return campground;
  }

  @Get("public/campgrounds/:slug/sites/:code")
  async getPublicSite(@Param("slug") slug: string, @Param("code") code: string) {
    const result = await this.campgrounds.findPublicSite(slug, code);
    if (!result) throw new NotFoundException("Site not found");
    return result;
  }

  /**
   * Preview endpoint for onboarding - allows viewing unpublished campgrounds with valid token
   */
  @Get("public/campgrounds/:slug/preview")
  async getPreviewBySlug(@Param("slug") slug: string, @Query("token") token: string) {
    if (!token) throw new BadRequestException("Preview token required");

    // Find the onboarding invite by token, then get the session and campground
    const invite = await this.prisma.onboardingInvite.findUnique({
      where: { token },
      include: {
        OnboardingSession: {
          include: { Campground: true },
        },
        Campground: true, // Invite may have campground directly
      },
    });

    if (!invite) {
      throw new NotFoundException("Invalid preview token");
    }

    // Get campground from session (created during onboarding) or from invite
    const campground = invite.OnboardingSession?.Campground || invite.Campground;

    if (!campground) {
      throw new NotFoundException("Campground not found - complete park profile first");
    }

    // Verify the slug matches
    if (campground.slug !== slug) {
      throw new NotFoundException("Campground not found");
    }

    // Return the full campground data (bypassing isPublished check)
    const fullCampground = await this.campgrounds.findBySlug(slug);
    if (!fullCampground) throw new NotFoundException("Campground not found");

    return { ...fullCampground, isPreview: true };
  }

  // Admin endpoints (auth required)
  // SECURITY FIX (CAMP-HIGH-001): Added membership validation to prevent unauthorized access
  @UseGuards(JwtAuthGuard, RolesGuard, ScopeGuard)
  @Get("campgrounds")
  listAll(@Req() req: CampgroundsRequest) {
    const user = req.user;
    const org = req.organizationId ?? null;

    // SECURITY: Platform admins can see all, others only see their memberships
    const isPlatformStaff =
      user?.platformRole === "platform_admin" ||
      user?.platformRole === "support_agent" ||
      user?.platformRole === "support_lead" ||
      user?.platformRole === "regional_support" ||
      user?.platformRole === "ops_engineer";

    if (isPlatformStaff) {
      return this.campgrounds.listAll(org || undefined);
    }

    // For non-platform users, only return campgrounds they are members of
    const memberCampgroundIds = user?.memberships?.map((m) => m.campgroundId) ?? [];
    if (memberCampgroundIds.length === 0) {
      return [];
    }
    return this.campgrounds.listByIds(memberCampgroundIds, org || undefined);
  }

  @UseGuards(JwtAuthGuard, RolesGuard, ScopeGuard)
  @Get("campgrounds/:id")
  getOne(@Param("id") id: string, @Req() req: CampgroundsRequest) {
    const user = req.user;
    const org = req.organizationId ?? null;

    // SECURITY: Platform admins can access any, others need membership
    const isPlatformStaff =
      user?.platformRole === "platform_admin" ||
      user?.platformRole === "support_agent" ||
      user?.platformRole === "support_lead" ||
      user?.platformRole === "regional_support" ||
      user?.platformRole === "ops_engineer";

    if (!isPlatformStaff) {
      const memberCampgroundIds = user?.memberships?.map((m) => m.campgroundId) ?? [];
      if (!memberCampgroundIds.includes(id)) {
        throw new ForbiddenException("You do not have access to this campground");
      }
    }

    const cg = this.campgrounds.findOne(id, org || undefined);
    if (!cg) throw new NotFoundException("Campground not found");
    return cg;
  }

  @UseGuards(JwtAuthGuard, RolesGuard, ScopeGuard)
  @Roles(UserRole.owner, UserRole.manager)
  @Patch("campgrounds/:id/store-hours")
  updateStoreHours(
    @Param("id") id: string,
    @Body() body: { storeOpenHour?: number; storeCloseHour?: number },
    @Req() req: CampgroundsRequest,
  ) {
    const org = req.organizationId ?? null;
    return this.campgrounds.updateStoreHours(
      id,
      body.storeOpenHour,
      body.storeCloseHour,
      org || undefined,
    );
  }

  @UseGuards(JwtAuthGuard, RolesGuard, ScopeGuard)
  @Roles(UserRole.owner, UserRole.manager)
  @Patch("campgrounds/:id/order-webhook")
  updateOrderWebhook(
    @Param("id") id: string,
    @Body() body: { orderWebhookUrl?: string },
    @Req() req: CampgroundsRequest,
  ) {
    const org = req.organizationId ?? null;
    return this.campgrounds.updateOrderWebhook(id, body.orderWebhookUrl, org || undefined);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.owner, UserRole.manager)
  @Patch("campgrounds/:id/sla")
  updateSla(
    @Param("id") id: string,
    @Body() body: { slaMinutes: number },
    @Req() req: CampgroundsRequest,
  ) {
    const org = req.organizationId ?? null;
    return this.campgrounds.updateSlaMinutes(id, body.slaMinutes, org || undefined);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.owner, UserRole.manager)
  @Patch("campgrounds/:id/ops")
  updateOpsSettings(
    @Param("id") id: string,
    @Body()
    body: {
      quietHoursStart?: string | null;
      quietHoursEnd?: string | null;
      routingAssigneeId?: string | null;
    },
    @Req() req: CampgroundsRequest,
  ) {
    const org = req.organizationId ?? null;
    return this.campgrounds.updateOpsSettings(id, body, org || undefined);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.owner, UserRole.manager)
  @Patch("campgrounds/:id/sender-domain")
  verifySenderDomain(
    @Param("id") id: string,
    @Body() body: { domain: string },
    @Req() req: CampgroundsRequest,
  ) {
    const org = req.organizationId ?? null;
    return this.campgrounds.verifySenderDomain(id, body.domain, org || undefined);
  }

  @UseGuards(JwtAuthGuard)
  @Patch("campgrounds/:id/analytics")
  updateAnalytics(
    @Param("id") id: string,
    @Body() body: { gaMeasurementId?: string | null; metaPixelId?: string | null },
    @Req() req: CampgroundsRequest,
  ) {
    const org = req.organizationId ?? null;
    return this.campgrounds.updateAnalytics(id, body, org || undefined);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.owner, UserRole.manager)
  @Patch("campgrounds/:id/nps")
  updateNpsSettings(
    @Param("id") id: string,
    @Body()
    body: {
      npsAutoSendEnabled?: boolean;
      npsSendHour?: number | null;
      npsTemplateId?: string | null;
      npsSchedule?: unknown;
    },
    @Req() req: CampgroundsRequest,
  ) {
    const org = req.organizationId ?? null;
    return this.campgrounds.updateNpsSettings(id, body, org || undefined);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.owner, UserRole.manager)
  @Get("campgrounds/:id/sms-settings")
  getSmsSettings(@Param("id") id: string, @Req() req: CampgroundsRequest) {
    const org = req.organizationId ?? null;
    return this.campgrounds.getSmsSettings(id, org || undefined);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.owner, UserRole.manager)
  @Patch("campgrounds/:id/sms-settings")
  updateSmsSettings(
    @Param("id") id: string,
    @Body()
    body: {
      smsEnabled?: boolean;
      twilioAccountSid?: string | null;
      twilioAuthToken?: string | null;
      twilioFromNumber?: string | null;
      smsWelcomeMessage?: string | null;
    },
    @Req() req: CampgroundsRequest,
  ) {
    const org = req.organizationId ?? null;
    return this.campgrounds.updateSmsSettings(id, body, org || undefined);
  }

  @UseGuards(JwtAuthGuard)
  @Patch("campgrounds/:id/branding")
  updateBranding(
    @Param("id") id: string,
    @Body()
    body: {
      logoUrl?: string | null;
      primaryColor?: string | null;
      accentColor?: string | null;
      secondaryColor?: string | null;
      buttonColor?: string | null;
      brandFont?: string | null;
      emailHeader?: string | null;
      receiptFooter?: string | null;
      brandingNote?: string | null;
    },
    @Req() req: CampgroundsRequest,
  ) {
    const org = req.organizationId ?? null;
    return this.campgrounds.updateBranding(id, body, org || undefined);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.owner, UserRole.manager)
  @Patch("campgrounds/:id/photos")
  updatePhotos(
    @Param("id") id: string,
    @Body() body: UpdatePhotosDto,
    @Req() req: CampgroundsRequest,
  ) {
    const org = req.organizationId || null;
    const actorId = req?.user?.id || null;
    return this.campgrounds.updatePhotos(id, body, org || undefined, actorId || undefined);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.owner, UserRole.manager)
  @Patch("campgrounds/:id/faqs")
  updateFaqs(
    @Param("id") id: string,
    @Body() body: { faqs: Array<{ id: string; question: string; answer: string; order: number }> },
    @Req() req: CampgroundsRequest,
  ) {
    const org = req.organizationId || null;
    return this.campgrounds.updateFaqs(id, body.faqs, org || undefined);
  }

  @UseGuards(JwtAuthGuard)
  @Patch("campgrounds/:id/policies")
  updatePolicies(
    @Param("id") id: string,
    @Body()
    body: {
      cancellationPolicyType?: string | null;
      cancellationWindowHours?: number | null;
      cancellationFeeType?: string | null;
      cancellationFeeFlatCents?: number | null;
      cancellationFeePercent?: number | null;
      cancellationNotes?: string | null;
    },
    @Req() req: CampgroundsRequest,
  ) {
    const org = req.organizationId || null;
    return this.campgrounds.updatePolicies(id, body, org || undefined);
  }

  @UseGuards(JwtAuthGuard)
  @Patch("campgrounds/:id/financials")
  updateFinancials(
    @Param("id") id: string,
    @Body()
    body: {
      currency?: string | null;
      taxId?: string | null;
      taxIdName?: string | null;
      taxState?: number | null;
      taxLocal?: number | null;
    },
    @Req() req: CampgroundsRequest,
  ) {
    const org = req.organizationId || null;
    return this.campgrounds.updateFinancials(id, body, org || undefined);
  }

  @UseGuards(JwtAuthGuard)
  @Patch("campgrounds/:id/accessibility")
  updateAccessibilitySettings(
    @Param("id") id: string,
    @Body()
    body: {
      adaAssessment?: unknown;
      adaCertificationLevel?: string;
      adaAccessibleSiteCount?: number;
      adaTotalSiteCount?: number;
      adaAssessmentUpdatedAt?: string;
      adaVerified?: boolean;
      adaVerifiedAt?: string | null;
      adaVerifiedBy?: string | null;
    },
    @Req() req: CampgroundsRequest,
  ) {
    const org = req.organizationId || null;
    return this.campgrounds.updateAccessibilitySettings(id, body, org || undefined);
  }

  @UseGuards(JwtAuthGuard)
  @Patch("campgrounds/:id/security")
  updateSecuritySettings(
    @Param("id") id: string,
    @Body()
    body: {
      securityAssessment?: unknown;
      securityCertificationLevel?: string;
      securityAssessmentUpdatedAt?: string;
      securityVerified?: boolean;
      securityVerifiedAt?: string | null;
      securityVerifiedBy?: string | null;
      securityAuditorEmail?: string | null;
      securityAuditorOrg?: string | null;
    },
    @Req() req: CampgroundsRequest,
  ) {
    const org = req.organizationId || null;
    return this.campgrounds.updateSecuritySettings(id, body, org || undefined);
  }

  @UseGuards(JwtAuthGuard)
  @Get("organizations/:organizationId/campgrounds")
  listByOrganization(@Param("organizationId") organizationId: string) {
    return this.campgrounds.listByOrganization(organizationId);
  }

  @UseGuards(JwtAuthGuard)
  @Post("organizations/:organizationId/campgrounds")
  create(
    @Param("organizationId") organizationId: string,
    @Body() body: Omit<CreateCampgroundDto, "organizationId">,
  ) {
    // Creation remains admin-only; owners should not hit this. If an org is provided, we allow only if it matches header.
    // In a real app, we'd check a role; for now, require header match when provided.
    // (No-op for compatibility with existing admin flows.)
    return this.campgrounds.create({ organizationId, ...body });
  }

  @UseGuards(JwtAuthGuard, RolesGuard, ScopeGuard)
  @Roles(UserRole.owner, PlatformRole.platform_admin)
  @Delete("campgrounds/:id")
  async remove(@Param("id") id: string, @CurrentUser() user: AuthUser) {
    // SECURITY: Only owners and platform admins can delete campgrounds
    // Additional ownership check for non-platform-admins
    if (user.platformRole !== "platform_admin") {
      const hasOwnership = user.memberships?.some(
        (m) => m.campgroundId === id && m.role === "owner",
      );
      if (!hasOwnership) {
        throw new ForbiddenException("Only campground owners can delete their campground");
      }
    }
    return this.campgrounds.remove(id);
  }

  // External ingestion endpoints
  @UseGuards(JwtAuthGuard)
  @Post("campgrounds/external/upsert")
  upsertExternal(@Body() body: ExternalCampgroundUpsertDto) {
    return this.campgrounds.upsertExternalCampground(body);
  }

  @UseGuards(JwtAuthGuard)
  @Post("campgrounds/external/ingest/osm")
  ingestOsm(@Body() body: OsmIngestRequestDto) {
    return this.campgrounds.ingestFromOsm(body);
  }

  @UseGuards(JwtAuthGuard)
  @Patch("campgrounds/:id/deposit")
  async updateDepositRule(
    @Param("id") id: string,
    @Body()
    body: { depositRule?: string; depositPercentage?: number | null; depositConfig?: unknown },
  ) {
    const allowed = [
      "none",
      "full",
      "half",
      "first_night",
      "first_night_fees",
      "percentage",
      "percentage_50",
    ];
    const incomingRule = body.depositRule;
    const incomingPct = body.depositPercentage ?? null;

    let parsedConfig: DepositConfig | null = null;
    let normalizedRule = incomingRule || "none";
    let normalizedPct: number | null = incomingPct;

    if (body.depositConfig) {
      try {
        parsedConfig = DepositConfigSchema.parse(body.depositConfig);
      } catch (err) {
        throw new BadRequestException("Invalid deposit config");
      }
      const summary = this.ruleSummaryFromConfig(parsedConfig.defaultRule);
      normalizedRule = incomingRule || summary.rule;
      normalizedPct = incomingPct ?? summary.percentage;
    }

    if (!allowed.includes(normalizedRule)) {
      throw new ForbiddenException("Invalid deposit rule");
    }

    if (normalizedRule === "percentage" && (normalizedPct ?? 0) < 0) {
      throw new BadRequestException("Deposit percentage must be provided for percentage rules");
    }

    return this.campgrounds.updateDepositRule(id, normalizedRule, normalizedPct, parsedConfig);
  }

  @UseGuards(JwtAuthGuard)
  @Get("campgrounds/:id/members")
  getMembers(@Param("id") id: string) {
    return this.campgrounds.getMembers(id);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.owner, UserRole.manager)
  @Post("campgrounds/:id/members")
  addMember(@Param("id") id: string, @Body() body: AddMemberDto, @Req() req: CampgroundsRequest) {
    const actorId = req?.user?.id;
    return this.campgrounds.addMember(
      id,
      {
        email: body.email,
        firstName: body.firstName,
        lastName: body.lastName,
        role: body.role,
      },
      actorId,
    );
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.owner, UserRole.manager)
  @Patch("campgrounds/:campgroundId/members/:membershipId")
  updateMember(
    @Param("campgroundId") campgroundId: string,
    @Param("membershipId") membershipId: string,
    @Body() body: UpdateMemberRoleDto,
    @Req() req: CampgroundsRequest,
  ) {
    const actorId = req?.user?.id;
    return this.campgrounds.updateMemberRole(campgroundId, membershipId, body.role, actorId);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.owner, UserRole.manager)
  @Delete("campgrounds/:campgroundId/members/:membershipId")
  removeMember(
    @Param("campgroundId") campgroundId: string,
    @Param("membershipId") membershipId: string,
    @Req() req: CampgroundsRequest,
  ) {
    const actorId = req?.user?.id;
    return this.campgrounds.removeMember(campgroundId, membershipId, actorId);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.owner, UserRole.manager)
  @Post("campgrounds/:campgroundId/members/:membershipId/resend-invite")
  resendInvite(
    @Param("campgroundId") campgroundId: string,
    @Param("membershipId") membershipId: string,
    @Req() req: CampgroundsRequest,
  ) {
    const actorId = req?.user?.id;
    return this.campgrounds.resendInvite(campgroundId, membershipId, actorId);
  }

  private ruleSummaryFromConfig(rule: DepositRule) {
    if (rule.type === "percent_total") {
      return { rule: "percentage", percentage: rule.percent ?? null };
    }
    if (rule.type === "fixed_amount") return { rule: "none", percentage: null };
    if (rule.type === "full") return { rule: "full", percentage: null };
    if (rule.type === "half") return { rule: "half", percentage: null };
    if (rule.type === "first_night") return { rule: "first_night", percentage: null };
    if (rule.type === "first_night_fees") return { rule: "first_night_fees", percentage: null };
    return { rule: "none", percentage: null };
  }
}
