import { Injectable, NotFoundException } from "@nestjs/common";
import { EvidenceType, IncidentStatus, IncidentTaskStatus, Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { CreateIncidentDto } from "./dto/create-incident.dto";
import { UpdateIncidentDto } from "./dto/update-incident.dto";
import { AddEvidenceDto } from "./dto/add-evidence.dto";
import { LinkClaimDto } from "./dto/link-claim.dto";
import { SetReminderDto } from "./dto/set-reminder.dto";
import { CloseIncidentDto } from "./dto/close-incident.dto";
import { CreateIncidentTaskDto, UpdateIncidentTaskDto } from "./dto/task.dto";
import { CreateCoiDto } from "./dto/create-coi.dto";
import { randomUUID } from "crypto";

const toNullableJsonInput = (
  value: unknown,
): Prisma.InputJsonValue | Prisma.NullTypes.DbNull | undefined => {
  if (value === undefined) return undefined;
  if (value === null) return Prisma.DbNull;
  try {
    return JSON.parse(JSON.stringify(value));
  } catch {
    return undefined;
  }
};

@Injectable()
export class IncidentsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(campgroundId: string) {
    return this.prisma.incident.findMany({
      where: { campgroundId },
      include: { IncidentTask: true, IncidentEvidence: true },
      orderBy: { createdAt: "desc" },
    });
  }

  async create(dto: CreateIncidentDto) {
    return this.prisma.incident.create({
      data: {
        id: randomUUID(),
        campgroundId: dto.campgroundId,
        reservationId: dto.reservationId ?? null,
        guestId: dto.guestId ?? null,
        type: dto.type,
        severity: dto.severity,
        notes: dto.notes,
        photos: toNullableJsonInput(dto.photos ?? null),
        witnesses: toNullableJsonInput(dto.witnesses ?? null),
        occurredAt: dto.occurredAt ? new Date(dto.occurredAt) : null,
      },
    });
  }

  async update(id: string, dto: UpdateIncidentDto) {
    await this.ensureIncident(id);
    const closedAt =
      dto.status === IncidentStatus.closed || dto.status === IncidentStatus.resolved
        ? new Date()
        : undefined;

    return this.prisma.incident.update({
      where: { id },
      data: {
        ...dto,
        photos: dto.photos === undefined ? undefined : toNullableJsonInput(dto.photos),
        witnesses: dto.witnesses === undefined ? undefined : toNullableJsonInput(dto.witnesses),
        occurredAt: dto.occurredAt ? new Date(dto.occurredAt) : undefined,
        closedAt,
      },
    });
  }

  async close(id: string, dto: CloseIncidentDto) {
    const incident = await this.ensureIncident(id);
    const updatedNotes = dto.resolutionNotes
      ? [incident.notes, `Resolution: ${dto.resolutionNotes}`].filter(Boolean).join("\n")
      : incident.notes;

    return this.prisma.incident.update({
      where: { id },
      data: {
        status: IncidentStatus.closed,
        closedAt: new Date(),
        claimId: dto.claimId ?? incident.claimId,
        notes: updatedNotes ?? undefined,
      },
    });
  }

  async addEvidence(incidentId: string, dto: AddEvidenceDto) {
    await this.ensureIncident(incidentId);
    return this.prisma.incidentEvidence.create({
      data: {
        id: randomUUID(),
        incidentId,
        type: dto.type ?? EvidenceType.photo,
        url: dto.url,
        storageKey: dto.storageKey,
        description: dto.description,
        uploadedBy: dto.uploadedBy,
        metadata: toNullableJsonInput(dto.url ? { source: "direct_url" } : null),
      },
    });
  }

  async linkClaim(id: string, dto: LinkClaimDto) {
    await this.ensureIncident(id);
    return this.prisma.incident.update({
      where: { id },
      data: {
        claimId: dto.claimId,
        metadata: toNullableJsonInput({
          ...(dto.provider ? { provider: dto.provider } : {}),
          ...(dto.notes ? { claimNotes: dto.notes } : {}),
        }),
      },
    });
  }

  async setReminder(id: string, dto: SetReminderDto) {
    await this.ensureIncident(id);
    return this.prisma.incident.update({
      where: { id },
      data: {
        reminderAt: new Date(dto.reminderAt),
        metadata: dto.message ? toNullableJsonInput({ reminderMessage: dto.message }) : undefined,
      },
    });
  }

  async attachCoi(incidentId: string, dto: CreateCoiDto) {
    const incident = await this.ensureIncident(incidentId);
    return this.prisma.certificateOfInsurance.create({
      data: {
        id: randomUUID(),
        incidentId,
        campgroundId: incident.campgroundId,
        reservationId: incident.reservationId,
        guestId: incident.guestId,
        fileUrl: dto.fileUrl,
        provider: dto.provider,
        policyNumber: dto.policyNumber,
        coverageType: dto.coverageType,
        effectiveDate: dto.effectiveDate ? new Date(dto.effectiveDate) : null,
        expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null,
        uploadedBy: dto.uploadedBy,
      },
    });
  }

  async createTask(incidentId: string, dto: CreateIncidentTaskDto) {
    await this.ensureIncident(incidentId);
    return this.prisma.incidentTask.create({
      data: {
        id: randomUUID(),
        incidentId,
        title: dto.title,
        status: IncidentTaskStatus.pending,
        dueAt: dto.dueAt ? new Date(dto.dueAt) : null,
        reminderAt: dto.reminderAt ? new Date(dto.reminderAt) : null,
        assignedTo: dto.assignedTo ?? null,
      },
    });
  }

  async updateTask(incidentId: string, taskId: string, dto: UpdateIncidentTaskDto) {
    const existing = await this.prisma.incidentTask.findUnique({ where: { id: taskId } });
    if (!existing || existing.incidentId !== incidentId) {
      throw new NotFoundException("Task not found for incident");
    }

    return this.prisma.incidentTask.update({
      where: { id: taskId },
      data: {
        ...dto,
        dueAt: dto.dueAt ? new Date(dto.dueAt) : undefined,
        reminderAt: dto.reminderAt ? new Date(dto.reminderAt) : undefined,
        completedAt:
          dto.status === IncidentTaskStatus.done ? new Date() : dto.status ? null : undefined,
      },
    });
  }

  async report(campgroundId: string, format?: string) {
    const byStatus = await this.prisma.incident.groupBy({
      by: ["status"],
      _count: { _all: true },
      where: { campgroundId },
      orderBy: { status: "asc" },
    });

    const byType = await this.prisma.incident.groupBy({
      by: ["type"],
      _count: { _all: true },
      where: { campgroundId },
      orderBy: { type: "asc" },
    });

    const openTasks = await this.prisma.incidentTask.count({
      where: { status: { not: IncidentTaskStatus.done }, Incident: { campgroundId } },
    });

    const summary = {
      byStatus,
      byType,
      openTasks,
      generatedAt: new Date().toISOString(),
    };

    if (format === "csv") {
      const statusLines = byStatus.map((s) => `${s.status},${s._count._all}`).join("\n");
      const typeLines = byType.map((t) => `${t.type},${t._count._all}`).join("\n");
      return `section,count\n${statusLines}\n---\n${typeLines}\nopenTasks,${openTasks}`;
    }

    return summary;
  }

  private async ensureIncident(id: string) {
    const incident = await this.prisma.incident.findUnique({ where: { id } });
    if (!incident) {
      throw new NotFoundException("Incident not found");
    }
    return incident;
  }
}
