import { ForbiddenException, Injectable } from "@nestjs/common";
import { GamificationEventCategory, Prisma, UserRole } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { AwardXpDto, UpdateGamificationSettingsDto, UpsertXpRuleDto } from "./dto/gamification.dto";
import { randomUUID } from "crypto";

type PrismaClientLike = PrismaService | Prisma.TransactionClient;

export interface LevelProgress {
  level: number;
  name?: string | null;
  minXp: number;
  nextLevel?: number | null;
  nextMinXp?: number | null;
  progressToNext: number; // 0-1
}

export function roleAllowed(setting: { enabledRoles?: UserRole[] }, role?: UserRole | null) {
  if (!setting.enabledRoles || setting.enabledRoles.length === 0) return true;
  if (!role) return false;
  return setting.enabledRoles.includes(role);
}

export function resolveXpAmount(
  inputXp: number | undefined,
  rule?: { minXp: number; maxXp: number; defaultXp: number } | null,
) {
  const base = inputXp ?? rule?.defaultXp ?? 10;
  if (!rule) return base;
  const clampedMin = rule.minXp ?? base;
  const clampedMax = rule.maxXp ?? base;
  return Math.min(clampedMax || base, Math.max(clampedMin || base, base));
}

export function computeLevel(
  totalXp: number,
  levels: { level: number; minXp: number; name?: string | null }[],
): LevelProgress {
  if (!levels || levels.length === 0) {
    return { level: 1, minXp: 0, progressToNext: 0, nextLevel: null, nextMinXp: null, name: null };
  }
  const sorted = [...levels].sort((a, b) => a.minXp - b.minXp);
  let current = sorted[0];
  for (const lvl of sorted) {
    if (lvl.minXp <= totalXp) current = lvl;
    else break;
  }
  const next = sorted.find((lvl) => lvl.minXp > totalXp) ?? null;
  const progressToNext = next
    ? Math.min(1, Math.max(0, (totalXp - current.minXp) / Math.max(1, next.minXp - current.minXp)))
    : 1;
  return {
    level: current.level,
    name: current.name,
    minXp: current.minXp,
    nextLevel: next?.level ?? null,
    nextMinXp: next?.minXp ?? null,
    progressToNext,
  };
}

const toJsonValue = (value: unknown): Prisma.InputJsonValue | undefined => {
  if (value === undefined || value === null) return undefined;
  try {
    return JSON.parse(JSON.stringify(value));
  } catch {
    return undefined;
  }
};

@Injectable()
export class GamificationService {
  constructor(private prisma: PrismaService) {}

  private defaultRules = [
    { category: GamificationEventCategory.task, minXp: 5, maxXp: 25, defaultXp: 10 },
    { category: GamificationEventCategory.maintenance, minXp: 10, maxXp: 40, defaultXp: 20 },
    { category: GamificationEventCategory.check_in, minXp: 5, maxXp: 25, defaultXp: 15 },
    { category: GamificationEventCategory.reservation_quality, minXp: 5, maxXp: 20, defaultXp: 10 },
    { category: GamificationEventCategory.checklist, minXp: 2, maxXp: 10, defaultXp: 5 },
    { category: GamificationEventCategory.review_mention, minXp: 15, maxXp: 50, defaultXp: 25 },
    { category: GamificationEventCategory.on_time_assignment, minXp: 5, maxXp: 20, defaultXp: 10 },
    { category: GamificationEventCategory.assist, minXp: 5, maxXp: 20, defaultXp: 10 },
    { category: GamificationEventCategory.manual, minXp: 5, maxXp: 100, defaultXp: 25 },
    { category: GamificationEventCategory.other, minXp: 1, maxXp: 10, defaultXp: 5 },
    { category: GamificationEventCategory.payment_collection, minXp: 10, maxXp: 30, defaultXp: 15 },
  ];

  async getSettings(campgroundId: string) {
    const setting = await this.prisma.gamificationSetting.findUnique({
      where: { campgroundId },
    });
    return setting ?? { campgroundId, enabled: false, enabledRoles: [] };
  }

  private async getMembership(userId: string, campgroundId: string) {
    return this.prisma.campgroundMembership.findFirst({
      where: { userId, campgroundId },
    });
  }

  private async assertManager(userId: string, campgroundId: string) {
    const membership = await this.getMembership(userId, campgroundId);
    const allowedRoles: UserRole[] = [UserRole.owner, UserRole.manager];
    if (!membership || !allowedRoles.includes(membership.role)) {
      throw new ForbiddenException("Manager or owner role required for gamification settings");
    }
    return membership;
  }

  private async getLevelDefinitions(client: PrismaClientLike = this.prisma) {
    return client.levelDefinition.findMany({
      orderBy: { minXp: "asc" },
    });
  }

