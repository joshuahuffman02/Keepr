import { Injectable, BadRequestException, NotFoundException, Logger } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { StripeService } from "../payments/stripe.service";
import type { Prisma, StripeTerminalLocation, StripeTerminalReader } from "@prisma/client";
import { randomUUID } from "crypto";

type TerminalLocationRecord = StripeTerminalLocation & {
  _count?: { StripeTerminalReader: number };
};
type TerminalReaderRecord = StripeTerminalReader & {
  StripeTerminalLocation?: { displayName: string | null } | null;
};

export interface TerminalLocationInfo {
  id: string;
  stripeLocationId: string;
  displayName: string;
  address: Prisma.JsonValue | null;
  readerCount: number;
  createdAt: Date;
}

export interface TerminalReaderInfo {
  id: string;
  stripeReaderId: string;
  label: string;
  deviceType: string;
  serialNumber: string | null;
  status: string;
  lastSeenAt: Date | null;
  locationId: string | null;
  locationName: string | null;
  createdAt: Date;
}

@Injectable()
export class TerminalService {
  private readonly logger = new Logger(TerminalService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly stripe: StripeService,
  ) {}

  // =========================================================================
  // TERMINAL LOCATIONS
  // =========================================================================

  /**
   * Create a Terminal Location for a campground
   */
  async createLocation(
    campgroundId: string,
    displayName: string,
    address: {
      line1: string;
      line2?: string;
      city: string;
      state: string;
      postal_code: string;
      country: string;
    },
  ): Promise<TerminalLocationInfo> {
    const campground = await this.prisma.campground.findUnique({
      where: { id: campgroundId },
      select: { stripeAccountId: true },
    });

    if (!campground?.stripeAccountId) {
      throw new BadRequestException("Campground is not connected to Stripe");
    }

    // Create in Stripe
    const location = await this.stripe.createTerminalLocation(
      campground.stripeAccountId,
      displayName,
      address,
    );

    // Store locally
    const localLocation = await this.prisma.stripeTerminalLocation.create({
      data: {
        id: randomUUID(),
        campgroundId,
        stripeLocationId: location.id,
        displayName,
        address,
        updatedAt: new Date(),
      },
      include: {
        _count: { select: { StripeTerminalReader: true } },
      },
    });

    return this.mapLocation(localLocation);
  }

  /**
   * List all Terminal Locations for a campground
   */
  async listLocations(campgroundId: string): Promise<TerminalLocationInfo[]> {
    const locations = await this.prisma.stripeTerminalLocation.findMany({
      where: { campgroundId },
      include: {
        _count: { select: { StripeTerminalReader: true } },
      },
      orderBy: { displayName: "asc" },
    });

    return locations.map((loc) => this.mapLocation(loc));
  }

  /**
   * Get a specific Terminal Location
   */
  async getLocation(
    campgroundId: string,
    locationId: string,
  ): Promise<TerminalLocationInfo | null> {
    const location = await this.prisma.stripeTerminalLocation.findFirst({
      where: { id: locationId, campgroundId },
      include: {
        _count: { select: { StripeTerminalReader: true } },
      },
    });

    return location ? this.mapLocation(location) : null;
  }

  /**
   * Delete a Terminal Location
   */
  async deleteLocation(campgroundId: string, locationId: string): Promise<void> {
    const location = await this.prisma.stripeTerminalLocation.findFirst({
      where: { id: locationId, campgroundId },
      include: { _count: { select: { StripeTerminalReader: true } } },
    });

    if (!location) {
      throw new NotFoundException("Location not found");
    }

    if (location._count.StripeTerminalReader > 0) {
      throw new BadRequestException(
        "Cannot delete location with registered readers. Remove readers first.",
      );
    }

    const campground = await this.prisma.campground.findUnique({
      where: { id: campgroundId },
      select: { stripeAccountId: true },
    });

    if (campground?.stripeAccountId) {
      try {
        await this.stripe.deleteTerminalLocation(
          campground.stripeAccountId,
          location.stripeLocationId,
        );
      } catch (error) {
        this.logger.warn("Failed to delete location from Stripe:", error);
      }
    }

    await this.prisma.stripeTerminalLocation.delete({
      where: { id: locationId },
    });
  }

  // =========================================================================
  // TERMINAL READERS
  // =========================================================================

