import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { z } from "zod";
import { getRequestHeaders } from "../common/request-context";

/**
 * Rust Auth Client Service
 *
 * HTTP client that delegates security-critical operations to the
 * Rust auth-service-rs for improved performance and type safety.
 *
 * Operations delegated to Rust:
 * - Password hashing (bcrypt - CPU intensive)
 * - Password verification
 *
 * Operations kept in NestJS:
 * - JWT (JwtService is already optimized)
 * - TOTP (needs QR codes, database storage)
 * - Account lockout (needs Redis for distributed state)
 */

// Zod schemas for response validation
const HashPasswordResponseSchema = z.object({
  hash: z.string(),
});

const VerifyPasswordResponseSchema = z.object({
  valid: z.boolean(),
});

const HealthResponseSchema = z.object({
  status: z.string(),
  service: z.string(),
  version: z.string(),
});

@Injectable()
export class RustAuthClientService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RustAuthClientService.name);
  private readonly baseUrl: string;
  private readonly timeout: number;
  private isHealthy = false;
  private fallbackToLocal = false;
  private healthCheckTimeout: NodeJS.Timeout | null = null;

  constructor(private readonly config: ConfigService) {
    this.baseUrl = this.config.get<string>("RUST_AUTH_SERVICE_URL", "http://localhost:8082");
    this.timeout = this.config.get<number>("RUST_AUTH_TIMEOUT_MS", 5000);
  }

  async onModuleInit(): Promise<void> {
    await this.checkHealth();
  }

  onModuleDestroy(): void {
    if (this.healthCheckTimeout) {
      clearTimeout(this.healthCheckTimeout);
      this.healthCheckTimeout = null;
    }
    this.healthCheckScheduled = false;
  }

  /**
   * Check if the Rust auth service is available
   */
  async checkHealth(): Promise<boolean> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 2000);

      const response = await fetch(`${this.baseUrl}/health`, {
        headers: getRequestHeaders(),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (response.ok) {
        const json: unknown = await response.json();
        const data = HealthResponseSchema.parse(json);
        this.isHealthy = data.status === "ok";
        this.fallbackToLocal = false;
        this.logger.log(`Rust auth service connected: ${data.service} v${data.version}`);
        return true;
      }
    } catch (error) {
      this.isHealthy = false;
      this.fallbackToLocal = true;
      this.logger.warn(`Rust auth service unavailable at ${this.baseUrl}, using local fallback`);
    }
    return false;
  }

  /**
   * Hash a password using Rust bcrypt implementation
   * Falls back to local bcrypt if Rust service unavailable
   */
  async hashPassword(password: string, cost?: number): Promise<string> {
    if (this.fallbackToLocal) {
      return this.localHashPassword(password, cost);
    }

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.timeout);

      const response = await fetch(`${this.baseUrl}/api/auth/hash-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getRequestHeaders() },
        body: JSON.stringify({ password, cost }),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`Hash failed: ${response.status}`);
      }

      const json: unknown = await response.json();
      const data = HashPasswordResponseSchema.parse(json);
      return data.hash;
    } catch (error) {
      this.logger.warn(
        "Rust hash failed, using local fallback",
        error instanceof Error ? error.message : error,
      );
      this.scheduleHealthCheck();
      return this.localHashPassword(password, cost);
    }
  }

  /**
   * Verify a password against a hash using Rust bcrypt implementation
   * Falls back to local bcrypt if Rust service unavailable
   */
  async verifyPassword(password: string, hash: string): Promise<boolean> {
    if (this.fallbackToLocal) {
      return this.localVerifyPassword(password, hash);
    }

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.timeout);

      const response = await fetch(`${this.baseUrl}/api/auth/verify-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getRequestHeaders() },
        body: JSON.stringify({ password, hash }),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`Verify failed: ${response.status}`);
      }

      const json: unknown = await response.json();
      const data = VerifyPasswordResponseSchema.parse(json);
      return data.valid;
    } catch (error) {
      this.logger.warn(
        "Rust verify failed, using local fallback",
        error instanceof Error ? error.message : error,
      );
      this.scheduleHealthCheck();
      return this.localVerifyPassword(password, hash);
    }
  }

  /**
   * Check if the Rust service is currently healthy
   */
  get healthy(): boolean {
    return this.isHealthy;
  }

  /**
   * Check if we're using local fallback
   */
  get usingFallback(): boolean {
    return this.fallbackToLocal;
  }

  // --- Local fallback implementations ---

  private async localHashPassword(password: string, cost = 12): Promise<string> {
    const bcrypt = await import("bcryptjs");
    return bcrypt.hash(password, cost);
  }

  private async localVerifyPassword(password: string, hash: string): Promise<boolean> {
    const bcrypt = await import("bcryptjs");
    return bcrypt.compare(password, hash);
  }

  // --- Health check scheduling ---

  private healthCheckScheduled = false;

  private scheduleHealthCheck(): void {
    if (this.healthCheckScheduled) return;
    this.healthCheckScheduled = true;

    // Retry health check after 30 seconds
    this.healthCheckTimeout = setTimeout(async () => {
      this.healthCheckScheduled = false;
      const healthy = await this.checkHealth();
      if (healthy) {
        this.fallbackToLocal = false;
        this.logger.log("Rust auth service recovered, resuming Rust operations");
      }
    }, 30000);
    this.healthCheckTimeout.unref();
  }
}
