import {
  Controller,
  Post,
  Get,
  Delete,
  Body,
  Query,
  UseGuards,
  Req,
  Logger,
  Param,
  HttpCode,
  HttpStatus,
  BadRequestException,
  ForbiddenException,
} from "@nestjs/common";
import type { Request as ExpressRequest } from "express";
import { AuthGuard } from "@nestjs/passport";
import { Throttle } from "@nestjs/throttler";
import { ChatService } from "./chat.service";
import { UploadsService } from "../uploads/uploads.service";
import { FeatureFlagService } from "../admin/feature-flag.service";
import { SendMessageDto, ChatMessageResponse } from "./dto/send-message.dto";
import { ExecuteActionDto, ExecuteActionResponse } from "./dto/execute-action.dto";
import { ExecuteToolDto, ExecuteToolResponse } from "./dto/execute-tool.dto";
import { GetHistoryDto, ConversationHistoryResponse } from "./dto/get-history.dto";
import { GetConversationsDto, ConversationListResponse } from "./dto/get-conversations.dto";
import { GetTranscriptDto, TranscriptResponse } from "./dto/get-transcript.dto";
import { SubmitFeedbackDto, SubmitFeedbackResponse } from "./dto/submit-feedback.dto";
import { RegenerateMessageDto } from "./dto/regenerate-message.dto";
import { SignChatAttachmentDto, SignChatAttachmentResponse } from "./dto/sign-attachment.dto";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { ScopeGuard } from "../auth/guards/scope.guard";
import { Roles, RolesGuard } from "../auth/guards/roles.guard";
import { ChatParticipantType, Guest, PlatformRole, UserRole } from "@prisma/client";
import type { AuthUser } from "../auth/auth.types";
import * as path from "path";

// Types for authenticated staff requests
type StaffAuthenticatedRequest = Omit<ExpressRequest, "user"> & { user: AuthUser };

// Types for authenticated guest requests
type GuestAuthenticatedRequest = Omit<ExpressRequest, "user"> & { user: Guest };

const CHAT_ATTACHMENT_ALLOWED_EXTENSIONS = [".jpg", ".jpeg", ".png", ".gif", ".webp", ".pdf"];
const CHAT_ATTACHMENT_ALLOWED_CONTENT_TYPES = [
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "application/pdf",
];
const CHAT_ATTACHMENT_MAX_BYTES = 10 * 1024 * 1024;
const STAFF_CHAT_FLAG_KEY = "chat_widget_staff";
const PORTAL_CHAT_FLAG_KEY = "chat_widget_portal";
const STAFF_CHAT_ROLES = [
  UserRole.owner,
  UserRole.manager,
  UserRole.front_desk,
  UserRole.maintenance,
  UserRole.finance,
  UserRole.marketing,
  UserRole.readonly,
  PlatformRole.platform_admin,
  PlatformRole.support_agent,
  PlatformRole.support_lead,
  PlatformRole.regional_support,
  PlatformRole.ops_engineer,
];

@Controller("chat")
export class ChatController {
  private readonly logger = new Logger(ChatController.name);

  constructor(
    private readonly chatService: ChatService,
    private readonly uploads: UploadsService,
    private readonly flags: FeatureFlagService,
  ) {}

  /**
   * Get staff role for campground from memberships
   */
  private getStaffRole(req: StaffAuthenticatedRequest, campgroundId: string): string | undefined {
    const membership = req.user.memberships?.find((m) => m.campgroundId === campgroundId);
    return membership?.role ?? req.user.role ?? undefined;
  }

  private validateAttachmentPayload(dto: SignChatAttachmentDto) {
    if (dto.size > CHAT_ATTACHMENT_MAX_BYTES) {
      throw new BadRequestException("Attachment too large");
    }

    const ext = path.extname(dto.filename).toLowerCase();
    if (!CHAT_ATTACHMENT_ALLOWED_EXTENSIONS.includes(ext)) {
      throw new BadRequestException("Attachment type not allowed");
    }

    if (!CHAT_ATTACHMENT_ALLOWED_CONTENT_TYPES.includes(dto.contentType)) {
      throw new BadRequestException("Attachment content type not allowed");
    }

    const extensionContentTypeMap: Record<string, string[]> = {
      ".jpg": ["image/jpeg"],
      ".jpeg": ["image/jpeg"],
      ".png": ["image/png"],
      ".gif": ["image/gif"],
      ".webp": ["image/webp"],
      ".pdf": ["application/pdf"],
    };
    const allowedTypesForExt = extensionContentTypeMap[ext] ?? [];
    if (!allowedTypesForExt.includes(dto.contentType)) {
      throw new BadRequestException("Attachment content type does not match file extension");
    }
  }

