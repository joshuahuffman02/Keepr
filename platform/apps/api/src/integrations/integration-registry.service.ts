import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { IntegrationProvider } from "./framework/integration-provider.interface";
import { IntegrationFrameworkService } from "./framework/integration-framework.service";

/**
 * Integration Category
 */
export interface IntegrationCategory {
  slug: string;
  name: string;
  description: string;
  icon: string;
}

/**
 * Integration listing for marketplace
 */
export interface IntegrationListing {
  id: string;
  slug: string;
  name: string;
  description: string;
  category: string;
  logoUrl: string | null;
  docsUrl: string | null;
  authType: string;
  syncTypes: string[];
  features: Record<string, unknown> | null;
  isActive: boolean;
  isBeta: boolean;
  isPremium: boolean;
  isConnected?: boolean;
  connectionStatus?: string;
  lastSyncAt?: Date;
}

/**
 * Integration Registry Service
 *
 * Manages the catalog of available integrations and provides
 * marketplace-level operations.
 */
@Injectable()
export class IntegrationRegistryService implements OnModuleInit {
  private readonly logger = new Logger(IntegrationRegistryService.name);

  private readonly categories: IntegrationCategory[] = [
    {
      slug: "accounting",
      name: "Accounting",
      description: "Sync financial data with your accounting software",
      icon: "calculator",
    },
    {
      slug: "marketing",
      name: "Marketing",
      description: "Connect email and marketing automation tools",
      icon: "megaphone",
    },
    {
      slug: "locks",
      name: "Smart Locks",
      description: "Automate access control with smart lock systems",
      icon: "lock",
    },
    {
      slug: "insurance",
      name: "Insurance",
      description: "Verify guest insurance and certificates",
      icon: "shield-check",
    },
    {
      slug: "crm",
      name: "CRM",
      description: "Sync guest data with your CRM platform",
      icon: "users",
    },
    {
      slug: "pms",
      name: "Property Management",
      description: "Connect with other property management systems",
      icon: "building",
    },
    {
      slug: "payments",
      name: "Payments",
      description: "Alternative payment processors and gateways",
      icon: "credit-card",
    },
    {
      slug: "analytics",
      name: "Analytics",
      description: "Send data to analytics and BI platforms",
      icon: "chart-bar",
    },
  ];

  constructor(
    private readonly prisma: PrismaService,
    private readonly framework: IntegrationFrameworkService
  ) {}

  async onModuleInit() {
    await this.seedDefaultDefinitions();
  }

  /**
   * Get all integration categories
   */
  getCategories(): IntegrationCategory[] {
    return this.categories;
  }

  /**
   * List all available integrations
   */
  async listIntegrations(options?: {
    category?: string;
    activeOnly?: boolean;
  }): Promise<IntegrationListing[]> {
    const where: any = {};

    if (options?.activeOnly !== false) {
      where.isActive = true;
    }

    if (options?.category) {
      where.category = options.category;
    }

    const definitions = await this.prisma.integrationDefinition.findMany({
      where,
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    });

    return definitions.map((def) => ({
      id: def.id,
      slug: def.slug,
      name: def.name,
      description: def.description,
      category: def.category,
      logoUrl: def.logoUrl,
      docsUrl: def.docsUrl,
      authType: def.authType,
      syncTypes: def.syncTypes,
      features: def.features as Record<string, unknown> | null,
      isActive: def.isActive,
      isBeta: def.isBeta,
      isPremium: def.isPremium,
    }));
  }

  /**
   * Get integration by slug
   */
  async getIntegration(slug: string): Promise<IntegrationListing | null> {
    const definition = await this.prisma.integrationDefinition.findUnique({
      where: { slug },
    });

    if (!definition) return null;

    return {
      id: definition.id,
      slug: definition.slug,
      name: definition.name,
      description: definition.description,
      category: definition.category,
      logoUrl: definition.logoUrl,
      docsUrl: definition.docsUrl,
      authType: definition.authType,
      syncTypes: definition.syncTypes,
      features: definition.features as Record<string, unknown> | null,
      isActive: definition.isActive,
      isBeta: definition.isBeta,
      isPremium: definition.isPremium,
    };
  }

