import { Injectable } from "@nestjs/common";
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
    private readonly algorithm = "aes-256-gcm";
    private readonly primaryKey: Buffer;
    private readonly keyVersion: string;

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
    ];

    constructor() {
        // Primary encryption key
        // In production: Load from KMS or secrets manager
        const keyString = process.env.PII_ENCRYPTION_KEY || process.env.JWT_SECRET || "";
        this.keyVersion = process.env.PII_ENCRYPTION_KEY_VERSION || "v1";

        if (keyString.length < 32 && process.env.NODE_ENV === "production") {
            console.error("[SECURITY] PII_ENCRYPTION_KEY must be at least 32 characters in production");
        }

        // Derive a proper 256-bit key using SHA-256
        this.primaryKey = createHash("sha256").update(keyString).digest();

        console.log(`[SECURITY] PII encryption initialized with key version: ${this.keyVersion}`);
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
            console.error("[SECURITY] PII encryption failed:", error);
            throw new Error("Encryption failed");
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

            // TODO: Support key rotation by version lookup
            if (version !== this.keyVersion) {
                console.warn(`[SECURITY] Encrypted with different key version: ${version}`);
            }

            const iv = Buffer.from(ivHex, "hex");
            const authTag = Buffer.from(authTagHex, "hex");

            const decipher = createDecipheriv(this.algorithm, this.primaryKey, iv);
            decipher.setAuthTag(authTag);

            let decrypted = decipher.update(ciphertext, "hex", "utf8");
            decrypted += decipher.final("utf8");

            return decrypted;
        } catch (error) {
            console.error("[SECURITY] PII decryption failed:", error);
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
            (f) => normalizedName === f.toLowerCase() || normalizedName.includes(f.toLowerCase())
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
    encryptObject<T extends Record<string, any>>(obj: T): T {
        const result = { ...obj };

        for (const [key, value] of Object.entries(result)) {
            if (this.shouldEncrypt(key) && typeof value === "string") {
                (result as any)[key] = this.encrypt(value);
            }
        }

        return result;
    }

    /**
     * Decrypt an object's fields based on field names
     */
    decryptObject<T extends Record<string, any>>(obj: T): T {
        const result = { ...obj };

        for (const [key, value] of Object.entries(result)) {
            if (this.shouldEncrypt(key) && typeof value === "string") {
                (result as any)[key] = this.decrypt(value);
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
     * Get service stats for monitoring
     */
    getStats(): {
        keyVersion: string;
        algorithmUsed: string;
        encryptedFieldCount: number;
    } {
        return {
            keyVersion: this.keyVersion,
            algorithmUsed: this.algorithm,
            encryptedFieldCount: this.encryptedFields.length,
        };
    }
}
