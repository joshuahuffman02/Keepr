/**
 * Resolves the API base URL for server-side requests.
 *
 * For SSR (server-side rendering), we need to use the full backend URL
 * since Next.js rewrites only work for client-side requests.
 *
 * Priority:
 * 1. NEXT_PUBLIC_API_BASE environment variable (if set and non-empty)
 * 2. RAILWAY_ENVIRONMENT or NODE_ENV === "production": Railway API backend
 * 3. Development: localhost:4000
 */
export function getServerApiBase(): string {
  // If explicitly set via env var (and not empty), use that
  const envApiBase = process.env.NEXT_PUBLIC_API_BASE;
  if (envApiBase && envApiBase.trim() !== "") {
    return envApiBase;
  }

  // Check for Railway environment or production mode
  const isProduction =
    process.env.RAILWAY_ENVIRONMENT === "production" ||
    process.env.NODE_ENV === "production" ||
    process.env.VERCEL_ENV === "production";

  if (isProduction) {
    return "https://camp-everydayapi-production.up.railway.app";
  }

  // In development, use localhost
  return "http://localhost:4000";
}
