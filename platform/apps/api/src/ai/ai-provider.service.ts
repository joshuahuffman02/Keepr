import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AiPrivacyService } from './ai-privacy.service';
import { AiFeatureType } from '@prisma/client';

interface AiCompletionRequest {
    campgroundId: string;
    featureType: AiFeatureType;
    systemPrompt: string;
    userPrompt: string;
    userId?: string;
    sessionId?: string;
    maxTokens?: number;
    temperature?: number;
}

interface AiCompletionResponse {
    content: string;
    tokensUsed: number;
    latencyMs: number;
    provider: string;
    model: string;
}

interface AiToolCompletionRequest extends AiCompletionRequest {
    tools: any[];
    toolChoice?: any;
}

interface AiToolCompletionResponse extends AiCompletionResponse {
    toolCalls?: { id?: string; name: string; arguments: string }[];
}

@Injectable()
export class AiProviderService {
    private readonly logger = new Logger(AiProviderService.name);

    constructor(
        private readonly prisma: PrismaService,
        private readonly privacy: AiPrivacyService,
    ) { }

    /**
     * Get AI completion with automatic provider selection and logging
     */
    async getCompletion(request: AiCompletionRequest): Promise<AiCompletionResponse> {
        const startTime = Date.now();

        // Get campground AI configuration
        const campground = await this.prisma.campground.findUnique({
            where: { id: request.campgroundId },
            select: {
                aiEnabled: true,
                aiProvider: true,
                aiApiKey: true,
                aiAnonymizationLevel: true,
            },
        });

        if (!campground?.aiEnabled) {
            throw new BadRequestException('AI features are not enabled for this campground');
        }

        const provider = campground.aiProvider || 'openai';

        try {
            const response = await this.callProvider(provider, {
                systemPrompt: request.systemPrompt,
                userPrompt: request.userPrompt,
                apiKey: campground.aiApiKey || process.env.OPENAI_API_KEY,
                maxTokens: request.maxTokens || 500,
                temperature: request.temperature || 0.7,
            });

            const latencyMs = Date.now() - startTime;

            // Log the interaction (with hashed content for privacy)
            await this.logInteraction({
                campgroundId: request.campgroundId,
                featureType: request.featureType,
                promptHash: this.privacy.hashForAudit(request.userPrompt),
                responseHash: this.privacy.hashForAudit(response.content),
                tokensUsed: response.tokensUsed,
                latencyMs,
                userId: request.userId,
                sessionId: request.sessionId,
                success: true,
                provider,
                modelUsed: response.model,
                costCents: this.estimateCost(response.tokensUsed, provider, response.model),
            });

            // Update campground usage stats
            await this.prisma.campground.update({
                where: { id: request.campgroundId },
                data: {
                    aiTotalTokensUsed: { increment: response.tokensUsed },
                },
            });

            return {
                content: response.content,
                tokensUsed: response.tokensUsed,
                latencyMs,
                provider,
                model: response.model,
            };
        } catch (error) {
            const latencyMs = Date.now() - startTime;

            // Log failed interaction
            await this.logInteraction({
                campgroundId: request.campgroundId,
                featureType: request.featureType,
                promptHash: this.privacy.hashForAudit(request.userPrompt),
                responseHash: '',
                tokensUsed: 0,
                latencyMs,
                userId: request.userId,
                sessionId: request.sessionId,
                success: false,
                errorType: error instanceof Error ? error.message : 'Unknown error',
                provider,
            });

            throw error;
        }
    }

