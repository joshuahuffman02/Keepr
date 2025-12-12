import { Injectable, Logger } from "@nestjs/common";
import crypto from "crypto";
import {
  IntegrationRecord,
  PosProviderAdapter,
  ProviderPaymentRequest,
  ProviderPaymentResult,
  ProviderSyncResult,
  ProviderValidationResult,
  ProviderWebhookResult,
  ProviderWebhookVerification
} from "./pos-provider.types";

const PosProviderType = {
  clover: "clover",
  square: "square",
  toast: "toast"
} as const;
type PosProviderType = (typeof PosProviderType)[keyof typeof PosProviderType];

const PosSyncStatus = {
  running: "running",
  completed: "completed",
  failed: "failed"
} as const;
type PosSyncStatus = (typeof PosSyncStatus)[keyof typeof PosSyncStatus];

const PosSyncTarget = {
  catalog: "catalog",
  tenders: "tenders",
  orders: "orders"
} as const;
type PosSyncTarget = (typeof PosSyncTarget)[keyof typeof PosSyncTarget];

@Injectable()
abstract class BasePosProviderAdapter implements PosProviderAdapter {
  abstract readonly provider: PosProviderType;
  protected readonly logger = new Logger(BasePosProviderAdapter.name);

  async validateCredentials(config: IntegrationRecord): Promise<ProviderValidationResult> {
    const hasCredentials = Boolean(config.credentials && Object.keys(config.credentials).length);
    return {
      ok: hasCredentials,
      message: hasCredentials ? "Credentials present (stubbed validation)" : "Missing credentials"
    };
  }

  async syncCatalog(config: IntegrationRecord): Promise<ProviderSyncResult> {
    this.logger.debug(`Catalog sync requested for ${config.provider}`);
    return { started: true, target: PosSyncTarget.catalog, status: PosSyncStatus.running };
  }

  async syncTenders(config: IntegrationRecord): Promise<ProviderSyncResult> {
    this.logger.debug(`Tender sync requested for ${config.provider}`);
    return { started: true, target: PosSyncTarget.tenders, status: PosSyncStatus.running };
  }

  async processPayment(config: IntegrationRecord, request: ProviderPaymentRequest): Promise<ProviderPaymentResult | null> {
    this.logger.log(`Routing payment via ${config.provider} (stub)`);
    return {
      status: "pending",
      processorIds: {
        provider: config.provider,
        idempotencyKey: request.idempotencyKey
      },
      raw: { note: "stubbed payment response" }
    };
  }

  verifyWebhookSignature(input: ProviderWebhookVerification): boolean {
    if (!input.secret) return true;
    const digest = crypto.createHmac("sha256", input.secret).update(input.rawBody).digest("hex");
    return digest === input.signature;
  }

  async handlePaymentWebhook(input: { integration: IntegrationRecord; body: any; headers?: Record<string, any> }): Promise<ProviderWebhookResult> {
    this.logger.debug(`Webhook received for ${input.integration.provider}`);
    return { acknowledged: true, message: "stubbed_webhook_handler" };
  }
}

@Injectable()
export class CloverAdapter extends BasePosProviderAdapter {
  readonly provider = PosProviderType.clover;
}

@Injectable()
export class SquareAdapter extends BasePosProviderAdapter {
  readonly provider = PosProviderType.square;
}

@Injectable()
export class ToastAdapter extends BasePosProviderAdapter {
  readonly provider = PosProviderType.toast;
}
