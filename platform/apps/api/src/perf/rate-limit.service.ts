import { Injectable, Logger } from "@nestjs/common";

type LimitResult = { allowed: true } | { allowed: false; reason: "ip" | "org" };

@Injectable()
export class RateLimitService {
  private readonly logger = new Logger(RateLimitService.name);
  private readonly windowMs = Number(process.env.PERF_RATE_LIMIT_WINDOW_MS ?? 60_000);
  private readonly ipLimit = Number(process.env.PERF_RATE_LIMIT_IP ?? 120);
  private readonly orgLimit = Number(process.env.PERF_RATE_LIMIT_ORG ?? 240);
  private readonly maxMapSize = Number(process.env.PERF_RATE_LIMIT_MAX_ENTRIES ?? 10000);

  private ipHits = new Map<string, number[]>();
  private orgHits = new Map<string, number[]>();
  private lastCleanup = Date.now();
  private readonly cleanupIntervalMs = 60_000; // Cleanup every minute

  shouldAllow(ip: string | null | undefined, orgId: string | null | undefined): LimitResult {
    const now = Date.now();

    // Periodic cleanup
    if (now - this.lastCleanup > this.cleanupIntervalMs) {
      this.cleanup(now);
      this.lastCleanup = now;
    }

    if (ip) this.prune(ip, this.ipHits, now);
    if (orgId) this.prune(orgId, this.orgHits, now);

    if (ip && this.count(ip, this.ipHits) >= this.ipLimit) {
      return { allowed: false, reason: "ip" };
    }
    if (orgId && this.count(orgId, this.orgHits) >= this.orgLimit) {
      return { allowed: false, reason: "org" };
    }

    if (ip) this.push(ip, this.ipHits, now);
    if (orgId) this.push(orgId, this.orgHits, now);
    return { allowed: true };
  }

  private cleanup(now: number) {
    const cutoff = now - this.windowMs;

    // Clean expired entries from both maps
    for (const [key, arr] of this.ipHits.entries()) {
      const filtered = arr.filter((ts) => ts >= cutoff);
      if (filtered.length === 0) {
        this.ipHits.delete(key);
      } else {
        this.ipHits.set(key, filtered);
      }
    }

    for (const [key, arr] of this.orgHits.entries()) {
      const filtered = arr.filter((ts) => ts >= cutoff);
      if (filtered.length === 0) {
        this.orgHits.delete(key);
      } else {
        this.orgHits.set(key, filtered);
      }
    }

    // Hard limit on map sizes
    if (this.ipHits.size > this.maxMapSize) {
      const toRemove = this.ipHits.size - this.maxMapSize;
      const keys = Array.from(this.ipHits.keys()).slice(0, toRemove);
      keys.forEach((k) => this.ipHits.delete(k));
      this.logger.warn(
        `IP rate limit map exceeded ${this.maxMapSize}, removed ${toRemove} entries`,
      );
    }

    if (this.orgHits.size > this.maxMapSize) {
      const toRemove = this.orgHits.size - this.maxMapSize;
      const keys = Array.from(this.orgHits.keys()).slice(0, toRemove);
      keys.forEach((k) => this.orgHits.delete(k));
      this.logger.warn(
        `Org rate limit map exceeded ${this.maxMapSize}, removed ${toRemove} entries`,
      );
    }
  }

  private prune(key: string, bucket: Map<string, number[]>, now: number) {
    const cutoff = now - this.windowMs;
    const arr = bucket.get(key);
    if (!arr) return;
    const filtered = arr.filter((ts) => ts >= cutoff);
    if (filtered.length === 0) {
      bucket.delete(key);
    } else {
      bucket.set(key, filtered);
    }
  }

  private count(key: string, bucket: Map<string, number[]>) {
    return bucket.get(key)?.length ?? 0;
  }

  private push(key: string, bucket: Map<string, number[]>, ts: number) {
    const arr = bucket.get(key) ?? [];
    arr.push(ts);
    bucket.set(key, arr);
  }
}
