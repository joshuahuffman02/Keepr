import { Module, Global } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { RealtimeGateway } from "./realtime.gateway";
import { RealtimeService } from "./realtime.service";
import { PrismaModule } from "../prisma/prisma.module";

/**
 * Global module for real-time WebSocket functionality
 *
 * Provides:
 * - RealtimeGateway: WebSocket server with JWT authentication
 * - RealtimeService: Helper for broadcasting events from other modules
 *
 * Usage in other modules:
 * ```
 * // No import needed - it's global
 * constructor(private readonly realtime: RealtimeService) {}
 *
 * this.realtime.emitReservationCreated(campgroundId, data);
 * ```
 */
@Global()
@Module({
  imports: [
    PrismaModule,
    JwtModule.register({
      secret: process.env.JWT_SECRET || "dev-secret-change-in-production",
      signOptions: { expiresIn: "7d" },
    }),
  ],
  providers: [RealtimeGateway, RealtimeService],
  exports: [RealtimeService],
})
export class RealtimeModule {}
