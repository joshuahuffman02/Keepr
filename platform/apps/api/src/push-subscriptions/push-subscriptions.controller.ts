import {
  BadRequestException,
  Body,
  Controller,
  Post,
  Get,
  Delete,
  Req,
  UseGuards,
  HttpCode,
  HttpStatus,
} from "@nestjs/common";
import { JwtAuthGuard } from "../auth/guards";
import { PushSubscriptionsService } from "./push-subscriptions.service";
import { MobilePushService } from "./mobile-push.service";
import { RegisterDeviceDto, UnregisterDeviceDto } from "./dto/register-device.dto";
import type { Request } from "express";

type AuthRequest = Request & { user?: { id?: string; userId?: string } };

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const getString = (value: unknown): string | undefined =>
  typeof value === "string" ? value : undefined;

const getHeaderValue = (headers: Request["headers"], key: string): string | undefined => {
  const value = headers[key];
  if (Array.isArray(value)) return value[0];
  return typeof value === "string" ? value : undefined;
};

@UseGuards(JwtAuthGuard)
@Controller("push")
export class PushSubscriptionsController {
  constructor(
    private readonly pushSubscriptions: PushSubscriptionsService,
    private readonly mobilePush: MobilePushService,
  ) {}

  // =========================================================================
  // Web Push (browser)
  // =========================================================================

  @Post("subscribe")
  async subscribe(@Body() body: unknown, @Req() req: AuthRequest) {
    const bodyRecord = isRecord(body) ? body : undefined;
    const subscriptionCandidate =
      bodyRecord && "subscription" in bodyRecord ? bodyRecord.subscription : body;
    const campgroundId = getString(bodyRecord?.campgroundId);
    const userId = req.user?.userId ?? req.user?.id;

    return this.pushSubscriptions.upsertSubscription({
      subscription: subscriptionCandidate,
      campgroundId,
      userId: userId ?? undefined,
      userAgent: getHeaderValue(req.headers, "user-agent") ?? null,
    });
  }

  // =========================================================================
  // Mobile Push (iOS/Android)
  // =========================================================================

  @Post("mobile/register")
  async registerMobileDevice(@Body() dto: RegisterDeviceDto, @Req() req: AuthRequest) {
    const userId = req.user?.id;
    if (!userId) {
      throw new BadRequestException("User context is required");
    }
    return this.mobilePush.registerDevice(userId, dto);
  }

  @Post("mobile/unregister")
  @HttpCode(HttpStatus.OK)
  async unregisterMobileDevice(@Body() dto: UnregisterDeviceDto) {
    return this.mobilePush.unregisterDevice(dto.deviceToken);
  }

  @Get("mobile/devices")
  async getMobileDevices(@Req() req: AuthRequest) {
    const userId = req.user?.id;
    if (!userId) {
      throw new BadRequestException("User context is required");
    }
    return this.mobilePush.getUserDevices(userId);
  }

  @Delete("mobile/devices")
  @HttpCode(HttpStatus.OK)
  async unregisterAllMobileDevices(@Req() req: AuthRequest) {
    const userId = req.user?.id;
    if (!userId) {
      throw new BadRequestException("User context is required");
    }
    return this.mobilePush.unregisterAllDevices(userId);
  }
}
