import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { OpTeam, OpTeamMember, OpTaskState } from "@prisma/client";
import type { Prisma } from "@prisma/client";
import { randomUUID } from "crypto";
import { CreateOpTeamDto, UpdateOpTeamDto, AddTeamMemberDto } from "../dto/op-task.dto";

type AvailableStaffMember = Prisma.UserGetPayload<{
  select: {
    id: true;
    firstName: true;
    lastName: true;
    email: true;
    OpTeamMember: {
      include: {
        OpTeam: { select: { id: true; name: true } };
      };
    };
  };
}>;

type TeamStats = {
  teamId: string;
  totalPending: number;
  byState: Record<string, number>;
  memberWorkload: Array<{ assignedToUserId: string | null; state: OpTaskState; _count: number }>;
  completedToday: number;
  memberCount: number;
};

@Injectable()
export class OpTeamService {
  constructor(private prisma: PrismaService) {}

  /**
   * Create a new team
   */
  async create(campgroundId: string, dto: CreateOpTeamDto): Promise<OpTeam> {
    // Check for duplicate name
    const existing = await this.prisma.opTeam.findFirst({
      where: { campgroundId, name: dto.name },
    });
    if (existing) {
      throw new ConflictException("A team with this name already exists");
    }

    return this.prisma.opTeam.create({
      data: {
        id: randomUUID(),
        campgroundId,
        name: dto.name,
        description: dto.description,
        color: dto.color ?? this.getRandomColor(),
        isActive: true,
        updatedAt: new Date(),
      },
      include: {
        OpTeamMember: {
          include: { User: { select: { id: true, firstName: true, lastName: true, email: true } } },
        },
      },
    });
  }

  /**
   * Find all teams for a campground
   */
  async findAll(campgroundId: string, options?: { isActive?: boolean }): Promise<OpTeam[]> {
    return this.prisma.opTeam.findMany({
      where: {
        campgroundId,
        ...(options?.isActive !== undefined && { isActive: options.isActive }),
      },
      orderBy: { name: "asc" },
      include: {
        OpTeamMember: {
          include: {
            User: { select: { id: true, firstName: true, lastName: true, email: true } },
          },
        },
        _count: { select: { OpTask: true } },
      },
    });
  }

  /**
   * Find a single team by ID
   */
  async findOne(id: string): Promise<OpTeam> {
    const team = await this.prisma.opTeam.findUnique({
      where: { id },
      include: {
        OpTeamMember: {
          include: {
            User: { select: { id: true, firstName: true, lastName: true, email: true } },
          },
        },
        _count: { select: { OpTask: true, OpTaskTemplate: true } },
      },
    });

    if (!team) {
      throw new NotFoundException("Team not found");
    }

    return team;
  }

  /**
   * Update a team
   */
  async update(id: string, dto: UpdateOpTeamDto): Promise<OpTeam> {
    const existing = await this.prisma.opTeam.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException("Team not found");
    }

    // Check for duplicate name if changing name
    if (dto.name && dto.name !== existing.name) {
      const duplicate = await this.prisma.opTeam.findFirst({
        where: {
          campgroundId: existing.campgroundId,
          name: dto.name,
          id: { not: id },
        },
      });
      if (duplicate) {
        throw new ConflictException("A team with this name already exists");
      }
    }

    return this.prisma.opTeam.update({
      where: { id },
      data: {
        ...(dto.name && { name: dto.name }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.color && { color: dto.color }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
        updatedAt: new Date(),
      },
      include: {
        OpTeamMember: {
          include: {
            User: { select: { id: true, firstName: true, lastName: true, email: true } },
          },
        },
      },
    });
  }

  /**
   * Delete a team
   */
  async delete(id: string): Promise<void> {
    const existing = await this.prisma.opTeam.findUnique({
      where: { id },
      include: { _count: { select: { OpTask: true } } },
    });

    if (!existing) {
      throw new NotFoundException("Team not found");
    }

    // Check if team has active tasks
    if (existing._count.OpTask > 0) {
      throw new ConflictException(
        "Cannot delete team with assigned tasks. Reassign or complete tasks first.",
      );
    }

    await this.prisma.opTeam.delete({ where: { id } });
  }

  /**
   * Add a member to a team
   */
  async addMember(teamId: string, dto: AddTeamMemberDto): Promise<OpTeamMember> {
    const team = await this.prisma.opTeam.findUnique({ where: { id: teamId } });
    if (!team) {
      throw new NotFoundException("Team not found");
    }

    // Verify user exists and has access to campground
    const user = await this.prisma.user.findFirst({
      where: {
        id: dto.userId,
        CampgroundMembership: { some: { campgroundId: team.campgroundId } },
      },
    });
    if (!user) {
      throw new BadRequestException("User not found or does not have access to this campground");
    }

    // Check if already a member
    const existing = await this.prisma.opTeamMember.findFirst({
      where: { teamId, userId: dto.userId },
    });
    if (existing) {
      throw new ConflictException("User is already a member of this team");
    }

    return this.prisma.opTeamMember.create({
      data: {
        id: randomUUID(),
        teamId,
        userId: dto.userId,
        role: dto.role ?? "member",
      },
      include: {
        User: { select: { id: true, firstName: true, lastName: true, email: true } },
      },
    });
  }

