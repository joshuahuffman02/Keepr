import type { Request as ExpressRequest } from "express";
import { Controller, Post, Get, Body, UseGuards, Req, BadRequestException } from "@nestjs/common";
import { JwtAuthGuard } from "./guards";
import { TotpService } from "../security/totp.service";
import { PrismaService } from "../prisma/prisma.service";
import {
  SecurityEventsService,
  SecurityEventType,
  SecurityEventSeverity,
} from "../security/security-events.service";
import * as bcrypt from "bcryptjs";

/**
 * Two-Factor Authentication (2FA) Controller
 *
 * Provides endpoints for managing TOTP-based 2FA:
 * - GET /auth/2fa/status - Check 2FA status
 * - POST /auth/2fa/setup - Generate setup QR code
 * - POST /auth/2fa/confirm - Confirm setup with TOTP code
 * - POST /auth/2fa/disable - Disable 2FA
 * - POST /auth/2fa/backup-codes - Regenerate backup codes
 */

class Setup2FADto {
  code!: string;
}

class Disable2FADto {
  code!: string;
  password!: string;
}

const requireUserId = (req: ExpressRequest): string => {
  const id = req.user?.id;
  if (!id) {
    throw new BadRequestException("User not found");
  }
  return id;
};

@Controller("auth/2fa")
@UseGuards(JwtAuthGuard)
export class TwoFactorController {
  constructor(
    private readonly totpService: TotpService,
    private readonly prisma: PrismaService,
    private readonly securityEvents: SecurityEventsService,
  ) {}

  /**
   * Get current 2FA status for the user
   */
  @Get("status")
  async getStatus(@Req() req: ExpressRequest) {
    const userId = requireUserId(req);
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        totpEnabled: true,
        totpEnabledAt: true,
      },
    });

    if (!user) {
      throw new BadRequestException("User not found");
    }

    return {
      enabled: user.totpEnabled,
      enabledAt: user.totpEnabledAt,
    };
  }

  /**
   * Start 2FA setup - generates QR code and secret
   */
  @Post("setup")
  async startSetup(@Req() req: ExpressRequest) {
    const userId = requireUserId(req);
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        totpEnabled: true,
      },
    });

    if (!user) {
      throw new BadRequestException("User not found");
    }

    if (user.totpEnabled) {
      throw new BadRequestException("2FA is already enabled. Disable it first to set up again.");
    }

    const setup = await this.totpService.generateSetup(user.id, user.email);

    return {
      qrCodeUrl: setup.qrCodeDataUrl,
      manualEntryKey: setup.secret,
      message: "Scan the QR code with your authenticator app, then confirm with a code",
    };
  }

  /**
   * Confirm 2FA setup with TOTP code
   */
  @Post("confirm")
  async confirmSetup(@Req() req: ExpressRequest, @Body() dto: Setup2FADto) {
    if (!dto.code || dto.code.length !== 6) {
      throw new BadRequestException("Please provide a valid 6-digit code");
    }

    const userId = requireUserId(req);

    try {
      await this.totpService.confirmSetup(userId, dto.code);
      await this.securityEvents.logMfaEvent("enabled", userId, req.ip);

      // Get the backup codes that were generated during setup
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { totpBackupCodes: true },
      });

      return {
        success: true,
        message: "2FA has been enabled successfully.",
      };
    } catch (error) {
      await this.securityEvents.logMfaEvent("failed", userId, req.ip);
      throw error;
    }
  }

  /**
   * Disable 2FA (requires current TOTP code and password)
   */
  @Post("disable")
  async disable(@Req() req: ExpressRequest, @Body() dto: Disable2FADto) {
    if (!dto.code || dto.code.length !== 6) {
      throw new BadRequestException("Please provide a valid 6-digit code");
    }

    if (!dto.password) {
      throw new BadRequestException("Password is required to disable 2FA");
    }

    const userId = requireUserId(req);

    // Verify password first
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { passwordHash: true },
    });

    if (!user) {
      throw new BadRequestException("User not found");
    }

    const passwordValid = await bcrypt.compare(dto.password, user.passwordHash);

    if (!passwordValid) {
      throw new BadRequestException("Invalid password");
    }

    try {
      await this.totpService.disable(userId, dto.code);
      await this.securityEvents.logMfaEvent("disabled", userId, req.ip);

      return {
        success: true,
        message: "2FA has been disabled",
      };
    } catch (error) {
      await this.securityEvents.logMfaEvent("failed", userId, req.ip);
      throw error;
    }
  }

  /**
   * Regenerate backup codes (requires current TOTP code)
   */
  @Post("backup-codes")
  async regenerateBackupCodes(@Req() req: ExpressRequest, @Body() dto: Setup2FADto) {
    if (!dto.code || dto.code.length !== 6) {
      throw new BadRequestException("Please provide a valid 6-digit code");
    }

    const userId = requireUserId(req);

    try {
      const backupCodes = await this.totpService.regenerateBackupCodes(userId, dto.code);

      await this.securityEvents.logEvent({
        type: SecurityEventType.BACKUP_CODE_USED,
        severity: SecurityEventSeverity.INFO,
        userId,
        ipAddress: req.ip,
        details: { action: "regenerated" },
      });

      return {
        success: true,
        backupCodes,
        message:
          "New backup codes generated. Save these in a safe place - they can only be shown once.",
      };
    } catch (error) {
      throw error;
    }
  }
}
