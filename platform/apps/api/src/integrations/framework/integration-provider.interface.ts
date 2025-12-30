/**
 * Integration Provider Interface
 *
 * All marketplace integrations must implement this interface.
 * Provides a consistent API for connecting, syncing, and managing integrations.
 */

export interface OAuthTokens {
  accessToken: string;
  refreshToken?: string;
  expiresAt?: number; // Unix timestamp in ms
  tokenType?: string;
  scope?: string;
  // Provider-specific fields
  realmId?: string; // QuickBooks
  tenantId?: string; // Xero
  [key: string]: unknown;
}

export interface IntegrationCredentials {
  oauth?: OAuthTokens;
  apiKey?: string;
  apiSecret?: string;
  webhookSecret?: string;
  [key: string]: unknown;
}

export interface SyncResult {
  success: boolean;
  recordsProcessed: number;
  recordsFailed: number;
  recordsSkipped: number;
  errors?: Array<{
    entityType: string;
    entityId: string;
    message: string;
    code?: string;
  }>;
  summary?: {
    created: number;
    updated: number;
    deleted: number;
  };
  metadata?: Record<string, unknown>;
}

export interface WebhookPayload {
  provider: string;
  eventType: string;
  payload: unknown;
  signature?: string;
  timestamp?: number;
}

export interface WebhookResult {
  handled: boolean;
  eventType?: string;
  entitiesAffected?: number;
  error?: string;
}

export interface OAuthUrlResult {
  authorizationUrl: string;
  state: string;
}

export interface OAuthCallbackResult {
  success: boolean;
  credentials?: IntegrationCredentials;
  error?: string;
  errorDescription?: string;
}

/**
 * Base interface for all integration providers
 */
export interface IntegrationProvider {
  /**
   * Unique identifier matching IntegrationDefinition.slug
   */
  readonly slug: string;

  /**
   * Human-readable name
   */
  readonly name: string;

  /**
   * Initialize OAuth flow - returns authorization URL
   */
  initiateOAuth?(
    campgroundId: string,
    redirectUri: string,
    state?: string
  ): Promise<OAuthUrlResult>;

  /**
   * Handle OAuth callback - exchange code for tokens
   */
  handleOAuthCallback?(
    code: string,
    state: string,
    redirectUri: string
  ): Promise<OAuthCallbackResult>;

  /**
   * Refresh expired OAuth tokens
   */
  refreshToken?(credentials: IntegrationCredentials): Promise<IntegrationCredentials>;

  /**
   * Validate that credentials are still valid
   */
  validateCredentials(credentials: IntegrationCredentials): Promise<boolean>;

  /**
   * Connect the integration (called after OAuth or API key setup)
   */
  connect(
    campgroundId: string,
    credentials: IntegrationCredentials,
    config?: Record<string, unknown>
  ): Promise<{ success: boolean; error?: string }>;

  /**
   * Disconnect the integration
   */
  disconnect(campgroundId: string): Promise<{ success: boolean }>;

  /**
   * Perform a sync operation
   */
  sync(
    campgroundId: string,
    credentials: IntegrationCredentials,
    options: {
      syncType: "full" | "incremental";
      direction: "inbound" | "outbound" | "bidirectional";
      entityTypes?: string[];
      since?: Date;
    }
  ): Promise<SyncResult>;

  /**
   * Handle incoming webhook
   */
  handleWebhook?(
    payload: WebhookPayload,
    credentials: IntegrationCredentials
  ): Promise<WebhookResult>;

  /**
   * Get configuration schema for this integration
   */
  getConfigSchema?(): Record<string, unknown>;

  /**
   * Test the connection
   */
  testConnection(credentials: IntegrationCredentials): Promise<{
    success: boolean;
    message?: string;
    details?: Record<string, unknown>;
  }>;
}

/**
 * Decorator to mark a class as an integration provider
 */
export function IntegrationProviderDecorator(slug: string): ClassDecorator {
  return (target: object) => {
    Reflect.defineMetadata("integration:slug", slug, target);
  };
}
