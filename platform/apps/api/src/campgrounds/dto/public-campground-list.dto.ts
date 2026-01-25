import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

export class PublicCampgroundAwardSummaryDto {
  @ApiProperty({ type: Number })
  year: number;

  @ApiPropertyOptional({ type: Number, nullable: true })
  npsScore?: number | null;
}

export class PublicCampgroundListItemDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  name: string;

  @ApiProperty()
  slug: string;

  @ApiPropertyOptional({ nullable: true })
  city?: string | null;

  @ApiPropertyOptional({ nullable: true })
  state?: string | null;

  @ApiPropertyOptional({ nullable: true })
  country?: string | null;

  @ApiPropertyOptional({ nullable: true })
  tagline?: string | null;

  @ApiPropertyOptional({ nullable: true })
  heroImageUrl?: string | null;

  @ApiProperty({ type: [String] })
  amenities: string[];

  @ApiProperty({ type: [String] })
  photos: string[];

  @ApiProperty()
  isExternal: boolean;

  @ApiProperty()
  isBookable: boolean;

  @ApiPropertyOptional({ nullable: true })
  externalUrl?: string | null;

  @ApiPropertyOptional({ type: Number, nullable: true })
  reviewScore?: number | null;

  @ApiProperty({ type: Number })
  reviewCount: number;

  @ApiPropertyOptional({ type: [String], nullable: true })
  reviewSources?: string[] | null;

  @ApiPropertyOptional({ nullable: true })
  amenitySummary?: Record<string, unknown> | null;

  @ApiPropertyOptional({ type: Number, nullable: true })
  npsScore?: number | null;

  @ApiProperty({ type: Number })
  npsResponseCount: number;

  @ApiPropertyOptional({ type: Number, nullable: true })
  npsRank?: number | null;

  @ApiPropertyOptional({ type: Number, nullable: true })
  npsPercentile?: number | null;

  @ApiPropertyOptional({ type: Number, nullable: true })
  npsImprovement?: number | null;

  @ApiProperty()
  isWorldClassNps: boolean;

  @ApiProperty()
  isTopCampground: boolean;

  @ApiProperty()
  isTop1PercentNps: boolean;

  @ApiProperty()
  isTop5PercentNps: boolean;

  @ApiProperty()
  isTop10PercentNps: boolean;

  @ApiProperty()
  isRisingStar: boolean;

  @ApiProperty({ type: [PublicCampgroundAwardSummaryDto] })
  pastCampgroundOfYearAwards: PublicCampgroundAwardSummaryDto[];
}

export class PublicCampgroundListCursorDto {
  @ApiProperty({ description: "ISO-8601 timestamp for the last row." })
  createdAt: string;

  @ApiProperty()
  id: string;
}

export class PublicCampgroundListResponseDto {
  @ApiProperty({ type: [PublicCampgroundListItemDto] })
  results: PublicCampgroundListItemDto[];

  @ApiPropertyOptional({ type: PublicCampgroundListCursorDto, nullable: true })
  nextCursor?: PublicCampgroundListCursorDto | null;
}
