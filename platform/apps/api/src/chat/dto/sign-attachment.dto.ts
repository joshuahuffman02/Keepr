import { IsInt, IsString, MaxLength, Min } from "class-validator";

export class SignChatAttachmentDto {
  @IsString()
  @MaxLength(255)
  filename!: string;

  @IsString()
  @MaxLength(128)
  contentType!: string;

  @IsInt()
  @Min(1)
  size!: number;
}

export interface SignChatAttachmentResponse {
  uploadUrl: string;
  storageKey: string;
  publicUrl: string;
  downloadUrl?: string;
}
