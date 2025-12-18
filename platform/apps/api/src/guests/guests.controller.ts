import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards, ForbiddenException } from "@nestjs/common";
import { GuestsService } from "./guests.service";
import { CreateGuestDto } from "./dto/create-guest.dto";
import { JwtAuthGuard } from "../auth/guards";

@UseGuards(JwtAuthGuard)
@Controller("guests")
export class GuestsController {
  constructor(private readonly guests: GuestsService) { }

  @Get()
  findAll(@Query("campgroundId") campgroundId?: string) {
    // Require campgroundId to prevent cross-tenant data access
    if (!campgroundId) {
      throw new ForbiddenException("campgroundId is required to list guests");
    }
    return this.guests.findAllByCampground(campgroundId);
  }

  @Get(":id")
  findOne(@Param("id") id: string, @Query("campgroundId") campgroundId?: string) {
    // When campgroundId provided, verify guest belongs to that campground
    return this.guests.findOne(id, campgroundId);
  }

  @Post()
  create(@Body() body: CreateGuestDto) {
    return this.guests.create(body);
  }

  @Patch(":id")
  update(@Param("id") id: string, @Body() body: Partial<CreateGuestDto>) {
    return this.guests.update(id, body);
  }

  @Delete(":id")
  remove(@Param("id") id: string) {
    return this.guests.remove(id);
  }
}
