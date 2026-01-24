import { IsString, IsNumber, IsOptional, IsBoolean, Min } from "class-validator";

/**
 * DTO for creating a membership type
 */
export class CreateMembershipTypeDto {
  @IsString()
  campgroundId!: string;

  @IsString()
  name!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsNumber()
  @Min(0)
  price!: number;

  @IsNumber()
  @Min(1)
  durationDays!: number;

  @IsNumber()
  @Min(0)
  discountPercent!: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

/**
 * DTO for updating a membership type
 */
export class UpdateMembershipTypeDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  price?: number;

  @IsOptional()
  @IsNumber()
  @Min(1)
  durationDays?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  discountPercent?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

/**
 * DTO for purchasing a membership
 */
export class PurchaseMembershipDto {
  @IsString()
  guestId!: string;

  @IsString()
  membershipTypeId!: string;
}
