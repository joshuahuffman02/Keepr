import { Controller, Get, Post, Patch, Param, Query, Body, UseGuards } from "@nestjs/common";
import { JwtAuthGuard, RolesGuard, Roles } from "../../auth/guards";
import { PlatformRole } from "@prisma/client";
import { IssuesService } from "./issues.service";
import { CreateIssueDto, UpdateIssueDto, AddAttemptDto } from "./dto";

/**
 * Issue Tracking Controller
 *
 * Admin-only endpoints for tracking internal issues
 * Inspired by vibe-kanban's Kanban board patterns
 */
@Controller("admin/issues")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(PlatformRole.platform_admin, PlatformRole.support_agent)
export class IssuesController {
  constructor(private readonly issues: IssuesService) {}

  /**
   * List all issues with optional filters
   */
  @Get()
  async list(
    @Query("category") category?: string,
    @Query("status") status?: string,
    @Query("priority") priority?: string,
  ) {
    return this.issues.findAll({ category, status, priority });
  }

  /**
   * Get issue counts for Kanban board columns
   */
  @Get("counts")
  async getCounts() {
    const [statusCounts, categoryCounts] = await Promise.all([
      this.issues.getStatusCounts(),
      this.issues.getCategoryCounts(),
    ]);

    return { statusCounts, categoryCounts };
  }

  /**
   * Get a single issue with attempts
   */
  @Get(":id")
  async getOne(@Param("id") id: string) {
    return this.issues.findOne(id);
  }

  /**
   * Create a new issue
   */
  @Post()
  async create(@Body() body: CreateIssueDto) {
    return this.issues.create(body);
  }

  /**
   * Update an issue (change status, priority, assignment, etc.)
   */
  @Patch(":id")
  async update(@Param("id") id: string, @Body() body: UpdateIssueDto) {
    return this.issues.update(id, body);
  }

  /**
   * Add an attempt to an issue (log a fix attempt)
   */
  @Post(":id/attempts")
  async addAttempt(@Param("id") id: string, @Body() body: AddAttemptDto) {
    return this.issues.addAttempt(id, body);
  }
}
