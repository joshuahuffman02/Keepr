import { BadRequestException, Body, Controller, Get, Headers, Param, Patch, Post, Query, Req, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../auth/guards";
import { OnboardingService } from "./onboarding.service";
import { CreateOnboardingInviteDto, StartOnboardingDto, UpdateOnboardingStepDto } from "./dto";

@Controller("onboarding")
export class OnboardingController {
  constructor(private readonly onboarding: OnboardingService) {}

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
