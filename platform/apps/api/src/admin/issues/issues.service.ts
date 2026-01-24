import { Injectable, Logger, NotFoundException, OnModuleInit } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { CreateIssueDto, UpdateIssueDto, AddAttemptDto } from "./dto";
import {
  Issue,
  IssueAttempt,
  IssueStatus,
  IssuePriority,
  IssueCategory,
  Prisma,
} from "@prisma/client";
import { randomUUID } from "crypto";

/**
 * Issue Tracking Service
 *
 * Inspired by vibe-kanban's task management patterns:
 * - Kanban status flow: backlog -> todo -> in_progress -> review -> done
 * - Issue attempts tracking (like vibe-kanban's TaskAttempt)
 * - Category-based organization
 *
 * Uses Prisma for persistent storage.
 */
@Injectable()
export class IssuesService implements OnModuleInit {
  private readonly logger = new Logger(IssuesService.name);

  constructor(private readonly prisma: PrismaService) {}

  async onModuleInit() {
    // Seed initial issues if database is empty
    const count = await this.prisma.issue.count();
    if (count === 0) {
      await this.seedInitialIssues();
    }
  }

  /**
   * Get all issues with optional filtering
   */
  async findAll(filters?: {
    category?: string;
    status?: string;
    priority?: string;
  }): Promise<Issue[]> {
    const where: Prisma.IssueWhereInput = {};

    if (filters?.category) {
      if (this.isIssueCategory(filters.category)) {
        where.category = filters.category;
      }
    }
    if (filters?.status) {
      if (this.isIssueStatus(filters.status)) {
        where.status = filters.status;
      }
    }
    if (filters?.priority) {
      if (this.isIssuePriority(filters.priority)) {
        where.priority = filters.priority;
      }
    }

    return this.prisma.issue.findMany({
      where,
      orderBy: [
        { priority: "asc" }, // critical comes first alphabetically
        { createdAt: "desc" },
      ],
    });
  }

  /**
   * Get issue by ID with attempts
   */
  async findOne(id: string): Promise<Issue & { attempts: IssueAttempt[] }> {
    const issue = await this.prisma.issue.findUnique({
      where: { id },
      include: { IssueAttempt: { orderBy: { createdAt: "desc" } } },
    });

    if (!issue) {
      throw new NotFoundException(`Issue ${id} not found`);
    }

    const { IssueAttempt, ...rest } = issue;
    return { ...rest, attempts: IssueAttempt };
  }

  /**
   * Create a new issue
   */
  async create(dto: CreateIssueDto): Promise<Issue> {
    const issue = await this.prisma.issue.create({
      data: {
        id: randomUUID(),
        title: dto.title,
        description: dto.description || null,
        category: dto.category,
        priority: dto.priority || IssuePriority.medium,
        status: IssueStatus.backlog,
        assignedTo: dto.assignedTo || null,
        updatedAt: new Date(),
      },
    });

    this.logger.log(`Created issue: ${issue.id} - ${dto.title}`);
    return issue;
  }

  /**
   * Update an issue
   */
  async update(id: string, dto: UpdateIssueDto): Promise<Issue> {
    const existing = await this.prisma.issue.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException(`Issue ${id} not found`);
    }

    const data: Prisma.IssueUpdateInput = {};

    if (dto.title !== undefined) data.title = dto.title;
    if (dto.description !== undefined) data.description = dto.description;
    if (dto.category !== undefined) data.category = dto.category;
    if (dto.priority !== undefined) data.priority = dto.priority;
    if (dto.status !== undefined) {
      data.status = dto.status;
      if (dto.status === IssueStatus.done && !existing.resolvedAt) {
        data.resolvedAt = new Date();
      }
    }
    if (dto.assignedTo !== undefined) data.assignedTo = dto.assignedTo;

    const updated = await this.prisma.issue.update({
      where: { id },
      data,
    });

