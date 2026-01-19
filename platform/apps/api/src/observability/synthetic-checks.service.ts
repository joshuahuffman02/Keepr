import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { Cron } from "@nestjs/schedule";
import { ObservabilityService } from "./observability.service";
import { AlertSinksService } from "./alert-sinks.service";
import type { PrismaService } from "../prisma/prisma.service";
import type { RedisService } from "../redis/redis.service";
import type { StripeService } from "../payments/stripe.service";
import type { EmailService } from "../email/email.service";

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const getErrorMessage = (err: unknown, fallback: string): string => {
  if (err instanceof Error && err.message) return err.message;
  if (typeof err === "string") return err;
  if (isRecord(err) && typeof err.message === "string") return err.message;
  return fallback;
};

/**
 * Result of a synthetic check
 */
export interface CheckResult {
  name: string;
  ok: boolean;
  latencyMs: number;
  message?: string;
  timestamp: Date;
  skipped?: boolean;
}

/**
 * Check history entry with additional metadata
 */
export interface CheckHistoryEntry extends CheckResult {
  consecutiveFailures: number;
}

/**
 * Configuration for a synthetic check
 */
interface CheckConfig {
  name: string;
  enabled: boolean;
  timeoutMs: number;
  alertAfterFailures: number;
}

/**
 * Enhanced synthetic checks service
 *
 * Performs periodic health checks on critical infrastructure:
 * - Database connectivity
 * - Redis connectivity
 * - Stripe API availability
 * - Email service availability
 *
 * Features:
 * - Configurable check intervals
 * - Check history with rolling window
 * - Alert triggering on consecutive failures
 * - Graceful handling of unavailable services
 */
@Injectable()
export class SyntheticChecksService implements OnModuleInit {
  private readonly logger = new Logger(SyntheticChecksService.name);
  private readonly enabled =
    (process.env.SYNTHETIC_CHECKS_ENABLED ?? process.env.SYNTHETICS_ENABLED ?? "true")
      .toLowerCase() === "true";
  private readonly budgetMs = Number(process.env.SYNTHETIC_BUDGET_MS ?? 3000);
  private readonly historyMaxSize = Number(process.env.SYNTHETIC_HISTORY_SIZE ?? 100);
  private readonly alertAfterFailures = Number(process.env.SYNTHETIC_ALERT_FAILURES ?? 3);

  // Check history per check name
  private readonly checkHistory: Map<string, CheckHistoryEntry[]> = new Map();

  // Consecutive failure counts per check
  private readonly failureCounts: Map<string, number> = new Map();

  // Track if we've alerted for a given check (reset on success)
  private readonly alertedChecks: Set<string> = new Set();

  // Check configurations
  private readonly checkConfigs: Map<string, CheckConfig> = new Map();

  // Dependencies - will be injected via init
  private prismaService: PrismaService | null = null;
  private redisService: RedisService | null = null;
  private stripeService: StripeService | null = null;
  private emailService: EmailService | null = null;

  constructor(
    private readonly observability: ObservabilityService,
    private readonly alertSinks: AlertSinksService
  ) {}

  onModuleInit() {
    if (!this.enabled) {
      this.logger.warn("Synthetic checks disabled via config");
      return;
    }

    // Initialize default check configurations
    this.initializeCheckConfigs();
    this.logger.log("Synthetic checks service initialized");
  }

  /**
   * Initialize service dependencies
   * Called after module initialization to avoid circular dependencies
   */
  initDependencies(deps: {
    prisma?: PrismaService | null;
    redis?: RedisService | null;
    stripe?: StripeService | null;
    email?: EmailService | null;
  }): void {
    this.prismaService = deps.prisma ?? null;
    this.redisService = deps.redis ?? null;
    this.stripeService = deps.stripe ?? null;
    this.emailService = deps.email ?? null;
  }

