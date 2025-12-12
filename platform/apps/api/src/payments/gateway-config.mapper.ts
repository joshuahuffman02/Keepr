import { CampgroundPaymentGatewayConfig, GatewayFeePreset } from "@prisma/client";

type ConfigRecord = (CampgroundPaymentGatewayConfig & { feePreset?: GatewayFeePreset | null }) | null;

export interface GatewayConfigView {
  id: string;
  campgroundId: string;
  gateway: string;
  mode: string;
  feeMode: string;
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

export const GatewayConfigMapper = {
  toView(record: ConfigRecord): GatewayConfigView | null {
    if (!record) return null;
    const percentBasisPoints = record.feePercentBasisPoints ?? record.feePreset?.percentBasisPoints ?? 0;
    const flatFeeCents = record.feeFlatCents ?? record.feePreset?.flatFeeCents ?? 0;

    return {
      id: record.id,
      campgroundId: record.campgroundId,
      gateway: record.gateway,
      mode: record.mode,
      feeMode: record.feeMode,
      feePercentBasisPoints: record.feePercentBasisPoints ?? null,
      feeFlatCents: record.feeFlatCents ?? null,
      feePresetId: record.feePresetId ?? null,
      feePresetLabel: record.feePreset?.label ?? null,
      effectiveFee: {
        percentBasisPoints,
        flatFeeCents
      },
      credentials: {
        publishableKeySecretId: record.publishableKeySecretId ?? null,
        secretKeySecretId: record.secretKeySecretId ?? null,
        merchantAccountIdSecretId: record.merchantAccountIdSecretId ?? null,
        webhookSecretId: record.webhookSecretId ?? null
      },
      hasProductionCredentials: Boolean(record.secretKeySecretId || record.merchantAccountIdSecretId),
      additionalConfig: (record.additionalConfig as Record<string, any> | null) ?? null
    };
  }
};
