import { PosProviderCapability, PosProviderType, PosSyncStatus, PosSyncTarget } from "@prisma/client";

export type ProviderCapabilities = PosProviderCapability[];

export type IntegrationRecord = {
  id: string;
  campgroundId: string;
  provider: PosProviderType;
  displayName?: string | null;
  status?: string | null;
  capabilities: ProviderCapabilities;
  credentials: Record<string, any>;
  locations?: Record<string, string>;
  devices?: Record<string, string>;
  webhookSecret?: string | null;
};

export type ProviderValidationResult = {
  ok: boolean;
  message?: string;
  details?: Record<string, any>;
};

export type ProviderSyncResult = {
  started: boolean;
  target: PosSyncTarget;
  status?: PosSyncStatus;
  message?: string;
  metadata?: Record<string, any>;
};

export type ProviderPaymentRequest = {
  amountCents: number;
  currency: string;
  idempotencyKey: string;
  cartId: string;
  terminalId?: string | null;
  metadata?: Record<string, any>;
};

export type ProviderPaymentResult = {
  status: "pending" | "succeeded" | "failed";
  processorIds?: Record<string, any> | null;
  raw?: any;
};

export type ProviderWebhookVerification = {
  signature: string;
  rawBody: string;
  secret?: string | null;
  integration: IntegrationRecord;
};

export type ProviderWebhookResult = {
  acknowledged: boolean;
  deduped?: boolean;
  message?: string;
  context?: Record<string, any>;
};

export interface PosProviderAdapter {
  readonly provider: PosProviderType;
  validateCredentials(config: IntegrationRecord): Promise<ProviderValidationResult>;
  syncCatalog(config: IntegrationRecord): Promise<ProviderSyncResult>;
  syncTenders(config: IntegrationRecord): Promise<ProviderSyncResult>;
  processPayment(
    config: IntegrationRecord,
    request: ProviderPaymentRequest
  ): Promise<ProviderPaymentResult | null>;
  verifyWebhookSignature(input: ProviderWebhookVerification): Promise<boolean> | boolean;
  handlePaymentWebhook?(input: {
    integration: IntegrationRecord;
    body: any;
    headers?: Record<string, any>;
  }): Promise<ProviderWebhookResult>;
}