  /**
   * Initialize check configurations
   */
  private initializeCheckConfigs(): void {
    const defaults = [
      { name: "database", enabled: true, timeoutMs: 5000, alertAfterFailures: 3 },
      { name: "redis", enabled: true, timeoutMs: 3000, alertAfterFailures: 5 },
      { name: "stripe", enabled: true, timeoutMs: 10000, alertAfterFailures: 3 },
      { name: "email", enabled: true, timeoutMs: 5000, alertAfterFailures: 5 },
    ];

    for (const config of defaults) {
      // Allow environment variable overrides
      const envEnabled = process.env[`SYNTHETIC_${config.name.toUpperCase()}_ENABLED`];
      const envTimeout = process.env[`SYNTHETIC_${config.name.toUpperCase()}_TIMEOUT_MS`];
      const envAlertAfter = process.env[`SYNTHETIC_${config.name.toUpperCase()}_ALERT_FAILURES`];

      this.checkConfigs.set(config.name, {
        name: config.name,
        enabled: envEnabled ? envEnabled.toLowerCase() === "true" : config.enabled,
        timeoutMs: envTimeout ? Number(envTimeout) : config.timeoutMs,
        alertAfterFailures: envAlertAfter ? Number(envAlertAfter) : config.alertAfterFailures,
      });
    }
  }

  /**
   * Run all synthetic checks (cron job every 5 minutes)
   */
  @Cron("*/5 * * * *")
  async runAllChecks(): Promise<CheckResult[]> {
    if (!this.enabled) {
      return [];
    }

    const results: CheckResult[] = [];

    // Run infrastructure checks in parallel
    const checkPromises = [
      this.checkDatabase(),
      this.checkRedis(),
      this.checkStripe(),
      this.checkEmailService(),
    ];

    const checkResults = await Promise.allSettled(checkPromises);

    for (const result of checkResults) {
      if (result.status === "fulfilled") {
        results.push(result.value);
        await this.processCheckResult(result.value);
      }
    }

    return results;
  }

  /**
   * Check database connectivity
   */
  async checkDatabase(): Promise<CheckResult> {
    const config = this.checkConfigs.get("database");
    if (!config?.enabled || !this.prismaService) {
      return this.createSkippedResult("database", "Database check disabled or service unavailable");
    }

    const start = Date.now();
    try {
      await this.withTimeout(
        this.prismaService.$queryRaw`SELECT 1`,
        config.timeoutMs,
        "Database check timeout"
      );

      const latencyMs = Date.now() - start;
      const ok = latencyMs <= this.budgetMs;

      return {
        name: "database",
        ok,
        latencyMs,
        message: ok ? undefined : `Latency ${latencyMs}ms exceeds budget ${this.budgetMs}ms`,
        timestamp: new Date(),
      };
    } catch (err: unknown) {
      return {
        name: "database",
        ok: false,
        latencyMs: Date.now() - start,
        message: getErrorMessage(err, "Database check failed"),
        timestamp: new Date(),
      };
    }
  }

  /**
   * Check Redis connectivity
   */
  async checkRedis(): Promise<CheckResult> {
    const config = this.checkConfigs.get("redis");
    if (!config?.enabled) {
      return this.createSkippedResult("redis", "Redis check disabled");
    }

    if (!this.redisService) {
      return this.createSkippedResult("redis", "Redis service unavailable");
    }

    if (!this.redisService.isEnabled) {
      return this.createSkippedResult("redis", "Redis not configured");
    }

    const start = Date.now();
    try {
      await this.withTimeout(
        this.redisService.ping(),
        config.timeoutMs,
        "Redis check timeout"
      );

      const latencyMs = Date.now() - start;
      const ok = latencyMs <= this.budgetMs;

      return {
        name: "redis",
        ok,
        latencyMs,
        message: ok ? undefined : `Latency ${latencyMs}ms exceeds budget ${this.budgetMs}ms`,
        timestamp: new Date(),
      };
    } catch (err: unknown) {
      return {
        name: "redis",
        ok: false,
        latencyMs: Date.now() - start,
        message: getErrorMessage(err, "Redis check failed"),
        timestamp: new Date(),
      };
    }
  }

