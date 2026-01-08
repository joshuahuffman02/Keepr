import {
  Controller,
  Post,
  Get,
  Body,
  Query,
  UseGuards,
  Request,
  Logger,
  Param,
  HttpCode,
  HttpStatus,
  ForbiddenException,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Throttle } from '@nestjs/throttler';
import { ChatService } from './chat.service';
import { SendMessageDto, ChatMessageResponse } from './dto/send-message.dto';
import { ExecuteActionDto, ExecuteActionResponse } from './dto/execute-action.dto';
import { GetHistoryDto, ConversationHistoryResponse } from './dto/get-history.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ScopeGuard } from '../auth/guards/scope.guard';
import { ChatParticipantType, Guest } from '@prisma/client';

// Types for authenticated staff requests
interface StaffAuthenticatedRequest extends Request {
  user: {
    id: string;
    email: string;
    campgroundId?: string;
    role?: string;
    memberships?: { campgroundId: string; role: string }[];
  };
}

// Types for authenticated guest requests
interface GuestAuthenticatedRequest extends Request {
  user: Guest;
}

@Controller('chat')
export class ChatController {
  private readonly logger = new Logger(ChatController.name);

  constructor(private readonly chatService: ChatService) {}

  /**
   * Get staff role for campground from memberships
   */
  private getStaffRole(req: StaffAuthenticatedRequest, campgroundId: string): string | undefined {
    const membership = req.user.memberships?.find(m => m.campgroundId === campgroundId);
    return membership?.role || req.user.role;
  }

  /**
   * Staff chat endpoint
   * POST /campgrounds/:campgroundId/chat/message
   */
  @Post('/campgrounds/:campgroundId/message')
  @UseGuards(JwtAuthGuard, ScopeGuard)
  @Throttle({ default: { limit: 60, ttl: 60000 } }) // 60 messages per minute for staff
  @HttpCode(HttpStatus.OK)
  async sendStaffMessage(
    @Param('campgroundId') campgroundId: string,
    @Body() dto: SendMessageDto,
    @Request() req: StaffAuthenticatedRequest,
  ): Promise<ChatMessageResponse> {
    this.logger.log(`Staff chat message from user ${req.user.id}`);

    return this.chatService.sendMessage(dto, {
      campgroundId,
      participantType: ChatParticipantType.staff,
      participantId: req.user.id,
      role: this.getStaffRole(req, campgroundId),
    });
  }

  /**
   * Staff chat streaming endpoint (uses WebSocket for response)
   * POST /campgrounds/:campgroundId/chat/message/stream
   */
  @Post('/campgrounds/:campgroundId/message/stream')
  @UseGuards(JwtAuthGuard, ScopeGuard)
  @Throttle({ default: { limit: 60, ttl: 60000 } })
  @HttpCode(HttpStatus.ACCEPTED)
  async sendStaffMessageStream(
    @Param('campgroundId') campgroundId: string,
    @Body() dto: SendMessageDto,
    @Request() req: StaffAuthenticatedRequest,
  ): Promise<{ status: string; message: string }> {
    this.logger.log(`Staff chat stream from user ${req.user.id}`);

    // Fire and forget - response comes via WebSocket
    this.chatService.sendMessageStream(dto, {
      campgroundId,
      participantType: ChatParticipantType.staff,
      participantId: req.user.id,
      role: this.getStaffRole(req, campgroundId),
    }).catch(err => {
      this.logger.error('Staff stream error:', err);
    });

    return { status: 'streaming', message: 'Response will be delivered via WebSocket' };
  }

  /**
   * Staff action execution endpoint
   * POST /campgrounds/:campgroundId/chat/action
   */
  @Post('/campgrounds/:campgroundId/action')
  @UseGuards(JwtAuthGuard, ScopeGuard)
  @Throttle({ default: { limit: 30, ttl: 60000 } }) // 30 actions per minute
  @HttpCode(HttpStatus.OK)
  async executeStaffAction(
    @Param('campgroundId') campgroundId: string,
    @Body() dto: ExecuteActionDto,
    @Request() req: StaffAuthenticatedRequest,
  ): Promise<ExecuteActionResponse> {
    return this.chatService.executeAction(dto, {
      campgroundId,
      participantType: ChatParticipantType.staff,
      participantId: req.user.id,
      role: this.getStaffRole(req, campgroundId),
    });
  }

