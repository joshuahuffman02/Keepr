import {
  Injectable,
  UnauthorizedException,
  InternalServerErrorException,
  Logger,
} from "@nestjs/common";
import { PassportStrategy } from "@nestjs/passport";
import { ExtractJwt, Strategy } from "passport-jwt";
import { ConfigService } from "@nestjs/config";
import { PrismaService } from "../../prisma/prisma.service";
import type { Request } from "express";

/**
 * Extract JWT from httpOnly cookie or Authorization header
 * SECURITY: Prefer cookie for better XSS protection
 */
function extractJwtFromCookieOrHeader(req: Request): string | null {
  // First check httpOnly cookie (more secure)
  if (req.cookies && req.cookies.guest_token) {
    return req.cookies.guest_token;
  }
  // Fall back to Authorization header for backwards compatibility
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith("Bearer ")) {
    return authHeader.slice(7);
  }
  return null;
}

@Injectable()
export class GuestJwtStrategy extends PassportStrategy(Strategy, "guest-jwt") {
  private readonly logger = new Logger(GuestJwtStrategy.name);

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    const jwtSecret = config?.get<string>("JWT_SECRET") || process.env.JWT_SECRET;
    const isProduction = process.env.NODE_ENV === "production";

    // SECURITY: Never use a default secret - require explicit configuration
    if (!jwtSecret && isProduction) {
      throw new InternalServerErrorException(
        "CRITICAL: JWT_SECRET environment variable is required in production",
      );
    }

    // In development, use a random secret (tokens won't persist across restarts)
    const secretOrKey = jwtSecret ?? `dev-guest-${Date.now()}-${Math.random().toString(36)}`;
    if (!jwtSecret) {
      console.warn(
        "[SECURITY] JWT_SECRET not set for guest auth. Using random secret - guest tokens will not persist across restarts.",
      );
    }

    super({
      jwtFromRequest: extractJwtFromCookieOrHeader,
      ignoreExpiration: false,
      secretOrKey,
    });
  }

  async validate(payload: { sub: string; email: string }) {
    const guest = await this.prisma.guest.findUnique({
      where: { id: payload.sub },
    });

    if (!guest) {
      throw new UnauthorizedException();
    }

    return guest;
  }
}
