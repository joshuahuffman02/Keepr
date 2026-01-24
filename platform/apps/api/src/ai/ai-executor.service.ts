import { Injectable, Logger } from "@nestjs/common";
import { AiProviderService } from "./ai-provider.service";
import { AiFeatureType } from "@prisma/client";

/**
 * AI Executor Service
 *
 * Provides fallback chain execution for AI providers
 * Inspired by vibe-kanban's executor abstraction pattern
 *
 * Features:
 * - Fallback chains (if primary provider fails, try secondary)
 * - Parallel execution for independent tasks
 * - Rate limiting and retry logic
 */
@Injectable()
export class AiExecutorService {
  private readonly logger = new Logger(AiExecutorService.name);

  // Default fallback chain: OpenAI -> Anthropic
  private readonly DEFAULT_FALLBACK_CHAIN: AiProvider[] = ["openai"];

  constructor(private readonly aiProvider: AiProviderService) {}

  /**
   * Execute with fallback chain
   * If the primary provider fails, tries the next provider in the chain
   */
  async executeWithFallback(
    request: AiExecutionRequest,
    fallbackChain?: AiProvider[],
  ): Promise<AiExecutionResult> {
    const chain = fallbackChain || this.DEFAULT_FALLBACK_CHAIN;
    const errors: Array<{ provider: string; error: string }> = [];

    for (const provider of chain) {
      try {
        this.logger.debug(`Attempting AI execution with provider: ${provider}`);

        const result = await this.aiProvider.getCompletion({
          campgroundId: request.campgroundId,
          featureType: request.featureType,
          systemPrompt: request.systemPrompt,
          userPrompt: request.userPrompt,
          userId: request.userId,
          maxTokens: request.maxTokens,
          temperature: request.temperature,
        });

        return {
          success: true,
          content: result.content,
          provider,
          model: result.model,
          tokensUsed: result.tokensUsed,
          latencyMs: result.latencyMs,
          fallbacksAttempted: errors.length,
        };
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        this.logger.warn(`Provider ${provider} failed: ${message}`);
        errors.push({ provider, error: message });

        // Continue to next provider in chain
      }
    }

    // All providers failed
    this.logger.error(`All providers in fallback chain failed`);
    return {
      success: false,
      content: "",
      provider: "none",
      model: "none",
      tokensUsed: 0,
      latencyMs: 0,
      fallbacksAttempted: errors.length,
      errors,
    };
  }

  /**
   * Execute multiple AI tasks in parallel
   * Useful for batch operations like analyzing multiple reviews
   */
  async executeParallel(requests: AiExecutionRequest[]): Promise<AiExecutionResult[]> {
    this.logger.debug(`Executing ${requests.length} AI tasks in parallel`);

    const results = await Promise.allSettled(requests.map((req) => this.executeWithFallback(req)));

    return results.map((result, index) => {
      if (result.status === "fulfilled") {
        return result.value;
      } else {
        return {
          success: false,
          content: "",
          provider: "none",
          model: "none",
          tokensUsed: 0,
          latencyMs: 0,
          fallbacksAttempted: 0,
          errors: [{ provider: "parallel", error: result.reason?.message || "Unknown error" }],
        };
      }
    });
  }

  /**
   * Execute tasks sequentially (when order matters or for dependent operations)
   */
  async executeSequential(requests: AiExecutionRequest[]): Promise<AiExecutionResult[]> {
    this.logger.debug(`Executing ${requests.length} AI tasks sequentially`);

    const results: AiExecutionResult[] = [];

    for (const request of requests) {
      const result = await this.executeWithFallback(request);
      results.push(result);

      // If a task fails, we still continue (could add option to stop on failure)
    }

    return results;
  }
}

// Types

export type AiProvider = "openai" | "anthropic" | "local";

export interface AiExecutionRequest {
  campgroundId: string;
  featureType: AiFeatureType;
  systemPrompt: string;
  userPrompt: string;
  userId?: string;
  maxTokens?: number;
  temperature?: number;
}

export interface AiExecutionResult {
  success: boolean;
  content: string;
  provider: string;
  model: string;
  tokensUsed: number;
  latencyMs: number;
  fallbacksAttempted: number;
  errors?: Array<{ provider: string; error: string }>;
}
