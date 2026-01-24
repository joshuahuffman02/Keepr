import { Injectable, BadRequestException, UnauthorizedException, Logger } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { Prisma } from "@prisma/client";
import * as OTPAuth from "otpauth";
import * as QRCode from "qrcode";
import { randomBytes, createCipheriv, createDecipheriv } from "crypto";

/**
 * TOTP (Time-based One-Time Password) Service
 *
 * Provides 2FA/MFA using the TOTP algorithm (RFC 6238).
 * Compatible with Google Authenticator, Authy, 1Password, etc.
 *
 * Flow:
 * 1. User enables 2FA - we generate a secret and QR code
 * 2. User scans QR with authenticator app
 * 3. User confirms with a valid code to complete setup
 * 4. On future logins, user provides code from app
 */
@Injectable()
export class TotpService {
  private readonly logger = new Logger(TotpService.name);
  private readonly issuer = "CampReserv";
  private readonly encryptionKey: Buffer;
  private readonly algorithm = "aes-256-gcm";

  constructor(private readonly prisma: PrismaService) {
    // Encryption key for storing TOTP secrets
    // In production, this should be from a secure key management service
    const keyString = process.env.TOTP_ENCRYPTION_KEY || process.env.JWT_SECRET || "";

    if (keyString.length < 32) {
      this.logger.warn("TOTP_ENCRYPTION_KEY should be at least 32 characters");
    }

    // Derive a 32-byte key using padding/truncating
    this.encryptionKey = Buffer.alloc(32);
    Buffer.from(keyString).copy(this.encryptionKey);
  }

