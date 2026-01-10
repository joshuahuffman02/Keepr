import { BadRequestException, Body, Controller, Param, Post, Req, UseGuards } from "@nestjs/common";
import { HttpCode as SetHttpCode } from "@nestjs/common/decorators/http/http-code.decorator";
import { JwtAuthGuard } from "../auth/guards";
import { RolesGuard, Roles } from "../auth/guards/roles.guard";
import { UserRole } from "@prisma/client";
import { IsInt, IsString, Min } from "class-validator";
import { Type } from "class-transformer";
import { GiftCardsService } from "./gift-cards.service";
import { ScopeGuard } from "../permissions/scope.guard";

class RedeemGiftCardDto {
  @IsString()
  code!: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  amountCents!: number;
}

@Controller()
@UseGuards(JwtAuthGuard, RolesGuard, ScopeGuard)
export class GiftCardsController {
  constructor(private readonly giftCards: GiftCardsService) {}

  private requireCampgroundId(req: any): string {
    const campgroundId = req?.campgroundId || req?.headers?.["x-campground-id"];
    if (!campgroundId) {
      throw new BadRequestException("campgroundId is required");
    }
    return campgroundId;
  }

  private assertCampgroundAccess(campgroundId: string, user: any): void {
    const isPlatformStaff = user?.platformRole === "platform_admin" ||
                            user?.platformRole === "platform_superadmin" ||
                            user?.platformRole === "support_agent";
    if (isPlatformStaff) {
      return;
    }

    const userCampgroundIds = user?.memberships?.map((m: any) => m.campgroundId) ?? [];
    if (!userCampgroundIds.includes(campgroundId)) {
      throw new BadRequestException("You do not have access to this campground");
    }
  }

  @Roles(UserRole.owner, UserRole.manager, UserRole.finance)
  @Post("bookings/:bookingId/gift-cards/redeem")
  @SetHttpCode(200)
  redeemBooking(@Param("bookingId") bookingId: string, @Body() body: RedeemGiftCardDto, @Req() req: Request) {
    const requiredCampgroundId = this.requireCampgroundId(req);
    this.assertCampgroundAccess(requiredCampgroundId, req.user);
    const actor = { ...req.user, campgroundId: requiredCampgroundId };
    return this.giftCards.redeemAgainstBooking(body.code, body.amountCents, bookingId, actor);
  }

  @Roles(UserRole.owner, UserRole.manager, UserRole.finance)
  @Post("pos/orders/:orderId/gift-cards/redeem")
  @SetHttpCode(200)
  redeemPosOrder(@Param("orderId") orderId: string, @Body() body: RedeemGiftCardDto, @Req() req: Request) {
    const requiredCampgroundId = this.requireCampgroundId(req);
    this.assertCampgroundAccess(requiredCampgroundId, req.user);
    const actor = { ...req.user, campgroundId: requiredCampgroundId };
    return this.giftCards.redeemAgainstPosOrder(body.code, body.amountCents, orderId, actor);
  }
}
