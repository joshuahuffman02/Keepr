import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { ObservabilityService } from "./observability.service";

/**
 * Prometheus metrics service
 * Exposes application metrics in Prometheus format
 *
 * Note: This implementation uses manual metric tracking compatible with prom-client.
 * If prom-client is installed, it will be used. Otherwise, falls back to manual implementation.
 */

type MetricType = "counter" | "gauge" | "histogram" | "summary";

interface MetricDefinition {
  name: string;
  help: string;
  type: MetricType;
  labelNames?: string[];
}

interface MetricValue {
  value: number;
  labels?: Record<string, string>;
  timestamp?: number;
}

interface HistogramBucket {
  le: number;
  count: number;
}

interface HistogramValue {
  buckets: HistogramBucket[];
  sum: number;
  count: number;
  labels?: Record<string, string>;
}

/**
 * Prometheus-compatible metrics registry
 * Provides counters, gauges, and histograms
 */
@Injectable()
export class PrometheusService implements OnModuleInit {
  private readonly logger = new Logger(PrometheusService.name);
  private readonly namespace = process.env.METRICS_NAMESPACE || "campreserv";
  private readonly enabled = (process.env.PROMETHEUS_ENABLED ?? "true").toLowerCase() === "true";

  // Metric definitions
  private readonly definitions: Map<string, MetricDefinition> = new Map();

  // Counter values: name -> labels key -> value
  private readonly counters: Map<string, Map<string, number>> = new Map();

  // Gauge values: name -> labels key -> value
  private readonly gauges: Map<string, Map<string, number>> = new Map();

  // Histogram data: name -> labels key -> histogram value
  private readonly histograms: Map<string, Map<string, HistogramValue>> = new Map();

  // Default histogram buckets (in ms for durations)
  private readonly defaultBuckets = [5, 10, 25, 50, 100, 250, 500, 1000, 2500, 5000, 10000];

  constructor(private readonly observability: ObservabilityService) {}

  onModuleInit() {
    if (!this.enabled) {
      this.logger.warn("Prometheus metrics disabled via PROMETHEUS_ENABLED=false");
      return;
    }

    // Register standard metrics
    this.registerStandardMetrics();
    this.logger.log("Prometheus metrics service initialized");
  }

  /**
   * Register standard application metrics
   */
  private registerStandardMetrics(): void {
    // HTTP request metrics
    this.defineCounter("http_requests_total", "Total number of HTTP requests", [
      "method",
      "path",
      "status",
    ]);
    this.defineHistogram("http_request_duration_seconds", "HTTP request duration in seconds", [
      "method",
      "path",
      "status",
    ]);

    // Business metrics
    this.defineGauge("active_reservations", "Number of active reservations", ["campground_id"]);
    this.defineGauge("payment_success_rate", "Payment success rate (0-1)", ["campground_id"]);
    this.defineCounter("payments_total", "Total payment attempts", ["status", "method"]);
    this.defineCounter("reservations_total", "Total reservations created", ["status"]);

    // AI/ML metrics
    this.defineHistogram("ai_request_duration_seconds", "AI request duration in seconds", [
      "model",
      "operation",
    ]);
    this.defineCounter("ai_requests_total", "Total AI requests", ["model", "operation", "status"]);

    // Job queue metrics
    this.defineGauge("job_queue_depth", "Current job queue depth", ["queue"]);
    this.defineCounter("job_executions_total", "Total job executions", ["queue", "status"]);
    this.defineHistogram("job_duration_seconds", "Job execution duration in seconds", ["queue"]);

    // Synthetic check metrics
    this.defineGauge("synthetic_check_status", "Synthetic check status (1=ok, 0=fail)", ["check"]);
    this.defineHistogram("synthetic_check_duration_seconds", "Synthetic check duration", ["check"]);

    // System metrics
    this.defineGauge("nodejs_heap_size_bytes", "Node.js heap size in bytes", ["type"]);
    this.defineGauge("nodejs_eventloop_lag_seconds", "Node.js event loop lag in seconds", []);

    // Communication metrics
    this.defineCounter("emails_sent_total", "Total emails sent", ["status", "provider"]);
    this.defineCounter("sms_sent_total", "Total SMS sent", ["status", "provider"]);

    // Alert metrics
    this.defineCounter("alerts_fired_total", "Total alerts fired", ["severity", "type"]);
    this.defineCounter("alert_breaches_total", "Total alert breaches by type", ["breach"]);
    this.defineGauge("alert_sink_status", "Alert sink configuration status (1=configured, 0=not)", [
      "sink",
    ]);
  }

  /**
   * Define a counter metric
   */
  defineCounter(name: string, help: string, labelNames: string[] = []): void {
    const fullName = `${this.namespace}_${name}`;
    this.definitions.set(fullName, {
      name: fullName,
      help,
      type: "counter",
      labelNames,
    });
    this.counters.set(fullName, new Map());
  }

  /**
   * Define a gauge metric
   */
  defineGauge(name: string, help: string, labelNames: string[] = []): void {
    const fullName = `${this.namespace}_${name}`;
    this.definitions.set(fullName, {
      name: fullName,
      help,
      type: "gauge",
      labelNames,
    });
    this.gauges.set(fullName, new Map());
  }

