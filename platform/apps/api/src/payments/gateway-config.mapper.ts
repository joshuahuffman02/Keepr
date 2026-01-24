import { CampgroundPaymentGatewayConfig, GatewayFeePreset } from "@prisma/client";
import { isRecord } from "../utils/type-guards";

type ConfigRecord =
  | (CampgroundPaymentGatewayConfig & { GatewayFeePreset?: GatewayFeePreset | null })
  | null;

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
  additionalConfig: Record<string, unknown> | null;
}

export const GatewayConfigMapper = {
  toView(record: ConfigRecord): GatewayConfigView | null {
    if (!record) return null;
    const percentBasisPoints =
      record.feePercentBasisPoints ?? record.GatewayFeePreset?.percentBasisPoints ?? 0;
    const flatFeeCents = record.feeFlatCents ?? record.GatewayFeePreset?.flatFeeCents ?? 0;

    return {
      id: record.id,
      campgroundId: record.campgroundId,
      gateway: record.gateway,
      mode: record.mode,
      feeMode: record.feeMode,
      feePercentBasisPoints: record.feePercentBasisPoints ?? null,
      feeFlatCents: record.feeFlatCents ?? null,
      feePresetId: record.feePresetId ?? null,
      feePresetLabel: record.GatewayFeePreset?.label ?? null,
      effectiveFee: {
        percentBasisPoints,
        flatFeeCents,
      },
      credentials: {
        publishableKeySecretId: record.publishableKeySecretId ?? null,
        secretKeySecretId: record.secretKeySecretId ?? null,
        merchantAccountIdSecretId: record.merchantAccountIdSecretId ?? null,
        webhookSecretId: record.webhookSecretId ?? null,
      },
      hasProductionCredentials: Boolean(
        record.secretKeySecretId || record.merchantAccountIdSecretId,
      ),
      additionalConfig: isRecord(record.additionalConfig) ? record.additionalConfig : null,
    };
  },
};
