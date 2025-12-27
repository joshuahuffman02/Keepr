import { Type } from "class-transformer";
import { IsArray, IsBoolean, IsDateString, IsEmail, IsEnum, IsInt, IsNotEmpty, IsOptional, IsString, Length, Matches, Min, ValidateNested } from "class-validator";
import { StayReasonPreset } from "@prisma/client";

export class PublicGuestDto {
    @IsString()
    @IsNotEmpty()
    firstName!: string;

    @IsString()
    @IsNotEmpty()
    lastName!: string;

    @IsEmail()
    email!: string;

    @IsString()
    @IsNotEmpty()
    phone!: string;

    @IsString()
    @IsNotEmpty()
    @Length(5, 10) // US zip (5) or zip+4 (10)
    zipCode!: string;
}

export class AdditionalGuestDto {
    @IsString()
    @IsOptional()
    firstName?: string;

    @IsString()
    @IsOptional()
    lastName?: string;

    @IsEmail()
    @IsOptional()
    email?: string;

    @IsString()
    @IsOptional()
    phone?: string;
}

export class ChildDto {
    @IsString()
    @IsOptional()
    name?: string;

    @IsString()
    @IsOptional()
    gender?: string; // 'male' | 'female' | 'other'

    @IsInt()
    @IsOptional()
    @Min(0)
    age?: number;
}

export class PublicEquipmentDto {
    @IsString()
    @IsNotEmpty()
    type!: string;

    @IsOptional()
    @IsInt()
    length?: number;

    @IsOptional()
    @IsString()
    plateNumber?: string;

    @IsOptional()
    @IsString()
    plateState?: string;

    @IsOptional()
    @IsString()
    make?: string;

    @IsOptional()
    @IsString()
    model?: string;
}

export class PolicyAcceptanceDto {
    @IsString()
    @IsNotEmpty()
    templateId!: string;

    @IsBoolean()
    accepted!: boolean;

    @IsOptional()
    @IsString()
    signerName?: string;

    @IsOptional()
    @IsEmail()
    signerEmail?: string;

    @IsOptional()
    metadata?: Record<string, any>;
}

export class CreatePublicReservationDto {
    @IsString()
    @IsNotEmpty()
    campgroundSlug!: string;

    @IsString()
    @IsOptional()
    siteId?: string; // Either siteId or siteClassId required

    @IsString()
    @IsOptional()
    siteClassId?: string; // For booking by site class

    @IsOptional()
    @IsBoolean()
    siteLocked?: boolean;

    @IsDateString()
    arrivalDate!: string;

    @IsDateString()
    departureDate!: string;

    @IsInt()
    @Min(1)
    adults!: number;

    @IsOptional()
    @IsInt()
    @Min(0)
    children?: number;

    @ValidateNested()
    @Type(() => PublicGuestDto)
    guest!: PublicGuestDto;

    @IsOptional()
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => AdditionalGuestDto)
    additionalGuests?: AdditionalGuestDto[];

    @IsOptional()
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => ChildDto)
    childrenDetails?: ChildDto[];

    @IsString()
    @IsOptional()
    @Matches(/^[A-Za-z0-9_-]+$/, { message: 'Promo code can only contain letters, numbers, underscores and dashes' })
    promoCode?: string;

    @IsOptional()
    @IsString()
    membershipId?: string;

    @IsBoolean()
    @IsOptional()
    taxWaiverSigned?: boolean;

    @IsOptional()
    @IsString()
    stayReasonPreset?: StayReasonPreset;

    @IsOptional()
    @IsString()
    stayReasonOther?: string;

    @IsOptional()
    @IsString()
    referralCode?: string;

    @IsOptional()
    @IsString()
    referralSource?: string;

    @IsOptional()
    @IsString()
    referralChannel?: string;

    @IsOptional()
    @ValidateNested()
    @Type(() => PublicEquipmentDto)
    equipment?: PublicEquipmentDto;

    @IsOptional()
    @IsBoolean()
    needsAccessible?: boolean;

    @IsOptional()
    @IsInt()
    @Min(0)
    petCount?: number;

    @IsOptional()
    @IsArray()
    @IsString({ each: true })
    petTypes?: string[];

    @IsOptional()
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => PolicyAcceptanceDto)
    policyAcceptances?: PolicyAcceptanceDto[];

    @IsOptional()
    @IsString()
    holdId?: string;
}

export class CreatePublicWaitlistDto {
    @IsString()
    @IsNotEmpty()
    firstName!: string;

    @IsString()
    @IsNotEmpty()
    lastName!: string;

    @IsEmail()
    email!: string;

    @IsString()
    @IsOptional()
    phone?: string;

    @IsString()
    @IsNotEmpty()
    campgroundId!: string;

    @IsDateString()
    arrivalDate!: string;

    @IsDateString()
    departureDate!: string;

    @IsString()
    @IsOptional()
    siteId?: string;

    @IsString()
    @IsOptional()
    siteClassId?: string;
}


export class PublicQuoteDto {
    @IsString()
    @IsNotEmpty()
    siteId!: string;

    @IsDateString()
    arrivalDate!: string;

    @IsDateString()
    departureDate!: string;

    @IsString()
    @IsOptional()
    @Matches(/^[A-Za-z0-9_-]+$/, { message: 'Promo code can only contain letters, numbers, underscores and dashes' })
    promoCode?: string;

    @IsOptional()
    @IsBoolean()
    taxWaiverSigned?: boolean;

    @IsOptional()
    @IsString()
    membershipId?: string;

    @IsOptional()
    @IsString()
    referralCode?: string;

    @IsOptional()
    @IsString()
    stayReasonPreset?: StayReasonPreset;

    @IsOptional()
    @IsInt()
    @Min(1)
    adults?: number;

    @IsOptional()
    @IsInt()
    @Min(0)
    children?: number;

    @IsOptional()
    @IsInt()
    @Min(0)
    petCount?: number;

    @IsOptional()
    @IsArray()
    @IsString({ each: true })
    petTypes?: string[];

    @IsOptional()
    @IsString()
    previewToken?: string;
}

export class CreateDemoRequestDto {
    @IsString()
    @IsNotEmpty()
    name!: string;

    @IsEmail()
    email!: string;

    @IsString()
    @IsOptional()
    phone?: string;

    @IsString()
    @IsNotEmpty()
    campgroundName!: string;

    @IsString()
    @IsNotEmpty()
    sites!: string;

    @IsString()
    @IsOptional()
    message?: string;
}
