import {
  Injectable,
  BadRequestException,
  NotFoundException,
  UnauthorizedException,
} from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { PublicReservationsService } from "../public-reservations/public-reservations.service";
import crypto, { randomUUID } from "crypto";

export interface KioskReservationDto {
  siteId: string;
  arrivalDate: string;
  departureDate: string;
  adults: number;
  children?: number;
  guest: {
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    zipCode: string;
  };
  equipment?: {
    type: string;
    plateNumber?: string;
  };
}

@Injectable()
export class KioskService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly publicReservations: PublicReservationsService,
  ) {}

  /**
   * Generate a 6-digit pairing code valid for 10 minutes
   */
  async generatePairingCode(campgroundId: string, createdById?: string) {
    // Generate a random 6-digit code
    const code = String(Math.floor(100000 + Math.random() * 900000));
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    // Delete any existing unused codes for this campground
    await this.prisma.kioskPairingCode.deleteMany({
      where: {
        campgroundId,
        usedAt: null,
      },
    });

    // Create new code
    const pairingCode = await this.prisma.kioskPairingCode.create({
      data: {
        id: randomUUID(),
        campgroundId,
        code,
        expiresAt,
        createdById,
      },
    });

    return {
      code: pairingCode.code,
      expiresAt: pairingCode.expiresAt,
    };
  }

  /**
   * Pair a kiosk device using a pairing code
   * Returns device token and campground info
   */
  async pairDevice(code: string, deviceName?: string, userAgent?: string) {
    // Find the pairing code
    const pairingCode = await this.prisma.kioskPairingCode.findFirst({
      where: {
        code,
        usedAt: null,
        expiresAt: { gt: new Date() },
      },
      include: {
        Campground: {
          select: {
            id: true,
            name: true,
            slug: true,
            heroImageUrl: true,
            latitude: true,
            longitude: true,
          },
        },
      },
    });

    if (!pairingCode) {
      throw new BadRequestException("Invalid or expired pairing code");
    }

    // Generate a secure device token
    const deviceToken = crypto.randomBytes(32).toString("hex");

    // Create the kiosk device
    const device = await this.prisma.kioskDevice.create({
      data: {
        id: randomUUID(),
        campgroundId: pairingCode.campgroundId,
        name: deviceName || `Kiosk ${new Date().toLocaleDateString()}`,
        deviceToken,
        userAgent,
        lastSeenAt: new Date(),
        updatedAt: new Date(),
      },
    });

    // Mark the pairing code as used
    await this.prisma.kioskPairingCode.update({
      where: { id: pairingCode.id },
      data: {
        usedAt: new Date(),
        usedByDeviceId: device.id,
      },
    });

    return {
      deviceToken,
      deviceId: device.id,
      campground: pairingCode.Campground,
    };
  }

  /**
   * Validate a device token and return campground info
   * Used by kiosk to verify it's still authorized
   */
  async validateDevice(deviceToken: string, userAgent?: string) {
    const device = await this.prisma.kioskDevice.findUnique({
      where: { deviceToken },
      include: {
        Campground: {
          select: {
            id: true,
            name: true,
            slug: true,
            heroImageUrl: true,
            latitude: true,
            longitude: true,
            checkInTime: true,
            checkOutTime: true,
          },
        },
      },
    });

    if (!device) {
      throw new UnauthorizedException("Invalid device token");
    }

    if (device.status !== "active") {
      throw new UnauthorizedException("Device has been disabled or revoked");
    }

    // Update last seen
    await this.prisma.kioskDevice.update({
      where: { id: device.id },
      data: {
        lastSeenAt: new Date(),
        userAgent: userAgent || device.userAgent,
      },
    });

    return {
      deviceId: device.id,
      deviceName: device.name,
      campground: device.Campground,
      features: {
        allowWalkIns: device.allowWalkIns,
        allowCheckIn: device.allowCheckIn,
        allowPayments: device.allowPayments,
      },
    };
  }

  /**
   * List all kiosk devices for a campground
   */
  async listDevices(campgroundId: string) {
    const devices = await this.prisma.kioskDevice.findMany({
      where: { campgroundId },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        status: true,
        lastSeenAt: true,
        userAgent: true,
        allowWalkIns: true,
        allowCheckIn: true,
        allowPayments: true,
        createdAt: true,
        revokedAt: true,
      },
    });

    return devices;
  }

  /**
   * Update a kiosk device's settings
   */
  async updateDevice(
    campgroundId: string,
    deviceId: string,
    data: {
      name?: string;
      allowWalkIns?: boolean;
      allowCheckIn?: boolean;
      allowPayments?: boolean;
    },
  ) {
    const device = await this.prisma.kioskDevice.findFirst({
      where: { id: deviceId, campgroundId },
    });

    if (!device) {
      throw new NotFoundException("Device not found");
    }

    return this.prisma.kioskDevice.update({
      where: { id: deviceId },
      data,
    });
  }

  /**
   * Revoke/disable a kiosk device
   */
  async revokeDevice(campgroundId: string, deviceId: string) {
    const device = await this.prisma.kioskDevice.findFirst({
      where: { id: deviceId, campgroundId },
    });

    if (!device) {
      throw new NotFoundException("Device not found");
    }

    return this.prisma.kioskDevice.update({
      where: { id: deviceId },
      data: {
        status: "revoked",
        revokedAt: new Date(),
      },
    });
  }

  /**
   * Re-enable a revoked device
   */
  async enableDevice(campgroundId: string, deviceId: string) {
    const device = await this.prisma.kioskDevice.findFirst({
      where: { id: deviceId, campgroundId },
    });

    if (!device) {
      throw new NotFoundException("Device not found");
    }

    return this.prisma.kioskDevice.update({
      where: { id: deviceId },
      data: {
        status: "active",
        revokedAt: null,
      },
    });
  }

  /**
   * Delete a kiosk device permanently
   */
  async deleteDevice(campgroundId: string, deviceId: string) {
    const device = await this.prisma.kioskDevice.findFirst({
      where: { id: deviceId, campgroundId },
    });

    if (!device) {
      throw new NotFoundException("Device not found");
    }

    await this.prisma.kioskDevice.delete({
      where: { id: deviceId },
    });

    return { deleted: true };
  }

  /**
   * Create a walk-in reservation from the kiosk
   * Validates device token and creates reservation for the associated campground
   */
  async createReservation(deviceToken: string, dto: KioskReservationDto, userAgent?: string) {
    // Validate device and get campground
    const device = await this.prisma.kioskDevice.findUnique({
      where: { deviceToken },
      include: {
        Campground: {
          select: {
            id: true,
            slug: true,
            name: true,
          },
        },
      },
    });

    if (!device) {
      throw new UnauthorizedException("Invalid device token");
    }

    if (device.status !== "active") {
      throw new UnauthorizedException("Device has been disabled or revoked");
    }

    if (!device.allowWalkIns) {
      throw new BadRequestException("This kiosk is not authorized for walk-in reservations");
    }

    // Update last seen
    await this.prisma.kioskDevice.update({
      where: { id: device.id },
      data: {
        lastSeenAt: new Date(),
        userAgent: userAgent || device.userAgent,
      },
    });

    // Create reservation using public reservations service
    const reservation = await this.publicReservations.createReservation({
      campgroundSlug: device.Campground.slug,
      siteId: dto.siteId,
      arrivalDate: dto.arrivalDate,
      departureDate: dto.departureDate,
      adults: dto.adults,
      children: dto.children ?? 0,
      guest: dto.guest,
      equipment: dto.equipment,
      source: "kiosk", // Mark as kiosk booking for analytics
    });

    return reservation;
  }
}
