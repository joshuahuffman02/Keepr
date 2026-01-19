import { Injectable, Logger, NotFoundException, ForbiddenException, BadRequestException, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AiProviderService } from '../ai/ai-provider.service';
import { RedisService } from '../redis/redis.service';
import { UploadsService } from '../uploads/uploads.service';
import { AiFeatureType, ChatParticipantType, ChatMessageRole, AnalyticsEventName } from '@prisma/client';
import type { ChatMessage, Prisma } from '@prisma/client';
import { randomUUID } from 'crypto';
import {
  SendMessageDto,
  ChatMessageResponse,
  ToolCall,
  ToolResult,
  ActionRequired,
  ChatAttachment,
  ChatMessagePart,
  ChatMessageVisibility,
} from './dto/send-message.dto';
import {
  ExecuteActionDto,
  ExecuteActionResponse,
} from './dto/execute-action.dto';
import { ExecuteToolDto, ExecuteToolResponse } from './dto/execute-tool.dto';
import {
  GetHistoryDto,
  ConversationHistoryResponse,
  MessageHistoryItem,
} from './dto/get-history.dto';
import {
  GetConversationsDto,
  ConversationListResponse,
  ConversationSummary,
} from './dto/get-conversations.dto';
import { GetTranscriptDto, TranscriptFormat, TranscriptResponse } from './dto/get-transcript.dto';
import { SubmitFeedbackDto, SubmitFeedbackResponse } from './dto/submit-feedback.dto';
import { RegenerateMessageDto } from './dto/regenerate-message.dto';
import { ChatToolsService } from './chat-tools.service';
import { ChatGateway } from './chat.gateway';
import { AnalyticsService } from '../analytics/analytics.service';
import { EnhancedAnalyticsService } from '../analytics/enhanced-analytics.service';

interface ChatContext {
  campgroundId: string;
  participantType: ChatParticipantType;
  participantId: string;
  role?: string; // For staff: owner, manager, front_desk, etc.
  currentReservationId?: string;
}

interface PendingAction {
  id: string;
  type: 'confirmation' | 'form' | 'selection';
  tool: string;
  args: Record<string, unknown>;
  title: string;
  description: string;
  expiresAt: Date;
  conversationId: string;
}

// Pending actions expire after 10 minutes
const PENDING_ACTION_TTL_MS = 10 * 60 * 1000;
const PENDING_ACTION_TTL_SECONDS = 10 * 60; // For Redis TTL
// Cleanup runs every 5 minutes (only used when Redis is unavailable)
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000;
// Redis key prefix for pending actions
const REDIS_PENDING_ACTION_PREFIX = 'chat:pending_action:';

type PendingActionSerialized = Omit<PendingAction, 'expiresAt'> & { expiresAt: string };

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const toJsonValue = (value: unknown): Prisma.InputJsonValue | undefined => {
  if (value === undefined || value === null) return undefined;
  try {
    return JSON.parse(JSON.stringify(value));
  } catch {
    return undefined;
  }
};

const normalizeMessageRole = (role: ChatMessageRole): MessageHistoryItem['role'] => {
  switch (role) {
    case ChatMessageRole.user:
      return 'user';
    case ChatMessageRole.assistant:
      return 'assistant';
    case ChatMessageRole.tool:
      return 'tool';
    case ChatMessageRole.system:
      return 'system';
    default:
      return 'assistant';
  }
};

const isToolCall = (value: unknown): value is ToolCall =>
  isRecord(value) &&
  typeof value.id === 'string' &&
  typeof value.name === 'string' &&
  isRecord(value.args);

const isToolResult = (value: unknown): value is ToolResult =>
  isRecord(value) &&
  typeof value.toolCallId === 'string' &&
  'result' in value;

const parseToolCalls = (value: unknown): ToolCall[] | undefined =>
  Array.isArray(value) ? value.filter(isToolCall) : undefined;

const parseToolResults = (value: unknown): ToolResult[] | undefined =>
  Array.isArray(value) ? value.filter(isToolResult) : undefined;

const CHAT_ATTACHMENT_ALLOWED_CONTENT_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'application/pdf',
]);
const CHAT_ATTACHMENT_MAX_BYTES = 10 * 1024 * 1024;

const isChatAttachment = (value: unknown): value is ChatAttachment =>
  isRecord(value) &&
  typeof value.name === 'string' &&
  typeof value.contentType === 'string' &&
  typeof value.size === 'number' &&
  Number.isFinite(value.size) &&
  value.size > 0 &&
  value.size <= CHAT_ATTACHMENT_MAX_BYTES &&
  (value.storageKey === undefined || typeof value.storageKey === 'string') &&
  (value.url === undefined || typeof value.url === 'string');

const normalizeAttachments = (value: unknown): ChatAttachment[] | undefined => {
  if (!Array.isArray(value)) return undefined;
  const attachments = value
    .filter(isChatAttachment)
    .filter((attachment) => CHAT_ATTACHMENT_ALLOWED_CONTENT_TYPES.has(attachment.contentType))
    .map((attachment) => ({
      name: attachment.name.trim().slice(0, 255),
      contentType: attachment.contentType,
      size: attachment.size,
      storageKey: attachment.storageKey,
      url: attachment.url,
    }));
  return attachments.length > 0 ? attachments : undefined;
};

const getMessageVisibility = (value: unknown): ChatMessageVisibility | undefined =>
  value === 'internal' || value === 'public' ? value : undefined;

const getString = (value: unknown): string | undefined =>
  typeof value === 'string' ? value : undefined;

const buildMessageMetadata = (
  attachments?: ChatAttachment[],
  visibility?: ChatMessageVisibility,
): Prisma.InputJsonValue | undefined => {
  const metadata: Record<string, unknown> = {};
  if (attachments && attachments.length > 0) {
    metadata.attachments = attachments;
  }
  if (visibility === 'internal') {
    metadata.visibility = visibility;
  }
  return Object.keys(metadata).length > 0 ? toJsonValue(metadata) : undefined;
};

const extractCardPart = (value: unknown): ChatMessagePart | null => {
  if (!isRecord(value)) return null;
  const candidate = [
    value.jsonRender,
    value.jsonRenderTree,
    value.uiRender,
    value.uiTree,
    value.report,
    value.layout,
    value.tree,
  ].find(isRecord);
  if (!candidate) return null;
  const title = getString(candidate.title) ?? getString(value.title);
  const summary = getString(candidate.summary) ?? getString(value.summary);
  return {
    type: 'card',
    title: title || undefined,
    summary,
    payload: candidate,
  };
};

