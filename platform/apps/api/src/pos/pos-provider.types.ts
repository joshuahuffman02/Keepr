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

  // Outbound inventory sync methods (optional - for 3rd party POS integration)
  supportsInventorySync?(): boolean;
  pushProduct?(config: IntegrationRecord, product: ExternalProductPush): Promise<ExternalSyncResult>;
  pushInventoryUpdate?(config: IntegrationRecord, update: ExternalInventoryUpdate): Promise<ExternalSyncResult>;
  pushPriceUpdate?(config: IntegrationRecord, update: ExternalPriceUpdate): Promise<ExternalSyncResult>;
  fetchProducts?(config: IntegrationRecord): Promise<ExternalProduct[]>;
  fetchSales?(config: IntegrationRecord, since: Date): Promise<ExternalSale[]>;
}

// External product info pulled from 3rd party POS
export interface ExternalProduct {
  externalId: string;
  externalSku: string | null;
  name: string;
  priceCents: number;
  category?: string | null;
  barcode?: string | null;
  metadata?: Record<string, any>;
}

// Product info to push to 3rd party POS
export interface ExternalProductPush {
  productId: string;
  sku: string | null;
  name: string;
  priceCents: number;
  barcode?: string | null;
  category?: string | null;
  externalId?: string | null; // If updating existing
}

// Inventory update to push to 3rd party POS
export interface ExternalInventoryUpdate {
  productId: string;
  externalId: string;
  qtyOnHand: number;
  locationId?: string | null;
  externalLocationId?: string | null;
}

// Price update to push to 3rd party POS
export interface ExternalPriceUpdate {
  productId: string;
  externalId: string;
  priceCents: number;
  originalPriceCents?: number | null;
  isMarkdown?: boolean;
}

// Sale info pulled from 3rd party POS
export interface ExternalSale {
  externalTransactionId: string;
  saleDate: Date;
  items: Array<{
    externalProductId: string;
    externalSku?: string | null;
    qty: number;
    priceCents: number;
    discountCents?: number;
  }>;
  totalCents: number;
  paymentMethod?: string | null;
  metadata?: Record<string, any>;
}

// Result of push operations
export interface ExternalSyncResult {
  success: boolean;
  externalId?: string | null;
  message?: string;
  error?: string | null;
}
