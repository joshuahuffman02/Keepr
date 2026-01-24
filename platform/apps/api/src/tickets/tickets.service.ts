import { Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { EmailService } from "../email/email.service";
import { CreateTicketDto, UpdateTicketDto, TicketCategoryType, TicketStateType } from "./dto";
import { TicketCategory, TicketState } from "@prisma/client";
import type { Prisma, Ticket } from "@prisma/client";
import { randomUUID } from "crypto";

type TicketSubmitter = {
  id?: string | null;
  name?: string | null;
  email?: string | null;
};

type TicketUpvoter = TicketSubmitter;

export type TicketData = CreateTicketDto & {
  id?: string;
  createdAt?: string;
  completedAt?: string;
  status?: TicketStateType | "completed";
  agentNotes?: string;
  votes?: number;
  upvoters?: TicketUpvoter[];
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const getString = (value: unknown): string | undefined =>
  typeof value === "string" ? value : undefined;

const toJsonValue = (value: unknown): Prisma.InputJsonValue | undefined => {
  if (value === undefined || value === null) return undefined;
  try {
    return JSON.parse(JSON.stringify(value));
  } catch {
    return undefined;
  }
};

const normalizeTicketCategory = (value?: TicketCategoryType): TicketCategory => {
  switch (value) {
    case "question":
      return TicketCategory.question;
    case "feature":
      return TicketCategory.feature;
    case "other":
      return TicketCategory.other;
    case "issue":
    default:
      return TicketCategory.issue;
  }
};

const normalizeTicketState = (value?: TicketStateType): TicketState | undefined => {
  switch (value) {
    case "open":
      return TicketState.open;
    case "in_progress":
      return TicketState.in_progress;
    case "blocked":
      return TicketState.blocked;
    case "resolved":
      return TicketState.resolved;
    case "reopened":
      return TicketState.reopened;
    case "closed":
      return TicketState.closed;
    default:
      return undefined;
  }
};

const normalizeUpvoters = (value: unknown): TicketUpvoter[] => {
  if (!Array.isArray(value)) return [];
  const upvoters: TicketUpvoter[] = [];
  for (const entry of value) {
    if (!isRecord(entry)) continue;
    upvoters.push({
      id: getString(entry.id) ?? null,
      name: getString(entry.name) ?? null,
      email: getString(entry.email) ?? null,
    });
  }
  return upvoters;
};

const normalizeSubmitter = (value: unknown): TicketSubmitter | null => {
  if (!isRecord(value)) return null;
  return {
    id: getString(value.id) ?? null,
    name: getString(value.name) ?? null,
    email: getString(value.email) ?? null,
  };
};

@Injectable()
export class TicketsService {
  private readonly logger = new Logger(TicketsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly emailService: EmailService,
  ) {}

  async findAll() {
    return this.prisma.ticket.findMany({
      orderBy: { createdAt: "desc" },
    });
  }

  async create(dto: CreateTicketDto) {
    const ticket = await this.prisma.ticket.create({
      data: {
        id: randomUUID(),
        title: dto.title?.trim() || "Untitled ticket",
        notes: dto.notes?.trim() || null,
        category: normalizeTicketCategory(dto.category),
        area: dto.area || null,
        url: dto.url || null,
        path: dto.path || null,
        pageTitle: dto.pageTitle || null,
        selection: dto.selection || null,
        submitter: toJsonValue(dto.submitter) ?? undefined,
        client: toJsonValue(dto.client) ?? undefined,
        extra: toJsonValue(dto.extra) ?? undefined,
        status: "open",
        votes: 0,
        upvoters: [],
      },
    });
    await this.notifyTicketCreated(ticket);
    return ticket;
  }

  async update(id: string, dto: UpdateTicketDto) {
    const ticket = await this.prisma.ticket.findUnique({ where: { id } });
    if (!ticket) {
      return null;
    }

    // Handle upvote action
    if (dto.action === "upvote") {
      const actorKey = dto.actor?.id || dto.actor?.email;
      const existingUpvoters = normalizeUpvoters(ticket.upvoters);
      const alreadyUpvoted = actorKey
        ? existingUpvoters.some(
            (u) => (u.id && u.id === actorKey) || (u.email && u.email === actorKey),
          )
        : false;

      if (!alreadyUpvoted) {
        return this.prisma.ticket.update({
          where: { id },
          data: {
            votes: ticket.votes + 1,
            upvoters: [
              ...existingUpvoters,
              {
                id: dto.actor?.id ?? null,
                name: dto.actor?.name ?? null,
                email: dto.actor?.email ?? null,
              },
            ],
          },
        });
      }
      return ticket;
    }

    // Handle status/notes update
    const updateData: Prisma.TicketUpdateInput = {};
    const wasResolved = ticket.status === "resolved" || ticket.status === "closed";

    if (dto.status) {
      const normalizedStatus = normalizeTicketState(dto.status);
      if (normalizedStatus) {
        updateData.status = normalizedStatus;
        if (normalizedStatus === TicketState.resolved || normalizedStatus === TicketState.closed) {
          updateData.completedAt = new Date();
        }
      }
    }

    if (typeof dto.agentNotes === "string") {
      updateData.agentNotes = dto.agentNotes.trim() || null;
    }

    const updated = await this.prisma.ticket.update({
      where: { id },
      data: updateData,
    });

    // Send email notification when ticket is resolved/closed
    const isNowResolved = updated.status === "resolved" || updated.status === "closed";
    if (isNowResolved && !wasResolved) {
      const submitter = normalizeSubmitter(ticket.submitter);
      const submitterEmail = submitter?.email;

      if (submitterEmail) {
        try {
          await this.emailService.sendTicketResolved({
            to: submitterEmail,
            ticketId: ticket.id,
            ticketTitle: ticket.title,
            resolution:
              dto.agentNotes || "Your ticket has been resolved. Thank you for your feedback!",
            agentNotes: updated.agentNotes || undefined,
          });
          this.logger.log(`Sent resolution email for ticket ${id} to ${submitterEmail}`);
        } catch (err) {
          this.logger.warn(`Failed to send resolution email for ticket ${id}: ${err}`);
        }
      }
    }

    return updated;
  }

  // Migration helper: bulk insert tickets from JSON
  async bulkCreate(tickets: TicketData[]) {
    const results = [];
    for (const ticket of tickets) {
      try {
        // Map old status values to new TicketState enum
        const mappedStatus =
          ticket.status === "completed"
            ? TicketState.resolved
            : (normalizeTicketState(ticket.status) ?? TicketState.open);

        const created = await this.prisma.ticket.create({
          data: {
            id: ticket.id ?? randomUUID(),
            title: ticket.title?.trim() || "Untitled ticket",
            notes: ticket.notes?.trim() || null,
            category: normalizeTicketCategory(ticket.category),
            area: ticket.area || null,
            url: ticket.url || null,
            path: ticket.path || null,
            pageTitle: ticket.pageTitle || null,
            selection: ticket.selection || null,
            submitter: toJsonValue(ticket.submitter) ?? undefined,
            client: toJsonValue(ticket.client) ?? undefined,
            extra: toJsonValue(ticket.extra) ?? undefined,
            status: mappedStatus,
            agentNotes: ticket.agentNotes?.trim() || null,
            votes: ticket.votes || 0,
            upvoters: toJsonValue(ticket.upvoters) ?? [],
            createdAt: ticket.createdAt ? new Date(ticket.createdAt) : undefined,
            completedAt: ticket.completedAt ? new Date(ticket.completedAt) : null,
          },
        });
        results.push({ ok: true, id: created.id });
      } catch (err) {
        this.logger.warn(`Failed to import ticket ${ticket.id}: ${err}`);
        results.push({ ok: false, id: ticket.id, error: String(err) });
      }
    }
    return results;
  }

  private async notifyTicketCreated(ticket: Ticket) {
    const recipients = (process.env.SUPPORT_TICKETS_EMAILS || "tickets@keeprstay.com")
      .split(",")
      .map((email) => email.trim())
      .filter(Boolean);

    if (recipients.length === 0) return;

    const submitter = normalizeSubmitter(ticket.submitter);
    const submitterLine = submitter?.email
      ? `${submitter.name ? `${submitter.name} · ` : ""}${submitter.email}`
      : submitter?.name || "";

    const subject = `New support ticket: ${ticket.title || "Untitled"}`;
    const html = `
            <div style="font-family: Arial, sans-serif; color: #0f172a; max-width: 640px;">
                <h2 style="margin: 0 0 12px 0;">New support ticket</h2>
                <p style="margin: 4px 0; color: #334155;"><strong>ID:</strong> ${ticket.id}</p>
                <p style="margin: 4px 0; color: #334155;"><strong>Status:</strong> ${ticket.status}</p>
                ${ticket.category ? `<p style="margin: 4px 0; color: #334155;"><strong>Category:</strong> ${ticket.category}</p>` : ""}
                ${ticket.area ? `<p style="margin: 4px 0; color: #334155;"><strong>Area:</strong> ${ticket.area}</p>` : ""}
                ${submitterLine ? `<p style="margin: 4px 0; color: #334155;"><strong>Submitter:</strong> ${submitterLine}</p>` : ""}
                ${ticket.url ? `<p style="margin: 4px 0; color: #334155;"><strong>URL:</strong> ${ticket.url}</p>` : ""}
                ${ticket.path ? `<p style="margin: 4px 0; color: #334155;"><strong>Path:</strong> ${ticket.path}</p>` : ""}
                ${ticket.pageTitle ? `<p style="margin: 4px 0; color: #334155;"><strong>Page:</strong> ${ticket.pageTitle}</p>` : ""}
                ${ticket.selection ? `<p style="margin: 4px 0; color: #334155;"><strong>Selection:</strong> ${ticket.selection}</p>` : ""}
                ${
                  ticket.notes
                    ? `
                    <p style="margin: 12px 0 4px 0; color: #0f172a;"><strong>Notes</strong></p>
                    <p style="margin: 0 0 12px 0; color: #334155; white-space: pre-wrap;">${ticket.notes}</p>
                `
                    : ""
                }
            </div>
        `;

    const results = await Promise.allSettled(
      recipients.map((to) => this.emailService.sendEmail({ to, subject, html })),
    );

    results.forEach((result, index) => {
      if (result.status === "rejected") {
        this.logger.warn(
          `Failed to send ticket notification to ${recipients[index]}: ${result.reason}`,
        );
      }
    });
  }
}
