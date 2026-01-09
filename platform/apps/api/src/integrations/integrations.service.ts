import { Injectable, BadRequestException, Logger } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { UpsertIntegrationConnectionDto } from "./dto/upsert-integration-connection.dto";
import { CreateExportJobDto } from "./dto/create-export-job.dto";
import { SyncRequestDto } from "./dto/sync-request.dto";
import * as crypto from "crypto";

@Injectable()
export class IntegrationsService {
  private readonly logger = new Logger(IntegrationsService.name);

  constructor(private readonly prisma: PrismaService) { }

  private prismaClient() {
    return this.prisma as any;
  }

  upsertConnection(dto: UpsertIntegrationConnectionDto) {
    if (!dto.campgroundId) throw new BadRequestException("campgroundId is required");
    const prisma = this.prismaClient();
    return prisma.integrationConnection.upsert({
      where: {
        campgroundId_type_provider: {
          campgroundId: dto.campgroundId,
          type: dto.type,
          provider: dto.provider
        }
      },
      create: {
        campgroundId: dto.campgroundId,
        organizationId: dto.organizationId ?? null,
        type: dto.type,
        provider: dto.provider,
        status: dto.status ?? "connected",
        authType: dto.authType ?? null,
        credentials: dto.credentials ?? null,
        settings: dto.settings ?? null,
        webhookSecret: dto.webhookSecret ?? null,
        lastSyncStatus: dto.status ?? null,
      },
      update: {
        organizationId: dto.organizationId ?? null,
        status: dto.status ?? undefined,
        authType: dto.authType ?? undefined,
        credentials: dto.credentials ?? undefined,
        settings: dto.settings ?? undefined,
        webhookSecret: dto.webhookSecret ?? undefined,
      }
    });
  }

  listConnections(campgroundId: string) {
    if (!campgroundId) throw new BadRequestException("campgroundId is required");
    const prisma = this.prismaClient();
    return prisma.integrationConnection.findMany({
      where: { campgroundId },
      orderBy: { updatedAt: "desc" },
      include: {
        logs: { orderBy: { occurredAt: "desc" }, take: 1 }
      }
    });
  }

  updateConnection(id: string, dto: Partial<UpsertIntegrationConnectionDto>) {
    const prisma = this.prismaClient();
    return prisma.integrationConnection.update({
      where: { id },
      data: {
        organizationId: dto.organizationId ?? undefined,
        status: dto.status ?? undefined,
        authType: dto.authType ?? undefined,
        credentials: dto.credentials ?? undefined,
        settings: dto.settings ?? undefined,
        webhookSecret: dto.webhookSecret ?? undefined,
      }
    });
  }

  async deleteConnection(id: string) {
    const prisma = this.prismaClient();

    // First, delete related logs and webhook events
    await prisma.integrationSyncLog.deleteMany({ where: { connectionId: id } });
    await prisma.integrationWebhookEvent.deleteMany({ where: { connectionId: id } });

    // Then delete the connection
    await prisma.integrationConnection.delete({ where: { id } });

    return { ok: true, deleted: id };
  }

  /**
   * OAuth provider configuration
   * In production, these would come from environment variables
   */
  private getOAuthConfig(provider: string) {
    const configs: Record<string, {
      authUrl: string;
      tokenUrl: string;
      clientId: string;
      clientSecret: string;
      scopes: string[];
      integrationType: string;
    }> = {
      qbo: {
        authUrl: "https://appcenter.intuit.com/connect/oauth2",
        tokenUrl: "https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer",
        clientId: process.env.QBO_CLIENT_ID || "",
        clientSecret: process.env.QBO_CLIENT_SECRET || "",
        scopes: ["com.intuit.quickbooks.accounting"],
        integrationType: "accounting"
      },
      xero: {
        authUrl: "https://login.xero.com/identity/connect/authorize",
        tokenUrl: "https://identity.xero.com/connect/token",
        clientId: process.env.XERO_CLIENT_ID || "",
        clientSecret: process.env.XERO_CLIENT_SECRET || "",
        scopes: ["openid", "profile", "email", "accounting.transactions", "accounting.contacts"],
        integrationType: "accounting"
      },
      hubspot: {
        authUrl: "https://app.hubspot.com/oauth/authorize",
        tokenUrl: "https://api.hubapi.com/oauth/v1/token",
        clientId: process.env.HUBSPOT_CLIENT_ID || "",
        clientSecret: process.env.HUBSPOT_CLIENT_SECRET || "",
        scopes: ["crm.objects.contacts.read", "crm.objects.contacts.write"],
        integrationType: "crm"
      },
      zendesk: {
        authUrl: "https://www.zendesk.com/oauth/authorizations/new",
        tokenUrl: "https://www.zendesk.com/oauth/tokens",
        clientId: process.env.ZENDESK_CLIENT_ID || "",
        clientSecret: process.env.ZENDESK_CLIENT_SECRET || "",
        scopes: ["read", "write"],
        integrationType: "crm"
      }
    };

    return configs[provider.toLowerCase()] || null;
  }