  /**
   * List integrations with connection status for a campground
   */
  async listIntegrationsWithStatus(
    campgroundId: string,
    options?: { category?: string }
  ): Promise<IntegrationListing[]> {
    const integrations = await this.listIntegrations(options);

    // Get all connections for this campground
    const connections = await this.prisma.marketplaceConnection.findMany({
      where: { campgroundId },
      select: {
        definitionId: true,
        status: true,
        lastSyncAt: true,
      },
    });

    const connectionMap = new Map(
      connections.map((c) => [c.definitionId, c])
    );

    return integrations.map((integration) => {
      const connection = connectionMap.get(integration.id);
      return {
        ...integration,
        isConnected: connection?.status === "connected",
        connectionStatus: connection?.status,
        lastSyncAt: connection?.lastSyncAt || undefined,
      };
    });
  }

  /**
   * Get all connections for a campground
   */
  async getConnections(campgroundId: string) {
    const connections = await this.prisma.marketplaceConnection.findMany({
      where: { campgroundId },
      include: {
        definition: true,
        syncLogs: {
          orderBy: { startedAt: "desc" },
          take: 1,
        },
      },
      orderBy: { updatedAt: "desc" },
    });

    return connections.map((conn) => ({
      id: conn.id,
      integration: {
        slug: conn.definition.slug,
        name: conn.definition.name,
        category: conn.definition.category,
        logoUrl: conn.definition.logoUrl,
      },
      status: conn.status,
      lastSyncAt: conn.lastSyncAt,
      lastSyncStatus: conn.lastSyncStatus,
      errorMessage: conn.errorMessage,
      syncEnabled: conn.syncEnabled,
      createdAt: conn.createdAt,
      updatedAt: conn.updatedAt,
      lastLog: conn.syncLogs[0] || null,
    }));
  }

  /**
   * Get sync logs for a connection
   */
  async getSyncLogs(
    connectionId: string,
    options?: { limit?: number; cursor?: string }
  ) {
    const limit = Math.min(options?.limit || 50, 200);

    const logs = await this.prisma.marketplaceSyncLog.findMany({
      where: { connectionId },
      orderBy: { startedAt: "desc" },
      take: limit + 1,
      ...(options?.cursor
        ? { cursor: { id: options.cursor }, skip: 1 }
        : {}),
    });

    const hasMore = logs.length > limit;
    const items = hasMore ? logs.slice(0, limit) : logs;

    return {
      items,
      nextCursor: hasMore ? items[items.length - 1].id : null,
    };
  }

  /**
   * Check if an integration provider is registered and available
   */
  isProviderAvailable(slug: string): boolean {
    return !!this.framework.getProvider(slug);
  }

  /**
   * Get provider capabilities
   */
  getProviderCapabilities(slug: string): {
    hasOAuth: boolean;
    hasWebhook: boolean;
    hasSync: boolean;
    hasConfigSchema: boolean;
  } | null {
    const provider = this.framework.getProvider(slug);
    if (!provider) return null;

    return {
      hasOAuth: !!provider.initiateOAuth,
      hasWebhook: !!provider.handleWebhook,
      hasSync: !!provider.sync,
      hasConfigSchema: !!provider.getConfigSchema,
    };
  }

