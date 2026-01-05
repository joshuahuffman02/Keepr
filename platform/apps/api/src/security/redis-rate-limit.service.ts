import { Injectable, HttpException, HttpStatus, Logger } from "@nestjs/common";
import { RedisService } from "../redis/redis.service";

/**
 * Redis-Backed Rate Limiting Service
 *
 * Uses Redis for distributed rate limiting that works across
 * multiple server instances and survives restarts.
 *
 * Implements:
 * - Sliding window algorithm for accurate limiting
 * - Multiple rate limit types (IP, user, endpoint)
 * - Configurable limits per endpoint or user type
 */
export interface RateLimitConfig {
    windowMs: number; // Time window in milliseconds
    maxRequests: number; // Max requests per window
    keyPrefix?: string; // Prefix for Redis keys
    skipSuccessfulRequests?: boolean; // Don't count successful requests
    skipFailedRequests?: boolean; // Don't count failed requests
}

export interface RateLimitResult {
    allowed: boolean;
    remaining: number;
    resetTime: number;
    retryAfter?: number;
}

@Injectable()
export class RedisRateLimitService {
    private readonly logger = new Logger(RedisRateLimitService.name);
    private readonly defaultConfig: RateLimitConfig = {
        windowMs: 60 * 1000, // 1 minute
        maxRequests: 100,
        keyPrefix: "rate_limit:",
    };
    private warnedNoRedis = false;

    // Specific limits for different contexts
    private readonly limits: Record<string, RateLimitConfig> = {
        // Global IP limit
        global: {
            windowMs: 60 * 1000,
            maxRequests: parseInt(process.env.RATE_LIMIT_GLOBAL || "120", 10),
            keyPrefix: "rate:global:",
        },
        // Login attempts (stricter)
        login: {
            windowMs: 15 * 60 * 1000, // 15 minutes
            maxRequests: parseInt(process.env.RATE_LIMIT_LOGIN || "10", 10),
            keyPrefix: "rate:login:",
        },
        // API endpoints
        api: {
            windowMs: 60 * 1000,
            maxRequests: parseInt(process.env.RATE_LIMIT_API || "60", 10),
            keyPrefix: "rate:api:",
        },
        // Password reset requests
        password_reset: {
            windowMs: 60 * 60 * 1000, // 1 hour
            maxRequests: 5,
            keyPrefix: "rate:pwreset:",
        },
        // Registration
        register: {
            windowMs: 60 * 60 * 1000, // 1 hour
            maxRequests: 10,
            keyPrefix: "rate:register:",
        },
        // Developer API
        developer_api: {
            windowMs: 60 * 1000,
            maxRequests: parseInt(process.env.RATE_LIMIT_DEVELOPER_API || "1000", 10),
            keyPrefix: "rate:dev_api:",
        },
    };

    constructor(private readonly redis: RedisService) {
        this.logger.log("Redis rate limiting initialized");
    }

