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
import { Logger, UnauthorizedException } from "@nestjs/common";
import { Server, Socket } from "socket.io";
import { JwtService } from "@nestjs/jwt";
import { PrismaService } from "../prisma/prisma.service";

interface AuthenticatedSocket extends Socket {
  data: {
    userId: string;
    email: string;
    campgroundIds: string[];
  };
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const buildPayload = (data: unknown) => ({
  ...(isRecord(data) ? data : { payload: data }),
  timestamp: new Date().toISOString(),
});

/**
 * WebSocket Gateway for real-time updates
 *
 * Room structure:
 * - campground:{id} - All events for a campground (reservations, availability, etc.)
 * - user:{id} - Personal notifications for a user
 * - dashboard:{campgroundId} - Dashboard metrics only
 *
 * Events emitted:
 * - reservation.created
 * - reservation.updated
 * - reservation.cancelled
 * - site.availability
 * - dashboard.metrics
 * - notification.new
 */
@WebSocketGateway({
  cors: {
    origin: process.env.CORS_ORIGIN?.split(",") || ["http://localhost:3000"],
    credentials: true,
  },
  namespace: "/realtime",
})
export class RealtimeGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(RealtimeGateway.name);
  private connectedClients = new Map<string, Socket>();

  constructor(
    private readonly jwtService: JwtService,
    private readonly prisma: PrismaService,
  ) {}

  afterInit() {
    this.logger.log("WebSocket Gateway initialized");
  }

  async handleConnection(client: Socket) {
    try {
      // Extract JWT from handshake
      const token =
        client.handshake.auth?.token ||
        client.handshake.headers?.authorization?.replace("Bearer ", "");

      if (!token) {
        this.logger.warn(`Connection rejected: No token provided`);
        client.emit("error", { message: "Authentication required" });
        client.disconnect();
        return;
      }

      // Verify JWT
      let payload: { sub: string; email: string };
      try {
        payload = this.jwtService.verify(token);
      } catch (err) {
        this.logger.warn(`Connection rejected: Invalid token`);
        client.emit("error", { message: "Invalid token" });
        client.disconnect();
        return;
      }

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
        this.logger.warn(`Connection rejected: User not found or inactive`);
        client.emit("error", { message: "User not authorized" });
        client.disconnect();
        return;
      }

      const campgroundIds = user.CampgroundMembership.map((m) => m.campgroundId);

      // Store user data on socket
      client.data = {
        userId: user.id,
        email: user.email,
        campgroundIds,
      };

      // Auto-join user's campground rooms
      for (const campgroundId of campgroundIds) {
        await client.join(`campground:${campgroundId}`);
        await client.join(`dashboard:${campgroundId}`);
      }

      // Join personal notification room
      await client.join(`user:${user.id}`);

      this.connectedClients.set(client.id, client);

      this.logger.log(
        `Client connected: ${client.id} (user: ${user.email}, campgrounds: ${campgroundIds.length})`,
      );

      // Send connection confirmation
      client.emit("connected", {
        userId: user.id,
        campgroundIds,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      this.logger.error(`Connection error: ${error}`);
      client.emit("error", { message: "Connection failed" });
      client.disconnect();
    }
  }

  handleDisconnect(client: Socket) {
    this.connectedClients.delete(client.id);
    this.logger.log(`Client disconnected: ${client.id}`);
  }

  /**
   * Handle client subscribing to a specific campground
   * (in case they want to subscribe to one they weren't auto-joined to)
   */
  @SubscribeMessage("subscribe:campground")
  async handleSubscribeCampground(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { campgroundId: string },
  ) {
    // Verify user has access to this campground
    if (!client.data.campgroundIds.includes(data.campgroundId)) {
      return { error: "Not authorized for this campground" };
    }

    await client.join(`campground:${data.campgroundId}`);
    return { success: true, campgroundId: data.campgroundId };
  }

  /**
   * Handle client unsubscribing from a campground
   */
  @SubscribeMessage("unsubscribe:campground")
  async handleUnsubscribeCampground(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { campgroundId: string },
  ) {
    await client.leave(`campground:${data.campgroundId}`);
    return { success: true };
  }

  /**
   * Ping handler for connection health checks
   */
  @SubscribeMessage("ping")
  handlePing() {
    return { event: "pong", timestamp: Date.now() };
  }

  // ============================================
  // Methods for broadcasting events from services
  // ============================================

  /**
   * Emit to all clients in a campground room
   */
  emitToCampground(campgroundId: string, event: string, data: unknown) {
    this.server.to(`campground:${campgroundId}`).emit(event, buildPayload(data));
  }

  /**
   * Emit to dashboard subscribers only
   */
  emitToDashboard(campgroundId: string, event: string, data: unknown) {
    this.server.to(`dashboard:${campgroundId}`).emit(event, buildPayload(data));
  }

  /**
   * Emit to a specific user
   */
  emitToUser(userId: string, event: string, data: unknown) {
    this.server.to(`user:${userId}`).emit(event, buildPayload(data));
  }

  /**
   * Get stats for monitoring
   */
  getStats() {
    const rooms = this.server?.sockets?.adapter?.rooms;
    const campgroundRooms: Record<string, number> = {};

    if (rooms) {
      for (const [room, sockets] of rooms.entries()) {
        if (room.startsWith("campground:")) {
          campgroundRooms[room] = sockets.size;
        }
      }
    }

    return {
      connectedClients: this.connectedClients.size,
      campgroundRooms,
    };
  }
}
