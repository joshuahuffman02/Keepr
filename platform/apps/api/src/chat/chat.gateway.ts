import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayInit,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
} from "@nestjs/websockets";
import { Logger } from "@nestjs/common";
import { Server, Socket } from "socket.io";
import { JwtService } from "@nestjs/jwt";
import { PrismaService } from "../prisma/prisma.service";
import { ChatParticipantType } from "@prisma/client";
import type { ChatMessageVisibility, ChatMessagePart } from "./dto/send-message.dto";

interface AuthenticatedChatSocket extends Socket {
  data: {
    participantType: ChatParticipantType;
    participantId: string;
    campgroundIds: string[];
    conversationId?: string;
  };
}

type ChatToolCall = {
  id: string;
  name: string;
  args: Record<string, unknown>;
};

type ChatToolResult = {
  toolCallId: string;
  result: unknown;
};

type ChatActionRequired = {
  type: string;
  actionId: string;
  title: string;
  description: string;
  summary?: string;
  options?: Array<{ id: string; label: string; variant?: string }>;
};

interface ChatStreamToken {
  token: string;
  isComplete: boolean;
  toolCall?: ChatToolCall;
  toolResult?: ChatToolResult;
  actionRequired?: ChatActionRequired;
}

/**
 * WebSocket Gateway for AI Chat streaming
 *
 * Room structure:
 * - conversation:{id} - Events for a specific conversation
 * - chat:{campgroundId}:{participantId} - All chat events for a participant
 *
 * Events emitted:
 * - chat:token - Streaming token from AI response
 * - chat:complete - AI response completed
 * - chat:error - Error during chat processing
 * - chat:typing - AI is typing/processing
 */
