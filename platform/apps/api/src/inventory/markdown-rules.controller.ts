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
    Request,
} from "@nestjs/common";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { MarkdownRulesService } from "./markdown-rules.service";
import { CreateMarkdownRuleDto, UpdateMarkdownRuleDto } from "./dto/markdown.dto";

@Controller("campgrounds/:campgroundId/inventory/markdown-rules")
@UseGuards(JwtAuthGuard)
export class MarkdownRulesController {
    constructor(private readonly markdownService: MarkdownRulesService) {}

    @Post()
    async createRule(
        @Param("campgroundId") campgroundId: string,
        @Body() dto: CreateMarkdownRuleDto,
        @Request() req: any
    ) {
        return this.markdownService.createRule(campgroundId, dto, req.user.id);
    }

    @Get()
    async listRules(
        @Param("campgroundId") campgroundId: string,
        @Query("includeInactive") includeInactive?: string
    ) {
        return this.markdownService.listRules(
            campgroundId,
            includeInactive === "true"
        );
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
        @Query("basePriceCents") basePriceCents: string
    ) {
        return this.markdownService.calculateMarkdown(
            campgroundId,
            productId,
            batchId,
            parseInt(basePriceCents, 10)
        );
    }

    @Get(":id")
    async getRule(@Param("id") id: string) {
        return this.markdownService.getRule(id);
    }

    @Put(":id")
    async updateRule(
        @Param("id") id: string,
        @Body() dto: UpdateMarkdownRuleDto
    ) {
        return this.markdownService.updateRule(id, dto);
    }

    @Delete(":id")
    async deleteRule(@Param("id") id: string) {
        return this.markdownService.deleteRule(id);
    }
}
