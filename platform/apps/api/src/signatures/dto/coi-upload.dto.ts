import { IsIn, IsOptional, IsString } from "class-validator";

const COI_STATUSES = ["pending", "active", "expired", "voided"] as const;

export class CoiUploadDto {
  @IsString()
  campgroundId!: string;

  @IsOptional()
  @IsString()
  reservationId?: string;

  @IsOptional()
  @IsString()
  guestId?: string;

  @IsString()
  fileUrl!: string;

  @IsOptional()
  @IsString()
  storageKey?: string;

  @IsOptional()
  @IsString()
  expiresAt?: string;

  @IsOptional()
  @IsIn(COI_STATUSES as unknown as string[])
  status?: (typeof COI_STATUSES)[number];

  @IsOptional()
  @IsString()
  notes?: string;
}
