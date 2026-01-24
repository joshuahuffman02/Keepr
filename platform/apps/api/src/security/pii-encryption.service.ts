import {
  Injectable,
  InternalServerErrorException,
  BadRequestException,
  Logger,
} from "@nestjs/common";
import { createCipheriv, createDecipheriv, randomBytes, createHash } from "crypto";

/**
 * PII (Personally Identifiable Information) Encryption Service
 *
 * Provides column-level encryption for sensitive data fields.
 * Uses AES-256-GCM for authenticated encryption.
 *
 * Key Management:
 * - In production, use a KMS (AWS KMS, GCP KMS, HashiCorp Vault)
 * - Keys should be rotated periodically
 * - Keep encryption keys separate from encrypted data
 *
 * Usage in Prisma:
 * - Create middleware to auto-encrypt/decrypt fields
 * - Or use manual encryption in services
 */
@Injectable()
export class PiiEncryptionService {
  private readonly logger = new Logger(PiiEncryptionService.name);
  private readonly algorithm = "aes-256-gcm";
  private readonly primaryKey: Buffer;
  private readonly keyVersion: string;
  private readonly keyStore: Map<string, Buffer> = new Map();

  // Fields that should be encrypted
  private readonly encryptedFields = [
    "phone",
    "phoneNumber",
    "ssn",
    "socialSecurityNumber",
    "taxId",
    "driversLicense",
    "licenseNumber",
    "dateOfBirth",
    "bankAccount",
    "routingNumber",
    // API keys and secrets
    "aiApiKey",
    "apiKey",
    "apiSecret",
    "webhookSecret",
  ];

  constructor() {
    // Primary encryption key
    // In production: Load from KMS or secrets manager
    const keyString = process.env.PII_ENCRYPTION_KEY || process.env.JWT_SECRET || "";
    this.keyVersion = process.env.PII_ENCRYPTION_KEY_VERSION || "v1";

    if (keyString.length < 32 && process.env.NODE_ENV === "production") {
      this.logger.error("PII_ENCRYPTION_KEY must be at least 32 characters in production");
    }

    // Derive a proper 256-bit key using SHA-256
    this.primaryKey = createHash("sha256").update(keyString).digest();

    // Store primary key in key store
    this.keyStore.set(this.keyVersion, this.primaryKey);

    // Load historical keys for rotation support
    // Format: PII_ENCRYPTION_KEY_V1, PII_ENCRYPTION_KEY_V2, etc.
    this.loadHistoricalKeys();

    this.logger.log(
      `PII encryption initialized with key version: ${this.keyVersion}, ${this.keyStore.size} key(s) loaded`,
    );
  }

  /**
   * Load historical encryption keys from environment variables
   * This allows decryption of data encrypted with older keys during rotation
   */
  private loadHistoricalKeys(): void {
    // Check for versioned keys (v1, v2, v3, etc.)
    for (let i = 1; i <= 10; i++) {
      const version = `v${i}`;
      const keyEnvVar = `PII_ENCRYPTION_KEY_V${i}`;
      const keyString = process.env[keyEnvVar];

      if (keyString && !this.keyStore.has(version)) {
        const key = createHash("sha256").update(keyString).digest();
        this.keyStore.set(version, key);
      }
    }
  }

  /**
   * Get the encryption key for a specific version
   */
  private getKeyForVersion(version: string): Buffer | null {
    return this.keyStore.get(version) || null;
  }

  /**
   * Encrypt a plaintext value
   *
   * @param plaintext The value to encrypt
   * @returns Encrypted value with IV and auth tag (format: version:iv:authTag:ciphertext)
   */
  encrypt(plaintext: string | null | undefined): string | null {
    if (plaintext === null || plaintext === undefined || plaintext === "") {
      return null;
    }

    try {
      const iv = randomBytes(16);
      const cipher = createCipheriv(this.algorithm, this.primaryKey, iv);

      let encrypted = cipher.update(plaintext, "utf8", "hex");
      encrypted += cipher.final("hex");

      const authTag = cipher.getAuthTag();

      // Format: keyVersion:iv:authTag:ciphertext
      return `${this.keyVersion}:${iv.toString("hex")}:${authTag.toString("hex")}:${encrypted}`;
    } catch (error) {
      this.logger.error("PII encryption failed:", error instanceof Error ? error.stack : error);
      throw new InternalServerErrorException("Encryption failed");
    }
  }

