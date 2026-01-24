import { IsBoolean, IsEmail, IsIn, IsInt, IsOptional, IsString } from "class-validator";

type SignatureType =
  | "long_term_stay"
  | "seasonal"
  | "monthly"
  | "park_rules"
  | "deposit"
  | "waiver"
  | "coi"
  | "other";
type DeliveryChannel = "email" | "sms" | "email_and_sms";
type SignatureMethod = "digital" | "paper" | "waived";

const SIGNATURE_TYPES: SignatureType[] = [
  "long_term_stay",
  "seasonal",
  "monthly",
  "park_rules",
  "deposit",
  "waiver",
  "coi",
  "other",
];
const DELIVERY_CHANNELS: DeliveryChannel[] = ["email", "sms", "email_and_sms"];
const SIGNATURE_METHODS: SignatureMethod[] = ["digital", "paper", "waived"];

export class CreateSignatureRequestDto {
  @IsOptional()
  @IsString()
  campgroundId?: string;

  @IsOptional()
  @IsString()
  reservationId?: string;

  @IsOptional()
  @IsString()
  guestId?: string;

  @IsOptional()
  @IsString()
  templateId?: string;

  @IsOptional()
  @IsIn(SIGNATURE_TYPES)
  documentType?: SignatureType;

  @IsOptional()
  @IsIn(DELIVERY_CHANNELS)
  deliveryChannel?: DeliveryChannel;

  @IsOptional()
  @IsIn(SIGNATURE_METHODS)
  signatureMethod?: SignatureMethod;

  @IsOptional()
  @IsString()
  subject?: string;

  @IsOptional()
  @IsString()
  message?: string;

  @IsOptional()
  @IsString()
  recipientName?: string;

  @IsOptional()
  @IsEmail()
  recipientEmail?: string;

  @IsOptional()
  @IsString()
  recipientPhone?: string;

  @IsOptional()
  @IsString()
  expiresAt?: string;

  @IsOptional()
  @IsString()
  reminderAt?: string;

  @IsOptional()
  @IsString()
  previewAvailableAt?: string;

  @IsOptional()
  @IsString()
  availableForSigningAt?: string;

  @IsOptional()
  @IsString()
  renewsContractId?: string;

  @IsOptional()
  @IsInt()
  seasonYear?: number;

  @IsOptional()
  metadata?: Record<string, unknown>;
}