  private async assertChatEnabled(flagKey: string, campgroundId: string) {
    const enabled = await this.flags.isEnabledOrDefault(flagKey, campgroundId, true);
    if (!enabled) {
      throw new ForbiddenException("Chat is disabled for this campground.");
    }
  }

  private async assertStaffChatEnabled(campgroundId: string) {
    await this.assertChatEnabled(STAFF_CHAT_FLAG_KEY, campgroundId);
  }

  private async assertPortalChatEnabled(campgroundId: string) {
    await this.assertChatEnabled(PORTAL_CHAT_FLAG_KEY, campgroundId);
  }

  /**
   * Staff chat endpoint
   * POST /campgrounds/:campgroundId/chat/message
   */
  @Post("/campgrounds/:campgroundId/message")
  @UseGuards(JwtAuthGuard, RolesGuard, ScopeGuard)
  @Roles(...STAFF_CHAT_ROLES)
  @Throttle({ default: { limit: 60, ttl: 60000 } }) // 60 messages per minute for staff
  @HttpCode(HttpStatus.OK)
  async sendStaffMessage(
    @Param("campgroundId") campgroundId: string,
    @Body() dto: SendMessageDto,
    @Req() req: StaffAuthenticatedRequest,
  ): Promise<ChatMessageResponse> {
    await this.assertStaffChatEnabled(campgroundId);
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
  @Post("/campgrounds/:campgroundId/message/stream")
  @UseGuards(JwtAuthGuard, RolesGuard, ScopeGuard)
  @Roles(...STAFF_CHAT_ROLES)
  @Throttle({ default: { limit: 60, ttl: 60000 } })
  @HttpCode(HttpStatus.ACCEPTED)
  async sendStaffMessageStream(
    @Param("campgroundId") campgroundId: string,
    @Body() dto: SendMessageDto,
    @Req() req: StaffAuthenticatedRequest,
  ): Promise<{ status: string; message: string }> {
    await this.assertStaffChatEnabled(campgroundId);
    this.logger.log(`Staff chat stream from user ${req.user.id}`);

    // Fire and forget - response comes via WebSocket
    this.chatService
      .sendMessageStream(dto, {
        campgroundId,
        participantType: ChatParticipantType.staff,
        participantId: req.user.id,
        role: this.getStaffRole(req, campgroundId),
      })
      .catch((err) => {
        this.logger.error("Staff stream error:", err);
      });

    return { status: "streaming", message: "Response will be delivered via WebSocket" };
  }

  /**
   * Staff attachment sign endpoint
   * POST /chat/campgrounds/:campgroundId/attachments/sign
   */
  @Post("/campgrounds/:campgroundId/attachments/sign")
  @UseGuards(JwtAuthGuard, RolesGuard, ScopeGuard)
  @Roles(...STAFF_CHAT_ROLES)
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  @HttpCode(HttpStatus.OK)
  async signStaffAttachment(
    @Param("campgroundId") campgroundId: string,
    @Body() dto: SignChatAttachmentDto,
    @Req() req: StaffAuthenticatedRequest,
  ): Promise<SignChatAttachmentResponse> {
    await this.assertStaffChatEnabled(campgroundId);
    this.validateAttachmentPayload(dto);

    const signed = await this.uploads.signUpload(dto.filename, dto.contentType);
    let downloadUrl: string | undefined;
    try {
      downloadUrl = await this.uploads.getSignedUrl(signed.key);
    } catch {
      downloadUrl = undefined;
    }

    return {
      uploadUrl: signed.uploadUrl,
      storageKey: signed.key,
      publicUrl: signed.publicUrl,
      downloadUrl,
    };
  }

  /**
   * Staff action execution endpoint
   * POST /campgrounds/:campgroundId/chat/action
   */
  @Post("/campgrounds/:campgroundId/action")
  @UseGuards(JwtAuthGuard, RolesGuard, ScopeGuard)
  @Roles(...STAFF_CHAT_ROLES)
  @Throttle({ default: { limit: 30, ttl: 60000 } }) // 30 actions per minute
  @HttpCode(HttpStatus.OK)
  async executeStaffAction(
    @Param("campgroundId") campgroundId: string,
    @Body() dto: ExecuteActionDto,
    @Req() req: StaffAuthenticatedRequest,
  ): Promise<ExecuteActionResponse> {
    await this.assertStaffChatEnabled(campgroundId);
    return this.chatService.executeAction(dto, {
      campgroundId,
      participantType: ChatParticipantType.staff,
      participantId: req.user.id,
      role: this.getStaffRole(req, campgroundId),
    });
  }

  /**
   * Staff tool execution endpoint
   * POST /campgrounds/:campgroundId/chat/tools/execute
   */
  @Post("/campgrounds/:campgroundId/tools/execute")
  @UseGuards(JwtAuthGuard, RolesGuard, ScopeGuard)
  @Roles(...STAFF_CHAT_ROLES)
  @Throttle({ default: { limit: 30, ttl: 60000 } }) // 30 tool executions per minute
  @HttpCode(HttpStatus.OK)
  async executeStaffTool(
    @Param("campgroundId") campgroundId: string,
    @Body() dto: ExecuteToolDto,
    @Req() req: StaffAuthenticatedRequest,
  ): Promise<ExecuteToolResponse> {
    await this.assertStaffChatEnabled(campgroundId);
    return this.chatService.executeTool(dto, {
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
  @Get("/campgrounds/:campgroundId/history")
  @UseGuards(JwtAuthGuard, RolesGuard, ScopeGuard)
  @Roles(...STAFF_CHAT_ROLES)
  async getStaffHistory(
    @Param("campgroundId") campgroundId: string,
    @Query() dto: GetHistoryDto,
    @Req() req: StaffAuthenticatedRequest,
  ): Promise<ConversationHistoryResponse> {
    await this.assertStaffChatEnabled(campgroundId);
    return this.chatService.getHistory(dto, {
      campgroundId,
      participantType: ChatParticipantType.staff,
      participantId: req.user.id,
      role: this.getStaffRole(req, campgroundId),
    });
  }

  /**
   * Staff feedback endpoint
   * POST /chat/campgrounds/:campgroundId/feedback
   */
  @Post("/campgrounds/:campgroundId/feedback")
  @UseGuards(JwtAuthGuard, RolesGuard, ScopeGuard)
  @Roles(...STAFF_CHAT_ROLES)
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  @HttpCode(HttpStatus.OK)
  async submitStaffFeedback(
    @Param("campgroundId") campgroundId: string,
    @Body() dto: SubmitFeedbackDto,
    @Req() req: StaffAuthenticatedRequest,
  ): Promise<SubmitFeedbackResponse> {
    await this.assertStaffChatEnabled(campgroundId);
    return this.chatService.submitFeedback(dto, {
      campgroundId,
      participantType: ChatParticipantType.staff,
      participantId: req.user.id,
      role: this.getStaffRole(req, campgroundId),
    });
  }

  /**
   * Staff regenerate endpoint
   * POST /chat/campgrounds/:campgroundId/regenerate
   */
  @Post("/campgrounds/:campgroundId/regenerate")
  @UseGuards(JwtAuthGuard, RolesGuard, ScopeGuard)
  @Roles(...STAFF_CHAT_ROLES)
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @HttpCode(HttpStatus.OK)
  async regenerateStaffMessage(
    @Param("campgroundId") campgroundId: string,
    @Body() dto: RegenerateMessageDto,
    @Req() req: StaffAuthenticatedRequest,
  ): Promise<ChatMessageResponse> {
    await this.assertStaffChatEnabled(campgroundId);
    return this.chatService.regenerateMessage(dto, {
      campgroundId,
      participantType: ChatParticipantType.staff,
      participantId: req.user.id,
      role: this.getStaffRole(req, campgroundId),
    });
  }

  /**
   * Staff conversation list endpoint
   * GET /campgrounds/:campgroundId/chat/conversations
   */
  @Get("/campgrounds/:campgroundId/conversations")
  @UseGuards(JwtAuthGuard, RolesGuard, ScopeGuard)
  @Roles(...STAFF_CHAT_ROLES)
  async getStaffConversations(
    @Param("campgroundId") campgroundId: string,
    @Query() dto: GetConversationsDto,
    @Req() req: StaffAuthenticatedRequest,
  ): Promise<ConversationListResponse> {
    await this.assertStaffChatEnabled(campgroundId);
    return this.chatService.getConversations(dto, {
      campgroundId,
      participantType: ChatParticipantType.staff,
      participantId: req.user.id,
      role: this.getStaffRole(req, campgroundId),
    });
  }

  /**
   * Staff conversation transcript export
   * GET /campgrounds/:campgroundId/chat/conversations/:conversationId/transcript
   */
  @Get("/campgrounds/:campgroundId/conversations/:conversationId/transcript")
  @UseGuards(JwtAuthGuard, RolesGuard, ScopeGuard)
  @Roles(...STAFF_CHAT_ROLES)
  async getStaffTranscript(
    @Param("campgroundId") campgroundId: string,
    @Param("conversationId") conversationId: string,
    @Query() dto: GetTranscriptDto,
    @Req() req: StaffAuthenticatedRequest,
  ): Promise<TranscriptResponse> {
    await this.assertStaffChatEnabled(campgroundId);
    return this.chatService.getTranscript(conversationId, dto, {
      campgroundId,
      participantType: ChatParticipantType.staff,
      participantId: req.user.id,
      role: this.getStaffRole(req, campgroundId),
    });
  }

  /**
   * Staff delete conversation
   * DELETE /campgrounds/:campgroundId/chat/conversations/:conversationId
   */
  @Delete("/campgrounds/:campgroundId/conversations/:conversationId")
  @UseGuards(JwtAuthGuard, RolesGuard, ScopeGuard)
  @Roles(...STAFF_CHAT_ROLES)
  @HttpCode(HttpStatus.OK)
  async deleteStaffConversation(
    @Param("campgroundId") campgroundId: string,
    @Param("conversationId") conversationId: string,
    @Req() req: StaffAuthenticatedRequest,
  ): Promise<{ success: true }> {
    await this.assertStaffChatEnabled(campgroundId);
    return this.chatService.deleteConversation(conversationId, {
      campgroundId,
      participantType: ChatParticipantType.staff,
      participantId: req.user.id,
      role: this.getStaffRole(req, campgroundId),
    });
  }

  /**
   * Staff delete all conversations (per-user)
   * DELETE /campgrounds/:campgroundId/chat/conversations
   */
  @Delete("/campgrounds/:campgroundId/conversations")
  @UseGuards(JwtAuthGuard, RolesGuard, ScopeGuard)
  @Roles(...STAFF_CHAT_ROLES)
  @HttpCode(HttpStatus.OK)
  async deleteStaffConversations(
    @Param("campgroundId") campgroundId: string,
    @Req() req: StaffAuthenticatedRequest,
  ): Promise<{ success: true; deletedCount: number }> {
    await this.assertStaffChatEnabled(campgroundId);
    return this.chatService.deleteAllConversations({
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
  @Post("/portal/:campgroundId/message")
  @UseGuards(AuthGuard("guest-jwt"))
  @Throttle({ default: { limit: 20, ttl: 60000 } }) // 20 messages per minute for guests
  @HttpCode(HttpStatus.OK)
  async sendGuestMessage(
    @Param("campgroundId") campgroundId: string,
    @Body() dto: SendMessageDto,
    @Req() req: GuestAuthenticatedRequest,
  ): Promise<ChatMessageResponse> {
    const guest = req.user;

    await this.assertPortalChatEnabled(campgroundId);
    await this.chatService.assertGuestAccess(guest.id, campgroundId);

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
  @Post("/portal/:campgroundId/message/stream")
  @UseGuards(AuthGuard("guest-jwt"))
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  @HttpCode(HttpStatus.ACCEPTED)
  async sendGuestMessageStream(
    @Param("campgroundId") campgroundId: string,
    @Body() dto: SendMessageDto,
    @Req() req: GuestAuthenticatedRequest,
  ): Promise<{ status: string; message: string }> {
    const guest = req.user;

    await this.assertPortalChatEnabled(campgroundId);
    await this.chatService.assertGuestAccess(guest.id, campgroundId);

    this.logger.log(`Guest chat stream from ${guest.id}`);

    // Fire and forget - response comes via WebSocket
    this.chatService
      .sendMessageStream(dto, {
        campgroundId,
        participantType: ChatParticipantType.guest,
        participantId: guest.id,
      })
      .catch((err) => {
        this.logger.error("Guest stream error:", err);
      });

    return { status: "streaming", message: "Response will be delivered via WebSocket" };
  }

  /**
   * Guest attachment sign endpoint
   * POST /chat/portal/:campgroundId/attachments/sign
   */
  @Post("/portal/:campgroundId/attachments/sign")
  @UseGuards(AuthGuard("guest-jwt"))
  @Throttle({ default: { limit: 15, ttl: 60000 } })
  @HttpCode(HttpStatus.OK)
  async signGuestAttachment(
    @Param("campgroundId") campgroundId: string,
    @Body() dto: SignChatAttachmentDto,
    @Req() req: GuestAuthenticatedRequest,
  ): Promise<SignChatAttachmentResponse> {
    const guest = req.user;

    await this.assertPortalChatEnabled(campgroundId);
    await this.chatService.assertGuestAccess(guest.id, campgroundId);
    this.validateAttachmentPayload(dto);

    const signed = await this.uploads.signUpload(dto.filename, dto.contentType);
    let downloadUrl: string | undefined;
    try {
      downloadUrl = await this.uploads.getSignedUrl(signed.key);
    } catch {
      downloadUrl = undefined;
    }

    return {
      uploadUrl: signed.uploadUrl,
      storageKey: signed.key,
      publicUrl: signed.publicUrl,
      downloadUrl,
    };
  }

  /**
   * Guest action execution endpoint
   * POST /portal/:campgroundId/chat/action
   */
  @Post("/portal/:campgroundId/action")
  @UseGuards(AuthGuard("guest-jwt"))
  @Throttle({ default: { limit: 15, ttl: 60000 } }) // 15 actions per minute
  @HttpCode(HttpStatus.OK)
  async executeGuestAction(
    @Param("campgroundId") campgroundId: string,
    @Body() dto: ExecuteActionDto,
    @Req() req: GuestAuthenticatedRequest,
  ): Promise<ExecuteActionResponse> {
    const guest = req.user;

    await this.assertPortalChatEnabled(campgroundId);
    await this.chatService.assertGuestAccess(guest.id, campgroundId);

    return this.chatService.executeAction(dto, {
      campgroundId,
      participantType: ChatParticipantType.guest,
      participantId: guest.id,
    });
  }

  /**
   * Guest tool execution endpoint
   * POST /portal/:campgroundId/chat/tools/execute
   */
  @Post("/portal/:campgroundId/tools/execute")
  @UseGuards(AuthGuard("guest-jwt"))
  @Throttle({ default: { limit: 15, ttl: 60000 } }) // 15 tool executions per minute
  @HttpCode(HttpStatus.OK)
  async executeGuestTool(
    @Param("campgroundId") campgroundId: string,
    @Body() dto: ExecuteToolDto,
    @Req() req: GuestAuthenticatedRequest,
  ): Promise<ExecuteToolResponse> {
    const guest = req.user;

    await this.assertPortalChatEnabled(campgroundId);
    await this.chatService.assertGuestAccess(guest.id, campgroundId);

    return this.chatService.executeTool(dto, {
      campgroundId,
      participantType: ChatParticipantType.guest,
      participantId: guest.id,
    });
  }

  /**
   * Guest chat history endpoint
   * GET /portal/:campgroundId/chat/history
   */
  @Get("/portal/:campgroundId/history")
  @UseGuards(AuthGuard("guest-jwt"))
  async getGuestHistory(
    @Param("campgroundId") campgroundId: string,
    @Query() dto: GetHistoryDto,
    @Req() req: GuestAuthenticatedRequest,
  ): Promise<ConversationHistoryResponse> {
    const guest = req.user;

    await this.assertPortalChatEnabled(campgroundId);
    await this.chatService.assertGuestAccess(guest.id, campgroundId);

    return this.chatService.getHistory(dto, {
      campgroundId,
      participantType: ChatParticipantType.guest,
      participantId: guest.id,
    });
  }

  /**
   * Guest feedback endpoint
   * POST /chat/portal/:campgroundId/feedback
   */
  @Post("/portal/:campgroundId/feedback")
  @UseGuards(AuthGuard("guest-jwt"))
  @Throttle({ default: { limit: 15, ttl: 60000 } })
  @HttpCode(HttpStatus.OK)
  async submitGuestFeedback(
    @Param("campgroundId") campgroundId: string,
    @Body() dto: SubmitFeedbackDto,
    @Req() req: GuestAuthenticatedRequest,
  ): Promise<SubmitFeedbackResponse> {
    const guest = req.user;

    await this.assertPortalChatEnabled(campgroundId);
    await this.chatService.assertGuestAccess(guest.id, campgroundId);

    return this.chatService.submitFeedback(dto, {
      campgroundId,
      participantType: ChatParticipantType.guest,
      participantId: guest.id,
    });
  }

  /**
   * Guest regenerate endpoint
   * POST /chat/portal/:campgroundId/regenerate
   */
  @Post("/portal/:campgroundId/regenerate")
  @UseGuards(AuthGuard("guest-jwt"))
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @HttpCode(HttpStatus.OK)
  async regenerateGuestMessage(
    @Param("campgroundId") campgroundId: string,
    @Body() dto: RegenerateMessageDto,
    @Req() req: GuestAuthenticatedRequest,
  ): Promise<ChatMessageResponse> {
    const guest = req.user;

    await this.assertPortalChatEnabled(campgroundId);
    await this.chatService.assertGuestAccess(guest.id, campgroundId);

    return this.chatService.regenerateMessage(dto, {
      campgroundId,
      participantType: ChatParticipantType.guest,
      participantId: guest.id,
    });
  }

  /**
   * Guest conversation list endpoint
   * GET /portal/:campgroundId/chat/conversations
   */
  @Get("/portal/:campgroundId/conversations")
  @UseGuards(AuthGuard("guest-jwt"))
  async getGuestConversations(
    @Param("campgroundId") campgroundId: string,
    @Query() dto: GetConversationsDto,
    @Req() req: GuestAuthenticatedRequest,
  ): Promise<ConversationListResponse> {
    const guest = req.user;

    await this.assertPortalChatEnabled(campgroundId);
    await this.chatService.assertGuestAccess(guest.id, campgroundId);

    return this.chatService.getConversations(dto, {
      campgroundId,
      participantType: ChatParticipantType.guest,
      participantId: guest.id,
    });
  }

  /**
   * Guest conversation transcript export
   * GET /portal/:campgroundId/chat/conversations/:conversationId/transcript
   */
  @Get("/portal/:campgroundId/conversations/:conversationId/transcript")
  @UseGuards(AuthGuard("guest-jwt"))
  async getGuestTranscript(
    @Param("campgroundId") campgroundId: string,
    @Param("conversationId") conversationId: string,
    @Query() dto: GetTranscriptDto,
    @Req() req: GuestAuthenticatedRequest,
  ): Promise<TranscriptResponse> {
    const guest = req.user;

    await this.assertPortalChatEnabled(campgroundId);
    await this.chatService.assertGuestAccess(guest.id, campgroundId);

    return this.chatService.getTranscript(conversationId, dto, {
      campgroundId,
      participantType: ChatParticipantType.guest,
      participantId: guest.id,
    });
  }

  /**
   * Guest delete conversation
   * DELETE /portal/:campgroundId/chat/conversations/:conversationId
   */
  @Delete("/portal/:campgroundId/conversations/:conversationId")
  @UseGuards(AuthGuard("guest-jwt"))
  @HttpCode(HttpStatus.OK)
  async deleteGuestConversation(
    @Param("campgroundId") campgroundId: string,
    @Param("conversationId") conversationId: string,
    @Req() req: GuestAuthenticatedRequest,
  ): Promise<{ success: true }> {
    const guest = req.user;

    await this.assertPortalChatEnabled(campgroundId);
    await this.chatService.assertGuestAccess(guest.id, campgroundId);

    return this.chatService.deleteConversation(conversationId, {
      campgroundId,
      participantType: ChatParticipantType.guest,
      participantId: guest.id,
    });
  }

  /**
   * Guest delete all conversations
   * DELETE /portal/:campgroundId/chat/conversations
   */
  @Delete("/portal/:campgroundId/conversations")
  @UseGuards(AuthGuard("guest-jwt"))
  @HttpCode(HttpStatus.OK)
  async deleteGuestConversations(
    @Param("campgroundId") campgroundId: string,
    @Req() req: GuestAuthenticatedRequest,
  ): Promise<{ success: true; deletedCount: number }> {
    const guest = req.user;

    await this.assertPortalChatEnabled(campgroundId);
    await this.chatService.assertGuestAccess(guest.id, campgroundId);

    return this.chatService.deleteAllConversations({
      campgroundId,
      participantType: ChatParticipantType.guest,
      participantId: guest.id,
    });
  }
}