const buildMessageParts = (params: {
  content?: string;
  attachments?: ChatAttachment[];
  toolCalls?: ToolCall[];
  toolResults?: ToolResult[];
}): ChatMessagePart[] | undefined => {
  const parts: ChatMessagePart[] = [];
  const content = params.content?.trim() ?? '';
  if (content) {
    parts.push({ type: 'text', text: content });
  }
  if (params.attachments && params.attachments.length > 0) {
    for (const attachment of params.attachments) {
      parts.push({ type: 'file', file: attachment });
    }
  }

  const toolResults = params.toolResults ?? [];
  const resultsById = new Map(toolResults.map((result) => [result.toolCallId, result]));

  if (params.toolCalls && params.toolCalls.length > 0) {
    for (const call of params.toolCalls) {
      const result = resultsById.get(call.id);
      parts.push({
        type: 'tool',
        name: call.name,
        callId: call.id,
        args: call.args,
        result: result?.result,
        error: result?.error,
      });
    }
  } else if (toolResults.length > 0) {
    for (const result of toolResults) {
      parts.push({
        type: 'tool',
        name: 'tool',
        callId: result.toolCallId,
        result: result.result,
        error: result.error,
      });
    }
  }

  for (const result of toolResults) {
    const cardPart = extractCardPart(result.result);
    if (cardPart) {
      parts.push(cardPart);
    }
  }

  return parts.length > 0 ? parts : undefined;
};

const formatTranscriptRole = (role: MessageHistoryItem['role']): string => {
  switch (role) {
    case 'user':
      return 'User';
    case 'assistant':
      return 'Assistant';
    case 'tool':
      return 'Tool';
    case 'system':
      return 'System';
    default:
      return 'Assistant';
  }
};

const formatTranscriptMessage = (
  message: MessageHistoryItem,
  format: TranscriptFormat,
): string => {
  const roleLabel = formatTranscriptRole(message.role);
  const header =
    format === 'markdown'
      ? `**${roleLabel}** (${message.createdAt})`
      : `[${message.createdAt}] ${roleLabel}:`;
  const lines: string[] = [header];

  const content = message.content?.trim();
  if (content) lines.push(content);

  if (message.attachments && message.attachments.length > 0) {
    const attachmentLine = message.attachments
      .map((attachment) => `${attachment.name} (${attachment.contentType})`)
      .join(', ');
    lines.push(`Attachments: ${attachmentLine}`);
  }

  if (message.toolCalls && message.toolCalls.length > 0) {
    lines.push(`Tool calls: ${message.toolCalls.map((call) => call.name).join(', ')}`);
  }

  if (message.toolResults && message.toolResults.length > 0) {
    lines.push(`Tool results: ${message.toolResults.length}`);
  }

  return lines.join('\n');
};

const buildTranscriptContent = (
  messages: MessageHistoryItem[],
  format: TranscriptFormat,
): string => messages.map((message) => formatTranscriptMessage(message, format)).join('\n\n');

const isPendingActionType = (value: unknown): value is PendingAction["type"] =>
  value === "confirmation" || value === "form" || value === "selection";

const isPendingActionSerialized = (value: unknown): value is PendingActionSerialized =>
  isRecord(value) &&
  typeof value.id === "string" &&
  isPendingActionType(value.type) &&
  typeof value.tool === "string" &&
  isRecord(value.args) &&
  typeof value.title === "string" &&
  typeof value.description === "string" &&
  typeof value.conversationId === "string" &&
  typeof value.expiresAt === "string";

