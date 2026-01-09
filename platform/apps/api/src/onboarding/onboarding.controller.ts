import { BadRequestException, Body, Controller, Get, Headers, Param, Patch, Post, Query, Req, UseGuards, Logger } from "@nestjs/common";
import { JwtAuthGuard } from "../auth/guards";
import { OnboardingService } from "./onboarding.service";
import { CreateOnboardingInviteDto, StartOnboardingDto, UpdateOnboardingStepDto } from "./dto";
import { StripeService } from "../payments/stripe.service";
import { PrismaService } from "../prisma/prisma.service";
import { OnboardingTokenGateService } from "./onboarding-token-gate.service";
import { OnboardingGoLiveCheckService } from "./onboarding-go-live-check.service";
import { EmailService } from "../email/email.service";

@Controller("onboarding")
export class OnboardingController {
  private readonly logger = new Logger(OnboardingController.name);

  constructor(
    private readonly onboarding: OnboardingService,
    private readonly stripe: StripeService,
    private readonly prisma: PrismaService,
    private readonly tokenGate: OnboardingTokenGateService,
    private readonly goLiveCheck: OnboardingGoLiveCheckService,
    private readonly email: EmailService,
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

  // ============================================
  // AI Import Token Gate Endpoints
  // ============================================

  /**
   * Get AI access status for the session
   */
  @Get("session/:id/ai-gate/status")
  async getAiGateStatus(
    @Param("id") sessionId: string,
    @Headers("x-onboarding-token") tokenHeader: string,
    @Query("token") tokenQuery: string,
  ) {
    const token = tokenQuery ?? tokenHeader;
    if (!token) throw new BadRequestException("Missing onboarding token");

    // Validate session first
    await this.onboarding.getSession(sessionId, token);

    return this.tokenGate.checkAccess(sessionId);
  }

  /**
   * Request email verification to unlock AI features
   */
  @Post("session/:id/verify-email")
  async requestEmailVerification(
    @Param("id") sessionId: string,
    @Headers("x-onboarding-token") tokenHeader: string,
    @Body() body: { token?: string; email?: string },
  ) {
    const token = body.token ?? tokenHeader;
    if (!token) throw new BadRequestException("Missing onboarding token");

    // Validate session
    const { session } = await this.onboarding.getSession(sessionId, token);

    // Check if already verified
    if (session.emailVerified) {
      return { success: true, message: "Email already verified", alreadyVerified: true };
    }

    // Get email from session invite
    const invite = await this.prisma.onboardingInvite.findFirst({
      where: { id: session.inviteId },
      select: { email: true },
    });

    const emailToVerify = body.email || invite?.email;
    if (!emailToVerify) {
      throw new BadRequestException("No email address found for verification");
    }

    // Generate verification code
    const { code, expiresAt } = await this.tokenGate.initiateEmailVerification(sessionId);

    // Send verification email
    await this.email.sendEmail({
      to: emailToVerify,
      subject: "Verify your email for AI-assisted import",
      html: this.buildVerificationEmailHtml(code),
    });

    this.logger.log(`Verification email sent to ${emailToVerify} for session ${sessionId}`);

    return {
      success: true,
      message: "Verification code sent to your email",
      email: this.maskEmail(emailToVerify),
      expiresAt,
    };
  }

  /**
   * Confirm email verification code
   */
  @Post("session/:id/confirm-email-code")
  async confirmEmailCode(
    @Param("id") sessionId: string,
    @Headers("x-onboarding-token") tokenHeader: string,
    @Body() body: { token?: string; code: string },
  ) {
    const token = body.token ?? tokenHeader;
    if (!token) throw new BadRequestException("Missing onboarding token");

    if (!body.code || body.code.length !== 6) {
      throw new BadRequestException("Invalid verification code format");
    }

    // Validate session
    await this.onboarding.getSession(sessionId, token);

    // Verify the code
    const verified = await this.tokenGate.verifyEmailCode(sessionId, body.code);

    if (!verified) {
      throw new BadRequestException("Invalid or expired verification code");
    }

    // Get updated access status
    const accessStatus = await this.tokenGate.checkAccess(sessionId);

    return {
      success: true,
      message: "Email verified! AI-assisted import is now available.",
      accessStatus,
    };
  }

  /**
   * Mask email for privacy in responses
   */
  private maskEmail(email: string): string {
    const [local, domain] = email.split("@");
    if (!domain) return email;
    const maskedLocal =
      local.length <= 2
        ? local[0] + "*"
        : local[0] + "*".repeat(local.length - 2) + local[local.length - 1];
    return `${maskedLocal}@${domain}`;
  }

  /**
   * Build HTML email for verification code
   */
  private buildVerificationEmailHtml(code: string): string {
    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Verify Your Email</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f4f4f5;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="min-width: 100%; background-color: #f4f4f5;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width: 480px; background-color: #ffffff; border-radius: 12px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
          <tr>
            <td style="padding: 40px 32px; text-align: center;">
              <!-- Logo placeholder -->
              <div style="margin-bottom: 24px;">
                <span style="font-size: 24px; font-weight: 700; color: #18181b;">Keepr</span>
              </div>

              <!-- Title -->
              <h1 style="margin: 0 0 8px; font-size: 20px; font-weight: 600; color: #18181b;">
                Verify your email
              </h1>
              <p style="margin: 0 0 32px; font-size: 14px; color: #71717a; line-height: 1.5;">
                Enter this code to unlock AI-assisted import
              </p>

              <!-- Code -->
              <div style="background-color: #f4f4f5; border-radius: 8px; padding: 20px; margin-bottom: 32px;">
                <span style="font-family: 'SF Mono', Monaco, 'Courier New', monospace; font-size: 32px; font-weight: 700; letter-spacing: 8px; color: #18181b;">
                  ${code}
                </span>
              </div>

              <!-- Info -->
              <p style="margin: 0; font-size: 13px; color: #a1a1aa; line-height: 1.5;">
                This code expires in 10 minutes.<br>
                If you didn't request this, you can safely ignore this email.
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding: 24px 32px; background-color: #fafafa; border-top: 1px solid #e4e4e7; border-radius: 0 0 12px 12px;">
              <p style="margin: 0; font-size: 12px; color: #a1a1aa; text-align: center;">
                Keepr - Campground Management Made Simple
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
    `.trim();
  }

  // ============================================
  // Go-Live Check Endpoints
  // ============================================

  /**
   * Check if session is ready to go live
   */
  @Get("session/:id/go-live-check")
  async getGoLiveCheck(
    @Param("id") sessionId: string,
    @Headers("x-onboarding-token") tokenHeader: string,
    @Query("token") tokenQuery: string,
  ) {
    const token = tokenQuery ?? tokenHeader;
    if (!token) throw new BadRequestException("Missing onboarding token");

    // Validate session
    await this.onboarding.getSession(sessionId, token);

    return this.goLiveCheck.check(sessionId);
  }

  /**
   * Get a quick summary of go-live readiness
   */
  @Get("session/:id/go-live-summary")
  async getGoLiveSummary(
    @Param("id") sessionId: string,
    @Headers("x-onboarding-token") tokenHeader: string,
    @Query("token") tokenQuery: string,
  ) {
    const token = tokenQuery ?? tokenHeader;
    if (!token) throw new BadRequestException("Missing onboarding token");

    // Validate session
    await this.onboarding.getSession(sessionId, token);

    return this.goLiveCheck.getSummary(sessionId);
  }
}
