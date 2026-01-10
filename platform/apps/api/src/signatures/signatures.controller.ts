import { Body, Controller, Get, HttpCode, Param, Post, Query, Req, UseGuards } from "@nestjs/common";
import { Roles, RolesGuard } from "../auth/guards/roles.guard";
import { JwtAuthGuard } from "../auth/guards";
import { ScopeGuard } from "../permissions/scope.guard";
import { RequireScope } from "../permissions/scope.decorator";
import { UserRole } from "@prisma/client";
import { SignaturesService } from "./signatures.service";
import { CreateSignatureRequestDto } from "./dto/create-signature-request.dto";
import { SignatureWebhookDto } from "./dto/signature-webhook.dto";
import { CoiUploadDto } from "./dto/coi-upload.dto";
import { MarkPaperSignedDto } from "./dto/mark-paper-signed.dto";
import { WaiveSignatureDto } from "./dto/waive-signature.dto";
import { SendRenewalCampaignDto } from "./dto/send-renewal-campaign.dto";

@Controller("signatures")
export class SignaturesController {
  constructor(private readonly signatures: SignaturesService) { }

  @UseGuards(JwtAuthGuard, RolesGuard, ScopeGuard)
  @Roles(UserRole.owner, UserRole.manager, UserRole.front_desk, UserRole.finance)
  @RequireScope({ resource: "reservations", action: "write" })
  @Post("requests")
  async create(@Req() req: Request, @Body() dto: CreateSignatureRequestDto) {
    return this.signatures.createAndSend(dto, req?.user?.id ?? null);
  }

  @UseGuards(JwtAuthGuard, RolesGuard, ScopeGuard)
  @Roles(UserRole.owner, UserRole.manager, UserRole.front_desk, UserRole.finance)
  @RequireScope({ resource: "reservations", action: "write" })
  @Post("requests/:id/resend")
  async resend(@Req() req: Request, @Param("id") id: string) {
    return this.signatures.resend(id, req?.user?.id ?? null);
  }

  @UseGuards(JwtAuthGuard, RolesGuard, ScopeGuard)
  @Roles(UserRole.owner, UserRole.manager, UserRole.front_desk, UserRole.finance)
  @RequireScope({ resource: "reservations", action: "write" })
  @Post("requests/:id/void")
  async voidRequest(@Req() req: Request, @Param("id") id: string) {
    return this.signatures.voidRequest(id, req?.user?.id ?? null);
  }

  // ==================== PAPER SIGNING ====================

  @UseGuards(JwtAuthGuard, RolesGuard, ScopeGuard)
  @Roles(UserRole.owner, UserRole.manager, UserRole.front_desk)
  @RequireScope({ resource: "reservations", action: "write" })
  @Post("requests/:id/paper-signed")
  async markPaperSigned(@Req() req: Request, @Param("id") id: string, @Body() dto: Omit<MarkPaperSignedDto, "id">) {
    return this.signatures.markPaperSigned({ ...dto, id }, req.user.id);
  }

  // ==================== SIGNATURE WAIVER ====================

  @UseGuards(JwtAuthGuard, RolesGuard, ScopeGuard)
  @Roles(UserRole.owner, UserRole.manager)
  @RequireScope({ resource: "reservations", action: "write" })
  @Post("requests/:id/waive")
  async waiveSignature(@Req() req: Request, @Param("id") id: string, @Body() dto: Omit<WaiveSignatureDto, "id">) {
    return this.signatures.waiveSignature({ ...dto, id }, req.user.id);
  }

  // ==================== PDF DOWNLOAD ====================

  @UseGuards(JwtAuthGuard, RolesGuard, ScopeGuard)
  @Roles(UserRole.owner, UserRole.manager, UserRole.front_desk, UserRole.finance, UserRole.readonly)
  @RequireScope({ resource: "reservations", action: "read" })
  @Get("requests/:id/pdf")
  async getContractPdf(@Param("id") id: string) {
    return this.signatures.getContractPdfUrl(id);
  }

