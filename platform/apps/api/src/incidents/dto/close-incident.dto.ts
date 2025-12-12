import { IsOptional, IsString } from "class-validator";

export class CloseIncidentDto {
  @IsOptional()
  @IsString()
  resolutionNotes?: string;

  @IsOptional()
  @IsString()
  claimId?: string;
}