  /**
   * Check Stripe API availability
   */
  async checkStripe(): Promise<CheckResult> {
    const config = this.checkConfigs.get("stripe");
    if (!config?.enabled) {
      return this.createSkippedResult("stripe", "Stripe check disabled");
    }

    if (!this.stripeService) {
      return this.createSkippedResult("stripe", "Stripe service unavailable");
    }

    if (!this.stripeService.isConfigured?.()) {
      return this.createSkippedResult("stripe", "Stripe not configured");
    }

    const start = Date.now();
    try {
      // Simple Stripe API health check - list products with limit 1
      await this.withTimeout(
        fetch("https://api.stripe.com/v1/balance", {
          method: "GET",
          headers: {
            Authorization: `Bearer ${process.env.STRIPE_SECRET_KEY}`,
          },
        }),
        config.timeoutMs,
        "Stripe check timeout"
      );

      const latencyMs = Date.now() - start;
      const ok = latencyMs <= this.budgetMs;

      return {
        name: "stripe",
        ok,
        latencyMs,
        message: ok ? undefined : `Latency ${latencyMs}ms exceeds budget ${this.budgetMs}ms`,
        timestamp: new Date(),
      };
    } catch (err: unknown) {
      return {
        name: "stripe",
        ok: false,
        latencyMs: Date.now() - start,
        message: getErrorMessage(err, "Stripe check failed"),
        timestamp: new Date(),
      };
    }
  }

  /**
   * Check email service availability
   */
  async checkEmailService(): Promise<CheckResult> {
    const config = this.checkConfigs.get("email");
    if (!config?.enabled) {
      return this.createSkippedResult("email", "Email check disabled");
    }

    // Check if any email provider is configured
    const hasResend = !!process.env.RESEND_API_KEY;
    const hasPostmark = !!process.env.POSTMARK_SERVER_TOKEN;
    const hasSmtp = !!(process.env.SMTP_HOST && process.env.SMTP_USER);

    if (!hasResend && !hasPostmark && !hasSmtp) {
      return this.createSkippedResult("email", "No email provider configured");
    }

    const start = Date.now();
    try {
      // Check the configured provider's API
      if (hasResend) {
        await this.withTimeout(
          fetch("https://api.resend.com/domains", {
            method: "GET",
            headers: {
              Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
            },
          }),
          config.timeoutMs,
          "Email check timeout"
        );
      } else if (hasPostmark) {
        await this.withTimeout(
          fetch("https://api.postmarkapp.com/server", {
            method: "GET",
            headers: {
              Accept: "application/json",
              "X-Postmark-Server-Token": process.env.POSTMARK_SERVER_TOKEN!,
            },
          }),
          config.timeoutMs,
          "Email check timeout"
        );
      } else {
        // For SMTP, we just verify configuration exists
        // Full connection test would be too expensive for a synthetic
        return {
          name: "email",
          ok: true,
          latencyMs: Date.now() - start,
          message: "SMTP configured (no live test)",
          timestamp: new Date(),
        };
      }

      const latencyMs = Date.now() - start;
      const ok = latencyMs <= this.budgetMs;

      return {
        name: "email",
        ok,
        latencyMs,
        message: ok ? undefined : `Latency ${latencyMs}ms exceeds budget ${this.budgetMs}ms`,
        timestamp: new Date(),
      };
    } catch (err: unknown) {
      return {
        name: "email",
        ok: false,
        latencyMs: Date.now() - start,
        message: getErrorMessage(err, "Email check failed"),
        timestamp: new Date(),
      };
    }
  }