  /**
   * Seed default integration definitions
   */
  private async seedDefaultDefinitions() {
    const definitions = [
      {
        slug: "quickbooks",
        name: "QuickBooks Online",
        description:
          "Sync payments, invoices, and financial data with QuickBooks Online. Automatically create invoices for reservations and record payments.",
        category: "accounting",
        logoUrl: "/integrations/quickbooks-logo.svg",
        docsUrl: "https://developer.intuit.com/app/developer/qbo/docs/get-started",
        authType: "oauth2",
        syncTypes: ["payments", "reservations", "guests"],
        webhookTypes: ["payment.created", "invoice.updated"],
        features: {
          autoInvoice: true,
          paymentSync: true,
          customerSync: true,
        },
        isActive: true,
        isBeta: false,
        sortOrder: 10,
      },
      {
        slug: "xero",
        name: "Xero",
        description:
          "Connect to Xero accounting software. Sync invoices, payments, and contacts automatically.",
        category: "accounting",
        logoUrl: "/integrations/xero-logo.svg",
        docsUrl: "https://developer.xero.com/documentation/",
        authType: "oauth2",
        syncTypes: ["payments", "reservations", "guests"],
        webhookTypes: ["invoice.created", "payment.created"],
        features: {
          autoInvoice: true,
          paymentSync: true,
          contactSync: true,
        },
        isActive: true,
        isBeta: false,
        sortOrder: 20,
      },
      {
        slug: "mailchimp",
        name: "Mailchimp",
        description:
          "Sync guest data to Mailchimp for email marketing campaigns. Automatically add guests to lists based on their booking behavior.",
        category: "marketing",
        logoUrl: "/integrations/mailchimp-logo.svg",
        docsUrl: "https://mailchimp.com/developer/",
        authType: "oauth2",
        syncTypes: ["guests"],
        webhookTypes: ["subscriber.updated", "campaign.sent"],
        features: {
          listSync: true,
          segmentation: true,
          automations: true,
        },
        isActive: true,
        isBeta: false,
        sortOrder: 30,
      },
      {
        slug: "klaviyo",
        name: "Klaviyo",
        description:
          "Connect Klaviyo for advanced email and SMS marketing. Sync guest profiles and booking events for personalized campaigns.",
        category: "marketing",
        logoUrl: "/integrations/klaviyo-logo.svg",
        docsUrl: "https://developers.klaviyo.com/en",
        authType: "api_key",
        syncTypes: ["guests", "reservations"],
        webhookTypes: ["profile.updated"],
        features: {
          profileSync: true,
          eventTracking: true,
          smsMarketing: true,
        },
        isActive: true,
        isBeta: false,
        sortOrder: 40,
      },
      {
        slug: "remotelock",
        name: "RemoteLock",
        description:
          "Automate access control with RemoteLock smart locks. Generate unique access codes for each reservation automatically.",
        category: "locks",
        logoUrl: "/integrations/remotelock-logo.svg",
        docsUrl: "https://developer.remotelock.com/",
        authType: "api_key",
        syncTypes: ["reservations"],
        webhookTypes: ["access.granted", "access.revoked"],
        features: {
          autoCodeGeneration: true,
          scheduledAccess: true,
          auditLog: true,
        },
        isActive: true,
        isBeta: false,
        sortOrder: 50,
      },
      {
        slug: "august",
        name: "August Home",
        description:
          "Connect August smart locks for automated guest access. Create temporary access codes linked to reservation dates.",
        category: "locks",
        logoUrl: "/integrations/august-logo.svg",
        docsUrl: "https://august.com/pages/works-with-august",
        authType: "oauth2",
        syncTypes: ["reservations"],
        webhookTypes: ["lock.locked", "lock.unlocked"],
        features: {
          guestAccess: true,
          timeBasedCodes: true,
          lockStatus: true,
        },
        isActive: true,
        isBeta: true,
        sortOrder: 60,
      },
    ];

    for (const def of definitions) {
      try {
        await this.prisma.integrationDefinition.upsert({
          where: { slug: def.slug },
          create: def as any,
          update: {
            name: def.name,
            description: def.description,
            category: def.category,
            logoUrl: def.logoUrl,
            docsUrl: def.docsUrl,
            authType: def.authType,
            syncTypes: def.syncTypes,
            webhookTypes: def.webhookTypes,
            features: def.features as any,
            sortOrder: def.sortOrder,
          },
        });
      } catch (error) {
        this.logger.warn(`Failed to seed ${def.slug}: ${(error as Error).message}`);
      }
    }

    this.logger.log(`Seeded ${definitions.length} integration definitions`);
  }
}