  /**
   * Register a new Terminal Reader
   */
  async registerReader(
    campgroundId: string,
    registrationCode: string,
    label: string,
    locationId?: string,
  ): Promise<TerminalReaderInfo> {
    const campground = await this.prisma.campground.findUnique({
      where: { id: campgroundId },
      select: { stripeAccountId: true },
    });

    if (!campground?.stripeAccountId) {
      throw new BadRequestException("Campground is not connected to Stripe");
    }

    // If locationId provided, verify it exists and get Stripe ID
    let stripeLocationId: string | undefined;
    if (locationId) {
      const location = await this.prisma.stripeTerminalLocation.findFirst({
        where: { id: locationId, campgroundId },
      });
      if (!location) {
        throw new NotFoundException("Location not found");
      }
      stripeLocationId = location.stripeLocationId;
    }

    // Register in Stripe
    const reader = await this.stripe.registerTerminalReader(
      campground.stripeAccountId,
      registrationCode,
      label,
      stripeLocationId,
    );

    // Store locally
    const localReader = await this.prisma.stripeTerminalReader.create({
      data: {
        id: randomUUID(),
        campgroundId,
        locationId,
        stripeReaderId: reader.id,
        label,
        registrationCode,
        deviceType: reader.device_type || "unknown",
        serialNumber: reader.serial_number,
        status: reader.status || "offline",
        updatedAt: new Date(),
      },
      include: {
        StripeTerminalLocation: { select: { displayName: true } },
      },
    });

    return this.mapReader(localReader);
  }

  /**
   * List all Terminal Readers for a campground
   */
  async listReaders(campgroundId: string, locationId?: string): Promise<TerminalReaderInfo[]> {
    const where: Prisma.StripeTerminalReaderWhereInput = { campgroundId };
    if (locationId) {
      where.locationId = locationId;
    }

    const readers = await this.prisma.stripeTerminalReader.findMany({
      where,
      include: {
        StripeTerminalLocation: { select: { displayName: true } },
      },
      orderBy: [{ status: "asc" }, { label: "asc" }],
    });

    return readers.map((reader) => this.mapReader(reader));
  }

  /**
   * Get a specific Terminal Reader
   */
  async getReader(campgroundId: string, readerId: string): Promise<TerminalReaderInfo | null> {
    const reader = await this.prisma.stripeTerminalReader.findFirst({
      where: { id: readerId, campgroundId },
      include: {
        StripeTerminalLocation: { select: { displayName: true } },
      },
    });

    return reader ? this.mapReader(reader) : null;
  }

  /**
   * Get reader by Stripe reader ID
   */
  async getReaderByStripeId(
    campgroundId: string,
    stripeReaderId: string,
  ): Promise<TerminalReaderInfo | null> {
    const reader = await this.prisma.stripeTerminalReader.findFirst({
      where: { campgroundId, stripeReaderId },
      include: {
        StripeTerminalLocation: { select: { displayName: true } },
      },
    });

    return reader ? this.mapReader(reader) : null;
  }

  /**
   * Update reader status (called from webhook or polling)
   */
  async updateReaderStatus(
    campgroundId: string,
    stripeReaderId: string,
    status: string,
    ipAddress?: string,
  ): Promise<void> {
    await this.prisma.stripeTerminalReader.updateMany({
      where: { campgroundId, stripeReaderId },
      data: {
        status,
        lastSeenAt: new Date(),
        ...(ipAddress && { ipAddress }),
      },
    });
  }

  /**
   * Update reader label
   */
  async updateReaderLabel(
    campgroundId: string,
    readerId: string,
    label: string,
  ): Promise<TerminalReaderInfo> {
    const reader = await this.prisma.stripeTerminalReader.findFirst({
      where: { id: readerId, campgroundId },
    });

    if (!reader) {
      throw new NotFoundException("Reader not found");
    }

    const campground = await this.prisma.campground.findUnique({
      where: { id: campgroundId },
      select: { stripeAccountId: true },
    });

    if (campground?.stripeAccountId) {
      await this.stripe.updateTerminalReader(
        campground.stripeAccountId,
        reader.stripeReaderId,
        label,
      );
    }

    const updated = await this.prisma.stripeTerminalReader.update({
      where: { id: readerId },
      data: { label },
      include: {
        StripeTerminalLocation: { select: { displayName: true } },
      },
    });

    return this.mapReader(updated);
  }

