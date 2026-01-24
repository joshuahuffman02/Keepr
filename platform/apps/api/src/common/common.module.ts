import { Module, Global, MiddlewareConsumer, NestModule } from "@nestjs/common";
import { ApiVersionMiddleware } from "./api-version.middleware";
import { RateLimitTiersService } from "./rate-limit-tiers.service";
import { RateLimitGuard } from "./rate-limit.guard";
import { PrismaModule } from "../prisma/prisma.module";

/**
 * Common Module
 *
 * Provides shared utilities for the Developer Platform:
 * - API versioning middleware
 * - Tier-based rate limiting
 */
@Global()
@Module({
  imports: [PrismaModule],
  providers: [ApiVersionMiddleware, RateLimitTiersService, RateLimitGuard],
  exports: [ApiVersionMiddleware, RateLimitTiersService, RateLimitGuard],
})
export class CommonModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    // Apply API versioning middleware to all v1 routes
    consumer.apply(ApiVersionMiddleware).forRoutes("v1/*");
  }
}
