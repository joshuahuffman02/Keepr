import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Headers,
  UseGuards,
  Request,
  BadRequestException,
} from "@nestjs/common";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { KioskService } from "./kiosk.service";

@Controller()
export class KioskController {
  constructor(private readonly kioskService: KioskService) {}

  // ==========================================
  // Public Kiosk Endpoints (No Auth Required)
  // ==========================================

  /**
   * Pair a kiosk device using a 6-digit code
   * Called from the kiosk setup screen
   */
  @Post("kiosk/pair")
  async pairDevice(
    @Body() body: { code: string; deviceName?: string },
    @Headers("user-agent") userAgent?: string
  ) {
    return this.kioskService.pairDevice(body.code, body.deviceName, userAgent);
  }

  /**
   * Validate device token and get campground info
   * Called on kiosk page load to verify device is still authorized
   */
  @Get("kiosk/me")
  async getDeviceInfo(
    @Headers("x-kiosk-token") deviceToken: string,
    @Headers("user-agent") userAgent?: string
  ) {
    if (!deviceToken) {
      return { valid: false, error: "No device token provided" };
    }
    try {
      const result = await this.kioskService.validateDevice(deviceToken, userAgent);
      return { valid: true, ...result };
    } catch (error: any) {
      return { valid: false, error: error.message };
    }
  }

  /**
   * Create a walk-in reservation from the kiosk
   * Uses X-Kiosk-Token header for authentication
   */
  @Post("kiosk/reservations")
  async createReservation(
    @Headers("x-kiosk-token") deviceToken: string,
    @Headers("user-agent") userAgent: string | undefined,
    @Body()
    body: {
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
  ) {
    if (!deviceToken) {
      throw new BadRequestException("No device token provided");
    }
    return this.kioskService.createReservation(deviceToken, body, userAgent);
  }

  // ==========================================
  // Staff Endpoints (Require Auth)
  // ==========================================

  /**
   * Generate a pairing code for a campground
   */
  @Post("campgrounds/:campgroundId/kiosk/pairing-code")
  @UseGuards(JwtAuthGuard)
  async generatePairingCode(
    @Param("campgroundId") campgroundId: string,
    @Request() req: any
  ) {
    return this.kioskService.generatePairingCode(campgroundId, req.user?.id);
  }

  /**
   * List all kiosk devices for a campground
   */
  @Get("campgrounds/:campgroundId/kiosk/devices")
  @UseGuards(JwtAuthGuard)
  async listDevices(@Param("campgroundId") campgroundId: string) {
    return this.kioskService.listDevices(campgroundId);
  }

  /**
   * Update a kiosk device's settings
   */
  @Patch("campgrounds/:campgroundId/kiosk/devices/:deviceId")
  @UseGuards(JwtAuthGuard)
  async updateDevice(
    @Param("campgroundId") campgroundId: string,
    @Param("deviceId") deviceId: string,
    @Body()
    body: {
      name?: string;
      allowWalkIns?: boolean;
      allowCheckIn?: boolean;
      allowPayments?: boolean;
    }
  ) {
    return this.kioskService.updateDevice(campgroundId, deviceId, body);
  }

  /**
   * Revoke a kiosk device (disable it)
   */
  @Post("campgrounds/:campgroundId/kiosk/devices/:deviceId/revoke")
  @UseGuards(JwtAuthGuard)
  async revokeDevice(
    @Param("campgroundId") campgroundId: string,
    @Param("deviceId") deviceId: string
  ) {
    return this.kioskService.revokeDevice(campgroundId, deviceId);
  }

  /**
   * Re-enable a revoked kiosk device
   */
  @Post("campgrounds/:campgroundId/kiosk/devices/:deviceId/enable")
  @UseGuards(JwtAuthGuard)
  async enableDevice(
    @Param("campgroundId") campgroundId: string,
    @Param("deviceId") deviceId: string
  ) {
    return this.kioskService.enableDevice(campgroundId, deviceId);
  }

  /**
   * Delete a kiosk device permanently
   */
  @Delete("campgrounds/:campgroundId/kiosk/devices/:deviceId")
  @UseGuards(JwtAuthGuard)
  async deleteDevice(
    @Param("campgroundId") campgroundId: string,
    @Param("deviceId") deviceId: string
  ) {
    return this.kioskService.deleteDevice(campgroundId, deviceId);
  }
}
