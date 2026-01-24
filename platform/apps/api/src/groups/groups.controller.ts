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
import { GroupsService } from "./groups.service";
import { JwtAuthGuard } from "../auth/guards";

@UseGuards(JwtAuthGuard)
@Controller("groups")
export class GroupsController {
  constructor(private readonly groupsService: GroupsService) {}

  @Post()
  create(
    @Body()
    createGroupDto: {
      tenantId: string;
      name?: string;
      sharedPayment?: boolean;
      sharedComm?: boolean;
      reservationIds?: string[];
      primaryReservationId?: string;
    },
  ) {
    return this.groupsService.create(createGroupDto);
  }

  @Get()
  findAll(@Query("tenantId") tenantId: string) {
    return this.groupsService.findAll(tenantId);
  }

  @Get(":id")
  findOne(@Param("id") id: string) {
    return this.groupsService.findOne(id);
  }

  @Patch(":id")
  update(
    @Param("id") id: string,
    @Body()
    updateGroupDto: {
      sharedPayment?: boolean;
      sharedComm?: boolean;
      addReservationIds?: string[];
      removeReservationIds?: string[];
    },
  ) {
    return this.groupsService.update(id, updateGroupDto);
  }

  @Delete(":id")
  remove(@Param("id") id: string) {
    return this.groupsService.remove(id);
  }
}
