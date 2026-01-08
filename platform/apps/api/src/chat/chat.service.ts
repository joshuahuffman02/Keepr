import { Injectable, Logger, NotFoundException, ForbiddenException, BadRequestException, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AiProviderService } from '../ai/ai-provider.service';
import { AiFeatureType, ChatParticipantType, ChatMessageRole } from '@prisma/client';
import { randomUUID } from 'crypto';
import {
  SendMessageDto,
  ChatMessageResponse,
  ToolCall,
  ToolResult,
  ActionRequired,
} from './dto/send-message.dto';
import {
  ExecuteActionDto,
  ExecuteActionResponse,
} from './dto/execute-action.dto';
import {
  GetHistoryDto,
  ConversationHistoryResponse,
  MessageHistoryItem,
} from './dto/get-history.dto';
import { ChatToolsService } from './chat-tools.service';
import { ChatGateway } from './chat.gateway';

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
  args: Record<string, any>;
  title: string;
  description: string;
  expiresAt: Date;
  conversationId: string;
}

// Pending actions expire after 10 minutes
const PENDING_ACTION_TTL_MS = 10 * 60 * 1000;
// Cleanup runs every 5 minutes
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000;

@Injectable()
export class ChatService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ChatService.name);

  // In-memory store for pending actions with TTL
  private pendingActions = new Map<string, PendingAction>();
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly aiProvider: AiProviderService,
    private readonly toolsService: ChatToolsService,
    private readonly chatGateway: ChatGateway,
  ) {}

  onModuleInit() {
    // Start cleanup interval for expired pending actions
    this.cleanupInterval = setInterval(() => {
      this.cleanupExpiredActions();
    }, CLEANUP_INTERVAL_MS);
    this.logger.log('Chat service initialized with pending action cleanup');
  }

  onModuleDestroy() {
    // Clear cleanup interval on shutdown
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }

  /**
   * Remove expired pending actions
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
   * Send a message to the AI chat and get a response
   */
  async sendMessage(
    dto: SendMessageDto,
    context: ChatContext,
  ): Promise<ChatMessageResponse> {
    const { message, conversationId: existingConversationId } = dto;

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
      },
    });

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
        userPrompt: this.formatHistoryForAI(history, message),
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
            userPrompt: this.formatHistoryWithToolResults(history, message, toolCalls, toolResults),
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
          toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
          toolResults: toolResults.length > 0 ? toolResults : undefined,
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
          metadata: { error: error instanceof Error ? error.message : 'Unknown error' },
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
    const { message, conversationId: existingConversationId } = dto;

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
      },
    });

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
        userPrompt: this.formatHistoryForAI(history, message),
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
          let args: Record<string, any>;
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
              toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
              toolResults: toolResults.length > 0 ? toolResults : undefined,
            },
          });

          this.chatGateway.emitTyping(conversation.id, false);
          this.chatGateway.emitComplete(conversation.id, {
            messageId: assistantMessage.id,
            content: finalContent || 'I need your confirmation to proceed.',
            toolCalls,
            toolResults,
            actionRequired,
          });
          return;
        }

        // If tools were executed, get a follow-up response
        if (toolResults.length > 0) {
          const followUp = await this.aiProvider.getCompletion({
            campgroundId: context.campgroundId,
            featureType: AiFeatureType.booking_assist,
            systemPrompt,
            userPrompt: this.formatHistoryWithToolResults(history, message, toolCalls, toolResults),
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
          toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
          toolResults: toolResults.length > 0 ? toolResults : undefined,
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

    // Get pending action
    const pendingAction = this.pendingActions.get(actionId);
    if (!pendingAction) {
      throw new BadRequestException('Action not found or expired');
    }

    // Check if action has expired
    if (pendingAction.expiresAt < new Date()) {
      this.pendingActions.delete(actionId);
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

      // Clear pending action
      this.pendingActions.delete(actionId);

      // Save tool execution as message
      await this.prisma.chatMessage.create({
        data: {
          id: randomUUID(),
          conversationId,
          role: ChatMessageRole.tool,
          content: `Executed: ${pendingAction.tool}`,
          toolResults: [{ toolCallId: actionId, result }],
        },
      });

      return {
        success: true,
        message: result.message || 'Action completed successfully',
        result: result.data,
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
    const whereClause: any = { conversationId: conversation.id };
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

    const formattedMessages: MessageHistoryItem[] = messages.map(m => ({
      id: m.id,
      role: m.role as 'user' | 'assistant' | 'tool' | 'system',
      content: m.content,
      toolCalls: m.toolCalls as any[],
      toolResults: m.toolResults as any[],
      createdAt: m.createdAt.toISOString(),
    }));

    return {
      conversationId: conversation.id,
      messages: formattedMessages,
      hasMore,
      nextCursor: hasMore && messages.length > 0 ? messages[0].id : undefined,
    };
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
        metadata: {
          role: context.role,
          currentReservationId: context.currentReservationId,
        },
        updatedAt: new Date(),
      },
    });
  }

  /**
   * Build conversation history for AI context
   */
  private async buildConversationHistory(conversationId: string) {
    const messages = await this.prisma.chatMessage.findMany({
      where: { conversationId },
      orderBy: { createdAt: 'desc' },
      take: 20, // Last 20 messages for context
    });

    return messages.reverse();
  }

  /**
   * Format history for AI prompt
   */
  private formatHistoryForAI(history: any[], currentMessage: string): string {
    if (history.length === 0) {
      return currentMessage;
    }

    const formattedHistory = history
      .slice(-10) // Last 10 messages
      .map(m => {
        const role = m.role === 'user' ? 'User' : m.role === 'assistant' ? 'Assistant' : 'System';
        return `${role}: ${m.content}`;
      })
      .join('\n\n');

    return `Previous conversation:\n${formattedHistory}\n\nUser: ${currentMessage}`;
  }

  /**
   * Format history with tool results
   */
  private formatHistoryWithToolResults(
    history: any[],
    message: string,
    toolCalls: ToolCall[],
    toolResults: ToolResult[],
  ): string {
    const base = this.formatHistoryForAI(history, message);

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

    const basePrompt = `You are Keepr AI, a helpful assistant for ${isGuest ? 'campground guests' : 'campground staff'}.

IMPORTANT GUIDELINES:
- Be friendly, concise, and helpful
- Focus on practical actions and clear information
- Use the available tools to look up information and perform actions
- Always confirm before making changes or charges
- Keep responses under 150 words unless detailed information is requested
- Format prices in dollars (e.g., $99.00)
- Format dates in a friendly way (e.g., "Saturday, January 11th")

Today's date: ${new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}`;

    if (isGuest) {
      return `${basePrompt}

You are helping a guest with their campground booking. You can:
- Search for available sites and check rates
- Make new reservations
- View and modify existing reservations (with their permission)
- Answer questions about the campground
- Help with payments

If asked to do something outside your capabilities, politely explain what you can help with or suggest contacting the campground directly.`;
    }

    return `${basePrompt}

You are helping campground staff manage operations. Based on their role (${context.role || 'staff'}), you can help with:
- Search and manage reservations
- Check-in and check-out guests
- Process payments and refunds
- View reports and occupancy
- Manage site availability
- Create maintenance tickets

For destructive actions (refunds, cancellations), always confirm with the user first.`;
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
      let args: Record<string, any>;

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

      // Check if tool requires confirmation
      const tool = this.toolsService.getTool(rawCall.name);
      if (tool?.requiresConfirmation && !args.confirmed) {
        // Store pending action with expiration and return confirmation requirement
        const actionId = randomUUID();
        const pendingAction: PendingAction = {
          id: actionId,
          type: 'confirmation',
          tool: rawCall.name,
          args,
          title: tool.confirmationTitle || `Confirm ${rawCall.name}`,
          description: tool.confirmationDescription || 'Please confirm this action',
          expiresAt: new Date(Date.now() + PENDING_ACTION_TTL_MS),
          conversationId,
        };

        this.pendingActions.set(actionId, pendingAction);

        actionRequired = {
          type: 'confirmation',
          actionId,
          title: pendingAction.title,
          description: this.toolsService.formatConfirmationDescription(rawCall.name, args),
          data: args,
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
        // Execute tool directly
        try {
          const result = await this.toolsService.executeTool(rawCall.name, args, context);
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
