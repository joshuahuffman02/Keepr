import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import {
  OpTaskService,
  OpTemplateService,
  OpTriggerService,
  OpRecurrenceService,
  OpTeamService,
  OpSlaService,
} from './services';
import { OpGamificationService } from './services/op-gamification.service';
import {
  CreateOpTaskDto,
  UpdateOpTaskDto,
  OpTaskQueryDto,
  CreateOpTaskCommentDto,
  CreateOpTaskTemplateDto,
  UpdateOpTaskTemplateDto,
  CreateOpTaskTriggerDto,
  UpdateOpTaskTriggerDto,
  CreateOpRecurrenceRuleDto,
  UpdateOpRecurrenceRuleDto,
  CreateOpTeamDto,
  UpdateOpTeamDto,
  AddTeamMemberDto,
} from './dto/op-task.dto';
import { OpTaskCategory, OpTaskState, OpTriggerEvent, OpRecurrencePattern } from '@prisma/client';

@Controller('op-tasks')
@UseGuards(JwtAuthGuard)
export class OpTasksController {
  constructor(
    private taskService: OpTaskService,
    private templateService: OpTemplateService,
    private triggerService: OpTriggerService,
    private recurrenceService: OpRecurrenceService,
    private teamService: OpTeamService,
    private slaService: OpSlaService,
    private gamificationService: OpGamificationService,
  ) {}

  // ============================================================================
  // TASKS
  // ============================================================================

  @Get(':campgroundId/tasks')
  async findTasks(
    @Param('campgroundId') campgroundId: string,
    @Query() query: OpTaskQueryDto,
  ) {
    return this.taskService.findMany(campgroundId, query);
  }

  @Get(':campgroundId/tasks/stats')
  async getTaskStats(@Param('campgroundId') campgroundId: string) {
    return this.taskService.getStats(campgroundId);
  }

  @Get(':campgroundId/tasks/due-today')
  async getDueToday(@Param('campgroundId') campgroundId: string) {
    return this.taskService.getDueToday(campgroundId);
  }

  @Get(':campgroundId/tasks/overdue')
  async getOverdue(@Param('campgroundId') campgroundId: string) {
    return this.taskService.getOverdue(campgroundId);
  }

  @Get(':campgroundId/tasks/my-tasks')
  async getMyTasks(
    @Param('campgroundId') campgroundId: string,
    @Request() req: Request,
  ) {
    return this.taskService.getMyTasks(campgroundId, req.user.id);
  }

  @Get(':campgroundId/tasks/:taskId')
  async findTask(@Param('taskId') taskId: string) {
    return this.taskService.findOne(taskId);
  }

  @Post(':campgroundId/tasks')
  async createTask(
    @Param('campgroundId') campgroundId: string,
    @Body() dto: CreateOpTaskDto,
    @Request() req: Request,
  ) {
    return this.taskService.create(campgroundId, dto, req.user.id);
  }

  @Patch(':campgroundId/tasks/:taskId')
  async updateTask(
    @Param('taskId') taskId: string,
    @Body() dto: UpdateOpTaskDto,
    @Request() req: Request,
  ) {
    return this.taskService.update(taskId, dto, req.user.id);
  }

  @Delete(':campgroundId/tasks/:taskId')
  async deleteTask(@Param('taskId') taskId: string) {
    return this.taskService.delete(taskId);
  }

  @Post(':campgroundId/tasks/:taskId/assign')
  async assignTask(
    @Param('taskId') taskId: string,
    @Body() body: { userId?: string; teamId?: string },
    @Request() req: Request,
  ) {
    return this.taskService.assign(taskId, body.userId, body.teamId, req.user.id);
  }

  @Post(':campgroundId/tasks/:taskId/comments')
  async addComment(
    @Param('taskId') taskId: string,
    @Body() dto: CreateOpTaskCommentDto,
    @Request() req: Request,
  ) {
    return this.taskService.addComment(taskId, req.user.id, dto);
  }

  @Post(':campgroundId/tasks/bulk-update')
  async bulkUpdateState(
    @Body() body: { ids: string[]; state: OpTaskState },
    @Request() req: Request,
  ) {
    return this.taskService.bulkUpdateState(body.ids, body.state, req.user.id);
  }

  // ============================================================================
  // TEMPLATES
  // ============================================================================

  @Get(':campgroundId/templates')
  async findTemplates(
    @Param('campgroundId') campgroundId: string,
    @Query('category') category?: OpTaskCategory,
    @Query('isActive') isActive?: string,
  ) {
    return this.templateService.findAll(campgroundId, {
      category,
      isActive: isActive === 'true' ? true : isActive === 'false' ? false : undefined,
    });
  }

  @Get(':campgroundId/templates/starters')
  async getStarterTemplates() {
    return this.templateService.getStarterTemplates();
  }

  @Get(':campgroundId/templates/:templateId')
  async findTemplate(@Param('templateId') templateId: string) {
    return this.templateService.findOne(templateId);
  }

  @Post(':campgroundId/templates')
  async createTemplate(
    @Param('campgroundId') campgroundId: string,
    @Body() dto: CreateOpTaskTemplateDto,
  ) {
    return this.templateService.create(campgroundId, dto);
  }

