import { Body, Controller, Get, Param, Put, Req, UseGuards, ForbiddenException } from "@nestjs/common";
import { UserRole } from "@prisma/client";
import { GatewayConfigService } from "./gateway-config.service";
import { UpsertPaymentGatewayConfigDto } from "./dto/payment-gateway-config.dto";
import { JwtAuthGuard } from "../auth/guards";
import { Roles, RolesGuard } from "../auth/guards/roles.guard";
import { ScopeGuard } from "../permissions/scope.guard";
import { RequireScope } from "../permissions/scope.decorator";

@Controller()
export class GatewayConfigController {
  constructor(private readonly gatewayConfig: GatewayConfigService) { }

  private ensureCampgroundMembership(user: any, campgroundId: string) {
    const memberships = user?.memberships?.map((m: any) => m.campgroundId) ?? [];
    if (!campgroundId || !memberships.includes(campgroundId)) {
      throw new ForbiddenException("Forbidden by campground scope");
    }
  }

  @UseGuards(JwtAuthGuard, RolesGuard, ScopeGuard)
  @RequireScope({ resource: "payments", action: "read" })
  @Roles(UserRole.owner, UserRole.manager, UserRole.finance)
  @Get("campgrounds/:campgroundId/payment-gateway")
  async getGatewayConfig(@Param("campgroundId") campgroundId: string, @Req() req: Request) {
    this.ensureCampgroundMembership(req?.user, campgroundId);
    return this.gatewayConfig.getConfig(campgroundId);
  }

  @UseGuards(JwtAuthGuard, RolesGuard, ScopeGuard)
  @RequireScope({ resource: "payments", action: "write" })
  @Roles(UserRole.owner, UserRole.manager, UserRole.finance)
  @Put("campgrounds/:campgroundId/payment-gateway")
  async upsertGatewayConfig(
    @Param("campgroundId") campgroundId: string,
    @Body() body: UpsertPaymentGatewayConfigDto,
    @Req() req: Request
  ) {
    this.ensureCampgroundMembership(req?.user, campgroundId);
    return this.gatewayConfig.upsertConfig(campgroundId, body, {
      userId: req?.user?.id ?? null,
      ip: req?.ip ?? null,
      userAgent: req?.headers?.["user-agent"] ?? null
    });
  }
}
