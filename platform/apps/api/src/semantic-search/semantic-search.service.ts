import { Injectable, Logger, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { OpenAIService } from "../openai/openai.service";

export interface SearchResult {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  city: string | null;
  state: string | null;
  similarity: number;
}

type CampgroundTextSource = {
  name?: string | null;
  city?: string | null;
  state?: string | null;
  tagline?: string | null;
  description?: string | null;
  amenities?: string[] | null;
};

@Injectable()
export class SemanticSearchService {
  private readonly logger = new Logger(SemanticSearchService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly openai: OpenAIService,
  ) {}

  /**
   * Generate text for embedding from campground data
   */
  private buildCampgroundText(campground: CampgroundTextSource): string {
    const parts: string[] = [];

    // Name (most important)
    if (campground.name) {
      parts.push(campground.name);
    }

    // Location
    if (campground.city && campground.state) {
      parts.push(`${campground.city}, ${campground.state}`);
    } else if (campground.state) {
      parts.push(campground.state);
    }

    // Tagline
    if (campground.tagline) {
      parts.push(campground.tagline);
    }

    // Description
    if (campground.description) {
      parts.push(campground.description);
    }

    // Amenities
    if (campground.amenities && campground.amenities.length > 0) {
      parts.push(`Amenities: ${campground.amenities.join(", ")}`);
    }

    return parts.join(". ");
  }

  /**
   * Generate embedding for a single campground
   */
  async generateCampgroundEmbedding(campgroundId: string) {
    const campground = await this.prisma.campground.findUnique({
      where: { id: campgroundId },
      select: {
        id: true,
        name: true,
        city: true,
        state: true,
        tagline: true,
        description: true,
        amenities: true,
      },
    });

    if (!campground) {
      throw new NotFoundException(`Campground ${campgroundId} not found`);
    }

    // Build text representation
    const text = this.buildCampgroundText(campground);

    this.logger.debug(`Generating embedding for: ${text.substring(0, 100)}...`);

    // Generate embedding
    const embedding = await this.openai.generateEmbedding(text);

    // Store in database using raw query (Prisma doesn't support Unsupported types in data)
    // Format as pgvector literal: [1.23,4.56,7.89]
    const vectorLiteral = `[${embedding.join(",")}]`;
    await this.prisma.$executeRaw`
      UPDATE "Campground"
      SET embedding = ${vectorLiteral}::vector
      WHERE id = ${campgroundId}
    `;

    this.logger.log(`Embedding generated for campground ${campgroundId}`);

    return { campgroundId, embedding };
  }

  /**
   * Generate embeddings for all campgrounds (or subset)
   */
  async generateAllCampgroundEmbeddings(options: { limit?: number; onlyMissing?: boolean }) {
    const { limit, onlyMissing = true } = options;

    // Get campgrounds that need embeddings (use raw query since Prisma doesn't support Unsupported types in where)
    let campgrounds;

    if (onlyMissing) {
      campgrounds = limit
        ? await this.prisma.$queryRaw<
            Array<{
              id: string;
              name: string;
              city: string | null;
              state: string | null;
              tagline: string | null;
              description: string | null;
              amenities: string[];
            }>
          >`
            SELECT id, name, city, state, tagline, description, amenities
            FROM "Campground"
            WHERE embedding IS NULL
            LIMIT ${limit}
          `
        : await this.prisma.$queryRaw<
            Array<{
              id: string;
              name: string;
              city: string | null;
              state: string | null;
              tagline: string | null;
              description: string | null;
              amenities: string[];
            }>
          >`
            SELECT id, name, city, state, tagline, description, amenities
            FROM "Campground"
            WHERE embedding IS NULL
          `;
    } else {
      campgrounds = limit
        ? await this.prisma.$queryRaw<
            Array<{
              id: string;
              name: string;
              city: string | null;
              state: string | null;
              tagline: string | null;
              description: string | null;
              amenities: string[];
            }>
          >`
            SELECT id, name, city, state, tagline, description, amenities
            FROM "Campground"
            LIMIT ${limit}
          `
        : await this.prisma.$queryRaw<
            Array<{
              id: string;
              name: string;
              city: string | null;
              state: string | null;
              tagline: string | null;
              description: string | null;
              amenities: string[];
            }>
          >`
            SELECT id, name, city, state, tagline, description, amenities
            FROM "Campground"
          `;
    }

    this.logger.log(`Processing ${campgrounds.length} campgrounds for embeddings`);

    let processed = 0;
    let succeeded = 0;
    let failed = 0;

    // Process in batches of 100 (OpenAI limit is 2048)
    const batchSize = 100;
    for (let i = 0; i < campgrounds.length; i += batchSize) {
      const batch = campgrounds.slice(i, i + batchSize);

      try {
        // Build texts for batch
        const texts = batch.map((c) => this.buildCampgroundText(c));

        // Generate embeddings
        const embeddings = await this.openai.generateEmbeddings(texts);

        // Update database using raw queries (Prisma doesn't support Unsupported types in data)
        // Format each embedding as pgvector literal: [1.23,4.56,7.89]
        await Promise.all(
          batch.map((campground, idx) => {
            const vectorLiteral = `[${embeddings[idx].join(",")}]`;
            return this.prisma.$executeRaw`
              UPDATE "Campground"
              SET embedding = ${vectorLiteral}::vector
              WHERE id = ${campground.id}
            `;
          }),
        );

        succeeded += batch.length;
        this.logger.log(`Processed batch ${i / batchSize + 1}: ${batch.length} campgrounds`);
      } catch (error) {
        failed += batch.length;
        this.logger.error(`Failed to process batch ${i / batchSize + 1}`, error);
      }

      processed += batch.length;
    }

    return {
      total: campgrounds.length,
      processed,
      succeeded,
      failed,
    };
  }

  /**
   * Search campgrounds by semantic similarity
   */
  async searchCampgrounds(query: string, limit: number = 10): Promise<SearchResult[]> {
    // Generate embedding for search query
    const queryEmbedding = await this.openai.generateEmbedding(query);

    // Format as pgvector literal: [1.23,4.56,7.89]
    const vectorLiteral = `[${queryEmbedding.join(",")}]`;

    // Search using pgvector cosine similarity
    const results = await this.prisma.$queryRaw<SearchResult[]>`
      SELECT
        id,
        name,
        slug,
        description,
        city,
        state,
        1 - (embedding <=> ${vectorLiteral}::vector) as similarity
      FROM "Campground"
      WHERE embedding IS NOT NULL
      ORDER BY embedding <=> ${vectorLiteral}::vector
      LIMIT ${limit}
    `;

    this.logger.log(`Found ${results.length} results for query: "${query}"`);

    return results;
  }

  /**
   * Get stats about embeddings
   */
  async getEmbeddingStats() {
    const total = await this.prisma.campground.count();

    // Use raw query since Prisma doesn't support Unsupported types in where clauses
    const result = await this.prisma.$queryRaw<[{ count: bigint }]>`
      SELECT COUNT(*)::int as count
      FROM "Campground"
      WHERE embedding IS NOT NULL
    `;

    const withEmbeddings = Number(result[0].count);

    return {
      total,
      withEmbeddings,
      withoutEmbeddings: total - withEmbeddings,
      percentageComplete: total > 0 ? Math.round((withEmbeddings / total) * 100) : 0,
    };
  }
}
