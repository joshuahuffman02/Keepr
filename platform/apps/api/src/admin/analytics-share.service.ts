import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { GuestAnalyticsService } from "./guest-analytics.service";
import { AnalyticsType, ShareAccessLevel, SegmentScope, Prisma } from "@prisma/client";
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
    private guestAnalyticsService: GuestAnalyticsService,
  ) {}

  async createShareLink(request: CreateShareRequest, userId: string, userEmail: string) {
    // Generate a secure token
    const token = this.generateToken();

    // Hash password if provided
    const hashedPassword = request.password ? await this.hashPassword(request.password) : null;

    // Calculate expiration
    const expiresAt = request.expiresIn
      ? new Date(Date.now() + request.expiresIn * 60 * 60 * 1000)
      : null;

    const scope = request.campgroundId
      ? SegmentScope.campground
      : request.organizationId
        ? SegmentScope.organization
        : SegmentScope.global;
    const data: Prisma.AnalyticsShareLinkUncheckedCreateInput = {
      id: crypto.randomUUID(),
      token,
      analyticsType: request.analyticsType,
      accessLevel: request.accessLevel || ShareAccessLevel.view_only,
      scope,
      dateRange: request.dateRange || "last_30_days",
      name: request.name,
      description: request.description,
      password: hashedPassword,
      expiresAt,
      maxViews: request.maxViews,
      sharedBy: userId,
      sharedByEmail: userEmail,
      ...(request.campgroundId ? { campgroundId: request.campgroundId } : {}),
      ...(request.organizationId ? { organizationId: request.organizationId } : {}),
      ...(request.segmentId ? { segmentId: request.segmentId } : {}),
    };
    const shareLink = await this.prisma.analyticsShareLink.create({ data });

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
        Campground: {
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
      shareLink.dateRange || "last_30_days",
    );

    return {
      analyticsType: shareLink.analyticsType,
      accessLevel: shareLink.accessLevel,
      dateRange: shareLink.dateRange,
      name: shareLink.name,
      description: shareLink.description,
      campground: shareLink.Campground,
      data,
      canDownload: shareLink.accessLevel === ShareAccessLevel.downloadable,
    };
  }

  private async fetchAnalyticsData(analyticsType: AnalyticsType, dateRange: string) {
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
    const links = await this.prisma.analyticsShareLink.findMany({
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
        Campground: {
          select: { id: true, name: true },
        },
      },
    });
    return links.map(({ Campground, ...rest }) => ({
      ...rest,
      campground: Campground,
    }));
  }

  async getShareLink(id: string, userId: string) {
    const shareLink = await this.prisma.analyticsShareLink.findUnique({
      where: { id },
      include: {
        Campground: {
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

    const { Campground, ...rest } = shareLink;
    return { ...rest, campground: Campground };
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
    },
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

  /**
   * Hash password using PBKDF2-SHA512 with 600,000 iterations.
   *
   * Security rationale:
   * - OWASP (2023) recommends 600,000 iterations for PBKDF2-SHA512
   * - NIST SP 800-63B recommends at least 10,000 iterations
   * - Higher iteration counts increase computational cost of brute-force attacks
   * - 600,000 iterations provides strong protection against GPU/ASIC attacks
   *
   * Format: iterations:salt:hash
   * The iteration count is stored in the hash to support future increases
   * and backwards compatibility with legacy 1,000-iteration hashes.
   */
  private async hashPassword(password: string): Promise<string> {
    const iterations = 600000; // OWASP 2023 recommendation for PBKDF2-SHA512
    const salt = crypto.randomBytes(16).toString("hex");
    const hash = crypto.pbkdf2Sync(password, salt, iterations, 64, "sha512").toString("hex");
    return `${iterations}:${salt}:${hash}`;
  }

  /**
   * Verify password against stored hash with backwards compatibility.
   *
   * Supports both:
   * - Legacy format: salt:hash (1,000 iterations assumed)
   * - Modern format: iterations:salt:hash
   *
   * If a legacy hash is successfully verified, it should be upgraded
   * to the modern format on the next password change.
   */
  private async verifyPassword(password: string, storedHash: string): Promise<boolean> {
    const parts = storedHash.split(":");

    let iterations: number;
    let salt: string;
    let hash: string;

    if (parts.length === 3) {
      // Modern format: iterations:salt:hash
      iterations = parseInt(parts[0], 10);
      salt = parts[1];
      hash = parts[2];
    } else if (parts.length === 2) {
      // Legacy format: salt:hash (assumes 1,000 iterations)
      iterations = 1000;
      salt = parts[0];
      hash = parts[1];
    } else {
      // Invalid hash format
      return false;
    }

    const verifyHash = crypto.pbkdf2Sync(password, salt, iterations, 64, "sha512").toString("hex");
    return hash === verifyHash;
  }
}
