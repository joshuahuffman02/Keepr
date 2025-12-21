import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { RoomMovesService } from './room-moves.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@Controller('room-moves')
@UseGuards(JwtAuthGuard)
export class RoomMovesController {
  constructor(private roomMovesService: RoomMovesService) {}

  @Post()
  createMoveRequest(
    @Body() body: {
      reservationId: string;
      toSiteId: string;
      moveDate: string;
      moveReason: string;
      isComplimentary?: boolean;
      notes?: string;
    },
    @CurrentUser() user: any,
  ) {
    return this.roomMovesService.createMoveRequest({
      ...body,
      moveDate: new Date(body.moveDate),
      requestedById: user.id,
    });
  }

  @Get(':id')
  getMoveRequest(@Param('id') id: string) {
    return this.roomMovesService.getMoveRequest(id);
  }

  @Get('reservation/:reservationId')
  getMoveRequestsByReservation(@Param('reservationId') reservationId: string) {
    return this.roomMovesService.getMoveRequestsByReservation(reservationId);
  }

  @Get()
  getPendingMoveRequests(@Query('campgroundId') campgroundId: string) {
    return this.roomMovesService.getPendingMoveRequests(campgroundId);
  }

  @Get('today')
  getTodaysMoves(@Query('campgroundId') campgroundId: string) {
    return this.roomMovesService.getTodaysMoves(campgroundId);
  }

  @Post(':id/approve')
  approveMoveRequest(
    @Param('id') id: string,
    @CurrentUser() user: any,
  ) {
    return this.roomMovesService.approveMoveRequest(id, user.id);
  }

  @Post(':id/complete')
  completeMoveRequest(
    @Param('id') id: string,
    @CurrentUser() user: any,
  ) {
    return this.roomMovesService.completeMoveRequest(id, user.id);
  }

  @Post(':id/cancel')
  cancelMoveRequest(@Param('id') id: string) {
    return this.roomMovesService.cancelMoveRequest(id);
  }
}
