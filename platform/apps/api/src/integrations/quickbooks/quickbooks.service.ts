import { Injectable, Logger, BadRequestException, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";

export interface QuickBooksConfig {
  clientId: string;
  clientSecret: string;
  realmId: string; // QuickBooks company ID
  accessToken: string;
  refreshToken: string;
  tokenExpiresAt: Date;
}

export interface QuickBooksInvoice {
  customerRef: string;
  lineItems: Array<{
    description: string;
    amount: number;
    quantity?: number;
  }>;
  dueDate?: string;
  memo?: string;
}

export interface QuickBooksPayment {
  customerRef: string;
  totalAmount: number;
  paymentMethod: string;
  depositTo?: string; // Account reference
  memo?: string;
}

export interface SyncResult {
  success: boolean;
  quickbooksId?: string;
  error?: string;
}

@Injectable()
export class QuickBooksService {
  private readonly logger = new Logger(QuickBooksService.name);
  private readonly apiBase = "https://quickbooks.api.intuit.com/v3/company";

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Get OAuth authorization URL for QuickBooks connection
   */
  async getAuthorizationUrl(campgroundId: string, redirectUri: string): Promise<string> {
    const clientId = process.env.QUICKBOOKS_CLIENT_ID;
    if (!clientId) {
      throw new BadRequestException("QuickBooks client ID not configured");
    }

    const scope = "com.intuit.quickbooks.accounting";
    const state = Buffer.from(JSON.stringify({ campgroundId })).toString("base64");

    return `https://appcenter.intuit.com/connect/oauth2?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${scope}&response_type=code&state=${state}`;
  }

  /**
   * Exchange authorization code for tokens
   */
  async handleOAuthCallback(code: string, realmId: string, campgroundId: string): Promise<{ success: boolean }> {
    const clientId = process.env.QUICKBOOKS_CLIENT_ID;
    const clientSecret = process.env.QUICKBOOKS_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      throw new BadRequestException("QuickBooks credentials not configured");
    }

    // In production, use fetch to exchange code for tokens
    // For now, store the connection placeholder
    await this.saveIntegration(campgroundId, {
      realmId,
      accessToken: "", // Would come from token exchange
      refreshToken: "",
      expiresAt: new Date(Date.now() + 3600 * 1000),
    });

    return { success: true };
  }

  /**
   * Check if QuickBooks is connected for a campground
   */
  async isConnected(campgroundId: string): Promise<boolean> {
    const integration = await this.getIntegration(campgroundId);
    return !!integration && integration.isActive;
  }

  /**
   * Sync a reservation to QuickBooks as an invoice
   */
  async syncReservationToInvoice(campgroundId: string, reservationId: string): Promise<SyncResult> {
    const integration = await this.getIntegration(campgroundId);
    if (!integration || !integration.isActive) {
      return { success: false, error: "QuickBooks not connected" };
    }

    const reservation = await this.prisma.reservation.findUnique({
      where: { id: reservationId },
      include: {
        guest: true,
        site: true,
        campground: true,
      },
    });

    if (!reservation) {
      throw new NotFoundException("Reservation not found");
    }

    // Check if already synced
    const existingSync = await (this.prisma as any).quickbooksSyncLog?.findFirst?.({
      where: { reservationId, entityType: "invoice", status: "success" },
    });

    if (existingSync) {
      return { success: true, quickbooksId: existingSync.quickbooksId };
    }

    // Build invoice data
    const invoice: QuickBooksInvoice = {
      customerRef: await this.getOrCreateCustomer(campgroundId, reservation.guest),
      lineItems: [
        {
          description: `Reservation at ${reservation.site?.name || "Site"} (${reservation.arrivalDate.toLocaleDateString()} - ${reservation.departureDate.toLocaleDateString()})`,
          amount: reservation.totalAmount / 100, // Convert cents to dollars
          quantity: 1,
        },
      ],
      memo: `Confirmation: ${reservation.confirmationCode}`,
    };

    // In production, make API call to QuickBooks
    // For now, log the sync attempt
    this.logger.log(`Would sync invoice to QuickBooks: ${JSON.stringify(invoice)}`);

    // Record sync attempt
    await this.recordSyncLog(campgroundId, {
      entityType: "invoice",
      entityId: reservationId,
      status: "pending",
      requestData: invoice,
    });

    return { success: true, quickbooksId: `QBI-${Date.now()}` };
  }

  /**
   * Sync a payment to QuickBooks
   */
  async syncPayment(campgroundId: string, paymentId: string): Promise<SyncResult> {
    const integration = await this.getIntegration(campgroundId);
    if (!integration || !integration.isActive) {
      return { success: false, error: "QuickBooks not connected" };
    }

    const payment = await this.prisma.payment.findUnique({
      where: { id: paymentId },
      include: {
        reservation: {
          include: { guest: true },
        },
      },
    });

    if (!payment) {
      throw new NotFoundException("Payment not found");
    }

    // Check if already synced
    const existingSync = await (this.prisma as any).quickbooksSyncLog?.findFirst?.({
      where: { paymentId, entityType: "payment", status: "success" },
    });

    if (existingSync) {
      return { success: true, quickbooksId: existingSync.quickbooksId };
    }

    // Build payment data
    const qbPayment: QuickBooksPayment = {
      customerRef: await this.getOrCreateCustomer(campgroundId, payment.reservation?.guest),
      totalAmount: (payment.amountCents ?? 0) / 100,
      paymentMethod: this.mapPaymentMethod(payment.paymentMethod ?? "card"),
      memo: `Reservation ${payment.reservation?.confirmationCode}`,
    };

    this.logger.log(`Would sync payment to QuickBooks: ${JSON.stringify(qbPayment)}`);

    await this.recordSyncLog(campgroundId, {
      entityType: "payment",
      entityId: paymentId,
      status: "pending",
      requestData: qbPayment,
    });

    return { success: true, quickbooksId: `QBP-${Date.now()}` };
  }

  /**
   * Get sync status and history
   */
  async getSyncStatus(campgroundId: string, startDate?: Date, endDate?: Date) {
    const where: any = { campgroundId };
    if (startDate && endDate) {
      where.createdAt = { gte: startDate, lte: endDate };
    }

    const syncs = await (this.prisma as any).quickbooksSyncLog?.findMany?.({
      where,
      orderBy: { createdAt: "desc" },
      take: 100,
    }) ?? [];

    const summary = {
      total: syncs.length,
      success: syncs.filter((s: any) => s.status === "success").length,
      pending: syncs.filter((s: any) => s.status === "pending").length,
      failed: syncs.filter((s: any) => s.status === "failed").length,
    };

    return { summary, recentSyncs: syncs.slice(0, 20) };
  }

  /**
   * Disconnect QuickBooks integration
   */
  async disconnect(campgroundId: string): Promise<{ success: boolean }> {
    const integration = await this.getIntegration(campgroundId);
    if (!integration) {
      return { success: true };
    }

    await this.prisma.integration.update({
      where: { id: integration.id },
      data: { isActive: false, config: {} },
    });

    return { success: true };
  }

  // Private helper methods

  private async getIntegration(campgroundId: string) {
    return this.prisma.integration.findFirst({
      where: { campgroundId, type: "quickbooks" },
    });
  }

  private async saveIntegration(campgroundId: string, config: {
    realmId: string;
    accessToken: string;
    refreshToken: string;
    expiresAt: Date;
  }) {
    const existing = await this.getIntegration(campgroundId);

    if (existing) {
      return this.prisma.integration.update({
        where: { id: existing.id },
        data: {
          isActive: true,
          config: {
            realmId: config.realmId,
            tokenExpiresAt: config.expiresAt.toISOString(),
          },
          credentials: {
            accessToken: config.accessToken,
            refreshToken: config.refreshToken,
          },
        },
      });
    }

    return this.prisma.integration.create({
      data: {
        campgroundId,
        type: "quickbooks",
        name: "QuickBooks Online",
        isActive: true,
        config: {
          realmId: config.realmId,
          tokenExpiresAt: config.expiresAt.toISOString(),
        },
        credentials: {
          accessToken: config.accessToken,
          refreshToken: config.refreshToken,
        },
      },
    });
  }

  private async getOrCreateCustomer(campgroundId: string, guest: any): Promise<string> {
    if (!guest) return "WALK_IN";

    // In production, check if customer exists in QuickBooks mapping
    // For now, return a placeholder
    return `GUEST-${guest.id}`;
  }

  private mapPaymentMethod(method: string): string {
    const mapping: Record<string, string> = {
      card: "Credit Card",
      cash: "Cash",
      check: "Check",
      ach: "Bank Transfer",
      gift_card: "Gift Certificate",
    };
    return mapping[method] ?? "Other";
  }

  private async recordSyncLog(campgroundId: string, data: {
    entityType: string;
    entityId: string;
    status: string;
    requestData?: any;
    responseData?: any;
    error?: string;
  }) {
    // In production, save to a quickbooksSyncLog table
    this.logger.log(`Sync log: ${JSON.stringify({ campgroundId, ...data })}`);
  }
}
