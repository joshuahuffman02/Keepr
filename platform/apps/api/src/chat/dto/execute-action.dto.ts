import { IsString, IsUUID, IsObject, IsOptional, MaxLength } from "class-validator";
import { z } from "zod";

// Zod schema for validation
export const executeActionSchema = z.object({
  conversationId: z.string(),
  actionId: z.string(),
  selectedOption: z.string().optional(),
  formData: z.record(z.unknown()).optional(),
  sessionId: z.string().max(128).optional(),
});

export type ExecuteActionInput = z.infer<typeof executeActionSchema>;

// Class-validator DTO for NestJS
export class ExecuteActionDto {
  @IsString()
  @IsUUID()
  conversationId!: string;

  @IsString()
  actionId!: string;

  @IsOptional()
  @IsString()
  selectedOption?: string;

  @IsOptional()
  @IsObject()
  formData?: Record<string, unknown>;

  @IsOptional()
  @IsString()
  @MaxLength(128)
  sessionId?: string;
}

// Response type
export interface ExecuteActionResponse {
  success: boolean;
  message: string;
  result?: unknown;
  error?: string;
  nextAction?: {
    type: "confirmation" | "form" | "selection";
    actionId: string;
    title: string;
    description: string;
    data?: Record<string, unknown>;
  };
}
