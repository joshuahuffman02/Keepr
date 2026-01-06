/**
 * Centralized API configuration.
 *
 * Environment variable NEXT_PUBLIC_API_BASE MUST be set in all environments:
 * - Development: http://localhost:4000/api
 * - Staging: https://api-staging.keeprstay.com/api
 * - Production: https://api.keeprstay.com/api
 *
 * This eliminates hardcoded URLs and makes staging environments work correctly.
 */

function getApiBase(): string {
  const envApiBase = process.env.NEXT_PUBLIC_API_BASE;

  if (envApiBase) {
    // Remove trailing slash if present
    return envApiBase.replace(/\/$/, "");
  }

  // Only fall back to localhost in development
  if (process.env.NODE_ENV === "development") {
    console.warn(
      "[api-config] NEXT_PUBLIC_API_BASE not set, defaulting to localhost:4000"
    );
    return "http://localhost:4000/api";
  }

  // In production/staging, this is a configuration error
  throw new Error(
    "NEXT_PUBLIC_API_BASE environment variable is required in non-development environments"
  );
}

export const API_BASE = getApiBase();

/**
 * Build a full API URL from an endpoint path.
 * @param endpoint - The endpoint path (e.g., '/auth/login' or 'auth/login')
 */
export function apiUrl(endpoint: string): string {
  const base = API_BASE.replace(/\/$/, ""); // Remove trailing slash
  const path = endpoint.startsWith("/") ? endpoint : `/${endpoint}`;
  return `${base}${path}`;
}
