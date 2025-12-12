import { IsIn, IsInt, IsObject, IsOptional, IsString, Min } from "class-validator";

type GatewayProvider = "stripe" | "adyen" | "authorize_net" | "other";
type GatewayMode = "test" | "prod";
type FeeMode = "absorb" | "pass_through";

export class UpsertPaymentGatewayConfigDto {
  @IsIn(["stripe", "adyen", "authorize_net", "other"])
  gateway!: GatewayProvider;

  @IsIn(["test", "prod"])
  mode!: GatewayMode;

  @IsIn(["absorb", "pass_through"])
  feeMode!: FeeMode;

  @IsOptional()
  @IsInt()
  @Min(0)
  feePercentBasisPoints?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  feeFlatCents?: number;

  @IsOptional()
  @IsString()
  feePresetId?: string;

  @IsOptional()
  @IsString()
  publishableKeySecretId?: string;

  @IsOptional()
  @IsString()
  secretKeySecretId?: string;

  @IsOptional()
  @IsString()
  merchantAccountIdSecretId?: string;

  @IsOptional()
  @IsString()
  webhookSecretId?: string;

  @IsOptional()
  @IsObject()
  additionalConfig?: Record<string, any>;
}

export interface PaymentGatewayConfigResponse {
  id: string;
  campgroundId: string;
  gateway: GatewayProvider;
  mode: GatewayMode;
  feeMode: FeeMode;
  feePercentBasisPoints: number | null;
  feeFlatCents: number | null;
  feePresetId: string | null;
  feePresetLabel: string | null;
  effectiveFee: {
    percentBasisPoints: number;
    flatFeeCents: number;
  };
  credentials: {
    publishableKeySecretId: string | null;
    secretKeySecretId: string | null;
    merchantAccountIdSecretId: string | null;
    webhookSecretId: string | null;
  };
  hasProductionCredentials: boolean;
  additionalConfig: Record<string, any> | null;
}
