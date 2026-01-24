import { Injectable, Logger } from "@nestjs/common";
import OpenAI from "openai";

@Injectable()
export class OpenAIService {
  private readonly logger = new Logger(OpenAIService.name);
  private openai: OpenAI | null = null;

  constructor() {
    const apiKey = process.env.OPENAI_API_KEY;

    if (!apiKey) {
      this.logger.warn("OPENAI_API_KEY not set - semantic search will not work");
      return;
    }

    this.openai = new OpenAI({ apiKey });
    this.logger.log("OpenAI service initialized");
  }

  /**
   * Generate embeddings for text using text-embedding-3-small model
   * Returns a 1536-dimension vector
   */
  async generateEmbedding(text: string): Promise<number[]> {
    if (!this.openai) {
      throw new Error("OpenAI API key not configured");
    }

    if (!text || text.trim().length === 0) {
      throw new Error("Text cannot be empty");
    }

    try {
      const response = await this.openai.embeddings.create({
        model: "text-embedding-3-small",
        input: text.trim(),
        encoding_format: "float",
      });

      return response.data[0].embedding;
    } catch (error) {
      this.logger.error("Failed to generate embedding", error);
      throw error;
    }
  }

  /**
   * Generate embeddings for multiple texts in a single API call (more efficient)
   */
  async generateEmbeddings(texts: string[]): Promise<number[][]> {
    if (!this.openai) {
      throw new Error("OpenAI API key not configured");
    }

    if (!texts || texts.length === 0) {
      throw new Error("Texts array cannot be empty");
    }

    try {
      const response = await this.openai.embeddings.create({
        model: "text-embedding-3-small",
        input: texts.map((t) => t.trim()),
        encoding_format: "float",
      });

      return response.data.map((item) => item.embedding);
    } catch (error) {
      this.logger.error("Failed to generate embeddings", error);
      throw error;
    }
  }

  /**
   * Check if OpenAI is configured and ready
   */
  isConfigured(): boolean {
    return this.openai !== null;
  }
}
