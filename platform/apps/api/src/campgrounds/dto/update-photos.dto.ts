import { ArrayMinSize, IsArray, IsOptional, IsString } from "class-validator";

export class UpdatePhotosDto {
  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  photos!: string[];

  @IsOptional()
  @IsString()
  heroImageUrl?: string | null;
}