  async updateSettings(userId: string, dto: UpdateGamificationSettingsDto) {
    await this.assertManager(userId, dto.campgroundId);
    const setting = await this.prisma.gamificationSetting.upsert({
      where: { campgroundId: dto.campgroundId },
      create: {
        id: randomUUID(),
        campgroundId: dto.campgroundId,
        enabled: dto.enabled ?? false,
        enabledRoles: dto.enabledRoles ?? [],
        updatedAt: new Date(),
      },
      update: {
        enabled: dto.enabled ?? false,
        enabledRoles: dto.enabledRoles ?? [],
        updatedAt: new Date(),
      },
    });

    if (setting.enabled) {
      const existingRules = await this.prisma.xpRule.count({
        where: { campgroundId: dto.campgroundId },
      });
      if (existingRules === 0) {
        await this.prisma.xpRule.createMany({
          data: this.defaultRules.map((r) => ({
            id: randomUUID(),
            campgroundId: dto.campgroundId,
            category: r.category,
            minXp: r.minXp,
            maxXp: r.maxXp,
            defaultXp: r.defaultXp,
            isActive: true,
            createdById: userId,
          })),
          skipDuplicates: true,
        });
      }
    }

    return setting;
  }

  async getSettingsForManager(userId: string, campgroundId: string) {
    await this.assertManager(userId, campgroundId);
    return this.getSettings(campgroundId);
  }

  async getRules(userId: string, campgroundId: string) {
    await this.assertManager(userId, campgroundId);
    return this.prisma.xpRule.findMany({
      where: { campgroundId },
      orderBy: { category: "asc" },
    });
  }

  async upsertRule(userId: string, dto: UpsertXpRuleDto) {
    await this.assertManager(userId, dto.campgroundId);
    return this.prisma.xpRule.upsert({
      where: { campgroundId_category: { campgroundId: dto.campgroundId, category: dto.category } },
      create: {
        id: randomUUID(),
        campgroundId: dto.campgroundId,
        category: dto.category,
        minXp: dto.minXp ?? 0,
        maxXp: dto.maxXp ?? 0,
        defaultXp: dto.defaultXp ?? 0,
        isActive: dto.isActive ?? true,
        createdById: userId,
        updatedAt: new Date(),
      },
      update: {
        minXp: dto.minXp ?? 0,
        maxXp: dto.maxXp ?? 0,
        defaultXp: dto.defaultXp ?? 0,
        isActive: dto.isActive ?? true,
        updatedAt: new Date(),
      },
    });
  }

  async getLevels() {
    return this.getLevelDefinitions();
  }

  async recordEvent(params: {
    campgroundId: string;
    userId: string;
    membershipId?: string;
    category: GamificationEventCategory;
    xpOverride?: number;
    reason?: string;
    sourceType?: string;
    sourceId?: string;
    eventKey?: string;
    metadata?: unknown;
  }) {
    const [setting, membership, rule] = await Promise.all([
      this.getSettings(params.campgroundId),
      this.getMembership(params.userId, params.campgroundId),
      this.prisma.xpRule.findUnique({
        where: {
          campgroundId_category: { campgroundId: params.campgroundId, category: params.category },
        },
      }),
    ]);

    if (!membership) {
      return {
        skipped: true,
        reason: "User is not a member of this campground",
        setting,
        membershipRole: null,
      };
    }

    if (!setting.enabled) {
      return {
        skipped: true,
        reason: "Gamification is disabled for this campground",
        setting,
        membershipRole: membership.role,
      };
    }

    if (!roleAllowed(setting, membership.role)) {
      return {
        skipped: true,
        reason: "Gamification disabled for this role",
        setting,
        membershipRole: membership.role,
      };
    }

    const xpAmount = resolveXpAmount(params.xpOverride, rule);
    if (xpAmount === 0) {
      return {
        skipped: true,
        reason: "XP resolved to zero; skipping",
        setting,
        membershipRole: membership.role,
      };
    }

    const levels = await this.getLevelDefinitions();

    const result = await this.prisma.$transaction(async (tx) => {
      let event;
      try {
        event = await tx.xpEvent.create({
          data: {
            id: randomUUID(),
            campgroundId: params.campgroundId,
            userId: params.userId,
            membershipId: params.membershipId ?? membership.id,
            category: params.category,
            xp: xpAmount,
            reason: params.reason,
            sourceType: params.sourceType,
            sourceId: params.sourceId,
            eventKey: params.eventKey,
            metadata: toJsonValue(params.metadata),
          },
        });
      } catch (err: unknown) {
        const isUniqueKey =
          err instanceof Prisma.PrismaClientKnownRequestError &&
          err.code === "P2002" &&
          params.eventKey;
        if (isUniqueKey) {
          event = await tx.xpEvent.findUnique({ where: { eventKey: params.eventKey } });
        } else {
          throw err;
        }
      }

      if (!event) {
        return {
          skipped: true,
          reason: "Event was not created",
          setting,
          membershipRole: membership.role,
        };
      }

      const balance = await tx.xpBalance.upsert({
        where: {
          campgroundId_userId: { campgroundId: params.campgroundId, userId: params.userId },
        },
        create: {
          id: randomUUID(),
          campgroundId: params.campgroundId,
          userId: params.userId,
          totalXp: xpAmount,
          currentLevel: 1,
          lastEventAt: event.createdAt,
        },
        update: {
          totalXp: { increment: xpAmount },
          lastEventAt: event.createdAt,
        },
      });

      const levelInfo = computeLevel(balance.totalXp, levels);
      const updatedBalance = await tx.xpBalance.update({
        where: { id: balance.id },
        data: { currentLevel: levelInfo.level },
      });

      return { event, balance: updatedBalance, level: levelInfo, ruleApplied: rule?.id };
    });

    return { ...result, setting, membershipRole: membership.role, skipped: false };
  }

