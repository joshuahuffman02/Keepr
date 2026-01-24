import { ConflictException, Injectable, Logger } from "@nestjs/common";
import { randomUUID } from "crypto";
import { RedisService } from "./redis.service";

/**
 * Lightweight Redis-backed lock helper to avoid double-booking.
 * Uses a simple Redlock-style token so only the owner releases its own lock.
 * Falls back to no-op when Redis is not configured.
 */
@Injectable()
export class LockService {
  private readonly ttlMs = 5 * 60 * 1000; // 5 minutes
  private readonly logger = new Logger(LockService.name);

  constructor(private readonly redis: RedisService) {}

  private async release(
    client: ReturnType<RedisService["getClient"]>,
    locks: { key: string; token: string }[],
  ) {
    if (!client || !locks.length) return;
    const lua = `
      if redis.call("get", KEYS[1]) == ARGV[1] then
        return redis.call("del", KEYS[1])
      else
        return 0
      end
    `;
    await Promise.all(
      locks.map((lock) =>
        client
          // eslint-disable-next-line @typescript-eslint/ban-ts-comment
          // @ts-ignore lua script signature
          .eval(lua, 1, lock.key, lock.token)
          .catch(() => null),
      ),
    );
  }

  async withLocks<T>(keys: string[], fn: () => Promise<T>): Promise<T> {
    const client = this.redis.getClient();
    const uniqueKeys = Array.from(new Set(keys.filter(Boolean))).sort();
    if (!client || uniqueKeys.length === 0) {
      return fn();
    }

    const heldLocks: { key: string; token: string }[] = [];
    try {
      for (const key of uniqueKeys) {
        const lockKey = `lock:site:${key}`;
        const token = randomUUID();
        const acquired = await client.set(lockKey, token, "PX", this.ttlMs, "NX");
        if (!acquired) {
          throw new ConflictException("Site is locked by another booking. Try again in a moment.");
        }
        heldLocks.push({ key: lockKey, token });
      }
    } catch (err) {
      await this.release(client, heldLocks);
      if (err instanceof ConflictException) {
        throw err;
      }
      this.logger.warn(
        `Lock service unavailable; proceeding without locks`,
        err instanceof Error ? err.message : `${err}`,
      );
      return fn();
    }

    try {
      return await fn();
    } finally {
      await this.release(client, heldLocks);
    }
  }
}
