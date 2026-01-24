import { HttpException, HttpStatus, Injectable } from "@nestjs/common";

class ServiceUnavailableException extends HttpException {
  constructor(message: string) {
    super(message, HttpStatus.SERVICE_UNAVAILABLE);
  }
}
import { PrismaService } from "../prisma/prisma.service";

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const getErrorMessage = (error: unknown) => {
  if (error instanceof Error) return error.message;
  if (error === null || error === undefined) return "";
  return String(error);
};

type RestoreSimulation = {
  status: "idle" | "running" | "ok" | "error";
  lastRunAt: string | null;
  message?: string | null;
};

export type BackupStatus = {
  campgroundId: string;
  lastBackupAt: string | null;
  lastBackupLocation: string | null;
  lastVerifiedAt: string | null;
  lastRestoreDrillAt: string | null;
  retentionDays: number;
  nextBackupDueAt: string | null;
  restoreSimulation: RestoreSimulation;
  status: "healthy" | "stale" | "missing";
  providerHealth: { ok: boolean; message?: string };
};

export abstract class BackupProvider {
  abstract healthCheck(): Promise<{ ok: boolean; message?: string }>;
  abstract getLatestBackup(campgroundId: string): Promise<{
    lastBackupAt: string | null;
    location: string | null;
    verifiedAt: string | null;
  }>;
  abstract runRestoreDrill(campgroundId: string): Promise<{
    ok: boolean;
    verifiedAt: string | null;
    message?: string | null;
  }>;
}

export class HttpBackupProvider implements BackupProvider {
  private base = process.env.BACKUP_API_BASE;
  private token = process.env.BACKUP_API_TOKEN;
  private retries = Number(process.env.BACKUP_API_RETRIES ?? 2);
  private timeoutMs = Number(process.env.BACKUP_API_TIMEOUT_MS ?? 5000);

  private headers() {
    const h: Record<string, string> = { "Content-Type": "application/json" };
    if (this.token) h["Authorization"] = `Bearer ${this.token}`;
    return h;
  }

  private ensureConfigured() {
    if (!this.base) {
      const msg = "BACKUP_API_BASE not configured";
      if (process.env.NODE_ENV === "production") {
        throw new ServiceUnavailableException(msg);
      }
      throw new ServiceUnavailableException(msg);
    }
  }

  private getFetch(): typeof fetch {
    const fetchFn = globalThis.fetch;
    if (!fetchFn) {
      throw new ServiceUnavailableException(
        "global fetch is unavailable; provide a fetch polyfill",
      );
    }
    return fetchFn;
  }

  private async fetchWithRetry(url: string, init: RequestInit): Promise<Response> {
    const fetchFn = this.getFetch();
    let attempt = 0;
    let lastError: unknown;
    while (attempt <= this.retries) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), this.timeoutMs);
      timer.unref?.();
      try {
        const res = await fetchFn(url, { ...init, signal: controller.signal });
        clearTimeout(timer);
        return res;
      } catch (err) {
        clearTimeout(timer);
        lastError = err;
        attempt += 1;
        if (attempt > this.retries) break;
      }
    }
    throw new ServiceUnavailableException(
      getErrorMessage(lastError) || "Backup provider request failed",
    );
  }

  async healthCheck() {
    this.ensureConfigured();
    try {
      const res = await this.fetchWithRetry(`${this.base}/health`, { headers: this.headers() });
      return { ok: res.ok, message: res.ok ? "ok" : `provider unhealthy (${res.status})` };
    } catch (err) {
      return { ok: false, message: getErrorMessage(err) || "health check failed" };
    }
  }

  async getLatestBackup(campgroundId: string) {
    this.ensureConfigured();
    const res = await this.fetchWithRetry(
      `${this.base}/campgrounds/${campgroundId}/backups/latest`,
      {
        headers: this.headers(),
      },
    );
    if (!res.ok) {
      throw new ServiceUnavailableException(`Backup provider error ${res.status}`);
    }
    const body = await res.json();
    if (!isRecord(body)) {
      throw new ServiceUnavailableException("Backup provider returned invalid payload");
    }
    return {
      lastBackupAt: typeof body.lastBackupAt === "string" ? body.lastBackupAt : null,
      location: typeof body.location === "string" ? body.location : null,
      verifiedAt: typeof body.verifiedAt === "string" ? body.verifiedAt : null,
    };
  }

  async runRestoreDrill(campgroundId: string) {
    this.ensureConfigured();
    const res = await this.fetchWithRetry(
      `${this.base}/campgrounds/${campgroundId}/backups/restore-check`,
      {
        method: "POST",
        headers: this.headers(),
      },
    );
    if (!res.ok) {
      const body = await res.text();
      throw new ServiceUnavailableException(body || `Restore drill failed (${res.status})`);
    }
    const body = await res.json();
    if (!isRecord(body)) {
      throw new ServiceUnavailableException("Restore drill returned invalid payload");
    }
    return {
      ok: body.ok === true,
      verifiedAt: typeof body.verifiedAt === "string" ? body.verifiedAt : null,
      message: typeof body.message === "string" ? body.message : null,
    };
  }
}

