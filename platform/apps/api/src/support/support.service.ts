import { ForbiddenException, Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { CreateSupportReportDto } from "./dto/create-support-report.dto";
import { UpdateSupportReportDto } from "./dto/update-support-report.dto";
import { EmailService } from "../email/email.service";
import { UpdateStaffScopeDto } from "./dto/update-staff-scope.dto";
import { PlatformRole, Prisma, SupportReportStatus } from "@prisma/client";
import { randomUUID } from "crypto";

type SupportUserSummary = {
  id: string;
  email: string | null;
  firstName: string | null;
  lastName: string | null;
};

type SupportCampgroundSummary = { id: string; name: string };

type SupportReportRaw = Prisma.SupportReportGetPayload<{
  include: {
    User_SupportReport_authorIdToUser: {
      select: { id: true; email: true; firstName: true; lastName: true };
    };
    User_SupportReport_assigneeIdToUser: {
      select: { id: true; email: true; firstName: true; lastName: true };
    };
    Campground: { select: { id: true; name: true } };
  };
}>;

type SupportReportView = Omit<
  SupportReportRaw,
  "User_SupportReport_authorIdToUser" | "User_SupportReport_assigneeIdToUser" | "Campground"
> & {
  author: SupportUserSummary | null;
  assignee: SupportUserSummary | null;
  campground: SupportCampgroundSummary | null;
};

const PLATFORM_ROLES: PlatformRole[] = [
  PlatformRole.support_agent,
  PlatformRole.support_lead,
  PlatformRole.regional_support,
  PlatformRole.ops_engineer,
  PlatformRole.platform_admin,
];

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const toStringValue = (value: unknown): string | null => {
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return null;
};

const isPlatformRole = (value: string): value is PlatformRole =>
  PLATFORM_ROLES.some((role) => role === value);

const parsePlatformRole = (value: string | null | undefined): PlatformRole | undefined => {
  if (!value) return undefined;
  return isPlatformRole(value) ? value : undefined;
};

const toSupportReportView = ({
  User_SupportReport_authorIdToUser: author,
  User_SupportReport_assigneeIdToUser: assignee,
  Campground: campground,
  ...rest
}: SupportReportRaw): SupportReportView => ({
  ...rest,
  author,
  assignee,
  campground,
});

@Injectable()
export class SupportService {
  private readonly logger = new Logger(SupportService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly email: EmailService,
  ) {}

  create(dto: CreateSupportReportDto, authorId?: string) {
    const {
      description,
      steps,
      contactEmail,
      path,
      userAgent,
      language,
      timezone,
      viewportWidth,
      viewportHeight,
      roleFilter,
      pinnedIds,
      recentIds,
      rawContext,
      campgroundId,
      region,
      ownershipRole,
    } = dto;

    const rawContextRecord = isRecord(rawContext) ? rawContext : {};
    return this.prisma.supportReport
      .create({
        data: {
          id: randomUUID(),
          description,
          steps,
          contactEmail,
          path,
          userAgent,
          language,
          timezone,
          viewportWidth: viewportWidth ?? null,
          viewportHeight: viewportHeight ?? null,
          roleFilter,
          pinnedIds: pinnedIds ?? [],
          recentIds: recentIds ?? [],
          rawContext: { ...rawContextRecord, region, ownershipRole },
          campgroundId,
          authorId: authorId ?? null,
          updatedAt: new Date(),
        },
        include: {
          Campground: { select: { id: true, name: true } },
          User_SupportReport_assigneeIdToUser: {
            select: { id: true, email: true, firstName: true, lastName: true },
          },
          User_SupportReport_authorIdToUser: {
            select: { id: true, email: true, firstName: true, lastName: true },
          },
        },
      })
      .then((report) => {
        const view = toSupportReportView(report);
        void this.notifyNew(view);
        return view;
      });
  }

  async findAll(args: { region?: string | null; campgroundId?: string | null }) {
    const { region, campgroundId } = args;

    // 1. Fetch scoped SupportReports
    const where: Prisma.SupportReportWhereInput = {};
    if (campgroundId) {
      where.campgroundId = campgroundId;
    }
    if (region) {
      where.AND = [{ rawContext: { path: ["region"], equals: region } }];
    }
    const reports = await this.prisma.supportReport.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: {
        User_SupportReport_authorIdToUser: {
          select: { id: true, email: true, firstName: true, lastName: true },
        },
        User_SupportReport_assigneeIdToUser: {
          select: { id: true, email: true, firstName: true, lastName: true },
        },
        Campground: { select: { id: true, name: true } },
      },
    });
    const reportViews = reports.map(toSupportReportView);

    // 2. Fetch global Tickets (only if not strictly filtering by campground, or if we decide tickets are global)
    // For now, we include tickets in the main list. We can refine filtering later if needed.
    // If strict campground scoping is on, we might want to skip tickets or check their metadata.
    // Assuming Tickets are "Global Feedback" and should be visible to support staff.
    const tickets = await this.prisma.ticket.findMany({
      orderBy: { createdAt: "desc" },
    });

    // 3. Map Tickets to SupportReport shape
    const mappedTickets: SupportReportView[] = tickets.map((t) => {
      // Map status
      let status: SupportReportStatus = SupportReportStatus.new;
      if (t.status === "closed") status = SupportReportStatus.closed;
      if (t.status === "resolved") status = SupportReportStatus.resolved;
      if (t.status === "in_progress") status = SupportReportStatus.in_progress;

      // Parse submitter safely
      const submitter = isRecord(t.submitter) ? t.submitter : null; // { name, email, id }
      const submitterEmail = submitter ? toStringValue(submitter.email) : null;
      const submitterName = submitter ? toStringValue(submitter.name) : null;
      const submitterId = submitter ? toStringValue(submitter.id) : null;
      const author = submitterEmail
        ? {
            id: submitterId ?? "guest",
            email: submitterEmail,
            firstName: submitterName ?? null,
            lastName: null,
          }
        : null;
      const client = isRecord(t.client) ? t.client : null;
      const userAgent = client ? toStringValue(client.userAgent) : null;
      const language = client ? toStringValue(client.language) : null;

      return {
        id: t.id,
        createdAt: t.createdAt,
        updatedAt: t.updatedAt,
        description: t.title,
        steps: t.notes || null,
        contactEmail: submitterEmail,
        path: t.path || t.url || null,
        userAgent,
        language,
        timezone: null,
        viewportWidth: null,
        viewportHeight: null,
        roleFilter: null,
        pinnedIds: [],
        recentIds: [],
        rawContext: { source: "ticket", category: t.category },
        status,
        assigneeId: null,
        assignee: null,
        authorId: author?.id || null,
        author,
        campgroundId: null,
        campground: { id: "global", name: "Global / Feedback" },
      };
    });

    // 4. Merge and Sort
    const combined: SupportReportView[] = [...reportViews, ...mappedTickets];
    return combined.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  async update(
    id: string,
    dto: UpdateSupportReportDto,
    actorId?: string,
    actorRegion?: string | null,
    actorCampgrounds?: string[],
    platformScoped = false,
  ) {
    const { status, assigneeId } = dto;

    const before = await this.prisma.supportReport.findUnique({
      where: { id },
      select: { assigneeId: true, rawContext: true, campgroundId: true },
    });

    const beforeRegion =
      before && isRecord(before.rawContext) ? toStringValue(before.rawContext.region) : null;
    if (beforeRegion && actorRegion && beforeRegion !== actorRegion) {
      throw new ForbiddenException("Forbidden by region scope");
    }

    if (
      before?.campgroundId &&
      actorCampgrounds &&
      !actorCampgrounds.includes(before.campgroundId) &&
      !platformScoped
    ) {
      throw new ForbiddenException("Forbidden by campground scope");
    }

    if (assigneeId) {
      const assignee = await this.prisma.user.findUnique({
        where: { id: assigneeId },
        select: {
          id: true,
          region: true,
          CampgroundMembership: { select: { campgroundId: true } },
          ownershipRoles: true,
        },
      });
      if (!assignee) {
        throw new ForbiddenException("Assignee not found");
      }
      const matchesRegion = beforeRegion ? assignee.region === beforeRegion : true;
      const matchesCamp = before?.campgroundId
        ? assignee.CampgroundMembership.some((m) => m.campgroundId === before?.campgroundId)
        : true;
      if (!matchesRegion && !matchesCamp) {
        throw new ForbiddenException("Assignee not permitted for region/campground");
      }
    }

    const report = await this.prisma.supportReport.update({
      where: { id },
      data: {
        status: status ?? undefined,
        assigneeId: assigneeId ?? undefined,
        updatedAt: new Date(),
        // audit can be added later
      },
      include: {
        Campground: { select: { id: true, name: true } },
        User_SupportReport_assigneeIdToUser: {
          select: { id: true, email: true, firstName: true, lastName: true },
        },
        User_SupportReport_authorIdToUser: {
          select: { id: true, email: true, firstName: true, lastName: true },
        },
      },
    });
    const view = toSupportReportView(report);

    if (assigneeId && assigneeId !== before?.assigneeId) {
      void this.notifyAssignment(view);
    }

    return view;
  }

  async staffDirectory(args: { region?: string | null; campgroundId?: string | null }) {
    const { region, campgroundId } = args;

    const whereOr: Prisma.UserWhereInput[] = [];
    if (region) {
      whereOr.push({ region });
    }
    if (campgroundId) {
      whereOr.push({ CampgroundMembership: { some: { campgroundId } } });
    }

    const users = await this.prisma.user.findMany({
      where: {
        isActive: true,
        platformActive: { not: false },
        ...(whereOr.length > 0 ? { OR: whereOr } : {}),
      },
      take: 200,
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        region: true,
        platformRole: true,
        platformRegion: true,
        platformActive: true,
        ownershipRoles: true,
        CampgroundMembership: { select: { campgroundId: true, role: true } },
      },
    });

    return users.map((u) => ({
      ...u,
      platformRole: u.platformRole ?? null,
      platformRegion: u.platformRegion ?? null,
      platformActive: u.platformActive ?? true,
      notifyChannels: ["email"],
    }));
  }

  async updateStaffScope(id: string, dto: UpdateStaffScopeDto) {
    const { region, ownershipRoles } = dto;
    const platformRole = parsePlatformRole(dto.platformRole ?? undefined);
    return this.prisma.user.update({
      where: { id },
      data: {
        region: region ?? undefined,
        platformRegion: dto.platformRegion ?? undefined,
        platformRole: platformRole ?? undefined,
        platformActive:
          typeof dto.platformActive === "string" ? dto.platformActive === "true" : undefined,
        ownershipRoles: ownershipRoles ?? undefined,
        updatedAt: new Date(),
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        region: true,
        platformRole: true,
        platformRegion: true,
        platformActive: true,
        ownershipRoles: true,
        CampgroundMembership: { select: { campgroundId: true, role: true } },
      },
    });
  }

  private formatReportSummary(report: SupportReportView) {
    const parts = [
      `New support report (${report.status})`,
      report.campground?.name ? `Campground: ${report.campground.name}` : null,
      report.path ? `Path: ${report.path}` : null,
      `Desc: ${report.description}`,
      report.steps ? `Steps: ${report.steps}` : null,
      report.contactEmail ? `Contact: ${report.contactEmail}` : null,
      report.id ? `Id: ${report.id}` : null,
    ]
      .filter(Boolean)
      .join("\n");
    return parts;
  }

  private async notifyNew(report: SupportReportView) {
    const slackWebhook = process.env.SUPPORT_SLACK_WEBHOOK;
    const emailList = (process.env.SUPPORT_ALERT_EMAILS || "")
      .split(",")
      .map((e) => e.trim())
      .filter(Boolean);

    // Slack notification (optional)
    if (slackWebhook) {
      try {
        const text = this.formatReportSummary(report);
        await fetch(slackWebhook, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text }),
        });
      } catch (err) {
        this.logger.warn(`Failed to send support Slack notification: ${String(err)}`);
      }
    }

    // Email notification (optional)
    if (emailList.length > 0) {
      const subject = `New support report: ${report.status || "open"} ${report.path || ""}`.trim();
      const html = `
        <div style="font-family: Arial, sans-serif; color: #0f172a; max-width: 640px;">
          <h2 style="margin: 0 0 12px 0;">New support report</h2>
          <p style="margin: 4px 0; color: #334155;"><strong>Status:</strong> ${report.status}</p>
          ${report.campground?.name ? `<p style="margin: 4px 0; color: #334155;"><strong>Campground:</strong> ${report.campground.name}</p>` : ""}
          ${report.path ? `<p style="margin: 4px 0; color: #334155;"><strong>Path:</strong> ${report.path}</p>` : ""}
          ${report.contactEmail ? `<p style="margin: 4px 0; color: #334155;"><strong>Contact:</strong> ${report.contactEmail}</p>` : ""}
          <p style="margin: 12px 0 4px 0; color: #0f172a;"><strong>Description</strong></p>
          <p style="margin: 0 0 12px 0; color: #334155; white-space: pre-wrap;">${report.description}</p>
          ${
            report.steps
              ? `
            <p style="margin: 12px 0 4px 0; color: #0f172a;"><strong>Steps</strong></p>
            <p style="margin: 0 0 12px 0; color: #334155; white-space: pre-wrap;">${report.steps}</p>
          `
              : ""
          }
          <p style="margin: 12px 0 4px 0; color: #0f172a;"><strong>Context</strong></p>
          <ul style="margin: 0; padding-left: 18px; color: #334155; line-height: 1.5;">
            ${report.timezone ? `<li>Timezone: ${report.timezone}</li>` : ""}
            ${report.language ? `<li>Language: ${report.language}</li>` : ""}
            ${report.userAgent ? `<li>Browser: ${report.userAgent}</li>` : ""}
            ${report.viewportWidth && report.viewportHeight ? `<li>Viewport: ${report.viewportWidth} x ${report.viewportHeight}</li>` : ""}
            ${report.roleFilter ? `<li>Role filter: ${report.roleFilter}</li>` : ""}
            ${report.pinnedIds?.length ? `<li>Pinned: ${report.pinnedIds.join(", ")}</li>` : ""}
            ${report.recentIds?.length ? `<li>Recent: ${report.recentIds.join(", ")}</li>` : ""}
          </ul>
          <p style="margin: 12px 0 0 0; color: #64748b; font-size: 12px;">Report ID: ${report.id}</p>
        </div>
      `;

      await Promise.allSettled(
        emailList.map((to) =>
          this.email.sendEmail({
            to,
            subject,
            html,
          }),
        ),
      );
    }
  }

  private async notifyAssignment(report: SupportReportView) {
    // Slack notification for assignment (optional)
    const slackWebhook = process.env.SUPPORT_SLACK_WEBHOOK;
    if (slackWebhook && report.assignee?.email) {
      try {
        const text = [
          `Support report assigned`,
          `To: ${report.assignee.email}`,
          report.campground?.name ? `Campground: ${report.campground.name}` : null,
          report.path ? `Path: ${report.path}` : null,
          `Desc: ${report.description}`,
          `Id: ${report.id}`,
        ]
          .filter(Boolean)
          .join("\n");
        await fetch(slackWebhook, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text }),
        });
      } catch (err) {
        this.logger.warn(`Failed to send assignment Slack notification: ${String(err)}`);
      }
    }

    // Email notification to the assignee (optional)
    const assigneeEmail = report.assignee?.email;
    if (assigneeEmail) {
      const subject =
        `Assigned: Support report (${report.status || "open"}) ${report.path || ""}`.trim();
      const html = `
        <div style="font-family: Arial, sans-serif; color: #0f172a; max-width: 640px;">
          <h2 style="margin: 0 0 12px 0;">You were assigned a support report</h2>
          ${report.campground?.name ? `<p style="margin: 4px 0; color: #334155;"><strong>Campground:</strong> ${report.campground.name}</p>` : ""}
          ${report.path ? `<p style="margin: 4px 0; color: #334155;"><strong>Path:</strong> ${report.path}</p>` : ""}
          <p style="margin: 4px 0; color: #334155;"><strong>Status:</strong> ${report.status}</p>
          <p style="margin: 12px 0 4px 0; color: #0f172a;"><strong>Description</strong></p>
          <p style="margin: 0 0 12px 0; color: #334155; white-space: pre-wrap;">${report.description}</p>
          ${
            report.steps
              ? `
            <p style="margin: 12px 0 4px 0; color: #0f172a;"><strong>Steps</strong></p>
            <p style="margin: 0 0 12px 0; color: #334155; white-space: pre-wrap;">${report.steps}</p>
          `
              : ""
          }
          <p style="margin: 12px 0 0 0; color: #64748b; font-size: 12px;">Report ID: ${report.id}</p>
        </div>
      `;

      try {
        await this.email.sendEmail({
          to: assigneeEmail,
          subject,
          html,
        });
      } catch (err) {
        this.logger.warn(`Failed to send assignment email: ${String(err)}`);
      }
    }
  }
}