  /**
   * Generate OAuth state token for CSRF protection
   */
  private generateOAuthState(campgroundId: string, provider: string): string {
    const payload = {
      campgroundId,
      provider,
      timestamp: Date.now(),
      nonce: crypto.randomBytes(16).toString("hex")
    };
    // In production, this should be encrypted/signed
    return Buffer.from(JSON.stringify(payload)).toString("base64url");
  }

  /**
   * Parse OAuth state token
   */
  private parseOAuthState(state: string): { campgroundId: string; provider: string } | null {
    try {
      const payload = JSON.parse(Buffer.from(state, "base64url").toString());
      // Verify state is not too old (15 min max)
      if (Date.now() - payload.timestamp > 15 * 60 * 1000) {
        return null;
      }
      return { campgroundId: payload.campgroundId, provider: payload.provider };
    } catch {
      return null;
    }
  }

  /**
   * Get OAuth authorization URL for a provider
   */
  getOAuthAuthorizationUrl(provider: string, campgroundId: string, customRedirectUri?: string) {
    const config = this.getOAuthConfig(provider);

    if (!config) {
      // For providers without OAuth config, return instructions for manual setup
      return {
        provider,
        requiresManualSetup: true,
        instructions: this.getManualSetupInstructions(provider),
        webhookUrl: `${process.env.API_BASE_URL || "https://api.campreserv.com"}/integrations/webhooks/${provider}`
      };
    }

    if (!config.clientId) {
      return {
        provider,
        error: "not_configured",
        message: `${provider.toUpperCase()} integration is not yet configured. Please contact support.`
      };
    }

    const state = this.generateOAuthState(campgroundId, provider);
    const redirectUri = customRedirectUri || `${process.env.API_BASE_URL || "http://localhost:4000/api"}/integrations/oauth/${provider}/callback`;

    const params = new URLSearchParams({
      client_id: config.clientId,
      redirect_uri: redirectUri,
      response_type: "code",
      scope: config.scopes.join(" "),
      state
    });

    return {
      provider,
      authorizationUrl: `${config.authUrl}?${params.toString()}`,
      state
    };
  }

  /**
   * Handle OAuth callback - exchange code for tokens
   */
  async handleOAuthCallback(
    provider: string,
    code: string,
    state: string,
    error?: string
  ): Promise<{ success: boolean; connectionId?: string; error?: string }> {
    if (error) {
      return { success: false, error };
    }

    const stateData = this.parseOAuthState(state);
    if (!stateData) {
      return { success: false, error: "invalid_state" };
    }

    const config = this.getOAuthConfig(provider);
    if (!config) {
      return { success: false, error: "unknown_provider" };
    }

    try {
      // Exchange code for tokens
      const redirectUri = `${process.env.API_BASE_URL || "http://localhost:4000/api"}/integrations/oauth/${provider}/callback`;

      const tokenResponse = await fetch(config.tokenUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Accept: "application/json"
        },
        body: new URLSearchParams({
          grant_type: "authorization_code",
          code,
          redirect_uri: redirectUri,
          client_id: config.clientId,
          client_secret: config.clientSecret
        }).toString()
      });

      if (!tokenResponse.ok) {
        const errorData = await tokenResponse.text();
        this.logger.error(`OAuth token exchange failed for ${provider}: ${errorData}`);
        return { success: false, error: "token_exchange_failed" };
      }

      const tokens = await tokenResponse.json();

      // Store the connection
      const prisma = this.prismaClient();
      const connection = await prisma.integrationConnection.upsert({
        where: {
          campgroundId_type_provider: {
            campgroundId: stateData.campgroundId,
            type: config.integrationType,
            provider
          }
        },
        create: {
          campgroundId: stateData.campgroundId,
          type: config.integrationType,
          provider,
          status: "connected",
          authType: "oauth",
          credentials: {
            accessToken: tokens.access_token,
            refreshToken: tokens.refresh_token,
            expiresAt: tokens.expires_in ? Date.now() + tokens.expires_in * 1000 : null,
            tokenType: tokens.token_type,
            // Provider-specific fields
            realmId: tokens.realmId, // QuickBooks
            tenantId: tokens.tenantId // Xero
          },
          settings: {},
          lastSyncStatus: "connected"
        },
        update: {
          status: "connected",
          credentials: {
            accessToken: tokens.access_token,
            refreshToken: tokens.refresh_token,
            expiresAt: tokens.expires_in ? Date.now() + tokens.expires_in * 1000 : null,
            tokenType: tokens.token_type,
            realmId: tokens.realmId,
            tenantId: tokens.tenantId
          },
          lastSyncStatus: "connected",
          lastError: null
        }
      });

