import { IsObject, IsOptional, IsString, IsUUID } from 'class-validator';
import { z } from 'zod';

export const executeToolSchema = z.object({
  tool: z.string(),
  args: z.record(z.unknown()).optional(),
  conversationId: z.string().uuid().optional(),
});

export type ExecuteToolInput = z.infer<typeof executeToolSchema>;

export class ExecuteToolDto {
  @IsString()
  tool!: string;

  @IsOptional()
  @IsObject()
  args?: Record<string, unknown>;

  @IsOptional()
  @IsUUID()
  conversationId?: string;
}

export interface ExecuteToolResponse {
  success: boolean;
  message: string;
  result?: unknown;
  error?: string;
}