@Injectable()
export class BackupService {
  private readonly statusByCampground = new Map<string, BackupStatus>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly provider: BackupProvider,
  ) {}

  private seedStatus(campgroundId: string, retentionDays: number): BackupStatus {
    const status: BackupStatus = {
      campgroundId,
      lastBackupAt: null,
      lastBackupLocation: null,
      lastVerifiedAt: null,
      lastRestoreDrillAt: null,
      retentionDays,
      nextBackupDueAt: null,
      status: "missing",
      providerHealth: { ok: false, message: "No backup record found" },
      restoreSimulation: {
        status: "idle",
        lastRunAt: null,
        message: "No restore drill run",
      },
    };
    return status;
  }

  private async resolveRetentionDays(campgroundId: string) {
    const privacySetting = await this.prisma.privacySetting?.findUnique?.({
      where: { campgroundId },
    });
    return privacySetting?.backupRetentionDays ?? 30;
  }

  async getStatus(campgroundId: string): Promise<BackupStatus> {
    const retentionDays = await this.resolveRetentionDays(campgroundId);
    const health = await this.provider.healthCheck();

    const latest = await this.provider.getLatestBackup(campgroundId);
    if (!latest.lastBackupAt) {
      throw new ServiceUnavailableException("No backup record found for campground");
    }

    const lastBackupAtDate = new Date(latest.lastBackupAt);
    const stale = Date.now() - lastBackupAtDate.getTime() > retentionDays * 24 * 60 * 60 * 1000;
    const status: BackupStatus = {
      campgroundId,
      lastBackupAt: latest.lastBackupAt,
      lastBackupLocation: latest.location,
      lastVerifiedAt: latest.verifiedAt,
      lastRestoreDrillAt: null,
      retentionDays,
      nextBackupDueAt: new Date(
        lastBackupAtDate.getTime() + retentionDays * 24 * 60 * 60 * 1000,
      ).toISOString(),
      status: stale ? "stale" : "healthy",
      restoreSimulation: {
        status: "idle",
        lastRunAt: null,
        message: "No restore drill run",
      },
      providerHealth: health,
    };
    this.statusByCampground.set(campgroundId, status);
    return status;
  }

  async simulateRestore(campgroundId: string) {
    const retentionDays = await this.resolveRetentionDays(campgroundId);
    const current = await this.getStatus(campgroundId);
    const now = new Date();
    const drill = await this.provider.runRestoreDrill(campgroundId);
    if (!drill.ok) {
      throw new ServiceUnavailableException(drill.message || "Restore drill failed");
    }
    const drillResult: RestoreSimulation = {
      status: "ok",
      lastRunAt: drill.verifiedAt || now.toISOString(),
      message: drill.message || "Restore verification succeeded",
    };
    const updated: BackupStatus = {
      ...current,
      retentionDays,
      lastRestoreDrillAt: drillResult.lastRunAt,
      lastVerifiedAt:
        drill.verifiedAt ?? current.lastVerifiedAt ?? current.lastBackupAt ?? drillResult.lastRunAt,
      restoreSimulation: drillResult,
      status: "healthy",
    };
    this.statusByCampground.set(campgroundId, updated);

    return {
      ...updated,
      startedAt: now.toISOString(),
      completedAt: now.toISOString(),
    };
  }
}
