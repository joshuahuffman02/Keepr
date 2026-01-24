import { Injectable, NotFoundException, BadRequestException, Logger } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { createHash, randomBytes, randomUUID } from "crypto";
import * as QRCode from "qrcode";

export type QRCodeType =
  | "checkin" // Guest scans to start check-in
  | "checkout" // Guest scans to start check-out
  | "site" // Site identification QR
  | "amenity" // Amenity access (pool, laundry, etc.)
  | "store" // Store/POS ordering
  | "event" // Event registration
  | "wifi" // WiFi credentials
  | "emergency"; // Emergency info

const QR_CODE_TYPES: QRCodeType[] = [
  "checkin",
  "checkout",
  "site",
  "amenity",
  "store",
  "event",
  "wifi",
  "emergency",
];

const isQRCodeType = (value: string): value is QRCodeType =>
  QR_CODE_TYPES.some((type) => type === value);

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

interface GenerateQROptions {
  type: QRCodeType;
  campgroundId: string;
  reservationId?: string;
  siteId?: string;
  eventId?: string;
  amenityId?: string;
  expiresAt?: Date;
  metadata?: Record<string, unknown>;
}

export interface QRCodeResult {
  code: string;
  url: string;
  dataUrl: string; // Base64 encoded SVG
  expiresAt: Date | null;
}

@Injectable()
export class QRCodeService {
  private readonly logger = new Logger(QRCodeService.name);
  private readonly baseUrl: string;

  constructor(private readonly prisma: PrismaService) {
    this.baseUrl = process.env.PUBLIC_APP_URL || "https://app.keeprstay.com";
  }

  /**
   * Generate a unique QR code for check-in
   */
  async generateCheckinCode(reservationId: string): Promise<QRCodeResult> {
    const reservation = await this.prisma.reservation.findUnique({
      where: { id: reservationId },
      include: { Campground: true, Site: true, Guest: true },
    });

    if (!reservation) {
      throw new NotFoundException("Reservation not found");
    }

    // Generate a secure, short-lived token
    const token = this.generateSecureToken();
    const expiresAt = new Date(reservation.departureDate);
    expiresAt.setHours(23, 59, 59, 999); // Valid until end of stay

    // Store the QR code token
    const guestName = reservation.Guest
      ? `${reservation.Guest.primaryFirstName ?? ""} ${reservation.Guest.primaryLastName ?? ""}`.trim()
      : null;
    const qrCode = await this.prisma.qRCode.create({
      data: {
        id: randomUUID(),
        campgroundId: reservation.campgroundId,
        reservationId,
        siteId: reservation.siteId,
        type: "checkin",
        code: token,
        expiresAt,
        metadata: {
          guestName,
          siteNumber: reservation.Site?.siteNumber,
          arrivalDate: reservation.arrivalDate,
          departureDate: reservation.departureDate,
        },
        updatedAt: new Date(),
      },
    });

    const url = `${this.baseUrl}/checkin/${token}`;
    const dataUrl = await this.generateQRImage(url);

    return {
      code: token,
      url,
      dataUrl,
      expiresAt,
    };
  }

  /**
   * Generate a QR code for a site (permanent, for physical signage)
   */
  async generateSiteCode(siteId: string): Promise<QRCodeResult> {
    const site = await this.prisma.site.findUnique({
      where: { id: siteId },
      include: { Campground: true },
    });

    if (!site) {
      throw new NotFoundException("Site not found");
    }

    // Check if site already has a QR code
    let qrCode = await this.prisma.qRCode.findFirst({
      where: { siteId, type: "site", expiresAt: null },
    });

    if (!qrCode) {
      const token = this.generateSecureToken(8); // Shorter for site codes
      qrCode = await this.prisma.qRCode.create({
        data: {
          id: randomUUID(),
          campgroundId: site.campgroundId,
          siteId,
          type: "site",
          code: token,
          expiresAt: null, // Permanent
          metadata: {
            siteName: site.name,
            siteNumber: site.siteNumber,
            siteType: site.siteType,
          },
          updatedAt: new Date(),
        },
      });
    }

    const url = `${this.baseUrl}/site/${qrCode.code}`;
    const dataUrl = await this.generateQRImage(url);

    return {
      code: qrCode.code,
      url,
      dataUrl,
      expiresAt: null,
    };
  }

  /**
   * Generate QR code for WiFi credentials
   */
  async generateWifiCode(
    campgroundId: string,
    ssid: string,
    password: string,
  ): Promise<QRCodeResult> {
    // WiFi QR code format: WIFI:T:WPA;S:ssid;P:password;;
    const wifiString = `WIFI:T:WPA;S:${ssid};P:${password};;`;
    const dataUrl = await this.generateQRImage(wifiString);

    const token = this.generateSecureToken(6);
    await this.prisma.qRCode.create({
      data: {
        id: randomUUID(),
        campgroundId,
        type: "wifi",
        code: token,
        expiresAt: null,
        metadata: { ssid },
        updatedAt: new Date(),
      },
    });

    return {
      code: token,
      url: wifiString,
      dataUrl,
      expiresAt: null,
    };
  }

