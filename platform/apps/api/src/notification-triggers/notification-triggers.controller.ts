import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Headers,
  UseGuards,
} from '@nestjs/common';
import { NotificationTriggersService, TriggerEvent } from './notification-triggers.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard, Roles } from '../auth/guards/roles.guard';
import { ScopeGuard } from '../auth/guards/scope.guard';
import { UserRole } from '@prisma/client';

@UseGuards(JwtAuthGuard, RolesGuard, ScopeGuard)
@Controller('campgrounds/:campgroundId/notification-triggers')
export class NotificationTriggersController {
  constructor(private readonly service: NotificationTriggersService) {}

  @Roles(UserRole.owner, UserRole.manager)
  @Get()
  list(@Param('campgroundId') campgroundId: string) {
    return this.service.list(campgroundId);
  }

  @Roles(UserRole.owner, UserRole.manager)
  @Post()
  create(
    @Param('campgroundId') campgroundId: string,
    @Body() body: {
      event: TriggerEvent;
      channel: 'email' | 'sms' | 'both';
      enabled?: boolean;
      templateId?: string;
      delayMinutes?: number;
      conditions?: Record<string, any>;
    }
  ) {
    return this.service.create(campgroundId, body);
  }

  @Roles(UserRole.owner, UserRole.manager)
  @Patch(':id')
  update(
    @Param('campgroundId') campgroundId: string,
    @Param('id') id: string,
    @Body() body: Partial<{
      event: TriggerEvent;
      channel: 'email' | 'sms' | 'both';
      enabled: boolean;
      templateId: string | null;
      delayMinutes: number;
      conditions: Record<string, any> | null;
    }>
  ) {
    return this.service.update(id, body, campgroundId);
  }

  @Roles(UserRole.owner, UserRole.manager)
  @Delete(':id')
  delete(
    @Param('campgroundId') campgroundId: string,
    @Param('id') id: string
  ) {
    return this.service.delete(id, campgroundId);
  }
}

/**
 * Controller for trigger-by-ID operations (update, delete, test)
 * Requires x-campground-id header for multi-tenant isolation
 */
@UseGuards(JwtAuthGuard, RolesGuard, ScopeGuard)
@Controller('notification-triggers')
export class NotificationTriggersByIdController {
  constructor(private readonly service: NotificationTriggersService) {}

  @Roles(UserRole.owner, UserRole.manager)
  @Patch(':id')
  update(
    @Headers('x-campground-id') campgroundId: string,
    @Param('id') id: string,
    @Body() body: Partial<{
      event: TriggerEvent;
      channel: 'email' | 'sms' | 'both';
      enabled: boolean;
      templateId: string | null;
      delayMinutes: number;
      conditions: Record<string, any> | null;
    }>
  ) {
    return this.service.update(id, body, campgroundId);
  }

  @Roles(UserRole.owner, UserRole.manager)
  @Delete(':id')
  delete(
    @Headers('x-campground-id') campgroundId: string,
    @Param('id') id: string
  ) {
    return this.service.delete(id, campgroundId);
  }

  @Roles(UserRole.owner, UserRole.manager)
  @Post(':id/test')
  test(
    @Headers('x-campground-id') campgroundId: string,
    @Param('id') id: string,
    @Body() body: { email: string }
  ) {
    return this.service.sendTestNotification(id, body.email, campgroundId);
  }
}
