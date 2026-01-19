import { IsString, IsOptional, IsObject, MaxLength, IsUUID, IsArray, ValidateNested, IsInt, Min, Max, ValidateIf, MinLength, IsIn } from 'class-validator';
import { Type } from 'class-transformer';
import { z } from 'zod';

// Zod schema for validation
const attachmentSchema = z.object({
  name: z.string().min(1).max(255),
  contentType: z.string().min(1).max(128),
  size: z.number().int().min(1).max(10 * 1024 * 1024),
  storageKey: z.string().optional(),
  url: z.string().optional(),
});

export const sendMessageSchema = z.object({
  conversationId: z.string().optional(),
  message: z.string().max(4000).optional(),
  attachments: z.array(attachmentSchema).optional(),
  visibility: z.enum(["public", "internal"]).optional(),
  context: z.object({
    reservationId: z.string().optional(),
    currentPage: z.string().optional(),
  }).optional(),
}).refine((value) => {
  const message = value.message?.trim() ?? "";
  return message.length > 0 || (value.attachments?.length ?? 0) > 0;
}, { message: "Message or attachment required", path: ["message"] });

export type SendMessageInput = z.infer<typeof sendMessageSchema>;

// Class-validator DTO for NestJS
export class SendMessageDto {
  @IsOptional()
  @IsString()
  @IsUUID()
  conversationId?: string;

  @ValidateIf((value) => !value.attachments || value.attachments.length === 0)
  @IsString()
  @MinLength(1)
  @MaxLength(4000)
  message?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ChatAttachmentDto)
  attachments?: ChatAttachmentDto[];

  @IsOptional()
  @IsString()
  @IsIn(["public", "internal"])
  visibility?: ChatMessageVisibility;

  @IsOptional()
  @IsObject()
  context?: {
    reservationId?: string;
    currentPage?: string;
  };
}

// Response types
export type ChatMessageVisibility = 'public' | 'internal';

export interface ChatMessageResponse {
  conversationId: string;
  messageId: string;
  role: 'assistant';
  content: string;
  parts?: ChatMessagePart[];
  toolCalls?: ToolCall[];
  toolResults?: ToolResult[];
  actionRequired?: ActionRequired;
  createdAt: string;
  visibility?: ChatMessageVisibility;
}

export interface ChatAttachment {
  name: string;
  contentType: string;
  size: number;
  storageKey?: string;
  url?: string;
  downloadUrl?: string;
}

export class ChatAttachmentDto {
  @IsString()
  @MaxLength(255)
  name!: string;

  @IsString()
  @MaxLength(128)
  contentType!: string;

  @IsInt()
  @Min(1)
  @Max(10 * 1024 * 1024)
  size!: number;

  @IsOptional()
  @IsString()
  @MaxLength(512)
  storageKey?: string;

  @IsOptional()
  @IsString()
  @MaxLength(512)
  url?: string;
}

export interface ToolCall {
  id: string;
  name: string;
  args: Record<string, unknown>;
}

export interface ToolResult {
  toolCallId: string;
  result: unknown;
  error?: string;
}

export type ChatMessagePart =
  | { type: 'text'; text: string }
  | {
      type: 'tool';
      name: string;
      callId: string;
      args?: Record<string, unknown>;
      result?: unknown;
      error?: string;
    }
  | { type: 'file'; file: ChatAttachment }
  | { type: 'card'; title?: string; summary?: string; payload?: Record<string, unknown> };

export interface ActionRequired {
  type: 'confirmation' | 'form' | 'selection';
  actionId: string;
  title: string;
  description: string;
  summary?: string;
  data?: Record<string, unknown>;
  options?: ActionOption[];
}

export interface ActionOption {
  id: string;
  label: string;
  variant?: 'default' | 'destructive' | 'outline';
}
