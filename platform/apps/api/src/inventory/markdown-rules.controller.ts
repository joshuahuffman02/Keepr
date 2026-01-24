import type { Request } from "express";
import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Req,
  UnauthorizedException,
} from "@nestjs/common";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { ScopeGuard } from "../auth/guards/scope.guard";
import { MarkdownRulesService } from "./markdown-rules.service";
import { CreateMarkdownRuleDto, UpdateMarkdownRuleDto } from "./dto/markdown.dto";

@Controller("campgrounds/:campgroundId/inventory/markdown-rules")
@UseGuards(JwtAuthGuard, ScopeGuard)
export class MarkdownRulesController {
  constructor(private readonly markdownService: MarkdownRulesService) {}

  @Post()
  async createRule(
    @Param("campgroundId") campgroundId: string,
    @Body() dto: CreateMarkdownRuleDto,
    @Req() req: Request,
  ) {
    const userId = req.user?.id;
    if (!userId) {
      throw new UnauthorizedException();
    }
    return this.markdownService.createRule(campgroundId, dto, userId);
  }

  @Get()
  async listRules(
    @Param("campgroundId") campgroundId: string,
    @Query("includeInactive") includeInactive?: string,
  ) {
    return this.markdownService.listRules(campgroundId, includeInactive === "true");
  }

  @Get("preview")
  async getMarkdownPreview(@Param("campgroundId") campgroundId: string) {
    return this.markdownService.getMarkdownPreview(campgroundId);
  }

  @Get("calculate")
  async calculateMarkdown(
    @Param("campgroundId") campgroundId: string,
    @Query("productId") productId: string,
    @Query("batchId") batchId: string,
    @Query("basePriceCents") basePriceCents: string,
  ) {
    return this.markdownService.calculateMarkdown(
      campgroundId,
      productId,
      batchId,
      parseInt(basePriceCents, 10),
    );
  }

  @Get(":id")
  async getRule(@Param("campgroundId") campgroundId: string, @Param("id") id: string) {
    return this.markdownService.getRule(id, campgroundId);
  }

  @Put(":id")
  async updateRule(
    @Param("campgroundId") campgroundId: string,
    @Param("id") id: string,
    @Body() dto: UpdateMarkdownRuleDto,
  ) {
    return this.markdownService.updateRule(id, campgroundId, dto);
  }

  @Delete(":id")
  async deleteRule(@Param("campgroundId") campgroundId: string, @Param("id") id: string) {
    return this.markdownService.deleteRule(id, campgroundId);
  }
}
