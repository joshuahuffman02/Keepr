import { IsIn, IsOptional, IsString } from "class-validator";

export class SyncRequestDto {
  @IsOptional()
  @IsString()
  @IsIn(["pull", "push", "webhook", "export"])
  direction?: string;

  @IsOptional()
  @IsString()
  scope?: string;

  @IsOptional()
  @IsString()
  note?: string;
}
