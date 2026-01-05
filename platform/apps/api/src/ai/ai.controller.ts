import { Controller, Get, Post, Patch, Param, Body, UseGuards, Req, ForbiddenException, Logger } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards';
import { RolesGuard, Roles } from '../auth/guards/roles.guard';
import { UserRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AiFeatureGateService } from './ai-feature-gate.service';
import { AiBookingAssistService } from './ai-booking-assist.service';
import { AiSupportService } from './ai-support.service';
import { AiPartnerService } from './ai-partner.service';
import { AiSentimentService } from './ai-sentiment.service';
import { AiMorningBriefingService } from './ai-morning-briefing.service';
import { AiReportQueryService } from './ai-report-query.service';
import { AiCampaignService } from './ai-campaign.service';
import { AiSmartComposeService } from './ai-smart-compose.service';
import type { Request } from 'express';

interface UpdateAiSettingsDto {
  aiEnabled?: boolean;
  aiReplyAssistEnabled?: boolean;
  aiBookingAssistEnabled?: boolean;
  aiAnalyticsEnabled?: boolean;
  aiForecastingEnabled?: boolean;
  aiAnonymizationLevel?: 'strict' | 'moderate' | 'minimal';
  aiProvider?: 'openai' | 'anthropic' | 'local';
  aiApiKey?: string | null;
  aiMonthlyBudgetCents?: number | null;
}

interface BookingChatDto {
  sessionId: string;
  message: string;
  dates?: { arrival: string; departure: string };
  partySize?: { adults: number; children: number };
  rigInfo?: { type: string; length: number };
  preferences?: string[];
  history?: { role: 'user' | 'assistant'; content: string }[];
}

interface SupportChatDto {
  sessionId: string;
  message: string;
  history?: { role: 'user' | 'assistant'; content: string }[];
  context?: string;
}

interface PartnerChatDto {
  sessionId?: string;
  message: string;
  history?: { role: 'user' | 'assistant'; content: string }[];
}

interface PartnerConfirmDto {
  action: {
    type: string;
    parameters?: Record<string, any>;
    sensitivity?: "low" | "medium" | "high";
    impactArea?: string;
  };
}

@Controller('ai')
export class AiController {
  private readonly logger = new Logger(AiController.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly gate: AiFeatureGateService,
    private readonly bookingAssist: AiBookingAssistService,
    private readonly supportService: AiSupportService,
    private readonly partnerService: AiPartnerService,
    private readonly sentimentService: AiSentimentService,
    private readonly morningBriefingService: AiMorningBriefingService,
    private readonly reportQueryService: AiReportQueryService,
    private readonly campaignService: AiCampaignService,
    private readonly smartComposeService: AiSmartComposeService,
  ) { }

  // ==================== PUBLIC ENDPOINTS ====================

  /**
   * Public endpoint for booking assistant chat (no auth required)
   */
  @Post('public/campgrounds/:campgroundId/chat')
  async bookingChat(
    @Param('campgroundId') campgroundId: string,
    @Body() body: BookingChatDto,
  ) {
    try {
      return await this.bookingAssist.chat({
        campgroundId,
        sessionId: body.sessionId,
        message: body.message,
        dates: body.dates,
        partySize: body.partySize,
        rigInfo: body.rigInfo,
        preferences: body.preferences,
        history: body.history,
      });
    } catch (error) {
      this.logger.error('Chat endpoint error:', error instanceof Error ? error.stack : error);
      // Return the error message for debugging (in production you'd want to sanitize this)
      return {
        message: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        action: 'info',
        error: true,
      };
    }
  }

  /**
   * Check if booking assist is enabled for a campground (public)
   */
  @Get('public/campgrounds/:campgroundId/status')
  async getPublicAiStatus(@Param('campgroundId') campgroundId: string) {
    const campground = await this.prisma.campground.findUnique({
      where: { id: campgroundId },
      select: {
        aiEnabled: true,
        aiBookingAssistEnabled: true,
      },
    });

    return {
      bookingAssistAvailable: campground?.aiEnabled && campground?.aiBookingAssistEnabled,
    };
  }

  // ==================== AUTHENTICATED ENDPOINTS ====================

