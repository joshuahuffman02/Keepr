import { IsString, IsUUID, IsEnum, IsOptional, MaxLength } from "class-validator";
import { z } from "zod";

export enum ChatFeedbackValue {
  up = "up",
  down = "down",
}

export const submitFeedbackSchema = z.object({
  messageId: z.string().uuid(),
  value: z.nativeEnum(ChatFeedbackValue),
  sessionId: z.string().max(128).optional(),
});

export type SubmitFeedbackInput = z.infer<typeof submitFeedbackSchema>;

export class SubmitFeedbackDto {
  @IsString()
  @IsUUID()
  messageId!: string;

  @IsEnum(ChatFeedbackValue)
  value!: ChatFeedbackValue;

  @IsOptional()
  @IsString()
  @MaxLength(128)
  sessionId?: string;
}

export interface SubmitFeedbackResponse {
  success: boolean;
  message: string;
}
