import { Module } from '@nestjs/common';
import { GroupBookingsController } from './group-bookings.controller';
import { GroupBookingsService } from './group-bookings.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [GroupBookingsController],
  providers: [GroupBookingsService],
  exports: [GroupBookingsService],
})
export class GroupBookingsModule {}
