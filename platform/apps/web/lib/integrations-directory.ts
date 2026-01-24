/**
 * Integration Directory - Defines available integrations and their metadata
 * Used for the visual integration catalog
 */

export type IntegrationCategory = "accounting" | "crm" | "access_control" | "export";

export interface IntegrationDefinition {
  id: string;
  name: string;
  description: string;
  longDescription?: string;
  category: IntegrationCategory;
  logo: string; // Lucide icon name or URL
  features: string[];
  comingSoon?: boolean;
  popular?: boolean;
}

export const INTEGRATION_CATEGORIES: Record<
  IntegrationCategory,
  { label: string; description: string }
> = {
  accounting: {
    label: "Accounting",
    description: "Sync payments and invoices with your accounting software",
  },
  crm: {
    label: "Customer Support & CRM",
    description: "Keep guest data in sync with your CRM and support tools",
  },
  access_control: {
    label: "Access Control",
    description: "Automate gate codes and access for arriving guests",
  },
  export: {
    label: "Data Export",
    description: "Automated exports to external systems",
  },
};

export const INTEGRATIONS_DIRECTORY: IntegrationDefinition[] = [
  // Accounting
  {
    id: "qbo",
    name: "QuickBooks Online",
    description: "Sync reservations and payments automatically",
    longDescription:
      "Keep your books accurate with automatic syncing of reservation revenue, payments, and refunds to QuickBooks Online. Save hours of manual data entry every week.",
    category: "accounting",
    logo: "Calculator",
    features: [
      "Auto-sync payments and refunds",
      "Invoice generation",
      "Revenue categorization",
      "Tax rate mapping",
    ],
    popular: true,
  },
  {
    id: "xero",
    name: "Xero",
    description: "Connect your Xero accounting software",
    longDescription:
      "Automatically sync your campground's financial data to Xero. Payments, invoices, and refunds flow seamlessly to your books.",
    category: "accounting",
    logo: "FileSpreadsheet",
    features: [
      "Two-way invoice sync",
      "Payment reconciliation",
      "Multi-currency support",
      "Bank feed matching",
    ],
  },
  {
    id: "freshbooks",
    name: "FreshBooks",
    description: "Simple invoicing for your campground",
    longDescription: "Send professional invoices and track payments with FreshBooks integration.",
    category: "accounting",
    logo: "Receipt",
    features: ["Invoice automation", "Payment tracking", "Expense sync"],
    comingSoon: true,
  },

  // CRM / Customer Support
  {
    id: "hubspot",
    name: "HubSpot",
    description: "Turn guests into lifelong customers",
    longDescription:
      "Sync guest data to HubSpot CRM. Track communication history, segment guests, and run targeted marketing campaigns.",
    category: "crm",
    logo: "Users",
    features: ["Guest contact sync", "Booking history", "Email campaign triggers", "Lead scoring"],
    popular: true,
  },
  {
    id: "zendesk",
    name: "Zendesk",
    description: "Customer support ticketing",
    longDescription:
      "Create support tickets automatically and view guest reservation history directly in Zendesk.",
    category: "crm",
    logo: "MessageSquare",
    features: [
      "Ticket creation from CampReserv",
      "Guest context in tickets",
      "Reservation lookup",
      "Status sync",
    ],
  },
  {
    id: "intercom",
    name: "Intercom",
    description: "Live chat and messaging",
    longDescription:
      "Provide real-time support to guests with Intercom. Guest data syncs automatically for context-rich conversations.",
    category: "crm",
    logo: "MessagesSquare",
    features: [
      "Live chat widget",
      "Guest identification",
      "Automated messages",
      "Inbox integration",
    ],
    comingSoon: true,
  },

  // Access Control
  {
    id: "openpath",
    name: "OpenPath",
    description: "Smart lock and gate automation",
    longDescription:
      "Automatically generate and send gate codes to guests before arrival. Revoke access on checkout.",
    category: "access_control",
    logo: "KeyRound",
    features: [
      "Auto-generated gate codes",
      "Check-in activation",
      "Checkout revocation",
      "Access logging",
    ],
    comingSoon: true,
  },
  {
    id: "salto",
    name: "Salto",
    description: "Electronic access management",
    longDescription:
      "Integrate with Salto access control systems for seamless guest entry management.",
    category: "access_control",
    logo: "DoorOpen",
    features: ["Mobile key delivery", "Time-limited access", "Audit trails"],
    comingSoon: true,
  },

  // Export
  {
    id: "sftp",
    name: "SFTP Export",
    description: "Automated data exports",
    longDescription:
      "Schedule automatic exports of reservation, payment, and guest data to your SFTP server for backup or integration with other systems.",
    category: "export",
    logo: "FolderSync",
    features: [
      "Scheduled exports",
      "Custom file formats",
      "Secure transfer",
      "Multiple destinations",
    ],
  },
  {
    id: "api",
    name: "Custom API Export",
    description: "Push data to any API endpoint",
    longDescription:
      "Send reservation and payment events to your own API endpoints in real-time via webhooks.",
    category: "export",
    logo: "Webhook",
    features: ["Real-time webhooks", "Custom payloads", "Retry logic", "Event filtering"],
  },
  {
    id: "custom",
    name: "Custom Integration",
    description: "Connect any service using webhooks & API",
    longDescription:
      "For services we don't have pre-built support for, use our webhook URL and API credentials to build your own integration.",
    category: "export",
    logo: "Settings",
    features: [
      "Webhook URL for incoming events",
      "API key for outgoing requests",
      "Custom configuration",
      "Works with any service",
    ],
  },
];

export function getIntegrationById(id: string): IntegrationDefinition | undefined {
  return INTEGRATIONS_DIRECTORY.find((i) => i.id === id);
}

export function getIntegrationsByCategory(category: IntegrationCategory): IntegrationDefinition[] {
  return INTEGRATIONS_DIRECTORY.filter((i) => i.category === category);
}

export function getPopularIntegrations(): IntegrationDefinition[] {
  return INTEGRATIONS_DIRECTORY.filter((i) => i.popular);
}
