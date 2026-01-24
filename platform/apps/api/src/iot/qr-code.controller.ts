import { Controller, Get, Post, Delete, Body, Param, Query, UseGuards, Res } from "@nestjs/common";
import { Response } from "express";
import { QRCodeService, QRCodeType } from "./qr-code.service";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { ApiTags, ApiOperation } from "@nestjs/swagger";

// ============================================================================
// Admin QR Code Management (requires auth)
// ============================================================================
@ApiTags("QR Codes")
@Controller("qr-codes")
@UseGuards(JwtAuthGuard)
export class QRCodeController {
  constructor(private readonly qrCodeService: QRCodeService) {}

  @Post("checkin/:reservationId")
  @ApiOperation({ summary: "Generate check-in QR code for a reservation" })
  async generateCheckinCode(@Param("reservationId") reservationId: string) {
    return this.qrCodeService.generateCheckinCode(reservationId);
  }

  @Post("site/:siteId")
  @ApiOperation({ summary: "Generate permanent QR code for a site" })
  async generateSiteCode(@Param("siteId") siteId: string) {
    return this.qrCodeService.generateSiteCode(siteId);
  }

  @Post("wifi")
  @ApiOperation({ summary: "Generate WiFi QR code" })
  async generateWifiCode(@Body() body: { campgroundId: string; ssid: string; password: string }) {
    return this.qrCodeService.generateWifiCode(body.campgroundId, body.ssid, body.password);
  }

  @Post("store")
  @ApiOperation({ summary: "Generate store/ordering QR code" })
  async generateStoreCode(@Body() body: { campgroundId: string; tableNumber?: string }) {
    return this.qrCodeService.generateStoreCode(body.campgroundId, body.tableNumber);
  }

  @Post("bulk/sites/:campgroundId")
  @ApiOperation({ summary: "Generate QR codes for all sites in a campground" })
  async generateAllSiteCodes(@Param("campgroundId") campgroundId: string) {
    return this.qrCodeService.generateAllSiteCodes(campgroundId);
  }

  @Get()
  @ApiOperation({ summary: "List QR codes for a campground" })
  async listCodes(@Query("campgroundId") campgroundId: string, @Query("type") type?: QRCodeType) {
    return this.qrCodeService.listCodes(campgroundId, type);
  }

  @Delete(":code")
  @ApiOperation({ summary: "Delete a QR code" })
  async deleteCode(@Param("code") code: string) {
    return this.qrCodeService.deleteCode(code);
  }
}

// ============================================================================
// Public QR Code Validation (no auth required - for scanning)
// ============================================================================
@ApiTags("QR Codes Public")
@Controller("qr")
export class QRCodePublicController {
  constructor(private readonly qrCodeService: QRCodeService) {}

  @Get("validate/:code")
  @ApiOperation({ summary: "Validate and resolve a QR code" })
  async validateCode(@Param("code") code: string) {
    return this.qrCodeService.validateCode(code);
  }

  @Post("use/:code")
  @ApiOperation({ summary: "Mark a QR code as used" })
  async markAsUsed(@Param("code") code: string) {
    await this.qrCodeService.markAsUsed(code);
    return { success: true };
  }

  // Redirect endpoint for scanning QR codes
  @Get("checkin/:code")
  @ApiOperation({ summary: "Redirect to check-in page after scanning QR" })
  async checkinRedirect(@Param("code") code: string, @Res() res: Response) {
    const result = await this.qrCodeService.validateCode(code);

    if (!result.valid) {
      return res.redirect(`/checkin/error?reason=${result.error}`);
    }

    if (result.type !== "checkin") {
      return res.redirect(`/checkin/error?reason=invalid_code_type`);
    }

    // Redirect to the check-in page with the reservation ID
    return res.redirect(`/portal/checkin?reservation=${result.reservationId}`);
  }

  @Get("site/:code")
  @ApiOperation({ summary: "Redirect to site info page after scanning QR" })
  async siteRedirect(@Param("code") code: string, @Res() res: Response) {
    const result = await this.qrCodeService.validateCode(code);

    if (!result.valid) {
      return res.redirect(`/error?reason=${result.error}`);
    }

    // Redirect to the site info/portal page
    return res.redirect(`/portal/site/${result.siteId}`);
  }
}
