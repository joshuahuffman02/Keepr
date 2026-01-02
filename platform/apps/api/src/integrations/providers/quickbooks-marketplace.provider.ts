import {
  BadGatewayException,
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
  OnModuleInit,
} from "@nestjs/common";
import {
  IntegrationProvider,
  IntegrationCredentials,
  SyncResult,
  WebhookPayload,
  WebhookResult,
  OAuthUrlResult,
  OAuthCallbackResult,
} from "../framework/integration-provider.interface";
import { IntegrationFrameworkService } from "../framework/integration-framework.service";
import { PrismaService } from "../../prisma/prisma.service";

/**
 * QuickBooks Marketplace Provider
 *
 * Implements the IntegrationProvider interface for QuickBooks Online.
 * Handles OAuth flow, token refresh, and data synchronization.
 */
@Injectable()
export class QuickBooksMarketplaceProvider implements IntegrationProvider, OnModuleInit {
  readonly slug = "quickbooks";
  readonly name = "QuickBooks Online";

  private readonly logger = new Logger(QuickBooksMarketplaceProvider.name);

  // OAuth configuration
  private readonly authUrl = "https://appcenter.intuit.com/connect/oauth2";
  private readonly tokenUrl = "https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer";
  private readonly apiBase = "https://quickbooks.api.intuit.com/v3/company";
  private readonly sandboxApiBase = "https://sandbox-quickbooks.api.intuit.com/v3/company";
  private readonly scopes = ["com.intuit.quickbooks.accounting"];

  constructor(
    private readonly framework: IntegrationFrameworkService,
    private readonly prisma: PrismaService
  ) {}

  onModuleInit() {
    // Register this provider with the framework
    this.framework.registerProvider(this);
    this.logger.log("QuickBooks marketplace provider registered");
  }

