import { BadRequestException, Injectable } from "@nestjs/common";
import { randomUUID } from "crypto";
import { PrismaService } from "../prisma/prisma.service";
import { AuditService } from "../audit/audit.service";
import { GatewayConfigMapper, GatewayConfigView } from "./gateway-config.mapper";
import { UpsertPaymentGatewayConfigDto } from "./dto/payment-gateway-config.dto";
import { CampgroundPaymentGatewayConfig, GatewayFeePreset, Prisma } from "@prisma/client";
import { isRecord } from "../utils/type-guards";

type GatewayProvider = "stripe" | "adyen" | "authorize_net" | "other";
type GatewayMode = "test" | "prod";
type GatewayConfigRecord = CampgroundPaymentGatewayConfig & {
  GatewayFeePreset?: GatewayFeePreset | null;
};
type GatewayConfigCandidate = {
  gateway: GatewayProvider;
  mode: GatewayMode;
  feeMode: CampgroundPaymentGatewayConfig["feeMode"];
  feePercentBasisPoints: number | null;
  feeFlatCents: number | null;
  feePresetId: string | null;
  publishableKeySecretId: string | null;
  secretKeySecretId: string | null;
  merchantAccountIdSecretId: string | null;
  webhookSecretId: string | null;
  additionalConfig: Prisma.InputJsonValue | typeof Prisma.JsonNull | undefined;
};

const isJsonValue = (value: unknown): value is Prisma.InputJsonValue => {
  if (value === null) return true;
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean")
    return true;
  if (Array.isArray(value)) return value.every(isJsonValue);
  if (isRecord(value)) return Object.values(value).every(isJsonValue);
  return false;
};

const toJsonInput = (
  value: unknown,
): Prisma.InputJsonValue | typeof Prisma.JsonNull | undefined => {
  if (value === undefined) return undefined;
  if (value === null) return Prisma.JsonNull;
  if (isJsonValue(value)) return value;
  throw new BadRequestException("additionalConfig must be valid JSON");
};

const toAuditRecord = (
  view: GatewayConfigView | null | undefined,
): Record<string, unknown> | null | undefined => {
  if (view === undefined) return undefined;
  if (view === null) return null;
  const record: Record<string, unknown> = {
    id: view.id,
    campgroundId: view.campgroundId,
    gateway: view.gateway,
    mode: view.mode,
    feeMode: view.feeMode,
    feePercentBasisPoints: view.feePercentBasisPoints,
    feeFlatCents: view.feeFlatCents,
    feePresetId: view.feePresetId,
    feePresetLabel: view.feePresetLabel,
    effectiveFee: view.effectiveFee,
    credentials: view.credentials,
    hasProductionCredentials: view.hasProductionCredentials,
    additionalConfig: view.additionalConfig,
  };
  return record;
};

