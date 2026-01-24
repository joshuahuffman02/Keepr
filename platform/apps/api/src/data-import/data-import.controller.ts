import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Res,
  UseGuards,
  BadRequestException,
} from "@nestjs/common";
import { Response } from "express";
import { JwtAuthGuard, RolesGuard, Roles } from "../auth/guards";
import { ScopeGuard } from "../permissions/scope.guard";
import { UserRole } from "@prisma/client";
import { DataImportService, ImportEntityType } from "./data-import.service";
import { FieldMapping } from "./parsers/csv-parser.service";

// DTOs
class DetectFormatDto {
  csvContent!: string;
  entityType!: ImportEntityType;
}

class PreviewImportDto {
  csvContent!: string;
  entityType!: ImportEntityType;
  fieldMappings!: FieldMapping[];
}

class ExecuteImportDto {
  csvContent!: string;
  entityType!: ImportEntityType;
  fieldMappings!: FieldMapping[];
  updateExisting?: boolean;
}

@UseGuards(JwtAuthGuard, RolesGuard, ScopeGuard)
@Controller()
export class DataImportController {
  constructor(private readonly dataImport: DataImportService) {}

  /**
   * Get import schema for an entity type
   * Returns required fields, optional fields, and descriptions
   */
  @Get("campgrounds/:campgroundId/import/schema/:entityType")
  @Roles(UserRole.owner, UserRole.manager)
  getSchema(
    @Param("campgroundId") _campgroundId: string,
    @Param("entityType") entityType: ImportEntityType,
  ) {
    this.validateEntityType(entityType);
    return this.dataImport.getImportSchema(entityType);
  }

  /**
   * Download CSV template for an entity type
   */
  @Get("campgrounds/:campgroundId/import/template/:entityType")
  @Roles(UserRole.owner, UserRole.manager)
  getTemplate(
    @Param("campgroundId") _campgroundId: string,
    @Param("entityType") entityType: ImportEntityType,
    @Res() res: Response,
  ) {
    this.validateEntityType(entityType);

    const csv = this.dataImport.getTemplate(entityType);
    const filename = `${entityType}-import-template.csv`;

    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.send(csv);
  }

  /**
   * Detect format of uploaded CSV
   * Returns detected format (csv, campspot, newbook) and suggested field mappings
   */
  @Post("campgrounds/:campgroundId/import/detect")
  @Roles(UserRole.owner, UserRole.manager)
  detectFormat(@Param("campgroundId") _campgroundId: string, @Body() body: DetectFormatDto) {
    this.validateEntityType(body.entityType);

    if (!body.csvContent) {
      throw new BadRequestException("CSV content is required");
    }

    return this.dataImport.detectFormat(body.csvContent, body.entityType);
  }

  /**
   * Preview import without committing
   * Returns validation results and preview of what will be created/updated
   */
  @Post("campgrounds/:campgroundId/import/preview")
  @Roles(UserRole.owner, UserRole.manager)
  previewImport(@Param("campgroundId") campgroundId: string, @Body() body: PreviewImportDto) {
    this.validateEntityType(body.entityType);

    if (!body.csvContent) {
      throw new BadRequestException("CSV content is required");
    }

    if (!body.fieldMappings || body.fieldMappings.length === 0) {
      throw new BadRequestException("Field mappings are required");
    }

    return this.dataImport.previewImport(
      campgroundId,
      body.entityType,
      body.csvContent,
      body.fieldMappings,
    );
  }

  /**
   * Execute import
   * Creates/updates records based on CSV content and field mappings
   */
  @Post("campgrounds/:campgroundId/import/execute")
  @Roles(UserRole.owner, UserRole.manager)
  executeImport(@Param("campgroundId") campgroundId: string, @Body() body: ExecuteImportDto) {
    this.validateEntityType(body.entityType);

    if (!body.csvContent) {
      throw new BadRequestException("CSV content is required");
    }

    if (!body.fieldMappings || body.fieldMappings.length === 0) {
      throw new BadRequestException("Field mappings are required");
    }

    return this.dataImport.executeImport(
      campgroundId,
      body.entityType,
      body.csvContent,
      body.fieldMappings,
      { updateExisting: body.updateExisting },
    );
  }

  /**
   * Get import job status
   * Note: Job access is scoped by campground membership via the guards
   */
  @Get("campgrounds/:campgroundId/import/jobs/:jobId")
  @Roles(UserRole.owner, UserRole.manager)
  getJobStatus(@Param("campgroundId") campgroundId: string, @Param("jobId") jobId: string) {
    const job = this.dataImport.getJobStatus(jobId);

    if (!job) {
      throw new BadRequestException(`Job not found: ${jobId}`);
    }

    // Verify job belongs to this campground
    if (job.campgroundId !== campgroundId) {
      throw new BadRequestException(`Job not found: ${jobId}`);
    }

    return job;
  }

  /**
   * Validate entity type parameter
   */
  private validateEntityType(entityType: string) {
    const validTypes: ImportEntityType[] = ["sites", "guests", "reservations"];
    if (!validTypes.some((type) => type === entityType)) {
      throw new BadRequestException(
        `Invalid entity type: ${entityType}. Must be one of: ${validTypes.join(", ")}`,
      );
    }
  }
}
