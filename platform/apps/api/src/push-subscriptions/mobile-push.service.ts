import { BadRequestException, Injectable, Logger } from "@nestjs/common";
import { randomUUID } from "crypto";
import { ConfigService } from "@nestjs/config";
import { PrismaService } from "../prisma/prisma.service";
import { RegisterDeviceDto } from "./dto/register-device.dto";

export enum MobilePushNotificationType {
  // Reservation notifications
  RESERVATION_CONFIRMED = "reservation_confirmed",
  RESERVATION_CANCELLED = "reservation_cancelled",
  RESERVATION_MODIFIED = "reservation_modified",
  CHECK_IN_READY = "check_in_ready",
  CHECK_IN_REMINDER = "check_in_reminder",
  CHECK_OUT_REMINDER = "check_out_reminder",
  PAYMENT_RECEIVED = "payment_received",
  PAYMENT_DUE = "payment_due",

  // Messaging
  NEW_MESSAGE = "new_message",

  // Staff notifications
  NEW_BOOKING = "new_booking",
  GUEST_CHECKED_IN = "guest_checked_in",
  TASK_ASSIGNED = "task_assigned",
  SHIFT_REMINDER = "shift_reminder",

  // General
  ANNOUNCEMENT = "announcement",
}

export interface MobilePushPayload {
  type: MobilePushNotificationType;
  title: string;
  body: string;
  data?: Record<string, string>;
  badge?: number;
  sound?: string;
}

@Injectable()
export class MobilePushService {
  private readonly logger = new Logger(MobilePushService.name);
  private readonly apnsEnabled: boolean;
  private readonly fcmEnabled: boolean;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {
    // Check if APNs is configured
    this.apnsEnabled = !!this.config.get<string>("APNS_KEY_ID");
    this.fcmEnabled = !!this.config.get<string>("FCM_SERVER_KEY");

    if (!this.apnsEnabled) {
      this.logger.warn("APNs not configured - iOS push notifications disabled");
    }
    if (!this.fcmEnabled) {
      this.logger.warn("FCM not configured - Android push notifications disabled");
    }
  }

  /**
   * Register a mobile device token
   */
  async registerDevice(userId: string, dto: RegisterDeviceDto) {
    // Upsert device token (update if exists, create if not)
    const result = await this.prisma.mobileDeviceToken.upsert({
      where: { deviceToken: dto.deviceToken },
      update: {
        userId,
        campgroundId: dto.campgroundId || null,
        platform: dto.platform,
        deviceId: dto.deviceId || null,
        appBundle: dto.appBundle || null,
        appVersion: dto.appVersion || null,
        environment: dto.environment || "production",
        isActive: true,
        lastUsedAt: new Date(),
      },
      create: {
        id: randomUUID(),
        userId,
        deviceToken: dto.deviceToken,
        platform: dto.platform,
        campgroundId: dto.campgroundId || null,
        deviceId: dto.deviceId || null,
        appBundle: dto.appBundle || null,
        appVersion: dto.appVersion || null,
        environment: dto.environment || "production",
        isActive: true,
        updatedAt: new Date(),
      },
    });

    this.logger.log(`Registered ${dto.platform} device for user ${userId}`);
    return { success: true, id: result.id };
  }

  /**
   * Unregister a device token (e.g., on logout)
   */
  async unregisterDevice(deviceToken: string) {
    await this.prisma.mobileDeviceToken.updateMany({
      where: { deviceToken },
      data: { isActive: false },
    });

    this.logger.log(`Unregistered device token`);
    return { success: true };
  }

  /**
   * Unregister all devices for a user (e.g., on account deletion)
   */
  async unregisterAllDevices(userId: string) {
    const result = await this.prisma.mobileDeviceToken.updateMany({
      where: { userId },
      data: { isActive: false },
    });

    this.logger.log(`Unregistered ${result.count} devices for user ${userId}`);
    return { count: result.count };
  }

  /**
   * Get active devices for a user
   */
  async getUserDevices(userId: string) {
    return this.prisma.mobileDeviceToken.findMany({
      where: {
        userId,
        isActive: true,
      },
      select: {
        id: true,
        platform: true,
        deviceId: true,
        appBundle: true,
        appVersion: true,
        lastUsedAt: true,
        createdAt: true,
      },
      orderBy: { lastUsedAt: "desc" },
    });
  }

