import { Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { CreateFormSubmissionDto, CreateFormTemplateDto, UpdateFormSubmissionDto, UpdateFormTemplateDto } from "./dto/form-template.dto";

@Injectable()
export class FormsService {
  constructor(private readonly prisma: PrismaService) {}

  listByCampground(campgroundId: string) {
    return this.prisma.formTemplate.findMany({
      where: { campgroundId },
      orderBy: { createdAt: "desc" }
    });
  }

  create(data: CreateFormTemplateDto) {
    return this.prisma.formTemplate.create({
      data: {
        campgroundId: data.campgroundId,
        title: data.title,
        type: data.type,
        description: data.description ?? null,
        fields: data.fields ?? Prisma.DbNull,
        isActive: data.isActive ?? true
      }
    });
  }

  async update(id: string, data: UpdateFormTemplateDto) {
    const existing = await this.prisma.formTemplate.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException("Form template not found");
    return this.prisma.formTemplate.update({
      where: { id },
      data: {
        title: data.title ?? undefined,
        type: data.type ?? undefined,
        description: data.description ?? undefined,
        fields: data.fields ?? undefined,
        isActive: data.isActive ?? undefined,
        version: existing.version + 1
      }
    });
  }

  async remove(id: string) {
    const existing = await this.prisma.formTemplate.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException("Form template not found");
    await this.prisma.formTemplate.delete({ where: { id } });
    return { id };
  }

  listSubmissions(filters: { reservationId?: string; guestId?: string }) {
    return this.prisma.formSubmission.findMany({
      where: {
        reservationId: filters.reservationId,
        guestId: filters.guestId
      },
      include: {
        formTemplate: { select: { id: true, title: true, type: true } }
      },
      orderBy: { createdAt: "desc" }
    });
  }

  async createSubmission(data: CreateFormSubmissionDto) {
    const template = await this.prisma.formTemplate.findUnique({ where: { id: data.formTemplateId } });
    if (!template) throw new NotFoundException("Form template not found");
    return this.prisma.formSubmission.create({
      data: {
        formTemplateId: data.formTemplateId,
        reservationId: data.reservationId ?? null,
        guestId: data.guestId ?? null,
        responses: data.responses ?? Prisma.DbNull
      },
      include: { formTemplate: { select: { id: true, title: true, type: true } } }
    });
  }

  async updateSubmission(id: string, data: UpdateFormSubmissionDto) {
    const existing = await this.prisma.formSubmission.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException("Form submission not found");
    return this.prisma.formSubmission.update({
      where: { id },
      data: {
        status: data.status ?? undefined,
        responses: data.responses ?? undefined,
        signedAt: data.status === "completed" ? new Date() : undefined
      },
      include: { formTemplate: { select: { id: true, title: true, type: true } } }
    });
  }

  async deleteSubmission(id: string) {
    const existing = await this.prisma.formSubmission.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException("Form submission not found");
    await this.prisma.formSubmission.delete({ where: { id } });
    return { id };
  }

  /**
   * List active form templates for public booking/check-in flows
   * Filters by campground and optionally by showAt timing
   */
  async listPublicForms(campgroundId: string, showAt?: string) {
    const forms = await this.prisma.formTemplate.findMany({
      where: {
        campgroundId,
        isActive: true
      },
      select: {
        id: true,
        title: true,
        type: true,
        description: true,
        fields: true,
        isRequired: true,
        allowSkipWithNote: true,
        showAt: true,
        displayConditions: true,
        conditionLogic: true
      },
      orderBy: { sortOrder: "asc" }
    });

    // Filter by showAt if provided
    if (showAt) {
      return forms.filter(f => {
        const showAtArray = f.showAt as string[] | null;
        return showAtArray?.includes(showAt);
      });
    }

    return forms;
  }

  /**
   * Get a single form template for public submission
   */
  async getPublicForm(id: string) {
    const form = await this.prisma.formTemplate.findUnique({
      where: { id },
      select: {
        id: true,
        title: true,
        type: true,
        description: true,
        fields: true,
        isRequired: true,
        allowSkipWithNote: true
      }
    });
    if (!form) throw new NotFoundException("Form not found");
    return form;
  }

  /**
   * Submit a form from public booking flow
   */
  async submitPublicForm(data: {
    formTemplateId: string;
    reservationId?: string;
    guestEmail?: string;
    responses: Record<string, any>;
  }) {
    const template = await this.prisma.formTemplate.findUnique({
      where: { id: data.formTemplateId }
    });
    if (!template) throw new NotFoundException("Form template not found");

    return this.prisma.formSubmission.create({
      data: {
        formTemplateId: data.formTemplateId,
        reservationId: data.reservationId ?? null,
        guestId: null, // Public submissions don't have guest accounts
        responses: data.responses ?? Prisma.DbNull,
        status: "completed",
        signedAt: new Date()
      },
      include: { formTemplate: { select: { id: true, title: true, type: true } } }
    });
  }

  /**
   * Get form submissions for a reservation
   */
  async getReservationFormSubmissions(reservationId: string) {
    return this.prisma.formSubmission.findMany({
      where: { reservationId },
      select: {
        id: true,
        formTemplateId: true,
        status: true,
        signedAt: true,
        formTemplate: {
          select: {
            id: true,
            title: true,
            type: true
          }
        }
      },
      orderBy: { signedAt: "desc" }
    });
  }
}

