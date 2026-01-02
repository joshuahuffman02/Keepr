import { Injectable, NotFoundException, BadRequestException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { CreateFormSubmissionDto, CreateFormTemplateDto, UpdateFormSubmissionDto, UpdateFormTemplateDto } from "./dto/form-template.dto";
import { createHmac, timingSafeEqual } from "crypto";

@Injectable()
export class FormsService {
  constructor(private readonly prisma: PrismaService) {}

  private getPublicReservationTokenSecret(): string {
    const secret = process.env.PUBLIC_RESERVATION_TOKEN_SECRET || process.env.JWT_SECRET;
    if (!secret) {
      throw new BadRequestException("Public reservation token secret not configured");
    }
    return secret;
  }

  private buildPublicReservationToken(reservationId: string): string {
    const secret = this.getPublicReservationTokenSecret();
    return createHmac("sha256", secret).update(reservationId).digest("base64url");
  }

  private validatePublicReservationToken(reservationId: string, token?: string): boolean {
    if (!token) return false;
    const expected = this.buildPublicReservationToken(reservationId);
    if (token.length !== expected.length) return false;
    try {
      return timingSafeEqual(Buffer.from(token), Buffer.from(expected));
    } catch {
      return false;
    }
  }

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

  listSubmissions(filters: {
    reservationId?: string;
    guestId?: string;
    limit?: number;
    offset?: number;
  }) {
    const limit = Math.min(filters.limit ?? 100, 500);
    const offset = filters.offset ?? 0;

    return this.prisma.formSubmission.findMany({
      where: {
        reservationId: filters.reservationId,
        guestId: filters.guestId
      },
      include: {
        formTemplate: { select: { id: true, title: true, type: true } }
      },
      orderBy: { createdAt: "desc" },
      take: limit,
      skip: offset
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
   * SECURITY: Validates form is active and belongs to the specified campground
   */
  async getPublicForm(id: string, campgroundId: string) {
    if (!campgroundId) {
      throw new BadRequestException("campgroundId is required");
    }

    const form = await this.prisma.formTemplate.findUnique({
      where: { id },
      select: {
        id: true,
        campgroundId: true,
        title: true,
        type: true,
        description: true,
        fields: true,
        isRequired: true,
        allowSkipWithNote: true,
        isActive: true
      }
    });
    if (!form) throw new NotFoundException("Form not found");

    // Validate form belongs to the requested campground
    if (form.campgroundId !== campgroundId) {
      throw new NotFoundException("Form not found");
    }

    // Validate form is active
    if (!form.isActive) {
      throw new BadRequestException("This form is currently inactive and cannot accept submissions. Please contact the campground");
    }

    // Return only public-safe fields
    return {
      id: form.id,
      title: form.title,
      type: form.type,
      description: form.description,
      fields: form.fields,
      isRequired: form.isRequired,
      allowSkipWithNote: form.allowSkipWithNote
    };
  }

  /**
   * Submit a form from public booking flow
   * SECURITY: Validates form is active and matches reservation campground
   */
  async submitPublicForm(data: {
    formTemplateId: string;
    campgroundId: string;
    reservationId?: string;
    guestEmail?: string;
    responses: Record<string, any>;
  }) {
    if (!data.campgroundId) {
      throw new BadRequestException("campgroundId is required");
    }

    const template = await this.prisma.formTemplate.findUnique({
      where: { id: data.formTemplateId },
      select: { id: true, campgroundId: true, isActive: true, title: true, type: true }
    });
    if (!template) throw new NotFoundException("Form template not found");

    // Validate form belongs to the specified campground
    if (template.campgroundId !== data.campgroundId) {
      throw new NotFoundException("Form template not found");
    }

    // Validate form is active
    if (!template.isActive) {
      throw new BadRequestException("This form is currently inactive and cannot accept submissions. Please contact the campground");
    }

    // If reservationId is provided, validate it belongs to the same campground
    if (data.reservationId) {
      const reservation = await this.prisma.reservation.findFirst({
        where: { id: data.reservationId, campgroundId: data.campgroundId },
        select: { id: true }
      });
      if (!reservation) {
        throw new BadRequestException("Reservation not found or does not belong to this campground");
      }
    }

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
   * Get form submissions for a reservation (public access via token)
   */
  async getReservationFormSubmissions(reservationId: string, token?: string) {
    if (!this.validatePublicReservationToken(reservationId, token)) {
      throw new NotFoundException("Reservation not found");
    }

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
