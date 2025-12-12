import { AccessCredentialType, AccessGrantStatus, AccessProviderType } from "@prisma/client";

export type AccessIntegrationConfig = {
  id: string;
  campgroundId: string;
  provider: AccessProviderType;
  displayName?: string | null;
  credentials: Record<string, any>;
  webhookSecret?: string | null;
};

export type GrantRequest = {
  reservationId: string;
  siteId?: string | null;
  guestName?: string | null;
  vehiclePlate?: string | null;
  rigType?: string | null;
  rigLength?: number | null;
  credentialType?: AccessCredentialType;
  credentialValue?: string | null;
  startsAt?: Date | null;
  endsAt?: Date | null;
  idempotencyKey?: string | null;
};

export type GrantResult = {
  providerAccessId?: string | null;
  status: AccessGrantStatus;
  message?: string | null;
};

export type RevokeRequest = {
  providerAccessId?: string | null;
  reservationId: string;
  reason?: string | null;
};

export type WebhookVerificationInput = {
  signature?: string | null;
  rawBody: string;
  secret?: string | null;
  integration: AccessIntegrationConfig;
};

export interface AccessProviderAdapter {
  readonly provider: AccessProviderType;
  provisionAccess(
    integration: AccessIntegrationConfig,
    request: GrantRequest
  ): Promise<GrantResult>;
  revokeAccess(
    integration: AccessIntegrationConfig,
    request: RevokeRequest
  ): Promise<{ status: AccessGrantStatus; message?: string | null }>;
  verifyWebhookSignature(input: WebhookVerificationInput): Promise<boolean> | boolean;
}
