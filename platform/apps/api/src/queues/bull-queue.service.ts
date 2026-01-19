import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from "@nestjs/common";
import { RedisService } from "../redis/redis.service";

/**
 * Job data structure
 */
export interface JobData<T = unknown> {
  id: string;
  name: string;
  data: T;
  attempts: number;
  maxAttempts: number;
  backoff: number;
  priority: number;
  delay: number;
  createdAt: Date;
  processAfter: Date;
  status: "waiting" | "active" | "completed" | "failed" | "delayed";
  result?: unknown;
  error?: string;
  completedAt?: Date;
  failedAt?: Date;
}

/**
 * Job options
 */
export interface JobOptions {
  delay?: number; // Delay in ms before processing
  priority?: number; // Lower = higher priority (1-10)
  attempts?: number; // Max retry attempts
  backoff?: number; // Backoff multiplier in ms
  jobId?: string; // Custom job ID for deduplication
}

/**
 * Queue statistics
 */
export interface QueueStats {
  name: string;
  waiting: number;
  active: number;
  completed: number;
  failed: number;
  delayed: number;
}

type ProcessorFn<T> = {
  bivarianceHack(job: JobData<T>): Promise<unknown>;
}["bivarianceHack"];

/**
 * BullMQ-style queue service with Redis persistence
 * Falls back to in-memory processing when Redis unavailable
 */
