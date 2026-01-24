import { Controller, Get, Post, Patch, Param, Body, UseGuards } from "@nestjs/common";
import { SetupServicesService } from "./setup-services.service";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { PurchaseSetupServiceDto } from "./dto/purchase-setup-service.dto";

type SetupServiceStatus = "pending" | "in_progress" | "completed" | "cancelled";

@Controller()
export class SetupServicesController {
  constructor(private setupServicesService: SetupServicesService) {}

  /**
   * Get pricing info (public)
   */
  @Get("setup-services/pricing")
  getPricing() {
    return this.setupServicesService.getPricing();
  }

  /**
   * Get setup services for an organization
   */
  @Get("organizations/:organizationId/setup-services")
  @UseGuards(JwtAuthGuard)
  async getForOrganization(@Param("organizationId") organizationId: string) {
    return this.setupServicesService.getForOrganization(organizationId);
  }

  /**
   * Get a single setup service
   */
  @Get("organizations/:organizationId/setup-services/:serviceId")
  @UseGuards(JwtAuthGuard)
  async getById(@Param("serviceId") serviceId: string) {
    return this.setupServicesService.getById(serviceId);
  }

  /**
   * Purchase a setup service
   */
  @Post("organizations/:organizationId/setup-services")
  @UseGuards(JwtAuthGuard)
  async purchase(
    @Param("organizationId") organizationId: string,
    @Body() dto: PurchaseSetupServiceDto,
  ) {
    return this.setupServicesService.purchase({
      organizationId,
      serviceType: dto.serviceType,
      payUpfront: dto.payUpfront,
      reservationCount: dto.reservationCount,
      importNotes: dto.importNotes,
      stripePaymentIntentId: dto.stripePaymentIntentId,
    });
  }

  /**
   * Calculate surcharge for a potential booking (preview)
   */
  @Get("organizations/:organizationId/setup-services/surcharge")
  @UseGuards(JwtAuthGuard)
  async calculateSurcharge(@Param("organizationId") organizationId: string) {
    const surcharge = await this.setupServicesService.calculateBookingSurcharge(organizationId);
    return {
      hasSurcharge: surcharge > 0,
      surchargeAmountCents: surcharge,
    };
  }

  /**
   * Update service status (admin)
   */
  @Patch("organizations/:organizationId/setup-services/:serviceId/status")
  @UseGuards(JwtAuthGuard)
  async updateStatus(
    @Param("serviceId") serviceId: string,
    @Body() body: { status: SetupServiceStatus; completedBy?: string },
  ) {
    return this.setupServicesService.updateStatus(serviceId, body.status, body.completedBy);
  }

  /**
   * Add notes to a service (admin)
   */
  @Patch("organizations/:organizationId/setup-services/:serviceId/notes")
  @UseGuards(JwtAuthGuard)
  async addNotes(@Param("serviceId") serviceId: string, @Body() body: { notes: string }) {
    return this.setupServicesService.addNotes(serviceId, body.notes);
  }

  /**
   * Set import file URL
   */
  @Patch("organizations/:organizationId/setup-services/:serviceId/import-file")
  @UseGuards(JwtAuthGuard)
  async setImportFile(@Param("serviceId") serviceId: string, @Body() body: { fileUrl: string }) {
    return this.setupServicesService.setImportFile(serviceId, body.fileUrl);
  }
}