    /**
     * Get AI completion with tool calling support (OpenAI)
     */
    async getToolCompletion(request: AiToolCompletionRequest): Promise<AiToolCompletionResponse> {
        const startTime = Date.now();

        const campground = await this.prisma.campground.findUnique({
            where: { id: request.campgroundId },
            select: {
                aiEnabled: true,
                aiProvider: true,
                aiApiKey: true,
                aiAnonymizationLevel: true,
            },
        });

        if (!campground?.aiEnabled) {
            throw new BadRequestException('AI features are not enabled for this campground');
        }

        const provider = campground.aiProvider || 'openai';

        try {
            const response = await this.callToolProvider(provider, {
                systemPrompt: request.systemPrompt,
                userPrompt: request.userPrompt,
                apiKey: campground.aiApiKey || process.env.OPENAI_API_KEY,
                maxTokens: request.maxTokens || 500,
                temperature: request.temperature || 0.7,
                tools: request.tools,
                toolChoice: request.toolChoice,
            });

            const latencyMs = Date.now() - startTime;
            const responseHash = this.privacy.hashForAudit(
                `${response.content || ''}${response.toolCalls ? JSON.stringify(response.toolCalls) : ''}`
            );

            await this.logInteraction({
                campgroundId: request.campgroundId,
                featureType: request.featureType,
                promptHash: this.privacy.hashForAudit(request.userPrompt),
                responseHash,
                tokensUsed: response.tokensUsed,
                latencyMs,
                userId: request.userId,
                sessionId: request.sessionId,
                success: true,
                provider,
                modelUsed: response.model,
                costCents: this.estimateCost(response.tokensUsed, provider, response.model),
            });

            await this.prisma.campground.update({
                where: { id: request.campgroundId },
                data: {
                    aiTotalTokensUsed: { increment: response.tokensUsed },
                },
            });

            return {
                content: response.content,
                toolCalls: response.toolCalls,
                tokensUsed: response.tokensUsed,
                latencyMs,
                provider,
                model: response.model,
            };
        } catch (error) {
            const latencyMs = Date.now() - startTime;

            await this.logInteraction({
                campgroundId: request.campgroundId,
                featureType: request.featureType,
                promptHash: this.privacy.hashForAudit(request.userPrompt),
                responseHash: '',
                tokensUsed: 0,
                latencyMs,
                userId: request.userId,
                sessionId: request.sessionId,
                success: false,
                errorType: error instanceof Error ? error.message : 'Unknown error',
                provider,
            });

            throw error;
        }
    }

    private async callProvider(
        provider: string,
        options: {
            systemPrompt: string;
            userPrompt: string;
            apiKey?: string | null;
            maxTokens: number;
            temperature: number;
        },
    ): Promise<{ content: string; tokensUsed: number; model: string }> {
        switch (provider) {
            case 'openai':
                return this.callOpenAI(options);
            case 'anthropic':
                return this.callAnthropic(options);
            case 'local':
                return this.callLocal(options);
            default:
                return this.callOpenAI(options);
        }
    }

    private async callToolProvider(
        provider: string,
        options: {
            systemPrompt: string;
            userPrompt: string;
            apiKey?: string | null;
            maxTokens: number;
            temperature: number;
            tools: any[];
            toolChoice?: any;
        },
    ): Promise<{ content: string; tokensUsed: number; model: string; toolCalls?: { id?: string; name: string; arguments: string }[] }> {
        if (provider === 'openai') {
            return this.callOpenAITools(options);
        }

        const fallback = await this.callProvider(provider, {
            systemPrompt: options.systemPrompt,
            userPrompt: options.userPrompt,
            apiKey: options.apiKey,
            maxTokens: options.maxTokens,
            temperature: options.temperature,
        });

        return {
            ...fallback,
            toolCalls: undefined,
        };
    }

