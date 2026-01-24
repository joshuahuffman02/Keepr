import { Injectable, Logger, NotFoundException } from "@nestjs/common";
import { randomUUID } from "crypto";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class WaiversService {
  private readonly logger = new Logger(WaiversService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Generate a lightweight PDF (base64 data URL) for a waiver.
   * If WAIVER_PDF_ENABLED is not true, returns a noop stub with telemetry.
   */
  async generateWaiverPdf(waiverId: string) {
    const waiver = await this.prisma.digitalWaiver.findUnique({ where: { id: waiverId } });
    if (!waiver) throw new NotFoundException("Waiver not found");

    const pdfEnabled = process.env.WAIVER_PDF_ENABLED === "true";

    if (!pdfEnabled) {
      this.logger.warn(`[WaiverPDF] Skipped generation (feature flag disabled) for ${waiverId}`);
      return { waiverId, status: "skipped" };
    }

    // Minimal PDF content (not a full PDF renderer)
    const content = `Waiver for guest ${waiver.guestId || ""} at campground ${waiver.campgroundId}\nStatus: ${waiver.status}\nGenerated: ${new Date().toISOString()}`;
    const base64 = Buffer.from(content).toString("base64");
    const dataUrl = `data:application/pdf;base64,${base64}`;

    await this.prisma.digitalWaiver.update({
      where: { id: waiverId },
      data: { pdfUrl: dataUrl },
    });

    this.logger.log(`[WaiverPDF] Generated inline PDF for ${waiverId}`);
    return { waiverId, pdfUrl: dataUrl };
  }

  /**
   * Start an ID verification flow.
   * If no provider keys are configured, records a noop attempt with telemetry.
   */
  async startIdVerification(guestId: string, reservationId?: string, provider?: string) {
    const stripeKey = process.env.STRIPE_IDENTITY_KEY;
    const jumioKey = process.env.JUMIO_API_KEY;
    const chosenProvider =
      provider || (stripeKey ? "stripe_identity" : jumioKey ? "jumio" : "noop");

    const campgroundId = await this.resolveCampgroundId(reservationId);
    if (!campgroundId) {
      throw new NotFoundException("Campground required for ID verification");
    }

    const verification = await this.prisma.idVerification.create({
      data: {
        id: randomUUID(),
        guestId,
        reservationId: reservationId ?? null,
        campgroundId,
        status: chosenProvider === "noop" ? "pending" : "pending",
        provider: chosenProvider,
        metadata: { startedAt: new Date().toISOString(), provider: chosenProvider },
        updatedAt: new Date(),
      },
    });

    if (chosenProvider === "noop") {
      this.logger.warn(
        `[IDV] No provider configured; recorded noop verification for guest ${guestId}`,
      );
    } else {
      this.logger.log(`[IDV] Started verification via ${chosenProvider} for guest ${guestId}`);
    }

    return verification;
  }

  async completeVerification(id: string, success: boolean) {
    return this.prisma.idVerification.update({
      where: { id },
      data: {
        status: success ? "verified" : "failed",
        verifiedAt: success ? new Date() : null,
        updatedAt: new Date(),
      },
    });
  }

  private async resolveCampgroundId(reservationId?: string | null) {
    if (!reservationId) return null;
    const reservation = await this.prisma.reservation.findUnique({
      where: { id: reservationId },
      select: { campgroundId: true },
    });
    return reservation?.campgroundId ?? null;
  }
}
