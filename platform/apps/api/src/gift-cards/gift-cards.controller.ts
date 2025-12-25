import { Body, Controller, Param, Post, Req, UseGuards } from "@nestjs/common";
import { HttpCode as SetHttpCode } from "@nestjs/common/decorators/http/http-code.decorator";
import { JwtAuthGuard } from "../auth/guards";
import { RolesGuard, Roles } from "../auth/guards/roles.guard";
import { UserRole } from "@prisma/client";
import { IsInt, IsString, Min } from "class-validator";
import { Type } from "class-transformer";
import { GiftCardsService } from "./gift-cards.service";

class RedeemGiftCardDto {
  @IsString()
  code!: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  amountCents!: number;
}

@Controller()
@UseGuards(JwtAuthGuard, RolesGuard)
export class GiftCardsController {
  constructor(private readonly giftCards: GiftCardsService) {}

  @Roles(UserRole.owner, UserRole.manager, UserRole.finance)
  @Post("bookings/:bookingId/gift-cards/redeem")
  @SetHttpCode(200)
  redeemBooking(@Param("bookingId") bookingId: string, @Body() body: RedeemGiftCardDto, @Req() req: any) {
    return this.giftCards.redeemAgainstBooking(body.code, body.amountCents, bookingId, req.user);
  }

  @Roles(UserRole.owner, UserRole.manager, UserRole.finance)
  @Post("pos/orders/:orderId/gift-cards/redeem")
  @SetHttpCode(200)
  redeemPosOrder(@Param("orderId") orderId: string, @Body() body: RedeemGiftCardDto, @Req() req: any) {
    return this.giftCards.redeemAgainstPosOrder(body.code, body.amountCents, orderId, req.user);
  }
}