  /**
   * Process a check result: update history, trigger alerts if needed
   */
  private async processCheckResult(result: CheckResult): Promise<void> {
    // Skip if this is a skipped check
    if (result.skipped) {
      this.observability.recordSynthetic(
        result.name,
        true, // Skipped checks are "ok"
        result.latencyMs,
        result.message
      );
      return;
    }

    // Record in observability
    this.observability.recordSynthetic(result.name, result.ok, result.latencyMs, result.message);

    // Update failure count
    const currentFailures = this.failureCounts.get(result.name) || 0;
    const newFailures = result.ok ? 0 : currentFailures + 1;
    this.failureCounts.set(result.name, newFailures);

    // Add to history
    this.addToHistory(result.name, {
      ...result,
      consecutiveFailures: newFailures,
    });

    // Check if we need to alert
    const config = this.checkConfigs.get(result.name);
    const alertThreshold = config?.alertAfterFailures || this.alertAfterFailures;

    if (!result.ok && newFailures >= alertThreshold && !this.alertedChecks.has(result.name)) {
      // Trigger alert
      await this.alertSinks.error(
        `Synthetic check failing: ${result.name}`,
        `The ${result.name} synthetic check has failed ${newFailures} times consecutively.\n\nLast error: ${result.message || "Unknown"}`,
        {
          check: result.name,
          consecutiveFailures: newFailures,
          latencyMs: result.latencyMs,
          lastError: result.message,
        }
      );

      this.alertedChecks.add(result.name);
      this.logger.error(
        `Synthetic check ${result.name} failed ${newFailures} consecutive times - alert sent`
      );
    }

    // Clear alert flag on success
    if (result.ok && this.alertedChecks.has(result.name)) {
      this.alertedChecks.delete(result.name);

      // Send recovery notification
      await this.alertSinks.info(
        `Synthetic check recovered: ${result.name}`,
        `The ${result.name} synthetic check has recovered after ${currentFailures} failures.`,
        {
          check: result.name,
          latencyMs: result.latencyMs,
          previousFailures: currentFailures,
        }
      );

      this.logger.log(`Synthetic check ${result.name} recovered after ${currentFailures} failures`);
    }
  }

  /**
   * Add a result to check history with size limit
   */
  private addToHistory(name: string, entry: CheckHistoryEntry): void {
    let history = this.checkHistory.get(name);
    if (!history) {
      history = [];
      this.checkHistory.set(name, history);
    }

    history.unshift(entry);

    // Trim to max size
    if (history.length > this.historyMaxSize) {
      history.pop();
    }
  }

  /**
   * Get check history for a specific check
   */
  getHistory(name: string): CheckHistoryEntry[] {
    return this.checkHistory.get(name) || [];
  }

  /**
   * Get all check history
   */
  getAllHistory(): Record<string, CheckHistoryEntry[]> {
    return Object.fromEntries(this.checkHistory);
  }

  /**
   * Get current status of all checks
   */
  getCurrentStatus(): Record<string, CheckHistoryEntry | null> {
    const result: Record<string, CheckHistoryEntry | null> = {};

    for (const [name] of this.checkConfigs) {
      const history = this.checkHistory.get(name);
      result[name] = history?.[0] || null;
    }

    return result;
  }

  /**
   * Get statistics for all checks
   */
  getStatistics(): Record<
    string,
    { total: number; failures: number; avgLatencyMs: number; successRate: number }
  > {
    const result: Record<
      string,
      { total: number; failures: number; avgLatencyMs: number; successRate: number }
    > = {};

    for (const [name, history] of this.checkHistory) {
      if (history.length === 0) continue;

      const total = history.length;
      const failures = history.filter((h) => !h.ok).length;
      const totalLatency = history.reduce((sum, h) => sum + h.latencyMs, 0);

      result[name] = {
        total,
        failures,
        avgLatencyMs: Math.round(totalLatency / total),
        successRate: (total - failures) / total,
      };
    }

    return result;
  }

  /**
   * Manually run a specific check
   */
  async runCheck(name: string): Promise<CheckResult> {
    switch (name) {
      case "database":
        return this.checkDatabase();
      case "redis":
        return this.checkRedis();
      case "stripe":
        return this.checkStripe();
      case "email":
        return this.checkEmailService();
      default:
        return {
          name,
          ok: false,
          latencyMs: 0,
          message: `Unknown check: ${name}`,
          timestamp: new Date(),
        };
    }
  }

  // Helper methods

  private createSkippedResult(name: string, message: string): CheckResult {
    return {
      name,
      ok: true,
      latencyMs: 0,
      message,
      timestamp: new Date(),
      skipped: true,
    };
  }

  private async withTimeout<T>(promise: Promise<T>, ms: number, message: string): Promise<T> {
    let timeoutId: NodeJS.Timeout | null = null;
    const timeoutPromise = new Promise<never>((_, reject) => {
      timeoutId = setTimeout(() => reject(new Error(message)), ms);
      timeoutId.unref();
    });

    try {
      return await Promise.race([promise, timeoutPromise]);
    } finally {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    }
  }
}
