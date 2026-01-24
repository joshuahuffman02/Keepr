import {
  Controller,
  Post,
  Body,
  Param,
  Get,
  Query,
  Logger,
  BadRequestException,
} from "@nestjs/common";
import { SemanticSearchService } from "./semantic-search.service";

@Controller("semantic-search")
export class SemanticSearchController {
  private readonly logger = new Logger(SemanticSearchController.name);

  constructor(private readonly semanticSearchService: SemanticSearchService) {}

  /**
   * Generate embedding for a single campground
   * POST /api/semantic-search/campgrounds/:id/embedding
   */
  @Post("campgrounds/:id/embedding")
  async generateCampgroundEmbedding(@Param("id") campgroundId: string) {
    this.logger.log(`Generating embedding for campground ${campgroundId}`);

    const result = await this.semanticSearchService.generateCampgroundEmbedding(campgroundId);

    return {
      success: true,
      campgroundId,
      embeddingGenerated: true,
      previewLength: result.embedding.length,
    };
  }

  /**
   * Generate embeddings for all campgrounds (batch process)
   * POST /api/semantic-search/campgrounds/embeddings/generate-all
   *
   * Query params:
   *   - limit: number of campgrounds to process (default: all)
   *   - onlyMissing: only generate for campgrounds without embeddings (default: true)
   */
  @Post("campgrounds/embeddings/generate-all")
  async generateAllEmbeddings(
    @Query("limit") limit?: string,
    @Query("onlyMissing") onlyMissing?: string,
  ) {
    const limitNum = limit ? parseInt(limit, 10) : undefined;
    const onlyMissingBool = onlyMissing !== "false"; // default true

    this.logger.log(
      `Generating embeddings for ${limitNum || "all"} campgrounds (onlyMissing: ${onlyMissingBool})`,
    );

    const result = await this.semanticSearchService.generateAllCampgroundEmbeddings({
      limit: limitNum,
      onlyMissing: onlyMissingBool,
    });

    return {
      success: true,
      ...result,
    };
  }

  /**
   * Semantic search for campgrounds
   * POST /api/semantic-search/search
   *
   * Body: { query: string, limit?: number }
   */
  @Post("search")
  async search(@Body() body: { query: string; limit?: number }) {
    const { query, limit = 10 } = body;

    if (!query || query.trim().length === 0) {
      throw new BadRequestException("Query cannot be empty");
    }

    this.logger.log(`Semantic search: "${query}" (limit: ${limit})`);

    const results = await this.semanticSearchService.searchCampgrounds(query, limit);

    return {
      query,
      results,
      count: results.length,
    };
  }

  /**
   * Get embedding stats
   * GET /api/semantic-search/stats
   */
  @Get("stats")
  async getStats() {
    const stats = await this.semanticSearchService.getEmbeddingStats();

    return {
      success: true,
      ...stats,
    };
  }
}