  /**
   * Send push notification to a user's devices
   */
  async sendToUser(userId: string, payload: MobilePushPayload) {
    const devices = await this.prisma.mobileDeviceToken.findMany({
      where: {
        userId,
        isActive: true,
      },
    });

    if (devices.length === 0) {
      this.logger.debug(`No active devices for user ${userId}`);
      return { sent: 0, failed: 0 };
    }

    let sent = 0;
    let failed = 0;

    for (const device of devices) {
      try {
        await this.sendToDevice(device.deviceToken, device.platform, payload, device.environment);
        sent++;
      } catch (error) {
        this.logger.error(`Failed to send push to ${device.platform} device: ${error}`);
        failed++;

        // Mark device as inactive if token is invalid
        if (this.isInvalidTokenError(error)) {
          await this.prisma.mobileDeviceToken.update({
            where: { id: device.id },
            data: { isActive: false },
          });
        }
      }
    }

    return { sent, failed };
  }

  /**
   * Send push notification to all users with a specific campground
   */
  async sendToCampgroundUsers(campgroundId: string, payload: MobilePushPayload) {
    const devices = await this.prisma.mobileDeviceToken.findMany({
      where: {
        campgroundId,
        isActive: true,
      },
    });

    let sent = 0;
    let failed = 0;

    for (const device of devices) {
      try {
        await this.sendToDevice(device.deviceToken, device.platform, payload, device.environment);
        sent++;
      } catch (error) {
        this.logger.error(`Failed to send push: ${error}`);
        failed++;
      }
    }

    return { sent, failed };
  }

  /**
   * Send notification to a specific device
   */
  private async sendToDevice(
    deviceToken: string,
    platform: string,
    payload: MobilePushPayload,
    environment: string,
  ) {
    if (platform === "ios") {
      return this.sendApns(deviceToken, payload, environment === "sandbox");
    } else if (platform === "android") {
      return this.sendFcm(deviceToken, payload);
    }
    throw new BadRequestException(`Unknown platform: ${platform}`);
  }

  /**
   * Send via APNs (iOS)
   * Note: Full implementation requires the 'apn' npm package and APNs credentials
   */
  private async sendApns(deviceToken: string, payload: MobilePushPayload, sandbox: boolean) {
    if (!this.apnsEnabled) {
      this.logger.debug("APNs not configured, skipping iOS push");
      return;
    }

    // TODO: Implement APNs sending
    // This requires:
    // 1. APNs auth key (.p8 file) or certificate
    // 2. Key ID, Team ID, Bundle ID
    // 3. npm package: apn or @parse/node-apn
    //
    // Example implementation:
    // const apn = require('apn');
    // const provider = new apn.Provider({
    //   token: {
    //     key: this.config.get('APNS_KEY_PATH'),
    //     keyId: this.config.get('APNS_KEY_ID'),
    //     teamId: this.config.get('APNS_TEAM_ID')
    //   },
    //   production: !sandbox
    // });
    //
    // const notification = new apn.Notification({
    //   alert: { title: payload.title, body: payload.body },
    //   topic: this.config.get('APNS_BUNDLE_ID'),
    //   payload: { type: payload.type, ...payload.data },
    //   badge: payload.badge,
    //   sound: payload.sound || 'default'
    // });
    //
    // await provider.send(notification, deviceToken);

    this.logger.debug(`Would send APNs notification to ${deviceToken.substring(0, 10)}...`);
  }

  /**
   * Send via FCM (Android)
   * Note: Full implementation requires FCM credentials
   */
  private async sendFcm(deviceToken: string, payload: MobilePushPayload) {
    if (!this.fcmEnabled) {
      this.logger.debug("FCM not configured, skipping Android push");
      return;
    }

    // TODO: Implement FCM sending
    // This requires:
    // 1. Firebase Admin SDK or FCM HTTP v1 API
    // 2. Service account key or server key
    // 3. npm package: firebase-admin
    //
    // Example implementation:
    // const admin = require('firebase-admin');
    // await admin.messaging().send({
    //   token: deviceToken,
    //   notification: {
    //     title: payload.title,
    //     body: payload.body
    //   },
    //   data: { type: payload.type, ...payload.data },
    //   android: {
    //     notification: {
    //       sound: payload.sound || 'default'
    //     }
    //   }
    // });

    this.logger.debug(`Would send FCM notification to ${deviceToken.substring(0, 10)}...`);
  }

  /**
   * Check if error indicates invalid/expired token
   */
  private isInvalidTokenError(error: unknown): boolean {
    const message = error instanceof Error ? error.message : String(error);
    return (
      message.includes("InvalidToken") ||
      message.includes("Unregistered") ||
      message.includes("NotRegistered") ||
      message.includes("BadDeviceToken")
    );
  }
}
