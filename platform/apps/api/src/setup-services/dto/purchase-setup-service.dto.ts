import { IsEnum, IsBoolean, IsOptional, IsInt, IsString, Min } from "class-validator";
import { SetupServiceType } from "../../generated/prisma";

export class PurchaseSetupServiceDto {
  @IsEnum(SetupServiceType)
  serviceType: SetupServiceType;

  @IsBoolean()
  payUpfront: boolean;

  @IsOptional()
  @IsInt()
  @Min(1)
  reservationCount?: number;

  @IsOptional()
  @IsString()
  importNotes?: string;

  @IsOptional()
  @IsString()
  stripePaymentIntentId?: string;
}