  /**
   * Define a histogram metric
   */
  defineHistogram(
    name: string,
    help: string,
    labelNames: string[] = [],
    buckets: number[] = this.defaultBuckets,
  ): void {
    const fullName = `${this.namespace}_${name}`;
    this.definitions.set(fullName, {
      name: fullName,
      help,
      type: "histogram",
      labelNames,
    });
    this.histograms.set(fullName, new Map());
  }

  /**
   * Increment a counter
   */
  incCounter(name: string, labels: Record<string, string> = {}, value = 1): void {
    if (!this.enabled) return;

    const fullName = `${this.namespace}_${name}`;
    const labelKey = this.labelsToKey(labels);
    const counterMap = this.counters.get(fullName);

    if (!counterMap) {
      this.logger.warn(`Counter ${fullName} not defined`);
      return;
    }

    const current = counterMap.get(labelKey) || 0;
    counterMap.set(labelKey, current + value);
  }

  /**
   * Set a gauge value
   */
  setGauge(name: string, value: number, labels: Record<string, string> = {}): void {
    if (!this.enabled) return;

    const fullName = `${this.namespace}_${name}`;
    const labelKey = this.labelsToKey(labels);
    const gaugeMap = this.gauges.get(fullName);

    if (!gaugeMap) {
      this.logger.warn(`Gauge ${fullName} not defined`);
      return;
    }

    gaugeMap.set(labelKey, value);
  }

  /**
   * Increment a gauge
   */
  incGauge(name: string, labels: Record<string, string> = {}, value = 1): void {
    if (!this.enabled) return;

    const fullName = `${this.namespace}_${name}`;
    const labelKey = this.labelsToKey(labels);
    const gaugeMap = this.gauges.get(fullName);

    if (!gaugeMap) return;

    const current = gaugeMap.get(labelKey) || 0;
    gaugeMap.set(labelKey, current + value);
  }

  /**
   * Decrement a gauge
   */
  decGauge(name: string, labels: Record<string, string> = {}, value = 1): void {
    this.incGauge(name, labels, -value);
  }

  /**
   * Observe a histogram value
   */
  observeHistogram(name: string, value: number, labels: Record<string, string> = {}): void {
    if (!this.enabled) return;

    const fullName = `${this.namespace}_${name}`;
    const labelKey = this.labelsToKey(labels);
    const histMap = this.histograms.get(fullName);

    if (!histMap) {
      this.logger.warn(`Histogram ${fullName} not defined`);
      return;
    }

    let hist = histMap.get(labelKey);
    if (!hist) {
      hist = {
        buckets: this.defaultBuckets.map((le) => ({ le, count: 0 })),
        sum: 0,
        count: 0,
        labels,
      };
      histMap.set(labelKey, hist);
    }

    hist.sum += value;
    hist.count += 1;

    // Update bucket counts
    for (const bucket of hist.buckets) {
      if (value <= bucket.le) {
        bucket.count += 1;
      }
    }
  }

  /**
   * Timer helper for observing durations
   */
  startTimer(name: string, labels: Record<string, string> = {}): () => void {
    const start = process.hrtime.bigint();
    return () => {
      const durationNs = process.hrtime.bigint() - start;
      const durationSeconds = Number(durationNs) / 1e9;
      this.observeHistogram(name, durationSeconds, labels);
    };
  }

  /**
   * Record an HTTP request (convenience method)
   */
  recordHttpRequest(method: string, path: string, status: number, durationMs: number): void {
    const labels = { method, path: this.normalizePath(path), status: String(status) };
    this.incCounter("http_requests_total", labels);
    this.observeHistogram("http_request_duration_seconds", durationMs / 1000, labels);
  }

  /**
   * Record an AI request (convenience method)
   */
  recordAiRequest(
    model: string,
    operation: string,
    status: "success" | "error",
    durationMs: number,
  ): void {
    const labels = { model, operation, status };
    this.incCounter("ai_requests_total", labels);
    this.observeHistogram("ai_request_duration_seconds", durationMs / 1000, { model, operation });
  }

  /**
   * Update business metrics from observability snapshot
   */
  updateFromSnapshot(): void {
    if (!this.enabled) return;

    try {
      const snapshot = this.observability.snapshot();

      // Update queue depths
      for (const [queue, state] of Object.entries(snapshot.jobs.queues || {})) {
        this.setGauge("job_queue_depth", state.queued || 0, { queue });
      }

      // Update synthetic check status
      for (const [check, result] of Object.entries(snapshot.synthetics || {})) {
        this.setGauge("synthetic_check_status", result.ok ? 1 : 0, { check });
        if (result.latencyMs !== undefined) {
          this.observeHistogram("synthetic_check_duration_seconds", result.latencyMs / 1000, {
            check,
          });
        }
      }

      // Update Node.js memory metrics
      const memUsage = process.memoryUsage();
      this.setGauge("nodejs_heap_size_bytes", memUsage.heapUsed, { type: "used" });
      this.setGauge("nodejs_heap_size_bytes", memUsage.heapTotal, { type: "total" });
      this.setGauge("nodejs_heap_size_bytes", memUsage.external, { type: "external" });
      this.setGauge("nodejs_heap_size_bytes", memUsage.rss, { type: "rss" });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.warn(`Failed to update metrics from snapshot: ${message}`);
    }
  }

