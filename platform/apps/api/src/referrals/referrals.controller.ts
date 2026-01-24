import { Body, Controller, Get, Param, Patch, Post, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../auth/guards";
import { ScopeGuard } from "../auth/guards/scope.guard";
import { ReferralsService } from "./referrals.service";
import { CreateReferralProgramDto } from "./dto/create-referral-program.dto";
import { UpdateReferralProgramDto } from "./dto/update-referral-program.dto";

@UseGuards(JwtAuthGuard, ScopeGuard)
@Controller("campgrounds/:campgroundId/referral-programs")
export class ReferralsController {
  constructor(private readonly referrals: ReferralsService) {}

  @Get()
  list(@Param("campgroundId") campgroundId: string) {
    return this.referrals.listPrograms(campgroundId);
  }

  @Post()
  create(@Param("campgroundId") campgroundId: string, @Body() dto: CreateReferralProgramDto) {
    return this.referrals.createProgram(campgroundId, dto);
  }

  @Patch(":id")
  update(
    @Param("campgroundId") campgroundId: string,
    @Param("id") id: string,
    @Body() dto: UpdateReferralProgramDto,
  ) {
    return this.referrals.updateProgram(campgroundId, id, dto);
  }
}
