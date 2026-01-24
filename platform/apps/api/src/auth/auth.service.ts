import { Injectable, ConflictException, UnauthorizedException, Logger } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { ConfigService } from "@nestjs/config";
import { createHash, randomBytes, randomUUID } from "crypto";
import { PrismaService } from "../prisma/prisma.service";
import { PlatformRole, Prisma } from "@prisma/client";
import { RegisterDto, LoginDto, MobileLoginDto } from "./dto";
import { AcceptInviteDto } from "./dto/accept-invite.dto";
import { AccountLockoutService } from "../security/account-lockout.service";
import {
  SecurityEventsService,
  SecurityEventType,
  SecurityEventSeverity,
} from "../security/security-events.service";
import { RustAuthClientService } from "./rust-auth-client.service";

interface MobileTokenPair {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

type UserWithMembership = Prisma.UserGetPayload<{
  include: {
    CampgroundMembership: {
      include: { Campground: { select: { id: true; name: true; slug: true } } };
    };
  };
}>;

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly accessTokenTtl: number;
  private readonly refreshTokenTtl: number;

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly accountLockout: AccountLockoutService,
    private readonly securityEvents: SecurityEventsService,
    private readonly config: ConfigService,
    private readonly rustAuth: RustAuthClientService,
  ) {
    // Mobile access tokens: 15 minutes, refresh tokens: 30 days
    this.accessTokenTtl = this.config.get<number>("MOBILE_ACCESS_TOKEN_TTL", 900); // 15 min
    this.refreshTokenTtl = this.config.get<number>("MOBILE_REFRESH_TOKEN_TTL", 2592000); // 30 days
  }

  async register(dto: RegisterDto) {
    const normalizedEmail = dto.email.trim().toLowerCase();
    // Check if user already exists
    const existing = await this.prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (existing) {
      throw new ConflictException("Email already registered");
    }

    // Hash password via Rust service (with local fallback)
    const passwordHash = await this.rustAuth.hashPassword(dto.password, 12);

    // Create user
    const user = await this.prisma.user.create({
      data: {
        id: randomUUID(),
        email: normalizedEmail,
        passwordHash,
        firstName: dto.firstName,
        lastName: dto.lastName,
      },
    });

    // Generate token
    const token = this.generateToken(user.id, user.email);

    return {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      token,
    };
  }

  async login(dto: LoginDto, ipAddress?: string, userAgent?: string) {
    const normalizedEmail = dto.email.trim().toLowerCase();

    try {
      // Check if account is locked before attempting login
      const isLocked = await this.accountLockout.isLocked(normalizedEmail);
      if (isLocked) {
        await this.securityEvents.logEvent({
          type: SecurityEventType.LOGIN_BLOCKED,
          severity: SecurityEventSeverity.WARNING,
          ipAddress,
          userAgent,
          details: { email: normalizedEmail, reason: "account_locked" },
        });
        await this.accountLockout.checkAndThrowIfLocked(normalizedEmail);
      }

      this.logger.log(`Attempting login for ${this.sanitizeEmail(normalizedEmail)}`);
      let user: UserWithMembership | null = await this.prisma.user.findUnique({
        where: { email: normalizedEmail },
        include: {
          CampgroundMembership: {
            include: { Campground: { select: { id: true, name: true, slug: true } } },
          },
        },
      });

      if (!user) {
        // SECURITY: Bootstrap admin creation is disabled by default in production
        // Must explicitly set ALLOW_BOOTSTRAP_ADMIN=true to enable
        const isProduction = process.env.NODE_ENV === "production";
        const allowBootstrap = !isProduction || process.env.ALLOW_BOOTSTRAP_ADMIN === "true";

        // Only check for active users if bootstrap is allowed
        const activeUsers = allowBootstrap
          ? await this.prisma.user.count({ where: { isActive: true } })
          : 1; // Pretend there are users to skip bootstrap

        if (activeUsers === 0 && allowBootstrap) {
          // SECURITY: Validate password strength for bootstrap admin
          if (dto.password.length < 12) {
            throw new UnauthorizedException(
              "Bootstrap admin password must be at least 12 characters",
            );
          }
          if (
            !/[A-Z]/.test(dto.password) ||
            !/[a-z]/.test(dto.password) ||
            !/[0-9]/.test(dto.password)
          ) {
            throw new UnauthorizedException(
              "Bootstrap admin password must contain uppercase, lowercase, and numbers",
            );
          }

          this.logger.warn(
            `SECURITY: Bootstrapping first admin user: ${this.sanitizeEmail(normalizedEmail)}`,
          );
          const passwordHash = await this.rustAuth.hashPassword(dto.password, 12);
          user = await this.prisma.user.create({
            data: {
              id: randomUUID(),
              email: normalizedEmail,
              passwordHash,
              firstName: "Admin",
              lastName: "User",
              platformRole: PlatformRole.platform_admin,
              isActive: true,
              mustChangePassword: true,
            },
            include: {
              CampgroundMembership: {
                include: { Campground: { select: { id: true, name: true, slug: true } } },
              },
            },
          });

          // Log security event for bootstrap admin creation
          await this.securityEvents.logEvent({
            type: SecurityEventType.ADMIN_ACTION,
            severity: SecurityEventSeverity.HIGH,
            ipAddress,
            userAgent,
            userId: user.id,
            details: {
              action: "bootstrap_admin_created",
              email: normalizedEmail,
              warning: "First platform admin created via bootstrap",
            },
          });
        } else {
          this.logger.log(`User not found: ${this.sanitizeEmail(normalizedEmail)}`);
          // Record failed attempt even for non-existent users (prevents enumeration)
          await this.accountLockout.handleFailedLogin(normalizedEmail);
          await this.securityEvents.logLoginAttempt(
            false,
            normalizedEmail,
            ipAddress,
            userAgent,
            undefined,
            "user_not_found",
          );
          throw new UnauthorizedException("Invalid credentials");
        }
      }

      if (!user) {
        throw new UnauthorizedException("Invalid credentials");
      }

      if (!user.isActive) {
        this.logger.log(`User not active: ${this.sanitizeEmail(normalizedEmail)}`);
        await this.accountLockout.handleFailedLogin(normalizedEmail);
        await this.securityEvents.logLoginAttempt(
          false,
          normalizedEmail,
          ipAddress,
          userAgent,
          user.id,
          "user_inactive",
        );
        throw new UnauthorizedException("Invalid credentials");
      }

      this.logger.log(`User found, comparing password hash for ${user.id}`);
      const passwordValid = await this.rustAuth.verifyPassword(dto.password, user.passwordHash);
      if (!passwordValid) {
        this.logger.log(`Invalid password for ${this.sanitizeEmail(normalizedEmail)}`);
        // Record failed attempt and check if now locked
        const lockStatus = await this.accountLockout.handleFailedLogin(normalizedEmail);
        await this.securityEvents.logLoginAttempt(
          false,
          normalizedEmail,
          ipAddress,
          userAgent,
          user.id,
          "invalid_password",
        );

        // Check if account just got locked
        if (lockStatus.locked) {
          await this.securityEvents.logAccountLocked(
            normalizedEmail,
            ipAddress,
            lockStatus.attempts,
          );
        }
        throw new UnauthorizedException("Invalid credentials");
      }

      // Successful login - clear any lockout tracking
      await this.accountLockout.recordSuccessfulLogin(normalizedEmail);
      await this.securityEvents.logLoginAttempt(
        true,
        normalizedEmail,
        ipAddress,
        userAgent,
        user.id,
      );

      this.logger.log(`Password valid, generating token`);
      const token = this.generateToken(user.id, user.email);

      return {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        platformRole: user.platformRole,
        campgrounds: user.CampgroundMembership.map(
          (m: { Campground: { id: string; name: string; slug: string }; role: string }) => ({
            id: m.Campground.id,
            name: m.Campground.name,
            slug: m.Campground.slug,
            role: m.role,
          }),
        ),
        token,
      };
    } catch (error) {
      this.logger.error(
        `Login error for ${this.sanitizeEmail(normalizedEmail)}:`,
        error instanceof Error ? error.stack : error,
      );
      throw error;
    }
  }

  async getProfile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        CampgroundMembership: {
          include: { Campground: { select: { id: true, name: true, slug: true } } },
        },
      },
    });

    if (!user) {
      throw new UnauthorizedException("User not found");
    }

    return {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      campgrounds: user.CampgroundMembership.map((m) => ({
        id: m.Campground.id,
        name: m.Campground.name,
        slug: m.Campground.slug,
        role: m.role,
      })),
    };
  }

  private generateToken(userId: string, email: string): string {
    return this.jwtService.sign({ sub: userId, email }, { expiresIn: "7d" });
  }

  async acceptInvite(dto: AcceptInviteDto) {
    const invite = await this.prisma.inviteToken.findUnique({
      where: { token: dto.token },
    });

    if (!invite || invite.redeemedAt) {
      throw new UnauthorizedException("Invalid or already used invite");
    }
    if (invite.expiresAt < new Date()) {
      throw new UnauthorizedException("Invite has expired");
    }

    const passwordHash = await this.rustAuth.hashPassword(dto.password, 12);

    const user = await this.prisma.user.update({
      where: { id: invite.userId },
      data: {
        passwordHash,
        firstName: dto.firstName,
        lastName: dto.lastName,
        isActive: true,
      },
    });

    await this.prisma.inviteToken.update({
      where: { id: invite.id },
      data: { redeemedAt: new Date() },
    });

    const token = this.generateToken(user.id, user.email);

    return {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      token,
    };
  }

  // =========================================================================
  // Mobile Authentication (with refresh tokens)
  // =========================================================================

  /**
   * Mobile login - returns both access and refresh tokens
   */
  async mobileLogin(dto: MobileLoginDto, ipAddress?: string, userAgent?: string) {
    const normalizedEmail = dto.email.trim().toLowerCase();

    try {
      // Check account lockout
      const isLocked = await this.accountLockout.isLocked(normalizedEmail);
      if (isLocked) {
        await this.securityEvents.logEvent({
          type: SecurityEventType.LOGIN_BLOCKED,
          severity: SecurityEventSeverity.WARNING,
          ipAddress,
          userAgent,
          details: {
            email: normalizedEmail,
            reason: "account_locked",
            platform: dto.platform || "mobile",
          },
        });
        await this.accountLockout.checkAndThrowIfLocked(normalizedEmail);
      }

      this.logger.log(`Mobile login attempt for ${this.sanitizeEmail(normalizedEmail)}`);

      const user = await this.prisma.user.findUnique({
        where: { email: normalizedEmail },
        include: {
          CampgroundMembership: {
            include: { Campground: { select: { id: true, name: true, slug: true } } },
          },
        },
      });

      if (!user) {
        await this.accountLockout.handleFailedLogin(normalizedEmail);
        await this.securityEvents.logLoginAttempt(
          false,
          normalizedEmail,
          ipAddress,
          userAgent,
          undefined,
          "user_not_found",
        );
        throw new UnauthorizedException("Invalid credentials");
      }

      if (!user.isActive) {
        await this.accountLockout.handleFailedLogin(normalizedEmail);
        await this.securityEvents.logLoginAttempt(
          false,
          normalizedEmail,
          ipAddress,
          userAgent,
          user.id,
          "user_inactive",
        );
        throw new UnauthorizedException("Invalid credentials");
      }

      const passwordValid = await this.rustAuth.verifyPassword(dto.password, user.passwordHash);
      if (!passwordValid) {
        const lockStatus = await this.accountLockout.handleFailedLogin(normalizedEmail);
        await this.securityEvents.logLoginAttempt(
          false,
          normalizedEmail,
          ipAddress,
          userAgent,
          user.id,
          "invalid_password",
        );
        if (lockStatus.locked) {
          await this.securityEvents.logAccountLocked(
            normalizedEmail,
            ipAddress,
            lockStatus.attempts,
          );
        }
        throw new UnauthorizedException("Invalid credentials");
      }

      // Success - clear lockout and generate tokens
      await this.accountLockout.recordSuccessfulLogin(normalizedEmail);
      await this.securityEvents.logLoginAttempt(
        true,
        normalizedEmail,
        ipAddress,
        userAgent,
        user.id,
      );

      // Generate token pair
      const tokens = await this.generateMobileTokenPair(user.id, user.email);

      // Create mobile session
      await this.createMobileSession(user.id, tokens.refreshToken, {
        deviceId: dto.deviceId,
        deviceName: dto.deviceName,
        platform: dto.platform,
        appVersion: dto.appVersion,
      });

      this.logger.log(`Mobile login successful for ${this.sanitizeEmail(normalizedEmail)}`);

      return {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        platformRole: user.platformRole,
        campgrounds: user.CampgroundMembership.map(
          (m: { Campground: { id: string; name: string; slug: string }; role: string }) => ({
            id: m.Campground.id,
            name: m.Campground.name,
            slug: m.Campground.slug,
            role: m.role,
          }),
        ),
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        expiresIn: tokens.expiresIn,
      };
    } catch (error) {
      this.logger.error(
        `Mobile login error for ${this.sanitizeEmail(normalizedEmail)}:`,
        error instanceof Error ? error.stack : error,
      );
      throw error;
    }
  }

  /**
   * Refresh access token using refresh token
   */
  async refreshMobileToken(refreshToken: string, ipAddress?: string, userAgent?: string) {
    const tokenHash = this.hashToken(refreshToken);

    const session = await this.prisma.mobileSession.findFirst({
      where: {
        refreshTokenHash: tokenHash,
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
      include: {
        User: {
          include: {
            CampgroundMembership: {
              include: { Campground: { select: { id: true, name: true, slug: true } } },
            },
          },
        },
      },
    });

    if (!session || !session.User || !session.User.isActive) {
      this.logger.warn(`Invalid refresh token attempt from ${ipAddress}`);
      throw new UnauthorizedException("Invalid refresh token");
    }

    // Generate new token pair
    const tokens = await this.generateMobileTokenPair(session.userId, session.User.email);

    // Rotate refresh token - revoke old, create new session
    await this.prisma.mobileSession.update({
      where: { id: session.id },
      data: { revokedAt: new Date() },
    });

    await this.createMobileSession(session.userId, tokens.refreshToken, {
      deviceId: session.deviceId || undefined,
      deviceName: session.deviceName || undefined,
      platform: session.platform || undefined,
      appVersion: session.appVersion || undefined,
    });

    this.logger.log(`Refresh token rotated for user ${session.userId}`);

    return {
      id: session.User.id,
      email: session.User.email,
      firstName: session.User.firstName,
      lastName: session.User.lastName,
      platformRole: session.User.platformRole,
      campgrounds: session.User.CampgroundMembership.map(
        (m: { Campground: { id: string; name: string; slug: string }; role: string }) => ({
          id: m.Campground.id,
          name: m.Campground.name,
          slug: m.Campground.slug,
          role: m.role,
        }),
      ),
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      expiresIn: tokens.expiresIn,
    };
  }

  /**
   * Logout - revoke refresh token
   */
  async mobileLogout(refreshToken: string) {
    const tokenHash = this.hashToken(refreshToken);

    const result = await this.prisma.mobileSession.updateMany({
      where: {
        refreshTokenHash: tokenHash,
        revokedAt: null,
      },
      data: { revokedAt: new Date() },
    });

    if (result.count > 0) {
      this.logger.log(`Mobile session revoked`);
    }

    return { success: true };
  }

  /**
   * Revoke all sessions for a user (e.g., password change)
   */
  async revokeAllMobileSessions(userId: string) {
    const result = await this.prisma.mobileSession.updateMany({
      where: {
        userId,
        revokedAt: null,
      },
      data: { revokedAt: new Date() },
    });

    this.logger.log(`Revoked ${result.count} mobile sessions for user ${userId}`);
    return { revokedCount: result.count };
  }

  /**
   * Get active sessions for a user
   */
  async getMobileSessions(userId: string) {
    const sessions = await this.prisma.mobileSession.findMany({
      where: {
        userId,
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
      select: {
        id: true,
        deviceId: true,
        deviceName: true,
        platform: true,
        appVersion: true,
        lastUsedAt: true,
        createdAt: true,
      },
      orderBy: { lastUsedAt: "desc" },
    });

    return sessions;
  }

  /**
   * Revoke a specific session
   */
  async revokeMobileSession(userId: string, sessionId: string) {
    const session = await this.prisma.mobileSession.findFirst({
      where: { id: sessionId, userId },
    });

    if (!session) {
      throw new UnauthorizedException("Session not found");
    }

    await this.prisma.mobileSession.update({
      where: { id: sessionId },
      data: { revokedAt: new Date() },
    });

    return { success: true };
  }

  // =========================================================================
  // Private helpers for mobile auth
  // =========================================================================

  private async generateMobileTokenPair(userId: string, email: string): Promise<MobileTokenPair> {
    // Short-lived access token (JWT)
    const accessToken = this.jwtService.sign(
      { sub: userId, email },
      { expiresIn: this.accessTokenTtl },
    );

    // Long-lived opaque refresh token
    const refreshToken = randomBytes(48).toString("hex");

    return {
      accessToken,
      refreshToken,
      expiresIn: this.accessTokenTtl,
    };
  }

  private async createMobileSession(
    userId: string,
    refreshToken: string,
    deviceInfo: {
      deviceId?: string;
      deviceName?: string;
      platform?: string;
      appVersion?: string;
    },
  ) {
    const expiresAt = new Date(Date.now() + this.refreshTokenTtl * 1000);

    await this.prisma.mobileSession.create({
      data: {
        id: randomUUID(),
        userId,
        refreshTokenHash: this.hashToken(refreshToken),
        deviceId: deviceInfo.deviceId,
        deviceName: deviceInfo.deviceName,
        platform: deviceInfo.platform,
        appVersion: deviceInfo.appVersion,
        expiresAt,
      },
    });
  }

  private hashToken(token: string): string {
    return createHash("sha256").update(token).digest("hex");
  }

  /**
   * Sanitize email for logging - show first 2 chars + domain only
   * Protects PII while still allowing debugging
   */
  private sanitizeEmail(email: string): string {
    const [local, domain] = email.split("@");
    if (!domain) return "***";
    const safeLocal = local.length > 2 ? `${local.slice(0, 2)}***` : "***";
    return `${safeLocal}@${domain}`;
  }
}