    private async callOpenAI(options: {
        systemPrompt: string;
        userPrompt: string;
        apiKey?: string | null;
        maxTokens: number;
        temperature: number;
    }): Promise<{ content: string; tokensUsed: number; model: string }> {
        const apiKey = options.apiKey || process.env.OPENAI_API_KEY;
        if (!apiKey) {
            throw new BadRequestException('OpenAI API key not configured');
        }

        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`,
            },
            body: JSON.stringify({
                model: 'gpt-4o-mini',
                messages: [
                    { role: 'system', content: options.systemPrompt },
                    { role: 'user', content: options.userPrompt },
                ],
                max_tokens: options.maxTokens,
                temperature: options.temperature,
            }),
        });

        if (!response.ok) {
            const error = await response.text();
            this.logger.error(`OpenAI API error: ${error}`);
            throw new BadRequestException(`OpenAI API error: ${response.status}`);
        }

        const data = await response.json() as {
            choices: { message: { content: string } }[];
            usage: { total_tokens: number };
            model: string;
        };

        return {
            content: data.choices[0]?.message?.content || '',
            tokensUsed: data.usage?.total_tokens || 0,
            model: data.model || 'gpt-4o-mini',
        };
    }

    private async callOpenAITools(options: {
        systemPrompt: string;
        userPrompt: string;
        apiKey?: string | null;
        maxTokens: number;
        temperature: number;
        tools: any[];
        toolChoice?: any;
    }): Promise<{ content: string; tokensUsed: number; model: string; toolCalls?: { id?: string; name: string; arguments: string }[] }> {
        const apiKey = options.apiKey || process.env.OPENAI_API_KEY;
        if (!apiKey) {
            throw new BadRequestException('OpenAI API key not configured');
        }

        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`,
            },
            body: JSON.stringify({
                model: 'gpt-4o-mini',
                messages: [
                    { role: 'system', content: options.systemPrompt },
                    { role: 'user', content: options.userPrompt },
                ],
                tools: options.tools,
                tool_choice: options.toolChoice || 'auto',
                max_tokens: options.maxTokens,
                temperature: options.temperature,
            }),
        });

        if (!response.ok) {
            const error = await response.text();
            this.logger.error(`OpenAI API error: ${error}`);
            throw new BadRequestException(`OpenAI API error: ${response.status}`);
        }

        const data = await response.json() as {
            choices: { message: { content: string; tool_calls?: { id?: string; type: string; function: { name: string; arguments: string } }[] } }[];
            usage: { total_tokens: number };
            model: string;
        };

        const message = data.choices[0]?.message;
        const toolCalls = message?.tool_calls?.map((call) => ({
            id: call.id,
            name: call.function?.name,
            arguments: call.function?.arguments,
        })).filter((call) => call.name && call.arguments);

        return {
            content: message?.content || '',
            toolCalls: toolCalls?.length ? toolCalls as { id?: string; name: string; arguments: string }[] : undefined,
            tokensUsed: data.usage?.total_tokens || 0,
            model: data.model || 'gpt-4o-mini',
        };
    }

    private async callAnthropic(options: {
        systemPrompt: string;
        userPrompt: string;
        apiKey?: string | null;
        maxTokens: number;
        temperature: number;
    }): Promise<{ content: string; tokensUsed: number; model: string }> {
        const apiKey = options.apiKey || process.env.ANTHROPIC_API_KEY;
        if (!apiKey) {
            throw new BadRequestException('Anthropic API key not configured');
        }

        const response = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': apiKey,
                'anthropic-version': '2023-06-01',
            },
            body: JSON.stringify({
                model: 'claude-3-haiku-20240307',
                max_tokens: options.maxTokens,
                system: options.systemPrompt,
                messages: [
                    { role: 'user', content: options.userPrompt },
                ],
            }),
        });

        if (!response.ok) {
            const error = await response.text();
            this.logger.error(`Anthropic API error: ${error}`);
            throw new BadRequestException(`Anthropic API error: ${response.status}`);
        }

        const data = await response.json() as {
            content: { text: string }[];
            usage: { input_tokens: number; output_tokens: number };
            model: string;
        };

        return {
            content: data.content[0]?.text || '',
            tokensUsed: (data.usage?.input_tokens || 0) + (data.usage?.output_tokens || 0),
            model: data.model || 'claude-3-haiku',
        };
    }

    private async callLocal(options: {
        systemPrompt: string;
        userPrompt: string;
        maxTokens: number;
        temperature: number;
    }): Promise<{ content: string; tokensUsed: number; model: string }> {
        // Placeholder for local/self-hosted models (Ollama, vLLM, etc.)
        const localEndpoint = process.env.LOCAL_AI_ENDPOINT || 'http://localhost:11434/api/generate';

        const response = await fetch(localEndpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model: process.env.LOCAL_AI_MODEL || 'llama2',
                prompt: `${options.systemPrompt}\n\nUser: ${options.userPrompt}`,
                stream: false,
            }),
        });

        if (!response.ok) {
            throw new BadRequestException(`Local AI API error: ${response.status}`);
        }

        const data = await response.json() as { response: string };

        return {
            content: data.response || '',
            tokensUsed: 0, // Local models don't typically report token usage
            model: process.env.LOCAL_AI_MODEL || 'local',
        };
    }

    private estimateCost(tokens: number, provider: string, model: string): number {
        // Rough cost estimates in cents per 1000 tokens
        const costs: Record<string, number> = {
            'gpt-4o-mini': 0.015, // $0.00015 per 1K tokens
            'gpt-4o': 0.5, // $0.005 per 1K tokens
            'gpt-4': 3, // $0.03 per 1K tokens
            'claude-3-haiku': 0.025, // $0.00025 per 1K tokens
            'claude-3-sonnet': 0.3, // $0.003 per 1K tokens
            'local': 0, // Free
        };

        const costPer1K = costs[model] || costs['gpt-4o-mini'];
        return Math.ceil((tokens / 1000) * costPer1K * 100) / 100; // Round to 2 decimal cents
    }

    private async logInteraction(data: {
        campgroundId: string;
        featureType: AiFeatureType;
        promptHash: string;
        responseHash: string;
        tokensUsed: number;
        latencyMs: number;
        userId?: string;
        sessionId?: string;
        success: boolean;
        errorType?: string;
        provider: string;
        modelUsed?: string;
        costCents?: number;
    }): Promise<void> {
        try {
            await this.prisma.aiInteractionLog.create({ data });
        } catch (error) {
            this.logger.error('Failed to log AI interaction', error);
            // Don't throw - logging failures shouldn't break the main flow
        }
    }
}
