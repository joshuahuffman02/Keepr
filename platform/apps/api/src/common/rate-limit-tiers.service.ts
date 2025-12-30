import { Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

/**
 * Rate limit tier definitions
 */
export enum RateLimitTier {
  FREE = "free",
  STANDARD = "standard",
  ENTERPRISE = "enterprise",
}

export interface TierConfig {
  requestsPerHour: number;
  burstLimit: number; // Max requests in a 1-minute window
  dailyLimit: number; // Max requests per day
  concurrentLimit: number; // Max concurrent requests
}

export const TIER_CONFIGS: Record<RateLimitTier, TierConfig> = {
  [RateLimitTier.FREE]: {
    requestsPerHour: 100,
    burstLimit: 20,
    dailyLimit: 1000,
    concurrentLimit: 2,
  },
  [RateLimitTier.STANDARD]: {
    requestsPerHour: 1000,
    burstLimit: 100,
    dailyLimit: 10000,
    concurrentLimit: 10,
  },
  [RateLimitTier.ENTERPRISE]: {
    requestsPerHour: 10000,
    burstLimit: 500,
    dailyLimit: 100000,
    concurrentLimit: 50,
  },
};

export interface RateLimitResult {
  allowed: boolean;
  limit: number;
  remaining: number;
  resetAt: Date;
  retryAfter?: number; // seconds until retry
  tier: RateLimitTier;
  reason?: "hourly" | "burst" | "daily" | "concurrent";
}

interface UsageBucket {
  hourlyCount: number;
  hourlyResetAt: number;
  minuteCount: number;
  minuteResetAt: number;
  dailyCount: number;
  dailyResetAt: number;
  concurrent: number;
}

/**
 * Rate Limiting Service with Tier Support
 *
 * Features:
 * - Tier-based limits (free, standard, enterprise)
 * - Hourly, burst (per-minute), and daily limits
 * - Concurrent request limiting
 * - Standard rate limit headers
 * - Usage tracking per API client
 */
@Injectable()
export class RateLimitTiersService {
  private readonly logger = new Logger(RateLimitTiersService.name);
  private readonly usageMap = new Map<string, UsageBucket>();
  private readonly maxMapSize = 10000;
  private lastCleanup = Date.now();
  private readonly cleanupIntervalMs = 60_000;

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Check if a request is allowed based on the API client's tier
   */
  async checkLimit(apiClientId: string): Promise<RateLimitResult> {
    const now = Date.now();

    // Periodic cleanup
    if (now - this.lastCleanup > this.cleanupIntervalMs) {
      this.cleanup(now);
      this.lastCleanup = now;
    }

    // Get client tier
    const client = await this.prisma.apiClient.findUnique({
      where: { id: apiClientId },
      select: { tier: true, rateLimit: true },
    });

    const tier = (client?.tier as RateLimitTier) || RateLimitTier.FREE;
    const config = TIER_CONFIGS[tier];

    // Use custom rate limit if set, otherwise use tier default
    const hourlyLimit = client?.rateLimit || config.requestsPerHour;

    // Get or initialize usage bucket
    let bucket = this.usageMap.get(apiClientId);
    if (!bucket) {
      bucket = this.createBucket(now);
      this.usageMap.set(apiClientId, bucket);
    }

    // Reset buckets if windows have expired
    bucket = this.resetExpiredBuckets(bucket, now);

    // Check burst limit (per-minute)
    if (bucket.minuteCount >= config.burstLimit) {
      const retryAfter = Math.ceil((bucket.minuteResetAt - now) / 1000);
      return {
        allowed: false,
        limit: config.burstLimit,
        remaining: 0,
        resetAt: new Date(bucket.minuteResetAt),
        retryAfter,
        tier,
        reason: "burst",
      };
    }

    // Check hourly limit
    if (bucket.hourlyCount >= hourlyLimit) {
      const retryAfter = Math.ceil((bucket.hourlyResetAt - now) / 1000);
      return {
        allowed: false,
        limit: hourlyLimit,
        remaining: 0,
        resetAt: new Date(bucket.hourlyResetAt),
        retryAfter,
        tier,
        reason: "hourly",
      };
    }

    // Check daily limit
    if (bucket.dailyCount >= config.dailyLimit) {
      const retryAfter = Math.ceil((bucket.dailyResetAt - now) / 1000);
      return {
        allowed: false,
        limit: config.dailyLimit,
        remaining: 0,
        resetAt: new Date(bucket.dailyResetAt),
        retryAfter,
        tier,
        reason: "daily",
      };
    }

    // Increment counters
    bucket.minuteCount++;
    bucket.hourlyCount++;
    bucket.dailyCount++;
    this.usageMap.set(apiClientId, bucket);

    return {
      allowed: true,
      limit: hourlyLimit,
      remaining: Math.max(0, hourlyLimit - bucket.hourlyCount),
      resetAt: new Date(bucket.hourlyResetAt),
      tier,
    };
  }

  /**
   * Track concurrent request start
   */
  async startConcurrent(apiClientId: string): Promise<boolean> {
    const client = await this.prisma.apiClient.findUnique({
      where: { id: apiClientId },
      select: { tier: true },
    });

    const tier = (client?.tier as RateLimitTier) || RateLimitTier.FREE;
    const config = TIER_CONFIGS[tier];

    let bucket = this.usageMap.get(apiClientId);
    if (!bucket) {
      bucket = this.createBucket(Date.now());
      this.usageMap.set(apiClientId, bucket);
    }

    if (bucket.concurrent >= config.concurrentLimit) {
      return false;
    }

    bucket.concurrent++;
    this.usageMap.set(apiClientId, bucket);
    return true;
  }

  /**
   * Track concurrent request end
   */
  endConcurrent(apiClientId: string): void {
    const bucket = this.usageMap.get(apiClientId);
    if (bucket && bucket.concurrent > 0) {
      bucket.concurrent--;
      this.usageMap.set(apiClientId, bucket);
    }
  }

  /**
   * Get current usage stats for a client
   */
  getUsageStats(apiClientId: string): {
    hourlyUsed: number;
    minuteUsed: number;
    dailyUsed: number;
    concurrent: number;
  } | null {
    const bucket = this.usageMap.get(apiClientId);
    if (!bucket) return null;

    return {
      hourlyUsed: bucket.hourlyCount,
      minuteUsed: bucket.minuteCount,
      dailyUsed: bucket.dailyCount,
      concurrent: bucket.concurrent,
    };
  }

  /**
   * Generate rate limit headers for response
   */
  getRateLimitHeaders(result: RateLimitResult): Record<string, string> {
    const headers: Record<string, string> = {
      "X-RateLimit-Limit": result.limit.toString(),
      "X-RateLimit-Remaining": result.remaining.toString(),
      "X-RateLimit-Reset": Math.floor(result.resetAt.getTime() / 1000).toString(),
      "X-RateLimit-Tier": result.tier,
    };

    if (!result.allowed && result.retryAfter) {
      headers["Retry-After"] = result.retryAfter.toString();
      headers["X-RateLimit-Reason"] = result.reason || "limit_exceeded";
    }

    return headers;
  }

  private createBucket(now: number): UsageBucket {
    return {
      hourlyCount: 0,
      hourlyResetAt: now + 60 * 60 * 1000, // 1 hour
      minuteCount: 0,
      minuteResetAt: now + 60 * 1000, // 1 minute
      dailyCount: 0,
      dailyResetAt: this.getEndOfDay(now),
      concurrent: 0,
    };
  }

  private resetExpiredBuckets(bucket: UsageBucket, now: number): UsageBucket {
    if (now >= bucket.minuteResetAt) {
      bucket.minuteCount = 0;
      bucket.minuteResetAt = now + 60 * 1000;
    }

    if (now >= bucket.hourlyResetAt) {
      bucket.hourlyCount = 0;
      bucket.hourlyResetAt = now + 60 * 60 * 1000;
    }

    if (now >= bucket.dailyResetAt) {
      bucket.dailyCount = 0;
      bucket.dailyResetAt = this.getEndOfDay(now);
    }

    return bucket;
  }

  private getEndOfDay(now: number): number {
    const date = new Date(now);
    date.setHours(23, 59, 59, 999);
    return date.getTime();
  }

  private cleanup(now: number): void {
    // Remove expired entries
    for (const [key, bucket] of this.usageMap.entries()) {
      if (
        now >= bucket.hourlyResetAt &&
        now >= bucket.minuteResetAt &&
        now >= bucket.dailyResetAt
      ) {
        this.usageMap.delete(key);
      }
    }

    // Hard limit on map size
    if (this.usageMap.size > this.maxMapSize) {
      const toRemove = this.usageMap.size - this.maxMapSize;
      const keys = Array.from(this.usageMap.keys()).slice(0, toRemove);
      keys.forEach((k) => this.usageMap.delete(k));
      this.logger.warn(
        `Rate limit map exceeded ${this.maxMapSize}, removed ${toRemove} entries`
      );
    }
  }
}
