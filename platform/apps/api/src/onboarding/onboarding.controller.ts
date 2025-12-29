import { BadRequestException, Body, Controller, Get, Headers, Param, Patch, Post, Query, Req, UseGuards, Logger } from "@nestjs/common";
import { JwtAuthGuard } from "../auth/guards";
import { OnboardingService } from "./onboarding.service";
import { CreateOnboardingInviteDto, StartOnboardingDto, UpdateOnboardingStepDto } from "./dto";
import { StripeService } from "../payments/stripe.service";
import { PrismaService } from "../prisma/prisma.service";

@Controller("onboarding")
export class OnboardingController {
  private readonly logger = new Logger(OnboardingController.name);

  constructor(
    private readonly onboarding: OnboardingService,
    private readonly stripe: StripeService,
    private readonly prisma: PrismaService,
  ) {}

  @UseGuards(JwtAuthGuard)
  @Post("invitations")
  createInvite(@Body() dto: CreateOnboardingInviteDto, @Req() req: any) {
    return this.onboarding.createInvite(dto, req.user);
  }

  @UseGuards(JwtAuthGuard)
  @Post("invitations/:id/resend")
  resendInvite(@Param("id") id: string, @Req() req: any) {
    return this.onboarding.resendInvite(id, req.user);
  }

  @Post("session/start")
  startSession(@Body() dto: StartOnboardingDto) {
    return this.onboarding.startSession(dto);
  }

  @Get("session/:id")
  getSession(@Param("id") id: string, @Query("token") token: string) {
    if (!token) throw new BadRequestException("Missing onboarding token");
    return this.onboarding.getSession(id, token);
  }

  @Patch("session/:id/step")
  saveStep(
    @Param("id") id: string,
    @Body() dto: UpdateOnboardingStepDto,
    @Headers("x-onboarding-token") tokenHeader: string,
    @Headers("idempotency-key") idempotencyKey: string,
    @Headers("x-client-seq") clientSeq: string,
    @Headers("client-seq") altSeq: string,
  ) {
    const token = dto.token ?? tokenHeader;
    if (!token) throw new BadRequestException("Missing onboarding token");
    const sequence = clientSeq ?? altSeq ?? undefined;
    return this.onboarding.saveStep(id, token, dto.step, dto.payload, idempotencyKey, sequence);
  }

  /**
   * Connect Stripe during onboarding - no JWT required, uses onboarding token
   */
  @Post("session/:id/stripe/connect")
  async connectStripe(
    @Param("id") sessionId: string,
    @Headers("x-onboarding-token") tokenHeader: string,
    @Body() body: { token?: string },
  ) {
    const token = body.token ?? tokenHeader;
    if (!token) throw new BadRequestException("Missing onboarding token");

    // Validate session and get campground
    const session = await this.onboarding.getSession(sessionId, token);
    const campgroundId = session.session.campgroundId;
    if (!campgroundId) {
      throw new BadRequestException("Campground not created yet. Please complete the Park Profile step first.");
    }

    const campground = await this.prisma.campground.findUnique({
      where: { id: campgroundId },
      select: { id: true, email: true, stripeAccountId: true as any }
    } as any);
    if (!campground) throw new BadRequestException("Campground not found");

    // Create or retrieve Stripe Express account
    let accountId = (campground as any)?.stripeAccountId as string | undefined;
    if (!accountId) {
      const account = await this.stripe.createExpressAccount(campground.email || undefined, { campgroundId });
      accountId = account.id;
      await this.prisma.campground.update({
        where: { id: campgroundId },
        data: { stripeAccountId: accountId } as any
      });
    }

    // Create onboarding link with return to the onboarding flow
    const baseUrl = process.env.FRONTEND_BASE_URL || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    const returnUrl = `${baseUrl}/onboarding/${token}?stripe_status=success`;
    const refreshUrl = `${baseUrl}/onboarding/${token}?stripe_status=error`;
    const link = await this.stripe.createAccountOnboardingLink(accountId, returnUrl, refreshUrl);

    return { onboardingUrl: link.url };
  }

  /**
   * Check Stripe connection status during onboarding
   */
  @Get("session/:id/stripe/status")
  async getStripeStatus(
    @Param("id") sessionId: string,
    @Headers("x-onboarding-token") tokenHeader: string,
    @Query("token") tokenQuery: string,
  ) {
    const token = tokenQuery ?? tokenHeader;
    if (!token) throw new BadRequestException("Missing onboarding token");

    const session = await this.onboarding.getSession(sessionId, token);
    const campgroundId = session.session.campgroundId;
    if (!campgroundId) {
      return { connected: false, reason: "no_campground" };
    }

    const campground = await this.prisma.campground.findUnique({
      where: { id: campgroundId },
      select: { stripeAccountId: true as any }
    } as any);

    const accountId = (campground as any)?.stripeAccountId;
    if (!accountId) {
      return { connected: false, reason: "no_account" };
    }

    // Check if account is fully onboarded
    // Consider "connected" when details are submitted (user completed their part)
    // charges_enabled may take time for Stripe to verify
    try {
      const account = await this.stripe.retrieveAccount(accountId);
      const connected = !!account.details_submitted; // User completed Stripe onboarding
      const fullyEnabled = account.details_submitted && account.charges_enabled;
      return {
        connected,
        fullyEnabled,
        accountId,
        details_submitted: account.details_submitted,
        charges_enabled: account.charges_enabled
      };
    } catch (err) {
      this.logger.error("Stripe account retrieval error:", err instanceof Error ? err.stack : err);
      return { connected: false, reason: "account_error" };
    }
  }

  /**
   * Complete onboarding - finalize setup and create campground
   */
  @UseGuards(JwtAuthGuard)
  @Post("session/:id/complete")
  completeOnboarding(
    @Param("id") id: string,
    @Headers("x-onboarding-token") tokenHeader: string,
    @Body() body: { token?: string },
    @Req() req: any
  ) {
    const token = body.token ?? tokenHeader;
    if (!token) throw new BadRequestException("Missing onboarding token");
    return this.onboarding.completeOnboarding(id, token, req.user.id);
  }
}
