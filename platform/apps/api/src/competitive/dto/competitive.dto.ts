import { IsString, IsOptional, IsBoolean, IsInt, IsDateString, IsUrl, Min, MaxLength, IsIn } from "class-validator";

// Valid site types for competitor rates
const VALID_SITE_TYPES = ["rv", "tent", "cabin", "glamping", "hotel_room", "suite", "yurt", "treehouse", "tiny_house"];
const VALID_SOURCES = ["manual", "scraped", "ota"];

// =============================================================================
// COMPETITOR DTOs
// =============================================================================

export class CreateCompetitorDto {
    @IsString()
    campgroundId!: string;

    @IsString()
    @MaxLength(200)
    name!: string;

    @IsOptional()
    @IsUrl()
    url?: string;

    @IsOptional()
    @IsString()
    notes?: string;

    @IsOptional()
    @IsBoolean()
    isActive?: boolean;
}

export class UpdateCompetitorDto {
    @IsOptional()
    @IsString()
    @MaxLength(200)
    name?: string;

    @IsOptional()
    @IsUrl()
    url?: string;

    @IsOptional()
    @IsString()
    notes?: string;

    @IsOptional()
    @IsBoolean()
    isActive?: boolean;
}

// =============================================================================
// COMPETITOR RATE DTOs
// =============================================================================

export class CreateCompetitorRateDto {
    @IsString()
    competitorId!: string;

    @IsString()
    @IsIn(VALID_SITE_TYPES)
    siteType!: string;

    @IsInt()
    @Min(0)
    rateNightly!: number; // in cents

    @IsString()
    @IsIn(VALID_SOURCES)
    source!: string;

    @IsOptional()
    @IsDateString()
    validFrom?: string;

    @IsOptional()
    @IsDateString()
    validTo?: string;

    @IsOptional()
    @IsString()
    notes?: string;
}

export class UpdateCompetitorRateDto {
    @IsOptional()
    @IsString()
    @IsIn(VALID_SITE_TYPES)
    siteType?: string;

    @IsOptional()
    @IsInt()
    @Min(0)
    rateNightly?: number;

    @IsOptional()
    @IsString()
    @IsIn(VALID_SOURCES)
    source?: string;

    @IsOptional()
    @IsDateString()
    validFrom?: string;

    @IsOptional()
    @IsDateString()
    validTo?: string;

    @IsOptional()
    @IsString()
    notes?: string;
}

// =============================================================================
// RATE PARITY ALERT DTOs
// =============================================================================

export class AcknowledgeAlertDto {
    @IsString()
    userId!: string;
}

export class ResolveAlertDto {
    @IsOptional()
    @IsString()
    notes?: string;
}

// =============================================================================
// COMPARISON DTOs
// =============================================================================

export class CompetitorComparisonDto {
    @IsString()
    campgroundId!: string;

    @IsString()
    @IsIn(VALID_SITE_TYPES)
    siteType!: string;

    @IsOptional()
    @IsDateString()
    date?: string;
}

export class MarketPositionResponse {
    siteType!: string;
    yourRate!: number;
    competitorRates!: Array<{
        competitorId: string;
        competitorName: string;
        rate: number;
        difference: number;
        percentDifference: number;
    }>;
    position!: number;
    totalCompetitors!: number;
    positionLabel!: string; // e.g., "2nd cheapest for RV"
    averageMarketRate!: number;
    lowestRate!: number;
    highestRate!: number;
}

export class RateParityCheckResult {
    hasParityIssues!: boolean;
    alerts!: Array<{
        siteType: string;
        directRate: number;
        otaRate: number;
        otaSource: string;
        difference: number;
    }>;
}

export class RateTrendPoint {
    date!: string;
    rate!: number;
    competitorId!: string;
    competitorName!: string;
}

export class RateTrendResponse {
    siteType!: string;
    trends!: Array<{
        competitorId: string;
        competitorName: string;
        dataPoints: Array<{ date: string; rate: number }>;
    }>;
}