  /**
   * Support chat endpoint for dashboard users
   * Provides AI-powered help with using Keepr
   */
  @UseGuards(JwtAuthGuard)
  @Post('support/chat')
  async supportChat(
    @Body() body: SupportChatDto,
    @Req() req: Request,
  ) {
    const userId = (req as any).user?.id;

    try {
      return await this.supportService.chat({
        sessionId: body.sessionId,
        message: body.message,
        history: body.history,
        context: body.context,
        userId,
      });
    } catch (error) {
      this.logger.error('Support chat error:', error instanceof Error ? error.stack : error);
      // Return graceful fallback
      return {
        message:
          "I'm having trouble connecting right now. Here are some ways to get help:\n\n" +
          "- Check the Help Center for answers\n" +
          "- Browse our FAQs\n" +
          "- Submit a support ticket",
        helpArticles: [
          { title: "Help Center", url: "/help" },
          { title: "FAQs", url: "/help/faq" },
          { title: "Contact Support", url: "/help/contact" },
        ],
        showTicketPrompt: true,
      };
    }
  }

  /**
   * Authenticated AI partner endpoint for staff/admin
   */
  @UseGuards(JwtAuthGuard)
  @Post('campgrounds/:campgroundId/partner')
  async partnerChat(
    @Param('campgroundId') campgroundId: string,
    @Body() body: PartnerChatDto,
    @Req() req: Request,
  ) {
    const user = (req as any).user;

    try {
      return await this.partnerService.chat({
        campgroundId,
        message: body.message,
        history: body.history,
        sessionId: body.sessionId,
        user,
      });
    } catch (error) {
      this.logger.error('AI partner chat error:', error instanceof Error ? error.stack : error);
      return {
        mode: 'staff',
        message: "I'm having trouble completing that request right now.",
        denials: [{ reason: error instanceof Error ? error.message : 'Unknown error' }],
      };
    }
  }

  @UseGuards(JwtAuthGuard)
  @Post('campgrounds/:campgroundId/partner/confirm')
  async partnerConfirm(
    @Param('campgroundId') campgroundId: string,
    @Body() body: PartnerConfirmDto,
    @Req() req: Request,
  ) {
    const user = (req as any).user;

    try {
      return await this.partnerService.confirmAction({
        campgroundId,
        action: body.action,
        user,
      });
    } catch (error) {
      this.logger.error('AI partner confirm error:', error instanceof Error ? error.stack : error);
      return {
        mode: 'staff',
        message: "I'm having trouble confirming that request right now.",
        denials: [{ reason: error instanceof Error ? error.message : 'Unknown error' }],
      };
    }
  }

