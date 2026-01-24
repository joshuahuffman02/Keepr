import { Injectable, InternalServerErrorException, Logger } from "@nestjs/common";
import * as crypto from "crypto";

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const getErrorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

const getErrorStack = (error: unknown): string | undefined =>
  error instanceof Error ? error.stack : undefined;

/**
 * Credential Encryption Service
 *
 * Encrypts and decrypts integration credentials using AES-256-GCM.
 * Uses a master key from environment variables.
 */
@Injectable()
export class CredentialEncryptionService {
  private readonly logger = new Logger(CredentialEncryptionService.name);
  private readonly algorithm = "aes-256-gcm";
  private readonly keyLength = 32; // 256 bits
  private readonly ivLength = 16; // 128 bits
  private readonly authTagLength = 16; // 128 bits

  private getMasterKey(): Buffer {
    const key = process.env.INTEGRATION_ENCRYPTION_KEY || process.env.JWT_SECRET;
    if (!key) {
      this.logger.warn("No encryption key configured, using fallback (NOT SECURE FOR PRODUCTION)");
      return crypto.scryptSync("campreserv-default-key", "salt", this.keyLength);
    }
    // Derive a proper key from the provided key using scrypt
    return crypto.scryptSync(key, "integration-credentials", this.keyLength);
  }

  /**
   * Encrypt credentials object to a JSON-safe format
   */
  encrypt(data: Record<string, unknown>): string {
    try {
      const key = this.getMasterKey();
      const iv = crypto.randomBytes(this.ivLength);
      const cipher = crypto.createCipheriv(this.algorithm, key, iv);

      const plaintext = JSON.stringify(data);
      const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
      const authTag = cipher.getAuthTag();

      // Combine iv + authTag + encrypted data
      const combined = Buffer.concat([iv, authTag, encrypted]);
      return combined.toString("base64");
    } catch (error) {
      this.logger.error("Encryption failed", getErrorStack(error) ?? getErrorMessage(error));
      throw new InternalServerErrorException("Failed to encrypt credentials");
    }
  }

  /**
   * Decrypt credentials from encrypted string
   */
  decrypt(encryptedData: string): Record<string, unknown> {
    try {
      const key = this.getMasterKey();
      const combined = Buffer.from(encryptedData, "base64");

      // Extract iv, authTag, and encrypted data
      const iv = combined.subarray(0, this.ivLength);
      const authTag = combined.subarray(this.ivLength, this.ivLength + this.authTagLength);
      const encrypted = combined.subarray(this.ivLength + this.authTagLength);

      const decipher = crypto.createDecipheriv(this.algorithm, key, iv);
      decipher.setAuthTag(authTag);

      const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);

      return JSON.parse(decrypted.toString("utf8"));
    } catch (error) {
      this.logger.error("Decryption failed", getErrorStack(error) ?? getErrorMessage(error));
      throw new InternalServerErrorException("Failed to decrypt credentials");
    }
  }

  /**
   * Check if a value appears to be encrypted
   */
  isEncrypted(value: unknown): boolean {
    if (typeof value !== "string") return false;
    try {
      const decoded = Buffer.from(value, "base64");
      // Minimum length: iv (16) + authTag (16) + at least some data
      return decoded.length > this.ivLength + this.authTagLength;
    } catch {
      return false;
    }
  }

  /**
   * Generate a random webhook secret
   */
  generateWebhookSecret(): string {
    return crypto.randomBytes(32).toString("hex");
  }

  /**
   * Generate a random state token for OAuth
   */
  generateOAuthState(payload: { campgroundId: string; provider: string }): string {
    const data = {
      ...payload,
      timestamp: Date.now(),
      nonce: crypto.randomBytes(16).toString("hex"),
    };
    return Buffer.from(JSON.stringify(data)).toString("base64url");
  }

  /**
   * Parse and validate OAuth state token
   */
  parseOAuthState(
    state: string,
    maxAgeMs = 15 * 60 * 1000,
  ): {
    campgroundId: string;
    provider: string;
  } | null {
    try {
      const data = JSON.parse(Buffer.from(state, "base64url").toString("utf8"));
      if (!isRecord(data)) {
        return null;
      }
      const timestamp = typeof data.timestamp === "number" ? data.timestamp : null;
      const campgroundId = typeof data.campgroundId === "string" ? data.campgroundId : null;
      const provider = typeof data.provider === "string" ? data.provider : null;
      if (!timestamp || !campgroundId || !provider) {
        return null;
      }
      if (Date.now() - timestamp > maxAgeMs) {
        this.logger.warn("OAuth state expired");
        return null;
      }
      return { campgroundId, provider };
    } catch (error) {
      this.logger.error("Failed to parse OAuth state", getErrorMessage(error));
      return null;
    }
  }

  /**
   * Compute HMAC signature for webhook verification
   */
  computeHmacSignature(payload: string, secret: string): string {
    return crypto.createHmac("sha256", secret).update(payload).digest("hex");
  }

  /**
   * Verify HMAC signature (timing-safe comparison)
   */
  verifyHmacSignature(payload: string, secret: string, signature: string): boolean {
    const computed = this.computeHmacSignature(payload, secret);
    const signatureBuffer = Buffer.from(signature.replace(/^sha256=/, ""), "hex");
    const computedBuffer = Buffer.from(computed, "hex");

    if (signatureBuffer.length !== computedBuffer.length) {
      return false;
    }
    return crypto.timingSafeEqual(signatureBuffer, computedBuffer);
  }
}
