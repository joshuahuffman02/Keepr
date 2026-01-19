import { IsIn, IsOptional } from 'class-validator';
import { z } from 'zod';
import type { MessageHistoryItem } from './get-history.dto';

export const getTranscriptSchema = z.object({
  format: z.enum(['text', 'markdown', 'json']).optional(),
});

export type TranscriptFormat = 'text' | 'markdown' | 'json';

export class GetTranscriptDto {
  @IsOptional()
  @IsIn(['text', 'markdown', 'json'])
  format?: TranscriptFormat;
}

export interface TranscriptResponse {
  conversationId: string;
  format: TranscriptFormat;
  content?: string;
  messages?: MessageHistoryItem[];
}
