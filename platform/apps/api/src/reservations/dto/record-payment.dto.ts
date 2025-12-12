import { Type } from "class-transformer";
import { IsArray, IsIn, IsInt, IsOptional, IsString, Min, ValidateNested } from "class-validator";

class TenderDto {
  @IsString()
  @IsIn(["card", "cash", "check", "folio"])
  method!: string;

  @IsInt()
  @Min(1)
  amountCents!: number;

  @IsOptional()
  @IsString()
  note?: string;
}

export class RecordPaymentDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  amountCents?: number;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TenderDto)
  tenders?: TenderDto[];
}