@Injectable()
export class ChatService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ChatService.name);

  // In-memory fallback store for pending actions (used when Redis unavailable)
  private pendingActions = new Map<string, PendingAction>();
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly aiProvider: AiProviderService,
    private readonly toolsService: ChatToolsService,
    private readonly chatGateway: ChatGateway,
    private readonly redis: RedisService,
    private readonly uploads: UploadsService,
    private readonly analytics: AnalyticsService,
    private readonly enhancedAnalytics: EnhancedAnalyticsService,
  ) {}

  async assertGuestAccess(guestId: string, campgroundId: string): Promise<void> {
    const reservation = await this.prisma.reservation.findFirst({
      where: { guestId, campgroundId },
      select: { id: true }
    });

    if (!reservation) {
      throw new ForbiddenException('You do not have access to this campground');
    }
  }

  onModuleInit() {
    // Only start cleanup interval if Redis is not available (fallback mode)
    if (!this.redis.isEnabled) {
      this.cleanupInterval = setInterval(() => {
        this.cleanupExpiredActions();
      }, CLEANUP_INTERVAL_MS);
      this.cleanupInterval.unref?.();
      this.logger.warn('Chat service using in-memory pending actions (Redis unavailable)');
    } else {
      this.logger.log('Chat service initialized with Redis-backed pending actions');
    }
  }

  onModuleDestroy() {
    // Clear cleanup interval on shutdown
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }

  /**
   * Remove expired pending actions (only used when Redis unavailable)
   */
  private cleanupExpiredActions() {
    const now = new Date();
    let cleanedCount = 0;

    for (const [actionId, action] of this.pendingActions.entries()) {
      if (action.expiresAt < now) {
        this.pendingActions.delete(actionId);
        cleanedCount++;
      }
    }

    if (cleanedCount > 0) {
      this.logger.log(`Cleaned up ${cleanedCount} expired pending actions`);
    }
  }

  /**
   * Store a pending action (Redis with fallback to in-memory)
   */
  private async storePendingAction(action: PendingAction): Promise<void> {
    if (this.redis.isEnabled) {
      const key = `${REDIS_PENDING_ACTION_PREFIX}${action.id}`;
      // Serialize the action, converting Date to ISO string
      const serialized = {
        ...action,
        expiresAt: action.expiresAt.toISOString(),
      };
      await this.redis.set(key, serialized, PENDING_ACTION_TTL_SECONDS);
    } else {
      this.pendingActions.set(action.id, action);
    }
  }

  /**
   * Retrieve a pending action (Redis with fallback to in-memory)
   */
  private async getPendingAction(actionId: string): Promise<PendingAction | null> {
    if (this.redis.isEnabled) {
      const key = `${REDIS_PENDING_ACTION_PREFIX}${actionId}`;
      const data = await this.redis.get(key);
      if (!isPendingActionSerialized(data)) return null;
      // Deserialize, converting ISO string back to Date
      return {
        ...data,
        expiresAt: new Date(data.expiresAt),
      };
    } else {
      return this.pendingActions.get(actionId) || null;
    }
  }

  /**
   * Delete a pending action (Redis with fallback to in-memory)
   */
  private async deletePendingAction(actionId: string): Promise<void> {
    if (this.redis.isEnabled) {
      const key = `${REDIS_PENDING_ACTION_PREFIX}${actionId}`;
      await this.redis.del(key);
    } else {
      this.pendingActions.delete(actionId);
    }
  }

  /**
   * Send a message to the AI chat and get a response
   */
  async sendMessage(
    dto: SendMessageDto,
    context: ChatContext,
  ): Promise<ChatMessageResponse> {
    const message = dto.message?.trim() ?? '';
    const { conversationId: existingConversationId } = dto;
    const attachments = normalizeAttachments(dto.attachments);
    const visibility = dto.visibility === 'internal' ? 'internal' : undefined;
    if (!message && !attachments) {
      throw new BadRequestException('Message or attachment required');
    }
    if (visibility === 'internal' && context.participantType !== ChatParticipantType.staff) {
      throw new ForbiddenException('Internal notes are staff-only');
    }

    // Get or create conversation
    let conversation = existingConversationId
      ? await this.getConversation(existingConversationId, context)
      : await this.createConversation(context);

    // Save user message
    const userMessage = await this.prisma.chatMessage.create({
      data: {
        id: randomUUID(),
        conversationId: conversation.id,
        role: ChatMessageRole.user,
        content: message,
        metadata: buildMessageMetadata(attachments, visibility),
      },
    });
    await this.ensureConversationTitle(conversation.id, conversation.title, message, attachments);

    if (visibility === 'internal') {
      const internalReply = await this.prisma.chatMessage.create({
        data: {
          id: randomUUID(),
          conversationId: conversation.id,
          role: ChatMessageRole.assistant,
          content: 'Internal note saved.',
          metadata: toJsonValue({ visibility: 'internal' }),
        },
      });
      const parts = buildMessageParts({ content: internalReply.content });

      await this.prisma.chatConversation.update({
        where: { id: conversation.id },
        data: { updatedAt: new Date() },
      });

      return {
        conversationId: conversation.id,
        messageId: internalReply.id,
        role: 'assistant',
        content: internalReply.content,
        parts,
        createdAt: internalReply.createdAt.toISOString(),
        visibility: 'internal',
      };
    }

    // Build conversation history for context
    const history = await this.buildConversationHistory(conversation.id);

    // Get available tools for this user
    const tools = this.toolsService.getToolsForUser(context);

    // Build system prompt
    const systemPrompt = this.buildSystemPrompt(context);

    try {
      // Call AI with tools
      const aiResponse = await this.aiProvider.getToolCompletion({
        campgroundId: context.campgroundId,
        featureType: AiFeatureType.booking_assist,
        systemPrompt,
        userPrompt: this.formatHistoryForAI(history, message, attachments),
        tools: tools.map(t => ({
          type: 'function',
          function: {
            name: t.name,
            description: t.description,
            parameters: t.parameters,
          },
        })),
        maxTokens: 1000,
        temperature: 0.7,
      });

      // Process tool calls if any
      let toolCalls: ToolCall[] = [];
      let toolResults: ToolResult[] = [];
      let actionRequired: ActionRequired | undefined;
      let finalContent = aiResponse.content;

      if (aiResponse.toolCalls && aiResponse.toolCalls.length > 0) {
        const toolProcessResult = await this.processToolCalls(
          aiResponse.toolCalls,
          context,
          conversation.id,
        );
        toolCalls = toolProcessResult.toolCalls;
        toolResults = toolProcessResult.toolResults;
        actionRequired = toolProcessResult.actionRequired;

        // If tools were executed, get a follow-up response
        if (toolResults.length > 0 && !actionRequired) {
          const followUp = await this.aiProvider.getCompletion({
            campgroundId: context.campgroundId,
            featureType: AiFeatureType.booking_assist,
            systemPrompt,
            userPrompt: this.formatHistoryWithToolResults(history, message, toolCalls, toolResults, attachments),
            maxTokens: 500,
            temperature: 0.7,
          });
          finalContent = followUp.content;
        }
      }

      // Save assistant message
      const assistantMessage = await this.prisma.chatMessage.create({
        data: {
          id: randomUUID(),
          conversationId: conversation.id,
          role: ChatMessageRole.assistant,
          content: finalContent,
          toolCalls: toolCalls.length > 0 ? toJsonValue(toolCalls) : undefined,
          toolResults: toolResults.length > 0 ? toJsonValue(toolResults) : undefined,
        },
      });

      // Update conversation timestamp
      await this.prisma.chatConversation.update({
        where: { id: conversation.id },
        data: { updatedAt: new Date() },
      });

      return {
        conversationId: conversation.id,
        messageId: assistantMessage.id,
        role: 'assistant',
        content: finalContent,
        parts: buildMessageParts({ content: finalContent, toolCalls, toolResults }),
        toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
        toolResults: toolResults.length > 0 ? toolResults : undefined,
        actionRequired,
        createdAt: assistantMessage.createdAt.toISOString(),
      };
    } catch (error) {
      this.logger.error('Chat error:', error);

      // Save error as system message
      await this.prisma.chatMessage.create({
        data: {
          id: randomUUID(),
          conversationId: conversation.id,
          role: ChatMessageRole.system,
          content: 'I encountered an error processing your request. Please try again.',
          metadata: toJsonValue({ error: error instanceof Error ? error.message : 'Unknown error' }),
        },
      });

      throw error;
    }
  }

  /**
   * Send a message with streaming response via WebSocket
   * Emits tokens progressively to the conversation room
   */
  async sendMessageStream(
    dto: SendMessageDto,
    context: ChatContext,
  ): Promise<void> {
    const message = dto.message?.trim() ?? '';
    const { conversationId: existingConversationId } = dto;
    const attachments = normalizeAttachments(dto.attachments);
    const visibility = dto.visibility === 'internal' ? 'internal' : undefined;
    if (!message && !attachments) {
      throw new BadRequestException('Message or attachment required');
    }
    if (visibility === 'internal' && context.participantType !== ChatParticipantType.staff) {
      throw new ForbiddenException('Internal notes are staff-only');
    }

    // Get or create conversation
    let conversation = existingConversationId
      ? await this.getConversation(existingConversationId, context)
      : await this.createConversation(context);

    // Save user message
    await this.prisma.chatMessage.create({
      data: {
        id: randomUUID(),
        conversationId: conversation.id,
        role: ChatMessageRole.user,
        content: message,
        metadata: buildMessageMetadata(attachments, visibility),
      },
    });
    await this.ensureConversationTitle(conversation.id, conversation.title, message, attachments);

    if (visibility === 'internal') {
      const internalReply = await this.prisma.chatMessage.create({
        data: {
          id: randomUUID(),
          conversationId: conversation.id,
          role: ChatMessageRole.assistant,
          content: 'Internal note saved.',
          metadata: toJsonValue({ visibility: 'internal' }),
        },
      });

      await this.prisma.chatConversation.update({
        where: { id: conversation.id },
        data: { updatedAt: new Date() },
      });

      this.chatGateway.emitComplete(conversation.id, {
        messageId: internalReply.id,
        content: internalReply.content,
        parts: buildMessageParts({ content: internalReply.content }),
        visibility: 'internal',
      });
      return;
    }

    // Emit typing indicator
    this.chatGateway.emitTyping(conversation.id, true);

    // Build conversation history for context
    const history = await this.buildConversationHistory(conversation.id);

    // Get available tools for this user
    const tools = this.toolsService.getToolsForUser(context);

    // Build system prompt
    const systemPrompt = this.buildSystemPrompt(context);

    try {
      // Call AI with tools
      const aiResponse = await this.aiProvider.getToolCompletion({
        campgroundId: context.campgroundId,
        featureType: AiFeatureType.booking_assist,
        systemPrompt,
        userPrompt: this.formatHistoryForAI(history, message, attachments),
        tools: tools.map(t => ({
          type: 'function',
          function: {
            name: t.name,
            description: t.description,
            parameters: t.parameters,
          },
        })),
        maxTokens: 1000,
        temperature: 0.7,
      });

      // Process tool calls if any
      let toolCalls: ToolCall[] = [];
      let toolResults: ToolResult[] = [];
      let actionRequired: ActionRequired | undefined;
      let finalContent = aiResponse.content;

      if (aiResponse.toolCalls && aiResponse.toolCalls.length > 0) {
        // Emit tool call notifications
        for (const tc of aiResponse.toolCalls) {
          const toolCallId = tc.id || `tc_${randomUUID()}`;
          let args: Record<string, unknown>;
          try {
            args = JSON.parse(tc.arguments);
          } catch {
            args = {};
          }

          this.chatGateway.emitToken(conversation.id, {
            token: '',
            isComplete: false,
            toolCall: {
              id: toolCallId,
              name: tc.name,
              args,
            },
          });
        }

        const toolProcessResult = await this.processToolCalls(
          aiResponse.toolCalls,
          context,
          conversation.id,
        );
        toolCalls = toolProcessResult.toolCalls;
        toolResults = toolProcessResult.toolResults;
        actionRequired = toolProcessResult.actionRequired;

        // Emit tool results
        for (const result of toolResults) {
          this.chatGateway.emitToken(conversation.id, {
            token: '',
            isComplete: false,
            toolResult: {
              toolCallId: result.toolCallId,
              result: result.result,
            },
          });
        }

        // If action is required, emit and stop
        if (actionRequired) {
          this.chatGateway.emitToken(conversation.id, {
            token: '',
            isComplete: false,
            actionRequired,
          });

          // Save partial assistant message
          const assistantMessage = await this.prisma.chatMessage.create({
            data: {
              id: randomUUID(),
              conversationId: conversation.id,
              role: ChatMessageRole.assistant,
              content: finalContent || 'I need your confirmation to proceed.',
              toolCalls: toolCalls.length > 0 ? toJsonValue(toolCalls) : undefined,
              toolResults: toolResults.length > 0 ? toJsonValue(toolResults) : undefined,
            },
          });

          this.chatGateway.emitTyping(conversation.id, false);
          this.chatGateway.emitComplete(conversation.id, {
            messageId: assistantMessage.id,
            content: finalContent || 'I need your confirmation to proceed.',
            toolCalls,
            toolResults,
            actionRequired,
            parts: buildMessageParts({
              content: finalContent || 'I need your confirmation to proceed.',
              toolCalls,
              toolResults,
            }),
          });
          return;
        }

        // If tools were executed, get a follow-up response
        if (toolResults.length > 0) {
          const followUp = await this.aiProvider.getCompletion({
            campgroundId: context.campgroundId,
            featureType: AiFeatureType.booking_assist,
            systemPrompt,
            userPrompt: this.formatHistoryWithToolResults(history, message, toolCalls, toolResults, attachments),
            maxTokens: 500,
            temperature: 0.7,
          });
          finalContent = followUp.content;
        }
      }

      // Stream the final content as tokens (simulate streaming by chunking)
      if (finalContent) {
        await this.streamContentAsTokens(conversation.id, finalContent);
      }

      // Save assistant message
      const assistantMessage = await this.prisma.chatMessage.create({
        data: {
          id: randomUUID(),
          conversationId: conversation.id,
          role: ChatMessageRole.assistant,
          content: finalContent,
          toolCalls: toolCalls.length > 0 ? toJsonValue(toolCalls) : undefined,
          toolResults: toolResults.length > 0 ? toJsonValue(toolResults) : undefined,
        },
      });

      // Update conversation timestamp
      await this.prisma.chatConversation.update({
        where: { id: conversation.id },
        data: { updatedAt: new Date() },
      });

      // Stop typing and emit complete
      this.chatGateway.emitTyping(conversation.id, false);
      this.chatGateway.emitComplete(conversation.id, {
        messageId: assistantMessage.id,
        content: finalContent,
        toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
        toolResults: toolResults.length > 0 ? toolResults : undefined,
        parts: buildMessageParts({ content: finalContent, toolCalls, toolResults }),
      });
    } catch (error) {
      this.logger.error('Chat stream error:', error);

      // Stop typing
      this.chatGateway.emitTyping(conversation.id, false);

      // Emit error
      this.chatGateway.emitError(
        conversation.id,
        error instanceof Error ? error.message : 'An error occurred',
      );

      // Save error as system message
      await this.prisma.chatMessage.create({
        data: {
          id: randomUUID(),
          conversationId: conversation.id,
          role: ChatMessageRole.system,
          content: 'I encountered an error processing your request. Please try again.',
          metadata: { error: error instanceof Error ? error.message : 'Unknown error' },
        },
      });
    }
  }

  /**
   * Stream content as tokens with small delays for visual effect
   */
  private async streamContentAsTokens(
    conversationId: string,
    content: string,
  ): Promise<void> {
    // Split content into words/chunks for streaming effect
    const words = content.split(/(\s+)/);
    let accumulated = '';

    for (let i = 0; i < words.length; i++) {
      accumulated += words[i];

      // Emit every few words to balance responsiveness vs overhead
      if (i % 3 === 0 || i === words.length - 1) {
        this.chatGateway.emitToken(conversationId, {
          token: words.slice(Math.max(0, i - 2), i + 1).join(''),
          isComplete: false,
        });

        // Small delay between chunks for visual streaming effect
        await new Promise(resolve => setTimeout(resolve, 20));
      }
    }
  }

  /**
   * Execute a confirmed action
   */
  async executeAction(
    dto: ExecuteActionDto,
    context: ChatContext,
  ): Promise<ExecuteActionResponse> {
    const { conversationId, actionId, selectedOption, formData } = dto;

    // Verify conversation access
    await this.getConversation(conversationId, context);

    // Get pending action from Redis (or fallback to in-memory)
    const pendingAction = await this.getPendingAction(actionId);
    if (!pendingAction) {
      throw new BadRequestException('Action not found or expired');
    }

    // Check if action has expired (Redis TTL should handle this, but double-check)
    if (pendingAction.expiresAt < new Date()) {
      await this.deletePendingAction(actionId);
      throw new BadRequestException('Action has expired. Please try again.');
    }

    // Verify action belongs to this conversation (security check)
    if (pendingAction.conversationId !== conversationId) {
      this.logger.warn(`Action ${actionId} does not belong to conversation ${conversationId}`);
      throw new ForbiddenException('Action does not belong to this conversation');
    }

    try {
      // Execute the tool with confirmed args
      const result = await this.toolsService.executeTool(
        pendingAction.tool,
        { ...pendingAction.args, confirmed: true, selectedOption, formData },
        context,
      );
      const resultRecord = isRecord(result) ? result : {};
      const resultMessage =
        typeof resultRecord.message === 'string'
          ? resultRecord.message
          : 'Action completed successfully';

      // Clear pending action from Redis (or in-memory)
      await this.deletePendingAction(actionId);

      // Save tool execution as message
      await this.prisma.chatMessage.create({
        data: {
          id: randomUUID(),
          conversationId,
          role: ChatMessageRole.tool,
          content: `Executed: ${pendingAction.tool}`,
          toolResults: toJsonValue([{ toolCallId: actionId, result }]),
        },
      });

      return {
        success: true,
        message: resultMessage,
        result: resultRecord.data,
      };
    } catch (error) {
      this.logger.error('Action execution error:', error);

      return {
        success: false,
        message: 'Failed to execute action',
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Execute a tool directly for staff or guest flows
   */
  async executeTool(
    dto: ExecuteToolDto,
    context: ChatContext,
  ): Promise<ExecuteToolResponse> {
    const { tool, args, conversationId } = dto;
    const originalArgs = args ?? {};

    if (conversationId) {
      await this.getConversation(conversationId, context);
    }

    try {
      const preValidateResult = await this.toolsService.runPreValidate(tool, originalArgs, context);
      if (preValidateResult && !preValidateResult.valid) {
        return {
          success: false,
          message: preValidateResult.message || 'Validation failed',
          error: preValidateResult.message || 'Validation failed',
        };
      }

      const mergedArgs = preValidateResult ? { ...originalArgs, ...preValidateResult } : originalArgs;
      const result = await this.toolsService.executeTool(tool, mergedArgs, context);
      const resultRecord = isRecord(result) ? result : {};
      const resultMessage =
        typeof resultRecord.message === 'string' ? resultRecord.message : 'Tool executed successfully';

      if (conversationId) {
        const toolCallId = `tool_${randomUUID()}`;
        await this.prisma.chatMessage.create({
          data: {
            id: randomUUID(),
            conversationId,
            role: ChatMessageRole.tool,
            content: `Executed: ${tool}`,
            toolCalls: toJsonValue([{ id: toolCallId, name: tool, args: originalArgs }]),
            toolResults: toJsonValue([{ toolCallId, result }]),
          },
        });
      }

      return {
        success: true,
        message: resultMessage,
        result: 'data' in resultRecord ? resultRecord.data : resultRecord,
      };
    } catch (error) {
      this.logger.error('Tool execution error:', error);
      return {
        success: false,
        message: 'Failed to execute tool',
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Get conversation history
   */
  async getHistory(
    dto: GetHistoryDto,
    context: ChatContext,
  ): Promise<ConversationHistoryResponse> {
    const { conversationId, limit = 50, before } = dto;

    // If no conversation ID, get or create the most recent one
    let conversation: { id: string };
    if (conversationId) {
      conversation = await this.getConversation(conversationId, context);
    } else {
      const existing = await this.prisma.chatConversation.findFirst({
        where: {
          campgroundId: context.campgroundId,
          participantType: context.participantType,
          participantId: context.participantId,
        },
        orderBy: { updatedAt: 'desc' },
      });

      if (!existing) {
        conversation = await this.createConversation(context);
      } else {
        conversation = existing;
      }
    }

    // Build query for messages
    const whereClause: Prisma.ChatMessageWhereInput = { conversationId: conversation.id };
    if (before) {
      const beforeMessage = await this.prisma.chatMessage.findUnique({
        where: { id: before },
        select: { createdAt: true },
      });
      if (beforeMessage) {
        whereClause.createdAt = { lt: beforeMessage.createdAt };
      }
    }

    const messages = await this.prisma.chatMessage.findMany({
      where: whereClause,
      orderBy: { createdAt: 'desc' },
      take: limit + 1, // Get one extra to check if there's more
    });

    const hasMore = messages.length > limit;
    if (hasMore) {
      messages.pop();
    }

    // Reverse to get chronological order
    messages.reverse();

    const formattedMessages: MessageHistoryItem[] = await Promise.all(
      messages.map(async (m) => {
        const metadata = isRecord(m.metadata) ? m.metadata : undefined;
        const attachments = normalizeAttachments(metadata?.attachments);
        const hydratedAttachments = await this.hydrateAttachments(attachments);
        const toolCalls = parseToolCalls(m.toolCalls);
        const toolResults = parseToolResults(m.toolResults);

        return {
          id: m.id,
          role: normalizeMessageRole(m.role),
          content: m.content,
          parts: buildMessageParts({
            content: m.content,
            attachments: hydratedAttachments,
            toolCalls,
            toolResults,
          }),
          toolCalls,
          toolResults,
          attachments: hydratedAttachments,
          createdAt: m.createdAt.toISOString(),
          visibility: getMessageVisibility(metadata?.visibility),
        };
      })
    );

    return {
      conversationId: conversation.id,
      messages: formattedMessages,
      hasMore,
      nextCursor: hasMore && messages.length > 0 ? messages[0].id : undefined,
    };
  }

  /**
   * Get conversation list for history resume
   */
  async getConversations(
    dto: GetConversationsDto,
    context: ChatContext,
  ): Promise<ConversationListResponse> {
    const { limit = 20, before, since, query } = dto;
    let beforeDate: Date | undefined;
    let sinceDate: Date | undefined;

    if (before) {
      const parsed = new Date(before);
      if (Number.isNaN(parsed.getTime())) {
        throw new BadRequestException('Invalid before cursor');
      }
      beforeDate = parsed;
    }
    if (since) {
      const parsed = new Date(since);
      if (Number.isNaN(parsed.getTime())) {
        throw new BadRequestException('Invalid since filter');
      }
      sinceDate = parsed;
    }

    const whereClause: Prisma.ChatConversationWhereInput = {
      campgroundId: context.campgroundId,
      participantType: context.participantType,
      participantId: context.participantId,
    };
    if (beforeDate || sinceDate) {
      whereClause.updatedAt = {
        ...(beforeDate ? { lt: beforeDate } : {}),
        ...(sinceDate ? { gte: sinceDate } : {}),
      };
    }

    const trimmedQuery = query?.trim();
    if (trimmedQuery) {
      whereClause.AND = [
        {
          OR: [
            { title: { contains: trimmedQuery, mode: 'insensitive' } },
            {
              ChatMessage: {
                some: { content: { contains: trimmedQuery, mode: 'insensitive' } },
              },
            },
          ],
        },
      ];
    }

    const conversations = await this.prisma.chatConversation.findMany({
      where: whereClause,
      orderBy: { updatedAt: 'desc' },
      take: limit + 1,
      select: {
        id: true,
        title: true,
        updatedAt: true,
        ChatMessage: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: { content: true, createdAt: true, metadata: true },
        },
      },
    });

    const hasMore = conversations.length > limit;
    if (hasMore) {
      conversations.pop();
    }

    const summaries: ConversationSummary[] = conversations.map((conversation) => {
      const lastMessage = conversation.ChatMessage[0];
      const lastContent = lastMessage?.content?.trim() ?? '';
      let lastMessagePreview = lastContent ? lastContent.slice(0, 160) : undefined;
      if (!lastMessagePreview && lastMessage) {
        const metadata = isRecord(lastMessage.metadata) ? lastMessage.metadata : undefined;
        const attachments = normalizeAttachments(metadata?.attachments);
        if (attachments && attachments.length > 0) {
          if (attachments.length === 1) {
            lastMessagePreview = `Attachment: ${attachments[0].name}`.slice(0, 160);
          } else {
            lastMessagePreview = `${attachments.length} attachments`;
          }
        }
      }
      return {
        id: conversation.id,
        title: conversation.title,
        updatedAt: conversation.updatedAt.toISOString(),
        lastMessagePreview,
        lastMessageAt: lastMessage?.createdAt.toISOString(),
      };
    });

    const nextCursor =
      hasMore && conversations.length > 0
        ? conversations[conversations.length - 1].updatedAt.toISOString()
        : undefined;

    return {
      conversations: summaries,
      hasMore,
      nextCursor,
    };
  }

  /**
   * Export conversation transcript
   */
  async getTranscript(
    conversationId: string,
    dto: GetTranscriptDto,
    context: ChatContext,
  ): Promise<TranscriptResponse> {
    const conversation = await this.getConversation(conversationId, context);
    const format: TranscriptFormat = dto.format ?? 'markdown';

    const messages = await this.prisma.chatMessage.findMany({
      where: { conversationId: conversation.id },
      orderBy: { createdAt: 'asc' },
      take: 500,
    });

    const formattedMessages: MessageHistoryItem[] = await Promise.all(
      messages.map(async (m) => {
        const metadata = isRecord(m.metadata) ? m.metadata : undefined;
        const attachments = normalizeAttachments(metadata?.attachments);
        const hydratedAttachments = await this.hydrateAttachments(attachments);
        const toolCalls = parseToolCalls(m.toolCalls);
        const toolResults = parseToolResults(m.toolResults);

        return {
          id: m.id,
          role: normalizeMessageRole(m.role),
          content: m.content,
          parts: buildMessageParts({
            content: m.content,
            attachments: hydratedAttachments,
            toolCalls,
            toolResults,
          }),
          toolCalls,
          toolResults,
          attachments: hydratedAttachments,
          createdAt: m.createdAt.toISOString(),
          visibility: getMessageVisibility(metadata?.visibility),
        };
      })
    );

    if (format === 'json') {
      return {
        conversationId: conversation.id,
        format,
        messages: formattedMessages,
      };
    }

    return {
      conversationId: conversation.id,
      format,
      content: buildTranscriptContent(formattedMessages, format),
    };
  }

  /**
   * Delete a single conversation
   */
  async deleteConversation(
    conversationId: string,
    context: ChatContext,
  ): Promise<{ success: true }> {
    const conversation = await this.getConversation(conversationId, context);
    await this.prisma.chatConversation.delete({ where: { id: conversation.id } });
    return { success: true };
  }

  /**
   * Delete all conversations for the participant in a campground
   */
  async deleteAllConversations(
    context: ChatContext,
  ): Promise<{ success: true; deletedCount: number }> {
    const result = await this.prisma.chatConversation.deleteMany({
      where: {
        campgroundId: context.campgroundId,
        participantType: context.participantType,
        participantId: context.participantId,
      },
    });
    return { success: true, deletedCount: result.count };
  }

  /**
   * Persist feedback for a chat message
   */
  async submitFeedback(
    dto: SubmitFeedbackDto,
    context: ChatContext,
  ): Promise<SubmitFeedbackResponse> {
    const message = await this.prisma.chatMessage.findUnique({
      where: { id: dto.messageId },
    });

    if (!message) {
      throw new NotFoundException('Message not found');
    }

    await this.getConversation(message.conversationId, context);

    if (message.role !== ChatMessageRole.assistant) {
      throw new BadRequestException('Feedback is only available for assistant messages');
    }

    const metadata = isRecord(message.metadata) ? { ...message.metadata } : {};
    metadata.feedback = {
      value: dto.value,
      at: new Date().toISOString(),
      by: {
        type: context.participantType,
        id: context.participantId,
      },
    };

    await this.prisma.chatMessage.update({
      where: { id: message.id },
      data: {
        metadata: toJsonValue(metadata),
      },
    });

    await this.trackChatAction({
      sessionId: dto.sessionId,
      context,
      actionType: 'chat_feedback',
      metadata: {
        messageId: message.id,
        conversationId: message.conversationId,
        value: dto.value,
      },
    });

    return { success: true, message: 'Feedback saved' };
  }

  /**
   * Regenerate an assistant response based on the original user prompt
   */
  async regenerateMessage(
    dto: RegenerateMessageDto,
    context: ChatContext,
  ): Promise<ChatMessageResponse> {
    const targetMessage = await this.prisma.chatMessage.findUnique({
      where: { id: dto.messageId },
    });

    if (!targetMessage) {
      throw new NotFoundException('Message not found');
    }

    if (targetMessage.role !== ChatMessageRole.assistant) {
      throw new BadRequestException('Only assistant messages can be regenerated');
    }
    const targetMetadata = isRecord(targetMessage.metadata) ? targetMessage.metadata : undefined;
    if (getMessageVisibility(targetMetadata?.visibility) === 'internal') {
      throw new BadRequestException('Internal notes cannot be regenerated');
    }

    const conversation = await this.getConversation(targetMessage.conversationId, context);

    const userMessage = await this.prisma.chatMessage.findFirst({
      where: {
        conversationId: conversation.id,
        role: ChatMessageRole.user,
        createdAt: { lt: targetMessage.createdAt },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!userMessage) {
      throw new BadRequestException('No user prompt found to regenerate');
    }

    const userMetadata = isRecord(userMessage.metadata) ? userMessage.metadata : undefined;
    const userAttachments = normalizeAttachments(userMetadata?.attachments);
    const history = await this.buildConversationHistoryBefore(conversation.id, targetMessage.createdAt);
    const tools = this.toolsService.getToolsForUser(context);
    const systemPrompt = this.buildSystemPrompt(context);

    await this.trackChatAction({
      sessionId: dto.sessionId,
      context,
      actionType: 'chat_regenerate',
      metadata: {
        messageId: dto.messageId,
        conversationId: conversation.id,
      },
    });

    try {
      const aiResponse = await this.aiProvider.getToolCompletion({
        campgroundId: context.campgroundId,
        featureType: AiFeatureType.booking_assist,
        systemPrompt,
        userPrompt: this.formatHistoryForAI(history, userMessage.content, userAttachments),
        tools: tools.map(t => ({
          type: 'function',
          function: {
            name: t.name,
            description: t.description,
            parameters: t.parameters,
          },
        })),
        maxTokens: 1000,
        temperature: 0.7,
      });

      let toolCalls: ToolCall[] = [];
      let toolResults: ToolResult[] = [];
      let actionRequired: ActionRequired | undefined;
      let finalContent = aiResponse.content;

      if (aiResponse.toolCalls && aiResponse.toolCalls.length > 0) {
        const toolProcessResult = await this.processToolCalls(
          aiResponse.toolCalls,
          context,
          conversation.id,
        );
        toolCalls = toolProcessResult.toolCalls;
        toolResults = toolProcessResult.toolResults;
        actionRequired = toolProcessResult.actionRequired;

        if (toolResults.length > 0 && !actionRequired) {
          const followUp = await this.aiProvider.getCompletion({
            campgroundId: context.campgroundId,
            featureType: AiFeatureType.booking_assist,
            systemPrompt,
            userPrompt: this.formatHistoryWithToolResults(
              history,
              userMessage.content,
              toolCalls,
              toolResults,
              userAttachments,
            ),
            maxTokens: 500,
            temperature: 0.7,
          });
          finalContent = followUp.content;
        }
      }

      const assistantMessage = await this.prisma.chatMessage.create({
        data: {
          id: randomUUID(),
          conversationId: conversation.id,
          role: ChatMessageRole.assistant,
          content: finalContent,
          toolCalls: toolCalls.length > 0 ? toJsonValue(toolCalls) : undefined,
          toolResults: toolResults.length > 0 ? toJsonValue(toolResults) : undefined,
          metadata: toJsonValue({
            regeneratedFrom: targetMessage.id,
          }),
        },
      });

      await this.prisma.chatConversation.update({
        where: { id: conversation.id },
        data: { updatedAt: new Date() },
      });

      return {
        conversationId: conversation.id,
        messageId: assistantMessage.id,
        role: 'assistant',
        content: finalContent,
        parts: buildMessageParts({ content: finalContent, toolCalls, toolResults }),
        toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
        toolResults: toolResults.length > 0 ? toolResults : undefined,
        actionRequired,
        createdAt: assistantMessage.createdAt.toISOString(),
      };
    } catch (error) {
      this.logger.error('Chat regenerate error:', error);

      await this.prisma.chatMessage.create({
        data: {
          id: randomUUID(),
          conversationId: conversation.id,
          role: ChatMessageRole.system,
          content: 'I encountered an error regenerating your request. Please try again.',
          metadata: toJsonValue({ error: error instanceof Error ? error.message : 'Unknown error' }),
        },
      });

      throw error;
    }
  }

  /**
   * Get or verify conversation access
   */
  private async getConversation(conversationId: string, context: ChatContext) {
    const conversation = await this.prisma.chatConversation.findUnique({
      where: { id: conversationId },
    });

    if (!conversation) {
      throw new NotFoundException('Conversation not found');
    }

    // Verify access
    if (conversation.campgroundId !== context.campgroundId) {
      throw new ForbiddenException('Access denied to this conversation');
    }

    // Guests can only access their own conversations
    if (
      context.participantType === ChatParticipantType.guest &&
      (conversation.participantType !== ChatParticipantType.guest ||
        conversation.participantId !== context.participantId)
    ) {
      throw new ForbiddenException('Access denied to this conversation');
    }

    return conversation;
  }

  /**
   * Create a new conversation
   */
  private async createConversation(context: ChatContext) {
    return this.prisma.chatConversation.create({
      data: {
        id: randomUUID(),
        campgroundId: context.campgroundId,
        participantType: context.participantType,
        participantId: context.participantId,
        metadata: toJsonValue({
          role: context.role,
          currentReservationId: context.currentReservationId,
        }),
        updatedAt: new Date(),
      },
    });
  }

  /**
   * Build conversation history for AI context
   */
  private async buildConversationHistory(conversationId: string): Promise<ChatMessage[]> {
    const messages = await this.prisma.chatMessage.findMany({
      where: { conversationId },
      orderBy: { createdAt: 'desc' },
      take: 20, // Last 20 messages for context
    });

    return messages.reverse();
  }

  private async hydrateAttachments(
    attachments?: ChatAttachment[],
  ): Promise<ChatAttachment[] | undefined> {
    if (!attachments || attachments.length === 0) return undefined;

    const hydrated = await Promise.all(
      attachments.map(async (attachment) => {
        if (!attachment.storageKey) return attachment;
        try {
          const downloadUrl = await this.uploads.getSignedUrl(attachment.storageKey);
          return { ...attachment, downloadUrl };
        } catch {
          return attachment;
        }
      })
    );

    return hydrated;
  }

  private async buildConversationHistoryBefore(
    conversationId: string,
    before: Date,
  ): Promise<ChatMessage[]> {
    const messages = await this.prisma.chatMessage.findMany({
      where: { conversationId, createdAt: { lt: before } },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });

    return messages.reverse();
  }

  private formatAttachmentSummary(attachments?: ChatAttachment[]): string | undefined {
    if (!attachments || attachments.length === 0) return undefined;
    const names = attachments
      .map((attachment) => attachment.name.trim())
      .filter((name) => name.length > 0);
    if (names.length === 0) return 'attachments uploaded';
    if (names.length === 1) return `attachment: ${names[0]}`;
    const preview = names.slice(0, 3).join(', ');
    const suffix = names.length > 3 ? ` and ${names.length - 3} more` : '';
    return `attachments: ${preview}${suffix}`;
  }

  private buildConversationTitle(message: string, attachments?: ChatAttachment[]): string | undefined {
    const trimmed = message.trim();
    if (trimmed) return trimmed.slice(0, 60);
    const summary = this.formatAttachmentSummary(attachments);
    return summary ? summary.slice(0, 60) : undefined;
  }

  private async ensureConversationTitle(
    conversationId: string,
    existingTitle: string | null | undefined,
    message: string,
    attachments?: ChatAttachment[],
  ): Promise<void> {
    if (existingTitle && existingTitle.trim().length > 0) return;
    const title = this.buildConversationTitle(message, attachments);
    if (!title) return;
    await this.prisma.chatConversation.updateMany({
      where: {
        id: conversationId,
        OR: [{ title: null }, { title: "" }],
      },
      data: {
        title,
        updatedAt: new Date(),
      },
    });
  }

  private async trackChatAction(params: {
    sessionId?: string;
    context: ChatContext;
    actionType: string;
    metadata: Record<string, unknown>;
  }) {
    const { sessionId, context, actionType, metadata } = params;
    if (!sessionId) return;

    try {
      if (context.participantType === ChatParticipantType.staff) {
        await this.enhancedAnalytics.trackAdminEvent(
          {
            sessionId,
            eventName: AnalyticsEventName.admin_action,
            campgroundId: context.campgroundId,
            userId: context.participantId,
            featureArea: 'chat',
            actionType,
            actionTarget: 'message',
            metadata,
          },
          {
            campgroundId: context.campgroundId,
            organizationId: null,
            userId: context.participantId,
          }
        );
      } else if (context.participantType === ChatParticipantType.guest) {
        await this.analytics.ingest(
          {
            sessionId,
            eventName: AnalyticsEventName.portal_action,
            campgroundId: context.campgroundId,
            metadata: {
              actionType,
              ...metadata,
            },
          },
          {
            campgroundId: context.campgroundId,
            organizationId: null,
            userId: null,
          }
        );
      }
    } catch (error) {
      this.logger.warn('Failed to track chat analytics', error);
    }
  }

  private formatMessageForAI(message: string, attachments?: ChatAttachment[]): string {
    const trimmed = message.trim();
    const attachmentSummary = this.formatAttachmentSummary(attachments);
    if (!attachmentSummary) return trimmed;
    if (!trimmed) return attachmentSummary;
    return `${trimmed}\n(${attachmentSummary})`;
  }

  /**
   * Format history for AI prompt
   */
  private formatHistoryForAI(
    history: ChatMessage[],
    currentMessage: string,
    currentAttachments?: ChatAttachment[],
  ): string {
    const formattedCurrent = this.formatMessageForAI(currentMessage, currentAttachments);
    if (history.length === 0) {
      return formattedCurrent;
    }

    const formattedHistory = history
      .filter((message) => {
        const metadata = isRecord(message.metadata) ? message.metadata : undefined;
        return getMessageVisibility(metadata?.visibility) !== 'internal';
      })
      .slice(-10) // Last 10 messages
      .map(m => {
        const role =
          m.role === ChatMessageRole.user
            ? 'User'
            : m.role === ChatMessageRole.assistant
              ? 'Assistant'
              : m.role === ChatMessageRole.system
                ? 'System'
                : 'Tool';
        const metadata = isRecord(m.metadata) ? m.metadata : undefined;
        const attachments = normalizeAttachments(metadata?.attachments);
        const message = this.formatMessageForAI(m.content, attachments);
        return `${role}: ${message}`;
      })
      .join('\n\n');

    return `Previous conversation:\n${formattedHistory}\n\nUser: ${formattedCurrent}`;
  }

  /**
   * Format history with tool results
   */
  private formatHistoryWithToolResults(
    history: ChatMessage[],
    message: string,
    toolCalls: ToolCall[],
    toolResults: ToolResult[],
    attachments?: ChatAttachment[],
  ): string {
    const base = this.formatHistoryForAI(history, message, attachments);

    const toolInfo = toolCalls.map((tc, i) => {
      const result = toolResults[i];
      return `Tool "${tc.name}" was called with args ${JSON.stringify(tc.args)} and returned: ${JSON.stringify(result?.result || 'error')}`;
    }).join('\n');

    return `${base}\n\nTool Results:\n${toolInfo}\n\nProvide a natural response based on these results.`;
  }

  /**
   * Build system prompt based on context
   */
  private buildSystemPrompt(context: ChatContext): string {
    const isGuest = context.participantType === ChatParticipantType.guest;
    const today = new Date().toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });

    const basePrompt = `You are Keepr AI, a helpful assistant for campground operations and guest support.

IMPORTANT GUIDELINES:
- Be friendly, concise, and helpful
- Focus on practical actions and clear information
- Use the available tools to look up information and perform actions
- Always confirm before making changes or charges
- Keep responses under 150 words unless detailed information is requested
- Format prices in dollars (e.g., $99.00)
- Format dates in a friendly way (e.g., "Saturday, January 11th")

SAFETY & PRIVACY:
- Never request or store passwords, full payment card numbers, or SSNs
- Never expose full payment details; only share masked or summary information
- If a request is sensitive or destructive, confirm intent and summarize impact
- Do not invent data; use tools or state what is unknown

Today's date: ${today}`;

    if (isGuest) {
      return `${basePrompt}

Mode: Guest portal (authenticated guest).

You are helping a guest with their campground booking and stay. You can:
- Search for available sites and check rates
- View reservations and balances
- Request reservation changes (dates, site, party size) and early/late check-in or checkout
- Answer questions about campground policies, hours, and amenities
- Offer post-stay follow-ups and review prompts when appropriate

Guest guardrails:
- Never ask for sensitive payment details; direct guests to in-app payment flows
- Confirm reservation IDs or dates before making changes
- If asked for staff-only actions, explain limits and suggest contacting the front desk

If asked to do something outside your capabilities, politely explain what you can help with or suggest contacting the campground directly.`;
    }

    return `${basePrompt}

Mode: Staff operations (${context.role || 'staff'}).

You are helping campground staff manage operations. You can help with:
- Search and manage reservations
- Check-in and check-out guests
- Process payments and refunds
- View reports and occupancy
- Manage site availability
- Place or release temporary site holds
- Create maintenance tickets
- Review open operational tasks

Staff guardrails:
- Never ask for full card numbers or passwords; use tools for payments and refunds
- For destructive actions (refunds, cancellations, site blocks), always confirm first
- If a request exceeds the user's role, say what permissions are needed and suggest escalation`;
  }

  /**
   * Process tool calls from AI response
   */
  private async processToolCalls(
    rawToolCalls: { id?: string; name: string; arguments: string }[],
    context: ChatContext,
    conversationId: string,
  ): Promise<{
    toolCalls: ToolCall[];
    toolResults: ToolResult[];
    actionRequired?: ActionRequired;
  }> {
    const toolCalls: ToolCall[] = [];
    const toolResults: ToolResult[] = [];
    let actionRequired: ActionRequired | undefined;

    for (const rawCall of rawToolCalls) {
      // Use crypto.randomUUID() for secure, unpredictable IDs
      const toolCallId = rawCall.id || `tc_${randomUUID()}`;
      let args: Record<string, unknown>;

      try {
        args = JSON.parse(rawCall.arguments);
      } catch {
        args = {};
      }

      const toolCall: ToolCall = {
        id: toolCallId,
        name: rawCall.name,
        args,
      };
      toolCalls.push(toolCall);

      const tool = this.toolsService.getTool(rawCall.name);

      // Run preValidate for ALL tools that have it (before confirmation OR execution)
      const preValidateResult = await this.toolsService.runPreValidate(rawCall.name, args, context);

      if (preValidateResult && !preValidateResult.valid) {
        // PreValidate failed - return error immediately
        toolResults.push({
          toolCallId,
          result: {
            success: false,
            message: preValidateResult.message || 'Validation failed',
          },
        });
        continue; // Skip to next tool call
      }

      // If preValidate returned data, merge it into args (e.g., resolved siteId)
      const mergedArgs = preValidateResult ? { ...args, ...preValidateResult } : args;

      // Check if tool requires confirmation
      if (tool?.requiresConfirmation && !mergedArgs.confirmed) {
        // Store pending action with expiration and return confirmation requirement
        const actionId = randomUUID();
        const pendingAction: PendingAction = {
          id: actionId,
          type: 'confirmation',
          tool: rawCall.name,
          args: mergedArgs,
          title: tool.confirmationTitle || `Confirm ${rawCall.name}`,
          description: tool.confirmationDescription || 'Please confirm this action',
          expiresAt: new Date(Date.now() + PENDING_ACTION_TTL_MS),
          conversationId,
        };

        // Store pending action in Redis (or fallback to in-memory)
        await this.storePendingAction(pendingAction);

        actionRequired = {
          type: 'confirmation',
          actionId,
          title: pendingAction.title,
          description: this.toolsService.formatConfirmationDescription(rawCall.name, mergedArgs),
          summary: this.toolsService.formatConfirmationSummary(rawCall.name, mergedArgs),
          data: mergedArgs,
          options: [
            { id: 'confirm', label: 'Confirm', variant: 'default' },
            { id: 'cancel', label: 'Cancel', variant: 'outline' },
          ],
        };

        toolResults.push({
          toolCallId,
          result: { pending: true, message: 'Awaiting user confirmation' },
        });
      } else {
        // Execute tool directly (with merged args from preValidate)
        try {
          const result = await this.toolsService.executeTool(rawCall.name, mergedArgs, context);
          toolResults.push({ toolCallId, result });
        } catch (error) {
          toolResults.push({
            toolCallId,
            result: null,
            error: error instanceof Error ? error.message : 'Tool execution failed',
          });
        }
      }
    }

    return { toolCalls, toolResults, actionRequired };
  }
}