@Injectable()
export class BullQueueService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(BullQueueService.name);
  private readonly processors = new Map<string, ProcessorFn<unknown>>();
  private readonly memoryQueues = new Map<string, JobData[]>();
  private readonly activeJobs = new Map<string, Set<string>>();
  private readonly completedJobs = new Map<string, JobData[]>();
  private readonly failedJobs = new Map<string, JobData[]>();
  private processingInterval: NodeJS.Timeout | null = null;
  private readonly QUEUE_PREFIX = "campreserv:queue:";
  private readonly JOB_PREFIX = "campreserv:job:";
  private readonly COMPLETED_TTL = 86400; // 24 hours
  private readonly FAILED_TTL = 604800; // 7 days

  constructor(private readonly redis: RedisService) {}

  async onModuleInit() {
    // Start background processing
    this.processingInterval = setInterval(() => this.processQueues(), 1000);
    this.processingInterval.unref?.();
    this.logger.log("BullQueueService initialized");
  }

  async onModuleDestroy() {
    if (this.processingInterval) {
      clearInterval(this.processingInterval);
    }
    this.logger.log("BullQueueService shutdown");
  }

  /**
   * Register a processor for a queue
   */
  registerProcessor<T>(queueName: string, processor: ProcessorFn<T>) {
    this.processors.set(queueName, processor);
    this.logger.log(`Registered processor for queue: ${queueName}`);
  }

  /**
   * Add a job to a queue
   */
  async addJob<T>(
    queueName: string,
    jobName: string,
    data: T,
    options: JobOptions = {}
  ): Promise<string> {
    const jobId = options.jobId || this.generateJobId();
    const now = new Date();
    const processAfter = options.delay
      ? new Date(now.getTime() + options.delay)
      : now;

    const job: JobData<T> = {
      id: jobId,
      name: jobName,
      data,
      attempts: 0,
      maxAttempts: options.attempts ?? 3,
      backoff: options.backoff ?? 1000,
      priority: options.priority ?? 5,
      delay: options.delay ?? 0,
      createdAt: now,
      processAfter,
      status: options.delay ? "delayed" : "waiting",
    };

    if (this.redis.isEnabled) {
      await this.addJobToRedis(queueName, job);
    } else {
      this.addJobToMemory(queueName, job);
    }

    this.logger.debug(`Job ${jobId} added to queue ${queueName}`);
    return jobId;
  }

  /**
   * Add a job with a specific delay
   */
  async addDelayedJob<T>(
    queueName: string,
    jobName: string,
    data: T,
    delayMs: number,
    options: Omit<JobOptions, "delay"> = {}
  ): Promise<string> {
    return this.addJob(queueName, jobName, data, { ...options, delay: delayMs });
  }

  /**
   * Add a bulk of jobs
   */
  async addBulk<T>(
    queueName: string,
    jobs: Array<{ name: string; data: T; options?: JobOptions }>
  ): Promise<string[]> {
    const ids: string[] = [];
    for (const job of jobs) {
      const id = await this.addJob(queueName, job.name, job.data, job.options);
      ids.push(id);
    }
    return ids;
  }

  /**
   * Get queue statistics
   */
  async getStats(queueName: string): Promise<QueueStats> {
    if (this.redis.isEnabled) {
      return this.getRedisStats(queueName);
    }
    return this.getMemoryStats(queueName);
  }

  /**
   * Get all queue statistics
   */
  async getAllStats(): Promise<QueueStats[]> {
    const queueNames = Array.from(this.processors.keys());
    return Promise.all(queueNames.map((name) => this.getStats(name)));
  }

  /**
   * Get failed jobs for a queue
   */
  async getFailedJobs(queueName: string, limit = 100): Promise<JobData[]> {
    if (this.redis.isEnabled) {
      const client = this.redis.getClient();
      if (!client) return [];
      const key = `${this.QUEUE_PREFIX}${queueName}:failed`;
      const jobs = await client.lrange(key, 0, limit - 1);
      return jobs.map((j) => JSON.parse(j));
    }
    return (this.failedJobs.get(queueName) || []).slice(0, limit);
  }

  /**
   * Retry failed jobs
   */
  async retryFailed(queueName: string, jobId?: string): Promise<number> {
    const failed = await this.getFailedJobs(queueName);
    const toRetry = jobId ? failed.filter((j) => j.id === jobId) : failed;

    for (const job of toRetry) {
      job.status = "waiting";
      job.attempts = 0;
      job.error = undefined;
      job.failedAt = undefined;
      await this.addJob(queueName, job.name, job.data, { jobId: job.id });
    }

    // Clear retried jobs from failed list
    if (this.redis.isEnabled) {
      const client = this.redis.getClient();
      if (client) {
        const key = `${this.QUEUE_PREFIX}${queueName}:failed`;
        for (const job of toRetry) {
          await client.lrem(key, 1, JSON.stringify(job));
        }
      }
    } else {
      const failedList = this.failedJobs.get(queueName) || [];
      this.failedJobs.set(
        queueName,
        failedList.filter((j) => !toRetry.find((r) => r.id === j.id))
      );
    }

    return toRetry.length;
  }

  /**
   * Clean completed/failed jobs older than specified age
   */
  async clean(
    queueName: string,
    grace: number,
    status: "completed" | "failed" = "completed"
  ): Promise<number> {
    const cutoff = Date.now() - grace;
    let cleaned = 0;

    if (this.redis.isEnabled) {
      const client = this.redis.getClient();
      if (!client) return 0;
      const key = `${this.QUEUE_PREFIX}${queueName}:${status}`;
      const jobs = await client.lrange(key, 0, -1);
      for (const jobStr of jobs) {
        const job = JSON.parse(jobStr);
        const timestamp =
          status === "completed" ? job.completedAt : job.failedAt;
        if (new Date(timestamp).getTime() < cutoff) {
          await client.lrem(key, 1, jobStr);
          cleaned++;
        }
      }
    } else {
      const list =
        status === "completed"
          ? this.completedJobs.get(queueName)
          : this.failedJobs.get(queueName);
      if (list) {
        const before = list.length;
        const filtered = list.filter((j) => {
          const timestamp =
            status === "completed" ? j.completedAt : j.failedAt;
          return new Date(timestamp!).getTime() >= cutoff;
        });
        if (status === "completed") {
          this.completedJobs.set(queueName, filtered);
        } else {
          this.failedJobs.set(queueName, filtered);
        }
        cleaned = before - filtered.length;
      }
    }

    return cleaned;
  }

  // Private methods

  private generateJobId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private async addJobToRedis<T>(queueName: string, job: JobData<T>) {
    const client = this.redis.getClient();
    if (!client) return;

    const jobKey = `${this.JOB_PREFIX}${job.id}`;
    const queueKey =
      job.status === "delayed"
        ? `${this.QUEUE_PREFIX}${queueName}:delayed`
        : `${this.QUEUE_PREFIX}${queueName}:waiting`;

    // Store job data
    await client.set(jobKey, JSON.stringify(job), "EX", 86400 * 7);

    // Add to sorted set (score = processAfter timestamp for ordering)
    await client.zadd(queueKey, job.processAfter.getTime(), job.id);
  }

  private addJobToMemory<T>(queueName: string, job: JobData<T>) {
    if (!this.memoryQueues.has(queueName)) {
      this.memoryQueues.set(queueName, []);
    }
    const queue = this.memoryQueues.get(queueName)!;
    queue.push(job);
    // Sort by priority then by processAfter
    queue.sort((a, b) => {
      if (a.priority !== b.priority) return a.priority - b.priority;
      return a.processAfter.getTime() - b.processAfter.getTime();
    });
  }

  private async processQueues() {
    for (const [queueName, processor] of this.processors) {
      try {
        await this.processQueue(queueName, processor);
      } catch (err) {
        this.logger.error(`Error processing queue ${queueName}`, err);
      }
    }
  }

  private async processQueue(queueName: string, processor: ProcessorFn<unknown>) {
    const job = await this.getNextJob(queueName);
    if (!job) return;

    // Check if already being processed
    const activeSet = this.activeJobs.get(queueName) || new Set();
    if (activeSet.has(job.id)) return;
    activeSet.add(job.id);
    this.activeJobs.set(queueName, activeSet);

    try {
      job.status = "active";
      job.attempts++;

      const result = await processor(job);

      job.status = "completed";
      job.result = result;
      job.completedAt = new Date();

      await this.moveToCompleted(queueName, job);
      this.logger.debug(`Job ${job.id} completed`);
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err);
      job.error = error;

      if (job.attempts < job.maxAttempts) {
        // Schedule retry with exponential backoff
        const delay = job.backoff * Math.pow(2, job.attempts - 1);
        job.status = "delayed";
        job.processAfter = new Date(Date.now() + delay);
        await this.requeue(queueName, job);
        this.logger.warn(
          `Job ${job.id} failed (attempt ${job.attempts}/${job.maxAttempts}), retrying in ${delay}ms`
        );
      } else {
        job.status = "failed";
        job.failedAt = new Date();
        await this.moveToFailed(queueName, job);
        this.logger.error(
          `Job ${job.id} failed permanently after ${job.attempts} attempts: ${error}`
        );
      }
    } finally {
      activeSet.delete(job.id);
    }
  }

  private async getNextJob(queueName: string): Promise<JobData | null> {
    const now = Date.now();

    if (this.redis.isEnabled) {
      const client = this.redis.getClient();
      if (!client) return null;

      // Check delayed jobs first
      const delayedKey = `${this.QUEUE_PREFIX}${queueName}:delayed`;
      const readyDelayed = await client.zrangebyscore(delayedKey, 0, now, "LIMIT", 0, 1);
      if (readyDelayed.length > 0) {
        const jobId = readyDelayed[0];
        await client.zrem(delayedKey, jobId);
        const waitingKey = `${this.QUEUE_PREFIX}${queueName}:waiting`;
        await client.zadd(waitingKey, now, jobId);
      }

      // Get next waiting job
      const waitingKey = `${this.QUEUE_PREFIX}${queueName}:waiting`;
      const nextIds = await client.zrangebyscore(waitingKey, 0, now, "LIMIT", 0, 1);
      if (nextIds.length === 0) return null;

      const jobId = nextIds[0];
      await client.zrem(waitingKey, jobId);

      const jobKey = `${this.JOB_PREFIX}${jobId}`;
      const jobStr = await client.get(jobKey);
      if (!jobStr) return null;

      return JSON.parse(jobStr);
    } else {
      const queue = this.memoryQueues.get(queueName) || [];
      const readyIndex = queue.findIndex(
        (j) =>
          (j.status === "waiting" || j.status === "delayed") &&
          j.processAfter.getTime() <= now
      );
      if (readyIndex === -1) return null;
      return queue.splice(readyIndex, 1)[0];
    }
  }

  private async requeue(queueName: string, job: JobData) {
    if (this.redis.isEnabled) {
      await this.addJobToRedis(queueName, job);
    } else {
      this.addJobToMemory(queueName, job);
    }
  }

  private async moveToCompleted(queueName: string, job: JobData) {
    if (this.redis.isEnabled) {
      const client = this.redis.getClient();
      if (!client) return;
      const key = `${this.QUEUE_PREFIX}${queueName}:completed`;
      await client.lpush(key, JSON.stringify(job));
      await client.ltrim(key, 0, 999); // Keep last 1000
      await client.expire(key, this.COMPLETED_TTL);
    } else {
      if (!this.completedJobs.has(queueName)) {
        this.completedJobs.set(queueName, []);
      }
      const list = this.completedJobs.get(queueName)!;
      list.unshift(job);
      if (list.length > 1000) list.pop();
    }
  }

  private async moveToFailed(queueName: string, job: JobData) {
    if (this.redis.isEnabled) {
      const client = this.redis.getClient();
      if (!client) return;
      const key = `${this.QUEUE_PREFIX}${queueName}:failed`;
      await client.lpush(key, JSON.stringify(job));
      await client.ltrim(key, 0, 999);
      await client.expire(key, this.FAILED_TTL);
    } else {
      if (!this.failedJobs.has(queueName)) {
        this.failedJobs.set(queueName, []);
      }
      const list = this.failedJobs.get(queueName)!;
      list.unshift(job);
      if (list.length > 1000) list.pop();
    }
  }

  private async getRedisStats(queueName: string): Promise<QueueStats> {
    const client = this.redis.getClient();
    if (!client) {
      return { name: queueName, waiting: 0, active: 0, completed: 0, failed: 0, delayed: 0 };
    }

    const [waiting, delayed, completed, failed] = await Promise.all([
      client.zcard(`${this.QUEUE_PREFIX}${queueName}:waiting`),
      client.zcard(`${this.QUEUE_PREFIX}${queueName}:delayed`),
      client.llen(`${this.QUEUE_PREFIX}${queueName}:completed`),
      client.llen(`${this.QUEUE_PREFIX}${queueName}:failed`),
    ]);

    const activeSet = this.activeJobs.get(queueName) || new Set();

    return {
      name: queueName,
      waiting,
      active: activeSet.size,
      completed,
      failed,
      delayed,
    };
  }

  private getMemoryStats(queueName: string): QueueStats {
    const queue = this.memoryQueues.get(queueName) || [];
    const completed = this.completedJobs.get(queueName) || [];
    const failed = this.failedJobs.get(queueName) || [];
    const active = this.activeJobs.get(queueName) || new Set();

    const now = Date.now();
    const waiting = queue.filter(
      (j) => j.status === "waiting" && j.processAfter.getTime() <= now
    ).length;
    const delayed = queue.filter(
      (j) => j.status === "delayed" || j.processAfter.getTime() > now
    ).length;

    return {
      name: queueName,
      waiting,
      active: active.size,
      completed: completed.length,
      failed: failed.length,
      delayed,
    };
  }
}
