import { Injectable, Logger } from "@nestjs/common";
import { ObservabilityService } from "./observability.service";

type QueueState = {
  name: string;
  running: number;
  concurrency: number;
  maxQueue: number;
  pending: Array<{
    fn: () => Promise<unknown>;
    resolve: (val: unknown) => void;
    reject: (err: unknown) => void;
    jobName?: string;
    timeoutMs?: number;
    enqueuedAt: number;
  }>;
};

@Injectable()
export class JobQueueService {
  private readonly logger = new Logger(JobQueueService.name);
  private readonly queues = new Map<string, QueueState>();
  private readonly defaultConcurrency = Number(process.env.JOB_QUEUE_CONCURRENCY ?? 3);
  private readonly defaultMaxQueue = Number(process.env.JOB_QUEUE_MAX ?? 200);
  private readonly defaultTimeoutMs = Number(process.env.JOB_QUEUE_TIMEOUT_MS ?? 45000);

  constructor(private readonly observability: ObservabilityService) { }

  async enqueue<T>(
    queueName: string,
    fn: () => Promise<T>,
    opts?: { jobName?: string; timeoutMs?: number; concurrency?: number; maxQueue?: number }
  ): Promise<T> {
    const normalizedName = queueName.toLowerCase();
    const state = this.ensureQueue(normalizedName, opts);
    if (state.pending.length >= state.maxQueue) {
      const err = new Error(`Queue ${normalizedName} is saturated (${state.maxQueue} pending)`);
      this.logger.warn(err.message);
      this.observability.recordJobRun({
        name: normalizedName,
        durationMs: 0,
        success: false,
        queueDepth: state.pending.length,
      });
      throw err;
    }

    return new Promise<T>((resolve, reject) => {
      state.pending.push({
        fn,
        resolve: (val) => resolve(val as T),
        reject: (err) => reject(err),
        jobName: opts?.jobName ?? queueName,
        timeoutMs: opts?.timeoutMs,
        enqueuedAt: Date.now(),
      });
      this.drain(state);
    });
  }

  private ensureQueue(queueName: string, opts?: { concurrency?: number; maxQueue?: number }) {
    if (!this.queues.has(queueName)) {
      this.queues.set(queueName, {
        name: queueName,
        running: 0,
        pending: [],
        concurrency: opts?.concurrency ?? this.defaultConcurrency,
        maxQueue: opts?.maxQueue ?? this.defaultMaxQueue,
      });
    }
    const state = this.queues.get(queueName)!;
    // Allow runtime tuning if env changes
    state.concurrency = opts?.concurrency ?? this.defaultConcurrency;
    state.maxQueue = opts?.maxQueue ?? this.defaultMaxQueue;
    const oldest = state.pending[0]?.enqueuedAt ? Date.now() - state.pending[0].enqueuedAt : 0;
    this.observability.setQueueState(queueName, state.running, state.pending.length, oldest, {
      maxQueue: state.maxQueue,
      concurrency: state.concurrency,
    });
    return state;
  }

  private async drain(state: QueueState) {
    while (state.running < state.concurrency && state.pending.length > 0) {
      const job = state.pending.shift();
      if (!job) break;
      state.running += 1;
      const oldest = state.pending[0]?.enqueuedAt ? Date.now() - state.pending[0].enqueuedAt : 0;
      this.observability.setQueueState(state.name, state.running, state.pending.length, oldest, {
        maxQueue: state.maxQueue,
        concurrency: state.concurrency,
      });

      const started = Date.now();
      const timeoutMs = job.timeoutMs ?? this.defaultTimeoutMs;

      const finish = (success: boolean) => {
        const durationMs = Date.now() - started;
        this.observability.recordJobRun({
          name: job.jobName ?? state.name,
          durationMs,
          success,
          queueDepth: state.pending.length,
        });
        state.running = Math.max(0, state.running - 1);
        const oldestRemaining = state.pending[0]?.enqueuedAt ? Date.now() - state.pending[0].enqueuedAt : 0;
        this.observability.setQueueState(state.name, state.running, state.pending.length, oldestRemaining, {
          maxQueue: state.maxQueue,
          concurrency: state.concurrency,
        });
        // Continue draining if more work remains
        setImmediate(() => this.drain(state));
      };

      try {
        const res = await this.runWithTimeout(job.fn, timeoutMs);
        finish(true);
        job.resolve(res);
      } catch (err) {
        finish(false);
        job.reject(err);
      }
    }
  }

  private async runWithTimeout<T>(fn: () => Promise<T>, timeoutMs: number): Promise<T> {
    let timeoutHandle: NodeJS.Timeout;
    const timeoutPromise = new Promise<never>((_, reject) => {
      timeoutHandle = setTimeout(() => reject(new Error(`Job exceeded timeout ${timeoutMs}ms`)), timeoutMs);
    });
    const result = await Promise.race([fn(), timeoutPromise]);
    clearTimeout(timeoutHandle!);
    return result as T;
  }

  /**
   * Lightweight read of queue state for capacity guards/observability.
   * Returns undefined if queue not yet created.
   */
  getQueueState(queueName: string) {
    const state = this.queues.get(queueName.toLowerCase());
    if (!state) return undefined;
    const oldest = state.pending[0]?.enqueuedAt ? Date.now() - state.pending[0].enqueuedAt : 0;
    return {
      name: state.name,
      running: state.running,
      pending: state.pending.length,
      concurrency: state.concurrency,
      maxQueue: state.maxQueue,
      oldestMs: oldest,
    };
  }
}

