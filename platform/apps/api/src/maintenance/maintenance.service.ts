import { Injectable, Logger, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import {
  GamificationEventCategory,
  MaintenancePriority,
  MaintenanceStatus,
  type Prisma,
} from "@prisma/client";
import { GamificationService } from "../gamification/gamification.service";
import { EmailService } from "../email/email.service";
import { randomUUID } from "crypto";

type MaintenanceTicketWithRelations = Prisma.MaintenanceTicketGetPayload<{
  include: {
    Site: true;
    User: true;
  };
}>;

@Injectable()
export class MaintenanceService {
  private readonly logger = new Logger(MaintenanceService.name);

  constructor(
    private prisma: PrismaService,
    private gamification: GamificationService,
    private emailService: EmailService,
  ) {}

  async create(data: {
    campgroundId: string;
    siteId?: string;
    title: string;
    description?: string;
    priority?: MaintenancePriority;
    dueDate?: string;
    assignedTo?: string;
    isBlocking?: boolean;
    outOfOrder?: boolean;
    outOfOrderReason?: string;
    outOfOrderUntil?: string;
    checklist?: Prisma.InputJsonValue;
    photos?: Prisma.InputJsonValue;
    notes?: string;
    lockId?: string;
  }) {
    const lockId = data.lockId ?? randomUUID();

    return this.prisma.maintenanceTicket.create({
      data: {
        id: randomUUID(),
        campgroundId: data.campgroundId,
        siteId: data.siteId,
        title: data.title,
        description: data.description,
        priority: data.priority,
        dueDate: data.dueDate ? new Date(data.dueDate) : undefined,
        assignedTo: data.assignedTo,
        isBlocking: data.isBlocking,
        outOfOrder: data.outOfOrder ?? false,
        outOfOrderReason: data.outOfOrderReason,
        outOfOrderUntil: data.outOfOrderUntil ? new Date(data.outOfOrderUntil) : undefined,
        checklist: data.checklist,
        photos: data.photos,
        notes: data.notes,
        lockId,
      },
      include: {
        Site: true,
        User: true,
      },
    });
  }

  async findAll(
    campgroundId: string,
    status?: MaintenanceStatus,
    siteId?: string,
    outOfOrder?: boolean,
  ) {
    return this.prisma.maintenanceTicket.findMany({
      where: {
        campgroundId,
        status,
        siteId,
        outOfOrder: outOfOrder !== undefined ? outOfOrder : undefined,
      },
      include: {
        Site: true,
        User: true,
      },
      orderBy: {
        createdAt: "desc",
      },
    });
  }

  async findOne(id: string) {
    return this.prisma.maintenanceTicket.findUnique({
      where: { id },
      include: {
        Site: true,
        User: true,
      },
    });
  }

  async update(
    id: string,
    data: {
      title?: string;
      description?: string;
      status?: MaintenanceStatus;
      priority?: MaintenancePriority;
      dueDate?: string;
      assignedTo?: string;
      assignedToTeamId?: string;
      isBlocking?: boolean;
      resolvedAt?: string;
      outOfOrder?: boolean;
      outOfOrderReason?: string;
      outOfOrderUntil?: string;
      checklist?: Prisma.InputJsonValue;
      photos?: Prisma.InputJsonValue;
      notes?: string;
    },
  ) {
    const existing = await this.prisma.maintenanceTicket.findUnique({
      where: { id },
    });

    if (!existing) throw new NotFoundException("Ticket not found");

    // If status is closed, set resolvedAt if not provided
    let resolvedAt = data.resolvedAt ? new Date(data.resolvedAt) : undefined;
    if (data.status === "closed" && !resolvedAt) {
      resolvedAt = new Date();
    }

    // Handle reopening
    let reopenedAt: Date | undefined;
    const isReopening = existing.status === "closed" && data.status && data.status !== "closed";
    if (isReopening) {
      reopenedAt = new Date();
    }

    // If resolving/closing, clear out-of-order unless explicitly kept
    let outOfOrder = data.outOfOrder;
    if (data.status === "closed" && outOfOrder === undefined) {
      outOfOrder = false;
    }

    const updatePayload = {
      title: data.title,
      description: data.description,
      status: data.status,
      priority: data.priority,
      dueDate: data.dueDate ? new Date(data.dueDate) : undefined,
      assignedTo: data.assignedTo,
      assignedToTeamId: data.assignedToTeamId,
      isBlocking: data.isBlocking,
      resolvedAt,
      reopenedAt,
      outOfOrder,
      outOfOrderReason: data.outOfOrderReason,
      outOfOrderUntil: data.outOfOrderUntil ? new Date(data.outOfOrderUntil) : undefined,
      checklist: data.checklist,
      photos: data.photos,
      notes: data.notes,
    };

    const updated = await this.prisma.maintenanceTicket.update({
      where: { id },
      data: updatePayload,
      include: {
        Site: true,
        User: true,
      },
    });

    const isClosing = existing && data.status === "closed" && existing.status !== "closed";
    const targetUserId = updatePayload.assignedTo ?? existing?.assignedTo;

    if (isClosing && targetUserId) {
      await this.gamification.recordEvent({
        campgroundId: updated.campgroundId,
        userId: targetUserId,
        membershipId: undefined,
        category: GamificationEventCategory.maintenance,
        reason: `Maintenance closed: ${updated.title}`,
        sourceType: "maintenance_ticket",
        sourceId: updated.id,
        eventKey: `maintenance:${updated.id}:closed`,
      });
    }

    // Notify staff when out_of_order state changes
    const outOfOrderChanged = existing.outOfOrder !== updated.outOfOrder;
    if (outOfOrderChanged) {
      await this.notifyOutOfOrderChange(updated, existing.outOfOrder);
    }

    return updated;
  }

  /**
   * Notify staff when a site's out-of-order status changes
   */
  private async notifyOutOfOrderChange(
    ticket: MaintenanceTicketWithRelations,
    wasOutOfOrder: boolean,
  ) {
    try {
      const campground = await this.prisma.campground.findUnique({
        where: { id: ticket.campgroundId },
        select: { name: true, email: true },
      });

      if (!campground?.email) {
        this.logger.debug(`No campground email for maintenance notification, skipping`);
        return;
      }

      const siteName = ticket.Site?.siteNumber || ticket.Site?.name || "Unknown site";
      const isNowOutOfOrder = ticket.outOfOrder;
      const status = isNowOutOfOrder ? "OUT OF ORDER" : "BACK IN SERVICE";
      const statusColor = isNowOutOfOrder ? "#dc2626" : "#16a34a";

      await this.emailService.sendEmail({
        to: campground.email,
        subject: `[${campground.name}] Site ${siteName} is now ${status}`,
        html: `
          <h2 style="color: ${statusColor}">${siteName} is now ${status}</h2>
          <p><strong>Maintenance Ticket:</strong> ${ticket.title}</p>
          ${ticket.outOfOrderReason ? `<p><strong>Reason:</strong> ${ticket.outOfOrderReason}</p>` : ""}
          ${ticket.outOfOrderUntil ? `<p><strong>Expected Return:</strong> ${new Date(ticket.outOfOrderUntil).toLocaleDateString()}</p>` : ""}
          <p><strong>Priority:</strong> ${ticket.priority || "medium"}</p>
          <p><strong>Status:</strong> ${ticket.status}</p>
          ${ticket.description ? `<p><strong>Description:</strong> ${ticket.description}</p>` : ""}
          <p style="color: #666; font-size: 12px;">This notification was sent because the site's availability status changed.</p>
        `,
        campgroundId: ticket.campgroundId,
      });

      this.logger.log(`Sent out-of-order notification for site ${siteName} (${status})`);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to send maintenance notification: ${message}`);
    }
  }

  async remove(id: string) {
    return this.prisma.maintenanceTicket.delete({
      where: { id },
    });
  }
}
