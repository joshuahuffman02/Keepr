import {
  BadRequestException,
  Controller,
  ForbiddenException,
  Post,
  Param,
  Body,
  Req,
  UseGuards,
} from "@nestjs/common";
import type { Request } from "express";
import { JwtAuthGuard } from "../auth/guards";
import { PrismaService } from "../prisma/prisma.service";
import { AiUiBuilderService } from "./ai-ui-builder.service";

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const getOrganizationId = (value: unknown): string | null => {
  if (!isRecord(value)) return null;
  const org = value.organizationId;
  return typeof org === "string" ? org : null;
};

const getUserId = (value: unknown): string | undefined => {
  if (!isRecord(value)) return undefined;
  const id = value.id;
  return typeof id === "string" ? id : undefined;
};

@Controller("ai/campgrounds/:campgroundId/ui-builder")
export class AiUiBuilderController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly uiBuilder: AiUiBuilderService,
  ) {}

  @UseGuards(JwtAuthGuard)
  @Post()
  async generateTree(
    @Param("campgroundId") campgroundId: string,
    @Body() body: unknown,
    @Req() req: Request,
  ) {
    if (!campgroundId) {
      throw new BadRequestException("Campground is required");
    }

    const org = getOrganizationId(req.user);
    const userId = getUserId(req.user);

    const campground = await this.prisma.campground.findUnique({
      where: { id: campgroundId },
      select: { organizationId: true },
    });

    if (!campground) {
      throw new ForbiddenException("Campground not found");
    }

    if (org && campground.organizationId !== org) {
      throw new ForbiddenException("Access denied");
    }

    const parsed = this.uiBuilder.parseRequest(body);

    return this.uiBuilder.generateTree(campgroundId, parsed.builder, parsed.prompt, userId);
  }
}
