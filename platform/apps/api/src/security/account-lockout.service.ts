import { Injectable, UnauthorizedException, Logger, OnModuleDestroy } from "@nestjs/common";
import { RedisService } from "../redis/redis.service";

/**
 * Account Lockout Service
 *
 * Tracks failed login attempts and locks accounts temporarily
 * after too many failures to prevent brute force attacks.
 *
 * Default settings:
 * - Lock after 5 failed attempts
 * - Lock duration: 15 minutes
 * - Reset on successful login
 *
 * Storage: Redis (distributed) with in-memory fallback
 */
interface LockoutRecord {
  attempts: number;
  firstAttempt: number;
  lockedUntil: number | null;
  lastAttempt: number;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const isLockoutRecord = (value: unknown): value is LockoutRecord =>
  isRecord(value) &&
  typeof value.attempts === "number" &&
  typeof value.firstAttempt === "number" &&
  typeof value.lastAttempt === "number" &&
  (typeof value.lockedUntil === "number" || value.lockedUntil === null);

@Injectable()
export class AccountLockoutService implements OnModuleDestroy {
  private readonly logger = new Logger(AccountLockoutService.name);
  private readonly keyPrefix = "lockout:";

  // In-memory fallback when Redis unavailable
  private readonly memoryFallback = new Map<string, LockoutRecord>();

  // Configuration
  private readonly maxAttempts = parseInt(process.env.LOCKOUT_MAX_ATTEMPTS || "5", 10);
  private readonly lockDurationMs = parseInt(
    process.env.LOCKOUT_DURATION_MS || String(15 * 60 * 1000),
    10,
  ); // 15 minutes
  private readonly attemptWindowMs = parseInt(
    process.env.LOCKOUT_WINDOW_MS || String(60 * 60 * 1000),
    10,
  ); // 1 hour
  private readonly maxMapSize = parseInt(process.env.LOCKOUT_MAX_ENTRIES || "10000", 10);

  // Cleanup interval (every 5 minutes) - only for memory fallback
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor(private readonly redis: RedisService) {
    // Start cleanup interval for memory fallback
    this.cleanupInterval = setInterval(() => this.cleanupMemory(), 5 * 60 * 1000);
    this.cleanupInterval.unref?.();
    const mode = this.redis.isEnabled ? "Redis" : "in-memory fallback";
    this.logger.log(
      `Account lockout enabled (${mode}): ${this.maxAttempts} attempts, ${this.lockDurationMs / 1000}s lock`,
    );
  }

  private redisKey(identifier: string): string {
    return `${this.keyPrefix}${identifier.toLowerCase()}`;
  }

  private async getRecord(identifier: string): Promise<LockoutRecord | null> {
    const client = this.redis.getClient();
    if (client) {
      const data = await client.get(this.redisKey(identifier));
      if (data) {
        try {
          const parsed: unknown = JSON.parse(data);
          return isLockoutRecord(parsed) ? parsed : null;
        } catch {
          return null;
        }
      }
      return null;
    }
    // Fallback to memory
    return this.memoryFallback.get(identifier.toLowerCase()) || null;
  }

  private async setRecord(identifier: string, record: LockoutRecord): Promise<void> {
    const client = this.redis.getClient();
    const ttlSeconds = Math.ceil(Math.max(this.attemptWindowMs, this.lockDurationMs) / 1000) + 60;

    if (client) {
      await client.setex(this.redisKey(identifier), ttlSeconds, JSON.stringify(record));
    } else {
      // Fallback to memory
      this.memoryFallback.set(identifier.toLowerCase(), record);
    }
  }

  private async deleteRecord(identifier: string): Promise<void> {
    const client = this.redis.getClient();
    if (client) {
      await client.del(this.redisKey(identifier));
    } else {
      this.memoryFallback.delete(identifier.toLowerCase());
    }
  }

  /**
   * Check if an account/IP is currently locked
   * @param identifier Email address or IP address
   * @returns Whether the account is locked
   */
  async isLocked(identifier: string): Promise<boolean> {
    const record = await this.getRecord(identifier);

    if (!record || !record.lockedUntil) {
      return false;
    }

    const now = Date.now();

    // Check if lock has expired
    if (record.lockedUntil <= now) {
      // Lock expired, remove it
      await this.deleteRecord(identifier);
      return false;
    }

    return true;
  }

  /**
   * Get remaining lockout time in seconds
   */
  async getRemainingLockoutTime(identifier: string): Promise<number> {
    const record = await this.getRecord(identifier);

    if (!record || !record.lockedUntil) {
      return 0;
    }

    const remaining = Math.max(0, record.lockedUntil - Date.now());
    return Math.ceil(remaining / 1000);
  }

  /**
   * Record a failed login attempt
   * @param identifier Email address or IP address
   * @returns Whether the account is now locked
   */
  async recordFailedAttempt(
    identifier: string,
  ): Promise<{ locked: boolean; attemptsRemaining: number; lockDuration?: number }> {
    const now = Date.now();

    let record = await this.getRecord(identifier);

    // Check if we need to start fresh
    if (!record || now - record.firstAttempt > this.attemptWindowMs) {
      record = {
        attempts: 0,
        firstAttempt: now,
        lockedUntil: null,
        lastAttempt: now,
      };
    }

    // If already locked, return locked status
    if (record.lockedUntil && record.lockedUntil > now) {
      return {
        locked: true,
        attemptsRemaining: 0,
        lockDuration: await this.getRemainingLockoutTime(identifier),
      };
    }

    // Increment attempts
    record.attempts++;
    record.lastAttempt = now;

    // Check if we should lock
    if (record.attempts >= this.maxAttempts) {
      record.lockedUntil = now + this.lockDurationMs;
      await this.setRecord(identifier, record);

      this.logger.log(
        `Account locked: ${this.maskIdentifier(identifier)} for ${this.lockDurationMs / 1000}s after ${record.attempts} failed attempts`,
      );

      return {
        locked: true,
        attemptsRemaining: 0,
        lockDuration: Math.ceil(this.lockDurationMs / 1000),
      };
    }

    await this.setRecord(identifier, record);

    return {
      locked: false,
      attemptsRemaining: this.maxAttempts - record.attempts,
    };
  }

