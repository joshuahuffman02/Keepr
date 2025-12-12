import { Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { RedisService } from "../redis/redis.service";
import { ObservabilityService } from "../observability/observability.service";

type CheckResult = {
  ok: boolean;
  latencyMs?: number;
  message?: string;
  skipped?: boolean;
};

@Injectable()
export class HealthService {
  private readonly logger = new Logger(HealthService.name);
  private readonly readyChecksEnabled =
    (process.env.ENABLE_READY_PROBE ?? process.env.ready_checks_enabled ?? "true").toString().toLowerCase() === "true";

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly observability: ObservabilityService
  ) { }

  liveness() {
    return {
      ok: true,
      status: "up",
      timestamp: new Date().toISOString(),
      uptimeMs: Math.round(process.uptime() * 1000),
    };
  }

  async readiness() {
    if (!this.readyChecksEnabled) {
      return {
        ok: true,
        status: "skipped",
        skipped: true,
        message: "Ready checks disabled via config",
        timestamp: new Date().toISOString(),
        uptimeMs: Math.round(process.uptime() * 1000),
      };
    }

    const db = await this.safeCheck(async () => {
      const start = Date.now();
      await this.prisma.$queryRaw`SELECT 1`;
      return { ok: true, latencyMs: Date.now() - start };
    }, "db");

    const redis = await this.safeCheck(async () => {
      if (!this.redis.isEnabled) {
        return { ok: true, skipped: true, message: "redis not configured" };
      }
      const start = Date.now();
      await this.redis.ping();
      return { ok: true, latencyMs: Date.now() - start };
    }, "redis");

    const snapshot = this.observability.snapshot();
    const queues = Object.entries(snapshot.jobs.queues || {}).map(([name, state]) => ({
      name,
      running: state.running,
      queued: state.queued,
    }));

    const ok = db.ok && redis.ok;

    this.observability.recordReady(ok, {
      db: db.ok,
      redis: redis.ok,
    });

    return {
      ok,
      status: ok ? "ok" : "degraded",
      timestamp: new Date().toISOString(),
      uptimeMs: Math.round(process.uptime() * 1000),
      checks: { db, redis },
      queues,
      perf: {
        api: {
          count: snapshot.api.count,
          p95: snapshot.api.p95,
          errorRate: snapshot.api.count ? snapshot.api.errors / snapshot.api.count : 0,
        },
        jobs: {
          count: snapshot.jobs.count,
          p95: snapshot.jobs.p95,
          failureRate: snapshot.jobs.count ? snapshot.jobs.errors / snapshot.jobs.count : 0,
        },
        targets: snapshot.targets,
      },
    };
  }

  // Backwards compatibility shim for previous callers
  async check() {
    return this.readiness();
  }

  private async safeCheck(fn: () => Promise<CheckResult>, component: string): Promise<CheckResult> {
    try {
      return await fn();
    } catch (err: any) {
      this.logger.warn(`Health check failed for ${component}: ${err?.message ?? err}`);
      return { ok: false, message: err?.message ?? "check failed" };
    }
  }
}