  /**
   * Generate QR code for event registration
   */
  async generateEventCode(eventId: string): Promise<QRCodeResult> {
    // Assuming there's an events table
    const token = this.generateSecureToken();
    const url = `${this.baseUrl}/events/register/${token}`;
    const dataUrl = await this.generateQRImage(url);

    return {
      code: token,
      url,
      dataUrl,
      expiresAt: null,
    };
  }

  /**
   * Generate QR code for store/POS ordering
   */
  async generateStoreCode(campgroundId: string, tableNumber?: string): Promise<QRCodeResult> {
    const token = this.generateSecureToken(6);
    const url = tableNumber
      ? `${this.baseUrl}/store/${campgroundId}?table=${tableNumber}`
      : `${this.baseUrl}/store/${campgroundId}`;

    const dataUrl = await this.generateQRImage(url);

    await this.prisma.qRCode.create({
      data: {
        id: randomUUID(),
        campgroundId,
        type: "store",
        code: token,
        expiresAt: null,
        metadata: { tableNumber },
        updatedAt: new Date(),
      },
    });

    return {
      code: token,
      url,
      dataUrl,
      expiresAt: null,
    };
  }

  /**
   * Validate and resolve a QR code
   */
  async validateCode(code: string): Promise<{
    valid: boolean;
    type?: QRCodeType;
    reservationId?: string;
    siteId?: string;
    campgroundId?: string;
    metadata?: Record<string, unknown>;
    error?: string;
  }> {
    const qrCode = await this.prisma.qRCode.findUnique({
      where: { code },
    });

    if (!qrCode) {
      return { valid: false, error: "QR code not found" };
    }

    if (qrCode.expiresAt && qrCode.expiresAt < new Date()) {
      return { valid: false, error: "QR code expired" };
    }

    if (qrCode.usedAt) {
      // For single-use codes like check-in
      if (qrCode.type === "checkin") {
        return { valid: false, error: "QR code already used" };
      }
    }

    const qrType = isQRCodeType(qrCode.type) ? qrCode.type : null;
    if (!qrType) {
      return { valid: false, error: "QR code type invalid" };
    }

    // Record scan
    await this.prisma.qRCode.update({
      where: { id: qrCode.id },
      data: {
        scanCount: { increment: 1 },
        lastScannedAt: new Date(),
      },
    });

    return {
      valid: true,
      type: qrType,
      reservationId: qrCode.reservationId || undefined,
      siteId: qrCode.siteId || undefined,
      campgroundId: qrCode.campgroundId,
      metadata: isRecord(qrCode.metadata) ? qrCode.metadata : {},
    };
  }

  /**
   * Mark a QR code as used (for single-use codes)
   */
  async markAsUsed(code: string): Promise<void> {
    await this.prisma.qRCode.update({
      where: { code },
      data: { usedAt: new Date() },
    });
  }

  /**
   * List QR codes for a campground
   */
  async listCodes(campgroundId: string, type?: QRCodeType) {
    return this.prisma.qRCode.findMany({
      where: {
        campgroundId,
        ...(type ? { type } : {}),
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    });
  }

  /**
   * Delete/invalidate a QR code
   */
  async deleteCode(code: string): Promise<void> {
    await this.prisma.qRCode.delete({
      where: { code },
    });
  }

  /**
   * Bulk generate site QR codes for all sites in a campground
   */
  async generateAllSiteCodes(
    campgroundId: string,
  ): Promise<{ generated: number; skipped: number }> {
    const sites = await this.prisma.site.findMany({
      where: { campgroundId },
    });

    let generated = 0;
    let skipped = 0;

    for (const site of sites) {
      const existing = await this.prisma.qRCode.findFirst({
        where: { siteId: site.id, type: "site", expiresAt: null },
      });

      if (existing) {
        skipped++;
        continue;
      }

      await this.generateSiteCode(site.id);
      generated++;
    }

    return { generated, skipped };
  }

  // Helper methods

  private generateSecureToken(length = 12): string {
    return randomBytes(length).toString("base64url").slice(0, length);
  }

  private async generateQRImage(data: string): Promise<string> {
    try {
      return await QRCode.toDataURL(data, {
        type: "image/png",
        width: 300,
        margin: 2,
        color: {
          dark: "#000000",
          light: "#ffffff",
        },
        errorCorrectionLevel: "M",
      });
    } catch (error) {
      this.logger.error(
        "Failed to generate QR code image:",
        error instanceof Error ? error.stack : error,
      );
      throw new BadRequestException("Failed to generate QR code");
    }
  }
}
