import { Injectable, Logger } from "@nestjs/common";
import { Cron } from "@nestjs/schedule";
import { ObservabilityService } from "./observability.service";

type SyntheticSpec = {
  name: string;
  path: string;
  method?: "GET" | "POST";
  body?: any;
};

@Injectable()
export class SyntheticsService {
  private readonly logger = new Logger(SyntheticsService.name);
  private readonly enabled = (process.env.SYNTHETICS_ENABLED ?? "true").toLowerCase() === "true";
  private readonly baseUrl = process.env.SYNTHETIC_API_BASE;
  private readonly budgetMs = Number(process.env.SYNTHETIC_BUDGET_MS ?? 3000);

  constructor(private readonly observability: ObservabilityService) { }

  @Cron("*/5 * * * *")
  async run() {
    if (!this.enabled || !this.baseUrl) {
      return;
    }

    const specs: SyntheticSpec[] = [
      { name: "redeem", path: process.env.SYNTHETIC_REDEEM_PATH ?? "/api/health" },
      { name: "pos-order", path: process.env.SYNTHETIC_POS_PATH ?? "/api/health" },
      { name: "offer-accept", path: process.env.SYNTHETIC_OFFER_PATH ?? "/api/health" },
      { name: "report-export", path: process.env.SYNTHETIC_REPORT_PATH ?? "/api/health" },
    ];

    for (const spec of specs) {
      await this.runSingle(spec);
    }
  }

  private async runSingle(spec: SyntheticSpec) {
    const started = Date.now();
    const url = `${this.baseUrl}${spec.path}`;
    try {
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (process.env.SYNTHETIC_TOKEN) {
        headers.Authorization = `Bearer ${process.env.SYNTHETIC_TOKEN}`;
      }

      const res = await fetch(url, {
        method: spec.method ?? "GET",
        headers,
        body: spec.body ? JSON.stringify(spec.body) : undefined,
      } as any);
      const latency = Date.now() - started;
      const ok = res.ok && latency <= this.budgetMs;
      this.observability.recordSynthetic(spec.name, ok, latency, ok ? undefined : `HTTP ${res.status} latency ${latency}ms`);
      if (!ok) {
        this.logger.warn(`Synthetic ${spec.name} failed (${latency}ms)`);
      }
    } catch (err) {
      const latency = Date.now() - started;
      this.observability.recordSynthetic(spec.name, false, latency, (err as any)?.message);
      this.logger.warn(`Synthetic ${spec.name} error: ${(err as any)?.message ?? err}`);
    }
  }
}
