import { Body, Controller, Get, Param, Post, Put, Query, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../auth/guards";
import { SiteMapService } from "./site-map.service";
import { UpsertMapDto } from "./dto/upsert-map.dto";
import { CheckAssignmentDto } from "./dto/check-assignment.dto";
import { PreviewAssignmentsDto } from "./dto/preview-assignments.dto";

@UseGuards(JwtAuthGuard)
@Controller()
export class SiteMapController {
  constructor(private readonly siteMap: SiteMapService) { }

  @Get("campgrounds/:campgroundId/map")
  getMap(
    @Param("campgroundId") campgroundId: string,
    @Query("startDate") startDate?: string,
    @Query("endDate") endDate?: string
  ) {
    return this.siteMap.getMap(campgroundId, startDate, endDate);
  }

  @Put("campgrounds/:campgroundId/map")
  upsertMap(@Param("campgroundId") campgroundId: string, @Body() body: UpsertMapDto) {
    return this.siteMap.upsertMap(campgroundId, body);
  }

  @Post("campgrounds/:campgroundId/assignments/check")
  check(@Param("campgroundId") campgroundId: string, @Body() body: CheckAssignmentDto) {
    return this.siteMap.checkAssignment(campgroundId, body);
  }

  @Post("campgrounds/:campgroundId/assignments/preview")
  preview(@Param("campgroundId") campgroundId: string, @Body() body: PreviewAssignmentsDto) {
    return this.siteMap.previewAssignments(campgroundId, body);
  }
}
