import { IsInt, IsISO8601, IsOptional, IsPositive, IsString } from "class-validator";

export class OpenTillDto {
  @IsOptional()
  @IsString()
  terminalId?: string;

  @IsInt()
  @IsPositive()
  openingFloatCents!: number;

  @IsString()
  currency!: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class CloseTillDto {
  @IsInt()
  @IsPositive()
  countedCloseCents!: number;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class TillMovementDto {
  @IsInt()
  @IsPositive()
  amountCents!: number;

  @IsOptional()
  @IsString()
  note?: string;

  // Required for paid-in/out; optional for other movement types to avoid breaking existing callers.
  @IsOptional()
  @IsString()
  reasonCode?: string;

  @IsOptional()
  @IsString()
  referenceId?: string;
}

export class ListTillsDto {
  @IsOptional()
  @IsString()
  status?: string;
}

export class DailyTillReportQueryDto {
  @IsISO8601()
  date!: string; // YYYY-MM-DD or full ISO; evaluated in server TZ

  @IsOptional()
  @IsString()
  terminalId?: string;
}
