import { Body, Controller, Get, Post, Query, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../auth/guards";
import { Roles, RolesGuard } from "../auth/guards/roles.guard";
import { UserRole } from "@prisma/client";
import { NpsService } from "./nps.service";
import { CreateNpsSurveyDto } from "./dto/create-nps-survey.dto";
import { CreateNpsRuleDto } from "./dto/create-nps-rule.dto";
import { CreateNpsInviteDto } from "./dto/create-nps-invite.dto";
import { RespondNpsDto } from "./dto/respond-nps.dto";

@Controller()
export class NpsController {
  constructor(private readonly npsService: NpsService) {}

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.owner, UserRole.manager, UserRole.marketing, UserRole.front_desk)
  @Post("nps/surveys")
  createSurvey(@Body() dto: CreateNpsSurveyDto) {
    return this.npsService.createSurvey(dto);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(
    UserRole.owner,
    UserRole.manager,
    UserRole.marketing,
    UserRole.front_desk,
    UserRole.readonly,
  )
  @Get("nps/surveys")
  listSurveys(@Query("campgroundId") campgroundId: string) {
    return this.npsService.listSurveys(campgroundId);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.owner, UserRole.manager, UserRole.marketing)
  @Post("nps/rules")
  addRule(@Body() dto: CreateNpsRuleDto) {
    return this.npsService.addRule(dto);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.owner, UserRole.manager, UserRole.marketing, UserRole.front_desk)
  @Post("nps/invites")
  createInvite(@Body() dto: CreateNpsInviteDto) {
    return this.npsService.createInvite(dto);
  }

  @Post("nps/respond")
  respond(@Body() dto: RespondNpsDto) {
    return this.npsService.respond(dto);
  }

  @Post("nps/open")
  recordOpen(@Body("token") token: string) {
    return this.npsService.recordOpen(token);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(
    UserRole.owner,
    UserRole.manager,
    UserRole.marketing,
    UserRole.front_desk,
    UserRole.readonly,
  )
  @Get("nps/metrics")
  metrics(@Query("campgroundId") campgroundId: string) {
    return this.npsService.metrics(campgroundId);
  }
}
