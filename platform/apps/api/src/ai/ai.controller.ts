import { Controller, Get, Post, Patch, Param, Body, UseGuards, Req, ForbiddenException, Logger } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards';
import { RolesGuard, Roles } from '../auth/guards/roles.guard';
import { UserRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AiFeatureGateService } from './ai-feature-gate.service';
import { AiBookingAssistService } from './ai-booking-assist.service';
import { AiSupportService } from './ai-support.service';
import { AiPartnerService } from './ai-partner.service';
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
   * Provides AI-powered help with using Camp Everyday
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
    if (body.aiProvider) updateData.aiProvider = body.aiProvider;
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
}
