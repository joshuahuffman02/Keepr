import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards } from "@nestjs/common";
import { GuestEquipmentService } from "./guest-equipment.service";
import { JwtAuthGuard } from "../auth/guards";

@UseGuards(JwtAuthGuard)
@Controller("guests")
export class GuestEquipmentController {
  constructor(private readonly guestEquipmentService: GuestEquipmentService) {}

  @Post(":guestId/equipment")
  create(
    @Param("guestId") guestId: string,
    @Body()
    body: {
      type: string;
      make?: string;
      model?: string;
      length?: number;
      plateNumber?: string;
      plateState?: string;
    },
  ) {
    return this.guestEquipmentService.create(guestId, body);
  }

  @Get(":guestId/equipment")
  findAll(@Param("guestId") guestId: string) {
    return this.guestEquipmentService.findAll(guestId);
  }

  @Patch("equipment/:id")
  update(
    @Param("id") id: string,
    @Body()
    body: {
      type?: string;
      make?: string;
      model?: string;
      length?: number;
      plateNumber?: string;
      plateState?: string;
    },
  ) {
    return this.guestEquipmentService.update(id, body);
  }

  @Delete("equipment/:id")
  remove(@Param("id") id: string) {
    return this.guestEquipmentService.remove(id);
  }
}