  /**
   * Record a successful login - resets the lockout counter
   * @param identifier Email address or IP address
   */
  async recordSuccessfulLogin(identifier: string): Promise<void> {
    await this.deleteRecord(identifier);
  }

  /**
   * Check login and throw if locked
   * @param identifier Email address or IP address
   * @throws UnauthorizedException if account is locked
   */
  async checkAndThrowIfLocked(identifier: string): Promise<void> {
    if (await this.isLocked(identifier)) {
      const remaining = await this.getRemainingLockoutTime(identifier);
      throw new UnauthorizedException(
        `Account temporarily locked due to too many failed attempts. Try again in ${remaining} seconds.`,
      );
    }
  }

  /**
   * Handle a failed login and return lock status
   * @param identifier Email address or IP address
   * @returns Lock status with attempt count
   */
  async handleFailedLogin(
    identifier: string,
  ): Promise<{ locked: boolean; attempts: number; lockDuration?: number }> {
    const result = await this.recordFailedAttempt(identifier);
    const record = await this.getRecord(identifier);

    return {
      locked: result.locked,
      attempts: record?.attempts || 1,
      lockDuration: result.lockDuration,
    };
  }

  /**
   * Handle a failed login and throw if now locked
   * @param identifier Email address or IP address
   * @throws UnauthorizedException with remaining attempts info
   */
  async handleFailedLoginAndThrow(identifier: string): Promise<void> {
    const result = await this.recordFailedAttempt(identifier);

    if (result.locked) {
      throw new UnauthorizedException(
        `Account locked due to too many failed attempts. Try again in ${result.lockDuration} seconds.`,
      );
    }
  }

  /**
   * Get attempt statistics for an identifier
   */
  async getAttemptInfo(identifier: string): Promise<{
    attempts: number;
    remaining: number;
    locked: boolean;
    lockExpiresIn?: number;
  }> {
    const record = await this.getRecord(identifier);

    if (!record) {
      return {
        attempts: 0,
        remaining: this.maxAttempts,
        locked: false,
      };
    }

    const now = Date.now();
    const locked = record.lockedUntil !== null && record.lockedUntil > now;

    return {
      attempts: record.attempts,
      remaining: Math.max(0, this.maxAttempts - record.attempts),
      locked,
      lockExpiresIn: locked ? Math.ceil((record.lockedUntil! - now) / 1000) : undefined,
    };
  }

  /**
   * Manually unlock an account (admin function)
   */
  async unlockAccount(identifier: string): Promise<boolean> {
    const record = await this.getRecord(identifier);

    if (record) {
      await this.deleteRecord(identifier);
      this.logger.log(`Account manually unlocked: ${this.maskIdentifier(identifier)}`);
      return true;
    }

    return false;
  }

  /**
   * Mask identifier for logging (privacy)
   */
  private maskIdentifier(identifier: string): string {
    if (identifier.includes("@")) {
      // Email
      const [local, domain] = identifier.split("@");
      return `${local.substring(0, 2)}***@${domain}`;
    }
    // IP address
    const parts = identifier.split(".");
    if (parts.length === 4) {
      return `${parts[0]}.${parts[1]}.***.***`;
    }
    return `${identifier.substring(0, 4)}***`;
  }

  /**
   * Cleanup expired records in memory fallback to prevent memory leaks
   * Note: Redis handles TTL automatically, so this only cleans the memory fallback
   */
  private cleanupMemory(): void {
    // Only needed when using memory fallback
    if (this.redis.isEnabled) return;

    const now = Date.now();
    let cleaned = 0;

    for (const [key, record] of this.memoryFallback.entries()) {
      // Remove if:
      // 1. Lock has expired and attempts window has passed
      // 2. No lock and attempts window has passed
      const windowExpired = now - record.firstAttempt > this.attemptWindowMs;
      const lockExpired = !record.lockedUntil || record.lockedUntil <= now;

      if (windowExpired && lockExpired) {
        this.memoryFallback.delete(key);
        cleaned++;
      }
    }

    // Hard limit: if still over max size, remove oldest entries
    if (this.memoryFallback.size > this.maxMapSize) {
      const entriesToRemove = this.memoryFallback.size - this.maxMapSize;
      const keys = Array.from(this.memoryFallback.keys()).slice(0, entriesToRemove);
      for (const key of keys) {
        this.memoryFallback.delete(key);
        cleaned++;
      }
      this.logger.warn(
        `Memory fallback size exceeded ${this.maxMapSize}, removed ${entriesToRemove} oldest entries`,
      );
    }

    if (cleaned > 0) {
      this.logger.log(`Cleaned up ${cleaned} expired lockout records from memory fallback`);
    }
  }

  /**
   * Get current stats for monitoring
   * Note: When using Redis, this only shows memory fallback stats
   */
  getStats(): { trackedAccounts: number; lockedAccounts: number; storageMode: string } {
    const now = Date.now();
    let lockedCount = 0;

    for (const record of this.memoryFallback.values()) {
      if (record.lockedUntil && record.lockedUntil > now) {
        lockedCount++;
      }
    }

    return {
      trackedAccounts: this.memoryFallback.size,
      lockedAccounts: lockedCount,
      storageMode: this.redis.isEnabled ? "redis" : "memory",
    };
  }

  onModuleDestroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }
}