  @UseGuards(JwtAuthGuard)
  @Get('campgrounds/:campgroundId/settings')
  async getAiSettings(@Param('campgroundId') campgroundId: string, @Req() req: Request) {
    const org = (req as any).organizationId || null;

    const campground = await this.prisma.campground.findUnique({
      where: { id: campgroundId },
      select: {
        id: true,
        name: true,
        organizationId: true,
        aiEnabled: true,
        aiReplyAssistEnabled: true,
        aiBookingAssistEnabled: true,
        aiAnalyticsEnabled: true,
        aiForecastingEnabled: true,
        aiAnonymizationLevel: true,
        aiProvider: true,
        aiApiKey: true,
        aiConsentCollected: true,
        aiConsentCollectedAt: true,
        aiMonthlyBudgetCents: true,
        aiTotalTokensUsed: true,
      },
    });

    if (!campground) {
      throw new ForbiddenException('Campground not found');
    }

    if (org && campground.organizationId !== org) {
      throw new ForbiddenException('Access denied');
    }

    return {
      ...campground,
      aiApiKey: campground.aiApiKey ? '••••••••' : null,
      hasCustomApiKey: !!campground.aiApiKey,
      aiProvider: 'openai',
    };
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.owner, UserRole.manager)
  @Patch('campgrounds/:campgroundId/settings')
  async updateAiSettings(
    @Param('campgroundId') campgroundId: string,
    @Body() body: UpdateAiSettingsDto,
    @Req() req: Request,
  ) {
    const org = (req as any).organizationId || null;

    const campground = await this.prisma.campground.findUnique({
      where: { id: campgroundId },
      select: { organizationId: true },
    });

    if (!campground) {
      throw new ForbiddenException('Campground not found');
    }

    if (org && campground.organizationId !== org) {
      throw new ForbiddenException('Access denied');
    }

    const updateData: Record<string, any> = {};

    if (typeof body.aiEnabled === 'boolean') updateData.aiEnabled = body.aiEnabled;
    if (typeof body.aiReplyAssistEnabled === 'boolean') updateData.aiReplyAssistEnabled = body.aiReplyAssistEnabled;
    if (typeof body.aiBookingAssistEnabled === 'boolean') updateData.aiBookingAssistEnabled = body.aiBookingAssistEnabled;
    if (typeof body.aiAnalyticsEnabled === 'boolean') updateData.aiAnalyticsEnabled = body.aiAnalyticsEnabled;
    if (typeof body.aiForecastingEnabled === 'boolean') updateData.aiForecastingEnabled = body.aiForecastingEnabled;
    if (body.aiAnonymizationLevel) updateData.aiAnonymizationLevel = body.aiAnonymizationLevel;
    updateData.aiProvider = 'openai';
    if (body.aiApiKey !== undefined) updateData.aiApiKey = body.aiApiKey;
    if (body.aiMonthlyBudgetCents !== undefined) updateData.aiMonthlyBudgetCents = body.aiMonthlyBudgetCents;

    if (body.aiEnabled && !campground) {
      updateData.aiConsentCollected = true;
      updateData.aiConsentCollectedAt = new Date();
    }

    const updated = await this.prisma.campground.update({
      where: { id: campgroundId },
      data: updateData,
      select: {
        id: true,
        aiEnabled: true,
        aiReplyAssistEnabled: true,
        aiBookingAssistEnabled: true,
        aiAnalyticsEnabled: true,
        aiForecastingEnabled: true,
        aiAnonymizationLevel: true,
        aiProvider: true,
        aiMonthlyBudgetCents: true,
      },
    });

    return updated;
  }

  @UseGuards(JwtAuthGuard)
  @Get('campgrounds/:campgroundId/usage')
  async getAiUsage(
    @Param('campgroundId') campgroundId: string,
    @Req() req: Request,
  ) {
    const org = (req as any).organizationId || null;

    const campground = await this.prisma.campground.findUnique({
      where: { id: campgroundId },
      select: { organizationId: true, aiTotalTokensUsed: true },
    });

    if (!campground) {
      throw new ForbiddenException('Campground not found');
    }

    if (org && campground.organizationId !== org) {
      throw new ForbiddenException('Access denied');
    }

    return this.gate.getUsageStats(campgroundId, 30);
  }

  // ==================== SENTIMENT ANALYSIS ====================