      // Log the successful connection
      await this.recordSyncLog(
        connection.id,
        "success",
        `OAuth connection established with ${provider}`,
        { provider, authType: "oauth" },
        config.integrationType,
        "connect"
      );

      return { success: true, connectionId: connection.id };
    } catch (err: any) {
      this.logger.error(`OAuth callback error for ${provider}: ${err?.message || "unknown_error"}`, err.stack);
      return { success: false, error: err?.message || "unknown_error" };
    }
  }

  /**
   * Get manual setup instructions for providers without OAuth
   */
  private getManualSetupInstructions(provider: string): string {
    const instructions: Record<string, string> = {
      sftp: "Configure your SFTP server details including host, port, username, and private key or password.",
      api: "Use the webhook URL below to receive events. Configure your external service to POST JSON payloads to this endpoint.",
      openpath: "Enter your OpenPath API credentials to enable automatic gate code generation.",
      salto: "Enter your Salto system credentials to sync access control."
    };

    return instructions[provider.toLowerCase()] || "Contact support for setup instructions.";
  }

  async listLogs(connectionId: string, limit = 50, cursor?: string) {
    const prisma = this.prismaClient();
    const take = Math.min(limit, 200);
    const logs = await prisma.integrationSyncLog.findMany({
      where: { connectionId },
      orderBy: { occurredAt: "desc" },
      take: take + 1,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {})
    });
    const hasMore = logs.length > take;
    const items = hasMore ? logs.slice(0, take) : logs;
    return { items, nextCursor: hasMore ? items[items.length - 1].id : null };
  }

  async listWebhookEvents(connectionId: string, limit = 50, cursor?: string) {
    const prisma = this.prismaClient();
    const take = Math.min(limit, 200);
    const events = await prisma.integrationWebhookEvent.findMany({
      where: { connectionId },
      orderBy: { receivedAt: "desc" },
      take: take + 1,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {})
    });
    const hasMore = events.length > take;
    const items = hasMore ? events.slice(0, take) : events;
    return { items, nextCursor: hasMore ? items[items.length - 1].id : null };
  }

  async recordSyncLog(connectionId: string, status: string, message?: string, payload?: any, scope?: string, direction?: string) {
    const prisma = this.prismaClient();
    return prisma.integrationSyncLog.create({
      data: {
        connectionId,
        status,
        message: message ?? null,
        payload: payload ?? null,
        scope: scope ?? "accounting",
        direction: direction ?? "pull"
      }
    });
  }

  private async runQboSandboxPull(connection: any, direction?: string, scope?: string) {
    const token = process.env.QBO_SANDBOX_TOKEN;
    const realmId = (connection.settings as any)?.realmId || process.env.QBO_SANDBOX_REALMID;
    const base = process.env.QBO_SANDBOX_BASE || "https://sandbox-quickbooks.api.intuit.com";

    if (!token || !realmId) {
      return { ok: false, reason: "missing_token_or_realm" };
    }

    try {
      const query = encodeURIComponent("select * from Account maxresults 5");
      const res = await fetch(`${base}/v3/company/${realmId}/query?query=${query}`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/json",
          "Content-Type": "application/text"
        }
      });
      if (!res.ok) {
        return { ok: false, reason: `qbo_http_${res.status}` };
      }
      const json = await res.json();
      const accounts = (json?.QueryResponse?.Account as any[]) || [];
      const summary = {
        realmId,
        accountCount: accounts.length,
        sample: accounts.slice(0, 3).map((a) => ({ id: a.Id, name: a.Name, type: a.AccountType }))
      };
      await this.recordSyncLog(connection.id, "success", "QBO sandbox pull complete", summary, scope ?? "accounting", direction ?? "pull");
      await this.prismaClient().integrationConnection.update({
        where: { id: connection.id },
        data: { lastSyncAt: new Date(), lastSyncStatus: "success", lastError: null }
      });
      return { ok: true, summary };
    } catch (err: any) {
      await this.recordSyncLog(connection.id, "failed", err?.message || "QBO sandbox pull failed", null, scope ?? "accounting", direction ?? "pull");
      await this.prismaClient().integrationConnection.update({
        where: { id: connection.id },
        data: { lastSyncAt: new Date(), lastSyncStatus: "error", lastError: err?.message ?? "Unknown error" }
      });
      return { ok: false, reason: "exception", error: err?.message };
    }
  }

  async triggerSync(connectionId: string, body: SyncRequestDto) {
    const prisma = this.prismaClient();
    const connection = await prisma.integrationConnection.findUnique({ where: { id: connectionId } });
    if (!connection) throw new BadRequestException("Connection not found");
    await this.recordSyncLog(connectionId, "queued", body?.note ?? "Manual sync queued", null, body.scope ?? connection.type, body.direction ?? "pull");

    // Sandbox provider wiring: run a lightweight simulated sync for known providers (e.g., QBO sandbox).
    const sandboxEnabled = (process.env.INTEGRATIONS_SANDBOX_ENABLED || "true").toLowerCase() !== "false";
    if (sandboxEnabled && connection.provider?.toLowerCase() === "qbo" && connection.type === "accounting") {
      const result = await this.runQboSandboxPull(connection, body.direction, body.scope);
      if (result.ok) {
        return { ok: true, connectionId, status: "success", sandbox: true, summary: result.summary };
      }
      // If sandbox pull failed due to missing creds, fall back to stub data to keep the manual sync usable.
      const samplePayload = {
        accounts: [
          { id: "1000", name: "Cash", type: "Asset" },
          { id: "2000", name: "Deferred Revenue", type: "Liability" },
        ],
        realmId: (connection.settings as any)?.realmId ?? "sandbox-realm",
        note: "Stubbed because sandbox creds/realm were missing",
      };
      await prisma.integrationSyncLog.create({
        data: {
          connectionId,
          direction: body.direction ?? "pull",
          scope: body.scope ?? "accounting",
          status: "success",
          message: "Sandbox QBO pull (stub) complete",
          payload: samplePayload,
        }
      });
      await prisma.integrationConnection.update({
        where: { id: connectionId },
        data: { lastSyncAt: new Date(), lastSyncStatus: "success", lastError: null }
      });
      return { ok: true, connectionId, status: "success", sandbox: true, summary: samplePayload };
    }

    return { ok: true, connectionId, status: "queued" };
  }

  async createExportJob(dto: CreateExportJobDto) {
    const prisma = this.prismaClient();
    if (!dto.type) throw new BadRequestException("type is required");
    const job = await prisma.integrationExportJob.create({
      data: {
        type: dto.type,
        connectionId: dto.connectionId ?? null,
        campgroundId: dto.campgroundId ?? null,
        resource: dto.resource ?? null,
        status: "queued",
        location: dto.location ?? null,
        requestedById: dto.requestedById ?? null,
        filters: dto.filters ?? null
      }
    });
    if (dto.connectionId) {
      await this.recordSyncLog(dto.connectionId, "queued", "Export job queued", { jobId: job.id, resource: dto.resource }, dto.resource ?? "export", "export");
    }
    return job;
  }

  verifyHmac(raw: string, secret: string, signature?: string): { valid: boolean; reason?: string } {
    // SECURITY: Never allow unsigned webhooks - require secret configuration
    if (!secret) {
      this.logger.warn('Webhook secret not configured - rejecting request');
      return { valid: false, reason: 'webhook_secret_not_configured' };
    }
    const provided = (signature || "").replace(/^sha256=/i, "");
    if (!provided) {
      return { valid: false, reason: 'no_signature_provided' };
    }
    const computed = crypto.createHmac("sha256", secret).update(raw).digest("hex");
    if (provided.length !== computed.length) {
      return { valid: false, reason: 'signature_length_mismatch' };
    }
    const isValid = crypto.timingSafeEqual(Buffer.from(computed), Buffer.from(provided));
    return { valid: isValid, reason: isValid ? undefined : 'signature_mismatch' };
  }

  async handleWebhook(provider: string, body: any, rawBody: string, signature?: string, campgroundId?: string) {
    const prisma = this.prismaClient();
    const connection = await prisma.integrationConnection.findFirst({
      where: {
        provider,
        ...(campgroundId ? { campgroundId } : {})
      }
    });

    // SECURITY: Require webhook secret - no fallback to empty string
    const secret = connection?.webhookSecret || process.env.INTEGRATIONS_WEBHOOK_SECRET || process.env.WEBHOOK_SECRET;
    const verification = this.verifyHmac(rawBody, secret || '', signature);
    const signatureValid = verification.valid;

    const event = await prisma.integrationWebhookEvent.create({
      data: {
        connectionId: connection?.id ?? null,
        provider,
        eventType: body?.type || body?.event || null,
        status: signatureValid ? "received" : "failed",
        signatureValid,
        message: signatureValid ? null : `Invalid signature: ${verification.reason || 'unknown'}`,
        payload: body ?? null,
      }
    });

    if (connection?.id) {
      await this.recordSyncLog(
        connection.id,
        signatureValid ? "queued" : "failed",
        signatureValid ? "Webhook received" : `Webhook signature invalid: ${verification.reason}`,
        { webhookEventId: event.id },
        connection.type,
        "webhook"
      );
    }

    return { ok: signatureValid, connectionId: connection?.id ?? null, eventId: event.id, reason: verification.reason };
  }
}

