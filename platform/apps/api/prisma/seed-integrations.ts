/**
 * Seed Integration Marketplace Definitions
 *
 * This script seeds the IntegrationDefinition table with available integrations.
 * Run with: npx ts-node prisma/seed-integrations.ts
 *
 * Note: These are also auto-seeded on app start via IntegrationRegistryService.onModuleInit()
 */

import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL || process.env.PLATFORM_DATABASE_URL,
});
// @ts-ignore Prisma 7 adapter signature
const prisma = new PrismaClient({ adapter });

const integrationDefinitions = [
  // Accounting
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
    isPremium: false,
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
    isPremium: false,
    sortOrder: 20,
  },

  // Marketing
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
    isPremium: false,
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
    isPremium: false,
    sortOrder: 40,
  },
  {
    slug: "sendgrid",
    name: "SendGrid",
    description:
      "Use SendGrid for transactional and marketing emails. Sync guest contacts and track email delivery.",
    category: "marketing",
    logoUrl: "/integrations/sendgrid-logo.svg",
    docsUrl: "https://docs.sendgrid.com/",
    authType: "api_key",
    syncTypes: ["guests"],
    webhookTypes: ["email.delivered", "email.opened", "email.clicked"],
    features: {
      transactionalEmail: true,
      contactSync: true,
      analytics: true,
    },
    isActive: true,
    isBeta: true,
    isPremium: false,
    sortOrder: 45,
  },

  // Smart Locks
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
    isPremium: false,
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
    isPremium: false,
    sortOrder: 60,
  },
  {
    slug: "yale",
    name: "Yale Access",
    description:
      "Integrate Yale smart locks for secure, code-based guest entry. Supports scheduled access windows.",
    category: "locks",
    logoUrl: "/integrations/yale-logo.svg",
    docsUrl: "https://www.yalehome.com/us/en",
    authType: "oauth2",
    syncTypes: ["reservations"],
    webhookTypes: ["lock.activity"],
    features: {
      guestCodes: true,
      scheduledAccess: true,
      activityLog: true,
    },
    isActive: true,
    isBeta: true,
    isPremium: true,
    sortOrder: 65,
  },

  // Insurance
  {
    slug: "outdoorsy-insurance",
    name: "Outdoorsy Insurance",
    description:
      "Verify RV insurance coverage for guests. Automatically check certificates of insurance against reservations.",
    category: "insurance",
    logoUrl: "/integrations/outdoorsy-logo.svg",
    docsUrl: "https://www.outdoorsy.com/",
    authType: "api_key",
    syncTypes: ["reservations", "guests"],
    webhookTypes: ["coverage.verified", "coverage.expired"],
    features: {
      coverageVerification: true,
      expiryAlerts: true,
      documentStorage: true,
    },
    isActive: true,
    isBeta: true,
    isPremium: true,
    sortOrder: 70,
  },

  // CRM
  {
    slug: "hubspot",
    name: "HubSpot",
    description:
      "Sync guest contacts and booking data to HubSpot CRM. Track customer interactions and automate follow-ups.",
    category: "crm",
    logoUrl: "/integrations/hubspot-logo.svg",
    docsUrl: "https://developers.hubspot.com/",
    authType: "oauth2",
    syncTypes: ["guests", "reservations"],
    webhookTypes: ["contact.created", "contact.updated"],
    features: {
      contactSync: true,
      dealTracking: true,
      automatedWorkflows: true,
    },
    isActive: true,
    isBeta: false,
    isPremium: true,
    sortOrder: 80,
  },
  {
    slug: "salesforce",
    name: "Salesforce",
    description:
      "Enterprise CRM integration with Salesforce. Sync customers, bookings, and revenue data.",
    category: "crm",
    logoUrl: "/integrations/salesforce-logo.svg",
    docsUrl: "https://developer.salesforce.com/",
    authType: "oauth2",
    syncTypes: ["guests", "reservations", "payments"],
    webhookTypes: ["contact.updated", "opportunity.updated"],
    features: {
      accountSync: true,
      opportunityTracking: true,
      reporting: true,
    },
    isActive: true,
    isBeta: true,
    isPremium: true,
    sortOrder: 85,
  },

  // Analytics
  {
    slug: "google-analytics",
    name: "Google Analytics 4",
    description:
      "Send booking events and revenue data to Google Analytics. Track conversion funnels and user behavior.",
    category: "analytics",
    logoUrl: "/integrations/google-analytics-logo.svg",
    docsUrl: "https://developers.google.com/analytics",
    authType: "api_key",
    syncTypes: ["reservations", "payments"],
    webhookTypes: [],
    features: {
      eventTracking: true,
      ecommerceTracking: true,
      conversionFunnels: true,
    },
    isActive: true,
    isBeta: false,
    isPremium: false,
    sortOrder: 90,
  },
  {
    slug: "segment",
    name: "Segment",
    description:
      "Central data hub for analytics. Route booking and customer data to multiple destinations.",
    category: "analytics",
    logoUrl: "/integrations/segment-logo.svg",
    docsUrl: "https://segment.com/docs/",
    authType: "api_key",
    syncTypes: ["guests", "reservations", "payments"],
    webhookTypes: [],
    features: {
      eventRouting: true,
      identityResolution: true,
      multiDestination: true,
    },
    isActive: true,
    isBeta: true,
    isPremium: true,
    sortOrder: 95,
  },
];

async function seedIntegrations() {
  console.log("Seeding integration definitions...\n");

  for (const def of integrationDefinitions) {
    try {
      const result = await prisma.integrationDefinition.upsert({
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
          isActive: def.isActive,
          isBeta: def.isBeta,
          isPremium: def.isPremium,
          sortOrder: def.sortOrder,
        },
      });
      console.log(`  [${def.category}] ${def.name} (${def.slug})`);
    } catch (error) {
      console.error(`  Failed to seed ${def.slug}: ${(error as Error).message}`);
    }
  }

  console.log(`\nSeeded ${integrationDefinitions.length} integration definitions.`);
}

seedIntegrations()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
