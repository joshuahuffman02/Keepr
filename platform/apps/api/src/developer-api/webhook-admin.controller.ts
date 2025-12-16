import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../auth/guards";
import { WebhookService } from "./webhook.service";
import { IsArray, IsBoolean, IsNotEmpty, IsOptional, IsString } from "class-validator";

class CreateWebhookDto {
  @IsString()
  @IsNotEmpty()
  campgroundId!: string;

  @IsString()
  @IsNotEmpty()
  url!: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsArray()
  eventTypes!: string[];
}

class ToggleWebhookDto {
  @IsBoolean()
  isActive!: boolean;
}

@UseGuards(JwtAuthGuard)
@Controller("developer/webhooks")
export class WebhookAdminController {
  constructor(private readonly webhookService: WebhookService) { }

  @Get()
  list(@Query("campgroundId") campgroundId: string) {
    return this.webhookService.listEndpoints(campgroundId);
  }

  @Post()
  create(@Body() body: CreateWebhookDto) {
    return this.webhookService.createEndpoint(body);
  }

  @Patch(":id/toggle")
  toggle(@Param("id") id: string, @Body() body: ToggleWebhookDto) {
    return this.webhookService.toggleEndpoint(id, body.isActive);
  }

  @Get("deliveries")
  listDeliveries(@Query("campgroundId") campgroundId: string) {
    return this.webhookService.listDeliveries(campgroundId);
  }

  @Post("deliveries/:id/replay")
  replay(@Param("id") id: string) {
    return this.webhookService.replay(id);
  }
}