  /**
   * Get sentiment analysis statistics for dashboard
   */
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.owner, UserRole.manager, UserRole.front_desk)
  @Get('campgrounds/:campgroundId/sentiment')
  async getSentimentStats(
    @Param('campgroundId') campgroundId: string,
    @Req() req: Request,
  ) {
    const org = (req as any).organizationId || null;

    const campground = await this.prisma.campground.findUnique({
      where: { id: campgroundId },
      select: { organizationId: true },
    });

    if (!campground) {
      throw new ForbiddenException('Campground not found');
    }

    if (org && campground.organizationId !== org) {
      throw new ForbiddenException('Access denied');
    }

    return this.sentimentService.getSentimentStats(campgroundId);
  }

  /**
   * Get sentiment stats for a date range
   */
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.owner, UserRole.manager, UserRole.front_desk)
  @Get('campgrounds/:campgroundId/sentiment/range')
  async getSentimentStatsRange(
    @Param('campgroundId') campgroundId: string,
    @Req() req: Request,
  ) {
    const org = (req as any).organizationId || null;
    const query = (req as any).query || {};
    const startDate = query.startDate ? new Date(query.startDate) : undefined;
    const endDate = query.endDate ? new Date(query.endDate) : undefined;

    const campground = await this.prisma.campground.findUnique({
      where: { id: campgroundId },
      select: { organizationId: true },
    });

    if (!campground) {
      throw new ForbiddenException('Campground not found');
    }

    if (org && campground.organizationId !== org) {
      throw new ForbiddenException('Access denied');
    }

    return this.sentimentService.getSentimentStats(campgroundId, { startDate, endDate });
  }

  /**
   * Manually trigger sentiment analysis for a communication
   */
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.owner, UserRole.manager)
  @Post('communications/:communicationId/analyze-sentiment')
  async analyzeCommunicationSentiment(
    @Param('communicationId') communicationId: string,
  ) {
    return this.sentimentService.analyzeCommunication(communicationId);
  }

  // ==================== MORNING BRIEFING ====================

  /**
   * Get today's morning briefing
   */
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.owner, UserRole.manager, UserRole.front_desk)
  @Get('campgrounds/:campgroundId/briefing')
  async getMorningBriefing(
    @Param('campgroundId') campgroundId: string,
    @Req() req: Request,
  ) {
    const org = (req as any).organizationId || null;

    const campground = await this.prisma.campground.findUnique({
      where: { id: campgroundId },
      select: { organizationId: true },
    });

    if (!campground) {
      throw new ForbiddenException('Campground not found');
    }

    if (org && campground.organizationId !== org) {
      throw new ForbiddenException('Access denied');
    }

    return this.morningBriefingService.getBriefingForApi(campgroundId);
  }

  /**
   * Manually send morning briefing emails
   */
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.owner, UserRole.manager)
  @Post('campgrounds/:campgroundId/briefing/send')
  async sendMorningBriefing(
    @Param('campgroundId') campgroundId: string,
    @Req() req: Request,
  ) {
    const org = (req as any).organizationId || null;

    const campground = await this.prisma.campground.findUnique({
      where: { id: campgroundId },
      select: { organizationId: true },
    });

    if (!campground) {
      throw new ForbiddenException('Campground not found');
    }

    if (org && campground.organizationId !== org) {
      throw new ForbiddenException('Access denied');
    }

    return this.morningBriefingService.sendBriefingEmail(campgroundId);
  }

  // ==================== AI REPORT QUERIES ====================

  /**
   * Parse a natural language report query
   */
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.owner, UserRole.manager, UserRole.finance)
  @Post('campgrounds/:campgroundId/reports/parse')
  async parseReportQuery(
    @Param('campgroundId') campgroundId: string,
    @Body() body: { query: string },
    @Req() req: Request,
  ) {
    const org = (req as any).organizationId || null;
    const userId = (req as any).user?.id;

    const campground = await this.prisma.campground.findUnique({
      where: { id: campgroundId },
      select: { organizationId: true },
    });

    if (!campground) {
      throw new ForbiddenException('Campground not found');
    }

    if (org && campground.organizationId !== org) {
      throw new ForbiddenException('Access denied');
    }

    return this.reportQueryService.parseQuery(campgroundId, body.query, userId);
  }

  /**
   * Generate narrative for report results
   */
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.owner, UserRole.manager, UserRole.finance)
  @Post('campgrounds/:campgroundId/reports/narrative')
  async generateReportNarrative(
    @Param('campgroundId') campgroundId: string,
    @Body() body: {
      reportName: string;
      rows: Record<string, any>[];
      metrics: string[];
      dimensions: string[];
      timeRange?: { start?: string; end?: string; preset?: string };
    },
    @Req() req: Request,
  ) {
    const org = (req as any).organizationId || null;
    const userId = (req as any).user?.id;

    const campground = await this.prisma.campground.findUnique({
      where: { id: campgroundId },
      select: { organizationId: true },
    });

    if (!campground) {
      throw new ForbiddenException('Campground not found');
    }

    if (org && campground.organizationId !== org) {
      throw new ForbiddenException('Access denied');
    }

    return this.reportQueryService.generateNarrative(
      campgroundId,
      body.reportName,
      {
        rows: body.rows,
        metrics: body.metrics,
        dimensions: body.dimensions,
        timeRange: body.timeRange,
      },
      userId
    );
  }

  /**
   * Get suggested report queries
   */
  @UseGuards(JwtAuthGuard)
  @Get('campgrounds/:campgroundId/reports/suggestions')
  async getReportSuggestions(
    @Param('campgroundId') campgroundId: string,
    @Req() req: Request,
  ) {
    const org = (req as any).organizationId || null;
    const query = (req as any).query || {};
    const category = query.category as string | undefined;

    const campground = await this.prisma.campground.findUnique({
      where: { id: campgroundId },
      select: { organizationId: true },
    });

    if (!campground) {
      throw new ForbiddenException('Campground not found');
    }

    if (org && campground.organizationId !== org) {
      throw new ForbiddenException('Access denied');
    }

    return {
      suggestions: this.reportQueryService.getSuggestedQueries(category),
      categories: this.reportQueryService.getReportCategories(),
    };
  }

  // ==================== AI CAMPAIGN CONTENT ====================

  /**
   * Generate email subject line options
   */
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.owner, UserRole.manager)
  @Post('campgrounds/:campgroundId/campaigns/subject-lines')
  async generateSubjectLines(
    @Param('campgroundId') campgroundId: string,
    @Body() body: {
      campaignType: string;
      targetAudience?: string;
      promotion?: string;
      seasonOrEvent?: string;
      previousSubject?: string;
      count?: number;
    },
    @Req() req: Request,
  ) {
    const org = (req as any).organizationId || null;

    const campground = await this.prisma.campground.findUnique({
      where: { id: campgroundId },
      select: { organizationId: true, name: true },
    });

    if (!campground) {
      throw new ForbiddenException('Campground not found');
    }

    if (org && campground.organizationId !== org) {
      throw new ForbiddenException('Access denied');
    }

    return this.campaignService.generateSubjectLines(
      campgroundId,
      {
        campaignType: body.campaignType,
        targetAudience: body.targetAudience,
        promotion: body.promotion,
        seasonOrEvent: body.seasonOrEvent,
        campgroundName: campground.name,
        previousSubject: body.previousSubject,
      },
      body.count
    );
  }

  /**
   * Generate email body content
   */
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.owner, UserRole.manager)
  @Post('campgrounds/:campgroundId/campaigns/content')
  async generateCampaignContent(
    @Param('campgroundId') campgroundId: string,
    @Body() body: {
      campaignType: string;
      subject: string;
      targetAudience?: string;
      promotion?: string;
      seasonOrEvent?: string;
    },
    @Req() req: Request,
  ) {
    const org = (req as any).organizationId || null;

    const campground = await this.prisma.campground.findUnique({
      where: { id: campgroundId },
      select: { organizationId: true, name: true },
    });

    if (!campground) {
      throw new ForbiddenException('Campground not found');
    }

    if (org && campground.organizationId !== org) {
      throw new ForbiddenException('Access denied');
    }

    return this.campaignService.generateContent(campgroundId, {
      campaignType: body.campaignType,
      subject: body.subject,
      targetAudience: body.targetAudience,
      promotion: body.promotion,
      seasonOrEvent: body.seasonOrEvent,
      campgroundName: campground.name,
    });
  }

  /**
   * Get optimal send time suggestions
   */
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.owner, UserRole.manager)
  @Post('campgrounds/:campgroundId/campaigns/send-times')
  async suggestSendTimes(
    @Param('campgroundId') campgroundId: string,
    @Body() body: {
      campaignType: string;
      targetAudience?: string;
    },
    @Req() req: Request,
  ) {
    const org = (req as any).organizationId || null;

    const campground = await this.prisma.campground.findUnique({
      where: { id: campgroundId },
      select: { organizationId: true },
    });

    if (!campground) {
      throw new ForbiddenException('Campground not found');
    }

    if (org && campground.organizationId !== org) {
      throw new ForbiddenException('Access denied');
    }

    return this.campaignService.suggestSendTimes(
      campgroundId,
      body.campaignType,
      body.targetAudience
    );
  }

  /**
   * Improve existing email content
   */
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.owner, UserRole.manager)
  @Post('campgrounds/:campgroundId/campaigns/improve')
  async improveContent(
    @Param('campgroundId') campgroundId: string,
    @Body() body: {
      subject?: string;
      body?: string;
      goal: 'clarity' | 'urgency' | 'warmth' | 'brevity' | 'persuasion';
    },
    @Req() req: Request,
  ) {
    const org = (req as any).organizationId || null;

    const campground = await this.prisma.campground.findUnique({
      where: { id: campgroundId },
      select: { organizationId: true },
    });

    if (!campground) {
      throw new ForbiddenException('Campground not found');
    }

    if (org && campground.organizationId !== org) {
      throw new ForbiddenException('Access denied');
    }

    return this.campaignService.improveContent(
      campgroundId,
      { subject: body.subject, body: body.body },
      body.goal
    );
  }

  /**
   * Generate A/B test variation
   */
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.owner, UserRole.manager)
  @Post('campgrounds/:campgroundId/campaigns/ab-test')
  async generateAbTest(
    @Param('campgroundId') campgroundId: string,
    @Body() body: {
      subject: string;
      body?: string;
      testElement: 'subject' | 'cta' | 'opening';
    },
    @Req() req: Request,
  ) {
    const org = (req as any).organizationId || null;

    const campground = await this.prisma.campground.findUnique({
      where: { id: campgroundId },
      select: { organizationId: true },
    });

    if (!campground) {
      throw new ForbiddenException('Campground not found');
    }

    if (org && campground.organizationId !== org) {
      throw new ForbiddenException('Access denied');
    }

    return this.campaignService.generateAbTest(
      campgroundId,
      { subject: body.subject, body: body.body },
      body.testElement
    );
  }

  // ==================== SMART COMPOSE ====================

  /**
   * Get inline completion suggestion as user types
   */
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.owner, UserRole.manager, UserRole.front_desk)
  @Post('campgrounds/:campgroundId/compose/complete')
  async getInlineCompletion(
    @Param('campgroundId') campgroundId: string,
    @Body() body: {
      text: string;
      cursorPosition: number;
      recipientType: 'guest' | 'staff' | 'vendor';
      messageType: 'email' | 'sms' | 'internal';
      conversationId?: string;
      guestName?: string;
      priorMessages?: Array<{ role: 'guest' | 'staff'; content: string }>;
    },
    @Req() req: Request,
  ) {
    const org = (req as any).organizationId || null;
    const userId = (req as any).user?.id;

    const campground = await this.prisma.campground.findUnique({
      where: { id: campgroundId },
      select: { organizationId: true },
    });

    if (!campground) {
      throw new ForbiddenException('Campground not found');
    }

    if (org && campground.organizationId !== org) {
      throw new ForbiddenException('Access denied');
    }

    return this.smartComposeService.getInlineCompletion(
      {
        campgroundId,
        conversationId: body.conversationId,
        guestName: body.guestName,
        recipientType: body.recipientType,
        messageType: body.messageType,
        priorMessages: body.priorMessages,
      },
      body.text,
      body.cursorPosition,
      userId
    );
  }

  /**
   * Check grammar and tone of message
   */
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.owner, UserRole.manager, UserRole.front_desk)
  @Post('campgrounds/:campgroundId/compose/check')
  async checkGrammarAndTone(
    @Param('campgroundId') campgroundId: string,
    @Body() body: {
      text: string;
      recipientType: 'guest' | 'staff' | 'vendor';
      messageType: 'email' | 'sms' | 'internal';
    },
    @Req() req: Request,
  ) {
    const org = (req as any).organizationId || null;
    const userId = (req as any).user?.id;

    const campground = await this.prisma.campground.findUnique({
      where: { id: campgroundId },
      select: { organizationId: true },
    });

    if (!campground) {
      throw new ForbiddenException('Campground not found');
    }

    if (org && campground.organizationId !== org) {
      throw new ForbiddenException('Access denied');
    }

    return this.smartComposeService.checkGrammarAndTone(
      {
        campgroundId,
        recipientType: body.recipientType,
        messageType: body.messageType,
      },
      body.text,
      userId
    );
  }

  /**
   * Get quick reply templates
   */
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.owner, UserRole.manager, UserRole.front_desk)
  @Get('campgrounds/:campgroundId/compose/quick-replies')
  async getQuickReplies(
    @Param('campgroundId') campgroundId: string,
    @Req() req: Request,
  ) {
    const org = (req as any).organizationId || null;
    const userId = (req as any).user?.id;

    const campground = await this.prisma.campground.findUnique({
      where: { id: campgroundId },
      select: { organizationId: true },
    });

    if (!campground) {
      throw new ForbiddenException('Campground not found');
    }

    if (org && campground.organizationId !== org) {
      throw new ForbiddenException('Access denied');
    }

    return this.smartComposeService.getQuickReplies(
      {
        campgroundId,
        recipientType: 'guest',
        messageType: 'email',
      },
      userId
    );
  }
}
