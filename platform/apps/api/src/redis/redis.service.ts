import { Injectable, OnModuleDestroy, Logger } from "@nestjs/common";
import Redis from "ioredis";

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

@Injectable()
export class RedisService implements OnModuleDestroy {
  private client: Redis | null;
  private readonly logger = new Logger(RedisService.name);
  private connectionFailed = false;

  constructor() {
    const url = process.env.PLATFORM_REDIS_URL || process.env.REDIS_URL;
    const urlSource = process.env.PLATFORM_REDIS_URL ? "PLATFORM_REDIS_URL" : process.env.REDIS_URL ? "REDIS_URL" : null;

    if (!url) {
      this.client = null;
      this.logger.warn("Redis is not configured (PLATFORM_REDIS_URL/REDIS_URL not set)");
      return;
    }

    // Create Redis client with limited retries to avoid log spam
    this.client = new Redis(url, {
      maxRetriesPerRequest: 1,
      retryStrategy: (times) => {
        if (times > 3) {
          // Stop retrying after 3 attempts
          if (!this.connectionFailed) {
            this.logger.warn("Redis connection failed after 3 attempts, disabling Redis");
          }
          this.connectionFailed = true;
          return null; // Stop retrying
        }
        return Math.min(times * 500, 2000); // Retry with backoff
      },
      enableOfflineQueue: false, // Don't queue commands when disconnected
    });

    this.client.on("connect", () => this.logger.log(`Redis connected (${urlSource ?? "custom"})`));
    this.client.on("error", (err) => {
      // Only log error once to avoid spam
      if (!this.connectionFailed) {
        const errorCode = isRecord(err) && typeof err.code === "string" ? err.code : undefined;
        this.logger.error("Redis error", { code: errorCode });
        if (errorCode === "ECONNREFUSED") {
          this.connectionFailed = true;
          this.logger.warn("Redis unavailable, features requiring Redis will be disabled");
        }
      }
    });
  }

  get isEnabled() {
    return !!this.client && !this.connectionFailed;
  }

  /**
   * Expose the underlying client for helper services (locks, queues).
   * Returns null when Redis is not configured so callers can noop gracefully.
   */
  getClient() {
    return this.isEnabled ? this.client : null;
  }

  async ping(): Promise<string | null> {
    if (!this.isEnabled) return null;
    return this.client!.ping();
  }

  /**
   * Get a value from cache
   */
  async get(key: string): Promise<unknown | null> {
    if (!this.isEnabled) return null;
    const value = await this.client!.get(key);
    if (!value) return null;
    try {
      const parsed: unknown = JSON.parse(value);
      return parsed;
    } catch {
      return value;
    }
  }

  /**
   * Set a value in cache with optional TTL (in seconds)
   */
  async set(key: string, value: unknown, ttl?: number): Promise<void> {
    if (!this.isEnabled) return;
    const serialized = typeof value === "string" ? value : JSON.stringify(value);
    if (ttl) {
      await this.client!.setex(key, ttl, serialized);
    } else {
      await this.client!.set(key, serialized);
    }
  }

  /**
   * Delete a key from cache
   */
  async del(key: string): Promise<void> {
    if (!this.isEnabled) return;
    await this.client!.del(key);
  }

  /**
   * Delete multiple keys matching a pattern
   */
  async delPattern(pattern: string): Promise<void> {
    if (!this.isEnabled) return;
    const keys = await this.client!.keys(pattern);
    if (keys.length > 0) {
      await this.client!.del(...keys);
    }
  }

  /**
   * Check if a key exists
   */
  async exists(key: string): Promise<boolean> {
    if (!this.isEnabled) return false;
    const result = await this.client!.exists(key);
    return result === 1;
  }

  /**
   * Set expiration time on a key (in seconds)
   */
  async expire(key: string, ttl: number): Promise<void> {
    if (!this.isEnabled) return;
    await this.client!.expire(key, ttl);
  }

  /**
   * Increment a counter
   */
  async incr(key: string): Promise<number | null> {
    if (!this.isEnabled) return null;
    return this.client!.incr(key);
  }

  /**
   * Decrement a counter
   */
  async decr(key: string): Promise<number | null> {
    if (!this.isEnabled) return null;
    return this.client!.decr(key);
  }

  async onModuleDestroy() {
    if (!this.client) return;
    try {
      if (this.client.status === "ready") {
        await this.client.quit();
      } else {
        this.client.disconnect();
      }
      this.logger.log("Redis connection closed");
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(`Redis connection close failed: ${message}`);
    }
  }
}
