import { Body, Controller, Get, HttpCode, Param, Post, Req, UseGuards } from "@nestjs/common";
import { Roles, RolesGuard } from "../auth/guards/roles.guard";
import { JwtAuthGuard } from "../auth/guards";
import { ScopeGuard } from "../permissions/scope.guard";
import { RequireScope } from "../permissions/scope.decorator";
import { UserRole } from "@prisma/client";
import { SignaturesService } from "./signatures.service";
import { CreateSignatureRequestDto } from "./dto/create-signature-request.dto";
import { SignatureWebhookDto } from "./dto/signature-webhook.dto";
import { CoiUploadDto } from "./dto/coi-upload.dto";

@Controller("signatures")
export class SignaturesController {
  constructor(private readonly signatures: SignaturesService) { }

  @UseGuards(JwtAuthGuard, RolesGuard, ScopeGuard)
  @Roles(UserRole.owner, UserRole.manager, UserRole.front_desk, UserRole.finance)
  @RequireScope({ resource: "reservations", action: "write" })
  @Post("requests")
  async create(@Req() req: any, @Body() dto: CreateSignatureRequestDto) {
    return this.signatures.createAndSend(dto, req?.user?.id ?? null);
  }

  @UseGuards(JwtAuthGuard, RolesGuard, ScopeGuard)
  @Roles(UserRole.owner, UserRole.manager, UserRole.front_desk, UserRole.finance)
  @RequireScope({ resource: "reservations", action: "write" })
  @Post("requests/:id/resend")
  async resend(@Req() req: any, @Param("id") id: string) {
    return this.signatures.resend(id, req?.user?.id ?? null);
  }

  @UseGuards(JwtAuthGuard, RolesGuard, ScopeGuard)
  @Roles(UserRole.owner, UserRole.manager, UserRole.front_desk, UserRole.finance)
  @RequireScope({ resource: "reservations", action: "write" })
  @Post("requests/:id/void")
  async voidRequest(@Req() req: any, @Param("id") id: string) {
    return this.signatures.voidRequest(id, req?.user?.id ?? null);
  }

  @UseGuards(JwtAuthGuard, RolesGuard, ScopeGuard)
  @Roles(UserRole.owner, UserRole.manager, UserRole.front_desk, UserRole.finance, UserRole.readonly)
  @RequireScope({ resource: "reservations", action: "read" })
  @Get("requests/:id")
  async getRequest(@Param("id") id: string) {
    return this.signatures.getById(id);
  }

  @UseGuards(JwtAuthGuard, RolesGuard, ScopeGuard)
  @Roles(UserRole.owner, UserRole.manager, UserRole.front_desk, UserRole.finance, UserRole.readonly)
  @RequireScope({ resource: "reservations", action: "read" })
  @Get("reservations/:reservationId/requests")
  async listForReservation(@Param("reservationId") reservationId: string) {
    return this.signatures.listByReservation(reservationId);
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
  async uploadCoi(@Req() req: any, @Body() dto: CoiUploadDto) {
    return this.signatures.createCoi(dto, req?.user?.id ?? null);
  }
}
