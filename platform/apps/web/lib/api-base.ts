/**
 * Resolves the API base URL for server-side requests.
 *
 * For SSR (server-side rendering), we need to use the full backend URL
 * since Next.js rewrites only work for client-side requests.
 */
export function getServerApiBase(): string {
  // If explicitly set via env var (and not empty), use that
  const envApiBase = process.env.NEXT_PUBLIC_API_BASE;
  if (envApiBase && envApiBase.trim() !== "") {
    return envApiBase;
  }

  // Check if running locally (localhost detection)
  // In Railway and other cloud environments, these won't be set
  const isLocalDev =
    process.env.NODE_ENV === "development" ||
    process.env.HOSTNAME === "localhost" ||
    process.env.npm_lifecycle_event === "dev";

  if (isLocalDev) {
    return "http://localhost:4000";
  }

  // Default to production Railway API URL for all other cases
  // This handles Railway, Vercel, and any other cloud deployment
  return "https://camp-everydayapi-production.up.railway.app";
}

/**
 * Builds the full API URL for a given endpoint path.
 *
 * Handles the case where NEXT_PUBLIC_API_BASE may or may not end with /api.
 * The endpoint should NOT include /api prefix (e.g., "/public/locations/minnesota").
 */
export function getServerApiUrl(endpoint: string): string {
  const base = getServerApiBase();
  // If base already ends with /api, don't add another /api prefix
  const apiPrefix = base.endsWith("/api") ? "" : "/api";
  // Ensure endpoint starts with /
  const normalizedEndpoint = endpoint.startsWith("/") ? endpoint : `/${endpoint}`;
  return `${base}${apiPrefix}${normalizedEndpoint}`;
}