@WebSocketGateway({
  cors: {
    origin: process.env.CORS_ORIGIN?.split(",") || ["http://localhost:3000"],
    credentials: true,
  },
  namespace: "/chat",
})
export class ChatGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(ChatGateway.name);
  private connectedClients = new Map<string, AuthenticatedChatSocket>();

  constructor(
    private readonly jwtService: JwtService,
    private readonly prisma: PrismaService
  ) {}

  afterInit() {
    this.logger.log("Chat WebSocket Gateway initialized");
  }

  async handleConnection(client: Socket) {
    try {
      // Extract auth info from handshake
      const token = client.handshake.auth?.token;
      const guestId = client.handshake.auth?.guestId;
      const campgroundId = client.handshake.auth?.campgroundId;

      if (!campgroundId) {
        this.logger.warn(`Chat connection rejected: No campgroundId`);
        client.emit("error", { message: "Campground ID required" });
        client.disconnect();
        return;
      }

      let participantType: ChatParticipantType;
      let participantId: string;
      let campgroundIds: string[] = [campgroundId];

      // Guest authentication (via guestId header)
      if (guestId) {
        const reservation = await this.prisma.reservation.findFirst({
          where: { guestId, campgroundId },
          select: { id: true },
        });

        if (!reservation) {
          this.logger.warn(`Chat connection rejected: Invalid guest ${guestId}`);
          client.emit("error", { message: "Invalid guest credentials" });
          client.disconnect();
          return;
        }

        participantType = ChatParticipantType.guest;
        participantId = guestId;
        campgroundIds = [campgroundId];
      }
      // Staff authentication (via JWT)
      else if (token) {
        try {
          const payload = this.jwtService.verify(token);
          participantType = ChatParticipantType.staff;
          participantId = payload.sub;

          // Get user's campground memberships
          const user = await this.prisma.user.findUnique({
            where: { id: payload.sub },
            include: {
              CampgroundMembership: {
                select: { campgroundId: true },
              },
            },
          });

          if (!user || !user.isActive) {
            throw new Error("User not authorized");
          }

          // Verify user has access to the requested campground
          campgroundIds = user.CampgroundMembership.map((m) => m.campgroundId);
          if (!campgroundIds.includes(campgroundId)) {
            throw new Error("Not authorized for this campground");
          }
        } catch (err) {
          this.logger.warn(`Chat connection rejected: Invalid token`);
          client.emit("error", { message: "Invalid token" });
          client.disconnect();
          return;
        }
      }
      // Reject unauthenticated connections
      else {
        this.logger.warn(`Chat connection rejected: No authentication provided`);
        client.emit("error", { message: "Authentication required" });
        client.disconnect();
        return;
      }

      // Store participant data on socket
      const authSocket: AuthenticatedChatSocket = Object.assign(client, {
        data: {
          participantType,
          participantId,
          campgroundIds,
        },
      });

      // Join participant's chat room
      await client.join(`chat:${campgroundId}:${participantId}`);

      this.connectedClients.set(client.id, authSocket);

      this.logger.log(
        `Chat client connected: ${client.id} (${participantType}: ${participantId})`
      );

      // Send connection confirmation
      client.emit("connected", {
        participantType,
        participantId,
        campgroundId,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      this.logger.error(`Chat connection error: ${error}`);
      client.emit("error", { message: "Connection failed" });
      client.disconnect();
    }
  }

  handleDisconnect(client: Socket) {
    this.connectedClients.delete(client.id);
    this.logger.log(`Chat client disconnected: ${client.id}`);
  }

  /**
   * Subscribe to a specific conversation for streaming
   */
  @SubscribeMessage("conversation:join")
  async handleJoinConversation(
    @ConnectedSocket() client: AuthenticatedChatSocket,
    @MessageBody() data: { conversationId: string }
  ) {
    // Verify the participant owns this conversation AND campground access
    const conversation = await this.prisma.chatConversation.findFirst({
      where: {
        id: data.conversationId,
        participantId: client.data.participantId,
        participantType: client.data.participantType,
        // Multi-tenant isolation: ensure conversation belongs to authorized campground
        campgroundId: { in: client.data.campgroundIds },
      },
    });

    if (!conversation) {
      this.logger.warn(
        `Unauthorized conversation join attempt: ${client.data.participantId} -> ${data.conversationId}`
      );
      return { error: "Conversation not found or not authorized" };
    }

    client.data.conversationId = data.conversationId;
    await client.join(`conversation:${data.conversationId}`);

    return { success: true, conversationId: data.conversationId };
  }

  /**
   * Leave a conversation room
   */
  @SubscribeMessage("conversation:leave")
  async handleLeaveConversation(
    @ConnectedSocket() client: AuthenticatedChatSocket,
    @MessageBody() data: { conversationId: string }
  ) {
    await client.leave(`conversation:${data.conversationId}`);
    if (client.data.conversationId === data.conversationId) {
      client.data.conversationId = undefined;
    }
    return { success: true };
  }

  /**
   * Ping handler for connection health
   */
  @SubscribeMessage("ping")
  handlePing() {
    return { event: "pong", timestamp: Date.now() };
  }

  // ============================================
  // Methods for emitting chat events from service
  // ============================================

  /**
   * Stream a token to a conversation
   */
  emitToken(conversationId: string, data: ChatStreamToken) {
    this.server.to(`conversation:${conversationId}`).emit("chat:token", {
      ...data,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Emit typing indicator
   */
  emitTyping(conversationId: string, isTyping: boolean) {
    this.server.to(`conversation:${conversationId}`).emit("chat:typing", {
      isTyping,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Emit response complete
   */
  emitComplete(
    conversationId: string,
    data: {
      messageId: string;
      content: string;
      toolCalls?: ChatToolCall[];
      toolResults?: ChatToolResult[];
      actionRequired?: ChatActionRequired;
      parts?: ChatMessagePart[];
      visibility?: ChatMessageVisibility;
    }
  ) {
    this.server.to(`conversation:${conversationId}`).emit("chat:complete", {
      ...data,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Emit error
   */
  emitError(conversationId: string, error: string) {
    this.server.to(`conversation:${conversationId}`).emit("chat:error", {
      error,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Emit to a specific participant's chat room
   */
  emitToParticipant(
    campgroundId: string,
    participantId: string,
    event: string,
    data: Record<string, unknown>
  ) {
    this.server
      .to(`chat:${campgroundId}:${participantId}`)
      .emit(event, {
        ...data,
        timestamp: new Date().toISOString(),
      });
  }

  /**
   * Get connected client stats
   */
  getStats() {
    const rooms = this.server?.sockets?.adapter?.rooms;
    const conversationRooms: Record<string, number> = {};

    if (rooms) {
      for (const [room, sockets] of rooms.entries()) {
        if (room.startsWith("conversation:")) {
          conversationRooms[room] = sockets.size;
        }
      }
    }

    return {
      connectedClients: this.connectedClients.size,
      conversationRooms,
    };
  }
}