  @Patch(':campgroundId/templates/:templateId')
  async updateTemplate(
    @Param('templateId') templateId: string,
    @Body() dto: UpdateOpTaskTemplateDto,
  ) {
    return this.templateService.update(templateId, dto);
  }

  @Delete(':campgroundId/templates/:templateId')
  async deleteTemplate(@Param('templateId') templateId: string) {
    return this.templateService.delete(templateId);
  }

  @Post(':campgroundId/templates/:templateId/duplicate')
  async duplicateTemplate(
    @Param('templateId') templateId: string,
    @Body() body: { name?: string },
  ) {
    return this.templateService.duplicate(templateId, body.name);
  }

  @Post(':campgroundId/templates/seed')
  async seedStarterTemplates(@Param('campgroundId') campgroundId: string) {
    return this.templateService.seedStarterTemplates(campgroundId);
  }

  // ============================================================================
  // TRIGGERS
  // ============================================================================

  @Get(':campgroundId/triggers')
  async findTriggers(
    @Param('campgroundId') campgroundId: string,
    @Query('event') event?: OpTriggerEvent,
    @Query('isActive') isActive?: string,
  ) {
    return this.triggerService.findAll(campgroundId, {
      triggerEvent: event,
      isActive: isActive === 'true' ? true : isActive === 'false' ? false : undefined,
    });
  }

  @Get(':campgroundId/triggers/suggestions')
  async getTriggerSuggestions() {
    return this.triggerService.getSuggestedTriggers();
  }

  @Get(':campgroundId/triggers/:triggerId')
  async findTrigger(@Param('triggerId') triggerId: string) {
    return this.triggerService.findOne(triggerId);
  }

  @Post(':campgroundId/triggers')
  async createTrigger(
    @Param('campgroundId') campgroundId: string,
    @Body() dto: CreateOpTaskTriggerDto,
  ) {
    return this.triggerService.create(campgroundId, dto);
  }

  @Patch(':campgroundId/triggers/:triggerId')
  async updateTrigger(
    @Param('triggerId') triggerId: string,
    @Body() dto: UpdateOpTaskTriggerDto,
  ) {
    return this.triggerService.update(triggerId, dto);
  }

  @Delete(':campgroundId/triggers/:triggerId')
  async deleteTrigger(@Param('triggerId') triggerId: string) {
    return this.triggerService.delete(triggerId);
  }

  // ============================================================================
  // RECURRENCE RULES
  // ============================================================================

  @Get(':campgroundId/recurrence')
  async findRecurrenceRules(
    @Param('campgroundId') campgroundId: string,
    @Query('pattern') pattern?: OpRecurrencePattern,
    @Query('isActive') isActive?: string,
  ) {
    return this.recurrenceService.findAll(campgroundId, {
      pattern,
      isActive: isActive === 'true' ? true : isActive === 'false' ? false : undefined,
    });
  }

  @Get(':campgroundId/recurrence/suggestions')
  async getRecurrenceSuggestions() {
    return this.recurrenceService.getSuggestedRules();
  }

  @Get(':campgroundId/recurrence/:ruleId')
  async findRecurrenceRule(@Param('ruleId') ruleId: string) {
    return this.recurrenceService.findOne(ruleId);
  }

  @Post(':campgroundId/recurrence')
  async createRecurrenceRule(
    @Param('campgroundId') campgroundId: string,
    @Body() dto: CreateOpRecurrenceRuleDto,
  ) {
    return this.recurrenceService.create(campgroundId, dto);
  }

  @Patch(':campgroundId/recurrence/:ruleId')
  async updateRecurrenceRule(
    @Param('ruleId') ruleId: string,
    @Body() dto: UpdateOpRecurrenceRuleDto,
  ) {
    return this.recurrenceService.update(ruleId, dto);
  }

  @Delete(':campgroundId/recurrence/:ruleId')
  async deleteRecurrenceRule(@Param('ruleId') ruleId: string) {
    return this.recurrenceService.delete(ruleId);
  }

  @Post(':campgroundId/recurrence/:ruleId/trigger')
  async triggerRecurrence(@Param('ruleId') ruleId: string) {
    return this.recurrenceService.triggerGeneration(ruleId);
  }

  // ============================================================================
  // TEAMS
  // ============================================================================

  @Get(':campgroundId/teams')
  async findTeams(
    @Param('campgroundId') campgroundId: string,
    @Query('isActive') isActive?: string,
  ) {
    return this.teamService.findAll(campgroundId, {
      isActive: isActive === 'true' ? true : isActive === 'false' ? false : undefined,
    });
  }

  @Get(':campgroundId/teams/my-teams')
  async getMyTeams(
    @Param('campgroundId') campgroundId: string,
    @Request() req: Request,
  ) {
    return this.teamService.getUserTeams(campgroundId, req.user.id);
  }

  @Get(':campgroundId/teams/available-staff')
  async getAvailableStaff(@Param('campgroundId') campgroundId: string) {
    return this.teamService.getAvailableStaff(campgroundId);
  }

