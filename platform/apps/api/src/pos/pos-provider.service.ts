import { BadRequestException, Injectable, Logger, NotFoundException, UnauthorizedException } from "@nestjs/common";
import {
  IdempotencyStatus,
  PosIntegrationStatus,
  PosProviderCapability,
  PosProviderType,
  PosSyncStatus,
  PosSyncTarget
} from "@prisma/client";
import { AuditService } from "../audit/audit.service";
import { IdempotencyService } from "../payments/idempotency.service";
import { PrismaService } from "../prisma/prisma.service";
import { CloverAdapter, SquareAdapter, ToastAdapter } from "./pos-provider.adapters";
import { PosProviderRegistry } from "./pos-provider.registry";
import {
  IntegrationRecord,
  PosProviderAdapter,
  ProviderPaymentRequest,
  ProviderPaymentResult,
  ProviderSyncResult,
  ProviderValidationResult,
  ProviderWebhookResult
} from "./pos-provider.types";

@Injectable()
export class PosProviderService {
  private readonly logger = new Logger(PosProviderService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly registry: PosProviderRegistry,
    private readonly audit: AuditService,
    private readonly idempotency: IdempotencyService,
    clover: CloverAdapter,
    square: SquareAdapter,
    toast: ToastAdapter
  ) {
    // Touch adapters so Nest instantiates them for registry
    [clover, square, toast].forEach(() => null);
  }

  private normalizeProvider(provider: string): PosProviderType {
    const normalized = provider.toLowerCase() as PosProviderType;
    if (!(Object.values(PosProviderType) as string[]).includes(normalized)) {
      throw new BadRequestException("Unsupported provider");
    }
    return normalized;
  }

  private normalizeCapabilities(capabilities?: string[]): PosProviderCapability[] {
    if (!capabilities?.length) return [PosProviderCapability.payments];
    return capabilities
      .map((c) => c.toLowerCase() as PosProviderCapability)
      .filter((c) => (Object.values(PosProviderCapability) as string[]).includes(c));
  }

  private mapIntegration(record: any): IntegrationRecord {
    return {
      id: record.id,
      campgroundId: record.campgroundId,
      provider: record.provider,
      displayName: record.displayName,
      status: record.status,
      capabilities: record.capabilities ?? [],
      credentials: record.credentials ?? {},
      locations: record.locations ?? undefined,
      devices: record.devices ?? undefined,
      webhookSecret: record.webhookSecret ?? null
    };
  }

  private getAdapter(provider: PosProviderType): PosProviderAdapter {
    const adapter = this.registry.getAdapter(provider);
    if (!adapter) throw new BadRequestException("Provider adapter not registered");
    return adapter;
  }

  async listIntegrations(campgroundId: string) {
    const records = await (this.prisma as any).posProviderIntegration.findMany({ where: { campgroundId } });
    return records.map((r: any) => this.mapIntegration(r));
  }

  async upsertIntegration(campgroundId: string, providerInput: string, dto: any, actor?: any) {
    const provider = this.normalizeProvider(providerInput);
    const capabilities = this.normalizeCapabilities(dto.capabilities);
    const status =
      dto.enabled === false ? PosIntegrationStatus.disabled : dto.enabled === true ? PosIntegrationStatus.enabled : undefined;

    const integration = await (this.prisma as any).posProviderIntegration.upsert({
      where: { campgroundId_provider: { campgroundId, provider } },
      create: {
        campgroundId,
        provider,
        displayName: dto.displayName ?? provider,
        capabilities,
        credentials: dto.credentials ?? {},
        locations: dto.locations ?? {},
        devices: dto.devices ?? {},
        webhookSecret: dto.webhookSecret ?? null,
        status: status ?? PosIntegrationStatus.enabled,
        lastValidatedAt: new Date()
      },
      update: {
        displayName: dto.displayName ?? undefined,
        capabilities,
        credentials: dto.credentials ?? {},
        locations: dto.locations ?? {},
        devices: dto.devices ?? {},
        webhookSecret: dto.webhookSecret ?? undefined,
        status: status ?? undefined,
        lastValidatedAt: new Date()
      }
    });

    await this.audit.record({
      campgroundId,
      actorId: actor?.id ?? null,
      action: "pos.provider.upsert",
      entity: "pos_provider",
      entityId: integration.id,
      after: { provider, capabilities, status: integration.status }
    });

    return this.mapIntegration(integration);
  }

  async validateCredentials(campgroundId: string, providerInput: string, payload: any) {
    const provider = this.normalizeProvider(providerInput);
    const adapter = this.getAdapter(provider);
    const capabilities = this.normalizeCapabilities(payload.capabilities);
    const integration: IntegrationRecord = {
      id: payload.id ?? `temp-${provider}`,
      campgroundId,
      provider,
      capabilities,
      credentials: payload.credentials ?? {},
      locations: payload.locations ?? {},
      devices: payload.devices ?? {},
      webhookSecret: payload.webhookSecret ?? null
    };

    const result: ProviderValidationResult = await adapter.validateCredentials(integration);

    await (this.prisma as any).posProviderIntegration.updateMany({
      where: { campgroundId, provider },
      data: {
        lastValidatedAt: new Date(),
        status: result.ok ? PosIntegrationStatus.enabled : PosIntegrationStatus.error
      }
    });

    return result;
  }

