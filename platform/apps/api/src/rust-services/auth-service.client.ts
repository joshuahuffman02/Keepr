import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

/**
 * Types for Auth Service Rust service
 */
export interface HashPasswordResponse {
  hash: string;
}

export interface VerifyPasswordResponse {
  valid: boolean;
}

export interface JwtClaims {
  sub: string;
  email: string;
  iat: number;
  exp: number;
  token_type?: string;
}

export interface CreateJwtResponse {
  token: string;
  expires_at: number;
}

export interface ValidateJwtResponse {
  valid: boolean;
  claims?: JwtClaims;
  error?: string;
}

export interface GenerateTotpResponse {
  secret: string;
  otpauth_url: string;
  backup_codes: string[];
  backup_codes_hashed: string[];
}

export interface VerifyTotpResponse {
  valid: boolean;
}

export interface VerifyBackupCodeResponse {
  valid: boolean;
  used_index?: number;
}

export interface EncryptResponse {
  ciphertext: string;
}

export interface DecryptResponse {
  plaintext: string;
  key_version: string;
  needs_reencrypt: boolean;
}

export interface CheckLockoutResponse {
  is_locked: boolean;
  locked_until?: number;
  attempts: number;
  time_remaining_seconds?: number;
}

export interface RecordAttemptResponse {
  is_locked: boolean;
  remaining_attempts?: number;
  locked_until?: number;
}

/**
 * Client for Auth Service Rust service.
 *
 * Handles password hashing, JWT tokens, TOTP/2FA, encryption, and lockout.
 */
@Injectable()
export class AuthServiceClient implements OnModuleInit {
  private readonly logger = new Logger(AuthServiceClient.name);
  private baseUrl: string;

  constructor(private readonly configService: ConfigService) {
    this.baseUrl = this.configService.get("AUTH_SERVICE_URL") || "http://localhost:8082";
  }

  async onModuleInit() {
    try {
      const healthy = await this.healthCheck();
      if (healthy) {
        this.logger.log(`Auth Service available at ${this.baseUrl}`);
      }
    } catch {
      this.logger.warn(
        `Auth Service not available at ${this.baseUrl}. ` + `Using fallback implementation.`,
      );
    }
  }

  /**
   * Check if the auth service is healthy.
   */
  async healthCheck(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/health`);
      const data = await response.json();
      return data.status === "ok";
    } catch {
      return false;
    }
  }

  // ============================================================================
  // Password Operations
  // ============================================================================

  /**
   * Hash a password using bcrypt.
   */
  async hashPassword(password: string, cost?: number): Promise<string> {
    const response = await fetch(`${this.baseUrl}/api/auth/hash-password`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password, cost }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || "Failed to hash password");
    }

    const result: HashPasswordResponse = await response.json();
    return result.hash;
  }

  /**
   * Verify a password against a bcrypt hash.
   */
  async verifyPassword(password: string, hash: string): Promise<boolean> {
    const response = await fetch(`${this.baseUrl}/api/auth/verify-password`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password, hash }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || "Failed to verify password");
    }

    const result: VerifyPasswordResponse = await response.json();
    return result.valid;
  }

  // ============================================================================
  // JWT Operations
  // ============================================================================

  /**
   * Create a JWT token.
   */
  async createJwt(
    userId: string,
    email: string,
    ttlSeconds?: number,
    tokenType?: string,
  ): Promise<CreateJwtResponse> {
    const response = await fetch(`${this.baseUrl}/api/auth/create-jwt`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        user_id: userId,
        email,
        ttl_seconds: ttlSeconds,
        token_type: tokenType,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || "Failed to create JWT");
    }

    return response.json();
  }

  /**
   * Validate a JWT token.
   */
  async validateJwt(token: string): Promise<ValidateJwtResponse> {
    const response = await fetch(`${this.baseUrl}/api/auth/validate-jwt`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || "Failed to validate JWT");
    }

    return response.json();
  }

  // ============================================================================
  // TOTP/2FA Operations
  // ============================================================================

  /**
   * Generate TOTP setup (secret, QR URL, backup codes).
   */
  async generateTotp(email: string): Promise<GenerateTotpResponse> {
    const response = await fetch(`${this.baseUrl}/api/auth/totp/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || "Failed to generate TOTP");
    }

    return response.json();
  }

  /**
   * Verify a TOTP code.
   */
  async verifyTotp(code: string, secret: string): Promise<boolean> {
    const response = await fetch(`${this.baseUrl}/api/auth/totp/verify`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code, secret }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || "Failed to verify TOTP");
    }

    const result: VerifyTotpResponse = await response.json();
    return result.valid;
  }

  /**
   * Verify a backup code.
   */
  async verifyBackupCode(code: string, hashedCodes: string[]): Promise<VerifyBackupCodeResponse> {
    const response = await fetch(`${this.baseUrl}/api/auth/totp/verify-backup`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code, hashed_codes: hashedCodes }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || "Failed to verify backup code");
    }

    return response.json();
  }

  // ============================================================================
  // Encryption Operations (PII)
  // ============================================================================

  /**
   * Encrypt sensitive data.
   */
  async encrypt(plaintext: string, keyVersion?: string): Promise<string> {
    const response = await fetch(`${this.baseUrl}/api/auth/encrypt`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ plaintext, key_version: keyVersion }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || "Failed to encrypt");
    }

    const result: EncryptResponse = await response.json();
    return result.ciphertext;
  }

  /**
   * Decrypt sensitive data.
   */
  async decrypt(ciphertext: string): Promise<DecryptResponse> {
    const response = await fetch(`${this.baseUrl}/api/auth/decrypt`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ciphertext }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || "Failed to decrypt");
    }

    return response.json();
  }

  // ============================================================================
  // Account Lockout Operations
  // ============================================================================

  /**
   * Check if an account is locked.
   */
  async checkLockout(email: string): Promise<CheckLockoutResponse> {
    const response = await fetch(`${this.baseUrl}/api/auth/lockout/check`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || "Failed to check lockout");
    }

    return response.json();
  }

  /**
   * Record a login attempt (success or failure).
   */
  async recordAttempt(email: string, success: boolean): Promise<RecordAttemptResponse> {
    const response = await fetch(`${this.baseUrl}/api/auth/lockout/record`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, success }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || "Failed to record attempt");
    }

    return response.json();
  }
}