    /**
     * Check if a request is within rate limits (sliding window)
     *
     * @param identifier Unique identifier (IP, user ID, API key)
     * @param limitType Type of limit to apply
     * @returns Rate limit result
     */
    async checkLimit(
        identifier: string,
        limitType: keyof typeof this.limits = "global"
    ): Promise<RateLimitResult> {
        const config = this.limits[limitType] || this.defaultConfig;
        const key = `${config.keyPrefix}${identifier}`;
        const now = Date.now();
        const windowStart = now - config.windowMs;

        try {
            const client = this.redis.getClient();
            if (!client) {
                if (!this.warnedNoRedis) {
                    this.logger.warn("Redis unavailable, rate limiting disabled");
                    this.warnedNoRedis = true;
                }
                return {
                    allowed: true,
                    remaining: config.maxRequests,
                    resetTime: now + config.windowMs,
                };
            }
            if (this.warnedNoRedis) {
                this.warnedNoRedis = false;
            }

            // Use sorted set for sliding window
            // Score = timestamp, value = unique request ID
            const requestId = `${now}:${Math.random().toString(36).slice(2)}`;

            // Transaction: remove old entries, add new, count total (ioredis API)
            const pipeline = client.multi();

            // Remove entries outside window
            pipeline.zremrangebyscore(key, 0, windowStart);

            // Add current request (ioredis uses zadd(key, score, member))
            pipeline.zadd(key, now, requestId);

            // Get count of requests in window
            pipeline.zcard(key);

            // Set expiry
            pipeline.expire(key, Math.ceil(config.windowMs / 1000) + 1);

            const results = await pipeline.exec();
            // ioredis multi returns [[err, result], [err, result], ...]
            const requestCount = results && results[2] ? (results[2][1] as number) : 0;

            const remaining = Math.max(0, config.maxRequests - requestCount);
            const allowed = requestCount <= config.maxRequests;

            if (!allowed) {
                // Calculate retry-after using zrange with WITHSCORES
                const oldestRequest = await client.zrange(key, 0, 0, "WITHSCORES");
                const retryAfter = oldestRequest.length >= 2
                    ? Math.ceil((parseInt(oldestRequest[1], 10) + config.windowMs - now) / 1000)
                    : Math.ceil(config.windowMs / 1000);

                return {
                    allowed: false,
                    remaining: 0,
                    resetTime: now + config.windowMs,
                    retryAfter: Math.max(1, retryAfter),
                };
            }

            return {
                allowed: true,
                remaining,
                resetTime: now + config.windowMs,
            };
        } catch (error) {
            this.logger.error("Redis error", error);
            // On error, allow the request
            return {
                allowed: true,
                remaining: config.maxRequests,
                resetTime: now + config.windowMs,
            };
        }
    }

    /**
     * Check rate limit and throw if exceeded
     */
    async checkAndThrow(
        identifier: string,
        limitType: keyof typeof this.limits = "global",
        context?: string
    ): Promise<void> {
        const result = await this.checkLimit(identifier, limitType);

        if (!result.allowed) {
            this.logger.log(
                `Limit exceeded for ${identifier} (${limitType}${context ? `: ${context}` : ""})`
            );

            throw new HttpException(
                {
                    statusCode: HttpStatus.TOO_MANY_REQUESTS,
                    message: "Too many requests. Please try again later.",
                    retryAfter: result.retryAfter,
                },
                HttpStatus.TOO_MANY_REQUESTS
            );
        }
    }

    /**
     * Get rate limit headers for response
     */
    getRateLimitHeaders(result: RateLimitResult, limitType: string): Record<string, string> {
        const config = this.limits[limitType] || this.defaultConfig;

        return {
            "X-RateLimit-Limit": String(config.maxRequests),
            "X-RateLimit-Remaining": String(result.remaining),
            "X-RateLimit-Reset": String(Math.ceil(result.resetTime / 1000)),
            ...(result.retryAfter ? { "Retry-After": String(result.retryAfter) } : {}),
        };
    }

    /**
     * Manually reset rate limit for an identifier
     */
    async resetLimit(identifier: string, limitType: keyof typeof this.limits = "global"): Promise<void> {
        const config = this.limits[limitType] || this.defaultConfig;
        const key = `${config.keyPrefix}${identifier}`;

        try {
            const client = this.redis.getClient();
            if (client) {
                await client.del(key);
            }
        } catch (error) {
            this.logger.error("Failed to reset limit", error);
        }
    }

    /**
     * Get current usage stats for an identifier
     */
    async getUsageStats(
        identifier: string,
        limitType: keyof typeof this.limits = "global"
    ): Promise<{ used: number; limit: number; remaining: number }> {
        const config = this.limits[limitType] || this.defaultConfig;
        const key = `${config.keyPrefix}${identifier}`;
        const windowStart = Date.now() - config.windowMs;

        try {
            const client = this.redis.getClient();
            if (!client) {
                return { used: 0, limit: config.maxRequests, remaining: config.maxRequests };
            }

            const count = await client.zcount(key, windowStart, "+inf");

            return {
                used: count,
                limit: config.maxRequests,
                remaining: Math.max(0, config.maxRequests - count),
            };
        } catch {
            return { used: 0, limit: config.maxRequests, remaining: config.maxRequests };
        }
    }
}
