import { Injectable, Logger, OnModuleDestroy } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { randomUUID } from "crypto";

const toJsonValue = (value: unknown): Prisma.InputJsonValue | undefined => {
  if (value === undefined || value === null) return undefined;
  try {
    return JSON.parse(JSON.stringify(value));
  } catch {
    return undefined;
  }
};
import { PrismaService } from "../prisma/prisma.service";

/**
 * Security Events Service
 *
 * Tracks and alerts on security-relevant events for monitoring
 * and incident response.
 *
 * Events are:
 * - Logged to database for audit trail
 * - Optionally sent to external alerting systems
 * - Aggregated for threat detection
 */
export enum SecurityEventType {
  // Authentication
  LOGIN_SUCCESS = "LOGIN_SUCCESS",
  LOGIN_FAILURE = "LOGIN_FAILURE",
  LOGIN_BLOCKED = "LOGIN_BLOCKED",
  LOGOUT = "LOGOUT",
  PASSWORD_CHANGED = "PASSWORD_CHANGED",
  PASSWORD_RESET_REQUESTED = "PASSWORD_RESET_REQUESTED",
  PASSWORD_RESET_COMPLETED = "PASSWORD_RESET_COMPLETED",

  // 2FA
  MFA_ENABLED = "MFA_ENABLED",
  MFA_DISABLED = "MFA_DISABLED",
  MFA_FAILED = "MFA_FAILED",
  BACKUP_CODE_USED = "BACKUP_CODE_USED",

  // Account
  ACCOUNT_LOCKED = "ACCOUNT_LOCKED",
  ACCOUNT_UNLOCKED = "ACCOUNT_UNLOCKED",
  ACCOUNT_CREATED = "ACCOUNT_CREATED",
  ACCOUNT_DELETED = "ACCOUNT_DELETED",
  ROLE_CHANGED = "ROLE_CHANGED",
  PERMISSIONS_CHANGED = "PERMISSIONS_CHANGED",

  // Rate Limiting
  RATE_LIMIT_EXCEEDED = "RATE_LIMIT_EXCEEDED",

  // Data Access
  SENSITIVE_DATA_ACCESSED = "SENSITIVE_DATA_ACCESSED",
  BULK_DATA_EXPORT = "BULK_DATA_EXPORT",
  PII_ACCESSED = "PII_ACCESSED",

  // API
  API_KEY_CREATED = "API_KEY_CREATED",
  API_KEY_REVOKED = "API_KEY_REVOKED",
  API_ABUSE_DETECTED = "API_ABUSE_DETECTED",

  // Suspicious Activity
  SUSPICIOUS_IP = "SUSPICIOUS_IP",
  GEO_ANOMALY = "GEO_ANOMALY",
  BRUTE_FORCE_ATTEMPT = "BRUTE_FORCE_ATTEMPT",
  CSRF_VIOLATION = "CSRF_VIOLATION",

  // Admin Actions
  ADMIN_ACTION = "ADMIN_ACTION",
  CONFIGURATION_CHANGED = "CONFIGURATION_CHANGED",
}

export enum SecurityEventSeverity {
  INFO = "INFO",
  WARNING = "WARNING",
  HIGH = "HIGH",
  CRITICAL = "CRITICAL",
}

export interface SecurityEvent {
  type: SecurityEventType;
  severity: SecurityEventSeverity;
  userId?: string;
  ipAddress?: string;
  userAgent?: string;
  campgroundId?: string;
  details?: Record<string, unknown>;
  timestamp?: Date;
}

@Injectable()
export class SecurityEventsService implements OnModuleDestroy {
  private readonly logger = new Logger(SecurityEventsService.name);
  private readonly alertWebhookUrl: string | null;
  private readonly alertingEnabled: boolean;

  // Event counts for anomaly detection
  private readonly eventCounts = new Map<string, { count: number; firstSeen: number }>();
  private readonly cleanupInterval: NodeJS.Timeout;

  constructor(private readonly prisma: PrismaService) {
    this.alertWebhookUrl = process.env.SECURITY_ALERT_WEBHOOK || null;
    this.alertingEnabled = process.env.SECURITY_ALERTING_ENABLED === "true";

    // Cleanup old event counts every 5 minutes
    this.cleanupInterval = setInterval(() => this.cleanupEventCounts(), 5 * 60 * 1000);
    this.cleanupInterval.unref?.();

    this.logger.log(`Security events service initialized (alerting: ${this.alertingEnabled})`);
  }

  /**
   * Log a security event
   */
  async logEvent(event: SecurityEvent): Promise<void> {
    const timestamp = event.timestamp || new Date();

    // Log to console (structured logging)
    this.logger.log(
      JSON.stringify({
        type: "SECURITY_EVENT",
        event: event.type,
        severity: event.severity,
        userId: event.userId ? this.maskId(event.userId) : undefined,
        ipAddress: event.ipAddress ? this.maskIp(event.ipAddress) : undefined,
        campgroundId: event.campgroundId,
        timestamp: timestamp.toISOString(),
      }),
    );

    // Store in audit log
    try {
      if (event.campgroundId) {
        const after =
          toJsonValue({
            severity: event.severity,
            ipAddress: event.ipAddress,
            userAgent: event.userAgent,
            details: event.details,
          }) ?? Prisma.JsonNull;

        await this.prisma.auditLog.create({
          data: {
            id: randomUUID(),
            campgroundId: event.campgroundId,
            actorId: event.userId ?? null,
            action: `SECURITY:${event.type}`,
            entity: "security_event",
            entityId: event.userId || "system",
            before: Prisma.JsonNull,
            after,
            ip: event.ipAddress ?? null,
            userAgent: event.userAgent ?? null,
          },
        });
      }
    } catch (error) {
      this.logger.error("Failed to log security event", error);
    }

    // Track for anomaly detection
    this.trackEvent(event);

    // Send alerts for high-severity events
    if (
      event.severity === SecurityEventSeverity.HIGH ||
      event.severity === SecurityEventSeverity.CRITICAL
    ) {
      await this.sendAlert(event);
    }
  }

