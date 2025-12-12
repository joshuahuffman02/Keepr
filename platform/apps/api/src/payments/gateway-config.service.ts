import { BadRequestException, Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { AuditService } from "../audit/audit.service";
import { GatewayConfigMapper, GatewayConfigView } from "./gateway-config.mapper";
import { UpsertPaymentGatewayConfigDto } from "./dto/payment-gateway-config.dto";

type GatewayProvider = "stripe" | "adyen" | "authorize_net" | "other";
type GatewayMode = "test" | "prod";

@Injectable()
export class GatewayConfigService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService
  ) { }

  async getConfig(campgroundId: string): Promise<GatewayConfigView | null> {
    const existing = await this.ensureConfig(campgroundId);
    return GatewayConfigMapper.toView(existing);
  }

  async upsertConfig(
    campgroundId: string,
    dto: UpsertPaymentGatewayConfigDto,
    actor?: { userId?: string | null; ip?: string | null; userAgent?: string | null }
  ): Promise<GatewayConfigView> {
    const existing = await this.prisma.campgroundPaymentGatewayConfig.findUnique({
      where: { campgroundId },
      include: { feePreset: true }
    });

    const preset = await this.resolvePreset(dto.gateway, dto.mode, dto.feePresetId);
    this.ensureProdGuard(dto.mode, dto, existing);

    const nextData = {
      gateway: dto.gateway,
      mode: dto.mode,
      feeMode: dto.feeMode,
      feePercentBasisPoints: dto.feePercentBasisPoints ?? existing?.feePercentBasisPoints ?? null,
      feeFlatCents: dto.feeFlatCents ?? existing?.feeFlatCents ?? null,
      feePresetId: dto.feePresetId ?? existing?.feePresetId ?? preset?.id ?? null,
      publishableKeySecretId: dto.publishableKeySecretId ?? existing?.publishableKeySecretId ?? null,
      secretKeySecretId: dto.secretKeySecretId ?? existing?.secretKeySecretId ?? null,
      merchantAccountIdSecretId: dto.merchantAccountIdSecretId ?? existing?.merchantAccountIdSecretId ?? null,
      webhookSecretId: dto.webhookSecretId ?? existing?.webhookSecretId ?? null,
      additionalConfig: dto.additionalConfig ?? (existing?.additionalConfig as any) ?? null
    };

    if (existing && this.isSame(existing, nextData)) {
      return GatewayConfigMapper.toView(existing)!;
    }

    const saved = await this.prisma.campgroundPaymentGatewayConfig.upsert({
      where: { campgroundId },
      create: {
        campgroundId,
        ...nextData
      },
      update: {
        ...nextData
      },
      include: { feePreset: true }
    });

    await this.audit.record({
      campgroundId,
      actorId: actor?.userId ?? null,
      action: "payment_gateway_config.updated",
      entity: "payment_gateway_config",
      entityId: saved.id,
      before: GatewayConfigMapper.toView(existing as any) ?? undefined,
      after: GatewayConfigMapper.toView(saved as any) ?? undefined,
      ip: actor?.ip,
      userAgent: actor?.userAgent
    });

    return GatewayConfigMapper.toView(saved)!;
  }

  private async ensureConfig(campgroundId: string) {
    const existing = await this.prisma.campgroundPaymentGatewayConfig.findUnique({
      where: { campgroundId },
      include: { feePreset: true }
    });
    if (existing) return existing;

    const preset = await this.resolvePreset("stripe", "test");
    return this.prisma.campgroundPaymentGatewayConfig.create({
      data: {
        campgroundId,
        gateway: "stripe",
        mode: "test",
        feeMode: "absorb",
        feePresetId: preset?.id ?? null
      },
      include: { feePreset: true }
    });
  }

  private isSame(existing: any, candidate: Record<string, any>) {
    return (
      existing.gateway === candidate.gateway &&
      existing.mode === candidate.mode &&
      existing.feeMode === candidate.feeMode &&
      (existing.feePercentBasisPoints ?? null) === (candidate.feePercentBasisPoints ?? null) &&
      (existing.feeFlatCents ?? null) === (candidate.feeFlatCents ?? null) &&
      (existing.feePresetId ?? null) === (candidate.feePresetId ?? null) &&
      (existing.publishableKeySecretId ?? null) === (candidate.publishableKeySecretId ?? null) &&
      (existing.secretKeySecretId ?? null) === (candidate.secretKeySecretId ?? null) &&
      (existing.merchantAccountIdSecretId ?? null) === (candidate.merchantAccountIdSecretId ?? null) &&
      (existing.webhookSecretId ?? null) === (candidate.webhookSecretId ?? null) &&
      JSON.stringify(existing.additionalConfig ?? null) === JSON.stringify(candidate.additionalConfig ?? null)
    );
  }

  private ensureProdGuard(mode: GatewayMode, dto: UpsertPaymentGatewayConfigDto, existing?: any) {
    if (mode !== "prod") return;
    const hasSecret = Boolean(
      dto.secretKeySecretId ||
      dto.merchantAccountIdSecretId ||
      existing?.secretKeySecretId ||
      existing?.merchantAccountIdSecretId
    );
    if (!hasSecret) {
      throw new BadRequestException("Production mode requires gateway credentials to be configured.");
    }
  }

  private async resolvePreset(gateway: GatewayProvider, mode: GatewayMode, presetId?: string | null) {
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