  /**
   * Remove a member from a team
   */
  async removeMember(teamId: string, userId: string): Promise<void> {
    const membership = await this.prisma.opTeamMember.findFirst({
      where: { teamId, userId },
    });

    if (!membership) {
      throw new NotFoundException("Team membership not found");
    }

    await this.prisma.opTeamMember.delete({
      where: { id: membership.id },
    });
  }

  /**
   * Update a member's role
   */
  async updateMemberRole(teamId: string, userId: string, role: string): Promise<OpTeamMember> {
    const membership = await this.prisma.opTeamMember.findFirst({
      where: { teamId, userId },
    });

    if (!membership) {
      throw new NotFoundException("Team membership not found");
    }

    return this.prisma.opTeamMember.update({
      where: { id: membership.id },
      data: { role },
      include: {
        User: { select: { id: true, firstName: true, lastName: true, email: true } },
      },
    });
  }

  /**
   * Get teams a user belongs to
   */
  async getUserTeams(campgroundId: string, userId: string): Promise<OpTeam[]> {
    return this.prisma.opTeam.findMany({
      where: {
        campgroundId,
        isActive: true,
        OpTeamMember: { some: { userId } },
      },
      include: {
        OpTeamMember: {
          include: {
            User: { select: { id: true, firstName: true, lastName: true } },
          },
        },
      },
    });
  }

  /**
   * Get available staff members for team assignment
   */
  async getAvailableStaff(campgroundId: string): Promise<AvailableStaffMember[]> {
    return this.prisma.user.findMany({
      where: {
        CampgroundMembership: { some: { campgroundId } },
        isActive: true,
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        OpTeamMember: {
          where: { OpTeam: { campgroundId } },
          include: { OpTeam: { select: { id: true, name: true } } },
        },
      },
    });
  }

  /**
   * Get team workload statistics
   */
  async getTeamStats(teamId: string): Promise<TeamStats> {
    const team = await this.prisma.opTeam.findUnique({
      where: { id: teamId },
      include: { OpTeamMember: { select: { userId: true } } },
    });

    if (!team) {
      throw new NotFoundException("Team not found");
    }

    const memberIds = team.OpTeamMember.map((m) => m.userId);

    const [teamTasks, memberTasks, completedToday] = await Promise.all([
      // Tasks assigned to team
      this.prisma.opTask.groupBy({
        by: ["state"],
        where: {
          assignedToTeamId: teamId,
          state: { notIn: ["completed", "cancelled"] },
        },
        _count: true,
      }),
      // Tasks assigned to individual members
      this.prisma.opTask.groupBy({
        by: ["assignedToUserId", "state"],
        where: {
          assignedToUserId: { in: memberIds },
          state: { notIn: ["completed", "cancelled"] },
        },
        _count: true,
      }),
      // Tasks completed today
      this.prisma.opTask.count({
        where: {
          OR: [{ assignedToTeamId: teamId }, { assignedToUserId: { in: memberIds } }],
          state: "completed",
          completedAt: { gte: new Date(new Date().setHours(0, 0, 0, 0)) },
        },
      }),
    ]);

    return {
      teamId,
      totalPending: teamTasks.reduce((acc, t) => acc + t._count, 0),
      byState: Object.fromEntries(teamTasks.map((t) => [t.state, t._count])),
      memberWorkload: memberTasks,
      completedToday,
      memberCount: team.OpTeamMember.length,
    };
  }

  /**
   * Seed default teams for a campground
   */
  async seedDefaultTeams(campgroundId: string): Promise<OpTeam[]> {
    const defaultTeams = [
      { name: "Housekeeping", description: "Cleaning and turnover tasks", color: "#10B981" },
      { name: "Maintenance", description: "Repairs and maintenance work", color: "#F59E0B" },
      {
        name: "Grounds Crew",
        description: "Landscaping and outdoor maintenance",
        color: "#3B82F6",
      },
      { name: "Front Desk", description: "Guest services and check-in/out", color: "#8B5CF6" },
    ];

    const created: OpTeam[] = [];

    for (const team of defaultTeams) {
      const existing = await this.prisma.opTeam.findFirst({
        where: { campgroundId, name: team.name },
      });

      if (!existing) {
        const newTeam = await this.prisma.opTeam.create({
          data: {
            id: randomUUID(),
            campgroundId,
            ...team,
            isActive: true,
            updatedAt: new Date(),
          },
        });
        created.push(newTeam);
      }
    }

    return created;
  }

  /**
   * Generate a random team color
   */
  private getRandomColor(): string {
    const colors = [
      "#10B981", // Emerald
      "#3B82F6", // Blue
      "#F59E0B", // Amber
      "#8B5CF6", // Violet
      "#EC4899", // Pink
      "#06B6D4", // Cyan
      "#EF4444", // Red
      "#84CC16", // Lime
    ];
    return colors[Math.floor(Math.random() * colors.length)];
  }
}