  /**
   * Log a login attempt
   */
  async logLoginAttempt(
    success: boolean,
    email: string,
    ipAddress?: string,
    userAgent?: string,
    userId?: string,
    reason?: string,
  ): Promise<void> {
    await this.logEvent({
      type: success ? SecurityEventType.LOGIN_SUCCESS : SecurityEventType.LOGIN_FAILURE,
      severity: success ? SecurityEventSeverity.INFO : SecurityEventSeverity.WARNING,
      userId,
      ipAddress,
      userAgent,
      details: {
        email: this.maskEmail(email),
        reason,
      },
    });
  }

  /**
   * Log rate limit exceeded
   */
  async logRateLimitExceeded(
    identifier: string,
    limitType: string,
    ipAddress?: string,
  ): Promise<void> {
    await this.logEvent({
      type: SecurityEventType.RATE_LIMIT_EXCEEDED,
      severity: SecurityEventSeverity.WARNING,
      ipAddress,
      details: {
        identifier: this.maskId(identifier),
        limitType,
      },
    });
  }

  /**
   * Log account lockout
   */
  async logAccountLocked(
    email: string,
    ipAddress?: string,
    failedAttempts?: number,
  ): Promise<void> {
    await this.logEvent({
      type: SecurityEventType.ACCOUNT_LOCKED,
      severity: SecurityEventSeverity.HIGH,
      ipAddress,
      details: {
        email: this.maskEmail(email),
        failedAttempts,
      },
    });
  }

  /**
   * Log 2FA events
   */
  async logMfaEvent(
    type: "enabled" | "disabled" | "failed" | "backup_used",
    userId: string,
    ipAddress?: string,
  ): Promise<void> {
    const eventTypes = {
      enabled: SecurityEventType.MFA_ENABLED,
      disabled: SecurityEventType.MFA_DISABLED,
      failed: SecurityEventType.MFA_FAILED,
      backup_used: SecurityEventType.BACKUP_CODE_USED,
    };

    await this.logEvent({
      type: eventTypes[type],
      severity: type === "failed" ? SecurityEventSeverity.WARNING : SecurityEventSeverity.INFO,
      userId,
      ipAddress,
    });
  }

  /**
   * Log suspicious activity
   */
  async logSuspiciousActivity(
    type: "brute_force" | "geo_anomaly" | "suspicious_ip" | "csrf",
    identifier: string,
    ipAddress?: string,
    details?: Record<string, unknown>,
  ): Promise<void> {
    const eventTypes = {
      brute_force: SecurityEventType.BRUTE_FORCE_ATTEMPT,
      geo_anomaly: SecurityEventType.GEO_ANOMALY,
      suspicious_ip: SecurityEventType.SUSPICIOUS_IP,
      csrf: SecurityEventType.CSRF_VIOLATION,
    };

    await this.logEvent({
      type: eventTypes[type],
      severity: SecurityEventSeverity.HIGH,
      ipAddress,
      details: {
        identifier: this.maskId(identifier),
        ...details,
      },
    });
  }

  // --- Private Methods ---

  private trackEvent(event: SecurityEvent): void {
    const key = `${event.type}:${event.ipAddress || "unknown"}`;
    const now = Date.now();

    const existing = this.eventCounts.get(key);
    if (existing) {
      existing.count++;

      // Check for brute force patterns
      const elapsed = now - existing.firstSeen;
      if (
        event.type === SecurityEventType.LOGIN_FAILURE &&
        existing.count > 10 &&
        elapsed < 60000
      ) {
        this.logSuspiciousActivity("brute_force", event.ipAddress || "unknown", event.ipAddress, {
          attempts: existing.count,
          windowMs: elapsed,
        });
      }
    } else {
      this.eventCounts.set(key, { count: 1, firstSeen: now });
    }
  }

  private cleanupEventCounts(): void {
    const now = Date.now();
    const maxAge = 60 * 60 * 1000; // 1 hour

    for (const [key, value] of this.eventCounts.entries()) {
      if (now - value.firstSeen > maxAge) {
        this.eventCounts.delete(key);
      }
    }
  }

  private async sendAlert(event: SecurityEvent): Promise<void> {
    if (!this.alertingEnabled || !this.alertWebhookUrl) {
      return;
    }

    try {
      await fetch(this.alertWebhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: `[${event.severity}] Security Alert: ${event.type}`,
          attachments: [
            {
              color: event.severity === SecurityEventSeverity.CRITICAL ? "danger" : "warning",
              fields: [
                { title: "Event", value: event.type, short: true },
                { title: "Severity", value: event.severity, short: true },
                { title: "IP", value: event.ipAddress || "Unknown", short: true },
                { title: "Time", value: new Date().toISOString(), short: true },
              ],
            },
          ],
        }),
      });
    } catch (error) {
      this.logger.error("Failed to send alert", error);
    }
  }

  private maskEmail(email: string): string {
    const [local, domain] = email.split("@");
    if (!domain) return "***";
    return `${local.substring(0, 2)}***@${domain}`;
  }

  private maskId(id: string): string {
    if (id.length <= 8) return "***";
    return `${id.substring(0, 4)}...${id.substring(id.length - 4)}`;
  }

  private maskIp(ip: string): string {
    const parts = ip.split(".");
    if (parts.length !== 4) return ip;
    return `${parts[0]}.${parts[1]}.***`;
  }

  onModuleDestroy(): void {
    clearInterval(this.cleanupInterval);
  }
}