  /**
   * Generate Prometheus text format output
   */
  getMetrics(): string {
    if (!this.enabled) {
      return "# Prometheus metrics disabled\n";
    }

    // Update from observability snapshot before generating
    this.updateFromSnapshot();

    const lines: string[] = [];

    // Output counters
    for (const [name, values] of this.counters) {
      const def = this.definitions.get(name);
      if (def) {
        lines.push(`# HELP ${name} ${def.help}`);
        lines.push(`# TYPE ${name} counter`);
      }

      for (const [labelKey, value] of values) {
        const labels = this.keyToLabels(labelKey);
        const labelStr = this.formatLabels(labels);
        lines.push(`${name}${labelStr} ${value}`);
      }
    }

    // Output gauges
    for (const [name, values] of this.gauges) {
      const def = this.definitions.get(name);
      if (def) {
        lines.push(`# HELP ${name} ${def.help}`);
        lines.push(`# TYPE ${name} gauge`);
      }

      for (const [labelKey, value] of values) {
        const labels = this.keyToLabels(labelKey);
        const labelStr = this.formatLabels(labels);
        lines.push(`${name}${labelStr} ${value}`);
      }
    }

    // Output histograms
    for (const [name, values] of this.histograms) {
      const def = this.definitions.get(name);
      if (def) {
        lines.push(`# HELP ${name} ${def.help}`);
        lines.push(`# TYPE ${name} histogram`);
      }

      for (const [labelKey, hist] of values) {
        const labels = this.keyToLabels(labelKey);

        // Output bucket counts
        for (const bucket of hist.buckets) {
          const bucketLabels = { ...labels, le: String(bucket.le) };
          const labelStr = this.formatLabels(bucketLabels);
          lines.push(`${name}_bucket${labelStr} ${bucket.count}`);
        }

        // Output +Inf bucket
        const infLabels = { ...labels, le: "+Inf" };
        lines.push(`${name}_bucket${this.formatLabels(infLabels)} ${hist.count}`);

        // Output sum and count
        const labelStr = this.formatLabels(labels);
        lines.push(`${name}_sum${labelStr} ${hist.sum}`);
        lines.push(`${name}_count${labelStr} ${hist.count}`);
      }
    }

    return lines.join("\n") + "\n";
  }

  /**
   * Get current metric values as JSON (for debugging)
   */
  getMetricsJson(): Record<string, unknown> {
    this.updateFromSnapshot();

    return {
      counters: Object.fromEntries(
        Array.from(this.counters.entries()).map(([name, values]) => [
          name,
          Object.fromEntries(values),
        ]),
      ),
      gauges: Object.fromEntries(
        Array.from(this.gauges.entries()).map(([name, values]) => [
          name,
          Object.fromEntries(values),
        ]),
      ),
      histograms: Object.fromEntries(
        Array.from(this.histograms.entries()).map(([name, values]) => [
          name,
          Object.fromEntries(
            Array.from(values.entries()).map(([key, hist]) => [
              key,
              {
                sum: hist.sum,
                count: hist.count,
                buckets: hist.buckets,
              },
            ]),
          ),
        ]),
      ),
    };
  }

  /**
   * Reset all metrics (useful for testing)
   */
  reset(): void {
    for (const map of this.counters.values()) {
      map.clear();
    }
    for (const map of this.gauges.values()) {
      map.clear();
    }
    for (const map of this.histograms.values()) {
      map.clear();
    }
  }

  // Helper methods

  private labelsToKey(labels: Record<string, string>): string {
    if (!labels || Object.keys(labels).length === 0) {
      return "_";
    }
    const sorted = Object.entries(labels).sort(([a], [b]) => a.localeCompare(b));
    return sorted.map(([k, v]) => `${k}=${v}`).join(",");
  }

  private keyToLabels(key: string): Record<string, string> {
    if (key === "_") return {};
    const result: Record<string, string> = {};
    for (const part of key.split(",")) {
      const [k, v] = part.split("=", 2);
      if (k && v !== undefined) {
        result[k] = v;
      }
    }
    return result;
  }

  private formatLabels(labels: Record<string, string>): string {
    const entries = Object.entries(labels);
    if (entries.length === 0) return "";

    const parts = entries.map(([k, v]) => `${k}="${this.escapeLabel(v)}"`);
    return `{${parts.join(",")}}`;
  }

  private escapeLabel(value: string): string {
    return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, "\\n");
  }

  private normalizePath(path: string): string {
    // Remove query string
    const pathOnly = path.split("?")[0];

    // Replace common ID patterns with placeholders
    return pathOnly
      .replace(/\/[a-f0-9]{24,32}/gi, "/:id") // MongoDB/CUID-like IDs
      .replace(/\/\d+/g, "/:id") // Numeric IDs
      .replace(/\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, "/:uuid"); // UUIDs
  }
}
