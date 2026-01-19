import { IsString, IsOptional, IsEnum, IsInt, Min, IsArray } from "class-validator";
import { FeatureSetupStatus } from "@prisma/client";

export { FeatureSetupStatus };

export class CreateFeatureQueueDto {
  @IsString()
  featureKey!: string;

  @IsEnum(FeatureSetupStatus)
  @IsOptional()
  status?: FeatureSetupStatus = FeatureSetupStatus.setup_later;

  @IsInt()
  @Min(0)
  @IsOptional()
  priority?: number = 0;
}

export class BulkCreateFeatureQueueDto {
  @IsArray()
  features!: Array<{
    featureKey: string;
    status: FeatureSetupStatus;
    priority?: number;
  }>;
}

export class UpdateFeatureQueueDto {
  @IsEnum(FeatureSetupStatus)
  @IsOptional()
  status?: FeatureSetupStatus;

  @IsInt()
  @Min(0)
  @IsOptional()
  priority?: number;
}

export class FeatureQueueResponseDto {
  id!: string;
  campgroundId!: string;
  featureKey!: string;
  status!: FeatureSetupStatus;
  priority!: number;
  completedAt!: Date | null;
  skippedAt!: Date | null;
  createdAt!: Date;
  updatedAt!: Date;
}

export class FeatureQueueListResponseDto {
  items!: FeatureQueueResponseDto[];
  setupNowCount!: number;
  setupLaterCount!: number;
  completedCount!: number;
  skippedCount!: number;
}
