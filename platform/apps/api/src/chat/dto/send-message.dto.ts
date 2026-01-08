import { IsString, IsOptional, IsObject, MaxLength, IsUUID, IsEnum } from 'class-validator';
import { z } from 'zod';

// Zod schema for validation
export const sendMessageSchema = z.object({
  conversationId: z.string().optional(),
  message: z.string().min(1).max(4000),
  context: z.object({
    reservationId: z.string().optional(),
    currentPage: z.string().optional(),
  }).optional(),
});

export type SendMessageInput = z.infer<typeof sendMessageSchema>;

// Class-validator DTO for NestJS
export class SendMessageDto {
  @IsOptional()
  @IsString()
  @IsUUID()
  conversationId?: string;

  @IsString()
  @MaxLength(4000)
  message: string;

  @IsOptional()
  @IsObject()
  context?: {
    reservationId?: string;
    currentPage?: string;
  };
}

// Response types
export interface ChatMessageResponse {
  conversationId: string;
  messageId: string;
  role: 'assistant';
  content: string;
  toolCalls?: ToolCall[];
  toolResults?: ToolResult[];
  actionRequired?: ActionRequired;
  createdAt: string;
}

export interface ToolCall {
  id: string;
  name: string;
  args: Record<string, any>;
}

export interface ToolResult {
  toolCallId: string;
  result: any;
  error?: string;
}

export interface ActionRequired {
  type: 'confirmation' | 'form' | 'selection';
  actionId: string;
  title: string;
  description: string;
  data?: Record<string, any>;
  options?: ActionOption[];
}

export interface ActionOption {
  id: string;
  label: string;
  variant?: 'default' | 'destructive' | 'outline';
}
