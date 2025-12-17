import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { GuestAnalyticsService } from "./guest-analytics.service";
import {
  AnalyticsType,
  ShareAccessLevel,
  SegmentScope,
} from "@prisma/client";
import * as crypto from "crypto";

interface CreateShareRequest {
  analyticsType: AnalyticsType;
  accessLevel?: ShareAccessLevel;
  campgroundId?: string;
  organizationId?: string;
  segmentId?: string;
  dateRange?: string;
  name?: string;
  description?: string;
  password?: string;
  expiresIn?: number; // hours
  maxViews?: number;
}

@Injectable()
export class AnalyticsShareService {
  constructor(
    private prisma: PrismaService,
    private guestAnalyticsService: GuestAnalyticsService
  ) {}

  async createShareLink(
    request: CreateShareRequest,
    userId: string,
    userEmail: string
  ) {
    // Generate a secure token
    const token = this.generateToken();

    // Hash password if provided
    const hashedPassword = request.password
      ? await this.hashPassword(request.password)
      : null;

    // Calculate expiration
    const expiresAt = request.expiresIn
      ? new Date(Date.now() + request.expiresIn * 60 * 60 * 1000)
      : null;

    const shareLink = await this.prisma.analyticsShareLink.create({
      data: {
        token,
        analyticsType: request.analyticsType,
        accessLevel: request.accessLevel || ShareAccessLevel.view_only,
        scope: request.campgroundId
          ? SegmentScope.campground
          : request.organizationId
          ? SegmentScope.organization
          : SegmentScope.global,
        campgroundId: request.campgroundId,
        organizationId: request.organizationId,
        segmentId: request.segmentId,
        dateRange: request.dateRange || "last_30_days",
        name: request.name,
        description: request.description,
        password: hashedPassword,
        expiresAt,
        maxViews: request.maxViews,
        sharedBy: userId,
        sharedByEmail: userEmail,
      },
    });

    return {
      id: shareLink.id,
      token: shareLink.token,
      shareUrl: `/shared/analytics/${shareLink.token}`,
      expiresAt: shareLink.expiresAt,
      accessLevel: shareLink.accessLevel,
    };
  }

  async accessSharedAnalytics(token: string, password?: string) {
    const shareLink = await this.prisma.analyticsShareLink.findUnique({
      where: { token },
      include: {
        campground: {
          select: { id: true, name: true, slug: true },
        },
      },
    });

    if (!shareLink) {
      throw new NotFoundException("Share link not found");
    }

    // Check if revoked
    if (shareLink.revokedAt) {
      throw new ForbiddenException("This share link has been revoked");
    }

    // Check expiration
    if (shareLink.expiresAt && shareLink.expiresAt < new Date()) {
      throw new ForbiddenException("This share link has expired");
    }

    // Check view limit
    if (shareLink.maxViews && shareLink.viewCount >= shareLink.maxViews) {
      throw new ForbiddenException("This share link has reached its view limit");
    }

    // Check password if required
    if (shareLink.password) {
      if (!password) {
        throw new BadRequestException("Password required");
      }
      const valid = await this.verifyPassword(password, shareLink.password);
      if (!valid) {
        throw new ForbiddenException("Invalid password");
      }
    }

    // Increment view count and update last accessed
    await this.prisma.analyticsShareLink.update({
      where: { id: shareLink.id },
      data: {
        viewCount: { increment: 1 },
        lastAccessedAt: new Date(),
      },
    });

    // Fetch the analytics data
    const data = await this.fetchAnalyticsData(
      shareLink.analyticsType,
      shareLink.dateRange || "last_30_days"
    );

    return {
      analyticsType: shareLink.analyticsType,
      accessLevel: shareLink.accessLevel,
      dateRange: shareLink.dateRange,
      name: shareLink.name,
      description: shareLink.description,
      campground: shareLink.campground,
      data,
      canDownload: shareLink.accessLevel === ShareAccessLevel.downloadable,
    };
  }

  private async fetchAnalyticsData(
    analyticsType: AnalyticsType,
    dateRange: string
  ) {
    switch (analyticsType) {
      case AnalyticsType.overview:
        return this.guestAnalyticsService.getOverview(dateRange);
      case AnalyticsType.geographic:
        return this.guestAnalyticsService.getGeographicData(dateRange);
      case AnalyticsType.demographics:
        return this.guestAnalyticsService.getDemographics(dateRange);
      case AnalyticsType.seasonal_trends:
        return this.guestAnalyticsService.getSeasonalTrends(dateRange);
      case AnalyticsType.travel_behavior:
        return this.guestAnalyticsService.getTravelBehavior(dateRange);
      case AnalyticsType.full_report:
        return this.guestAnalyticsService.getFullAnalytics(dateRange);
      default:
        return this.guestAnalyticsService.getOverview(dateRange);
    }
  }

  async listShareLinks(userId: string, limit = 20) {
    return this.prisma.analyticsShareLink.findMany({
      where: {
        sharedBy: userId,
        revokedAt: null,
      },
      orderBy: { createdAt: "desc" },
      take: limit,
      select: {
        id: true,
        token: true,
        analyticsType: true,
        accessLevel: true,
        name: true,
        description: true,
        expiresAt: true,
        maxViews: true,
        viewCount: true,
        createdAt: true,
        lastAccessedAt: true,
        campground: {
          select: { id: true, name: true },
        },
      },
    });
  }

  async getShareLink(id: string, userId: string) {
    const shareLink = await this.prisma.analyticsShareLink.findUnique({
      where: { id },
      include: {
        campground: {
          select: { id: true, name: true, slug: true },
        },
      },
    });

    if (!shareLink) {
      throw new NotFoundException("Share link not found");
    }

    if (shareLink.sharedBy !== userId) {
      throw new ForbiddenException("You don't have access to this share link");
    }

    return shareLink;
  }

  async revokeShareLink(id: string, userId: string) {
    const shareLink = await this.prisma.analyticsShareLink.findUnique({
      where: { id },
    });

    if (!shareLink) {
      throw new NotFoundException("Share link not found");
    }

    if (shareLink.sharedBy !== userId) {
      throw new ForbiddenException("You don't have permission to revoke this link");
    }

    return this.prisma.analyticsShareLink.update({
      where: { id },
      data: { revokedAt: new Date() },
    });
  }

  async updateShareLink(
    id: string,
    userId: string,
    updates: {
      name?: string;
      description?: string;
      expiresAt?: Date | null;
      maxViews?: number | null;
      accessLevel?: ShareAccessLevel;
    }
  ) {
    const shareLink = await this.prisma.analyticsShareLink.findUnique({
      where: { id },
    });

    if (!shareLink) {
      throw new NotFoundException("Share link not found");
    }

    if (shareLink.sharedBy !== userId) {
      throw new ForbiddenException("You don't have permission to update this link");
    }

    return this.prisma.analyticsShareLink.update({
      where: { id },
      data: updates,
    });
  }

  private generateToken(): string {
    return crypto.randomBytes(32).toString("hex");
  }

  private async hashPassword(password: string): Promise<string> {
    const salt = crypto.randomBytes(16).toString("hex");
    const hash = crypto
      .pbkdf2Sync(password, salt, 1000, 64, "sha512")
      .toString("hex");
    return `${salt}:${hash}`;
  }

  private async verifyPassword(
    password: string,
    storedHash: string
  ): Promise<boolean> {
    const [salt, hash] = storedHash.split(":");
    const verifyHash = crypto
      .pbkdf2Sync(password, salt, 1000, 64, "sha512")
      .toString("hex");
    return hash === verifyHash;
  }
}