  /**
   * Decrypt an encrypted value
   *
   * @param encrypted The encrypted value
   * @returns Decrypted plaintext
   */
  decrypt(encrypted: string | null | undefined): string | null {
    if (encrypted === null || encrypted === undefined || encrypted === "") {
      return null;
    }

    // Check if the value is actually encrypted (has our format)
    if (!encrypted.includes(":")) {
      // Not encrypted, return as-is (for migration purposes)
      return encrypted;
    }

    try {
      const parts = encrypted.split(":");
      if (parts.length !== 4) {
        // Invalid format, return as-is
        return encrypted;
      }

      const [version, ivHex, authTagHex, ciphertext] = parts;

      // Get the appropriate key for this version
      const decryptionKey = this.getKeyForVersion(version);
      if (!decryptionKey) {
        this.logger.error(
          `No key found for version: ${version}. Available versions: ${Array.from(this.keyStore.keys()).join(", ")}`,
        );
        throw new BadRequestException(`Encryption key not found for version: ${version}`);
      }

      if (version !== this.keyVersion) {
        this.logger.log(
          `Decrypting data from older key version: ${version} (current: ${this.keyVersion})`,
        );
      }

      const iv = Buffer.from(ivHex, "hex");
      const authTag = Buffer.from(authTagHex, "hex");

      const decipher = createDecipheriv(this.algorithm, decryptionKey, iv);
      decipher.setAuthTag(authTag);

      let decrypted = decipher.update(ciphertext, "hex", "utf8");
      decrypted += decipher.final("utf8");

      return decrypted;
    } catch (error) {
      this.logger.error("PII decryption failed:", error instanceof Error ? error.stack : error);
      // Return original value if decryption fails (might not be encrypted)
      return encrypted;
    }
  }

  /**
   * Check if a field name should be encrypted
   */
  shouldEncrypt(fieldName: string): boolean {
    const normalizedName = fieldName.toLowerCase();
    return this.encryptedFields.some(
      (f) => normalizedName === f.toLowerCase() || normalizedName.includes(f.toLowerCase()),
    );
  }

  /**
   * Mask a value for display (e.g., show last 4 digits)
   */
  mask(value: string | null | undefined, visibleChars = 4): string {
    if (!value) return "";

    if (value.length <= visibleChars) {
      return "*".repeat(value.length);
    }

    const masked = "*".repeat(value.length - visibleChars);
    const visible = value.slice(-visibleChars);
    return masked + visible;
  }

  /**
   * Hash a value for searching (allows equality checks on encrypted data)
   * Note: This reveals if two values are the same
   */
  hash(value: string | null | undefined): string | null {
    if (!value) return null;

    return createHash("sha256")
      .update(value + this.primaryKey.toString("hex"))
      .digest("hex");
  }

  /**
   * Encrypt an object's fields based on field names
   */
  encryptObject(obj: Record<string, unknown>): Record<string, unknown> {
    const result: Record<string, unknown> = { ...obj };

    for (const [key, value] of Object.entries(result)) {
      if (this.shouldEncrypt(key) && typeof value === "string") {
        result[key] = this.encrypt(value);
      }
    }

    return result;
  }

  /**
   * Decrypt an object's fields based on field names
   */
  decryptObject(obj: Record<string, unknown>): Record<string, unknown> {
    const result: Record<string, unknown> = { ...obj };

    for (const [key, value] of Object.entries(result)) {
      if (this.shouldEncrypt(key) && typeof value === "string") {
        result[key] = this.decrypt(value);
      }
    }

    return result;
  }

  /**
   * Create a deterministic hash for a value (for searchable encryption)
   * WARNING: This allows frequency analysis attacks
   */
  createSearchableHash(value: string, salt: string = ""): string {
    return createHash("sha256")
      .update(value.toLowerCase().trim() + salt + this.keyVersion)
      .digest("hex");
  }

  /**
   * Re-encrypt a value with the current key version
   * Useful for key rotation - decrypt with old key, encrypt with new key
   */
  reEncrypt(encrypted: string | null | undefined): string | null {
    if (!encrypted) return null;

    // Check if it's encrypted and get the version
    if (!encrypted.includes(":")) {
      // Not encrypted yet, encrypt with current key
      return this.encrypt(encrypted);
    }

    const parts = encrypted.split(":");
    if (parts.length !== 4) {
      // Invalid format, try to encrypt as-is
      return this.encrypt(encrypted);
    }

    const [version] = parts;

    // If already using current version, no re-encryption needed
    if (version === this.keyVersion) {
      return encrypted;
    }

    // Decrypt with old key, encrypt with new key
    const decrypted = this.decrypt(encrypted);
    if (decrypted === encrypted) {
      // Decryption failed, return original
      return encrypted;
    }

    return this.encrypt(decrypted);
  }

  /**
   * Check if a value needs re-encryption (encrypted with an old key)
   */
  needsReEncryption(encrypted: string | null | undefined): boolean {
    if (!encrypted || !encrypted.includes(":")) return false;

    const parts = encrypted.split(":");
    if (parts.length !== 4) return false;

    const [version] = parts;
    return version !== this.keyVersion;
  }

  /**
   * Get service stats for monitoring
   */
  getStats(): {
    keyVersion: string;
    algorithmUsed: string;
    encryptedFieldCount: number;
    availableKeyVersions: string[];
  } {
    return {
      keyVersion: this.keyVersion,
      algorithmUsed: this.algorithm,
      encryptedFieldCount: this.encryptedFields.length,
      availableKeyVersions: Array.from(this.keyStore.keys()),
    };
  }
}