  async manualAward(actorId: string, dto: AwardXpDto) {
    await this.assertManager(actorId, dto.campgroundId);
    return this.recordEvent({
      campgroundId: dto.campgroundId,
      userId: dto.targetUserId,
      membershipId: dto.membershipId,
      category: dto.category,
      xpOverride: dto.xp,
      reason: dto.reason ?? "Merit XP",
      sourceType: dto.sourceType ?? "manual_award",
      sourceId: dto.sourceId,
      eventKey: dto.eventKey,
      metadata: dto.metadata,
    });
  }

  async getDashboard(userId: string, campgroundId: string) {
    const [setting, membership] = await Promise.all([
      this.getSettings(campgroundId),
      this.getMembership(userId, campgroundId),
    ]);

    if (!membership) {
      return { enabled: false, allowed: false, membershipRole: null, setting };
    }

    const allowed = roleAllowed(setting, membership.role);
    if (!setting.enabled || !allowed) {
      return {
        enabled: false,
        allowed,
        membershipRole: membership.role,
        setting,
      };
    }

    const [balance, recentEvents, levels] = await Promise.all([
      this.prisma.xpBalance.findUnique({
        where: { campgroundId_userId: { campgroundId, userId } },
      }),
      this.prisma.xpEvent.findMany({
        where: { campgroundId, userId },
        orderBy: { createdAt: "desc" },
        take: 20,
      }),
      this.getLevelDefinitions(),
    ]);

    const totalXp = balance?.totalXp ?? 0;
    const level = computeLevel(totalXp, levels);

    return {
      enabled: true,
      allowed: true,
      membershipRole: membership.role,
      setting,
      balance: balance ?? {
        id: null,
        campgroundId,
        userId,
        totalXp,
        currentLevel: level.level,
        lastEventAt: null,
        createdAt: null,
        updatedAt: null,
      },
      level,
      recentEvents,
    };
  }

  async getLeaderboard(params: {
    campgroundId: string;
    viewerId: string;
    days?: number;
    limit?: number;
  }) {
    const { campgroundId, viewerId } = params;
    const days = params.days ?? 7;
    const limit = params.limit ?? 5;
    const since =
      days > 0
        ? (() => {
            const d = new Date();
            d.setDate(d.getDate() - days);
            return d;
          })()
        : null;

    const rows = await this.prisma.xpEvent.groupBy({
      by: ["userId"],
      where: { campgroundId, ...(since ? { createdAt: { gte: since } } : {}) },
      _sum: { xp: true },
      orderBy: { _sum: { xp: "desc" } },
      take: limit,
    });

    const userIds = rows.map((r) => r.userId);
    const users = await this.prisma.user.findMany({
      where: { id: { in: userIds } },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        CampgroundMembership: {
          where: { campgroundId },
          select: { role: true },
        },
      },
    });
    const userMap = new Map(users.map((u) => [u.id, u]));

    const leaderboard = rows.map((r, idx) => {
      const u = userMap.get(r.userId);
      return {
        userId: r.userId,
        rank: idx + 1,
        xp: r._sum.xp ?? 0,
        name: u ? `${u.firstName ?? ""} ${u.lastName ?? ""}`.trim() || u.email : "Unknown",
        role: u?.CampgroundMembership?.[0]?.role ?? null,
      };
    });

    const viewerRow = leaderboard.find((r) => r.userId === viewerId);
    let viewer = viewerRow;
    if (!viewerRow) {
      const viewerAgg = await this.prisma.xpEvent.groupBy({
        by: ["userId"],
        where: { campgroundId, ...(since ? { createdAt: { gte: since } } : {}), userId: viewerId },
        _sum: { xp: true },
      });
      if (viewerAgg[0]) {
        const u = await this.prisma.user.findUnique({
          where: { id: viewerId },
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            CampgroundMembership: { where: { campgroundId }, select: { role: true } },
          },
        });
        viewer = {
          userId: viewerId,
          rank: 0,
          xp: viewerAgg[0]._sum.xp ?? 0,
          name: u ? `${u.firstName ?? ""} ${u.lastName ?? ""}`.trim() || u.email : "You",
          role: u?.CampgroundMembership?.[0]?.role ?? null,
        };
      }
    }

    return { leaderboard, viewer, since };
  }

  async getStats(campgroundId: string, days: number = 30) {
    const since = new Date();
    since.setDate(since.getDate() - days);
    const categories = await this.prisma.xpEvent.groupBy({
      by: ["category"],
      where: { campgroundId, createdAt: { gte: since } },
      _sum: { xp: true },
      orderBy: { _sum: { xp: "desc" } },
    });
    return {
      categories: categories.map((c) => ({ category: c.category, xp: c._sum.xp ?? 0 })),
      since,
    };
  }
}