  /**
   * Staff chat history endpoint
   * GET /campgrounds/:campgroundId/chat/history
   */
  @Get('/campgrounds/:campgroundId/history')
  @UseGuards(JwtAuthGuard, ScopeGuard)
  async getStaffHistory(
    @Param('campgroundId') campgroundId: string,
    @Query() dto: GetHistoryDto,
    @Request() req: StaffAuthenticatedRequest,
  ): Promise<ConversationHistoryResponse> {
    return this.chatService.getHistory(dto, {
      campgroundId,
      participantType: ChatParticipantType.staff,
      participantId: req.user.id,
      role: this.getStaffRole(req, campgroundId),
    });
  }

  /**
   * Guest chat endpoint (for portal)
   * POST /portal/:campgroundId/chat/message
   * Requires guest authentication - guest must be logged in via magic link
   */
  @Post('/portal/:campgroundId/message')
  @UseGuards(AuthGuard('guest-jwt'))
  @Throttle({ default: { limit: 20, ttl: 60000 } }) // 20 messages per minute for guests
  @HttpCode(HttpStatus.OK)
  async sendGuestMessage(
    @Param('campgroundId') campgroundId: string,
    @Body() dto: SendMessageDto,
    @Request() req: GuestAuthenticatedRequest,
  ): Promise<ChatMessageResponse> {
    const guest = req.user;

    // Verify guest belongs to this campground
    if (guest.campgroundId !== campgroundId) {
      throw new ForbiddenException('You do not have access to this campground');
    }

    this.logger.log(`Guest chat message from guest ${guest.id}`);

    return this.chatService.sendMessage(dto, {
      campgroundId,
      participantType: ChatParticipantType.guest,
      participantId: guest.id,
    });
  }

  /**
   * Guest chat streaming endpoint (uses WebSocket for response)
   * POST /portal/:campgroundId/chat/message/stream
   */
  @Post('/portal/:campgroundId/message/stream')
  @UseGuards(AuthGuard('guest-jwt'))
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  @HttpCode(HttpStatus.ACCEPTED)
  async sendGuestMessageStream(
    @Param('campgroundId') campgroundId: string,
    @Body() dto: SendMessageDto,
    @Request() req: GuestAuthenticatedRequest,
  ): Promise<{ status: string; message: string }> {
    const guest = req.user;

    // Verify guest belongs to this campground
    if (guest.campgroundId !== campgroundId) {
      throw new ForbiddenException('You do not have access to this campground');
    }

    this.logger.log(`Guest chat stream from ${guest.id}`);

    // Fire and forget - response comes via WebSocket
    this.chatService.sendMessageStream(dto, {
      campgroundId,
      participantType: ChatParticipantType.guest,
      participantId: guest.id,
    }).catch(err => {
      this.logger.error('Guest stream error:', err);
    });

    return { status: 'streaming', message: 'Response will be delivered via WebSocket' };
  }

  /**
   * Guest action execution endpoint
   * POST /portal/:campgroundId/chat/action
   */
  @Post('/portal/:campgroundId/action')
  @UseGuards(AuthGuard('guest-jwt'))
  @Throttle({ default: { limit: 15, ttl: 60000 } }) // 15 actions per minute
  @HttpCode(HttpStatus.OK)
  async executeGuestAction(
    @Param('campgroundId') campgroundId: string,
    @Body() dto: ExecuteActionDto,
    @Request() req: GuestAuthenticatedRequest,
  ): Promise<ExecuteActionResponse> {
    const guest = req.user;

    // Verify guest belongs to this campground
    if (guest.campgroundId !== campgroundId) {
      throw new ForbiddenException('You do not have access to this campground');
    }

    return this.chatService.executeAction(dto, {
      campgroundId,
      participantType: ChatParticipantType.guest,
      participantId: guest.id,
    });
  }

  /**
   * Guest chat history endpoint
   * GET /portal/:campgroundId/chat/history
   */
  @Get('/portal/:campgroundId/history')
  @UseGuards(AuthGuard('guest-jwt'))
  async getGuestHistory(
    @Param('campgroundId') campgroundId: string,
    @Query() dto: GetHistoryDto,
    @Request() req: GuestAuthenticatedRequest,
  ): Promise<ConversationHistoryResponse> {
    const guest = req.user;

    // Verify guest belongs to this campground
    if (guest.campgroundId !== campgroundId) {
      throw new ForbiddenException('You do not have access to this campground');
    }

    return this.chatService.getHistory(dto, {
      campgroundId,
      participantType: ChatParticipantType.guest,
      participantId: guest.id,
    });
  }
}
