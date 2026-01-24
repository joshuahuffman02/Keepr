import {
  BadRequestException,
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import { AbandonedCartService } from "./abandoned-cart.service";
import { JwtAuthGuard } from "../auth/guards";

@Controller()
export class AbandonedCartController {
  constructor(private readonly abandonedCarts: AbandonedCartService) {}

  @UseGuards(JwtAuthGuard)
  @Get("abandoned-carts")
  list(@Query("campgroundId") campgroundId?: string) {
    if (!campgroundId) throw new BadRequestException("campgroundId is required");
    return this.abandonedCarts.list(campgroundId);
  }

  @UseGuards(JwtAuthGuard)
  @Post("abandoned-carts/queue")
  queue(
    @Body() body: { campgroundId?: string; email?: string; phone?: string; abandonedAt?: string },
  ) {
    if (!body.campgroundId) throw new BadRequestException("campgroundId is required");
    return this.abandonedCarts.record({
      campgroundId: body.campgroundId,
      email: body.email,
      phone: body.phone,
      abandonedAt: body.abandonedAt,
    });
  }

  @UseGuards(JwtAuthGuard)
  @Post("abandoned-carts/:id/contact")
  markContacted(@Param("id") id: string, @Body() body: { note?: string }) {
    const updated = this.abandonedCarts.markContacted(id, body?.note);
    if (!updated) {
      throw new NotFoundException("Abandoned cart not found");
    }
    return updated;
  }
}
