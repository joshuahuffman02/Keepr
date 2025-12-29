import { BadRequestException, Body, Controller, Delete, Get, Param, Post, Put, Query, UseGuards, Logger } from "@nestjs/common";
import { JwtAuthGuard } from "../auth/guards";
import { SiteMapService } from "./site-map.service";
import { UpsertMapDto } from "./dto/upsert-map.dto";
import { CheckAssignmentDto } from "./dto/check-assignment.dto";
import { PreviewAssignmentsDto } from "./dto/preview-assignments.dto";
import { UpsertMapAssignmentsDto } from "./dto/upsert-map-assignments.dto";
import { UpsertMapShapesDto } from "./dto/upsert-map-shapes.dto";
import { UploadsService } from "../uploads/uploads.service";

const MAX_UPLOAD_BYTES = 18 * 1024 * 1024;

type MapUploadPayload = {
  url?: string;
  dataUrl?: string;
  contentType?: string;
  filename?: string;
};

const parseDataUrl = (dataUrl: string) => {
  const match = /^data:([^;]+);base64,(.+)$/i.exec(dataUrl);
  if (!match) return null;
  return {
    contentType: match[1],
    buffer: Buffer.from(match[2], "base64")
  };
};

@UseGuards(JwtAuthGuard)
@Controller()
export class SiteMapController {
  private readonly logger = new Logger(SiteMapController.name);

  constructor(
    private readonly siteMap: SiteMapService,
    private readonly uploads: UploadsService
  ) { }

  @Get("campgrounds/:campgroundId/map")
  getMap(
    @Param("campgroundId") campgroundId: string,
    @Query("startDate") startDate?: string,
    @Query("endDate") endDate?: string
  ) {
    return this.siteMap.getMap(campgroundId, startDate, endDate);
  }

  @Put("campgrounds/:campgroundId/map")
  upsertMap(@Param("campgroundId") campgroundId: string, @Body() body: UpsertMapDto) {
    return this.siteMap.upsertMap(campgroundId, body);
  }

  @Put("campgrounds/:campgroundId/map/shapes")
  upsertShapes(@Param("campgroundId") campgroundId: string, @Body() body: UpsertMapShapesDto) {
    return this.siteMap.upsertShapes(campgroundId, body);
  }

  @Delete("campgrounds/:campgroundId/map/shapes/:shapeId")
  deleteShape(@Param("campgroundId") campgroundId: string, @Param("shapeId") shapeId: string) {
    return this.siteMap.deleteShape(campgroundId, shapeId);
  }

  @Put("campgrounds/:campgroundId/map/assignments")
  upsertAssignments(@Param("campgroundId") campgroundId: string, @Body() body: UpsertMapAssignmentsDto) {
    return this.siteMap.upsertAssignments(campgroundId, body);
  }

  @Delete("campgrounds/:campgroundId/map/assignments/:siteId")
  unassignSite(@Param("campgroundId") campgroundId: string, @Param("siteId") siteId: string) {
    return this.siteMap.unassignSite(campgroundId, siteId);
  }

  @Post("campgrounds/:campgroundId/map")
  async uploadMap(
    @Param("campgroundId") campgroundId: string,
    @Body() body: MapUploadPayload
  ) {
    if (body?.url) {
      return this.siteMap.setBaseImage(campgroundId, body.url);
    }

    if (!body?.dataUrl) {
      throw new BadRequestException("url or dataUrl is required");
    }

    const parsed = parseDataUrl(body.dataUrl);
    if (!parsed) {
      throw new BadRequestException("dataUrl must be base64 encoded");
    }

    const contentType = body.contentType || parsed.contentType || "application/octet-stream";
    const buffer = parsed.buffer;

    if (!buffer.length) {
      throw new BadRequestException("dataUrl is empty");
    }

    if (buffer.length > MAX_UPLOAD_BYTES) {
      throw new BadRequestException("File too large. Max 18MB.");
    }

    const extension = body.filename?.includes(".") ? body.filename.split(".").pop() : undefined;
    try {
      const uploaded = await this.uploads.uploadBuffer(buffer, {
        contentType,
        extension,
        prefix: "campground-maps"
      });

      return this.siteMap.setBaseImage(campgroundId, uploaded.url);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Upload failed";
      if (process.env.UPLOADS_DATA_URL_FALLBACK !== "false") {
        this.logger.warn(`Upload failed, storing data URL instead: ${message}`);
        return this.siteMap.setBaseImage(campgroundId, body.dataUrl);
      }
      throw err;
    }
  }

  @Post("campgrounds/:campgroundId/assignments/check")
  check(@Param("campgroundId") campgroundId: string, @Body() body: CheckAssignmentDto) {
    return this.siteMap.checkAssignment(campgroundId, body);
  }

  @Post("campgrounds/:campgroundId/assignments/preview")
  preview(@Param("campgroundId") campgroundId: string, @Body() body: PreviewAssignmentsDto) {
    return this.siteMap.previewAssignments(campgroundId, body);
  }
}