  /**
   * Initiate OAuth flow
   */
  async initiateOAuth(
    campgroundId: string,
    redirectUri: string,
    state?: string
  ): Promise<OAuthUrlResult> {
    const clientId = process.env.QUICKBOOKS_CLIENT_ID || process.env.QBO_CLIENT_ID;

    if (!clientId) {
      throw new InternalServerErrorException("QuickBooks client ID not configured");
    }

    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: "code",
      scope: this.scopes.join(" "),
      state: state || "",
    });

    return {
      authorizationUrl: `${this.authUrl}?${params.toString()}`,
      state: state || "",
    };
  }

  /**
   * Handle OAuth callback
   */
  async handleOAuthCallback(
    code: string,
    state: string,
    redirectUri: string
  ): Promise<OAuthCallbackResult> {
    const clientId = process.env.QUICKBOOKS_CLIENT_ID || process.env.QBO_CLIENT_ID;
    const clientSecret = process.env.QUICKBOOKS_CLIENT_SECRET || process.env.QBO_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      return { success: false, error: "QuickBooks credentials not configured" };
    }

    try {
      const basicAuth = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");

      const response = await fetch(this.tokenUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Accept: "application/json",
          Authorization: `Basic ${basicAuth}`,
        },
        body: new URLSearchParams({
          grant_type: "authorization_code",
          code,
          redirect_uri: redirectUri,
        }).toString(),
      });

      if (!response.ok) {
        const errorText = await response.text();
        this.logger.error(`OAuth token exchange failed: ${errorText}`);
        return { success: false, error: "token_exchange_failed" };
      }

      const tokens = await response.json();

      return {
        success: true,
        credentials: {
          oauth: {
            accessToken: tokens.access_token,
            refreshToken: tokens.refresh_token,
            expiresAt: tokens.expires_in
              ? Date.now() + tokens.expires_in * 1000
              : undefined,
            tokenType: tokens.token_type,
            realmId: tokens.realmId,
          },
        },
      };
    } catch (error) {
      this.logger.error(`OAuth callback error: ${(error as Error).message}`);
      return { success: false, error: (error as Error).message };
    }
  }

  /**
   * Refresh expired tokens
   */
  async refreshToken(credentials: IntegrationCredentials): Promise<IntegrationCredentials> {
    const clientId = process.env.QUICKBOOKS_CLIENT_ID || process.env.QBO_CLIENT_ID;
    const clientSecret = process.env.QUICKBOOKS_CLIENT_SECRET || process.env.QBO_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      throw new InternalServerErrorException("QuickBooks credentials not configured");
    }

    if (!credentials.oauth?.refreshToken) {
      throw new BadRequestException("No refresh token available");
    }

    const basicAuth = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");

    const response = await fetch(this.tokenUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json",
        Authorization: `Basic ${basicAuth}`,
      },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: credentials.oauth.refreshToken,
      }).toString(),
    });

    if (!response.ok) {
      throw new BadGatewayException("Token refresh failed");
    }

    const tokens = await response.json();

    return {
      ...credentials,
      oauth: {
        ...credentials.oauth,
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token || credentials.oauth.refreshToken,
        expiresAt: tokens.expires_in
          ? Date.now() + tokens.expires_in * 1000
          : credentials.oauth.expiresAt,
      },
    };
  }

  /**
   * Validate credentials by making a test API call
   */
  async validateCredentials(credentials: IntegrationCredentials): Promise<boolean> {
    if (!credentials.oauth?.accessToken || !credentials.oauth?.realmId) {
      return false;
    }

    try {
      const apiBase = this.getApiBase();
      const response = await fetch(
        `${apiBase}/${credentials.oauth.realmId}/companyinfo/${credentials.oauth.realmId}`,
        {
          headers: {
            Accept: "application/json",
            Authorization: `Bearer ${credentials.oauth.accessToken}`,
          },
        }
      );

      return response.ok;
    } catch {
      return false;
    }
  }

  /**
   * Connect (called after OAuth completes)
   */
  async connect(
    campgroundId: string,
    credentials: IntegrationCredentials,
    config?: Record<string, unknown>
  ): Promise<{ success: boolean; error?: string }> {
    // Validate the connection works
    const isValid = await this.validateCredentials(credentials);
    if (!isValid) {
      return { success: false, error: "invalid_credentials" };
    }

    this.logger.log(`QuickBooks connected for campground ${campgroundId}`);
    return { success: true };
  }

  /**
   * Disconnect
   */
  async disconnect(campgroundId: string): Promise<{ success: boolean }> {
    // QuickBooks doesn't require explicit disconnect
    // Just clearing credentials is sufficient
    this.logger.log(`QuickBooks disconnected for campground ${campgroundId}`);
    return { success: true };
  }

  /**
   * Perform sync operation
   */
  async sync(
    campgroundId: string,
    credentials: IntegrationCredentials,
    options: {
      syncType: "full" | "incremental";
      direction: "inbound" | "outbound" | "bidirectional";
      entityTypes?: string[];
      since?: Date;
    }
  ): Promise<SyncResult> {
    const realmId = credentials.oauth?.realmId;
    const accessToken = credentials.oauth?.accessToken;

    if (!realmId || !accessToken) {
      return {
        success: false,
        recordsProcessed: 0,
        recordsFailed: 0,
        recordsSkipped: 0,
        errors: [{ entityType: "auth", entityId: "", message: "Missing credentials" }],
      };
    }

    const entityTypes = options.entityTypes || ["payments", "reservations"];
    let totalProcessed = 0;
    let totalFailed = 0;
    let totalSkipped = 0;
    const errors: SyncResult["errors"] = [];
    const summary = { created: 0, updated: 0, deleted: 0 };

    // Sync outbound: push data to QuickBooks
    if (options.direction === "outbound" || options.direction === "bidirectional") {
      if (entityTypes.includes("payments")) {
        const paymentResult = await this.syncPaymentsToQuickBooks(
          campgroundId,
          credentials,
          options.since
        );
        totalProcessed += paymentResult.processed;
        totalFailed += paymentResult.failed;
        totalSkipped += paymentResult.skipped;
        summary.created += paymentResult.created;
        summary.updated += paymentResult.updated;
        if (paymentResult.errors) {
          errors.push(...paymentResult.errors);
        }
      }

      if (entityTypes.includes("reservations")) {
        const reservationResult = await this.syncReservationsToQuickBooks(
          campgroundId,
          credentials,
          options.since
        );
        totalProcessed += reservationResult.processed;
        totalFailed += reservationResult.failed;
        totalSkipped += reservationResult.skipped;
        summary.created += reservationResult.created;
        summary.updated += reservationResult.updated;
        if (reservationResult.errors) {
          errors.push(...reservationResult.errors);
        }
      }
    }

    return {
      success: totalFailed === 0,
      recordsProcessed: totalProcessed,
      recordsFailed: totalFailed,
      recordsSkipped: totalSkipped,
      errors: errors.length > 0 ? errors : undefined,
      summary,
    };
  }

  /**
   * Handle incoming webhook
   */
  async handleWebhook(
    payload: WebhookPayload,
    credentials: IntegrationCredentials
  ): Promise<WebhookResult> {
    this.logger.log(`Received QuickBooks webhook: ${payload.eventType}`);

    // QuickBooks webhooks are primarily for notifications
    // Most sync happens outbound from Campreserv to QuickBooks
    switch (payload.eventType) {
      case "payment.created":
      case "payment.updated":
        // Could trigger a reconciliation check
        return { handled: true, eventType: payload.eventType, entitiesAffected: 1 };

      case "invoice.updated":
      case "invoice.deleted":
        // Could update local records
        return { handled: true, eventType: payload.eventType, entitiesAffected: 1 };

      default:
        this.logger.debug(`Unhandled QuickBooks webhook type: ${payload.eventType}`);
        return { handled: false, eventType: payload.eventType };
    }
  }

  /**
   * Get configuration schema
   */
  getConfigSchema(): Record<string, unknown> {
    return {
      type: "object",
      properties: {
        defaultIncomeAccount: {
          type: "string",
          title: "Default Income Account",
          description: "QuickBooks account for reservation income",
        },
        defaultAssetAccount: {
          type: "string",
          title: "Default Asset Account",
          description: "QuickBooks account for undeposited funds",
        },
        autoCreateCustomers: {
          type: "boolean",
          title: "Auto-create Customers",
          description: "Automatically create QuickBooks customers from guests",
          default: true,
        },
        syncPayments: {
          type: "boolean",
          title: "Sync Payments",
          description: "Sync payments to QuickBooks",
          default: true,
        },
        syncInvoices: {
          type: "boolean",
          title: "Create Invoices",
          description: "Create QuickBooks invoices for reservations",
          default: true,
        },
      },
    };
  }

  /**
   * Test the connection
   */
  async testConnection(credentials: IntegrationCredentials): Promise<{
    success: boolean;
    message?: string;
    details?: Record<string, unknown>;
  }> {
    if (!credentials.oauth?.accessToken || !credentials.oauth?.realmId) {
      return {
        success: false,
        message: "Missing OAuth credentials",
      };
    }

    try {
      const apiBase = this.getApiBase();
      const response = await fetch(
        `${apiBase}/${credentials.oauth.realmId}/companyinfo/${credentials.oauth.realmId}`,
        {
          headers: {
            Accept: "application/json",
            Authorization: `Bearer ${credentials.oauth.accessToken}`,
          },
        }
      );

      if (!response.ok) {
        return {
          success: false,
          message: `API returned ${response.status}`,
        };
      }

      const data = await response.json();
      const companyInfo = data.CompanyInfo || {};

      return {
        success: true,
        message: `Connected to ${companyInfo.CompanyName || "QuickBooks"}`,
        details: {
          companyName: companyInfo.CompanyName,
          companyAddr: companyInfo.CompanyAddr,
          country: companyInfo.Country,
        },
      };
    } catch (error) {
      return {
        success: false,
        message: (error as Error).message,
      };
    }
  }

  // ========================================
  // Private Helper Methods
  // ========================================

  private getApiBase(): string {
    const useSandbox = process.env.QUICKBOOKS_SANDBOX === "true" ||
      process.env.QBO_SANDBOX === "true" ||
      process.env.NODE_ENV !== "production";
    return useSandbox ? this.sandboxApiBase : this.apiBase;
  }

  /**
   * Sync payments from Campreserv to QuickBooks as Payment records
   */
  private async syncPaymentsToQuickBooks(
    campgroundId: string,
    credentials: IntegrationCredentials,
    since?: Date
  ): Promise<{
    processed: number;
    failed: number;
    skipped: number;
    created: number;
    updated: number;
    errors?: Array<{ entityType: string; entityId: string; message: string }>;
  }> {
    // Stub implementation - would query payments and create QuickBooks payments
    this.logger.log(`Syncing payments to QuickBooks for campground ${campgroundId}`);

    // In a real implementation:
    // 1. Query payments from Prisma where campgroundId matches and createdAt > since
    // 2. For each payment, check if it already exists in QuickBooks (via external ID mapping)
    // 3. Create or update the Payment in QuickBooks
    // 4. Store the QuickBooks ID for future reference

    // For now, return a stub response
    return {
      processed: 0,
      failed: 0,
      skipped: 0,
      created: 0,
      updated: 0,
    };
  }

  /**
   * Sync reservations from Campreserv to QuickBooks as Sales Receipts or Invoices
   */
  private async syncReservationsToQuickBooks(
    campgroundId: string,
    credentials: IntegrationCredentials,
    since?: Date
  ): Promise<{
    processed: number;
    failed: number;
    skipped: number;
    created: number;
    updated: number;
    errors?: Array<{ entityType: string; entityId: string; message: string }>;
  }> {
    // Stub implementation - would query reservations and create QuickBooks sales receipts
    this.logger.log(`Syncing reservations to QuickBooks for campground ${campgroundId}`);

    // In a real implementation:
    // 1. Query reservations with status = confirmed/checked_in/checked_out
    // 2. For each reservation, get or create the Customer in QuickBooks
    // 3. Create a Sales Receipt or Invoice based on configuration
    // 4. Store the QuickBooks ID for future reference

    // For now, return a stub response
    return {
      processed: 0,
      failed: 0,
      skipped: 0,
      created: 0,
      updated: 0,
    };
  }

  /**
   * Make an authenticated request to QuickBooks API
   */
  private async makeApiRequest(
    credentials: IntegrationCredentials,
    endpoint: string,
    options: {
      method?: string;
      body?: unknown;
    } = {}
  ): Promise<Response> {
    const realmId = credentials.oauth?.realmId;
    const accessToken = credentials.oauth?.accessToken;

    if (!realmId || !accessToken) {
      throw new BadRequestException("Missing QuickBooks credentials");
    }

    const apiBase = this.getApiBase();
    const url = `${apiBase}/${realmId}/${endpoint}`;

    return fetch(url, {
      method: options.method || "GET",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: options.body ? JSON.stringify(options.body) : undefined,
    });
  }
}
