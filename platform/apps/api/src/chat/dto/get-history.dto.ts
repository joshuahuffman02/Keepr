import { IsString, IsOptional, IsInt, Min, Max, IsUUID } from 'class-validator';
import { Type } from 'class-transformer';
import { z } from 'zod';

// Zod schema for validation
export const getHistorySchema = z.object({
  conversationId: z.string().optional(),
  limit: z.number().min(1).max(100).default(50),
  before: z.string().optional(), // cursor for pagination (messageId)
});

export type GetHistoryInput = z.infer<typeof getHistorySchema>;

// Class-validator DTO for NestJS
export class GetHistoryDto {
  @IsOptional()
  @IsString()
  @IsUUID()
  conversationId?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 50;

  @IsOptional()
  @IsString()
  before?: string;
}

// Response types
export interface ConversationHistoryResponse {
  conversationId: string;
  messages: MessageHistoryItem[];
  hasMore: boolean;
  nextCursor?: string;
}

export interface MessageHistoryItem {
  id: string;
  role: 'user' | 'assistant' | 'tool' | 'system';
  content: string;
  toolCalls?: any[];
  toolResults?: any[];
  createdAt: string;
}
