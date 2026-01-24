import type { Request } from "express";
import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  UseGuards,
  Req,
  UnauthorizedException,
} from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
import { SelfCheckinService } from "./self-checkin.service";

type GuestRequest = Request & { user?: { id: string } };

@UseGuards(AuthGuard("guest-jwt"))
@Controller("reservations/:id")
export class SelfCheckinController {
  constructor(private readonly selfCheckinService: SelfCheckinService) {}

  @Get("checkin-status")
  getStatus(@Param("id") id: string, @Req() req: GuestRequest) {
    // Validate that the guest owns this reservation
    const guestId = req.user?.id;
    if (!guestId) throw new UnauthorizedException("Guest authentication required");
    return this.selfCheckinService.getStatus(id, guestId);
  }

  @Post("self-checkin")
  selfCheckin(
    @Param("id") id: string,
    @Body() body: { lateArrival?: boolean; override?: boolean },
    @Req() req: GuestRequest,
  ) {
    // Pass the guest ID to track who performed the action
    const guestId = req.user?.id;
    if (!guestId) throw new UnauthorizedException("Guest authentication required");
    return this.selfCheckinService.selfCheckin(id, {
      ...body,
      actorId: guestId,
    });
  }

  @Post("self-checkout")
  selfCheckout(
    @Param("id") id: string,
    @Body()
    body: {
      damageNotes?: string;
      damagePhotos?: string[];
      override?: boolean;
    },
    @Req() req: GuestRequest,
  ) {
    // Pass the guest ID to track who performed the action
    const guestId = req.user?.id;
    if (!guestId) throw new UnauthorizedException("Guest authentication required");
    return this.selfCheckinService.selfCheckout(id, {
      ...body,
      actorId: guestId,
    });
  }
}