  async syncIntegration(campgroundId: string, providerInput: string, target: PosSyncTarget) {
    const provider = this.normalizeProvider(providerInput);
    const integration = await (this.prisma as any).posProviderIntegration.findUnique({
      where: { campgroundId_provider: { campgroundId, provider } }
    });
    if (!integration) throw new NotFoundException("Integration not configured");

    const adapter = this.getAdapter(provider);
    const record = this.mapIntegration(integration);
    const result: ProviderSyncResult =
      target === PosSyncTarget.catalog ? await adapter.syncCatalog(record) : await adapter.syncTenders(record);

    const syncStatus = result.status ?? PosSyncStatus.running;
    const syncPayload = {
      status: syncStatus,
      lastRunAt: new Date(),
      lastError: syncStatus === PosSyncStatus.failed ? result.message ?? "sync_failed" : null,
      metadata: result.metadata ?? null
    };

    await (this.prisma as any).posProviderSync.upsert({
      where: { integrationId_type: { integrationId: integration.id, type: target } },
      create: {
        integrationId: integration.id,
        type: target,
        ...syncPayload
      },
      update: syncPayload
    });

    return { integration: record, result };
  }

  async syncStatus(campgroundId: string, providerInput?: string) {
    const provider = providerInput ? this.normalizeProvider(providerInput) : null;
    return (this.prisma as any).posProviderSync.findMany({
      where: {
        integration: {
          campgroundId,
          provider: provider ?? undefined
        }
      },
      include: { integration: true },
      orderBy: { updatedAt: "desc" },
      take: 20
    });
  }

  async routePayment(
    campgroundId: string | null,
    terminalId: string | null | undefined,
    payment: ProviderPaymentRequest
  ): Promise<(ProviderPaymentResult & { provider: PosProviderType }) | null> {
    if (!campgroundId) return null;
    const integration = await (this.prisma as any).posProviderIntegration.findFirst({
      where: {
        campgroundId,
        status: PosIntegrationStatus.enabled,
        capabilities: { has: PosProviderCapability.payments }
      }
    });
    if (!integration) return null;

    const adapter = this.getAdapter(integration.provider);
    const result = await adapter.processPayment(this.mapIntegration(integration), { ...payment, terminalId });
    if (!result) return null;

    await this.audit.record({
      campgroundId,
      actorId: null,
      action: "pos.provider.payment_routed",
      entity: "pos_provider",
      entityId: integration.id,
      after: { provider: integration.provider, status: result.status }
    });

    return { ...result, provider: integration.provider };
  }

  async handleWebhook(
    providerInput: string,
    campgroundId: string,
    body: any,
    headers: Record<string, any> = {},
    rawBody?: string
  ): Promise<ProviderWebhookResult> {
    const provider = this.normalizeProvider(providerInput);
    const integrationRecord = await (this.prisma as any).posProviderIntegration.findUnique({
      where: { campgroundId_provider: { campgroundId, provider } }
    });
    if (!integrationRecord) throw new NotFoundException("Integration not configured");

    const integration = this.mapIntegration(integrationRecord);
    const adapter = this.getAdapter(provider);
    const signature =
      headers["x-pos-signature"] ??
      headers["x-square-signature"] ??
      headers["x-clover-signature"] ??
      headers["x-toast-signature"] ??
      "";

    const raw = rawBody || JSON.stringify(body ?? {});
    const verified = await adapter.verifyWebhookSignature({
      signature,
      rawBody: raw,
      secret: integration.webhookSecret ?? (integration.credentials as any)?.webhookSecret ?? null,
      integration
    });
    if (!verified) {
      throw new UnauthorizedException("Invalid webhook signature");
    }

    const eventId = headers["x-event-id"] ?? (body?.eventId ?? body?.id ?? body?.data?.id);
    const idempotencyKey = eventId ? `pos-webhook-${provider}-${eventId}` : null;
    if (idempotencyKey) {
      const existing = await this.idempotency
        .start(idempotencyKey, body ?? {}, campgroundId, {
          endpoint: `pos/providers/${provider}/webhook`,
          sequence: eventId ?? undefined,
          rateAction: "apply"
        })
        .catch((err) => {
          this.logger.warn(`Idempotency start failed: ${err?.message ?? err}`);
          return null;
        });
      if (existing?.status === IdempotencyStatus.succeeded && existing.responseJson) {
        return { ...(existing.responseJson as any), deduped: true };
      }
      if (existing?.status === IdempotencyStatus.inflight) {
        return { acknowledged: false, deduped: true, message: "webhook_inflight" };
      }
    }

    const result = adapter.handlePaymentWebhook
      ? await adapter.handlePaymentWebhook({ integration, body, headers })
      : { acknowledged: true, message: "webhook_acknowledged" };

    if (idempotencyKey) {
      await this.idempotency.complete(idempotencyKey, result).catch(() => null);
    }

    return result;
  }
}
