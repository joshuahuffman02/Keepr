export type ApiScope =
  | "reservations:read"
  | "reservations:write"
  | "guests:read"
  | "guests:write"
  | "sites:read"
  | "sites:write"
  | "webhooks:write"
  | "webhooks:read"
  | "tokens:read"
  | "tokens:write"
  | "payments:read"
  | "payments:write"
  | "analytics:read"
  | "inventory:read"
  | "inventory:write";

/**
 * API Client Tier
 * Determines rate limits and feature access
 */
export enum ApiClientTier {
  FREE = "free",
  STANDARD = "standard",
  ENTERPRISE = "enterprise",
}

/**
 * Tier configuration for rate limits
 */
export interface TierLimits {
  requestsPerHour: number;
  burstLimit: number;
  dailyLimit: number;
  concurrentLimit: number;
  webhooksLimit: number;
  retentionDays: number;
}

export const TIER_LIMITS: Record<ApiClientTier, TierLimits> = {
  [ApiClientTier.FREE]: {
    requestsPerHour: 100,
    burstLimit: 20,
    dailyLimit: 1000,
    concurrentLimit: 2,
    webhooksLimit: 2,
    retentionDays: 7,
  },
  [ApiClientTier.STANDARD]: {
    requestsPerHour: 1000,
    burstLimit: 100,
    dailyLimit: 10000,
    concurrentLimit: 10,
    webhooksLimit: 10,
    retentionDays: 30,
  },
  [ApiClientTier.ENTERPRISE]: {
    requestsPerHour: 10000,
    burstLimit: 500,
    dailyLimit: 100000,
    concurrentLimit: 50,
    webhooksLimit: 100,
    retentionDays: 90,
  },
};

export interface ApiPrincipal {
  apiClientId: string;
  tokenId: string;
  campgroundId: string;
  scopes: string[];
  tier?: ApiClientTier;
}

/**
 * Scope categories for permission grouping
 */
export const SCOPE_CATEGORIES = {
  reservations: ["reservations:read", "reservations:write"] as ApiScope[],
  guests: ["guests:read", "guests:write"] as ApiScope[],
  sites: ["sites:read", "sites:write"] as ApiScope[],
  webhooks: ["webhooks:read", "webhooks:write"] as ApiScope[],
  tokens: ["tokens:read", "tokens:write"] as ApiScope[],
  payments: ["payments:read", "payments:write"] as ApiScope[],
  analytics: ["analytics:read"] as ApiScope[],
  inventory: ["inventory:read", "inventory:write"] as ApiScope[],
};

/**
 * Default scopes for each tier
 */
export const DEFAULT_TIER_SCOPES: Record<ApiClientTier, ApiScope[]> = {
  [ApiClientTier.FREE]: [
    "reservations:read",
    "guests:read",
    "sites:read",
  ],
  [ApiClientTier.STANDARD]: [
    "reservations:read",
    "reservations:write",
    "guests:read",
    "guests:write",
    "sites:read",
    "sites:write",
    "webhooks:read",
    "webhooks:write",
    "tokens:read",
    "tokens:write",
  ],
  [ApiClientTier.ENTERPRISE]: [
    "reservations:read",
    "reservations:write",
    "guests:read",
    "guests:write",
    "sites:read",
    "sites:write",
    "webhooks:read",
    "webhooks:write",
    "tokens:read",
    "tokens:write",
    "payments:read",
    "payments:write",
    "analytics:read",
    "inventory:read",
    "inventory:write",
  ],
};