  @Get(':campgroundId/teams/:teamId')
  async findTeam(@Param('teamId') teamId: string) {
    return this.teamService.findOne(teamId);
  }

  @Get(':campgroundId/teams/:teamId/stats')
  async getTeamStats(@Param('teamId') teamId: string) {
    return this.teamService.getTeamStats(teamId);
  }

  @Post(':campgroundId/teams')
  async createTeam(
    @Param('campgroundId') campgroundId: string,
    @Body() dto: CreateOpTeamDto,
  ) {
    return this.teamService.create(campgroundId, dto);
  }

  @Patch(':campgroundId/teams/:teamId')
  async updateTeam(
    @Param('teamId') teamId: string,
    @Body() dto: UpdateOpTeamDto,
  ) {
    return this.teamService.update(teamId, dto);
  }

  @Delete(':campgroundId/teams/:teamId')
  async deleteTeam(@Param('teamId') teamId: string) {
    return this.teamService.delete(teamId);
  }

  @Post(':campgroundId/teams/:teamId/members')
  async addTeamMember(
    @Param('teamId') teamId: string,
    @Body() dto: AddTeamMemberDto,
  ) {
    return this.teamService.addMember(teamId, dto);
  }

  @Delete(':campgroundId/teams/:teamId/members/:userId')
  async removeTeamMember(
    @Param('teamId') teamId: string,
    @Param('userId') userId: string,
  ) {
    return this.teamService.removeMember(teamId, userId);
  }

  @Patch(':campgroundId/teams/:teamId/members/:userId')
  async updateMemberRole(
    @Param('teamId') teamId: string,
    @Param('userId') userId: string,
    @Body() body: { role: string },
  ) {
    return this.teamService.updateMemberRole(teamId, userId, body.role);
  }

  @Post(':campgroundId/teams/seed')
  async seedDefaultTeams(@Param('campgroundId') campgroundId: string) {
    return this.teamService.seedDefaultTeams(campgroundId);
  }

  // ============================================================================
  // SLA
  // ============================================================================

  @Get(':campgroundId/sla/dashboard')
  async getSlaDashboard(@Param('campgroundId') campgroundId: string) {
    return this.slaService.getDashboardMetrics(campgroundId);
  }

  @Get(':campgroundId/sla/upcoming')
  async getUpcomingDeadlines(
    @Param('campgroundId') campgroundId: string,
    @Query('limit') limit?: string,
    @Query('hoursAhead') hoursAhead?: string,
  ) {
    return this.slaService.getUpcomingDeadlines(campgroundId, {
      limit: limit ? parseInt(limit, 10) : undefined,
      hoursAhead: hoursAhead ? parseInt(hoursAhead, 10) : undefined,
    });
  }

  @Get(':campgroundId/sla/breached')
  async getBreachedTasks(@Param('campgroundId') campgroundId: string) {
    return this.slaService.getBreachedTasks(campgroundId);
  }

  @Get(':campgroundId/sla/team-performance')
  async getTeamSlaPerformance(@Param('campgroundId') campgroundId: string) {
    return this.slaService.getTeamPerformance(campgroundId);
  }

  @Get(':campgroundId/sla/staff-performance')
  async getStaffSlaPerformance(@Param('campgroundId') campgroundId: string) {
    return this.slaService.getStaffPerformance(campgroundId);
  }

  @Post(':campgroundId/sla/:taskId/escalate')
  async escalateTask(
    @Param('taskId') taskId: string,
    @Body() body: { escalateToUserId: string },
  ) {
    return this.slaService.escalateTask(taskId, body.escalateToUserId);
  }

  // ============================================================================
  // GAMIFICATION
  // ============================================================================

  @Get(':campgroundId/gamification/leaderboard')
  async getLeaderboard(
    @Param('campgroundId') campgroundId: string,
    @Query('period') period?: 'week' | 'month' | 'all_time',
    @Query('limit') limit?: string,
  ) {
    return this.gamificationService.getLeaderboard(campgroundId, {
      period,
      limit: limit ? parseInt(limit) : undefined,
    });
  }

  @Get(':campgroundId/gamification/badges')
  async getBadges(@Param('campgroundId') campgroundId: string) {
    return this.gamificationService.getBadges(campgroundId);
  }

  @Post(':campgroundId/gamification/badges/seed')
  async seedDefaultBadges(@Param('campgroundId') campgroundId: string) {
    return this.gamificationService.seedDefaultBadges(campgroundId);
  }

  @Get(':campgroundId/gamification/staff/:userId')
  async getStaffProfile(
    @Param('campgroundId') campgroundId: string,
    @Param('userId') userId: string,
  ) {
    return this.gamificationService.getStaffProfile(userId, campgroundId);
  }

  @Get(':campgroundId/gamification/my-stats')
  async getMyStats(
    @Param('campgroundId') campgroundId: string,
    @Request() req: Request,
  ) {
    return this.gamificationService.getStaffProfile(req.user.id, campgroundId);
  }

  @Get(':campgroundId/gamification/all-staff')
  async getAllStaffStats(@Param('campgroundId') campgroundId: string) {
    return this.gamificationService.getAllStaffStats(campgroundId);
  }
}
