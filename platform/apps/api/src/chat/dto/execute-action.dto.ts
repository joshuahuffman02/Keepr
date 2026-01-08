import { IsString, IsUUID, IsObject, IsOptional } from 'class-validator';
import { z } from 'zod';

// Zod schema for validation
export const executeActionSchema = z.object({
  conversationId: z.string(),
  actionId: z.string(),
  selectedOption: z.string().optional(),
  formData: z.record(z.any()).optional(),
});

export type ExecuteActionInput = z.infer<typeof executeActionSchema>;

// Class-validator DTO for NestJS
export class ExecuteActionDto {
  @IsString()
  @IsUUID()
  conversationId: string;

  @IsString()
  actionId: string;

  @IsOptional()
  @IsString()
  selectedOption?: string;

  @IsOptional()
  @IsObject()
  formData?: Record<string, any>;
}

// Response type
export interface ExecuteActionResponse {
  success: boolean;
  message: string;
  result?: any;
  error?: string;
  nextAction?: {
    type: 'confirmation' | 'form' | 'selection';
    actionId: string;
    title: string;
    description: string;
    data?: Record<string, any>;
  };
}
