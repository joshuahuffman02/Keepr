import { IsString, IsOptional, IsInt, Min, Max, MaxLength } from "class-validator";
import { Type } from "class-transformer";
import { z } from "zod";

export const getConversationsSchema = z.object({
  limit: z.number().min(1).max(50).default(20),
  before: z.string().optional(),
  since: z.string().optional(),
  query: z.string().max(160).optional(),
});

export type GetConversationsInput = z.infer<typeof getConversationsSchema>;

export class GetConversationsDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number = 20;

  @IsOptional()
  @IsString()
  before?: string;

  @IsOptional()
  @IsString()
  since?: string;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  query?: string;
}

export interface ConversationSummary {
  id: string;
  title?: string | null;
  updatedAt: string;
  lastMessagePreview?: string;
  lastMessageAt?: string;
}

export interface ConversationListResponse {
  conversations: ConversationSummary[];
  hasMore: boolean;
  nextCursor?: string;
}
