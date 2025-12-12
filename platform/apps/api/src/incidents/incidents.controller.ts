import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../auth/guards";
import { Roles, RolesGuard } from "../auth/guards/roles.guard";
import { IncidentsService } from "./incidents.service";
import { CreateIncidentDto } from "./dto/create-incident.dto";
import { UpdateIncidentDto } from "./dto/update-incident.dto";
import { AddEvidenceDto } from "./dto/add-evidence.dto";
import { LinkClaimDto } from "./dto/link-claim.dto";
import { SetReminderDto } from "./dto/set-reminder.dto";
import { CreateIncidentTaskDto, UpdateIncidentTaskDto } from "./dto/task.dto";
import { CloseIncidentDto } from "./dto/close-incident.dto";
import { CreateCoiDto } from "./dto/create-coi.dto";

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles("owner", "manager", "front_desk", "maintenance")
@Controller("incidents")
export class IncidentsController {
  constructor(private readonly incidents: IncidentsService) {}

  @Get()
  list(@Query("campgroundId") campgroundId: string) {
    return this.incidents.list(campgroundId);
  }

  @Post()
  create(@Body() dto: CreateIncidentDto) {
    return this.incidents.create(dto);
  }

  @Patch(":id")
  update(@Param("id") id: string, @Body() dto: UpdateIncidentDto) {
    return this.incidents.update(id, dto);
  }

  @Post(":id/close")
  close(@Param("id") id: string, @Body() dto: CloseIncidentDto) {
    return this.incidents.close(id, dto);
  }

  @Post(":id/evidence")
  addEvidence(@Param("id") id: string, @Body() dto: AddEvidenceDto) {
    return this.incidents.addEvidence(id, dto);
  }

  @Post(":id/claim")
  linkClaim(@Param("id") id: string, @Body() dto: LinkClaimDto) {
    return this.incidents.linkClaim(id, dto);
  }

  @Post(":id/reminder")
  setReminder(@Param("id") id: string, @Body() dto: SetReminderDto) {
    return this.incidents.setReminder(id, dto);
  }

  @Post(":id/coi")
  attachCoi(@Param("id") id: string, @Body() dto: CreateCoiDto) {
    return this.incidents.attachCoi(id, dto);
  }

  @Post(":id/tasks")
  createTask(@Param("id") id: string, @Body() dto: CreateIncidentTaskDto) {
    return this.incidents.createTask(id, dto);
  }

  @Patch(":id/tasks/:taskId")
  updateTask(
    @Param("id") id: string,
    @Param("taskId") taskId: string,
    @Body() dto: UpdateIncidentTaskDto,
  ) {
    return this.incidents.updateTask(id, taskId, dto);
  }

  @Get("report/export")
  report(
    @Query("campgroundId") campgroundId: string,
    @Query("format") format?: string,
  ) {
    return this.incidents.report(campgroundId, format);
  }
}