  /**
   * Delete a Terminal Reader
   */
  async deleteReader(campgroundId: string, readerId: string): Promise<void> {
    const reader = await this.prisma.stripeTerminalReader.findFirst({
      where: { id: readerId, campgroundId },
    });

    if (!reader) {
      throw new NotFoundException("Reader not found");
    }

    const campground = await this.prisma.campground.findUnique({
      where: { id: campgroundId },
      select: { stripeAccountId: true },
    });

    if (campground?.stripeAccountId) {
      try {
        await this.stripe.deleteTerminalReader(campground.stripeAccountId, reader.stripeReaderId);
      } catch (error) {
        this.logger.warn("Failed to delete reader from Stripe:", error);
      }
    }

    await this.prisma.stripeTerminalReader.delete({
      where: { id: readerId },
    });
  }

  /**
   * Cancel any pending action on a reader
   */
  async cancelReaderAction(campgroundId: string, readerId: string): Promise<void> {
    const reader = await this.prisma.stripeTerminalReader.findFirst({
      where: { id: readerId, campgroundId },
    });

    if (!reader) {
      throw new NotFoundException("Reader not found");
    }

    const campground = await this.prisma.campground.findUnique({
      where: { id: campgroundId },
      select: { stripeAccountId: true },
    });

    if (!campground?.stripeAccountId) {
      throw new BadRequestException("Campground is not connected to Stripe");
    }

    await this.stripe.cancelTerminalReaderAction(campground.stripeAccountId, reader.stripeReaderId);

    // Update status
    await this.prisma.stripeTerminalReader.update({
      where: { id: readerId },
      data: { status: "online" },
    });
  }

  /**
   * Create a connection token for Terminal SDK
   */
  async createConnectionToken(
    campgroundId: string,
    locationId?: string,
  ): Promise<{ secret: string }> {
    const campground = await this.prisma.campground.findUnique({
      where: { id: campgroundId },
      select: { stripeAccountId: true },
    });

    if (!campground?.stripeAccountId) {
      throw new BadRequestException("Campground is not connected to Stripe");
    }

    let stripeLocationId: string | undefined;
    if (locationId) {
      const location = await this.prisma.stripeTerminalLocation.findFirst({
        where: { id: locationId, campgroundId },
      });
      stripeLocationId = location?.stripeLocationId;
    }

    const token = await this.stripe.createConnectionToken(
      campground.stripeAccountId,
      stripeLocationId,
    );

    return { secret: token.secret };
  }

  /**
   * Sync reader status from Stripe
   */
  async syncReaderStatus(campgroundId: string, readerId: string): Promise<TerminalReaderInfo> {
    const reader = await this.prisma.stripeTerminalReader.findFirst({
      where: { id: readerId, campgroundId },
    });

    if (!reader) {
      throw new NotFoundException("Reader not found");
    }

    const campground = await this.prisma.campground.findUnique({
      where: { id: campgroundId },
      select: { stripeAccountId: true },
    });

    if (!campground?.stripeAccountId) {
      throw new BadRequestException("Campground is not connected to Stripe");
    }

    const stripeReader = await this.stripe.getTerminalReader(
      campground.stripeAccountId,
      reader.stripeReaderId,
    );

    const updated = await this.prisma.stripeTerminalReader.update({
      where: { id: readerId },
      data: {
        status: stripeReader.status || "offline",
        lastSeenAt: new Date(),
        firmwareVersion: stripeReader.device_sw_version,
      },
      include: {
        StripeTerminalLocation: { select: { displayName: true } },
      },
    });

    return this.mapReader(updated);
  }

  private mapLocation(loc: TerminalLocationRecord): TerminalLocationInfo {
    return {
      id: loc.id,
      stripeLocationId: loc.stripeLocationId,
      displayName: loc.displayName,
      address: loc.address,
      readerCount: loc._count?.StripeTerminalReader || 0,
      createdAt: loc.createdAt,
    };
  }

  private mapReader(reader: TerminalReaderRecord): TerminalReaderInfo {
    return {
      id: reader.id,
      stripeReaderId: reader.stripeReaderId,
      label: reader.label,
      deviceType: reader.deviceType,
      serialNumber: reader.serialNumber,
      status: reader.status,
      lastSeenAt: reader.lastSeenAt,
      locationId: reader.locationId,
      locationName: reader.StripeTerminalLocation?.displayName || null,
      createdAt: reader.createdAt,
    };
  }
}
