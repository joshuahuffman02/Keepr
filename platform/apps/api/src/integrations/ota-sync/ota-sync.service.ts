import {
  Injectable,
  Logger,
  BadRequestException,
  NotFoundException,
} from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { BaseOtaProvider, OtaBooking, OtaSyncResult, OtaProviderConfig } from "./providers/base-ota.provider";
import { ICalProvider } from "./providers/ical.provider";

/**
 * OTA Sync Service
 *
 * Handles synchronization of reservations from OTAs (Airbnb, VRBO, Booking.com, etc.)
 *
 * Key patterns from scraping-apis:
 * - Deduplication: remove_duplicate_apis.js (@@unique constraint + check before insert)
 * - Rate limiting: fetch_apify_actors.js:122 (500ms delay between requests)
 * - Error retry: fetch_apify_actors.js:124-128 (retry with 5s delay)
 * - Pagination: fetch_apify_actors.js:55-134 (offset-based fetching)
 */
@Injectable()
export class OtaSyncService {
  private readonly logger = new Logger(OtaSyncService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Get all OTA channels for a campground
   */
  async getChannels(campgroundId: string) {
    return this.prisma.otaChannel.findMany({
      where: { campgroundId },
      include: {
        mappings: {
          include: {
            site: { select: { id: true, name: true } },
            siteClass: { select: { id: true, name: true } },
          },
        },
        syncLogs: {
          orderBy: { createdAt: "desc" },
          take: 5,
        },
      },
      orderBy: { name: "asc" },
    });
  }

  /**
   * Get a single channel by ID
   */
  async getChannel(channelId: string) {
    const channel = await this.prisma.otaChannel.findUnique({
      where: { id: channelId },
      include: {
        mappings: {
          include: {
            site: { select: { id: true, name: true } },
            siteClass: { select: { id: true, name: true } },
          },
        },
        syncLogs: {
          orderBy: { createdAt: "desc" },
          take: 20,
        },
        imports: {
          orderBy: { createdAt: "desc" },
          take: 50,
          include: {
            reservation: {
              select: { id: true, arrivalDate: true, departureDate: true, status: true },
            },
          },
        },
      },
    });

    if (!channel) {
      throw new NotFoundException(`Channel ${channelId} not found`);
    }

    return channel;
  }

  /**
   * Create a new OTA channel
   */
  async createChannel(data: {
    campgroundId: string;
    name: string;
    provider: string;
    rateMultiplier?: number;
    defaultStatus?: string;
    feeMode?: string;
  }) {
    return this.prisma.otaChannel.create({
      data: {
        campgroundId: data.campgroundId,
        name: data.name,
        provider: data.provider,
        status: "disabled",
        rateMultiplier: data.rateMultiplier ?? 1.0,
        defaultStatus: data.defaultStatus ?? "confirmed",
        feeMode: data.feeMode ?? "absorb",
      },
    });
  }

  /**
   * Update channel settings
   */
  async updateChannel(
    channelId: string,
    data: Partial<{
      name: string;
      status: string;
      rateMultiplier: number;
      defaultStatus: string;
      feeMode: string;
      sendEmailNotifications: boolean;
      ignoreSiteRestrictions: boolean;
      ignoreCategoryRestrictions: boolean;
    }>
  ) {
    const channel = await this.prisma.otaChannel.findUnique({
      where: { id: channelId },
    });

    if (!channel) {
      throw new NotFoundException(`Channel ${channelId} not found`);
    }

    return this.prisma.otaChannel.update({
      where: { id: channelId },
      data,
    });
  }

  /**
   * Add or update a listing mapping (connects OTA listing to local site/siteClass)
   */
  async upsertMapping(data: {
    channelId: string;
    externalId: string;
    siteId?: string;
    siteClassId?: string;
    icalUrl?: string;
  }) {
    if (!data.siteId && !data.siteClassId) {
      throw new BadRequestException("Either siteId or siteClassId is required");
    }

    return this.prisma.otaListingMapping.upsert({
      where: {
        channelId_externalId: {
          channelId: data.channelId,
          externalId: data.externalId,
        },
      },
      create: {
        channelId: data.channelId,
        externalId: data.externalId,
        siteId: data.siteId ?? null,
        siteClassId: data.siteClassId ?? null,
        icalUrl: data.icalUrl ?? null,
        status: "mapped",
      },
      update: {
        siteId: data.siteId ?? undefined,
        siteClassId: data.siteClassId ?? undefined,
        icalUrl: data.icalUrl ?? undefined,
      },
    });
  }

  /**
   * Trigger a sync for a channel
   * This is the main entry point for OTA synchronization
   */
  async triggerSync(channelId: string): Promise<OtaSyncResult> {
    const channel = await this.prisma.otaChannel.findUnique({
      where: { id: channelId },
      include: {
        campground: { select: { id: true, name: true, timezone: true } },
        mappings: {
          where: { status: "mapped" },
          include: {
            site: { select: { id: true, name: true } },
            siteClass: { select: { id: true, name: true } },
          },
        },
      },
    });

    if (!channel) {
      throw new NotFoundException(`Channel ${channelId} not found`);
    }

    if (channel.status === "disabled") {
      throw new BadRequestException("Channel is disabled. Enable it before syncing.");
    }

    this.logger.log(`Starting sync for channel ${channel.name} (${channel.provider})`);

    const result: OtaSyncResult = {
      success: true,
      newBookings: 0,
      updatedBookings: 0,
      duplicatesSkipped: 0,
      errors: [],
      lastSyncAt: new Date(),
    };

    // Process each mapping
    for (const mapping of channel.mappings) {
      if (!mapping.icalUrl) {
        this.logger.warn(`Mapping ${mapping.id} has no iCal URL, skipping`);
        continue;
      }

      try {
        const provider = this.createProvider({
          channelId: channel.id,
          campgroundId: channel.campgroundId,
          provider: channel.provider,
          icalUrl: mapping.icalUrl,
          rateMultiplier: channel.rateMultiplier,
          defaultStatus: channel.defaultStatus as "confirmed" | "pending",
        });

        const bookings = await provider.fetchBookings();
        this.logger.log(`Fetched ${bookings.length} bookings from ${mapping.icalUrl}`);

        // Process each booking with deduplication
        // Pattern from remove_duplicate_apis.js - check unique constraint before insert
        for (const booking of bookings) {
          const processResult = await this.processBooking(
            channel,
            mapping,
            booking
          );

          if (processResult === "new") {
            result.newBookings++;
          } else if (processResult === "updated") {
            result.updatedBookings++;
          } else if (processResult === "duplicate") {
            result.duplicatesSkipped++;
          }
        }
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        result.errors.push({
          externalId: mapping.externalId,
          message,
        });
        this.logger.error(`Error syncing mapping ${mapping.id}: ${message}`);
      }
    }

    // Log the sync result
    await this.logSync(channel.id, result);

    // Update channel last sync time
    await this.prisma.otaChannel.update({
      where: { id: channelId },
      data: { lastSyncAt: new Date() },
    });

    result.success = result.errors.length === 0;
    this.logger.log(
      `Sync complete: ${result.newBookings} new, ${result.updatedBookings} updated, ${result.duplicatesSkipped} duplicates`
    );

    return result;
  }

  /**
   * Process a single booking with deduplication
   * Pattern from remove_duplicate_apis.js - uses @@unique([channelId, externalReservationId])
   */
  private async processBooking(
    channel: { id: string; campgroundId: string; defaultStatus: string },
    mapping: { id: string; siteId: string | null; siteClassId: string | null },
    booking: OtaBooking
  ): Promise<"new" | "updated" | "duplicate" | "error"> {
    // Check if we've already imported this booking
    // This is the deduplication check (from remove_duplicate_apis.js pattern)
    const existingImport = await this.prisma.otaReservationImport.findUnique({
      where: {
        channelId_externalReservationId: {
          channelId: channel.id,
          externalReservationId: booking.externalId,
        },
      },
      include: {
        reservation: true,
      },
    });

    if (existingImport) {
      // Already imported - check if we need to update
      if (existingImport.reservation) {
        const needsUpdate = this.bookingNeedsUpdate(
          existingImport.reservation,
          booking
        );

        if (needsUpdate) {
          await this.updateReservation(existingImport.reservation.id, booking);
          return "updated";
        }
      }

      return "duplicate";
    }

    // New booking - create reservation
    try {
      await this.createReservationFromBooking(channel, mapping, booking);
      return "new";
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to create reservation: ${message}`);
      return "error";
    }
  }

  /**
   * Check if an existing reservation needs to be updated
   */
  private bookingNeedsUpdate(
    reservation: { arrivalDate: Date; departureDate: Date; status: string },
    booking: OtaBooking
  ): boolean {
    const arrivalChanged =
      reservation.arrivalDate.getTime() !== booking.arrivalDate.getTime();
    const departureChanged =
      reservation.departureDate.getTime() !== booking.departureDate.getTime();
    const statusChanged =
      booking.status === "cancelled" && reservation.status !== "cancelled";

    return arrivalChanged || departureChanged || statusChanged;
  }

  /**
   * Update an existing reservation from OTA data
   */
  private async updateReservation(
    reservationId: string,
    booking: OtaBooking
  ): Promise<void> {
    const updateData: Record<string, unknown> = {};

    if (booking.status === "cancelled") {
      updateData.status = "cancelled";
    } else {
      updateData.arrivalDate = booking.arrivalDate;
      updateData.departureDate = booking.departureDate;
    }

    await this.prisma.reservation.update({
      where: { id: reservationId },
      data: updateData,
    });
  }

  /**
   * Create a new reservation from OTA booking data
   */
  private async createReservationFromBooking(
    channel: { id: string; campgroundId: string; defaultStatus: string },
    mapping: { id: string; siteId: string | null; siteClassId: string | null },
    booking: OtaBooking
  ): Promise<void> {
    // Find or create guest
    const guest = await this.findOrCreateGuest(
      channel.campgroundId,
      booking
    );

    // Determine site to use
    let siteId = mapping.siteId;
    if (!siteId && mapping.siteClassId) {
      // Find first available site in the class
      const site = await this.prisma.site.findFirst({
        where: { siteClassId: mapping.siteClassId, isActive: true },
        orderBy: { name: "asc" },
      });
      siteId = site?.id ?? null;
    }

    if (!siteId) {
      throw new BadRequestException("No site available for this booking");
    }

    // Create reservation and import record in transaction
    await this.prisma.$transaction(async (tx) => {
      const reservation = await tx.reservation.create({
        data: {
          campgroundId: channel.campgroundId,
          siteId,
          guestId: guest.id,
          arrivalDate: booking.arrivalDate,
          departureDate: booking.departureDate,
          status: channel.defaultStatus === "pending" ? "pending" : "confirmed",
          adults: booking.adults ?? 2,
          children: booking.children ?? 0,
          notes: booking.notes,
          source: `ota:${channel.id}`,
          totalAmount: booking.totalCents ?? 0,
        },
      });

      await tx.otaReservationImport.create({
        data: {
          channelId: channel.id,
          externalReservationId: booking.externalId,
          status: "imported",
          reservationId: reservation.id,
        },
      });
    });
  }

  /**
   * Find or create a guest from booking data
   */
  private async findOrCreateGuest(
    campgroundId: string,
    booking: OtaBooking
  ): Promise<{ id: string }> {
    const { firstName, lastName } = this.parseGuestName(booking.guestName);
    const email = booking.guestEmail?.toLowerCase().trim() || `guest-${booking.externalId}@ota.campreserv.com`;

    // Try to find existing guest by email
    const existing = await this.prisma.guest.findFirst({
      where: {
        campgroundId,
        emailNormalized: email.toLowerCase(),
      },
    });

    if (existing) {
      return { id: existing.id };
    }

    // Create new guest
    const guest = await this.prisma.guest.create({
      data: {
        campgroundId,
        primaryFirstName: firstName,
        primaryLastName: lastName,
        email,
        emailNormalized: email.toLowerCase(),
        phone: booking.guestPhone,
        phoneNormalized: booking.guestPhone?.replace(/\D/g, "") ?? null,
      },
    });

    return { id: guest.id };
  }

  /**
   * Parse guest name into first and last name
   */
  private parseGuestName(name: string): { firstName: string; lastName: string } {
    const parts = name.trim().split(/\s+/);
    if (parts.length === 1) {
      return { firstName: parts[0], lastName: "" };
    }
    return {
      firstName: parts.slice(0, -1).join(" "),
      lastName: parts[parts.length - 1],
    };
  }

  /**
   * Create the appropriate provider for a channel
   */
  private createProvider(config: OtaProviderConfig): BaseOtaProvider {
    // For now, all providers use iCal
    // Future: add API-based providers (Airbnb API, Booking.com API)
    return new ICalProvider(config);
  }

  /**
   * Log a sync result
   */
  private async logSync(channelId: string, result: OtaSyncResult): Promise<void> {
    await this.prisma.otaSyncLog.create({
      data: {
        channelId,
        direction: "pull",
        eventType: "reservation",
        status: result.success ? "success" : "failed",
        message: result.success
          ? `Synced ${result.newBookings} new, ${result.updatedBookings} updated`
          : `Sync completed with ${result.errors.length} errors`,
        payload: {
          newBookings: result.newBookings,
          updatedBookings: result.updatedBookings,
          duplicatesSkipped: result.duplicatesSkipped,
          errors: result.errors,
        },
      },
    });
  }

  /**
   * Get sync history for a channel
   */
  async getSyncLogs(channelId: string, limit = 50) {
    return this.prisma.otaSyncLog.findMany({
      where: { channelId },
      orderBy: { createdAt: "desc" },
      take: limit,
    });
  }

  /**
   * Get import history for a channel
   */
  async getImports(channelId: string, limit = 50) {
    return this.prisma.otaReservationImport.findMany({
      where: { channelId },
      orderBy: { createdAt: "desc" },
      take: limit,
      include: {
        reservation: {
          select: {
            id: true,
            arrivalDate: true,
            departureDate: true,
            status: true,
            guest: {
              select: {
                primaryFirstName: true,
                primaryLastName: true,
                email: true,
              },
            },
          },
        },
      },
    });
  }
}