  @UseGuards(JwtAuthGuard, RolesGuard, ScopeGuard)
  @Roles(UserRole.owner, UserRole.manager, UserRole.front_desk, UserRole.finance, UserRole.readonly)
  @RequireScope({ resource: "reservations", action: "read" })
  @Get("requests/:id")
  async getRequest(@Param("id") id: string) {
    return this.signatures.getById(id);
  }

  @Get("requests/token/:token")
  async getRequestByToken(@Param("token") token: string) {
    return this.signatures.getByToken(token);
  }

  @UseGuards(JwtAuthGuard, RolesGuard, ScopeGuard)
  @Roles(UserRole.owner, UserRole.manager, UserRole.front_desk, UserRole.finance, UserRole.readonly)
  @RequireScope({ resource: "reservations", action: "read" })
  @Get("reservations/:reservationId/requests")
  async listForReservation(@Param("reservationId") reservationId: string) {
    return this.signatures.listByReservation(reservationId);
  }

  // ==================== CONTRACTS (Seasonal/Long-term) ====================

  @UseGuards(JwtAuthGuard, RolesGuard, ScopeGuard)
  @Roles(UserRole.owner, UserRole.manager, UserRole.front_desk, UserRole.finance, UserRole.readonly)
  @RequireScope({ resource: "reservations", action: "read" })
  @Get("contracts")
  async listContracts(
    @Query("campgroundId") campgroundId: string,
    @Query("seasonYear") seasonYear?: string,
    @Query("documentType") documentType?: string,
    @Query("status") status?: string,
    @Query("guestId") guestId?: string,
    @Query("limit") limit?: string,
    @Query("offset") offset?: string
  ) {
    return this.signatures.listContracts(campgroundId, {
      seasonYear: seasonYear ? parseInt(seasonYear, 10) : undefined,
      documentType,
      status: status?.includes(",") ? status.split(",") : status,
      guestId,
      limit: limit ? parseInt(limit, 10) : undefined,
      offset: offset ? parseInt(offset, 10) : undefined
    });
  }

  @UseGuards(JwtAuthGuard, RolesGuard, ScopeGuard)
  @Roles(UserRole.owner, UserRole.manager, UserRole.front_desk, UserRole.finance, UserRole.readonly)
  @RequireScope({ resource: "reservations", action: "read" })
  @Get("contracts/stats")
  async getContractStats(
    @Query("campgroundId") campgroundId: string,
    @Query("seasonYear") seasonYear?: string,
    @Query("documentType") documentType?: string
  ) {
    return this.signatures.getContractStats(
      campgroundId,
      seasonYear ? parseInt(seasonYear, 10) : undefined,
      documentType
    );
  }

  // ==================== RENEWAL CAMPAIGNS ====================

  @UseGuards(JwtAuthGuard, RolesGuard, ScopeGuard)
  @Roles(UserRole.owner, UserRole.manager)
  @RequireScope({ resource: "reservations", action: "write" })
  @Post("contracts/renewal-campaign")
  async sendRenewalCampaign(@Req() req: Request, @Body() dto: SendRenewalCampaignDto) {
    return this.signatures.sendRenewalCampaign(dto, req.user.id);
  }

  @HttpCode(200)
  @Post("webhooks/internal")
  async handleWebhook(@Body() dto: SignatureWebhookDto) {
    return this.signatures.handleWebhook(dto);
  }

  @UseGuards(JwtAuthGuard, RolesGuard, ScopeGuard)
  @Roles(UserRole.owner, UserRole.manager, UserRole.front_desk, UserRole.finance)
  @RequireScope({ resource: "reservations", action: "write" })
  @Post("coi")
  async uploadCoi(@Req() req: Request, @Body() dto: CoiUploadDto) {
    return this.signatures.createCoi(dto, req?.user?.id ?? null);
  }
}
