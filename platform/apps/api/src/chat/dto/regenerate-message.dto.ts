import { IsString, IsUUID, IsOptional, MaxLength } from "class-validator";
import { z } from "zod";

export const regenerateMessageSchema = z.object({
  messageId: z.string().uuid(),
  sessionId: z.string().max(128).optional(),
});

export type RegenerateMessageInput = z.infer<typeof regenerateMessageSchema>;

export class RegenerateMessageDto {
  @IsString()
  @IsUUID()
  messageId!: string;

  @IsOptional()
  @IsString()
  @MaxLength(128)
  sessionId?: string;
}
