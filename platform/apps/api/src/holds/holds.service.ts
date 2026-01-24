import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleDestroy,
  OnModuleInit,
} from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { CreateHoldDto } from "./dto/create-hold.dto";
import { ReservationStatus, type Prisma } from "@prisma/client";
import { randomUUID } from "crypto";
import { WaitlistService } from "../waitlist/waitlist.service";

type SiteHoldWithSite = Prisma.SiteHoldGetPayload<{
  include: {
    Site: {
      select: {
        id: true;
        siteClassId: true;
      };
    };
  };
}>;

@Injectable()
export class HoldsService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(HoldsService.name);
  private expireTimer?: NodeJS.Timeout;

  constructor(
    private readonly prisma: PrismaService,
    private readonly waitlistService: WaitlistService,
  ) {}

  onModuleInit() {
    const intervalMs = Number(process.env.HOLDS_EXPIRE_INTERVAL_MS ?? 5 * 60 * 1000);
    if (intervalMs > 0) {
      this.logger.log(`Starting hold expiry worker (every ${intervalMs} ms)`);
      this.expireTimer = setInterval(async () => {
        try {
          const expired = await this.expireStale();
          if (expired > 0) this.logger.log(`Expired ${expired} holds`);
        } catch (err) {
          this.logger.warn(`Hold expiry worker failed: ${err}`);
        }
      }, intervalMs);
      this.expireTimer.unref?.();
    }
  }

  onModuleDestroy() {
    if (this.expireTimer) {
      clearInterval(this.expireTimer);
      this.expireTimer = undefined;
    }
  }

  private parseDates(arrivalDate: string, departureDate: string) {
    const arrival = new Date(arrivalDate);
    const departure = new Date(departureDate);
    if (isNaN(arrival.valueOf()) || isNaN(departure.valueOf())) {
      throw new BadRequestException("Invalid dates");
    }
    if (departure <= arrival) {
      throw new BadRequestException("departureDate must be after arrivalDate");
    }
    return { arrival, departure };
  }

  private async assertNoOverlap(siteId: string, arrival: Date, departure: Date) {
    const now = new Date();

    // Active holds overlap
    const holdOverlap = await this.prisma.siteHold.count({
      where: {
        siteId,
        status: "active",
        OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
        arrivalDate: { lt: departure },
        departureDate: { gt: arrival },
      },
    });
    if (holdOverlap > 0) throw new BadRequestException("Site is on hold for those dates");

    // Existing reservations overlap
    const reservationOverlap = await this.prisma.reservation.count({
      where: {
        siteId,
        status: { not: ReservationStatus.cancelled },
        departureDate: { gt: arrival },
        arrivalDate: { lt: departure },
      },
    });
    if (reservationOverlap > 0)
      throw new BadRequestException("Site already reserved for those dates");
  }

  private computeExpiry(holdMinutes?: number) {
    if (!holdMinutes || holdMinutes <= 0) return null;
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + holdMinutes);
    return expiresAt;
  }

  async create(dto: CreateHoldDto) {
    const { arrival, departure } = this.parseDates(dto.arrivalDate, dto.departureDate);
    const site = await this.prisma.site.findUnique({
      where: { id: dto.siteId },
      select: { id: true, campgroundId: true },
    });
    if (!site || site.campgroundId !== dto.campgroundId) {
      throw new NotFoundException("Site not found for campground");
    }

    await this.assertNoOverlap(dto.siteId, arrival, departure);

    return this.prisma.siteHold.create({
      data: {
        id: randomUUID(),
        campgroundId: dto.campgroundId,
        siteId: dto.siteId,
        arrivalDate: arrival,
        departureDate: departure,
        expiresAt: this.computeExpiry(dto.holdMinutes ?? 15),
        status: "active",
        note: dto.note ?? null,
      },
    });
  }

  async release(campgroundId: string, id: string) {
    const existing = await this.prisma.siteHold.findFirst({
      where: { id, campgroundId },
    });
    if (!existing) throw new NotFoundException("Hold not found");
    return this.prisma.siteHold.update({
      where: { id },
      data: { status: "released", expiresAt: existing.expiresAt ?? new Date() },
    });
  }

  async listByCampground(campgroundId: string) {
    const now = new Date();
    return this.prisma.siteHold.findMany({
      where: {
        campgroundId,
        status: "active",
        OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
      },
      include: { Site: { select: { id: true, name: true, siteNumber: true } } },
      orderBy: { arrivalDate: "asc" },
    });
  }

  async expireStale(campgroundId?: string) {
    const now = new Date();
    const where = campgroundId
      ? { status: "active", expiresAt: { lte: now }, campgroundId }
      : { status: "active", expiresAt: { lte: now } };
    const expired = await this.prisma.siteHold.findMany({
      where,
      include: { Site: { select: { id: true, siteClassId: true } } },
    });

    if (expired.length === 0) return 0;

    await Promise.all(
      expired.map((hold: SiteHoldWithSite) =>
        this.prisma.siteHold.update({
          where: { id: hold.id },
          data: { status: "expired" },
        }),
      ),
    );

    // Notify waitlist for each expired hold (fire and forget)
    for (const hold of expired) {
      try {
        await this.waitlistService.checkWaitlist(
          hold.campgroundId,
          hold.arrivalDate,
          hold.departureDate,
          hold.siteId,
          hold.Site?.siteClassId ?? undefined,
        );
      } catch (err) {
        // Swallow to avoid failing the batch; consider logging in the future
      }
    }

    return expired.length;
  }
}