  /**
   * Generate a new TOTP secret for a user (Step 1 of setup)
   *
   * @param userId The user's ID
   * @param email The user's email (used as account name in authenticator)
   * @returns Setup data including secret and QR code
   */
  async generateSetup(
    userId: string,
    email: string,
  ): Promise<{
    secret: string;
    qrCodeDataUrl: string;
    manualEntryKey: string;
    backupCodes: string[];
  }> {
    // Generate a random secret
    const secret = new OTPAuth.Secret({ size: 20 });

    // Create TOTP instance
    const totp = new OTPAuth.TOTP({
      issuer: this.issuer,
      label: email,
      algorithm: "SHA1",
      digits: 6,
      period: 30,
      secret: secret,
    });

    // Generate QR code
    const otpauthUrl = totp.toString();
    const qrCodeDataUrl = await QRCode.toDataURL(otpauthUrl, {
      width: 256,
      margin: 2,
      color: {
        dark: "#000000",
        light: "#ffffff",
      },
    });

    // Generate backup codes
    const backupCodes = this.generateBackupCodes(8);

    // Store the pending setup (encrypted)
    const encryptedSecret = this.encryptSecret(secret.base32);
    const hashedBackupCodes = await this.hashBackupCodes(backupCodes);

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        totpPendingSecret: encryptedSecret,
        totpBackupCodes: hashedBackupCodes,
      },
    });

    return {
      secret: secret.base32,
      qrCodeDataUrl,
      manualEntryKey: secret.base32,
      backupCodes,
    };
  }

  /**
   * Confirm TOTP setup with a valid code (Step 2 of setup)
   *
   * @param userId The user's ID
   * @param code The 6-digit code from authenticator app
   * @returns Whether setup was successful
   */
  async confirmSetup(userId: string, code: string): Promise<boolean> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { totpPendingSecret: true },
    });

    if (!user?.totpPendingSecret) {
      throw new BadRequestException("No pending 2FA setup found. Please start setup again.");
    }

    // Decrypt and verify
    const secret = this.decryptSecret(user.totpPendingSecret);
    const isValid = this.verifyCode(secret, code);

    if (!isValid) {
      throw new BadRequestException("Invalid verification code. Please try again.");
    }

    // Move pending secret to active
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        totpSecret: user.totpPendingSecret,
        totpPendingSecret: null,
        totpEnabled: true,
        totpEnabledAt: new Date(),
      },
    });

    return true;
  }

  /**
   * Verify a TOTP code during login
   *
   * @param userId The user's ID
   * @param code The 6-digit code from authenticator app
   * @returns Whether the code is valid
   */
  async verifyLogin(userId: string, code: string): Promise<boolean> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        totpSecret: true,
        totpEnabled: true,
        totpBackupCodes: true,
      },
    });

    if (!user?.totpEnabled || !user.totpSecret) {
      // 2FA not enabled - allow login
      return true;
    }

    // Try regular TOTP code first
    const secret = this.decryptSecret(user.totpSecret);
    if (this.verifyCode(secret, code)) {
      return true;
    }

    // Try backup codes
    const backupCodes = normalizeBackupCodes(user.totpBackupCodes);
    if (backupCodes) {
      const usedIndex = await this.checkBackupCode(code, backupCodes);

      if (usedIndex >= 0) {
        // Remove used backup code
        backupCodes.splice(usedIndex, 1);
        await this.prisma.user.update({
          where: { id: userId },
          data: { totpBackupCodes: backupCodes },
        });

        this.logger.log(`Backup code used for user ${userId}. ${backupCodes.length} remaining.`);
        return true;
      }
    }

    throw new UnauthorizedException("Invalid 2FA code");
  }

  /**
   * Check if a user has 2FA enabled
   */
  async isEnabled(userId: string): Promise<boolean> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { totpEnabled: true },
    });

    return user?.totpEnabled ?? false;
  }

  /**
   * Disable 2FA for a user
   *
   * @param userId The user's ID
   * @param code A valid TOTP code or backup code (for verification)
   */
  async disable(userId: string, code: string): Promise<boolean> {
    // Verify the code first
    const isValid = await this.verifyLogin(userId, code);

    if (!isValid) {
      throw new BadRequestException("Invalid verification code");
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        totpEnabled: false,
        totpSecret: null,
        totpPendingSecret: null,
        totpBackupCodes: Prisma.DbNull,
        totpEnabledAt: null,
      },
    });

    this.logger.log(`2FA disabled for user ${userId}`);
    return true;
  }

  /**
   * Generate new backup codes
   */
  async regenerateBackupCodes(userId: string, code: string): Promise<string[]> {
    // Verify current code
    await this.verifyLogin(userId, code);

    const backupCodes = this.generateBackupCodes(8);
    const hashedCodes = await this.hashBackupCodes(backupCodes);

    await this.prisma.user.update({
      where: { id: userId },
      data: { totpBackupCodes: hashedCodes },
    });

    return backupCodes;
  }

  // --- Private Methods ---

  private verifyCode(secret: string, code: string): boolean {
    if (!code || code.length !== 6) {
      return false;
    }

    const totp = new OTPAuth.TOTP({
      algorithm: "SHA1",
      digits: 6,
      period: 30,
      secret: OTPAuth.Secret.fromBase32(secret),
    });

    // Allow 1 period of drift (30 seconds before/after)
    const delta = totp.validate({ token: code, window: 1 });
    return delta !== null;
  }

  private generateBackupCodes(count: number): string[] {
    const codes: string[] = [];

    for (let i = 0; i < count; i++) {
      // Generate 8-character alphanumeric codes
      const code = randomBytes(5)
        .toString("base64")
        .replace(/[+/=]/g, "")
        .substring(0, 8)
        .toUpperCase();
      codes.push(code);
    }

    return codes;
  }

  private async hashBackupCodes(codes: string[]): Promise<string[]> {
    const bcrypt = await import("bcryptjs");
    const hashed: string[] = [];

    for (const code of codes) {
      hashed.push(await bcrypt.hash(code.toUpperCase(), 10));
    }

    return hashed;
  }

  private async checkBackupCode(code: string, hashedCodes: string[]): Promise<number> {
    const bcrypt = await import("bcryptjs");
    const normalizedCode = code.toUpperCase().replace(/\s/g, "");

    for (let i = 0; i < hashedCodes.length; i++) {
      if (await bcrypt.compare(normalizedCode, hashedCodes[i])) {
        return i;
      }
    }

    return -1;
  }

  private encryptSecret(secret: string): string {
    const iv = randomBytes(16);
    const cipher = createCipheriv(this.algorithm, this.encryptionKey, iv);

    let encrypted = cipher.update(secret, "utf8", "hex");
    encrypted += cipher.final("hex");

    const authTag = cipher.getAuthTag();

    // Format: iv:authTag:encrypted
    return `${iv.toString("hex")}:${authTag.toString("hex")}:${encrypted}`;
  }

  private decryptSecret(encryptedSecret: string): string {
    const [ivHex, authTagHex, encrypted] = encryptedSecret.split(":");

    const iv = Buffer.from(ivHex, "hex");
    const authTag = Buffer.from(authTagHex, "hex");
    const decipher = createDecipheriv(this.algorithm, this.encryptionKey, iv);

    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(encrypted, "hex", "utf8");
    decrypted += decipher.final("utf8");

    return decrypted;
  }
}

const normalizeBackupCodes = (value: unknown): string[] | null =>
  Array.isArray(value) && value.every((entry) => typeof entry === "string") ? [...value] : null;
