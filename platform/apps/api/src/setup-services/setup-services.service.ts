import { Injectable, NotFoundException, BadRequestException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

// Define types locally to avoid Prisma import issues at runtime
type SetupServiceType =
  | "quick_start"
  | "data_import_500"
  | "data_import_2000"
  | "data_import_5000"
  | "data_import_custom";

type SetupServiceStatus = "pending" | "in_progress" | "completed" | "cancelled";

// Pricing configuration (in cents)
const SETUP_SERVICE_PRICING: Record<SetupServiceType, number> = {
  quick_start: 24900,        // $249
  data_import_500: 29900,    // $299
  data_import_2000: 59900,   // $599
  data_import_5000: 99900,   // $999
  data_import_custom: 0,     // Custom quote
};

const PER_BOOKING_SURCHARGE_CENTS = 100; // $1.00

@Injectable()
export class SetupServicesService {
  constructor(private prisma: PrismaService) {}

  /**
   * Get pricing for all setup services
   */
  getPricing() {
    return {
      quickStart: {
        type: "quick_start",
        name: "Quick Start",
        priceCents: SETUP_SERVICE_PRICING.quick_start,
        description: "Site & rate configuration, payment gateway setup, 30-min training call",
        payOverTimeAvailable: true,
        perBookingSurchargeCents: PER_BOOKING_SURCHARGE_CENTS,
      },
      dataImport: [
        {
          type: "data_import_500",
          name: "Up to 500 reservations",
          priceCents: SETUP_SERVICE_PRICING.data_import_500,
          maxReservations: 500,
          payOverTimeAvailable: true,
          perBookingSurchargeCents: PER_BOOKING_SURCHARGE_CENTS,
        },
        {
          type: "data_import_2000",
          name: "501 - 2,000 reservations",
          priceCents: SETUP_SERVICE_PRICING.data_import_2000,
          maxReservations: 2000,
          payOverTimeAvailable: true,
          perBookingSurchargeCents: PER_BOOKING_SURCHARGE_CENTS,
        },
        {
          type: "data_import_5000",
          name: "2,001 - 5,000 reservations",
          priceCents: SETUP_SERVICE_PRICING.data_import_5000,
          maxReservations: 5000,
          payOverTimeAvailable: true,
          perBookingSurchargeCents: PER_BOOKING_SURCHARGE_CENTS,
        },
        {
          type: "data_import_custom",
          name: "5,000+ reservations",
          priceCents: null,
          maxReservations: null,
          payOverTimeAvailable: false,
          requiresQuote: true,
        },
      ],
    };
  }

  /**
   * Purchase a setup service
   */
  async purchase(data: {
    organizationId: string;
    serviceType: SetupServiceType;
    payUpfront: boolean;
    reservationCount?: number;
    importNotes?: string;
    stripePaymentIntentId?: string;
  }) {
    const priceCents = SETUP_SERVICE_PRICING[data.serviceType];

    if (priceCents === 0 && data.serviceType === "data_import_custom") {
      throw new BadRequestException(
        "Custom data import requires a quote. Please contact us."
      );
    }

    // Check if org already has an active service of the same type
    const existingService = await this.prisma.setupService.findFirst({
      where: {
        organizationId: data.organizationId,
        serviceType: data.serviceType,
        status: { in: ["pending", "in_progress"] },
      },
    });

    if (existingService) {
      throw new BadRequestException(
        `You already have an active ${data.serviceType} service.`
      );
    }

    const setupService = await this.prisma.setupService.create({
      data: {
        organizationId: data.organizationId,
        serviceType: data.serviceType,
        totalCents: priceCents,
        paidUpfrontCents: data.payUpfront ? priceCents : 0,
        balanceRemainingCents: data.payUpfront ? 0 : priceCents,
        perBookingSurchargeCents: PER_BOOKING_SURCHARGE_CENTS,
        reservationCount: data.reservationCount,
        importNotes: data.importNotes,
        stripePaymentIntentId: data.stripePaymentIntentId,
        status: "pending",
      },
    });

    return setupService;
  }

  /**
   * Get all setup services for an organization
   */
  async getForOrganization(organizationId: string) {
    const services = await this.prisma.setupService.findMany({
      where: { organizationId },
      orderBy: { createdAt: "desc" },
    });

    return services.map((s) => ({
      ...s,
      displayName: this.getDisplayName(s.serviceType),
      isPaidOff: s.balanceRemainingCents === 0,
      progressPercent:
        s.totalCents > 0
          ? Math.round(
              ((s.totalCents - s.balanceRemainingCents) / s.totalCents) * 100
            )
          : 100,
    }));
  }

  /**
   * Get active setup services with outstanding balance
   */
  async getActiveWithBalance(organizationId: string) {
    return this.prisma.setupService.findMany({
      where: {
        organizationId,
        balanceRemainingCents: { gt: 0 },
        status: { in: ["pending", "in_progress", "completed"] },
      },
      orderBy: { createdAt: "asc" }, // Pay off oldest first
    });
  }

  /**
   * Calculate total surcharge for a booking
   * Called when a booking is created to determine if extra fee applies
   */
  async calculateBookingSurcharge(organizationId: string): Promise<number> {
    const servicesWithBalance = await this.getActiveWithBalance(organizationId);

    if (servicesWithBalance.length === 0) {
      return 0;
    }

    // Charge $1 per active service with balance (in practice, usually just one)
    // But we only charge $1 total, applied to oldest first
    return PER_BOOKING_SURCHARGE_CENTS;
  }

  /**
   * Apply booking surcharge - deduct from balance
   * Called after a booking is successfully created
   */
  async applyBookingSurcharge(
    organizationId: string,
    reservationId: string
  ): Promise<{ charged: boolean; amountCents: number; serviceId?: string }> {
    const servicesWithBalance = await this.getActiveWithBalance(organizationId);

    if (servicesWithBalance.length === 0) {
      return { charged: false, amountCents: 0 };
    }

    // Apply to the oldest service first
    const service = servicesWithBalance[0];
    const chargeAmount = Math.min(
      service.perBookingSurchargeCents,
      service.balanceRemainingCents
    );

    const newBalance = service.balanceRemainingCents - chargeAmount;
    const isPaidOff = newBalance <= 0;

    await this.prisma.setupService.update({
      where: { id: service.id },
      data: {
        balanceRemainingCents: Math.max(0, newBalance),
        bookingsCharged: { increment: 1 },
        lastChargedAt: new Date(),
        paidOffAt: isPaidOff ? new Date() : undefined,
      },
    });

    return {
      charged: true,
      amountCents: chargeAmount,
      serviceId: service.id,
    };
  }

  /**
   * Update service status (admin)
   */
  async updateStatus(
    serviceId: string,
    status: SetupServiceStatus,
    completedBy?: string
  ) {
    const service = await this.prisma.setupService.findUnique({
      where: { id: serviceId },
    });

    if (!service) {
      throw new NotFoundException("Setup service not found");
    }

    const updateData: Record<string, unknown> = { status };

    if (status === "in_progress" && !service.startedAt) {
      updateData.startedAt = new Date();
    }

    if (status === "completed") {
      updateData.completedAt = new Date();
      if (completedBy) {
        updateData.completedBy = completedBy;
      }
    }

    return this.prisma.setupService.update({
      where: { id: serviceId },
      data: updateData,
    });
  }

  /**
   * Get a single setup service
   */
  async getById(serviceId: string) {
    const service = await this.prisma.setupService.findUnique({
      where: { id: serviceId },
      include: {
        organization: {
          select: { id: true, name: true },
        },
      },
    });

    if (!service) {
      throw new NotFoundException("Setup service not found");
    }

    return {
      ...service,
      displayName: this.getDisplayName(service.serviceType),
      isPaidOff: service.balanceRemainingCents === 0,
      progressPercent:
        service.totalCents > 0
          ? Math.round(
              ((service.totalCents - service.balanceRemainingCents) /
                service.totalCents) *
                100
            )
          : 100,
    };
  }

  /**
   * Add notes to a service (admin)
   */
  async addNotes(serviceId: string, notes: string) {
    return this.prisma.setupService.update({
      where: { id: serviceId },
      data: { notes },
    });
  }

  /**
   * Upload import file URL
   */
  async setImportFile(serviceId: string, fileUrl: string) {
    return this.prisma.setupService.update({
      where: { id: serviceId },
      data: { importFileUrl: fileUrl },
    });
  }

  private getDisplayName(type: SetupServiceType): string {
    const names: Record<SetupServiceType, string> = {
      quick_start: "Quick Start Setup",
      data_import_500: "Data Import (up to 500)",
      data_import_2000: "Data Import (501-2,000)",
      data_import_5000: "Data Import (2,001-5,000)",
      data_import_custom: "Data Import (Custom)",
    };
    return names[type] || type;
  }
}
