import {
  Body,
  Controller,
  Post,
  Param,
  BadRequestException,
  ForbiddenException,
  Headers,
  Req,
  UseGuards,
} from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { OptionalJwtAuthGuard } from "../auth/guards";
import {
  ReservationImportService,
  ReservationImportColumnMapping,
  ReservationImportExecuteRow,
  ParsedReservationRow,
} from "./reservation-import.service";

// ============ DTOs ============

class UploadDto {
  csvContent!: string;
}

class PreviewDto {
  csvContent!: string;
  mapping!: ReservationImportColumnMapping;
}

class ExecuteDto {
  csvContent!: string;
  mapping!: ReservationImportColumnMapping;
  rows!: ReservationImportExecuteRow[];
}

// ============ Controller ============

/**
 * Reservation Import Controller
 *
 * These endpoints are designed to work with or without JWT auth,
 * since they may be called during onboarding with just the onboarding token.
 */
@UseGuards(OptionalJwtAuthGuard)
@Controller()
export class ReservationImportController {
  constructor(
    private readonly reservationImport: ReservationImportService,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * Upload CSV and get initial parse with auto-detected column mapping
   */
  @Post("campgrounds/:campgroundId/import/reservations/upload")
  async upload(
    @Param("campgroundId") campgroundId: string,
    @Body() body: UploadDto,
    @Headers("x-onboarding-token") onboardingToken?: string,
    @Req() req?: any,
  ) {
    await this.validateCampgroundAccess(campgroundId, onboardingToken, req?.user);

    if (!body.csvContent) {
      throw new BadRequestException("CSV content is required");
    }

    return this.reservationImport.parseAndDetectColumns(
      body.csvContent,
      campgroundId
    );
  }

  /**
   * Preview import with full matching and pricing comparison
   */
  @Post("campgrounds/:campgroundId/import/reservations/preview")
  async preview(
    @Param("campgroundId") campgroundId: string,
    @Body() body: PreviewDto,
    @Headers("x-onboarding-token") onboardingToken?: string,
    @Req() req?: any,
  ) {
    await this.validateCampgroundAccess(campgroundId, onboardingToken, req?.user);

    if (!body.csvContent) {
      throw new BadRequestException("CSV content is required");
    }

    if (!body.mapping || !body.mapping.arrivalDate || !body.mapping.departureDate) {
      throw new BadRequestException("Column mapping with at least arrivalDate and departureDate is required");
    }

    return this.reservationImport.previewImport(
      campgroundId,
      body.csvContent,
      body.mapping
    );
  }

  /**
   * Execute the import with user's selections
   */
  @Post("campgrounds/:campgroundId/import/reservations/execute")
  async execute(
    @Param("campgroundId") campgroundId: string,
    @Body() body: ExecuteDto,
    @Headers("x-onboarding-token") onboardingToken?: string,
    @Req() req?: any,
  ) {
    await this.validateCampgroundAccess(campgroundId, onboardingToken, req?.user);

    if (!body.csvContent) {
      throw new BadRequestException("CSV content is required");
    }

    if (!body.mapping) {
      throw new BadRequestException("Column mapping is required");
    }

    if (!body.rows || body.rows.length === 0) {
      throw new BadRequestException("Row selections are required");
    }

    // Re-parse the CSV to get the parsed rows
    const preview = await this.reservationImport.previewImport(
      campgroundId,
      body.csvContent,
      body.mapping
    );

    return this.reservationImport.executeImport(
      campgroundId,
      preview.parsedRows,
      body.rows
    );
  }

  /**
   * Get template CSV for reservation import
   */
  @Post("campgrounds/:campgroundId/import/reservations/template")
  getTemplate() {
    const headers = [
      "first_name",
      "last_name",
      "email",
      "phone",
      "arrival_date",
      "departure_date",
      "site_number",
      "site_class",
      "adults",
      "children",
      "total_amount",
      "paid_amount",
      "confirmation_number",
      "status",
      "notes",
    ];

    const sampleRow = [
      "John",
      "Doe",
      "john@example.com",
      "555-123-4567",
      "2025-01-15",
      "2025-01-18",
      "A1",
      "Full Hookup RV",
      "2",
      "1",
      "150.00",
      "150.00",
      "RES-12345",
      "confirmed",
      "Returning guest",
    ];

    return {
      csv: `${headers.join(",")}\n${sampleRow.join(",")}`,
      headers,
    };
  }

  /**
   * Validate that the request has access to the campground
   * Either via onboarding token or JWT with campground membership
   */
  private async validateCampgroundAccess(
    campgroundId: string,
    onboardingToken?: string,
    user?: any
  ): Promise<void> {
    // If onboarding token provided, validate it matches the campground
    if (onboardingToken) {
      const session = await this.prisma.onboardingSession.findFirst({
        where: { token: onboardingToken },
        select: { campgroundId: true },
      });

      if (!session) {
        throw new BadRequestException("Invalid onboarding token");
      }

      if (session.campgroundId !== campgroundId) {
        throw new BadRequestException("Token does not match campground");
      }

      return;
    }

    // Without onboarding token, require authenticated user with campground access
    if (!user) {
      throw new ForbiddenException("Authentication required - provide JWT token or onboarding token");
    }

    // Platform admins can access any campground
    if (user.platformRole === "platform_admin" || user.platformRole === "platform_superadmin") {
      return;
    }

    // Check user has owner/manager role for this campground
    const userMemberships = user.memberships || [];
    const membership = userMemberships.find((m: any) => m.campgroundId === campgroundId);

    if (!membership) {
      throw new ForbiddenException("You do not have access to this campground");
    }

    // Only owner and manager can import data
    if (!["owner", "manager"].includes(membership.role)) {
      throw new ForbiddenException("Only owners and managers can import reservations");
    }
  }
}