@Injectable()
export class GatewayConfigService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async getConfig(campgroundId: string): Promise<GatewayConfigView | null> {
    const existing = await this.ensureConfig(campgroundId);
    return GatewayConfigMapper.toView(existing);
  }

  async upsertConfig(
    campgroundId: string,
    dto: UpsertPaymentGatewayConfigDto,
    actor?: { userId?: string | null; ip?: string | null; userAgent?: string | null },
  ): Promise<GatewayConfigView> {
    const existing: GatewayConfigRecord | null =
      await this.prisma.campgroundPaymentGatewayConfig.findUnique({
        where: { campgroundId },
        include: { GatewayFeePreset: true },
      });

    const preset = await this.resolvePreset(dto.gateway, dto.mode, dto.feePresetId);
    this.ensureProdGuard(dto.mode, dto, existing);

    const additionalConfig =
      dto.additionalConfig !== undefined
        ? toJsonInput(dto.additionalConfig)
        : toJsonInput(existing?.additionalConfig);
    const nextData: GatewayConfigCandidate = {
      gateway: dto.gateway,
      mode: dto.mode,
      feeMode: dto.feeMode,
      feePercentBasisPoints: dto.feePercentBasisPoints ?? existing?.feePercentBasisPoints ?? null,
      feeFlatCents: dto.feeFlatCents ?? existing?.feeFlatCents ?? null,
      feePresetId: dto.feePresetId ?? existing?.feePresetId ?? preset?.id ?? null,
      publishableKeySecretId:
        dto.publishableKeySecretId ?? existing?.publishableKeySecretId ?? null,
      secretKeySecretId: dto.secretKeySecretId ?? existing?.secretKeySecretId ?? null,
      merchantAccountIdSecretId:
        dto.merchantAccountIdSecretId ?? existing?.merchantAccountIdSecretId ?? null,
      webhookSecretId: dto.webhookSecretId ?? existing?.webhookSecretId ?? null,
      additionalConfig,
    };

    if (existing && this.isSame(existing, nextData)) {
      return GatewayConfigMapper.toView(existing)!;
    }

    const saved = await this.prisma.campgroundPaymentGatewayConfig.upsert({
      where: { campgroundId },
      create: {
        id: randomUUID(),
        campgroundId,
        ...nextData,
      },
      update: {
        ...nextData,
      },
      include: { GatewayFeePreset: true },
    });

    await this.audit.record({
      campgroundId,
      actorId: actor?.userId ?? null,
      action: "payment_gateway_config.updated",
      entity: "payment_gateway_config",
      entityId: saved.id,
      before: toAuditRecord(GatewayConfigMapper.toView(existing)),
      after: toAuditRecord(GatewayConfigMapper.toView(saved)),
      ip: actor?.ip,
      userAgent: actor?.userAgent,
    });

    return GatewayConfigMapper.toView(saved)!;
  }

  private async ensureConfig(campgroundId: string) {
    const existing = await this.prisma.campgroundPaymentGatewayConfig.findUnique({
      where: { campgroundId },
      include: { GatewayFeePreset: true },
    });
    if (existing) return existing;

    const preset = await this.resolvePreset("stripe", "test");
    return this.prisma.campgroundPaymentGatewayConfig.create({
      data: {
        id: randomUUID(),
        campgroundId,
        gateway: "stripe",
        mode: "test",
        feeMode: "absorb",
        feePresetId: preset?.id ?? null,
      },
      include: { GatewayFeePreset: true },
    });
  }

  private isSame(existing: GatewayConfigRecord, candidate: GatewayConfigCandidate) {
    const candidateAdditional =
      candidate.additionalConfig === Prisma.JsonNull ? null : candidate.additionalConfig;
    const existingAdditional = existing.additionalConfig ?? null;
    return (
      existing.gateway === candidate.gateway &&
      existing.mode === candidate.mode &&
      existing.feeMode === candidate.feeMode &&
      (existing.feePercentBasisPoints ?? null) === (candidate.feePercentBasisPoints ?? null) &&
      (existing.feeFlatCents ?? null) === (candidate.feeFlatCents ?? null) &&
      (existing.feePresetId ?? null) === (candidate.feePresetId ?? null) &&
      (existing.publishableKeySecretId ?? null) === (candidate.publishableKeySecretId ?? null) &&
      (existing.secretKeySecretId ?? null) === (candidate.secretKeySecretId ?? null) &&
      (existing.merchantAccountIdSecretId ?? null) ===
        (candidate.merchantAccountIdSecretId ?? null) &&
      (existing.webhookSecretId ?? null) === (candidate.webhookSecretId ?? null) &&
      JSON.stringify(existingAdditional) === JSON.stringify(candidateAdditional ?? null)
    );
  }

  private ensureProdGuard(
    mode: GatewayMode,
    dto: UpsertPaymentGatewayConfigDto,
    existing?: GatewayConfigRecord | null,
  ) {
    if (mode !== "prod") return;
    const hasSecret = Boolean(
      dto.secretKeySecretId ||
      dto.merchantAccountIdSecretId ||
      existing?.secretKeySecretId ||
      existing?.merchantAccountIdSecretId,
    );
    if (!hasSecret) {
      throw new BadRequestException(
        "Production mode requires gateway credentials to be configured.",
      );
    }
  }

  private async resolvePreset(
    gateway: GatewayProvider,
    mode: GatewayMode,
    presetId?: string | null,
  ) {
    if (presetId) {
      const preset = await this.prisma.gatewayFeePreset.findUnique({ where: { id: presetId } });
      if (!preset) throw new BadRequestException("feePresetId is invalid");
      if (preset.gateway !== gateway || preset.mode !== mode) {
        throw new BadRequestException("feePresetId does not match gateway/mode");
      }
      return preset;
    }
    return this.prisma.gatewayFeePreset.findFirst({ where: { gateway, mode } });
  }
}
