import { Body, Controller, Post, Get, Delete, Req, UseGuards, HttpCode, HttpStatus } from "@nestjs/common";
import { JwtAuthGuard } from "../auth/guards";
import { PushSubscriptionsService } from "./push-subscriptions.service";
import { MobilePushService } from "./mobile-push.service";
import { RegisterDeviceDto, UnregisterDeviceDto } from "./dto/register-device.dto";

type PushSubscriptionPayload = {
  endpoint: string;
  expirationTime?: string | number | null;
  keys?: Record<string, string>;
};

type SubscribeRequest = {
  campgroundId?: string;
  subscription?: PushSubscriptionPayload;
};

@UseGuards(JwtAuthGuard)
@Controller("push")
export class PushSubscriptionsController {
  constructor(
    private readonly pushSubscriptions: PushSubscriptionsService,
    private readonly mobilePush: MobilePushService
  ) {}

  // =========================================================================
  // Web Push (browser)
  // =========================================================================

  @Post("subscribe")
  async subscribe(@Body() body: SubscribeRequest, @Req() req: any) {
    const subscription = (body as any).subscription ?? (body as any);
    const campgroundId = (body as any).campgroundId;

    return this.pushSubscriptions.upsertSubscription({
      subscription,
      campgroundId,
      userId: req.user?.userId,
      userAgent: req.headers["user-agent"] ?? null,
    });
  }

  // =========================================================================
  // Mobile Push (iOS/Android)
  // =========================================================================

  @Post("mobile/register")
  async registerMobileDevice(@Body() dto: RegisterDeviceDto, @Req() req: any) {
    return this.mobilePush.registerDevice(req.user.id, dto);
  }

  @Post("mobile/unregister")
  @HttpCode(HttpStatus.OK)
  async unregisterMobileDevice(@Body() dto: UnregisterDeviceDto) {
    return this.mobilePush.unregisterDevice(dto.deviceToken);
  }

  @Get("mobile/devices")
  async getMobileDevices(@Req() req: any) {
    return this.mobilePush.getUserDevices(req.user.id);
  }

  @Delete("mobile/devices")
  @HttpCode(HttpStatus.OK)
  async unregisterAllMobileDevices(@Req() req: any) {
    return this.mobilePush.unregisterAllDevices(req.user.id);
  }
}