    this.logger.log(`Updated issue: ${id}`);
    return updated;
  }

  /**
   * Add an attempt to an issue
   */
  async addAttempt(issueId: string, dto: AddAttemptDto): Promise<IssueAttempt> {
    const issue = await this.prisma.issue.findUnique({ where: { id: issueId } });
    if (!issue) {
      throw new NotFoundException(`Issue ${issueId} not found`);
    }

    const attempt = await this.prisma.issueAttempt.create({
      data: {
        id: randomUUID(),
        issueId,
        notes: dto.notes,
        outcome: dto.outcome,
      },
    });

    // If successful, mark issue as done
    if (dto.outcome === "success") {
      await this.update(issueId, { status: IssueStatus.done });
    }

    this.logger.log(`Added attempt to issue ${issueId}: ${dto.outcome}`);
    return attempt;
  }

  /**
   * Get issue counts by status (for Kanban board)
   */
  async getStatusCounts(): Promise<Record<string, number>> {
    const results = await this.prisma.issue.groupBy({
      by: ["status"],
      _count: { status: true },
    });

    const counts: Record<string, number> = {
      backlog: 0,
      todo: 0,
      in_progress: 0,
      review: 0,
      done: 0,
    };

    for (const result of results) {
      counts[result.status] = result._count.status;
    }

    return counts;
  }

  /**
   * Get issue counts by category
   */
  async getCategoryCounts(): Promise<Record<string, number>> {
    const results = await this.prisma.issue.groupBy({
      by: ["category"],
      _count: { category: true },
    });

    const counts: Record<string, number> = {};
    for (const result of results) {
      counts[result.category] = result._count.category;
    }

    return counts;
  }

  /**
   * Seed initial issues from known tech debt
   */
  private async seedInitialIssues(): Promise<void> {
    const sampleIssues = [
      {
        title: "Account lockout uses Map<> instead of Redis",
        category: IssueCategory.database,
        priority: IssuePriority.high,
      },
      {
        title: "Scope cache uses in-memory Map with 5000 entry limit",
        category: IssueCategory.database,
        priority: IssuePriority.medium,
      },
      {
        title: "Gift card API integration stubbed in PaymentCollectionModal",
        category: IssueCategory.frontend,
        priority: IssuePriority.medium,
      },
      {
        title: "Wallet debit API not fully implemented",
        category: IssueCategory.frontend,
        priority: IssuePriority.medium,
      },
      {
        title: "Reminder email shows alert('TODO')",
        category: IssueCategory.frontend,
        priority: IssuePriority.low,
      },
      {
        title: "OTA providers need API credentials",
        category: IssueCategory.api,
        priority: IssuePriority.high,
      },
      {
        title: "Currency/FX rates need OpenExchangeRates integration",
        category: IssueCategory.api,
        priority: IssuePriority.medium,
      },
      {
        title: "SMS failover (single Twilio provider only)",
        category: IssueCategory.api,
        priority: IssuePriority.medium,
      },
    ];

    const now = new Date();
    await this.prisma.issue.createMany({
      data: sampleIssues.map((issue) => ({
        id: randomUUID(),
        title: issue.title,
        category: issue.category,
        priority: issue.priority,
        status: IssueStatus.backlog,
        updatedAt: now,
      })),
    });

    this.logger.log(`Seeded ${sampleIssues.length} initial issues`);
  }

  private isIssueCategory(value: string): value is IssueCategory {
    const allowed: ReadonlyArray<IssueCategory> = [
      IssueCategory.database,
      IssueCategory.frontend,
      IssueCategory.performance,
      IssueCategory.security,
      IssueCategory.api,
      IssueCategory.infrastructure,
      IssueCategory.documentation,
      IssueCategory.other,
    ];
    return allowed.some((entry) => entry === value);
  }

  private isIssueStatus(value: string): value is IssueStatus {
    const allowed: ReadonlyArray<IssueStatus> = [
      IssueStatus.backlog,
      IssueStatus.todo,
      IssueStatus.in_progress,
      IssueStatus.review,
      IssueStatus.done,
    ];
    return allowed.some((entry) => entry === value);
  }

  private isIssuePriority(value: string): value is IssuePriority {
    const allowed: ReadonlyArray<IssuePriority> = [
      IssuePriority.low,
      IssuePriority.medium,
      IssuePriority.high,
      IssuePriority.critical,
    ];
    return allowed.some((entry) => entry === value);
  }
}
