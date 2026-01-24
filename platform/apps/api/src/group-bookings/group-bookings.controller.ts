import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
} from "@nestjs/common";
import { GroupBookingsService } from "./group-bookings.service";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";

@Controller("group-bookings")
@UseGuards(JwtAuthGuard)
export class GroupBookingsController {
  constructor(private groupBookingsService: GroupBookingsService) {}

  @Post()
  create(
    @Body()
    body: {
      campgroundId: string;
      groupName: string;
      primaryGuestId: string;
      groupType: string;
      preferAdjacent?: boolean;
      preferSameFloor?: boolean;
      preferConnecting?: boolean;
      preferredZone?: string;
      billingType?: string;
      groupArrivalTime?: string;
      groupDepartureTime?: string;
    },
  ) {
    return this.groupBookingsService.create(body);
  }

  @Get()
  findAll(
    @Query("campgroundId") campgroundId: string,
    @Query("groupType") groupType?: string,
    @Query("assignmentStatus") assignmentStatus?: string,
  ) {
    return this.groupBookingsService.findAll(campgroundId, {
      groupType,
      assignmentStatus,
    });
  }

  @Get("stats")
  getStats(
    @Query("campgroundId") campgroundId: string,
    @Query("startDate") startDate?: string,
    @Query("endDate") endDate?: string,
  ) {
    const dateRange =
      startDate && endDate ? { start: new Date(startDate), end: new Date(endDate) } : undefined;
    return this.groupBookingsService.getGroupStats(campgroundId, dateRange);
  }

  @Get(":id")
  findOne(@Param("id") id: string) {
    return this.groupBookingsService.findOne(id);
  }

  @Patch(":id")
  update(
    @Param("id") id: string,
    @Body()
    body: Partial<{
      groupName: string;
      groupType: string;
      preferAdjacent: boolean;
      preferSameFloor: boolean;
      preferConnecting: boolean;
      preferredZone: string;
      billingType: string;
      groupArrivalTime: string;
      groupDepartureTime: string;
    }>,
  ) {
    return this.groupBookingsService.update(id, body);
  }

  @Delete(":id")
  delete(@Param("id") id: string) {
    return this.groupBookingsService.delete(id);
  }

  @Post(":id/reservations")
  addReservation(@Param("id") groupId: string, @Body() body: { reservationId: string }) {
    return this.groupBookingsService.addReservationToGroup(groupId, body.reservationId);
  }

  @Delete(":id/reservations/:reservationId")
  removeReservation(@Param("id") groupId: string, @Param("reservationId") reservationId: string) {
    return this.groupBookingsService.removeReservationFromGroup(reservationId);
  }

  @Post(":id/optimize-assignments")
  optimizeAssignments(@Param("id") id: string) {
    return this.groupBookingsService.optimizeRoomAssignments(id);
  }
}
