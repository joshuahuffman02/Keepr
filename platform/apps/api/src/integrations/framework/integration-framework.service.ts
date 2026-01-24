import { Injectable, Logger, BadRequestException, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { CredentialEncryptionService } from "./credential-encryption.service";
import { Prisma } from "@prisma/client";
import { randomUUID } from "crypto";
import {
  IntegrationProvider,
  IntegrationCredentials,
  SyncResult,
  WebhookPayload,
  WebhookResult,
  OAuthUrlResult,
} from "./integration-provider.interface";

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const toStringValue = (value: unknown): string | undefined =>
  typeof value === "string" ? value : undefined;

const toNullableJsonInput = (
  value: unknown,
): Prisma.InputJsonValue | Prisma.NullTypes.DbNull | undefined => {
  if (value === undefined) return undefined;
  if (value === null) return Prisma.DbNull;
  try {
    return JSON.parse(JSON.stringify(value));
  } catch {
    return undefined;
  }
};

/**
 * Integration Framework Service
 *
 * Core service for managing marketplace integrations.
 * Handles connection lifecycle, credential management, and sync orchestration.
 */
@Injectable()
export class IntegrationFrameworkService {
  private readonly logger = new Logger(IntegrationFrameworkService.name);
  private readonly providers = new Map<string, IntegrationProvider>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly encryption: CredentialEncryptionService,
  ) {}

  /**
   * Register an integration provider
   */
  registerProvider(provider: IntegrationProvider): void {
    this.providers.set(provider.slug, provider);
    this.logger.log(`Registered integration provider: ${provider.slug}`);
  }

  /**
   * Get a registered provider by slug
   */
  getProvider(slug: string): IntegrationProvider | undefined {
    return this.providers.get(slug);
  }

  /**
   * Get all registered providers
   */
  getRegisteredProviders(): IntegrationProvider[] {
    return Array.from(this.providers.values());
  }

  /**
   * Initiate OAuth flow for an integration
   */
  async initiateOAuth(
    campgroundId: string,
    slug: string,
    redirectUri: string,
  ): Promise<OAuthUrlResult> {
    const definition = await this.getDefinitionBySlug(slug);
    if (definition.authType !== "oauth2") {
      throw new BadRequestException(`Integration ${slug} does not support OAuth`);
    }

    const provider = this.getProvider(slug);
    if (!provider?.initiateOAuth) {
      throw new BadRequestException(`OAuth not implemented for ${slug}`);
    }

    const state = this.encryption.generateOAuthState({ campgroundId, provider: slug });
    return provider.initiateOAuth(campgroundId, redirectUri, state);
  }

  /**
   * Handle OAuth callback
   */
  async handleOAuthCallback(
    slug: string,
    code: string,
    state: string,
    redirectUri: string,
  ): Promise<{ success: boolean; connectionId?: string; error?: string }> {
    const stateData = this.encryption.parseOAuthState(state);
    if (!stateData) {
      return { success: false, error: "invalid_state" };
    }

    const provider = this.getProvider(slug);
    if (!provider?.handleOAuthCallback) {
      return { success: false, error: "oauth_not_supported" };
    }

    try {
      const result = await provider.handleOAuthCallback(code, state, redirectUri);
      if (!result.success || !result.credentials) {
        return { success: false, error: result.error || "oauth_failed" };
      }

      // Store the connection
      const connection = await this.createOrUpdateConnection(
        stateData.campgroundId,
        slug,
        result.credentials,
        {},
      );

      return { success: true, connectionId: connection.id };
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.logger.error(`OAuth callback error for ${slug}`, err.stack);
      return { success: false, error: err.message };
    }
  }

  /**
   * Connect an integration with API key or other credentials
   */
  async connect(
    campgroundId: string,
    slug: string,
    credentials: IntegrationCredentials,
    config?: Record<string, unknown>,
  ): Promise<{ success: boolean; connectionId?: string; error?: string }> {
    const definition = await this.getDefinitionBySlug(slug);
    const provider = this.getProvider(slug);

    // Validate credentials if provider is available
    if (provider) {
      const isValid = await provider.validateCredentials(credentials);
      if (!isValid) {
        return { success: false, error: "invalid_credentials" };
      }

      const connectResult = await provider.connect(campgroundId, credentials, config);
      if (!connectResult.success) {
        return { success: false, error: connectResult.error };
      }
    }

    const connection = await this.createOrUpdateConnection(
      campgroundId,
      slug,
      credentials,
      config || {},
    );

    // Log the connection
    await this.recordSyncLog(connection.id, {
      syncType: "manual",
      direction: "outbound",
      status: "success",
      recordsProcessed: 0,
      recordsFailed: 0,
      triggeredBy: "system",
      metadata: { action: "connect" },
    });

    return { success: true, connectionId: connection.id };
  }

  /**
   * Disconnect an integration
   */
  async disconnect(campgroundId: string, slug: string): Promise<{ success: boolean }> {
    const connection = await this.prisma.marketplaceConnection.findUnique({
      where: {
        campgroundId_definitionId: { campgroundId, definitionId: await this.getDefinitionId(slug) },
      },
    });

    if (!connection) {
      throw new NotFoundException(`Connection not found for ${slug}`);
    }

    const provider = this.getProvider(slug);
    if (provider) {
      await provider.disconnect(campgroundId);
    }

    await this.prisma.marketplaceConnection.update({
      where: { id: connection.id },
      data: {
        status: "disconnected",
        credentials: Prisma.DbNull,
        lastSyncAt: new Date(),
        lastSyncStatus: "disconnected",
      },
    });

    return { success: true };
  }

  /**
   * Trigger a sync for an integration
   */
  async triggerSync(
    connectionId: string,
    options: {
      syncType?: "full" | "incremental";
      direction?: "inbound" | "outbound" | "bidirectional";
      entityTypes?: string[];
    } = {},
  ): Promise<SyncResult> {
    const connection = await this.prisma.marketplaceConnection.findUnique({
      where: { id: connectionId },
      include: { IntegrationDefinition: true },
    });

    if (!connection) {
      throw new NotFoundException("Connection not found");
    }

    if (connection.status !== "connected") {
      throw new BadRequestException("Integration is not connected");
    }

    const provider = this.getProvider(connection.IntegrationDefinition.slug);
    if (!provider) {
      throw new BadRequestException(
        `Provider ${connection.IntegrationDefinition.slug} not available`,
      );
    }

    // Decrypt credentials
    const credentials = this.decryptCredentials(connection.credentials);

    // Check if tokens need refresh
    if (credentials.oauth?.expiresAt && credentials.oauth.expiresAt < Date.now()) {
      if (provider.refreshToken) {
        const refreshed = await provider.refreshToken(credentials);
        await this.updateCredentials(connectionId, refreshed);
        Object.assign(credentials, refreshed);
      }
    }

    const syncType = options.syncType || "incremental";
    const direction = options.direction || "bidirectional";

    // Record sync start
    const log = await this.recordSyncLog(connectionId, {
      syncType,
      direction,
      status: "running",
      recordsProcessed: 0,
      recordsFailed: 0,
      triggeredBy: "manual",
    });

    try {
      const result = await provider.sync(connection.campgroundId, credentials, {
        syncType,
        direction,
        entityTypes: options.entityTypes,
        since: syncType === "incremental" ? connection.lastSyncAt || undefined : undefined,
      });

      // Update connection status
      await this.prisma.marketplaceConnection.update({
        where: { id: connectionId },
        data: {
          lastSyncAt: new Date(),
          lastSyncStatus: result.success ? "success" : "failed",
          errorMessage: result.success ? null : result.errors?.[0]?.message,
        },
      });

      // Update sync log
      await this.prisma.marketplaceSyncLog.update({
        where: { id: log.id },
        data: {
          status: result.success ? "success" : result.recordsFailed > 0 ? "partial" : "failed",
          recordsProcessed: result.recordsProcessed,
          recordsFailed: result.recordsFailed,
          recordsSkipped: result.recordsSkipped,
          completedAt: new Date(),
          errorDetails: toNullableJsonInput(result.errors ?? null),
          summary: toNullableJsonInput(result.summary ?? null),
        },
      });

      return result;
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      // Update sync log with error
      await this.prisma.marketplaceSyncLog.update({
        where: { id: log.id },
        data: {
          status: "failed",
          completedAt: new Date(),
          errorDetails: toNullableJsonInput([{ message: err.message }]),
        },
      });

      await this.prisma.marketplaceConnection.update({
        where: { id: connectionId },
        data: {
          lastSyncAt: new Date(),
          lastSyncStatus: "failed",
          errorMessage: err.message,
        },
      });

      throw error;
    }
  }

  /**
   * Handle incoming webhook
   */
  async handleWebhook(
    slug: string,
    payload: unknown,
    rawBody: string,
    signature?: string,
    campgroundId?: string,
  ): Promise<WebhookResult> {
    const provider = this.getProvider(slug);
    if (!provider?.handleWebhook) {
      this.logger.warn(`No webhook handler for ${slug}`);
      return { handled: false, error: "no_handler" };
    }

    // Find connection to get webhook secret
    let connection = null;
    if (campgroundId) {
      connection = await this.prisma.marketplaceConnection.findFirst({
        where: {
          campgroundId,
          IntegrationDefinition: { slug },
        },
      });
    }

    // Verify signature if connection has webhook secret
    if (connection?.webhookSecret && signature) {
      const isValid = this.encryption.verifyHmacSignature(
        rawBody,
        connection.webhookSecret,
        signature,
      );
      if (!isValid) {
        this.logger.warn(`Invalid webhook signature for ${slug}`);
        return { handled: false, error: "invalid_signature" };
      }
    }

    try {
      const credentials = connection ? this.decryptCredentials(connection.credentials) : {};

      const webhookPayload: WebhookPayload = {
        provider: slug,
        eventType:
          toStringValue(isRecord(payload) ? payload.type : undefined) ??
          toStringValue(isRecord(payload) ? payload.event : undefined) ??
          "unknown",
        payload,
        signature,
        timestamp: Date.now(),
      };

      const result = await provider.handleWebhook(webhookPayload, credentials);

      // Log the webhook
      if (connection) {
        await this.recordSyncLog(connection.id, {
          syncType: "webhook",
          direction: "inbound",
          status: result.handled ? "success" : "failed",
          recordsProcessed: result.entitiesAffected || 0,
          recordsFailed: result.handled ? 0 : 1,
          triggeredBy: "webhook",
          metadata: { eventType: webhookPayload.eventType },
        });
      }

      return result;
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.logger.error(`Webhook handler error for ${slug}`, err.stack);
      return { handled: false, error: err.message };
    }
  }

  /**
   * Test a connection
   */
  async testConnection(connectionId: string): Promise<{
    success: boolean;
    message?: string;
    details?: Record<string, unknown>;
  }> {
    const connection = await this.prisma.marketplaceConnection.findUnique({
      where: { id: connectionId },
      include: { IntegrationDefinition: true },
    });

    if (!connection) {
      throw new NotFoundException("Connection not found");
    }

    const provider = this.getProvider(connection.IntegrationDefinition.slug);
    if (!provider) {
      return { success: false, message: "Provider not available" };
    }

    const credentials = this.decryptCredentials(connection.credentials);
    return provider.testConnection(credentials);
  }

  /**
   * Get connection status for a campground
   */
  async getConnectionStatus(
    campgroundId: string,
    slug: string,
  ): Promise<{
    connected: boolean;
    status?: string;
    lastSyncAt?: Date;
    lastSyncStatus?: string;
    errorMessage?: string;
  }> {
    const definitionId = await this.getDefinitionId(slug);
    const connection = await this.prisma.marketplaceConnection.findUnique({
      where: { campgroundId_definitionId: { campgroundId, definitionId } },
    });

    if (!connection) {
      return { connected: false };
    }

    return {
      connected: connection.status === "connected",
      status: connection.status,
      lastSyncAt: connection.lastSyncAt || undefined,
      lastSyncStatus: connection.lastSyncStatus || undefined,
      errorMessage: connection.errorMessage || undefined,
    };
  }

  // Private helper methods

  private async getDefinitionBySlug(slug: string) {
    const definition = await this.prisma.integrationDefinition.findUnique({
      where: { slug },
    });
    if (!definition) {
      throw new NotFoundException(`Integration ${slug} not found`);
    }
    if (!definition.isActive) {
      throw new BadRequestException(`Integration ${slug} is not active`);
    }
    return definition;
  }

  private async getDefinitionId(slug: string): Promise<string> {
    const definition = await this.prisma.integrationDefinition.findUnique({
      where: { slug },
      select: { id: true },
    });
    if (!definition) {
      throw new NotFoundException(`Integration ${slug} not found`);
    }
    return definition.id;
  }

  private async createOrUpdateConnection(
    campgroundId: string,
    slug: string,
    credentials: IntegrationCredentials,
    config: Record<string, unknown>,
  ) {
    const definitionId = await this.getDefinitionId(slug);
    const encryptedCredentials = this.encryption.encrypt(credentials);
    const webhookSecret = this.encryption.generateWebhookSecret();

    return this.prisma.marketplaceConnection.upsert({
      where: { campgroundId_definitionId: { campgroundId, definitionId } },
      create: {
        id: randomUUID(),
        updatedAt: new Date(),
        campgroundId,
        definitionId,
        status: "connected",
        credentials: toNullableJsonInput(encryptedCredentials),
        config: toNullableJsonInput(config),
        webhookSecret,
        lastSyncAt: new Date(),
        lastSyncStatus: "connected",
      },
      update: {
        status: "connected",
        credentials: toNullableJsonInput(encryptedCredentials),
        config: toNullableJsonInput(config),
        errorMessage: null,
        errorCode: null,
        lastSyncAt: new Date(),
        lastSyncStatus: "connected",
      },
    });
  }

  private async updateCredentials(connectionId: string, credentials: IntegrationCredentials) {
    const encrypted = this.encryption.encrypt(credentials);
    await this.prisma.marketplaceConnection.update({
      where: { id: connectionId },
      data: { credentials: toNullableJsonInput(encrypted) },
    });
  }

  private decryptCredentials(encrypted: unknown): IntegrationCredentials {
    if (!encrypted) return {};
    if (typeof encrypted === "string") {
      return this.encryption.decrypt(encrypted);
    }
    // If already an object (e.g., from old format), return as-is
    if (isRecord(encrypted)) return encrypted;
    return {};
  }

  private async recordSyncLog(
    connectionId: string,
    data: {
      syncType: string;
      direction: string;
      status: string;
      recordsProcessed: number;
      recordsFailed: number;
      triggeredBy?: string;
      metadata?: Record<string, unknown>;
    },
  ) {
    return this.prisma.marketplaceSyncLog.create({
      data: {
        id: randomUUID(),
        connectionId,
        syncType: data.syncType,
        direction: data.direction,
        status: data.status,
        recordsProcessed: data.recordsProcessed,
        recordsFailed: data.recordsFailed,
        triggeredBy: data.triggeredBy,
        metadata: toNullableJsonInput(data.metadata ?? null),
        startedAt: new Date(),
        completedAt: data.status !== "running" ? new Date() : null,
      },
    });
  }
}
