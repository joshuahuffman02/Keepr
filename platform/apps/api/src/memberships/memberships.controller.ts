import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  UseGuards,
} from "@nestjs/common";
import { MembershipsService } from "./memberships.service";
import { JwtAuthGuard } from "../auth/guards";
import {
  CreateMembershipTypeDto,
  UpdateMembershipTypeDto,
  PurchaseMembershipDto,
} from "./dto/memberships.dto";

@UseGuards(JwtAuthGuard)
@Controller("memberships")
export class MembershipsController {
  constructor(private readonly membershipsService: MembershipsService) {}

  // Types
  @Post("types")
  createType(@Body() createTypeDto: CreateMembershipTypeDto) {
    const { campgroundId, ...data } = createTypeDto;
    return this.membershipsService.createType(campgroundId, data);
  }

  @Get("types")
  findAllTypes(@Query("campgroundId") campgroundId: string) {
    return this.membershipsService.findAllTypes(campgroundId);
  }

  @Patch("types/:id")
  updateType(@Param("id") id: string, @Body() updateTypeDto: UpdateMembershipTypeDto) {
    return this.membershipsService.updateType(id, updateTypeDto);
  }

  @Delete("types/:id")
  deleteType(@Param("id") id: string) {
    return this.membershipsService.deleteType(id);
  }

  // Guest Memberships
  @Post("purchase")
  purchase(@Body() purchaseDto: PurchaseMembershipDto) {
    return this.membershipsService.purchaseMembership(
      purchaseDto.guestId,
      purchaseDto.membershipTypeId,
    );
  }

  @Get("guest/:guestId")
  getGuestMemberships(@Param("guestId") guestId: string) {
    return this.membershipsService.getGuestMemberships(guestId);
  }
}
