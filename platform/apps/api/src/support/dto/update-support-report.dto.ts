import { IsEnum, IsOptional, IsString } from "class-validator";
import { SupportReportStatus } from "@prisma/client";

export class UpdateSupportReportDto {
  @IsOptional()
  @IsEnum(SupportReportStatus)
  status?: SupportReportStatus;

  @IsOptional()
  @IsString()
  assigneeId?: string | null;
}
